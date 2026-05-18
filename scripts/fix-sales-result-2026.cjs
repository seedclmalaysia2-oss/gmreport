/**
 * One-off data fix — Slide 1 "Sales Result 2026" (actual2026).
 *
 * Some month reports carried STALE Sales Result figures: a value parsed
 * before the "Sales adj" rule was applied got carried forward into later
 * months and then frozen (the old carry-forward only filled empty slots,
 * never refreshed an already-populated one). Most visibly the April report
 * showed March = 321,467.74 instead of the correct 323,818.71.
 *
 * Ground truth — read straight from each month's POS master file
 * ("Stock Sales Analysis Summary - By Group <Mon>26.xlsx"), with the
 * permanent Sales-adj rule applied (Grand Total + signed adjustment):
 *
 *   Jan : 411,381.22  (Grand Total 411,381.22, no Sales adj)
 *   Feb : 304,689.39  (Grand Total 304,689.39, no Sales adj)
 *   Mar : 323,818.71  (Grand Total 323,892.31 - 73.60 Sales Adj)
 *   Apr : 323,919.63  (Grand Total 323,993.23 - 73.60 Sales adj)
 *
 * This writes the correct accrued chain into every 2026 month report so the
 * figures are consistent everywhere. The companion code fix in
 * src/app/api/months/repair/route.ts stops the staleness recurring.
 *
 * Run:  node scripts/fix-sales-result-2026.cjs
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// month index (0-based) -> authoritative own-month Sales Result 2026
const AUTHORITATIVE = [411381.22, 304689.39, 323818.71, 323919.63];

(async () => {
  const reports = await prisma.monthReport.findMany({
    where: { year: 2026 },
    orderBy: { month: "asc" },
  });

  for (const row of reports) {
    const monthIdx = row.month - 1;
    let sa;
    try {
      sa = row.salesAchievement ? JSON.parse(row.salesAchievement) : null;
    } catch {
      sa = null;
    }
    if (!sa) {
      console.log(`2026-${String(row.month).padStart(2, "0")}: no salesAchievement — skipped`);
      continue;
    }

    // Accrued chain: months 1..thisMonth carry the authoritative figure;
    // future months stay null (not yet reported).
    const before = Array.isArray(sa.actual2026) ? [...sa.actual2026] : Array(12).fill(null);
    const next = Array.from({ length: 12 }, (_, i) =>
      i <= monthIdx ? (AUTHORITATIVE[i] ?? before[i] ?? null) : null,
    );
    sa.actual2026 = next;

    await prisma.monthReport.update({
      where: { id: row.id },
      data: { salesAchievement: JSON.stringify(sa) },
    });
    console.log(
      `2026-${String(row.month).padStart(2, "0")}: actual2026`,
      JSON.stringify(before.slice(0, monthIdx + 1)),
      "->",
      JSON.stringify(next.slice(0, monthIdx + 1)),
    );
  }

  await prisma.$disconnect();
  console.log("done.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
