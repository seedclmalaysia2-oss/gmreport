"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, X } from "lucide-react";
import { SECTION_KEYS, SECTION_META, type SectionKey } from "@/lib/schema";
import type { RawFileEntry } from "@/lib/month-report";
import { monthNameFull } from "@/lib/utils";
import { fmtBytes, fmtTimestamp } from "@/lib/format";
import { coverageOf } from "@/lib/coverage";
import { kindLabel } from "@/lib/kind-labels";
import { CoverageChips, UncoveredSlideList } from "./coverage-chip";
import { FileRowActions } from "./file-row-actions";

export type MonthGroup = {
  monthReportId: string;
  year: number;
  month: number;
  files: RawFileEntry[];
};

/**
 * A single month's file table with a coverage-chip header. Owns the
 * "filter to files feeding uncovered slides" client-side toggle so the
 * server component (page.tsx) stays a pure fetch-and-render.
 */
export function MonthBlock({ group }: { group: MonthGroup }) {
  const { year, month, monthReportId, files } = group;
  const total = files.length;

  const coverage = useMemo(() => coverageOf(files), [files]);
  // Reveal the "Waiting for a file" strip when the user clicks the partial-
  // coverage chip. We DON'T filter the file table — a file whose sectionKeys
  // include X moves X into coveredInputs, so filtering by "feeds an
  // uncovered slide" is provably empty. The chip is a "show me what's
  // missing" affordance, not a "hide what's already there" one.
  const [missingOpen, setMissingOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-[var(--color-ice-200)] bg-white overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 sm:px-5 py-3 border-b border-[var(--color-ice-200)] bg-[var(--color-ice-50)]">
        <div className="min-w-0">
          <h3 className="font-[var(--font-display)] text-lg sm:text-xl font-semibold truncate">{monthNameFull(month)} {year}</h3>
          <p className="text-xs text-[var(--color-ink-600)] mt-0.5">
            {total} file{total === 1 ? "" : "s"} uploaded
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          <CoverageChips
            coverage={coverage}
            revealActive={missingOpen}
            onToggleReveal={() => setMissingOpen(v => !v)}
            hasFiles={total > 0}
          />
          <Link
            href={`/report/${monthReportId}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-ink-800)] hover:underline"
          >
            Open report <ArrowRight size={12} />
          </Link>
        </div>
      </header>

      {missingOpen && coverage.uncoveredInputs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-5 py-2.5 border-b border-[var(--color-ice-200)] bg-[var(--color-warn-50)]">
          <UncoveredSlideList
            monthReportId={monthReportId}
            uncoveredInputs={coverage.uncoveredInputs}
          />
          <button
            type="button"
            onClick={() => setMissingOpen(false)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-warn-800)] hover:underline"
          >
            <X size={12} /> Hide
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-600)] bg-white">
            <tr>
              <th className="text-right px-2 sm:px-3 py-2 w-[44px]">#</th>
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
            {files.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-sm text-[var(--color-ink-600)]">
                  No files in this month.
                </td>
              </tr>
            ) : (
              /* Row number is positional — re-sequences when a file is
                 removed (the page re-renders server-side). A same-name
                 re-upload supersedes the old copy at import time, so it
                 reuses the slot rather than taking a fresh number. */
              files.map((f, i) => <FileRow key={f.id} file={f} index={i + 1} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FileRow({ file, index }: { file: RawFileEntry; index: number }) {
  const label = kindLabel(file.kind);
  // Slides are stored in the order they were touched at import time; render
  // them in slide-number order (1, 5, 6 — not 6, 1, 5) so the chips read
  // top-to-bottom of the deck and match the row-level sort above.
  const slides = file.sectionKeys
    .filter((k): k is SectionKey => (SECTION_KEYS as readonly string[]).includes(k))
    .map(k => ({ key: k, ...SECTION_META[k] }))
    .sort((a, b) => a.no - b.no);

  return (
    <tr className="border-t border-[var(--color-ice-100)] align-top">
      <td className="px-2 sm:px-3 py-2.5 text-right text-[var(--color-ink-600)] tabular-nums font-medium">
        {index}
      </td>
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
              <div>{label}</div>
              <div className="tabular-nums">{fmtTimestamp(file.createdAt)}</div>
              {slides.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span>Slides:</span>
                  {slides.map(s => (
                    <Link
                      key={s.no}
                      href={`/report/${file.monthReportId}?section=${s.key}`}
                      className="rounded-full bg-[var(--color-ice-100)] px-1.5 py-0.5 text-[var(--color-ink-800)]"
                    >
                      {s.no}. {s.title}
                    </Link>
                  ))}
                </div>
              )}
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
      <td className="px-3 sm:px-5 py-2.5 hidden sm:table-cell text-[var(--color-ink-700)]">{label}</td>
      <td className="px-3 sm:px-5 py-2.5 hidden md:table-cell">
        {slides.length === 0 ? (
          <span className="text-[var(--color-ink-600)] italic">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {slides.map(s => (
              <Link
                key={s.no}
                href={`/report/${file.monthReportId}?section=${s.key}`}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-ice-100)] px-2 py-0.5 text-[11px] text-[var(--color-ink-800)] hover:bg-[var(--color-ink-800)] hover:text-white transition"
                title={`Go to Slide ${s.no} — ${s.title}`}
              >
                {s.no}. {s.title}
              </Link>
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
