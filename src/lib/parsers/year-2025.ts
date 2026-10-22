// Parser for the full-year "SEED(M) Sales Summary" workbook — the canonical
// source of PRIOR-YEAR (2025) comparison figures.
//
// The workbook has two stacked tables on its "monthly sales" sheet:
//   • SALES QUANTITY  — per-product units, Jan…Dec, then a "Total" row
//   • SALES AMOUNT    — per-product MYR, Jan…Dec, then a total + "Msia Sales"
//
// The dashboard consumes two things from it:
//   • monthlySales[12] — Slide 1 "Sales Result 2025" row (same for every month)
//   • productQty       — Slide 5 qty2025 (each month reads its own column)
//
// Uploading this file (kind "ref_2025") makes EVERY month's 2025 comparison
// columns fill automatically — see applyYear2025ToReport + the import/repair
// wiring.

import * as XLSX from "xlsx";
import { type CanonicalProduct } from "@/lib/catalog/products";
import type { MonthReport } from "@/lib/schema";

export type Year2025Reference = {
  /** The reporting year extracted from the workbook title (2025 or 2026). */
  year: number;
  /** 12 monthly net-sales totals (MYR) — the "Msia Sales" row. For a prior-
   *  year file this is Slide 1 "Sales Result 2025"; for a current-year file
   *  it's an info-only rollup (POS imports are the canonical actual2026). */
  monthlySales: (number | null)[];
  /** 12 monthly total unit counts. */
  monthlyQty: (number | null)[];
  /** 12 monthly HQ targets ("Jpn Sales Target" row). Used for Slide 1
   *  "Sales Target" when the file represents the CURRENT year. */
  monthlyTarget: (number | null)[];
  /** Per-canonical-product 12-month unit series — Slide 5 qty2025 (only
   *  applied when the file is a prior-year reference). */
  productQty: Partial<Record<CanonicalProduct, (number | null)[]>>;
  /** Per-canonical-product 12-month MYR series — used to override Slide 6's
   *  Top Products MYR for HQ-owned rows (same list as productQty). */
  productAmount: Partial<Record<CanonicalProduct, (number | null)[]>>;
};

// The workbook's QUANTITY-section product labels → CanonicalProduct.
// Keys are pre-normalised (uppercase, single-spaced, trimmed) so the lookup
// is tolerant of the stray leading/trailing/double spaces in the source file.
const NAME_MAP: Record<string, CanonicalProduct> = {
  "1 DAY PURE": "1dayPureUP (32P)",
  "1 DAY PURE SILFA": "1dayPure Silfa",
  "1 DAY PURE ASTIGMATISM": "1dayPureUP Astig (32P)",
  "1 DAY MULSTISTAGE": "1dayPureUP Multistage (32P)",
  "1 DAYPURE EDOF": "1dayPureUP EDOF (32P)",
  "1 DAY VIEW SUPPORT": "1 Day View Support",
  "2 WEEK PURE MULTISTAGE": "2weekPure Multistage (6P)",
  "2 WEEK PURE UP TORIC": "2weekPure Up Toric",
  "2 WEEK PURE UP": "2weekPure Up (6P)",
  "EYE COFFRET-M": "Eye coffret-M",
  "EYE COFFRET-M 10 TORIC": "Eye Coffret-M 10 Toric",
  "EYE COFFRET-M 30 TORIC": "Eye Coffret-M 30 Toric",
  "MONTHLY FINE PLUS": "MonthlyFine Plus (3P)",
  "MONTHLY PURE3": "Monthly Pure 3",
  "MONTHLY PURE6": "Monthly Pure 6",
  "MONTHLY COLOR UV - PEGAVISION": "MonthlyColour UV - Pegavision",
  "MONTHLY COLOR UV - BLUE": "MonthlyColour UV - Blue",
  "MONTHLY COLOR UV - ORANGE": "MonthlyColour UV - Orange",
  "MONTHLY COLOR UV II": "MonthlyColour UV II",
  "MINASOFT 1DAY COLOR UV": "Minasoft 1Day Color UV",
  "MINASOFT CARE UV": "Minasoft Care UV",
  "RGP UV-1 / UV-1 KC": "UV-1 / UV-1 KC",
  "RGP AS-LUNA/O2 NOAH": "As-Luna / O2 Noah",
  "IRIS LENS": "Iris Lens",
  "ULTRA VISION": "Ultra Vision",
  "BREATH O CORRECT": "Breath O Correct",
  "BREATH O CORRECT (OVERSEAS)": "Breath O Correct (Overseas)",
  "WOHLK KE RGP": "Wohlk KE RGP",
  "DISOP H2O2 SOLUTION": "DISOP H2O2 Solution",
  "DISOP ULTRA EYEDROP": "DISOP Ultra Eyedrop",
  "DISOP ACUAISS DUAL GEL EYEDROP": "DISOP Acuaiss Dual Gel Eyedrop",
  "ACCESSORIES/OTHERS": "Accessories / Others",
  // The Sales Amount block has a slightly different label than the qty block
  // — accept both so the ref sync doesn't quietly skip Multistage.
  "1 DAY PURE MULSTISTAGE": "1dayPureUP Multistage (32P)",
};

