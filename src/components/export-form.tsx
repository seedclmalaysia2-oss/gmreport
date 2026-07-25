"use client";
import { useMemo, useState } from "react";
import { MONTH_NAMES } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, Download, Layers, Sparkles } from "lucide-react";
import { PALETTES, DEFAULT_PALETTE_ID, classicSlidePalette, modernSlidePalette } from "@/lib/themes";
import { SECTION_KEYS, SECTION_META, type MonthReport } from "@/lib/schema";
import { SlidePreview, type DeckSlide } from "./slide-preview";
import { PdfExporter } from "./pdf-exporter";
import { ModernPreviewNotice } from "./modern-preview-notice";

/**
 * Full deck order — cover + agenda open the deck, the 13 section slides
 * carry the content, thankyou closes it. Preview iterates this so Simon
 * can catch a stale presenter name on the cover before HQ sees it.
 * Kept in sync with buildDeckSequence in pdf-exporter.tsx and the
 * server PPTX layouts.
 */
const DECK_KEYS: DeckSlide[] = ["cover", "agenda", ...SECTION_KEYS, "thankyou"];

function labelFor(k: DeckSlide): { no: string; title: string } {
  if (k === "cover")    return { no: "Cover",  title: "Front cover" };
  if (k === "agenda")   return { no: "Agenda", title: "Deck agenda" };
  if (k === "thankyou") return { no: "Close",  title: "Thank you"   };
  return { no: `Slide ${SECTION_META[k].no}`, title: SECTION_META[k].title };
}

