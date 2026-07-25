/**
 * Pure math helpers shared between the inline slide preview
 * (src/components/slide-preview.tsx) and the server PPTX generator
 * (src/lib/pptx/classic.ts + modern.ts).
 *
 * Why this file exists — PRODUCT.md Principle #1 ("Match the deck, not just
 * the data") says the editor, preview, and exported deck must show the same
 * numbers. Before this module, both paths independently reimplemented the
 * per-month sums and the weighted-ratio Totals for the ACC% / YoY% rows.
 * That was fine while both copies agreed; it was one keystroke away from
 * a boardroom-visible drift. Extracting the math to one place turns the
 * invariant from a prose promise into a machine-checked contract.
 *
 * The verification script `scripts/verify-slide-math.mjs` asserts these
 * functions against fixture inputs, so accidental regressions in the math
 * itself fail loud instead of silently changing the exported numbers.
 */

import type { SalesAchievement } from "./schema";

/** Sum of nullable numbers (nulls skipped). */
export function sumOfNullable(arr: (number | null)[]): number {
  return arr.reduce<number>((s, v) => s + (v ?? 0), 0);
}

/**
 * Per-month achievement or YoY ratio (numerator / denominator) with nulls
 * where either input is missing or the denominator is 0. Used by both
 * PPTX generators to render the "ACC %" and "YoY %" body rows.
 */
export function ratioPerMonth(
  numerator: (number | null)[],
  denominator: (number | null)[],
): (number | null)[] {
  return denominator.map((d, i) => {
    const n = numerator[i];
    if (!d || n == null) return null;
    return n / d;
  });
}

/**
 * Weighted-ratio Total for a percent row: sum-of-numerators ÷
 * sum-of-denominators. Returns null when the denominator sum is 0 —
 * printing "0%" would misrepresent an undefined ratio.
 */
export function weightedRatioTotal(
  numerator: (number | null)[],
  denominator: (number | null)[],
): number | null {
  const nSum = sumOfNullable(numerator);
  const dSum = sumOfNullable(denominator);
  return dSum ? nSum / dSum : null;
}

/**
 * A single row on the Sales Achievement table. Money rows use plain sums
 * for the Total column; percent rows use `totalOverride` (sumNumer /
 * sumDenom) so the Total reads as a weighted average, not a meaningless
 * sum-of-percentages.
 */
export type SalesAchievementRow = {
  label: string;
  values: (number | null)[]; // 12 months
  isPct: boolean;
  /** Present ONLY for percent rows; null when denominator sum is 0. */
  totalOverride: number | null;
};

/**
 * Build the 7-row Sales Achievement table body (Target/Result 2026, ACC%,
 * Result 2025, YoY%, Net Income 2026, Net Income 2025). Empty array when
 * SalesAchievement is missing.
 *
 * The order here is load-bearing — the exported PPTX prints rows in this
 * order and the preview alternates row background by index. Any reorder
 * must land in both callers via this function, not by editing each.
 */
export function salesAchievementRows(SA: SalesAchievement | null | undefined): SalesAchievementRow[] {
  if (!SA) return [];
  const totalTarget = sumOfNullable(SA.target2026);
  const totalActual = sumOfNullable(SA.actual2026);
  const totalPrior  = sumOfNullable(SA.actual2025);
  const accPerMonth = SA.target2026.map((t, i) =>
    t && SA.actual2026[i] != null ? SA.actual2026[i]! / t : null,
  );
  const yoyPerMonth = SA.actual2025.map((p, i) =>
    p && SA.actual2026[i] != null ? SA.actual2026[i]! / p : null,
  );
  return [
    { label: "Sales Target 2026", values: SA.target2026, isPct: false, totalOverride: null },
    { label: "Sales Result 2026", values: SA.actual2026, isPct: false, totalOverride: null },
    {
      label: "ACC %",
      values: accPerMonth,
      isPct: true,
      totalOverride: totalTarget ? totalActual / totalTarget : null,
    },
    { label: "Sales Result 2025", values: SA.actual2025, isPct: false, totalOverride: null },
    {
      label: "YoY %",
      values: yoyPerMonth,
      isPct: true,
      totalOverride: totalPrior ? totalActual / totalPrior : null,
    },
    { label: "Net Income 2026", values: SA.netIncome2026, isPct: false, totalOverride: null },
    { label: "Net Income 2025", values: SA.netIncome2025, isPct: false, totalOverride: null },
  ];
}

/**
 * Total for a Sales Achievement row: sum for money rows, weighted ratio
 * for percent rows. Returns null for percent rows with a zero denominator.
 */
export function totalForSalesAchievementRow(row: SalesAchievementRow): number | null {
  if (row.isPct) return row.totalOverride;
  return sumOfNullable(row.values);
}

/**
 * Single-month achievement + YoY rates, used by the KPI bullet list in
 * Slide 1 and by the Sales Achievement commentary in both the preview
 * and the exported deck.
 */
export function salesAchievementRates(
  SA: SalesAchievement | null | undefined,
  month: number,
): { accRate: number | null; yoyRate: number | null } {
  if (!SA) return { accRate: null, yoyRate: null };
  const i = month - 1;
  const accRate = SA.target2026[i] && SA.actual2026[i] != null ? SA.actual2026[i]! / SA.target2026[i]! : null;
  const yoyRate = SA.actual2025[i] && SA.actual2026[i] != null ? SA.actual2026[i]! / SA.actual2025[i]! : null;
  return { accRate, yoyRate };
}

/**
 * The Sales Trend chart clips Actual 2026 to the last month that has
 * data — otherwise the plotted line dives to zero for unfilled months.
 * Returns an array the same length as `actual2026` with nulls after the
 * last real value; returns all-nulls when nothing has been reported.
 */
export function trimActualToLastFilled(actual2026: (number | null)[]): (number | null)[] {
  const lastFilled = actual2026.reduce<number>((acc, v, i) => (v != null ? i : acc), -1);
  if (lastFilled < 0) return actual2026.map(() => null);
  return actual2026.map((v, i) => (i <= lastFilled ? (v ?? 0) : null));
}
