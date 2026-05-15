import { Suspense } from "react";
import Link from "next/link";
import { listDeletedRawFiles, listMonthReports, listRawFiles, type RawFileEntry } from "@/lib/month-report";
import { SECTION_KEYS, SECTION_META, type MonthReport, type SectionKey } from "@/lib/schema";
import { monthNameFull } from "@/lib/utils";
import { ArrowRight, FileText, FileUp, Info, Trash2 } from "lucide-react";
import { ImportForm } from "@/components/import-form";
import { FileRowActions } from "@/components/file-row-actions";
import { TrashTable } from "@/components/trash-table";

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
  ref_2025:       "2025 Sales Summary (prior-year reference)",
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
  // Sort each month's files so they walk in slide order (1 → 13). Within a
  // file the chips are already sorted by SECTION_META.no below, but here we
  // also re-order the ROWS by the *first* slide each file feeds so the user
  // can read the table top-to-bottom in deck sequence. Files that we
  // couldn't classify to any slide go to the bottom of their month.
  for (const g of map.values()) {
    g.files.sort((a, b) => firstSlideNo(a) - firstSlideNo(b));
  }
  return [...map.values()].sort((a, b) => b.year - a.year || b.month - a.month);
}

/** Lowest section-number this file fed, or Infinity if none recognised. */
function firstSlideNo(f: RawFileEntry): number {
  let best = Infinity;
  for (const k of f.sectionKeys) {
    const meta = SECTION_META[k as SectionKey];
    if (meta && meta.no < best) best = meta.no;
  }
  return best;
}

export default async function FilesPage() {
  const [rawFiles, deletedFiles, months] = await Promise.all([
    listRawFiles(),
    listDeletedRawFiles(),
    listMonthReports(),
  ]);
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

      {/* ---------- 3. Recently deleted (trash) ---------- */}
      {deletedFiles.length > 0 && (
        <section className="space-y-3 pt-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-[var(--font-display)] text-lg font-semibold flex items-center gap-2">
              <Trash2 size={16} className="text-[var(--color-ink-600)]" />
              Recently deleted
            </h2>
            <span className="text-xs text-[var(--color-ink-600)]">
              {deletedFiles.length} file{deletedFiles.length === 1 ? "" : "s"} · restore any time
            </span>
          </div>
          <p className="text-xs text-[var(--color-ink-600)]">
            Files you removed are kept here until you click <strong>Delete forever</strong>.
            Tick the checkboxes to act on multiple files at once, or use the per-row
            <strong> Restore</strong> / <strong>Delete forever</strong> actions.
          </p>
          <TrashTable files={deletedFiles as (RawFileEntry & { deletedAt: string })[]} />
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
              {/* Actions column is desktop-only — on phones the buttons render
                  inline under the filename so they get a real tap target. */}
              <th className="text-right px-3 sm:px-5 py-2 w-[260px] hidden sm:table-cell">Actions</th>
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
  // Slides are stored in the order they were touched at import time; render
  // them in slide-number order (1, 5, 6 — not 6, 1, 5) so the chips read
  // top-to-bottom of the deck and match the row-level sort above.
  const slides = file.sectionKeys
    .filter((k): k is SectionKey => (SECTION_KEYS as readonly string[]).includes(k))
    .map(k => SECTION_META[k])
    .sort((a, b) => a.no - b.no);

  return (
    <tr className="border-t border-[var(--color-ice-100)] align-top">
      <td className="px-3 sm:px-5 py-2.5">
        <div className="flex items-start gap-2">
          <FileText size={14} className="text-[var(--color-ink-600)] mt-0.5 shrink-0" />
          <div className="min-w-0">
            {/* Filename is a download link when we have the bytes — clicks
                stream the file from /api/files/{id} with attachment header. */}
            {file.hasBytes ? (
              <a
                href={`/api/files/${file.id}?disposition=attachment`}
                download={file.originalName}
                className="break-all font-medium text-[var(--color-ink-900)] hover:underline"
                title={`Download ${file.originalName}`}
              >
                {file.originalName}
              </a>
            ) : (
              <span className="break-all font-medium text-[var(--color-ink-900)]" title="File content not stored — re-upload to enable download">
                {file.originalName}
              </span>
            )}
            <div className="sm:hidden text-[11px] text-[var(--color-ink-600)] mt-0.5 space-y-0.5">
              <div>{kindLabel}</div>
              <div>{fmtTimestamp(file.createdAt)}</div>
              {slides.length > 0 && <div>Slides: {slides.map(s => s.title).join(", ")}</div>}
            </div>
            {/* Mobile-only action row — desktop has its own column on the right. */}
            <div className="sm:hidden mt-2">
              <FileRowActions
                fileId={file.id}
                year={file.year}
                month={file.month}
                fileName={file.originalName}
                hasBytes={file.hasBytes}
              />
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
      <td className="px-3 sm:px-5 py-2.5 hidden sm:table-cell">
        <FileRowActions
          fileId={file.id}
          year={file.year}
          month={file.month}
          fileName={file.originalName}
          hasBytes={file.hasBytes}
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
