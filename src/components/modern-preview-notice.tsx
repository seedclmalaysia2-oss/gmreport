"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";

/**
 * Honesty banner shown on the Export page whenever the user has picked
 * the Modern template. The preview canvas below currently renders every
 * slide with the shared table layout — the Modern PPTX generator ships
 * additional layout treatments (KPI callouts, doughnut, growth column,
 * dark cover, icon-numbered agenda) that only appear in the download.
 *
 * The banner + differences modal exist so Simon can't sign off a
 * preview that doesn't match what HQ opens. When SlideBody eventually
 * grows real per-template preview components, this notice can retire.
 *
 * Copy is Simon's register — plain sentences, no marketing polish.
 */

type Difference = {
  slide: string;
  classic: string;
  modern: string;
};

const DIFFERENCES: Difference[] = [
  {
    slide: "Slide 1 — Sales Achievement",
    classic: "Full 7-row table (Target / Actual / ACC% / Prior / YoY% / Net Income) plus KPI bullets underneath.",
    modern:  "Four large KPI callouts across the top (Target, Actual, YoY, Net Income), then a 6-row mini table below.",
  },
  {
    slide: "Slide 7 — Sales by ECP",
    classic: "Table with rows per ECP category and a Total row.",
    modern:  "Doughnut chart with a right-aligned category list carrying the same numbers.",
  },
  {
    slide: "Slide 8 — Sales by Region",
    classic: "Table with rows per region and a Total row.",
    modern:  "Same table with an extra growth-callout column (YoY delta highlighted).",
  },
  {
    slide: "Front cover",
    classic: "Light background, HQ logo, month + year in the brand navy.",
    modern:  "Dark navy background, accent-colour vertical block, all-caps month title.",
  },
  {
    slide: "Deck agenda",
    classic: "Bulleted list of the 13 section titles.",
    modern:  "Icon-numbered agenda (01 / 02 / …) with a two-column layout.",
  },
];

export function ModernPreviewNotice() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        role="status"
        className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-[var(--color-warn-200)] bg-[var(--color-warn-50)] px-3 py-2 text-xs text-[var(--color-warn-900)]"
      >
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <AlertCircle size={14} className="text-[var(--color-warn)] mt-0.5 shrink-0" />
          <p>
            <strong>Modern preview shows the shared table layout.</strong>{" "}
            The download adds KPI callouts, a doughnut chart, a growth-callout column,
            a dark cover, and an icon-numbered agenda — those only appear in the PPTX.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
          aria-label="View layout differences between Classic and Modern"
        >
          View layout differences
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        role="dialog"
        tone="warn"
        size="lg"
        icon={<AlertCircle size={22} />}
        title="Classic vs Modern — layout differences"
        subtitle="Numbers and copy are identical in both templates. Only the visual layout of these five slides changes."
        labelledById="modern-diff-title"
        describedById="modern-diff-body"
      >
        <ul className="space-y-4">
          {DIFFERENCES.map(d => (
            <li key={d.slide} className="rounded-lg border border-[var(--color-ice-200)] bg-white overflow-hidden">
              <div className="px-4 py-2 border-b border-[var(--color-ice-200)] bg-[var(--color-ice-50)] font-semibold text-[var(--color-ink-900)]">
                {d.slide}
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-ice-200)]">
                <div className="px-4 py-3">
                  <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-600)] font-semibold mb-1">Classic</dt>
                  <dd className="text-sm text-[var(--color-ink-800)] leading-relaxed">{d.classic}</dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-600)] font-semibold mb-1">Modern</dt>
                  <dd className="text-sm text-[var(--color-ink-800)] leading-relaxed">{d.modern}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        <p className="pt-2 text-[var(--color-ink-600)]">
          The on-screen preview currently renders the Classic layout regardless of template.
          Pick the template you want to download; check the differences above before shipping.
        </p>
      </Modal>
    </>
  );
}
