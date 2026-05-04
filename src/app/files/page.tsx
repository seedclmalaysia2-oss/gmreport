import { Suspense } from "react";
import Link from "next/link";
import { listMonthReports, listRawFiles, type RawFileEntry } from "@/lib/month-report";
import { SECTION_KEYS, SECTION_META, type MonthReport, type SectionKey } from "@/lib/schema";
import { monthNameFull } from "@/lib/utils";
import { ArrowRight, FileText, FileUp, Info } from "lucide-react";
import { ImportForm } from "@/components/import-form";
import { FileRowActions } from "@/components/file-row-actions";

// Combined Upload + History page. After a successful import the client form
// calls router.refresh(), which triggers a fresh server render of this page
// — which then re-runs listRawFiles() and shows the new file in the table
// below. Without force-dynamic the RSC would be cached and the new file
// wouldn't show up until the next hard reload.
export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  pos_master:     "POS Master (Stock Sales Analysis)",
  pos_mcuv:       "MCUV breakdown",
  pos_writeoff:   "Stocks Write-Off",
  pos_outlets:    "Monthly Sales Performance",
  pos_ecp_list:   "ECP List",
  pos_region:     "Sales Analysis By Region",
  pos_salesman:   "Salesman Sales & Collection",
  pos_inventory:  "Stock List (SCLM)",
  pos_collection: "Collection Listing",
  pos_daily:      "Daily Sales Quantity",
  unknown:        "Unrecognised file",
};

