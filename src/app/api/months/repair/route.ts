// Repair / re-link the month chain.
//
// Each monthly report has data that implicitly depends on its neighbours:
//   • Slide 7 Sales Quantity  — YTD total column is a sum of all earlier 2026 months
//   • Slide 10 Sales by Region — growth% compares salesThis vs the prior month's salesThis
//   • Slide 1 / Slide 3 Sales Achievement — 12-slot arrays must stay the full length
//   • Slide 7 product list    — must include every CANONICAL_PRODUCTS entry
//
// This endpoint walks every month chronologically, recomputes those cross-month
// fields, heals any truncated arrays, and saves the result back. It's safe to
// call repeatedly — it's idempotent.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { listMonthReports, upsertMonthReport, getMonthReport } from "@/lib/month-report";
import { prisma } from "@/lib/db";
import { applyYear2025ToReport, autoFixDriftFromSummary, parse2025Summary, type Year2025Reference } from "@/lib/parsers/year-2025";
import { fetchHqSummaryFromSalesDashboard } from "@/lib/salesdashboard-client";
import { CANONICAL_PRODUCTS } from "@/lib/catalog/products";
import type { MonthReport, SalesByQuantity, SalesByRegion, SalesAchievement, SalesByECP, Inventory } from "@/lib/schema";
import { REGIONS } from "@/lib/catalog/mappings";
import { mergeSalesAchievementChain } from "@/lib/sales-achievement-chain";
import { parseMasterXlsx } from "@/lib/parsers/pos-xlsx";
import { parsePosPdf } from "@/lib/parsers/pos-pdf";
import { salesByQuantity as computeSalesByQuantity, topProducts as computeTopProducts, priorYearQtyLookup } from "@/lib/aggregation";
import type { PosMasterParseResult, PosMcuvParseResult } from "@/lib/parsers/pos-pdf";

import { guardDept } from "@/lib/auth";
type RepairReport = {
  id: string;
  changed: boolean;
  notes: string[];
};

function ensure12(arr: (number | null)[] | undefined | null): (number | null)[] {
  const out = Array.from(arr ?? []) as (number | null)[];
  while (out.length < 12) out.push(null);
  return out.slice(0, 12);
}

function healSalesAchievement(sa: SalesAchievement | null): { value: SalesAchievement | null; changed: boolean } {
  if (!sa) return { value: null, changed: false };
  const nextTarget   = ensure12(sa.target2026);
  const nextActual   = ensure12(sa.actual2026);
  const nextPriorTgt = ensure12(sa.target2025);
  const nextPrior    = ensure12(sa.actual2025);
  const nextNi26     = ensure12(sa.netIncome2026);
  const nextNi25     = ensure12(sa.netIncome2025);
  const changed =
    nextTarget.length   !== sa.target2026.length ||
    nextActual.length   !== sa.actual2026.length ||
    nextPriorTgt.length !== (sa.target2025?.length ?? 0) ||
    nextPrior.length    !== sa.actual2025.length ||
    nextNi26.length     !== sa.netIncome2026.length ||
    nextNi25.length     !== sa.netIncome2025.length;
  return {
    value: {
      target2026: nextTarget,
      actual2026: nextActual,
      target2025: nextPriorTgt,
      actual2025: nextPrior,
      netIncome2026: nextNi26,
      netIncome2025: nextNi25,
      kpi: sa.kpi,
    },
    changed,
  };
}

function healProducts(sq: SalesByQuantity | null): { value: SalesByQuantity | null; changed: boolean } {
  if (!sq) return { value: null, changed: false };
  const byProduct = new Map(sq.rows.map(r => [r.product, r]));
  let changed = false;
  const merged = CANONICAL_PRODUCTS.map(p => {
    const existing = byProduct.get(p);
    if (existing) return existing;
    changed = true;
    return { product: p, qty2026: 0, qty2025: 0 };
  });
  // Preserve any extra custom products the user typed in manually.
  for (const r of sq.rows) {
    if (!CANONICAL_PRODUCTS.includes(r.product as typeof CANONICAL_PRODUCTS[number])) {
      merged.push(r);
    }
  }
  return { value: { rows: merged, commentary: sq.commentary ?? "" }, changed };
}

