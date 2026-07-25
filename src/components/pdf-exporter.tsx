"use client";
import { useCallback, useRef, useState } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import type { MonthReport } from "@/lib/schema";
import { SECTION_KEYS } from "@/lib/schema";
import { SlidePreview, type DeckSlide } from "./slide-preview";
import type { SlidePalette } from "@/lib/themes";
import { slugify } from "@/lib/utils";
import { FileText, Loader2 } from "lucide-react";

/**
 * Client-side PDF export.
 *
 * Every slide that the PPTX generator emits also ends up in the PDF:
 *   - Cover (month title + presenter)
 *   - Agenda
 *   - 13 content sections (repeated per selected month for Daily Sales)
 *   - Thank You
 *
 * Each slide is rendered in a visible-but-off-screen 1600×900 stage (not
 * `visibility: hidden` — Recharts' ResizeObserver won't fire on a hidden node,
 * which was causing blank chart pages), captured with `html-to-image`, and
 * stitched into a landscape 13.33×7.5 in PDF via jsPDF.
 */

/**
 * Poll the stage for Recharts readiness. A chart is "ready" when:
 *   - its SVG has layout width (> 0),
 *   - every Line/Bar inside it has drawn a non-empty path or rect.
 * Returns once all charts on the current slide are ready, or the timeout hits.
 */
async function waitForChartsReady(el: HTMLElement | null, timeoutMs: number): Promise<void> {
  if (!el) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const svgs = Array.from(el.querySelectorAll<SVGSVGElement>("svg.recharts-surface"));
    if (svgs.length === 0) return; // this slide has no chart — nothing to wait for
    const allReady = svgs.every(svg => {
      if (svg.clientWidth === 0 || svg.clientHeight === 0) return false;
      const paths = svg.querySelectorAll("path.recharts-curve, path.recharts-line-curve");
      const bars  = svg.querySelectorAll("path.recharts-bar-rectangle, rect.recharts-rectangle");
      const someLineReady = Array.from(paths).some(p => ((p as SVGPathElement).getAttribute("d") ?? "").length > 4);
      const someBarReady  = Array.from(bars).some(p => {
        const el = p as SVGPathElement | SVGRectElement;
        const d = el.getAttribute("d") ?? "";
        const w = (el as SVGRectElement).getAttribute?.("width") ?? "0";
        return d.length > 4 || Number(w) > 0;
      });
      return someLineReady || someBarReady;
    });
    if (allReady) return;
    await new Promise(r => setTimeout(r, 40));
  }
}

function buildDeckSequence(months: MonthReport[]): Array<{ section: DeckSlide; report: MonthReport }> {
  if (months.length === 0) return [];
  const last = months[months.length - 1];
  const out: Array<{ section: DeckSlide; report: MonthReport }> = [];
  out.push({ section: "cover", report: last });
  out.push({ section: "agenda", report: last });
  for (const key of SECTION_KEYS) {
    if (key === "dailySales") {
      for (const m of months) out.push({ section: key, report: m });
    } else {
      out.push({ section: key, report: last });
    }
  }
  out.push({ section: "thankyou", report: last });
  return out;
}

export function PdfExporter({
  months,
  siblings,
  template,
  paletteOverride,
  paletteId,
  label,
}: {
  months: MonthReport[];
  siblings: MonthReport[];
  template: "classic" | "modern";
  paletteOverride: SlidePalette;
  paletteId: string;
  label?: string;
}) {
  const [status, setStatus] = useState<{ phase: "idle" | "rendering" | "done"; step?: number; total?: number; error?: string }>({ phase: "idle" });
  const stageRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState<{ section: DeckSlide; report: MonthReport } | null>(null);

  const download = useCallback(async () => {
    const sequence = buildDeckSequence(months);
    if (sequence.length === 0) return;
    setStatus({ phase: "rendering", step: 0, total: sequence.length });

    // jsPDF units: pt. 13.33 × 7.5 in × 72 dpi = 960 × 540 pt.
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [960, 540], compress: true });

    try {
      for (let i = 0; i < sequence.length; i++) {
        setCurrentSlide(sequence[i]);

        // Multi-step wait to guarantee Recharts has fully painted before html-to-image runs:
        //   1. Two animation frames so React commits + lays out the DOM.
        //   2. Poll every 40 ms for up to 3 s until either (a) no charts are expected on
        //      this slide or (b) all Recharts <svg.recharts-surface> nodes have painted
        //      actual drawn content (non-zero width + populated <path d="M…">/<rect>).
        //   3. 100 ms settle to absorb any last tick animation.
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await waitForChartsReady(stageRef.current, 3000);
        await new Promise(r => setTimeout(r, 100));

        if (!stageRef.current) throw new Error("stage missing");
        const pngUrl = await toPng(stageRef.current, {
          width: 1600, height: 900,
          pixelRatio: 1.25,
          cacheBust: true,
          backgroundColor: "#ffffff",
        });
        if (i > 0) pdf.addPage([960, 540], "landscape");
        pdf.addImage(pngUrl, "PNG", 0, 0, 960, 540, undefined, "FAST");
        setStatus({ phase: "rendering", step: i + 1, total: sequence.length });
      }
      const firstTitle = months[0] ? `${months[0].year}-${String(months[0].month).padStart(2,"0")}` : "report";
      const fname = `Malaysia_Review_${slugify(firstTitle + (label ? "_" + label : ""))}_${template}${paletteId !== "midnight" ? "_" + paletteId : ""}.pdf`;
      pdf.save(fname);
      setStatus({ phase: "done" });
    } catch (err) {
      setStatus({ phase: "idle", error: err instanceof Error ? err.message : "PDF export failed" });
    } finally {
      setCurrentSlide(null);
    }
  }, [months, template, paletteId, label]);

  const progressPct = status.phase === "rendering" && status.total
    ? Math.round(((status.step ?? 0) / status.total) * 100)
    : 0;

  return (
    <>
      <button
        type="button"
        onClick={download}
        disabled={status.phase === "rendering" || months.length === 0}
        className="inline-flex items-center gap-2 rounded-md border border-[var(--color-ink-800)] bg-white dark:bg-[var(--surface-1)] text-[var(--color-ink-800)] px-4 py-2 text-sm font-semibold disabled:opacity-60 hover:bg-[var(--color-ice-100)]"
      >
        {status.phase === "rendering" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
        {status.phase === "rendering" ? `Rendering ${progressPct}%…` : "Download PDF"}
      </button>

      {status.error && (
        <p
          role="alert"
          className="text-sm text-[var(--color-bad-800)] bg-[var(--color-bad-50)] border border-[var(--color-bad-200)] rounded-md px-3 py-2 mt-2"
        >
          {status.error}
        </p>
      )}

      {/* Off-screen stage — must stay laid-out + visible for Recharts' ResizeObserver
          to fire, so we push it way off-screen rather than using `visibility: hidden`. */}
      <div
        aria-hidden
        style={{
          position: "fixed", left: -20000, top: 0, width: 1600, height: 900,
          background: "#ffffff", pointerEvents: "none",
        }}
      >
        <div ref={stageRef} style={{ width: 1600, height: 900, background: "#ffffff", overflow: "hidden" }}>
          {currentSlide && (
            <SlidePreview
              key={`${currentSlide.report.id}-${currentSlide.section}`}
              section={currentSlide.section}
              report={currentSlide.report}
              siblings={siblings}
              controlledTemplate={template}
              controlledPalette={paletteOverride}
              hideChrome
            />
          )}
        </div>
      </div>
    </>
  );
}