function norm(s: string): string {
  return s.toUpperCase().replace(/\s+/g, " ").trim();
}

/** True when a filename looks like the yearly "Sales Summary" workbook. */
export function is2025SummaryFile(filename: string): boolean {
  return /sales\s*summary/i.test(filename) && /\.xlsx?$/i.test(filename);
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export function parse2025Summary(buf: ArrayBuffer | Uint8Array): Year2025Reference {
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sheetName = wb.SheetNames.find(n => /sales/i.test(n)) ?? wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1, defval: null, raw: true,
  });

  const monthlyQty: (number | null)[] = Array(12).fill(null);
  const monthlySales: (number | null)[] = Array(12).fill(null);
  const monthlyTarget: (number | null)[] = Array(12).fill(null);
  const productQty: Year2025Reference["productQty"] = {};
  const productAmount: Year2025Reference["productAmount"] = {};

  // ----- Detect the year from the title row -----
  // The file's title looks like:
  //   "SEED MALAYSIA JAN - JAN ~DEC 2025 SALES REPORT" — the prior-year
  //   reference (Dec_2025) carries 2025 actuals.
  //   "SEED MALAYSIA JAN - JAN ~DEC 2026 SALES REPORT" — the current-year
  //   reference (Jan_2026 etc.) carries 2026 targets.
  // Default to 2025 so old callers behave identically when the title is
  // missing or unparseable.
  let detectedYear = 2025;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    for (const cell of rows[i]) {
      if (typeof cell !== "string") continue;
      const m = cell.match(/(20\d{2})\s+SALES\s+REPORT/i);
      if (m) { detectedYear = Number(m[1]); break; }
    }
  }

  // The two tables are layered on one sheet — track which one we're inside.
  let section: "none" | "qty" | "amount" = "none";
  for (const row of rows) {
    const first = typeof row[0] === "string" ? row[0].trim() : "";
    const joined = row.map(c => (typeof c === "string" ? c.toUpperCase() : "")).join(" ");

    if (/SALES\s*QUANTITY/.test(joined)) { section = "qty"; continue; }
    if (/SALES\s*AMOUNT/.test(joined))   { section = "amount"; continue; }
    if (section === "none") continue;
    if (/^PRODUCT/i.test(first)) continue; // column-header row

    // Months always sit in columns B…M (index 1…12).
    const monthly = Array.from({ length: 12 }, (_, i) => toNum(row[i + 1]));

    if (/^TOTAL$/i.test(first)) {
      if (section === "qty") for (let i = 0; i < 12; i++) monthlyQty[i] = monthly[i];
      continue;
    }
    // "Jpn Sales Target" — the monthly HQ target row. Present in both year
    // versions of the file; we use it for Slide 1's Sales Target row when
    // the file represents the current year.
    if (/^JPN\s*SALES\s*TARGET$/i.test(first)) {
      for (let i = 0; i < 12; i++) monthlyTarget[i] = monthly[i];
      continue;
    }
    // "Msia Sales" is the explicit monthly net-sales row in the AMOUNT block.
    if (/^MSIA\s*SALES$/i.test(first)) {
      for (let i = 0; i < 12; i++) monthlySales[i] = monthly[i];
      continue;
    }
    // The AMOUNT block also has an *unlabelled* grand-total row above
    // "Msia Sales" — take it as a fallback if we haven't seen Msia Sales yet.
    // (monthlySalesEmpty is computed into its own const so TS 5.5's inferred
    // type-predicates don't narrow monthlySales to null[] inside the block.)
    const monthlySalesEmpty = !monthlySales.some(v => v != null);
    const monthlyHasValue = monthly.some(v => v != null);
    if (!first && section === "amount" && monthlyHasValue && monthlySalesEmpty) {
      for (let i = 0; i < 12; i++) monthlySales[i] = monthly[i];
      continue;
    }
    if (!first) continue;

    // Per-product QUANTITY row.
    if (section === "qty") {
      const canonical = NAME_MAP[norm(first)];
      if (canonical) productQty[canonical] = monthly;
    }
    // Per-product MYR row (same product labels as the QUANTITY block, just
    // with the MYR amounts rather than units).
    if (section === "amount") {
      const canonical = NAME_MAP[norm(first)];
      if (canonical) productAmount[canonical] = monthly;
    }
  }

  return { year: detectedYear, monthlySales, monthlyQty, monthlyTarget, productQty, productAmount };
}

