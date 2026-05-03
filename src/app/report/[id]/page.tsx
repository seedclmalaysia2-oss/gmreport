import { notFound } from "next/navigation";
import { getMonthReportById, listMonthReports } from "@/lib/month-report";
import { ReportEditor } from "@/components/report-editor";
import { emptyMonthReport } from "@/lib/schema";
import { parseMonthId } from "@/lib/utils";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const isNew = sp?.new === "1";
  let report = await getMonthReportById(id);
  if (!report) {
    const { year, month } = parseMonthId(id);
    if (!year || !month) notFound();
    report = emptyMonthReport(id, year, month);
  }
  // Load the full-year context so sections like Sales Quantity can pull prior-month
  // comparisons (FEB vs MAR) without extra client fetches.
  const allReports = await listMonthReports();
  return <ReportEditor initial={report} isNew={isNew} siblings={allReports} />;
}
