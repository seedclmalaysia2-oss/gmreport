import { Suspense } from "react";
import Link from "next/link";
import { listDeletedRawFiles, listMonthReports, listRawFiles, type RawFileEntry } from "@/lib/month-report";
import { SECTION_META, type MonthReport, type SectionKey } from "@/lib/schema";
import { monthNameFull } from "@/lib/utils";
import { FileUp, Info, Trash2 } from "lucide-react";
import { ImportForm } from "@/components/import-form";
import { MonthBlock, type MonthGroup } from "@/components/month-block";
import { TrashTable } from "@/components/trash-table";

// Combined Upload + History page. After a successful import the client form
// calls router.refresh(), which triggers a fresh server render of this page
// — which then re-runs listRawFiles() and shows the new file in the table
// below. Without force-dynamic the RSC would be cached and the new file
// wouldn't show up until the next hard reload.
export const dynamic = "force-dynamic";

function groupByMonth(files: RawFileEntry[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  for (const f of files) {
    const existing = map.get(f.monthReportId);
    if (existing) existing.files.push(f);
    else map.set(f.monthReportId, { monthReportId: f.monthReportId, year: f.year, month: f.month, files: [f] });
  }
  // Sort each month's files so they walk in slide order (1 → 13). Within a
  // file the chips are already sorted by SECTION_META.no; here we also
  // re-order the ROWS by the *first* slide each file feeds so the user can
  // read the table top-to-bottom in deck sequence. Files that we couldn't
  // classify to any slide go to the bottom of their month.
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
        <h1 className="font-[var(--font-display)] text-2xl sm:text-3xl font-semibold">Upload &amp; history</h1>
        <p className="text-sm text-[var(--color-ink-600)] mt-2">
          Drop the month&rsquo;s POS files and check what&rsquo;s already on record.
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

        {/* Months still missing files — surfaced at the top so the user sees
            what needs uploading before scrolling through completed months. */}
        {monthsWithoutUploads.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-[var(--font-display)] text-sm font-semibold text-[var(--color-ink-700)]">Months without uploads</h3>
            <div className="rounded-2xl border border-[var(--color-ice-200)] bg-white overflow-hidden divide-y divide-[var(--color-ice-100)]">
              {monthsWithoutUploads.map(m => <EmptyMonthRow key={m.id} month={m} />)}
            </div>
          </div>
        )}

        <div className="space-y-5">
          {groups.map(g => <MonthBlock key={g.monthReportId} group={g} />)}
        </div>
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
          <TrashTable files={deletedFiles as (RawFileEntry & { deletedAt: string })[]} />
        </section>
      )}
    </main>
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
        Import
      </Link>
    </div>
  );
}