/**
 * Apply a Sales Summary reference workbook to a month report. The behaviour
 * branches on whether the file represents the report's CURRENT year (2026)
 * or PRIOR year (2025):
 *
 *   • PRIOR year (e.g. Dec_2025 file feeding a 2026 report):
 *       — salesAchievement.actual2025 = the 12-month "Msia Sales" series
 *         (the deck shows all 12 months, so every report carries the same
 *         array). If the month has no salesAchievement yet we synthesize
 *         a minimal one so the 2025 row is still visible.
 *       — salesByQuantity row qty2025 = each product's units in the SAME
 *         calendar month of 2025. Only existing rows are touched; we don't
 *         fabricate the slide before a 2026 POS import has built it.
 *
 *   • CURRENT year (e.g. Jan_2026 file feeding a 2026 report):
 *       — salesAchievement.target2026 = the 12-month "Jpn Sales Target"
 *         series. This is the user's primary use case — supply a target
 *         workbook once and every month's Slide 1 carries the HQ targets.
 *       — actual2026 is NOT touched: POS master imports are the canonical
 *         source for current-year actuals (they apply Sales adj etc.).
 *
 *   • Anything else (year doesn't relate to the report) is a no-op.
 *
 * Returns { changed } so callers can skip a no-op DB write.
 */
