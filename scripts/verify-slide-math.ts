/**
 * Machine-checked invariants for the Sales Achievement math shared by the
 * inline preview, the classic PPTX generator, and the modern PPTX
 * generator (`src/lib/slide-math.ts`).
 *
 * Run with:  npx tsx scripts/verify-slide-math.ts
 * Or:        npm run verify:slide-math
 *
 * If any assertion fires, the number Simon sees in the editor could differ
 * from the number HQ opens in the exported deck — PRODUCT.md Principle #1
 * ("Match the deck, not just the data") is the load-bearing product
 * promise this script defends.
 *
 * Add a case whenever a new shared computation is extracted into
 * slide-math.ts — the goal is that every drift-risk kernel is asserted
 * against explicit numeric expectations.
 */

import assert from "node:assert/strict";
import {
  sumOfNullable,
  ratioPerMonth,
  weightedRatioTotal,
  salesAchievementRows,
  totalForSalesAchievementRow,
  salesAchievementRates,
  trimActualToLastFilled,
} from "../src/lib/slide-math";
import type { SalesAchievement } from "../src/lib/schema";

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL ${name}`);
    console.error(err instanceof Error ? err.message : String(err));
  }
}

// ---- Fixture: a realistic partial-year SalesAchievement ----
// 6 months of 2026 actuals filed; full-year 2025 for YoY compare; a KPI
// note for the current month.
const fixture: SalesAchievement = {
  target2026:    [100, 100, 120, 120, 130, 130, 140, 140, 150, 150, 160, 160],
  actual2026:    [ 95, 105, 115, 125, 135, 145, null, null, null, null, null, null],
  target2025:    Array(12).fill(null),
  actual2025:    [ 90,  95, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155],
  netIncome2026: [ 10,  12,  14,  16,  18,  20, null, null, null, null, null, null],
  netIncome2025: [  8,  10,  12,  14,  16,  18,  20,  22,  24,  26,  28,  30],
  kpi: [{
    month: 6, achievementPct: null, yoyPct: null, newStores: 3,
    ecpThis: 42, ecpPrior: 40, plMyr: 20, plJpy: 500_000, extraLines: [],
  }],
};

console.log("verify-slide-math\n─────────────────");

check("sumOfNullable handles nulls, empties, and mixed arrays", () => {
  assert.equal(sumOfNullable([]), 0);
  assert.equal(sumOfNullable([null, null]), 0);
  assert.equal(sumOfNullable([1, null, 2, null, 3]), 6);
  assert.equal(sumOfNullable(fixture.target2026), 1600);
  assert.equal(sumOfNullable(fixture.actual2026), 720);
  assert.equal(sumOfNullable(fixture.actual2025), 1510);
});

check("ratioPerMonth returns null when denom is 0 or null", () => {
  const r = ratioPerMonth([10, 20, null, 30], [0, 40, 50, null]);
  assert.deepEqual(r, [null, 0.5, null, null]);
});

check("ratioPerMonth computes actual/target correctly on the fixture", () => {
  const acc = ratioPerMonth(fixture.actual2026, fixture.target2026);
  // Only the filled months should be non-null.
  assert.equal(acc[0], 0.95);
  assert.equal(acc[1], 1.05);
  assert.equal(acc[2], 115 / 120);
  assert.equal(acc[5], 145 / 130);
  assert.equal(acc[6], null);
  assert.equal(acc[11], null);
});

check("weightedRatioTotal returns sum-of-numerators / sum-of-denominators", () => {
  // Fixture: sumActual = 720, sumTarget = 1600 → 0.45
  assert.equal(weightedRatioTotal(fixture.actual2026, fixture.target2026), 720 / 1600);
  // Fixture: sumActual = 720, sumPrior = 1510
  assert.equal(weightedRatioTotal(fixture.actual2026, fixture.actual2025), 720 / 1510);
});

check("weightedRatioTotal returns null when denominator sum is 0", () => {
  assert.equal(weightedRatioTotal([10, 20], [0, 0]), null);
  assert.equal(weightedRatioTotal([], []), null);
  assert.equal(weightedRatioTotal([null, null], [null, null]), null);
});

check("salesAchievementRows produces 7 rows in the exact display order", () => {
  const rows = salesAchievementRows(fixture);
  assert.equal(rows.length, 7);
  assert.deepEqual(rows.map(r => r.label), [
    "Sales Target 2026",
    "Sales Result 2026",
    "ACC %",
    "Sales Result 2025",
    "YoY %",
    "Net Income 2026",
    "Net Income 2025",
  ]);
  // Percent rows are exactly ACC % and YoY %; nothing else.
  assert.deepEqual(rows.map(r => r.isPct), [false, false, true, false, true, false, false]);
});

check("salesAchievementRows returns an empty array when SA is null", () => {
  assert.deepEqual(salesAchievementRows(null), []);
  assert.deepEqual(salesAchievementRows(undefined), []);
});

check("totalForSalesAchievementRow sums money rows and uses override for percent rows", () => {
  const rows = salesAchievementRows(fixture);
  // Sales Target 2026 = sum of 12 months.
  assert.equal(totalForSalesAchievementRow(rows[0]), 1600);
  // Sales Result 2026 = sum of the 6 filled months.
  assert.equal(totalForSalesAchievementRow(rows[1]), 720);
  // ACC % Total = weighted (720/1600 = 0.45), NOT sum of the per-month ratios.
  assert.equal(totalForSalesAchievementRow(rows[2]), 720 / 1600);
  // YoY % Total = 720/1510.
  assert.equal(totalForSalesAchievementRow(rows[4]), 720 / 1510);
  // Net Income 2026 = 90.
  assert.equal(totalForSalesAchievementRow(rows[5]), 90);
});

check("salesAchievementRates returns the current-month accRate and yoyRate", () => {
  // Month 6 (June, index 5): actual=145, target=130, prior=125.
  const { accRate, yoyRate } = salesAchievementRates(fixture, 6);
  assert.equal(accRate, 145 / 130);
  assert.equal(yoyRate, 145 / 125);
});

check("salesAchievementRates returns nulls for months with missing data", () => {
  // Month 7 has no actual filed.
  const { accRate, yoyRate } = salesAchievementRates(fixture, 7);
  assert.equal(accRate, null);
  assert.equal(yoyRate, null);
});

check("salesAchievementRates returns nulls when SA itself is missing", () => {
  assert.deepEqual(salesAchievementRates(null, 6), { accRate: null, yoyRate: null });
  assert.deepEqual(salesAchievementRates(undefined, 1), { accRate: null, yoyRate: null });
});

check("trimActualToLastFilled clips post-last-filled entries to null", () => {
  const trimmed = trimActualToLastFilled(fixture.actual2026);
  // First 6 entries preserved; 7-12 are null.
  assert.deepEqual(trimmed.slice(0, 6), [95, 105, 115, 125, 135, 145]);
  assert.deepEqual(trimmed.slice(6), [null, null, null, null, null, null]);
});

check("trimActualToLastFilled returns all-null when nothing is filled", () => {
  const empty = Array(12).fill(null) as (number | null)[];
  const trimmed = trimActualToLastFilled(empty);
  assert.equal(trimmed.length, 12);
  assert.ok(trimmed.every(v => v === null));
});

check("trimActualToLastFilled treats intermediate nulls as zero, not null", () => {
  // Real POS data can have missing months in the middle. The trim helper
  // shouldn't LEAVE those as null (would break the chart); it should let
  // them fall through as 0 while still cutting the tail.
  const arr = [10, null, 20, 30, null, null, null, null, null, null, null, null];
  const trimmed = trimActualToLastFilled(arr);
  assert.equal(trimmed[0], 10);
  assert.equal(trimmed[1], 0);
  assert.equal(trimmed[2], 20);
  assert.equal(trimmed[3], 30);
  assert.equal(trimmed[4], null); // past last-filled
  assert.equal(trimmed[11], null);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
