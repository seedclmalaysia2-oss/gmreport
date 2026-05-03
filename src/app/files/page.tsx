import Link from "next/link";
import { listMonthReports } from "@/lib/month-report";
import { SECTION_KEYS, SECTION_META, type MonthReport, type SectionKey } from "@/lib/schema";
import { monthNameFull } from "@/lib/utils";
import { ArrowRight, FileText } from "lucide-react";

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

export default async function FilesPage() {
  const months = await listMonthReports();
  const ordered = months.slice().sort((a, b) => b.year - a.year || b.month - a.month);

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8 space-y-6">
      <header>
        <p className="text-xs text-[var(--color-ink-600)] uppercase tracking-[0.2em]">Upload history</p>
        <h1 className="font-[var(--font-display)] text-3xl font-semibold mt-1">Source files by month & slide</h1>
        <p className="text-sm text-[var(--color-ink-600)] mt-1">
          Every POS file you imported, grouped by the month it was uploaded for and the slide it populated.
          Timestamps are when the file was processed by the importer.
        </p>
      </header>

      {ordered.length === 0 && (
        <div className="rounded-xl border border-[var(--color-ice-200)] bg-white p-8 text-center text-sm text-[var(--color-ink-600)]">
          No months on file yet.{" "}
          <Link href="/import" className="underline font-semibold text-[var(--color-ink-800)]">Import POS</Link> to get started.
        </div>
      )}

      <div className="space-y-5">
        {ordered.map(m => <MonthBlock key={m.id} month={m} />)}
      </div>
    </main>
  );
}

function MonthBlock({ month }: { month: MonthReport }) {
  const entries = SECTION_KEYS
    .map(k => ({ key: k, files: month.sourceFiles?.[k] ?? [] }))
    .filter(e => e.files.length > 0);

  const totalFiles = entries.reduce((s, e) => s + e.files.length, 0);

  return (
    <section className="rounded-2xl border border-[var(--color-ice-200)] bg-white overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-ice-200)] bg-[var(--color-ice-50)]">
        <div>
          <h2 className="font-[var(--font-display)] text-xl font-semibold">{monthNameFull(month.month)} {month.year}</h2>
          <p className="text-xs text-[var(--color-ink-600)] mt-0.5">
            {totalFiles === 0 ? "No files recorded" : `${totalFiles} file${totalFiles === 1 ? "" : "s"} across ${entries.length} slide${entries.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href={`/report/${month.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-ink-800)] hover:underline"
        >
          Open report <ArrowRight size={12} />
        </Link>
      </header>

      {entries.length === 0 ? (
        <div className="px-5 py-4 text-sm text-[var(--color-ink-600)]">
          No files uploaded for this month yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-[var(--color-ink-600)] bg-white">
            <tr>
              <th className="text-left px-5 py-2 w-[22%]">Slide</th>
              <th className="text-left px-5 py-2">File</th>
              <th className="text-right px-5 py-2 w-[10%]">Size</th>
              <th className="text-right px-5 py-2 w-[22%]">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {entries.flatMap(({ key, files }) =>
              files.map((f, i) => (
                <FileRow
                  key={`${key}-${i}`}
                  sectionKey={key}
                  fileName={f.name}
                  size={f.size ?? null}
                  at={f.at}
                  showSlide={i === 0}
                  slideLabelCount={files.length}
                />
              )),
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}

function FileRow({
  sectionKey, fileName, size, at, showSlide, slideLabelCount,
}: {
  sectionKey: SectionKey;
  fileName: string;
  size: number | null;
  at: string;
  showSlide: boolean;
  slideLabelCount: number;
}) {
  const meta = SECTION_META[sectionKey];
  return (
    <tr className="border-t border-[var(--color-ice-100)] align-top">
      <td className="px-5 py-2 text-[var(--color-ink-800)]">
        {showSlide ? (
          <div>
            <div className="text-xs text-[var(--color-ink-600)]">Slide {meta.no}</div>
            <div className="font-semibold">{meta.title}</div>
            {slideLabelCount > 1 && (
              <div className="text-[11px] text-[var(--color-ink-600)] mt-0.5">{slideLabelCount} files</div>
            )}
          </div>
        ) : null}
      </td>
      <td className="px-5 py-2">
        <div className="flex items-start gap-2">
          <FileText size={14} className="text-[var(--color-ink-600)] mt-0.5 shrink-0" />
          <span className="break-all">{fileName}</span>
        </div>
      </td>
      <td className="px-5 py-2 text-right text-[var(--color-ink-600)] tabular-nums">{fmtBytes(size)}</td>
      <td className="px-5 py-2 text-right text-[var(--color-ink-600)] tabular-nums whitespace-nowrap">{fmtTimestamp(at)}</td>
    </tr>
  );
}