/**
 * Slide 5 qty2026 override for HQ-authoritative rows. Some Slide 5 rows
 * cannot be computed correctly from the POS master alone — either because
 * they are split by CUSTOMER (not visible to the SKU-level export) or
 * because the master export uses an AGGREGATED code that collapses several
 * canonical rows into one — so HQ's Sales Summary workbook is the source
 * of truth for these lines. Only listed rows are overridden; every other
 * qty2026 stays master-derived.
 *
 * Current members:
 *   • Breath O Correct              — non-GLODISA customers (customer split;
 *     see memory/boc-overseas-glodisa.md)
 *   • Breath O Correct (Overseas)   — GLODISA (Indonesia)
 *   • MonthlyColour UV - Pegavision — colour-box split; the group-level
 *     master export (e.g. Sep 2026) emits one aggregated `MCUV` row which
 *     the SKU_MAP catch-all funnels into Pegavision, zeroing Blue/Orange.
 *     The SKU-level export (e.g. Aug 2026) splits correctly by shade;
 *     either way the Summary workbook's per-colour rows match reality.
 *   • MonthlyColour UV - Blue       — same reason
 *   • MonthlyColour UV - Orange     — same reason
 *
 * NOT included: Wohlk KE RGP. HQ's Summary workbook has only one Wohlk row
 * ("Wohlk KE RGP") that absorbs every Wohlk product's sales, while the
 * dashboard splits Wohlk into three canonical rows (Sph / Toric / KE RGP).
 * Overriding "Wohlk KE RGP" from the Summary double-counts whatever the
 * master already attributed to Sph / Toric. Leaving it master-driven keeps
 * the three Wohlk lines coherent; the master's qty2026 and the Summary's
 * total agree row-by-row (e.g. Aug 2026: master WHCLS 7 → Sph 7, Summary
 * "Wohlk KE RGP" 7 — same 7 units, just under a different HQ label).
 *
 * MonthlyColour UV II is also NOT included: `MCUV2` is always its own group
 * code in the master and the SKU-level MCDB/MCDY shades roll into it
 * cleanly, so master and Summary already agree.
 *
 * Callable independently so that after a master-only re-import (which
 * rebuilds salesByQuantity from scratch), the import route's summary
 * fallback can re-apply just these rows from the newest stored summary
 * without touching target2026 (which would trample any manual target edit).
 */
export function applyHqCustomerSplitRows(
  report: MonthReport,
  ref: Year2025Reference,
): { changed: boolean; next: MonthReport; corrections: string[] } {
  const HQ_OWNED_ROWS: CanonicalProduct[] = [
    "Breath O Correct",
    "Breath O Correct (Overseas)",
    "MonthlyColour UV - Pegavision",
    "MonthlyColour UV - Blue",
    "MonthlyColour UV - Orange",
  ];
  const monthIdx = report.month - 1;
  const sq = report.salesByQuantity;
  const tp = report.topProducts;
  let changed = false;
  const corrections: string[] = [];

  // ----- Slide 5 qty override -----
  // Self-healing: if the saved sq.rows doesn't include a HQ-owned product row
  // (common when the sales-by-quantity section was first saved before the row
  // existed in CANONICAL_PRODUCTS, or when a POS master import skipped a
  // zero-sum row), we ADD the row before overriding. Without this patch
  // Repair would silently no-op the override for the missing rows and the
  // Summary-driven split would never land.
  let nextSq = sq;
  if (sq) {
    const existingProducts = new Set(sq.rows.map(r => r.product));
    const missingHqRows: { product: string; qty2026: number; qty2025: number }[] = [];
    for (const p of HQ_OWNED_ROWS) {
      if (!existingProducts.has(p)) missingHqRows.push({ product: p, qty2026: 0, qty2025: 0 });
    }
    const baseRows = missingHqRows.length ? [...sq.rows, ...missingHqRows] : sq.rows;

    let sqChanged = missingHqRows.length > 0;
    const nextRows = baseRows.map(r => {
      if (!HQ_OWNED_ROWS.includes(r.product as CanonicalProduct)) return r;
      const series = ref.productQty[r.product as CanonicalProduct];
      if (!series) return r;
      const q = series[monthIdx] ?? 0;
      if (q !== r.qty2026) {
        sqChanged = true;
        corrections.push(`HQ Summary override — ${r.product}: qty ${r.qty2026.toLocaleString()}→${q.toLocaleString()}`);
      }
      return { ...r, qty2026: q };
    });
    if (sqChanged) { nextSq = { ...sq, rows: nextRows }; changed = true; }
  }

  // ----- Slide 6 MYR override: rebuild the HQ_OWNED_ROWS entries from the
  // Summary's AMOUNT section, drop any already-ranked copy of them that was
  // computed from the master, then recompute pct from the new total. This
  // fixes the group-level MCUV case where every colour's MYR landed on
  // Pegavision because the master emits one aggregated `MCUV` row.
  let nextTp = tp;
  if (tp && tp.rows.length) {
    const overrides: { product: CanonicalProduct; myr: number }[] = [];
    for (const p of HQ_OWNED_ROWS) {
      const series = ref.productAmount[p];
      if (!series) continue;
      const v = series[monthIdx];
      if (v == null) continue; // skip null — don't zero out master value
      overrides.push({ product: p, myr: v });
    }
    if (overrides.length) {
      const overrideNames = new Set(overrides.map(o => o.product));
      const retained = tp.rows.filter(r => !overrideNames.has(r.product as CanonicalProduct));
      const merged = [
        ...retained,
        ...overrides.filter(o => o.myr > 0).map(o => ({ product: o.product, myr: o.myr, pct: 0 })),
      ];
      const sameAsBefore =
        merged.length === tp.rows.length &&
        merged.every(r => {
          const prior = tp.rows.find(p => p.product === r.product);
          return prior && Math.abs(prior.myr - r.myr) < 0.005;
        });
      if (!sameAsBefore) {
        const totalMyr = merged.reduce((s, r) => s + r.myr, 0);
        const withPct = merged
          .map(r => ({ ...r, pct: totalMyr ? r.myr / totalMyr : 0 }))
          .sort((a, b) => b.myr - a.myr);
        nextTp = { rows: withPct, totalMyr, commentary: tp.commentary };
        changed = true;
        for (const o of overrides) {
          const prior = tp.rows.find(r => r.product === o.product);
          const priorMyr = prior?.myr ?? 0;
          if (Math.abs(priorMyr - o.myr) > 0.5) {
            corrections.push(`HQ Summary override — ${o.product}: MYR ${priorMyr.toFixed(0)}→${o.myr.toFixed(0)}`);
          }
        }
      }
    }
  }

  if (!changed) return { changed: false, next: report, corrections };
  return {
    changed: true,
    next: {
      ...report,
      ...(nextSq !== sq ? { salesByQuantity: nextSq! } : {}),
      ...(nextTp !== tp ? { topProducts: nextTp! } : {}),
    },
    corrections,
  };
}

