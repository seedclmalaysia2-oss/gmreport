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
import { listMonthReports, upsertMonthReport } from "@/lib/month-report";
import { prisma } from "@/lib/db";
import { applyYear2025ToReport, parse2025Summary, type Year2025Reference } from "@/lib/parsers/year-2025";
import { CANONICAL_PRODUCTS } from "@/lib/catalog/products";
import type { MonthReport, SalesByQuantity, SalesByRegion, SalesAchievement, SalesByECP, Inventory } from "@/lib/schema";
import { REGIONS } from "@/lib/catalog/mappings";

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
  const nextTarget = ensure12(sa.target2026);
  const nextActual = ensure12(sa.actual2026);
  const nextPrior  = ensure12(sa.actual2025);
  const nextNi26   = ensure12(sa.netIncome2026);
  const nextNi25   = ensure12(sa.netIncome2025);
  const changed =
    nextTarget.length !== sa.target2026.length ||
    nextActual.length !== sa.actual2026.length ||
    nextPrior.length  !== sa.actual2025.length ||
    nextNi26.length   !== sa.netIncome2026.length ||
    nextNi25.length   !== sa.netIncome2025.length;
  return {
    value: {
      target2026: nextTarget,
      actual2026: nextActual,
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

/**
 * Per-slot chain merge for Slide 1 Sales Achievement.
 *
 * The previous all-or-nothing carry-forward only ran when the current
 * month's SA was completely empty — so once *any* slot was filled
 * (typically the current month's actual from a POS import), Jan/Feb/Mar
 * stayed null in April's row even though those months had been imported
 * and had values of their own.
 *
 * Rules:
 *   - Full-year fields (target2026, actual2025, netIncome2025): pull
 *     every null slot from the prior month's healed snapshot.
 *   - Accruing fields (actual2026, netIncome2026): pull every null slot
 *     up to and including the current month index. Future months stay
 *     null — they haven't been reported yet.
 *   - KPI commentary: copy from prior month only if the current month
 *     has no entries.
 *
 * Idempotent: running this on an already-merged month produces the same
 * output (changed = false).
 */
function mergeSalesAchievementChain(
  curr: SalesAchievement | null | undefined,
  prior: SalesAchievement | null | undefined,
  monthIdx: number,
): { value: SalesAchievement | null; changed: boolean } {
  if (!prior) return { value: curr ?? null, changed: false };

  // Materialise current — even if it's null, we synthesize an empty SA
  // so the prior-month values get a place to land.
  const cur: SalesAchievement = curr ?? {
    target2026: Array(12).fill(null),
    actual2026: Array(12).fill(null),
    actual2025: Array(12).fill(null),
    netIncome2026: Array(12).fill(null),
    netIncome2025: Array(12).fill(null),
    kpi: [],
  };

  // Full-year merge: take current's non-null, else prior's, else null.
  const mergeFull = (cu: (number | null)[], pr: (number | null)[]): (number | null)[] =>
    Array.from({ length: 12 }, (_, i) => (cu[i] != null ? cu[i] : (pr[i] ?? null)));

  // Accruing merge: only up to monthIdx (don't leak future-month forecasts).
  const mergeAccrual = (cu: (number | null)[], pr: (number | null)[]): (number | null)[] =>
    Array.from({ length: 12 }, (_, i) => {
      if (i > monthIdx) return cu[i] ?? null;
      return cu[i] != null ? cu[i] : (pr[i] ?? null);
    });

  const next: SalesAchievement = {
    target2026:    mergeFull   (cur.target2026,    prior.target2026),
    actual2026:    mergeAccrual(cur.actual2026,    prior.actual2026),
    actual2025:    mergeFull   (cur.actual2025,    prior.actual2025),
    netIncome2026: mergeAccrual(cur.netIncome2026, prior.netIncome2026),
    netIncome2025: mergeFull   (cur.netIncome2025, prior.netIncome2025),
    kpi: cur.kpi.length ? cur.kpi : (prior.kpi ?? []),
  };

  // Detect whether anything actually changed (idempotent re-runs report
  // changed=false so we don't spam database writes).
  const changed = JSON.stringify(next) !== JSON.stringify(cur);
  return { value: next, changed };
}

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
  // Step 0 — clean the file audit log: move duplicate / unused uploads to the
  // trash so the rest of the recalculation works from the latest files only.
  const dedup = await dedupeRawFiles();

  const all = await listMonthReports();
  // Chronological order so each month can look at the *healed* prior month.
  const ordered = [...all].sort((a, b) => a.year - b.year || a.month - b.month);
  const results: RepairReport[] = [];
  let priorHealed: MonthReport | undefined;

  // If a prior-year "Sales Summary" workbook was ever uploaded (kind
  // "ref_2025"), re-parse the most recent one so every month's 2025
  // comparison columns can be re-synced below. Re-parsing a sub-100 KB
  // xlsx is cheap; this keeps the reference authoritative without a
  // separate table.
  let year2025Ref: Year2025Reference | null = null;
  try {
    const refRow = await prisma.rawFile.findFirst({
      where: { kind: "ref_2025", deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { bytes: true },
    });
    if (refRow?.bytes) year2025Ref = parse2025Summary(new Uint8Array(refRow.bytes));
  } catch (e) {
    console.error("[repair] failed to load 2025 reference:", e);
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
      notes.push("sales-achievement: merged null slots from prior month chain");
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

    // Step 0c — fill prior-year (2025) comparison columns from the uploaded
    // "Sales Summary" reference, if one exists. Runs after the chain merge so
    // the authoritative reference figures win over carried-forward guesses.
    if (year2025Ref) {
      const y25 = applyYear2025ToReport(filled, year2025Ref);
      if (y25.changed) {
        filled = y25.next;
        notes.push("2025 comparison columns filled from Sales Summary reference");
        changed = true;
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

    const healed: MonthReport = {
      ...filled,
      salesAchievement: sa.value ?? filled.salesAchievement,
      salesByQuantity: sq.value ?? filled.salesByQuantity,
      salesByRegion: region.value ?? filled.salesByRegion,
      salesByECP: ecp.value ?? filled.salesByECP,
      inventory: inv.value ?? filled.inventory,
    };

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
    results,
  });
}
