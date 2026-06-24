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
  "DISOP H2O2 SOLUTION": "DISOP H2O2 Solution",
  "DISOP ULTRA EYEDROP": "DISOP Ultra Eyedrop",
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
  }

  return { year: detectedYear, monthlySales, monthlyQty, monthlyTarget, productQty };
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
export function applyYear2025ToReport(
  report: MonthReport,
  ref: Year2025Reference,
): { changed: boolean; next: MonthReport } {
  const monthIdx = report.month - 1;
  let changed = false;
  const next: MonthReport = { ...report };

  // ----- CURRENT-year file (target workbook) -----
  if (ref.year === report.year) {
    const wantedTarget = [...ref.monthlyTarget];
    const hasAnyTarget = wantedTarget.some(v => v != null);
    if (!hasAnyTarget) return { changed: false, next: report };

    const sa = report.salesAchievement;
    if (sa) {
      if (JSON.stringify(sa.target2026) !== JSON.stringify(wantedTarget)) {
        next.salesAchievement = { ...sa, target2026: wantedTarget };
        changed = true;
      }
    } else {
      next.salesAchievement = {
        target2026: wantedTarget,
        actual2026: Array(12).fill(null),
        actual2025: Array(12).fill(null),
        netIncome2026: Array(12).fill(null),
        netIncome2025: Array(12).fill(null),
        kpi: [],
      };
      changed = true;
    }
    return { changed, next };
  }

  // ----- PRIOR-year file (2025 reference) -----
  if (ref.year !== report.year - 1) {
    return { changed: false, next: report };
  }

  const wanted2025 = [...ref.monthlySales];
  const sa = report.salesAchievement;
  if (sa) {
    if (JSON.stringify(sa.actual2025) !== JSON.stringify(wanted2025)) {
      next.salesAchievement = { ...sa, actual2025: wanted2025 };
      changed = true;
    }
  } else {
    next.salesAchievement = {
      target2026: Array(12).fill(null),
      actual2026: Array(12).fill(null),
      actual2025: wanted2025,
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