export function applyYear2025ToReport(
  report: MonthReport,
  ref: Year2025Reference,
): { changed: boolean; next: MonthReport; corrections?: string[] } {
  const monthIdx = report.month - 1;
  let changed = false;
  const next: MonthReport = { ...report };
  let corrections: string[] | undefined;

  // ----- CURRENT-year file (target workbook) -----
  if (ref.year === report.year) {
    const wantedTarget = [...ref.monthlyTarget];
    const hasAnyTarget = wantedTarget.some(v => v != null);
    const sa = report.salesAchievement;
    if (hasAnyTarget) {
      if (sa) {
        if (JSON.stringify(sa.target2026) !== JSON.stringify(wantedTarget)) {
          next.salesAchievement = { ...sa, target2026: wantedTarget };
          changed = true;
        }
      } else {
        next.salesAchievement = {
          target2026: wantedTarget,
          actual2026: Array(12).fill(null),
          target2025: Array(12).fill(null),
          actual2025: Array(12).fill(null),
          netIncome2026: Array(12).fill(null),
          netIncome2025: Array(12).fill(null),
          kpi: [],
        };
        changed = true;
      }
    }

    // Overlay the HQ customer-split qty2026 rows (BoC pair) from the summary.
    const boc = applyHqCustomerSplitRows(next, ref);
    if (boc.changed) { Object.assign(next, boc.next); changed = true; }
    if (boc.corrections.length) corrections = boc.corrections;
    return { changed, next, corrections };
  }

  // ----- PRIOR-year file (2025 reference) -----
  if (ref.year !== report.year - 1) {
    return { changed: false, next: report };
  }

  // The prior-year workbook carries BOTH:
  //  • Msia Sales row  → actual2025 (history actuals)
  //  • Jpn Sales Target → target2025 (history target — for ACC% comparison)
  // Both are filled together so the user gets the full 2025 picture from one
  // upload. They never touch target2026 or actual2026 — those are the
  // current-year file's job (and POS imports', respectively).
  const wantedActual = [...ref.monthlySales];
  const wantedTarget = [...ref.monthlyTarget];
  const sa = report.salesAchievement;
  if (sa) {
    const actualChanged = JSON.stringify(sa.actual2025) !== JSON.stringify(wantedActual);
    // target2025 may not exist on legacy SA objects (the schema field was
    // added later); default it to a 12-null array for the comparison.
    const existingTarget = (sa as { target2025?: (number | null)[] }).target2025
      ?? Array(12).fill(null);
    const targetChanged = JSON.stringify(existingTarget) !== JSON.stringify(wantedTarget);
    if (actualChanged || targetChanged) {
      next.salesAchievement = {
        ...sa,
        ...(actualChanged ? { actual2025: wantedActual } : {}),
        ...(targetChanged ? { target2025: wantedTarget } : {}),
      };
      changed = true;
    }
  } else {
    next.salesAchievement = {
      target2026: Array(12).fill(null),
      actual2026: Array(12).fill(null),
      target2025: wantedTarget,
      actual2025: wantedActual,
      netIncome2026: Array(12).fill(null),
      netIncome2025: Array(12).fill(null),
      kpi: [],
    };
    changed = true;
  }

  // ----- Slide 5: per-product qty2025 -----
  const sq = report.salesByQuantity;
  if (sq && sq.rows.length) {
    let rowsChanged = false;
    const nextRows = sq.rows.map(r => {
      const series = ref.productQty[r.product as CanonicalProduct];
      if (!series) return r; // product not in the 2025 file — leave as-is
      const q = series[monthIdx] ?? 0;
      if (q !== r.qty2025) rowsChanged = true;
      return { ...r, qty2025: q };
    });
    if (rowsChanged) {
      next.salesByQuantity = { ...sq, rows: nextRows };
      changed = true;
    }
  }

  return { changed, next };
}

