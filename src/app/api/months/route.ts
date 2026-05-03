import { NextResponse } from "next/server";
import { getMonthReport, listMonthReports, upsertMonthReport } from "@/lib/month-report";
import { monthId } from "@/lib/utils";
import { prisma } from "@/lib/db";
import type { MonthReport } from "@/lib/schema";

export async function GET() {
  const all = await listMonthReports();
  return NextResponse.json(all);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (typeof body.year !== "number" || typeof body.month !== "number") {
    return NextResponse.json({ error: "year and month required" }, { status: 400 });
  }
  // If this month doesn't exist yet, pre-fill the "append"-style sections from
  // recent months so the user doesn't start from a blank slate.
  const existing = await getMonthReport(body.year, body.month);
  const prefill: Partial<MonthReport> = {};
  if (!existing) {
    const all = await listMonthReports();
    const newer = all.filter(m => (m.year < body.year) || (m.year === body.year && m.month < body.month));
    const mostRecent = newer[0];          // listMonthReports sorts desc
    const lastThree = newer.slice(0, 3);

    if (mostRecent?.salesAchievement) {
      // Carry forward year-wide budgets + prior-year actuals + KPI notes from earlier months.
      prefill.salesAchievement = {
        target2026: mostRecent.salesAchievement.target2026,
        actual2026: Array(12).fill(null),
        actual2025: mostRecent.salesAchievement.actual2025,
        netIncome2026: Array(12).fill(null),
        netIncome2025: mostRecent.salesAchievement.netIncome2025,
        kpi: lastThree.flatMap(m => m.salesAchievement?.kpi ?? [])
          .filter((k, i, arr) => arr.findIndex(x => x.month === k.month) === i),
      };
    }
    if (mostRecent?.productRegistration) prefill.productRegistration = mostRecent.productRegistration;
    if (mostRecent?.inventory) {
      // Keep group structure, but clear values so user sees empty cells to fill.
      prefill.inventory = {
        groups: mostRecent.inventory.groups.map(g => ({
          name: g.name,
          rows: g.rows.map(r => ({ product: r.product, warehouse: null, consignment: null })),
        })),
        totalWarehouse: null,
        totalConsignment: null,
        commentary: "",
      };
    }
    if (mostRecent?.financial) {
      prefill.financial = {
        arMyr: 0, arLongTermMyr: 0, apMyr: 0, collectionMyr: 0, cashFlowMyr: 0,
      };
    }
    prefill.fxRate = mostRecent?.fxRate ?? 30.73;
  }
  const report = await upsertMonthReport({ ...prefill, ...body });
  return NextResponse.json({ ...report, isNew: !existing });
}

export async function DELETE(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.monthReport.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