export function ExportForm({ allReports }: { allReports: MonthReport[] }) {
  const months = allReports.map(m => ({ id: m.id, year: m.year, month: m.month }));
  const sorted = [...months].sort((a, b) => b.year - a.year || b.month - a.month);
  const [selected, setSelected] = useState<string[]>(sorted[0] ? [sorted[0].id] : []);
  const [template, setTemplate] = useState<"classic" | "modern">("classic");
  const [paletteId, setPaletteId] = useState<string>(DEFAULT_PALETTE_ID);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [previewSection, setPreviewSection] = useState<DeckSlide>("salesAchievement");

  // Preview always uses the last selected month as the "current" — same as PPTX export.
  const previewReport = useMemo<MonthReport | null>(() => {
    if (selected.length === 0) return allReports[0] ?? null;
    const last = [...selected].sort().pop();
    return allReports.find(m => m.id === last) ?? allReports[0] ?? null;
  }, [selected, allReports]);

  const previewPalette = useMemo(() => (
    template === "classic" ? classicSlidePalette(paletteId) : modernSlidePalette(paletteId)
  ), [template, paletteId]);

  const sectionIndex = DECK_KEYS.indexOf(previewSection);
  const goPrevSection = () => setPreviewSection(DECK_KEYS[(sectionIndex - 1 + DECK_KEYS.length) % DECK_KEYS.length]);
  const goNextSection = () => setPreviewSection(DECK_KEYS[(sectionIndex + 1) % DECK_KEYS.length]);

  function toggle(id: string) {
    setErr("");
    if (selected.includes(id)) return setSelected(selected.filter(x => x !== id));
    if (selected.length >= 2) {
      // Replace the oldest (first) selection
      return setSelected([selected[selected.length - 1], id]);
    }
    setSelected([...selected, id]);
  }

  async function download() {
    if (selected.length === 0) { setErr("Select at least one month."); return; }
    setBusy(true); setErr("");
    let url: string | null = null;
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months: selected, template, paletteId }),
      });
      if (!res.ok) {
        // Surface the server's actual message when we can — a 500 with a
        // parse-error body is more useful than "Export failed" to a GM
        // trying to catch what went wrong before HQ's deadline.
        let detail = "";
        try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ }
        setErr(detail ? `Export failed (${res.status}): ${detail}` : `Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const name = /filename="([^"]+)"/.exec(cd)?.[1] || "report.pptx";
      url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    } catch (netErr) {
      // fetch() rejects on network drop, DNS failure, aborted connection
      // mid-response. Previously this left the button spinning forever —
      // Simon on hotel Wi-Fi at 11pm had no way to know the download failed.
      setErr(netErr instanceof Error ? `Network error: ${netErr.message}` : "Network error");
    } finally {
      setBusy(false);
      if (url) URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--color-ice-200)] bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">1. Pick months</h3>
          <span className="text-xs text-[var(--color-ink-600)]">{selected.length} / 2 selected</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {sorted.length === 0 && <p className="text-sm text-[var(--color-ink-600)]">No months yet. Create one or run an import first.</p>}
          {sorted.map(m => {
            const active = selected.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className={[
                  "rounded-lg border px-3 py-2 text-sm text-left",
                  active ? "border-[var(--color-ink-800)] bg-[var(--color-ink-800)] text-white" : "border-[var(--color-ice-200)] hover:border-[var(--color-ink-700)]",
                ].join(" ")}
              >
                <div className="font-semibold">{MONTH_NAMES[m.month - 1]} {m.year}</div>
                <div className={active ? "text-[var(--color-ice-200)] text-[11px]" : "text-[var(--color-ink-600)] text-[11px]"}>{m.id}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-ice-200)] bg-white p-5">
        <h3 className="font-semibold mb-3">2. Pick template</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TemplateCard
            selected={template === "classic"}
            onClick={() => setTemplate("classic")}
            icon={<Layers size={20} />}
            label="Classic — HQ layout"
            desc="Matches the current HQ format position-for-position. Use this for the monthly send-off."
          />
          <TemplateCard
            selected={template === "modern"}
            onClick={() => setTemplate("modern")}
            icon={<Sparkles size={20} />}
            label="Modern — Midnight Executive"
            desc="Navy palette, big KPI callouts, icon-numbered agenda, doughnut ECP chart. Use when you want to impress."
          />
        </div>
      </div>

      {/* 12-palette picker for the PPTX deck itself */}
      <div className="rounded-2xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-semibold">3. Pick deck colour theme</h3>
          <span className="text-[11px] text-[var(--color-ink-600)]">Affects only the PPTX — dashboard chrome unchanged.</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {PALETTES.map(p => {
            const active = p.id === paletteId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaletteId(p.id)}
                className={[
                  "group relative rounded-xl border p-3 text-left transition",
                  active
                    ? "border-[var(--color-ink-800)] ring-2 ring-[var(--color-ink-700)]"
                    : "border-[var(--color-ice-200)] hover:border-[var(--color-ink-700)] hover:ring-1 hover:ring-[var(--color-ice-200)]",
                ].join(" ")}
                title={p.name}
              >
                {/* Mini slide preview: navy header band + body + accent ribbon */}
                <div className="h-16 rounded-lg overflow-hidden ring-1 ring-black/5 flex flex-col">
                  <div style={{ background: p.ink800, height: "36%" }} className="flex items-center px-1.5">
                    <span className="text-white text-[8px] font-bold uppercase tracking-widest opacity-90">Malaysia Review</span>
                  </div>
                  <div style={{ background: "#ffffff", flex: 1 }} className="flex items-stretch">
                    <div style={{ background: p.ice100, width: "22%" }} />
                    <div style={{ background: p.ice50, flex: 1 }} className="flex items-end px-1 pb-0.5">
                      <span className="h-1 w-2/3 rounded-sm" style={{ background: p.accent }} />
                    </div>
                    <div style={{ background: p.ice200, width: "16%" }} />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-[12px] font-semibold leading-tight truncate">{p.name}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-ink-600)] truncate">{p.mood}</div>
                </div>
                {active && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[var(--color-ink-800)] text-white grid place-items-center ring-2 ring-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Live deck preview — reflects the template + palette chosen above */}
      <div className="rounded-2xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] p-5">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold">4. Review before download</h3>
          <span className="text-[11px] text-[var(--color-ink-600)]">
            Live — updates with template &amp; theme. Slide {sectionIndex + 1} of {DECK_KEYS.length}.
          </span>
        </div>

        {/* Slide navigator */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button
            type="button"
            onClick={goPrevSection}
            className="rounded-md p-1.5 border border-[var(--color-ice-200)] hover:bg-[var(--color-ice-100)] text-[var(--color-ink-800)]"
            title="Previous slide"
          >
            <ChevronLeft size={16} />
          </button>
          <select
            value={previewSection}
            onChange={e => setPreviewSection(e.target.value as DeckSlide)}
            className="rounded-md border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] px-2 py-1.5 text-sm min-w-[260px]"
          >
            {DECK_KEYS.map(k => {
              const l = labelFor(k);
              return <option key={k} value={k}>{l.no} · {l.title}</option>;
            })}
          </select>
          <button
            type="button"
            onClick={goNextSection}
            className="rounded-md p-1.5 border border-[var(--color-ice-200)] hover:bg-[var(--color-ice-100)] text-[var(--color-ink-800)]"
            title="Next slide"
          >
            <ChevronRight size={16} />
          </button>
          <span className="ml-auto text-xs text-[var(--color-ink-600)] inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full ring-1 ring-black/10" style={{ background: previewPalette.header }} />
            <span className="inline-block w-3 h-3 rounded-full ring-1 ring-black/10" style={{ background: previewPalette.rowAlt }} />
            <span className="inline-block w-3 h-3 rounded-full ring-1 ring-black/10" style={{ background: previewPalette.border }} />
            {PALETTES.find(p => p.id === paletteId)?.name} · {template === "classic" ? "Classic" : "Modern"}
          </span>
        </div>

        {/* Honesty banner — Modern preview currently renders the shared table
            layout, not the KPI-callout / doughnut / dark-cover variants the
            Modern PPTX ships. Simon shouldn't sign off a preview that
            doesn't match what HQ opens. Only visible when Modern is chosen. */}
        {template === "modern" && (
          <div className="mb-3">
            <ModernPreviewNotice />
          </div>
        )}

        {/* Preview */}
        {previewReport ? (
          <SlidePreview
            section={previewSection}
            report={previewReport}
            siblings={allReports}
            controlledTemplate={template}
            controlledPalette={previewPalette}
            hideChrome
          />
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--color-ice-200)] p-8 text-center text-sm text-[var(--color-ink-600)]">
            Select at least one month above to see a preview.
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        {err && (
          <p
            role="alert"
            className="text-sm text-[var(--color-bad-800)] bg-[var(--color-bad-50)] border border-[var(--color-bad-200)] rounded-md px-3 py-2 mr-auto max-w-full break-words"
          >
            {err}
          </p>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {/* Client-side PDF — renders all slides with the picked template+palette then stitches with jsPDF. */}
          <PdfExporter
            months={selected
              .map(id => allReports.find(m => m.id === id)!)
              .filter(Boolean)
              .sort((a, b) => a.year - b.year || a.month - b.month)}
            siblings={allReports}
            template={template}
            paletteOverride={previewPalette}
            paletteId={paletteId}
          />
          <button
            disabled={busy || selected.length === 0}
            onClick={download}
            className="rounded-md bg-[var(--color-ink-800)] text-white px-4 py-2 text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-2"
          >
            <Download size={15} />
            {busy ? "Generating…" : "Download PPTX"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({ selected, onClick, icon, label, desc }: {
  selected: boolean; onClick: () => void;
  icon: React.ReactNode; label: string; desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-xl border p-4 text-left",
        selected ? "border-[var(--color-ink-800)] ring-2 ring-[var(--color-ink-700)]" : "border-[var(--color-ice-200)] hover:border-[var(--color-ink-700)]",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 font-semibold">{icon} {label}</div>
      <p className="text-xs text-[var(--color-ink-600)] mt-1">{desc}</p>
    </button>
  );
}
