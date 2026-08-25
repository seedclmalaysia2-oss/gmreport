import { SECTION_META, type SectionKey } from "./schema";
import type { RawFileEntry } from "./month-report";

/**
 * The eight slides whose data is fed from an uploaded POS file. These are
 * the slides where "coverage" is a meaningful question — the rest of the
 * 13-slide deck is keyed by hand in the report editor. Mapping matches the
 * parser router in src/app/api/import/route.ts.
 *
 * Kept in sync with the file-kind → sectionKey wiring in month-report.ts;
 * if a new POS file kind ever starts feeding one of the currently-manual
 * slides, move that key from MANUAL_SLIDES into INPUT_SLIDES here.
 */
export const INPUT_SLIDES: readonly SectionKey[] = [
  "salesAchievement",  // 1
  "dailySales",        // 4
  "salesByQuantity",   // 5
  "topProducts",       // 6
  "salesByECP",        // 7
  "salesByRegion",     // 8
  "inventory",         // 10
  "expireWriteOff",    // 11
] as const;

/**
 * Slides that don't come from a POS file — Simon keys them directly in the
 * report editor. Surfaced separately in the UI so the coverage badge doesn't
 * misleadingly claim 13/13 when 5 slides are always waiting for manual entry.
 */
export const MANUAL_SLIDES: readonly SectionKey[] = [
  "salesTrend",         // 2
  "marketOutlook",      // 3
  "productRegistration",// 9
  "financial",          // 12
  "otherMarket",        // 13
] as const;

/**
 * Is a section's stored payload actually usable, or present-but-broken?
 *
 * The sidebar tick and the "N missing" badge used to be a bare
 * `Boolean(report[key])` — "the JSON exists". That marked Slide 10 complete
 * even when every warehouse cell read 0 because the Stock ID join had silently
 * failed (Jul-26: the master SCLM exported column A with a blank header, so no
 * row matched HQ/HQ2 and the entire nationwide balance landed in consignment).
 * A section that is structurally present but self-evidently unfinished should
 * read as missing, so it gets re-imported rather than shipped.
 *
 * Keep the checks here cheap and unambiguous — a false "missing" is nearly as
 * unhelpful as a false "complete".
 */
export function sectionIsComplete(key: SectionKey, value: unknown): boolean {
  if (!value) return false;
  if (key === "inventory") {
    const inv = value as { totalWarehouse?: number | null; totalConsignment?: number | null };
    // Warehouse stock is never legitimately zero for a month that imported
    // successfully — in split mode it's HQ + HQ2, and in master-only mode it's
    // the entire nationwide balance. Zero means the parse or the Stock ID join
    // fell over. Two ways this has actually shipped green:
    //   Jul-26  warehouse 0, consignment 261,515  (split matched 0 of 12,505 rows)
    //   Jan/Feb-26  every one of the 25 cells 0/null (nothing parsed at all)
    // /api/import now refuses to write the first case, but months imported
    // before that guard still carry it, so check the payload rather than
    // trusting that it was written by a good build.
    if (!(inv.totalWarehouse ?? 0)) return false;
  }
  return true;
}

export type MonthCoverage = {
  /** Slides where at least one uploaded file's sectionKeys includes the key. */
  coveredInputs: Set<SectionKey>;
  /** INPUT_SLIDES − coveredInputs, in slide-number order. */
  uncoveredInputs: SectionKey[];
  /** Count for the badge — always INPUT_SLIDES.length today. */
  totalInputs: number;
  /** MANUAL_SLIDES verbatim — read-only pill contents. */
  manualSlides: readonly SectionKey[];
};

/**
 * Derive per-month slide coverage from a list of uploaded files. Pure
 * function so it can be memoised by callers without extra state plumbing.
 *
 * Returns:
 *   - coveredInputs: the input slides that have at least one file feeding them
 *   - uncoveredInputs: the input slides still waiting for a file, in slide-no order
 *   - totalInputs: constant 8 today — kept as a field so we can graduate a
 *     manual slide into inputs without changing the callsite
 *   - manualSlides: the 5 always-manual slides so the header can list them
 */
export function coverageOf(files: readonly RawFileEntry[]): MonthCoverage {
  const covered = new Set<SectionKey>();
  for (const f of files) {
    for (const k of f.sectionKeys) {
      if ((INPUT_SLIDES as readonly string[]).includes(k)) {
        covered.add(k as SectionKey);
      }
    }
  }
  const uncovered = INPUT_SLIDES
    .filter(k => !covered.has(k))
    .slice()
    .sort((a, b) => SECTION_META[a].no - SECTION_META[b].no);

  return {
    coveredInputs: covered,
    uncoveredInputs: uncovered,
    totalInputs: INPUT_SLIDES.length,
    manualSlides: MANUAL_SLIDES,
  };
}
