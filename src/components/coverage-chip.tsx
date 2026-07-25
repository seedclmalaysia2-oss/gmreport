"use client";

import { Check, CircleDot, CircleDashed } from "lucide-react";
import { SECTION_META, type SectionKey } from "@/lib/schema";
import type { MonthCoverage } from "@/lib/coverage";

/**
 * Two chips summarising a MonthBlock's slide coverage:
 *
 *   InputChip  — filled status pill "N/8 inputs ready" / "N/8 inputs" /
 *                "No files yet". Clickable when partial to reveal the
 *                "Waiting for a file" strip below the header. Uses the
 *                semantic ok/warn/ice tokens so the palette picker retunes
 *                correctly.
 *   ManualChip — read-only neutral pill "Manual: 2 · 3 · 9 · 12 · 13"
 *                explaining which slides are always entered by hand.
 */
export function CoverageChips({
  coverage,
  revealActive,
  onToggleReveal,
  hasFiles,
}: {
  coverage: MonthCoverage;
  revealActive: boolean;
  onToggleReveal: () => void;
  hasFiles: boolean;
}) {
  const coveredCount = coverage.coveredInputs.size;
  const total = coverage.totalInputs;
  const isFull = coveredCount === total;
  const isEmpty = !hasFiles;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <InputChip
        coveredCount={coveredCount}
        total={total}
        isFull={isFull}
        isEmpty={isEmpty}
        revealActive={revealActive}
        onToggleReveal={onToggleReveal}
      />
      <ManualChip manualSlides={coverage.manualSlides} />
    </div>
  );
}

function InputChip({
  coveredCount,
  total,
  isFull,
  isEmpty,
  revealActive,
  onToggleReveal,
}: {
  coveredCount: number;
  total: number;
  isFull: boolean;
  isEmpty: boolean;
  revealActive: boolean;
  onToggleReveal: () => void;
}) {
  // Compose the chip class based on state — ok when complete, warn when
  // partial (and clickable to filter), neutral outline when empty.
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold";

  if (isEmpty) {
    return (
      <span
        className={`${base} bg-white border border-[var(--color-ice-200)] text-[var(--color-ink-600)]`}
        title="No files uploaded yet — nothing to cover"
      >
        <CircleDashed size={11} />
        No files yet
      </span>
    );
  }

  if (isFull) {
    return (
      <span
        className={`${base} bg-[var(--color-ok-100)] text-[var(--color-ok-800)]`}
        title={`All ${total} file-fed slides are covered by an upload`}
      >
        <Check size={11} />
        <span className="tabular-nums">{total}/{total}</span> inputs ready
      </span>
    );
  }

  // Partial — clickable button that reveals the "Waiting for a file" strip
  // under the header. The strip is where the actionable content lives; the
  // chip is the affordance.
  return (
    <button
      type="button"
      onClick={onToggleReveal}
      aria-pressed={revealActive}
      title={
        revealActive
          ? "Hide the list of slides waiting for a file"
          : `${total - coveredCount} slide(s) still waiting for a file — click to see which`
      }
      className={`${base} bg-[var(--color-warn-100)] text-[var(--color-warn-800)] hover:bg-[var(--color-warn-200)] active:scale-95 transition ${revealActive ? "ring-2 ring-[var(--color-warn-800)]/40" : ""}`}
    >
      <CircleDot size={11} />
      <span className="tabular-nums">{coveredCount}/{total}</span> inputs
    </button>
  );
}

function ManualChip({ manualSlides }: { manualSlides: readonly SectionKey[] }) {
  // Sort by slide number so the pill reads "2 · 3 · 9 · 12 · 13", not by
  // schema key order.
  const nums = manualSlides
    .map(k => SECTION_META[k].no)
    .sort((a, b) => a - b);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-white border border-[var(--color-ice-200)] px-2 py-0.5 text-[11px] text-[var(--color-ink-700)]"
      title={`Slides ${nums.join(", ")} are entered directly in the report editor, not from a POS file`}
    >
      <span className="text-[var(--color-ink-600)]">Manual:</span>
      <span className="tabular-nums">{nums.join(" · ")}</span>
    </span>
  );
}

/**
 * Inline chip strip listing the slide numbers still waiting for a file.
 * Rendered only while the filter is active, so Simon can jump straight to
 * the target slide in the report editor if he wants to see what's needed.
 */
export function UncoveredSlideList({
  monthReportId,
  uncoveredInputs,
}: {
  monthReportId: string;
  uncoveredInputs: SectionKey[];
}) {
  if (uncoveredInputs.length === 0) return null;
  return (
    <div
      role="list"
      aria-label="Slides waiting for a file"
      className="flex flex-wrap items-center gap-1.5 text-[11px]"
    >
      <span className="text-[var(--color-ink-600)]">Waiting for a file:</span>
      {uncoveredInputs.map(k => {
        const meta = SECTION_META[k];
        return (
          <a
            key={k}
            role="listitem"
            href={`/report/${monthReportId}?section=${k}`}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warn-50)] border border-[var(--color-warn-200)] px-2 py-0.5 text-[var(--color-warn-800)] hover:bg-[var(--color-warn-100)] transition"
            title={`Slide ${meta.no} — ${meta.title}`}
          >
            <span className="tabular-nums font-semibold">{meta.no}</span>
            <span className="text-[var(--color-warn-800)]/80">{meta.title}</span>
          </a>
        );
      })}
    </div>
  );
}
