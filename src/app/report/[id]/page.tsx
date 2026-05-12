import { notFound } from "next/navigation";
import { getMonthReportById, listFileIdsByName, listMonthReports } from "@/lib/month-report";
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
  // Parallel fetches:
  //  - full-year context so sections like Sales Quantity can compare prior months
  //  - name→RawFile.id map so section chips can render a "View" link without
  //    making the client guess at the row's id
  const [allReports, fileIdsByName] = await Promise.all([
    listMonthReports(),
    listFileIdsByName(report.id),
  ]);
  return (
    <ReportEditor
      initial={report}
      isNew={isNew}
      siblings={allReports}
      fileIdsByName={fileIdsByName}
    />
  );
}