// ----------------------------------------------------------------------------
// Drift verifier
//
// After the master-driven aggregation and the HQ-owned-row override have run,
// compare each Slide 5 qty and Slide 6 MYR against the Sales Summary workbook
// row-by-row. Any product the Summary has a value for and whose dashboard
// figure differs by more than a tolerance is flagged — this catches:
//
//   • New POS SKU codes that haven't been added to SKU_MAP / SKU_LEVEL_MAP
//     yet (e.g. MCGBT when the Gold Brown trial first appeared in Aug 2026).
//   • Group-level master exports lumping a family into one bucket
//     (e.g. aggregated MCUV → Pegavision) for a product not in HQ_OWNED_ROWS.
//   • Rename / renumber of an existing code so it stops matching.
//
// This is a SAFETY NET, not an override — the dashboard figures are not
// changed by this call. Callers surface the drifts as warnings so the owner
// knows a code or mapping needs attention. Returns an empty array when:
//   • ref is for a different year (prior-year or future-year)
//   • ref has no data for this month
//   • no rows drift beyond tolerance
// ----------------------------------------------------------------------------
export interface SummaryDrift {
  product: string;
  dashboardQty: number;
  summaryQty: number | null;
  dashboardMyr: number;
  summaryMyr: number | null;
  qtyDiff: number;
  myrDiff: number;
  likelyCause: string;
}

