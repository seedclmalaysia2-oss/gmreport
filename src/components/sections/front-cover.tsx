"use client";
import type { SectionProps } from "../report-editor";
import { monthNameFull } from "@/lib/utils";

/**
 * Front Cover editor.
 *
 * Not a stored "section" — it edits the MonthReport's top-level `presenter`
 * and `presentDate` fields, which the PPTX cover slide already renders. Shown
 * as the first tab in the report sidebar so the deck's title page is editable
 * without digging into the FX-rate card.
 */
export function SectionFrontCover({ report, update }: SectionProps) {
  // presentDate is stored as an ISO string (or null); <input type="date">
  // wants YYYY-MM-DD, so slice / rebuild around that.
  const dateValue = report.presentDate ? report.presentDate.slice(0, 10) : "";

  return (
    <div className="space-y-5 animate-fadein">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-600)]">
          Cover
        </div>
        <h2 className="font-[var(--font-display)] text-3xl font-semibold mt-1">Front Cover</h2>
        <p className="text-[var(--color-ink-600)] mt-1 text-sm">
          The deck&rsquo;s title page. Presenter and date below appear on the exported cover slide.
        </p>
      </header>

      <div className="rounded-2xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] p-5 space-y-5">
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-600)] mb-1.5">
            Presenter
          </span>
          <input
            type="text"
            value={report.presenter}
            onChange={e => update({ presenter: e.target.value })}
            placeholder="Simon (Malaysia GM)"
            className="w-full max-w-md rounded-md border border-[var(--color-ice-200)] px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[var(--color-ink-700)]/30"
          />
          <span className="block text-xs text-[var(--color-ink-600)] mt-1">
            Shown as &ldquo;By {report.presenter || "…"}&rdquo; on the cover.
          </span>
        </label>

        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-600)] mb-1.5">
            Present date
          </span>
          <input
            type="date"
            value={dateValue}
            onChange={e =>
              update({ presentDate: e.target.value ? new Date(e.target.value).toISOString() : null })
            }
            className="rounded-md border border-[var(--color-ice-200)] px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[var(--color-ink-700)]/30"
          />
          <span className="block text-xs text-[var(--color-ink-600)] mt-1">
            Optional. Appears as &ldquo;Present on …&rdquo; in the cover footer.
          </span>
        </label>

        {/* Read-only preview of the auto title — generated from the month(s). */}
        <div className="rounded-xl border border-dashed border-[var(--color-ice-200)] bg-[var(--color-ice-50)] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-600)]">
            Cover preview
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--color-ink-900)]">Malaysia Review</div>
          <div className="text-sm text-[var(--color-ink-700)] uppercase tracking-wide">
            {monthNameFull(report.month)} {report.year}
          </div>
          <div className="mt-1 text-xs italic text-[var(--color-ink-600)]">
            By {report.presenter || "—"}
            {report.presentDate
              ? ` · Present on ${new Date(report.presentDate).toLocaleDateString("en-GB")}`
              : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
