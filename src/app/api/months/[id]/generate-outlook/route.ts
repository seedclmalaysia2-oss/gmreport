import { NextResponse } from "next/server";
import { getMonthReport, getMonthReportById, upsertMonthReport } from "@/lib/month-report";
import { buildOutlookFacts } from "@/lib/aggregation/outlook-facts";
import { generateOutlookHtml } from "@/lib/outlook/generate";

export const maxDuration = 60;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getMonthReportById(id);
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!current.salesAchievement) {
    return NextResponse.json({ error: "missing sales achievement — import POS data first" }, { status: 400 });
  }

  const priorMonth = current.month === 1 ? 12 : current.month - 1;
  const priorYear = current.month === 1 ? current.year - 1 : current.year;
  const prior = await getMonthReport(priorYear, priorMonth);

  const facts = buildOutlookFacts(current, prior);

  let body: string;
  try {
    body = await generateOutlookHtml(facts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "LLM call failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await upsertMonthReport({
    year: current.year,
    month: current.month,
    marketOutlook: { body },
  });

  return NextResponse.json({ body });
}