export function compareWithSummary(
  report: MonthReport,
  ref: Year2025Reference,
  opts: { qtyAbsTolerance?: number; qtyRelTolerance?: number; myrRelTolerance?: number } = {},
): SummaryDrift[] {
  if (ref.year !== report.year) return [];
  const monthIdx = report.month - 1;
  const qtyAbs = opts.qtyAbsTolerance ?? 5;   // ignore sub-5-unit differences
  const qtyRel = opts.qtyRelTolerance ?? 0.05; // ...OR sub-5% differences
  const myrRel = opts.myrRelTolerance ?? 0.02; // 2% MYR tolerance

  const myrByProduct = new Map(
    (report.topProducts?.rows ?? []).map(r => [r.product, r.myr]),
  );
  const drifts: SummaryDrift[] = [];
  for (const row of report.salesByQuantity?.rows ?? []) {
    const summaryQty = ref.productQty[row.product as CanonicalProduct]?.[monthIdx] ?? null;
    const summaryMyr = ref.productAmount[row.product as CanonicalProduct]?.[monthIdx] ?? null;
    const dashboardQty = row.qty2026;
    const dashboardMyr = myrByProduct.get(row.product) ?? 0;

    let qtyDrifted = false;
    if (summaryQty != null) {
      const diff = Math.abs(dashboardQty - summaryQty);
      const rel = summaryQty !== 0 ? diff / Math.abs(summaryQty) : (dashboardQty !== 0 ? 1 : 0);
      qtyDrifted = diff > qtyAbs && rel > qtyRel;
    }
    let myrDrifted = false;
    if (summaryMyr != null && summaryMyr > 0) {
      myrDrifted = Math.abs(dashboardMyr - summaryMyr) / summaryMyr > myrRel;
    }
    if (!qtyDrifted && !myrDrifted) continue;

    // Best-guess hint — the owner reads this in the warning.
    let likelyCause: string;
    if (summaryQty === 0 && dashboardQty > qtyAbs) {
      likelyCause = "dashboard has activity for a product HQ reports zero — likely a POS code mis-routed into this bucket";
    } else if (summaryQty != null && summaryQty > 0 && dashboardQty === 0) {
      likelyCause = "dashboard shows zero while HQ reports activity — likely an unmapped SKU code or group-level export missing from the catalog";
    } else {
      likelyCause = "dashboard and HQ disagree — check for new POS codes, trial-lens pack-size changes, or FOC/sample rows";
    }
    drifts.push({
      product: row.product,
      dashboardQty, summaryQty, dashboardMyr, summaryMyr,
      qtyDiff: summaryQty != null ? dashboardQty - summaryQty : 0,
      myrDiff: summaryMyr != null ? dashboardMyr - summaryMyr : 0,
      likelyCause,
    });
  }
  return drifts;
}

/** Format a drift list as human-readable warning strings for the UI. */
export function formatDriftWarnings(drifts: SummaryDrift[]): string[] {
  return drifts.map(d => {
    const parts: string[] = [];
    if (d.summaryQty != null) {
      parts.push(`qty ${d.dashboardQty.toLocaleString()} vs HQ ${d.summaryQty.toLocaleString()}`);
    }
    if (d.summaryMyr != null && d.summaryMyr > 0) {
      parts.push(`MYR ${d.dashboardMyr.toFixed(0)} vs HQ ${d.summaryMyr.toFixed(0)}`);
    }
    return `Slide 5/6 drift — ${d.product}: ${parts.join(", ")}. ${d.likelyCause}.`;
  });
}

// ----------------------------------------------------------------------------
// Auto-correct drifts from Summary
//
// For every product the Summary workbook has a value for, if the dashboard
// figure drifts beyond tolerance, replace it with the Summary value. This is
// the automatic companion to compareWithSummary: run compareWithSummary first
// to see what's wrong, then run autoFixDriftFromSummary to actually fix it.
// Returns the number of corrections applied and a human-readable note per
// correction, so the Repair UI can show exactly what changed.
//
// Products already handled by applyHqCustomerSplitRows (HQ_OWNED_ROWS) will
// typically be in agreement with Summary by the time autoFix runs, so they're
// no-ops here. autoFix is a safety net for all OTHER products — the moment
// a POS code change pushes any Slide 5/6 figure out of sync with HQ, this
// snaps it back. Does not touch rows where Summary is null for the month.
// ----------------------------------------------------------------------------
// Products the auto-fixer must NEVER touch, even when drift is detected.
// Reason to add a product here: HQ's Summary label aggregates sales that the
// dashboard already splits across SEPARATE canonical rows, so auto-correcting
// from Summary would double-count. These rows stay master-driven and the
// owner edits them manually if ever needed.
const AUTOFIX_SKIP: ReadonlySet<string> = new Set([
  // HQ writes every Wohlk sale (Sph / Toric / KE) under their single
  // "Wohlk KE RGP" Summary row, while the dashboard splits them into three
  // canonical lines. Auto-correcting Wohlk KE from Summary would add the
  // Sph/Toric qty on top of the master's Sph/Toric rows.
  "Wohlk KE RGP",
]);

