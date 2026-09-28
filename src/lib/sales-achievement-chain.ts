import type { MonthReport, SalesAchievement } from "./schema";

/**
 * Per-slot chain merge for Slide 1 Sales Achievement.
 *
 * Rules:
 *   - Full-year fields (target2026, target2025, actual2025, netIncome2025):
 *     pull every null slot from the prior month's healed snapshot.
 *   - Accruing fields (actual2026, netIncome2026): the prior month's healed
 *     chain is authoritative for every *past* month — each slot there is
 *     that month's own POS figure. We take it even when this report already
 *     carries a value, so a stale number (e.g. a pre-Sales-adj total carried
 *     forward before the parser was fixed) is refreshed instead of frozen.
 *     The current month's own slot stays authoritative; future months stay
 *     untouched (not yet reported).
 *   - KPI commentary: copy from prior month only if the current month has
 *     no entries.
 *
 * Idempotent: running this on an already-merged month produces the same
 * output (changed = false).
 */
export function mergeSalesAchievementChain(
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
    target2025: Array(12).fill(null),
    actual2025: Array(12).fill(null),
    netIncome2026: Array(12).fill(null),
    netIncome2025: Array(12).fill(null),
    kpi: [],
  };
  // Defensive: a SA loaded before target2025 existed may be missing the field
  // at runtime even though TS thinks it's there. Fill it in so mergeFull
  // below doesn't read undefined.
  if (!Array.isArray((cur as { target2025?: unknown }).target2025)) {
    (cur as { target2025: (number | null)[] }).target2025 = Array(12).fill(null);
  }

  // Full-year merge: take current's non-null, else prior's, else null.
  const mergeFull = (cu: (number | null)[], pr: (number | null)[]): (number | null)[] =>
    Array.from({ length: 12 }, (_, i) => (cu[i] != null ? cu[i] : (pr[i] ?? null)));

  // Accruing merge.
  //   - Future months (i > monthIdx): keep current — nothing reported yet.
  //   - Current month (i === monthIdx): this report's own POS import is
  //     authoritative; fall back to prior only if the slot is still empty.
  //   - Past months (i < monthIdx): the prior month's healed chain wins —
  //     it holds each month's own authoritative figure, so a stale value
  //     carried forward before a parser fix gets corrected, not frozen.
  const mergeAccrual = (cu: (number | null)[], pr: (number | null)[]): (number | null)[] =>
    Array.from({ length: 12 }, (_, i) => {
      if (i > monthIdx) return cu[i] ?? null;
      if (i === monthIdx) return cu[i] != null ? cu[i] : (pr[i] ?? null);
      return pr[i] != null ? pr[i] : (cu[i] ?? null);
    });

  const next: SalesAchievement = {
    target2026:    mergeFull   (cur.target2026,    prior.target2026),
    actual2026:    mergeAccrual(cur.actual2026,    prior.actual2026),
    target2025:    mergeFull   (cur.target2025 ?? Array(12).fill(null),
                                (prior as { target2025?: (number | null)[] }).target2025 ?? Array(12).fill(null)),
    actual2025:    mergeFull   (cur.actual2025,    prior.actual2025),
    netIncome2026: mergeAccrual(cur.netIncome2026, prior.netIncome2026),
    netIncome2025: mergeFull   (cur.netIncome2025, prior.netIncome2025),
    kpi: cur.kpi.length ? cur.kpi : (prior.kpi ?? []),
  };

  const changed = JSON.stringify(next) !== JSON.stringify(cur);
  return { value: next, changed };
}

/**
 * Walk a sorted list of reports (earliest → latest) and cumulatively merge
 * each with the previous month's healed chain. Returns the same list with
 * salesAchievement now carrying every past month's authoritative figures.
 *
 * Read paths (getMonthReport, listMonthReports) call this so the editor,
 * preview, and PPT export always render the current chain without needing a
 * manual Recalculate click.
 */
export function applyChainMergeAcrossYear(reports: MonthReport[]): MonthReport[] {
  if (reports.length === 0) return reports;
  const sorted = [...reports].sort((a, b) => a.year - b.year || a.month - b.month);
  // Merge within each calendar year — chain doesn't cross year boundaries.
  const byYear = new Map<number, MonthReport[]>();
  for (const r of sorted) {
    if (!byYear.has(r.year)) byYear.set(r.year, []);
    byYear.get(r.year)!.push(r);
  }
  for (const yearReports of byYear.values()) {
    let priorChain: SalesAchievement | null = null;
    for (const r of yearReports) {
      const { value } = mergeSalesAchievementChain(r.salesAchievement, priorChain, r.month - 1);
      r.salesAchievement = value;
      priorChain = value ?? priorChain;
    }
  }
  return reports;
}
