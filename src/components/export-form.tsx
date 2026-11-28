"use client";
import { useEffect, useMemo, useState } from "react";
import { MONTH_NAMES } from "@/lib/utils";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Download, Layers, Sparkles } from "lucide-react";
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

type Template = "classic" | "modern";

// Persisted across sessions — Simon exports every month, and the template +
// palette are decisions he makes once and leaves. Months aren't remembered
// (the live set changes, and the newest is auto-selected anyway).
const LS_TEMPLATE = "gm-export-template";
const LS_PALETTE = "gm-export-palette";
const LS_SHOW_THEME = "gm-export-show-theme";

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
  const [template, setTemplate] = useState<Template>("classic");
  const [paletteId, setPaletteId] = useState<string>(DEFAULT_PALETTE_ID);
  const [showTheme, setShowTheme] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [previewSection, setPreviewSection] = useState<DeckSlide>("salesAchievement");

  // Rehydrate last-used template + palette on mount. Simon picks these once
  // then exports every cycle — forcing him to re-pick defaults each time is
  // the "wizard for an expert operator" pattern the critique flagged.
  useEffect(() => {
    try {
      const t = localStorage.getItem(LS_TEMPLATE);
      if (t === "classic" || t === "modern") setTemplate(t);
      const p = localStorage.getItem(LS_PALETTE);
      if (p && PALETTES.some(x => x.id === p)) setPaletteId(p);
      const s = localStorage.getItem(LS_SHOW_THEME);
      if (s === "1") setShowTheme(true);
    } catch { /* localStorage unavailable */ }
  }, []);

  useEffect(() => { try { localStorage.setItem(LS_TEMPLATE, template); } catch { /* ignore */ } }, [template]);
  useEffect(() => { try { localStorage.setItem(LS_PALETTE, paletteId); } catch { /* ignore */ } }, [paletteId]);
  useEffect(() => { try { localStorage.setItem(LS_SHOW_THEME, showTheme ? "1" : "0"); } catch { /* ignore */ } }, [showTheme]);

  // Preview always uses the last selected month as the "current" — same as PPTX export.
  const previewReport = useMemo<MonthReport | null>(() => {
    if (selected.length === 0) return allReports[0] ?? null;
    const last = [...selected].sort().pop();
    return allReports.find(m => m.id === last) ?? allReports[0] ?? null;
  }, [selected, allReports]);

  const previewPalette = useMemo(() => (
    template === "classic" ? classicSlidePalette(paletteId) : modernSlidePalette(paletteId)
  ), [template, paletteId]);

  const activePalette = PALETTES.find(p => p.id === paletteId) ?? PALETTES[0];

  const sectionIndex = DECK_KEYS.indexOf(previewSection);
  const goPrevSection = () => setPreviewSection(DECK_KEYS[(sectionIndex - 1 + DECK_KEYS.length) % DECK_KEYS.length]);
  const goNextSection = () => setPreviewSection(DECK_KEYS[(sectionIndex + 1) % DECK_KEYS.length]);

  function toggle(id: string) {
    setErr("");
    if (selected.includes(id)) return setSelected(selected.filter(x => x !== id));
    if (selected.length >= 2) {
      // Replace the oldest (first) selection — kept here for parity with the
      // server's 2-month export cap; a swap toast would help (critique P2).
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

  const sortedSelected = selected
    .map(id => allReports.find(m => m.id === id)!)
    .filter(Boolean)
    .sort((a, b) => a.year - b.year || a.month - b.month);

  return (
    <div className="space-y-5 md:pb-28">
      <section className="rounded-2xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] p-5">
        <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
          <h3 className="font-semibold">Months</h3>
          <span className="text-[11px] text-[var(--color-ink-600)] tabular-nums">{selected.length} of 2 selected</span>
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
                  "rounded-md border px-3 py-2 text-sm text-left transition",
                  active ? "border-[var(--color-ink-800)] bg-[var(--color-ink-800)] text-white" : "border-[var(--color-ice-200)] hover:border-[var(--color-ink-700)]",
                ].join(" ")}
              >
                <div className="font-semibold">{MONTH_NAMES[m.month - 1]} {m.year}</div>
                <div className={active ? "text-[var(--color-ice-200)] text-[11px] tabular-nums" : "text-[var(--color-ink-600)] text-[11px] tabular-nums"}>{m.id}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] p-5">
        <h3 className="font-semibold mb-3">Template</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TemplateCard
            selected={template === "classic"}
            onClick={() => setTemplate("classic")}
            icon={<Layers size={18} />}
            label="Classic — HQ layout"
            desc="Matches the current HQ format position-for-position. Use this for the monthly send-off."
          />
          <TemplateCard
            selected={template === "modern"}
            onClick={() => setTemplate("modern")}
            icon={<Sparkles size={18} />}
            label="Modern — Midnight Executive"
            desc="Navy palette, big KPI callouts, icon-numbered agenda, doughnut ECP chart. Use when you want to impress."
          />
        </div>
      </section>

      {/* Deck colour theme — collapsed by default. Simon picks a palette
          once then ships; opening the full 12-swatch grid every cycle is
          decision fatigue the critique flagged. */}
      <section className="rounded-2xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)]">
        <button
          type="button"
          onClick={() => setShowTheme(v => !v)}
          aria-expanded={showTheme}
          aria-controls="deck-theme-panel"
          className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-[var(--color-ice-50)] rounded-2xl transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex h-7 rounded-md overflow-hidden ring-1 ring-black/5 flex-none" aria-hidden="true">
              <span className="w-5" style={{ background: activePalette.ink800 }} />
              <span className="w-3" style={{ background: activePalette.ink700 }} />
              <span className="w-3" style={{ background: activePalette.ice200 }} />
              <span className="w-3" style={{ background: activePalette.accent }} />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold leading-tight truncate">
                Deck colour theme
                <span className="ml-2 font-normal text-sm text-[var(--color-ink-600)]">{activePalette.name}</span>
              </h3>
              <p className="text-[11px] text-[var(--color-ink-600)] mt-0.5">
                Applies to the PPTX only. Dashboard chrome lives on Settings.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-ink-800)]">
            {showTheme ? "Hide" : "Customize"}
            <ChevronDown size={14} className={["transition-transform", showTheme ? "rotate-180" : ""].join(" ")} aria-hidden="true" />
          </span>
        </button>
        {showTheme && (
          <div id="deck-theme-panel" className="px-5 pb-5">
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
                    <div className="h-16 rounded-lg overflow-hidden ring-1 ring-black/5 flex flex-col">
                      <div style={{ background: p.ink800, height: "36%" }} className="flex items-center px-1.5">
                        <span className="text-white text-[11px] font-bold uppercase tracking-[0.15em] opacity-90">Malaysia Review</span>
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
                      <div className="text-xs font-semibold leading-tight truncate">{p.name}</div>
                      <div className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-ink-600)] truncate">{p.mood}</div>
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
        )}
      </section>

      <section className="rounded-2xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] p-5">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold">Review before download</h3>
          <span className="text-[11px] text-[var(--color-ink-600)] tabular-nums">
            Live — updates with template and theme. Slide {sectionIndex + 1} of {DECK_KEYS.length}.
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button
            type="button"
            onClick={goPrevSection}
            className="rounded-md p-1.5 border border-[var(--color-ice-200)] hover:bg-[var(--color-ice-100)] text-[var(--color-ink-800)]"
            title="Previous slide"
            aria-label="Previous slide"
          >
            <ChevronLeft size={16} />
          </button>
          <select
            value={previewSection}
            onChange={e => setPreviewSection(e.target.value as DeckSlide)}
            className="rounded-md border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] px-2 py-1.5 text-sm min-w-[260px]"
            aria-label="Preview slide"
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
            aria-label="Next slide"
          >
            <ChevronRight size={16} />
          </button>
          <span className="ml-auto text-xs text-[var(--color-ink-600)] inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full ring-1 ring-black/10" style={{ background: previewPalette.header }} />
            <span className="inline-block w-3 h-3 rounded-full ring-1 ring-black/10" style={{ background: previewPalette.rowAlt }} />
            <span className="inline-block w-3 h-3 rounded-full ring-1 ring-black/10" style={{ background: previewPalette.border }} />
            {activePalette.name} · {template === "classic" ? "Classic" : "Modern"}
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
      </section>

      {/* Generate bar — pinned floating on desktop so the download actions
          follow Simon down the scroll; inline on mobile (the MobileTabBar
          already owns the bottom edge there, and the user scrolls to the end
          to tap anyway). */}
      <div
        className="rounded-2xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)]
                   md:fixed md:bottom-4 md:right-4 md:z-30 md:bg-[var(--surface-1)]/95
                   md:backdrop-blur md:shadow-lg"
        role="region"
        aria-label="Export actions"
      >
        <div className="px-4 py-3 flex items-center gap-3 flex-wrap justify-end">
          {err && (
            <p
              role="alert"
              className="text-sm text-[var(--color-bad-800)] bg-[var(--color-bad-50)] border border-[var(--color-bad-200)] rounded-md px-3 py-2 mr-auto max-w-full break-words"
            >
              {err}
            </p>
          )}
          <PdfExporter
            months={sortedSelected}
            siblings={allReports}
            template={template}
            paletteOverride={previewPalette}
            paletteId={paletteId}
          />
          <button
            disabled={busy || selected.length === 0}
            onClick={download}
            className="rounded-md bg-[var(--color-ink-800)] text-white px-4 py-2 text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-2 hover:bg-[var(--color-ink-700)] transition-colors"
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
        "rounded-xl border p-4 text-left transition",
        selected ? "border-[var(--color-ink-800)] ring-2 ring-[var(--color-ink-700)]" : "border-[var(--color-ice-200)] hover:border-[var(--color-ink-700)]",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 font-semibold">{icon} {label}</div>
      <p className="text-xs text-[var(--color-ink-600)] mt-1">{desc}</p>
    </button>
  );
}