export function autoFixDriftFromSummary(
  report: MonthReport,
  ref: Year2025Reference,
  opts: { qtyAbsTolerance?: number; qtyRelTolerance?: number; myrRelTolerance?: number } = {},
): { changed: boolean; next: MonthReport; corrections: string[] } {
  const allDrifts = compareWithSummary(report, ref, opts);
  const drifts = allDrifts.filter(d => !AUTOFIX_SKIP.has(d.product));
  if (!drifts.length) return { changed: false, next: report, corrections: [] };

  const monthIdx = report.month - 1;
  const corrections: string[] = [];
  let nextReport = report;

  // Patch Slide 5 (qty) wherever drift crossed tolerance and Summary had a value.
  const driftByProduct = new Map(drifts.map(d => [d.product, d]));
  const sq = report.salesByQuantity;
  if (sq && sq.rows.length) {
    let sqChanged = false;
    const nextRows = sq.rows.map(r => {
      const d = driftByProduct.get(r.product);
      if (!d || d.summaryQty == null) return r;
      const next = d.summaryQty;
      if (next === r.qty2026) return r;
      sqChanged = true;
      return { ...r, qty2026: next };
    });
    if (sqChanged) nextReport = { ...nextReport, salesByQuantity: { ...sq, rows: nextRows } };
  }

  // Patch Slide 6 (MYR) likewise; rebuild pct from the new total.
  const tp = report.topProducts;
  if (tp && tp.rows.length) {
    const myrOverrides = new Map(
      drifts.filter(d => d.summaryMyr != null).map(d => [d.product, d.summaryMyr as number]),
    );
    if (myrOverrides.size) {
      const overrideNames = new Set(myrOverrides.keys());
      const retained = tp.rows.filter(r => !overrideNames.has(r.product));
      const merged = [
        ...retained,
        ...[...myrOverrides.entries()]
          .filter(([, v]) => v > 0)
          .map(([product, myr]) => ({ product, myr, pct: 0 })),
      ];
      const sameAsBefore =
        merged.length === tp.rows.length &&
        merged.every(r => {
          const prior = tp.rows.find(p => p.product === r.product);
          return prior && Math.abs(prior.myr - r.myr) < 0.005;
        });
      if (!sameAsBefore) {
        const totalMyr = merged.reduce((s, r) => s + r.myr, 0);
        const withPct = merged
          .map(r => ({ ...r, pct: totalMyr ? r.myr / totalMyr : 0 }))
          .sort((a, b) => b.myr - a.myr);
        nextReport = { ...nextReport, topProducts: { rows: withPct, totalMyr, commentary: tp.commentary } };
      }
    }
  }

  for (const d of drifts) {
    const parts: string[] = [];
    if (d.summaryQty != null && d.summaryQty !== d.dashboardQty) {
      parts.push(`qty ${d.dashboardQty.toLocaleString()}→${d.summaryQty.toLocaleString()}`);
    }
    if (d.summaryMyr != null && Math.abs(d.summaryMyr - d.dashboardMyr) > 0.5) {
      parts.push(`MYR ${d.dashboardMyr.toFixed(0)}→${d.summaryMyr.toFixed(0)}`);
    }
    if (parts.length) corrections.push(`Auto-corrected from HQ Summary — ${d.product}: ${parts.join(", ")}`);
  }

  if (!corrections.length) return { changed: false, next: report, corrections: [] };
  void monthIdx; // reserved for future month-aware diagnostics
  return { changed: nextReport !== report, next: nextReport, corrections };
}