function recomputeEcpPct(curr: SalesByECP | null): { value: SalesByECP | null; changed: boolean } {
  if (!curr) return { value: null, changed: false };
  const total = curr.rows.reduce((s, r) => s + (r.salesMyr || 0), 0);
  const nextRows = curr.rows.map(r => ({
    ...r,
    pct: total ? r.salesMyr / total : 0,
  }));
  const changed = nextRows.some((r, i) => Math.abs(r.pct - curr.rows[i].pct) > 1e-6);
  return { value: { rows: nextRows, commentary: curr.commentary ?? "" }, changed };
}

function recomputeInventoryTotals(curr: Inventory | null): { value: Inventory | null; changed: boolean } {
  if (!curr) return { value: null, changed: false };
  let tw = 0, tc = 0, anyW = false, anyC = false;
  for (const g of curr.groups) {
    for (const row of g.rows) {
      if (row.warehouse != null) { tw += row.warehouse; anyW = true; }
      if (row.consignment != null) { tc += row.consignment; anyC = true; }
    }
  }
  const nextW = anyW ? tw : null;
  const nextC = anyC ? tc : null;
  const changed = nextW !== curr.totalWarehouse || nextC !== curr.totalConsignment;
  return {
    value: { ...curr, totalWarehouse: nextW, totalConsignment: nextC },
    changed,
  };
}

// mergeSalesAchievementChain lives in src/lib/sales-achievement-chain.ts —
// same helper is used at read time by getMonthReport so the editor / preview
// / PPT export all render the current chain without a manual Recalculate
// click. The repair route keeps calling it explicitly to persist the merged
// chain back to the DB (so future raw reads and imports see the healed data).

// Carry forward prior-month SHAPE data — registration rows, inventory groups,
// financial row labels — when the current month has none. Per-slot fill of
// salesAchievement now lives in mergeSalesAchievementChain above; this
// function only handles the all-or-nothing structural cases.
function carryForwardSections(curr: MonthReport, prior: MonthReport | undefined): {
  next: Partial<MonthReport>;
  notes: string[];
} {
  const next: Partial<MonthReport> = {};
  const notes: string[] = [];
  if (!prior) return { next, notes };

  if (!curr.productRegistration && prior.productRegistration) {
    next.productRegistration = {
      rows: prior.productRegistration.rows.map(r => ({ ...r })),
      commentary: prior.productRegistration.commentary ?? "",
    };
    notes.push("carried forward: product registration rows");
  }

  if (!curr.inventory && prior.inventory) {
    next.inventory = {
      groups: prior.inventory.groups.map(g => ({
        name: g.name,
        rows: g.rows.map(r => ({ product: r.product, warehouse: null, consignment: null })),
      })),
      totalWarehouse: null,
      totalConsignment: null,
      commentary: "",
    };
    notes.push("carried forward: inventory group shape (values cleared)");
  }

  if (!curr.financial) {
    next.financial = {
      arMyr: 0,
      arLongTermMyr: 0,
      apMyr: 0,
      cashFlowMyr: 0,
      collectionMyr: 0,
    };
    notes.push("carried forward: financial row labels");
  }

  return { next, notes };
}

function recomputeRegion(curr: SalesByRegion | null, prev: MonthReport | undefined): { value: SalesByRegion | null; changed: boolean } {
  if (!curr) return { value: null, changed: false };
  const priorByRegion = new Map((prev?.salesByRegion?.rows ?? []).map(r => [r.region, r.salesThis]));
  const next: SalesByRegion = {
    rows: REGIONS.map(region => {
      const existing = curr.rows.find(r => r.region === region) ?? { region, salesThis: 0, salesPrev: 0, growthPct: 0 };
      const salesPrev = priorByRegion.get(region) ?? 0;
      const growth = salesPrev ? (existing.salesThis - salesPrev) / salesPrev : 0;
      return { region, salesThis: existing.salesThis, salesPrev, growthPct: growth };
    }),
    commentary: curr.commentary ?? "",
  };
  const changed = JSON.stringify(next.rows) !== JSON.stringify(curr.rows);
  return { value: next, changed };
}

/**
 * De-duplicate the RawFile audit log. Within each month we keep only the
 * most-recent upload of each distinct filename; older copies — and any file
 * we never recognised (kind "unknown") — are soft-deleted into the Files
 * page "Recently deleted" bin. The latest upload always wins (the query is
 * ordered newest-first, so the first time we see a name it's the keeper).
 *
 * Soft-delete only — nothing is purged, so the user can restore from trash.
 */
