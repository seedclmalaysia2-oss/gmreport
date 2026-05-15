import { notFound } from "next/navigation";
import { getMonthReportById, listMonthReports, listRawFilesForMonth } from "@/lib/month-report";
import { ReportEditor } from "@/components/report-editor";
import { emptyMonthReport } from "@/lib/schema";
import { parseMonthId } from "@/lib/utils";

// Always re-fetch — uploads/deletes done from a section source row call
// router.refresh(), and we want the new RawFile list reflected immediately.
export const dynamic = "force-dynamic";

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
  // Parallel fetches:
  //  - full-year context so sections like Sales Quantity can compare prior months
  //  - the month's live RawFile rows so each section's source chips reflect the
  //    real upload state (deleted files vanish, new ones appear)
  const [allReports, monthFiles] = await Promise.all([
    listMonthReports(),
    listRawFilesForMonth(report.id),
  ]);
  return (
    <ReportEditor
      initial={report}
      isNew={isNew}
      siblings={allReports}
      monthFiles={monthFiles}
    />
  );
}
