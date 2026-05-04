import Link from "next/link";
import { listMonthReports, listRawFiles, type RawFileEntry } from "@/lib/month-report";
import { SECTION_KEYS, SECTION_META, type MonthReport, type SectionKey } from "@/lib/schema";
import { monthNameFull } from "@/lib/utils";
import { ArrowRight, FileText, FileUp, Info } from "lucide-react";

// We deliberately avoid Next.js' route-segment cache so a fresh upload shows
// up immediately when the user navigates back to /files.
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

/** Group RawFile rows by month, preserving createdAt-desc order within each group. */
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
  // Fetch in parallel — RawFile is the canonical source of truth; the months
  // list is needed so we can show months that exist but have no uploads yet.
  const [rawFiles, months] = await Promise.all([listRawFiles(), listMonthReports()]);
  const groups = groupByMonth(rawFiles);

  const orderedMonths = months.slice().sort((a, b) => b.year - a.year || b.month - a.month);
  const monthsWithoutUploads = orderedMonths.filter(m => !groups.some(g => g.monthReportId === m.id));

  const totalUploads = rawFiles.length;

  return (
    <main className="mx-auto max-w-[1100px] px-3 sm:px-6 py-4 sm:py-8 space-y-6">
      <header>
        <p className="text-xs text-[var(--color-ink-600)] uppercase tracking-[0.2em]">Upload history</p>
        <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl font-semibold mt-1">All uploaded files</h1>
        <p className="text-sm text-[var(--color-ink-600)] mt-1">
          Every POS file that the importer has received, persisted to the Supabase database.
          Sorted newest first within each month.
        </p>
        {totalUploads > 0 && (
          <p className="text-xs text-[var(--color-ink-600)] mt-2">
            <strong className="text-[var(--color-ink-800)]">{totalUploads}</strong> file{totalUploads === 1 ? "" : "s"} on record across <strong className="text-[var(--color-ink-800)]">{groups.length}</strong> month{groups.length === 1 ? "" : "s"}.
          </p>
        )}
      </header>

      {/* Onboarding banner — only when the database has zero recorded uploads. */}
      {totalUploads === 0 && (
        <div className="rounded-xl border border-[var(--color-ice-200)] bg-[var(--color-ice-50)] p-4 flex gap-3 text-sm">
          <Info size={18} className="text-[var(--color-ink-700)] mt-0.5 shrink-0" />
          <div className="text-[var(--color-ink-800)]">
            <p className="font-semibold">No POS files have been imported yet.</p>
            <p className="text-[var(--color-ink-600)] mt-1">
              Head over to{" "}
              <Link href="/import" className="underline font-semibold text-[var(--color-ink-800)]">Import POS</Link>{" "}
              to upload PDF / Excel files. Once the import completes, every file you sent will be listed here.
            </p>
          </div>
        </div>
      )}

      {orderedMonths.length === 0 && (
        <div className="rounded-xl border border-[var(--color-ice-200)] bg-white p-8 text-center text-sm text-[var(--color-ink-600)]">
          No months on file yet.{" "}
          <Link href="/import" className="underline font-semibold text-[var(--color-ink-800)]">Import POS</Link> to get started.
        </div>
      )}

      {/* Months *with* uploads */}
      <div className="space-y-5">
        {groups.map(g => <MonthBlock key={g.monthReportId} group={g} />)}
      </div>

      {/* Months on record but no uploads yet — show as quiet rows with import CTAs. */}
      {monthsWithoutUploads.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-[var(--font-display)] text-lg font-semibold mt-4">Months without uploads</h2>
          <div className="rounded-2xl border border-[var(--color-ice-200)] bg-white overflow-hidden divide-y divide-[var(--color-ice-100)]">
            {monthsWithoutUploads.map(m => <EmptyMonthRow key={m.id} month={m} />)}
          </div>
        </section>
      )}
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
          <h2 className="font-[var(--font-display)] text-lg sm:text-xl font-semibold truncate">{monthNameFull(month)} {year}</h2>
          <p className="text-xs text-[var(--color-ink-600)] mt-0.5">
            {total} file{total === 1 ? "" : "s"} uploaded
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/import?year=${year}&month=${month}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-ink-600)] hover:text-[var(--color-ink-800)] hover:underline"
          >
            <FileUp size={12} /> Add more
          </Link>
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
            {/* On phones we collapse the metadata under the filename. */}
            <div className="sm:hidden text-[11px] text-[var(--color-ink-600)] mt-0.5 space-y-0.5">
              <div>{kindLabel}</div>
              <div>{fmtTimestamp(file.createdAt)}</div>
              {slides.length > 0 && (
                <div>Slides: {slides.map(s => s.title).join(", ")}</div>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 sm:px-5 py-2.5 hidden sm:table-cell text-[var(--color-ink-700)]">
        {kindLabel}
      </td>
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
      <td className="px-3 sm:px-5 py-2.5 text-right text-[var(--color-ink-600)] tabular-nums whitespace-nowrap hidden sm:table-cell">
        {fmtTimestamp(file.createdAt)}
      </td>
    </tr>
  );
}

function EmptyMonthRow({ month }: { month: MonthReport }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 sm:px-5 py-3">
      <div className="min-w-0">
        <p className="font-semibold truncate">{monthNameFull(month.month)} {month.year}</p>
        <p className="text-xs text-[var(--color-ink-600)]">No files uploaded for this month yet.</p>
      </div>
      <Link
        href={`/import?year=${month.year}&month=${month.month}`}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-[var(--color-ink-800)] text-white px-3 py-2 text-xs font-semibold hover:bg-[var(--color-ink-700)]"
      >
        <FileUp size={14} />
        Import
      </Link>
    </div>
  );
}