function fmtBytes(size: number | null | undefined): string {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

type GroupedFiles = {
  monthReportId: string;
  year: number;
  month: number;
  files: RawFileEntry[];
};

function groupByMonth(files: RawFileEntry[]): GroupedFiles[] {
  const map = new Map<string, GroupedFiles>();
  for (const f of files) {
    const existing = map.get(f.monthReportId);
    if (existing) existing.files.push(f);
    else map.set(f.monthReportId, { monthReportId: f.monthReportId, year: f.year, month: f.month, files: [f] });
  }
  return [...map.values()].sort((a, b) => b.year - a.year || b.month - a.month);
}

export default async function FilesPage() {
  const [rawFiles, months] = await Promise.all([listRawFiles(), listMonthReports()]);
  const groups = groupByMonth(rawFiles);
  const orderedMonths = months.slice().sort((a, b) => b.year - a.year || b.month - a.month);
  const monthsWithoutUploads = orderedMonths.filter(m => !groups.some(g => g.monthReportId === m.id));
  const totalUploads = rawFiles.length;

  return (
    <main className="mx-auto max-w-[1100px] px-3 sm:px-6 py-4 sm:py-8 space-y-6">
      <header>
        <p className="text-xs text-[var(--color-ink-600)] uppercase tracking-[0.2em]">Files</p>
        <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl font-semibold mt-1">Upload &amp; history</h1>
        <p className="text-sm text-[var(--color-ink-600)] mt-1">
          One place to drop POS files and see everything that&rsquo;s already on record.
          Files you import here are saved to Supabase and grouped by month below.
        </p>
      </header>

      {/* ---------- 1. Upload form ---------- */}
      <section id="upload" className="space-y-3 scroll-mt-20">
        <div className="flex items-baseline justify-between">
          <h2 className="font-[var(--font-display)] text-lg font-semibold">Upload POS files</h2>
          <span className="text-xs text-[var(--color-ink-600)]">PDF + XLSX, multiple at once</span>
        </div>
        <Suspense fallback={<div className="rounded-2xl border border-[var(--color-ice-200)] bg-white p-6 text-sm text-[var(--color-ink-600)]">Loading uploader…</div>}>
          <ImportForm />
        </Suspense>
      </section>

      {/* ---------- 2. Upload history ---------- */}
      <section className="space-y-4 pt-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-[var(--font-display)] text-lg font-semibold">Upload history</h2>
          {totalUploads > 0 && (
            <span className="text-xs text-[var(--color-ink-600)]">
              <strong className="text-[var(--color-ink-800)]">{totalUploads}</strong> file{totalUploads === 1 ? "" : "s"} across <strong className="text-[var(--color-ink-800)]">{groups.length}</strong> month{groups.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {totalUploads === 0 && (
          <div className="rounded-xl border border-[var(--color-ice-200)] bg-[var(--color-ice-50)] p-4 flex gap-3 text-sm">
            <Info size={18} className="text-[var(--color-ink-700)] mt-0.5 shrink-0" />
            <div className="text-[var(--color-ink-800)]">
              <p className="font-semibold">No POS files imported yet.</p>
              <p className="text-[var(--color-ink-600)] mt-1">
                Drop your files into the uploader above and click <strong>Import</strong>. Once processed, every file you sent will appear here.
              </p>
            </div>
          </div>
        )}

        {orderedMonths.length === 0 && totalUploads === 0 && (
          <div className="rounded-xl border border-[var(--color-ice-200)] bg-white p-8 text-center text-sm text-[var(--color-ink-600)]">
            No months on file yet — your first import will create one.
          </div>
        )}

        <div className="space-y-5">
          {groups.map(g => <MonthBlock key={g.monthReportId} group={g} />)}
        </div>

        {monthsWithoutUploads.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-[var(--font-display)] text-sm font-semibold text-[var(--color-ink-700)] mt-4">Months without uploads</h3>
            <div className="rounded-2xl border border-[var(--color-ice-200)] bg-white overflow-hidden divide-y divide-[var(--color-ice-100)]">
              {monthsWithoutUploads.map(m => <EmptyMonthRow key={m.id} month={m} />)}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function MonthBlock({ group }: { group: GroupedFiles }) {
  const { year, month, monthReportId, files } = group;
  const total = files.length;

  return (
    <section className="rounded-2xl border border-[var(--color-ice-200)] bg-white overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-3 sm:px-5 py-3 border-b border-[var(--color-ice-200)] bg-[var(--color-ice-50)]">
        <div className="min-w-0">
          <h3 className="font-[var(--font-display)] text-lg sm:text-xl font-semibold truncate">{monthNameFull(month)} {year}</h3>
          <p className="text-xs text-[var(--color-ink-600)] mt-0.5">
            {total} file{total === 1 ? "" : "s"} uploaded
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/report/${monthReportId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-ink-800)] hover:underline"
          >
            Open report <ArrowRight size={12} />
          </Link>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-[var(--color-ink-600)] bg-white">
            <tr>
              <th className="text-left px-3 sm:px-5 py-2">File</th>
              <th className="text-left px-3 sm:px-5 py-2 hidden sm:table-cell">Detected as</th>
              <th className="text-left px-3 sm:px-5 py-2 hidden md:table-cell">Slides fed</th>
              <th className="text-right px-3 sm:px-5 py-2 w-[80px]">Size</th>
              <th className="text-right px-3 sm:px-5 py-2 w-[140px] hidden sm:table-cell">Uploaded</th>
              <th className="text-right px-3 sm:px-5 py-2 w-[160px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map(f => <FileRow key={f.id} file={f} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FileRow({ file }: { file: RawFileEntry }) {
  const kindLabel = KIND_LABELS[file.kind] ?? file.kind;
  const slides = file.sectionKeys
    .filter((k): k is SectionKey => (SECTION_KEYS as readonly string[]).includes(k))
    .map(k => SECTION_META[k]);

  return (
    <tr className="border-t border-[var(--color-ice-100)] align-top">
      <td className="px-3 sm:px-5 py-2.5">
        <div className="flex items-start gap-2">
          <FileText size={14} className="text-[var(--color-ink-600)] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="break-all font-medium text-[var(--color-ink-900)]">{file.originalName}</div>
            <div className="sm:hidden text-[11px] text-[var(--color-ink-600)] mt-0.5 space-y-0.5">
              <div>{kindLabel}</div>
              <div>{fmtTimestamp(file.createdAt)}</div>
              {slides.length > 0 && <div>Slides: {slides.map(s => s.title).join(", ")}</div>}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 sm:px-5 py-2.5 hidden sm:table-cell text-[var(--color-ink-700)]">{kindLabel}</td>
      <td className="px-3 sm:px-5 py-2.5 hidden md:table-cell">
        {slides.length === 0 ? (
          <span className="text-[var(--color-ink-600)] italic">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {slides.map(s => (
              <span
                key={s.no}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-ice-100)] px-2 py-0.5 text-[11px] text-[var(--color-ink-800)]"
                title={`Slide ${s.no}`}
              >
                {s.no}. {s.title}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-3 sm:px-5 py-2.5 text-right text-[var(--color-ink-600)] tabular-nums">{fmtBytes(file.byteSize)}</td>
      <td className="px-3 sm:px-5 py-2.5 text-right text-[var(--color-ink-600)] tabular-nums whitespace-nowrap hidden sm:table-cell">{fmtTimestamp(file.createdAt)}</td>
      <td className="px-3 sm:px-5 py-2.5">
        <FileRowActions
          fileId={file.id}
          year={file.year}
          month={file.month}
          fileName={file.originalName}
        />
      </td>
    </tr>
  );
}

function EmptyMonthRow({ month }: { month: MonthReport }) {
  // Selecting this row pre-fills the year/month in the upload form via query
  // params; ImportForm reads them on mount.
  return (
    <div className="flex items-center justify-between gap-3 px-3 sm:px-5 py-3">
      <div className="min-w-0">
        <p className="font-semibold truncate">{monthNameFull(month.month)} {month.year}</p>
        <p className="text-xs text-[var(--color-ink-600)]">No files uploaded for this month yet.</p>
      </div>
      <Link
        href={`/files?year=${month.year}&month=${month.month}#upload`}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-[var(--color-ink-800)] text-white px-3 py-2 text-xs font-semibold hover:bg-[var(--color-ink-700)]"
      >
        <FileUp size={14} />
        Upload here
      </Link>
    </div>
  );
}