async function dedupeRawFiles(): Promise<{ trashed: number; details: string[] }> {
  const active = await prisma.rawFile.findMany({
    where: { deletedAt: null },
    select: { id: true, monthReportId: true, originalName: true, kind: true, createdAt: true },
    orderBy: { createdAt: "desc" }, // newest first → first occurrence is the keeper
  });

  const seen = new Set<string>();
  const toTrash: string[] = [];
  const details: string[] = [];

  for (const f of active) {
    // Unrecognised files fed no slide — treat as unused and remove.
    if (f.kind === "unknown") {
      toTrash.push(f.id);
      details.push(`unused (unrecognised): ${f.originalName}`);
      continue;
    }
    const key = `${f.monthReportId}::${f.originalName.trim().toLowerCase()}`;
    if (seen.has(key)) {
      toTrash.push(f.id); // an older copy of a filename we've already kept
      details.push(`duplicate: ${f.originalName}`);
    } else {
      seen.add(key);
    }
  }

  if (toTrash.length) {
    await prisma.rawFile.updateMany({
      where: { id: { in: toTrash } },
      data: { deletedAt: new Date() },
    });
  }
  return { trashed: toTrash.length, details };
}

export async function POST() {
  const denied = await guardDept();
  if (denied) return denied;

  // Step 0 — clean the file audit log: move duplicate / unused uploads to the
  // trash so the rest of the recalculation works from the latest files only.
  const dedup = await dedupeRawFiles();

  // Explicit "raw" — the repair pass must see the un-merged stored state so
  // its own mergeSalesAchievementChain call decides what to persist.
  const all = await listMonthReports("raw");
  // Chronological order so each month can look at the *healed* prior month.
  const ordered = [...all].sort((a, b) => a.year - b.year || a.month - b.month);
  const results: RepairReport[] = [];
  let priorHealed: MonthReport | undefined;

  // Load every Sales Summary workbook ever uploaded (kind "ref_2025" — the
  // tag is historical; the file may be prior- or current-year). We re-parse
  // each so the apply step below can re-sync target2026 / actual2025 /
  // qty2025 from whichever workbooks are on file. If two refs exist for the
  // same year, the most-recent one (sorted last) wins.
  const summaryRefs: Year2025Reference[] = [];
  const summaryRefDiagnostics: Array<Record<string, unknown>> = [];
  try {
    const refRows = await prisma.rawFile.findMany({
      where: { kind: "ref_2025", deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { bytes: true, originalName: true },
    });
    for (const r of refRows) {
      if (!r.bytes) continue;
      try {
        const parsed = parse2025Summary(new Uint8Array(r.bytes));
        summaryRefs.push(parsed);
        summaryRefDiagnostics.push({
          file: r.originalName,
          year: parsed.year,
          pegavisionQty: parsed.productQty["MonthlyColour UV - Pegavision"] ?? null,
          blueQty:       parsed.productQty["MonthlyColour UV - Blue"] ?? null,
          orangeQty:     parsed.productQty["MonthlyColour UV - Orange"] ?? null,
          bocQty:        parsed.productQty["Breath O Correct"] ?? null,
        });
      } catch (e) {
        console.error(`[repair] failed to parse "${r.originalName}":`, e);
        summaryRefDiagnostics.push({ file: r.originalName, error: e instanceof Error ? e.message : String(e) });
      }
    }
  } catch (e) {
    console.error("[repair] failed to load Sales Summary references:", e);
  }

  // Pull the LIVE HQ Summary grid from salesdashboard (sibling app) for every
  // year represented in the month list. Treated as an extra current-year ref
  // appended to summaryRefs — because it has monthlyTarget/Sales/Qty = null,
  // applyYear2025ToReport will only hit the applyHqCustomerSplitRows branch
  // (overrides MCUV / BoC rows); it will NOT touch target2026 or 2025 columns.
  // Appended LAST so it wins over the stale on-file workbook when both are
  // present for the same year.
  const yearsSeen = new Set(all.map(m => m.year));
  for (const year of yearsSeen) {
    try {
      const live = await fetchHqSummaryFromSalesDashboard(year);
      if (live) {
        summaryRefs.push(live.ref);
        summaryRefDiagnostics.push({
          source: "salesdashboard-api",
          year,
          generatedAt: live.generatedAt,
          sourceFiles: live.sources.map(s => s.name),
          pegavisionQty: live.ref.productQty["MonthlyColour UV - Pegavision"] ?? null,
          blueQty:       live.ref.productQty["MonthlyColour UV - Blue"] ?? null,
          orangeQty:     live.ref.productQty["MonthlyColour UV - Orange"] ?? null,
          bocQty:        live.ref.productQty["Breath O Correct"] ?? null,
        });
      }
    } catch (e) {
      console.error(`[repair] salesdashboard fetch for ${year} failed:`, e);
    }
  }

  for (const m of ordered) {
    const notes: string[] = [];
    let changed = false;

    // Step 0a — pull Slide 1 Sales Achievement values forward from the
    // prior month, slot by slot. This is what makes April's row show
    // Jan/Feb/Mar actuals after those months have been imported earlier
    // in the chain.
    const monthIdx = m.month - 1;
    const chain = mergeSalesAchievementChain(
      m.salesAchievement,
      priorHealed?.salesAchievement,
      monthIdx,
    );
    let filled: MonthReport = m;
    if (chain.changed) {
      filled = { ...filled, salesAchievement: chain.value };
      notes.push("sales-achievement: re-synced month chain from prior month (authoritative past-month figures)");
      changed = true;
    }

    // Step 0b — carry-forward structural shapes (product registration,
    // inventory groups, financial row labels) when missing.
    const carry = carryForwardSections(filled, priorHealed);
    filled = { ...filled, ...carry.next };
    if (carry.notes.length) {
      notes.push(...carry.notes);
      changed = true;
    }

    // Step 0b.5 — RE-PARSE stored master + MCUV files for this month and
    // rebuild salesByQuantity + topProducts from scratch using the CURRENT
    // catalog. This is what makes Repair idempotent against SKU-map changes:
    // whenever we add a new MCUV shade code, DISOP divisor, or Wohlk variant,
    // one click of Repair re-processes every month's stored master through
    // the new rules — without the owner having to re-upload each file.
    try {
      const rawFiles = await prisma.rawFile.findMany({
        where: { monthReportId: m.id, deletedAt: null, kind: { in: ["pos_master", "pos_mcuv"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true, kind: true, originalName: true, bytes: true },
      });
      // Keep only the most-recent master and ALL mcuv files (one per colour).
      const latestMaster = rawFiles.find(r => r.kind === "pos_master" && r.bytes);
      const mcuvFiles = rawFiles.filter(r => r.kind === "pos_mcuv" && r.bytes);
      if (latestMaster?.bytes) {
        let master: PosMasterParseResult | null = null;
        try {
          const buf = new Uint8Array(latestMaster.bytes).buffer as ArrayBuffer;
          const name = latestMaster.originalName.toLowerCase();
          if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
            master = parseMasterXlsx(buf);
          } else if (name.endsWith(".pdf")) {
            const parsed = await parsePosPdf(new Uint8Array(latestMaster.bytes), latestMaster.originalName);
            if (parsed.kind === "master") master = parsed;
          }
        } catch (e) {
          notes.push(`Could not re-parse stored master "${latestMaster.originalName}": ${e instanceof Error ? e.message : "unknown error"}`);
        }
        const mcuv: PosMcuvParseResult[] = [];
        for (const f of mcuvFiles) {
          if (!f.bytes) continue;
          try {
            const parsed = await parsePosPdf(new Uint8Array(f.bytes), f.originalName);
            if (parsed.kind === "mcuv") mcuv.push(parsed);
          } catch { /* ignore per-file parse errors */ }
        }
        if (master) {
          const prior = await getMonthReport(m.year - 1, m.month);
          const priorQty = priorYearQtyLookup(prior?.salesByQuantity ?? null);
          const newSq = computeSalesByQuantity(master, mcuv, priorQty);
          const newTp = computeTopProducts(master, mcuv);
          // Preserve any manual commentary the user typed on the slide —
          // only the rows get rebuilt from the stored master.
          const priorSqCommentary = filled.salesByQuantity?.commentary ?? "";
          const priorTpCommentary = filled.topProducts?.commentary ?? "";
          const sqOld = JSON.stringify(filled.salesByQuantity?.rows ?? []);
          const sqNew = JSON.stringify(newSq.rows);
          const tpOld = JSON.stringify(filled.topProducts?.rows ?? []);
          const tpNew = JSON.stringify(newTp.rows);
          if (sqOld !== sqNew || tpOld !== tpNew) {
            filled = {
              ...filled,
              salesByQuantity: { ...newSq, commentary: priorSqCommentary },
              topProducts: { ...newTp, commentary: priorTpCommentary },
            };
            notes.push(`Rebuilt Slide 5 + Slide 6 from stored master "${latestMaster.originalName}" (${mcuv.length} MCUV colour PDF(s))`);
            changed = true;
          }
        }
      }
    } catch (e) {
      notes.push(`Re-parse step failed: ${e instanceof Error ? e.message : "unknown error"}`);
    }

    // Step 0c — apply every Sales Summary reference on file. Each ref's year
    // determines what it writes (prior-year file fills actual2025 + qty2025;
    // current-year file fills target2026). Runs after the chain merge so the
    // authoritative reference figures win over carried-forward guesses.
    for (const ref of summaryRefs) {
      const r = applyYear2025ToReport(filled, ref);
      if (r.changed) {
        filled = r.next;
        notes.push(ref.year === m.year
          ? `Slide 1 target${m.year} filled from ${ref.year} Sales Summary`
          : "2025 comparison columns filled from Sales Summary reference");
        changed = true;
      }
      if (r.corrections?.length) {
        for (const line of r.corrections) notes.push(line);
      }
    }

    const sa = healSalesAchievement(filled.salesAchievement);
    if (sa.changed) { notes.push("sales-achievement arrays padded to 12 months"); changed = true; }

    const sq = healProducts(filled.salesByQuantity);
    if (sq.changed) { notes.push("sales-quantity product list re-aligned to catalogue"); changed = true; }

    const region = recomputeRegion(filled.salesByRegion, priorHealed);
    if (region.changed) { notes.push("region growth% relinked to prior month"); changed = true; }

    const ecp = recomputeEcpPct(filled.salesByECP);
    if (ecp.changed) { notes.push("ECP category % recomputed from salesMyr"); changed = true; }

    const inv = recomputeInventoryTotals(filled.inventory);
    if (inv.changed) { notes.push("inventory totals recomputed from rows"); changed = true; }

    let healed: MonthReport = {
      ...filled,
      salesAchievement: sa.value ?? filled.salesAchievement,
      salesByQuantity: sq.value ?? filled.salesByQuantity,
      salesByRegion: region.value ?? filled.salesByRegion,
      salesByECP: ecp.value ?? filled.salesByECP,
      inventory: inv.value ?? filled.inventory,
    };

    // Auto-fix drift — snap any Slide 5 qty / Slide 6 MYR row that drifts
    // from the own-year Summary workbook back to the Summary value. Every
    // correction is logged in notes so the owner knows what moved.
    //
    // Prefer the LAST same-year ref — refs are appended in order (older
    // workbooks first, salesdashboard-live API last), so findLast picks the
    // most authoritative source. This avoids auto-fix snapping values back
    // to a stale workbook when the live API disagrees.
    const sameYearRef = summaryRefs.findLast(ref => ref.year === m.year);
    if (sameYearRef) {
      const fixed = autoFixDriftFromSummary(healed, sameYearRef);
      if (fixed.changed) {
        healed = fixed.next;
        changed = true;
      }
      for (const line of fixed.corrections) notes.push(line);
    }

    if (changed) {
      await upsertMonthReport(healed);
    }

    results.push({ id: m.id, changed, notes });
    priorHealed = healed;
  }

  // Bust caches for every page that renders month data so the user sees
  // the freshly-merged Sales Achievement rows the instant they navigate.
  if (results.some(r => r.changed) || dedup.trashed > 0) {
    revalidatePath("/");
    revalidatePath("/files");
    revalidatePath("/export");
    for (const r of results.filter(x => x.changed)) {
      revalidatePath(`/report/${r.id}`);
    }
  }

  return NextResponse.json({
    ok: true,
    monthsChecked: results.length,
    monthsChanged: results.filter(r => r.changed).length,
    filesDeduped: dedup.trashed,
    dedupDetails: dedup.details,
    summaryRefs: summaryRefDiagnostics,
    results,
  });
}
