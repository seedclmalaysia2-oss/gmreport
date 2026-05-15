"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import type { MonthReport, SectionKey } from "@/lib/schema";
import { SECTION_KEYS, SECTION_META } from "@/lib/schema";
import type { RawFileEntry } from "@/lib/month-report";
import { SectionShellContext } from "./sections/shared";
import { SectionSalesAchievement } from "./sections/sales-achievement";
import { SectionOutlook } from "./sections/outlook";
import { SectionDailySales } from "./sections/daily-sales";
import { SectionSalesByQuantity } from "./sections/sales-by-quantity";
import { SectionTopProducts } from "./sections/top-products";
import { SectionSalesByECP } from "./sections/sales-by-ecp";
import { SectionSalesByRegion } from "./sections/sales-by-region";
import { SectionProductRegistration } from "./sections/product-registration";
import { SectionInventory } from "./sections/inventory";
import { SectionExpireWriteOff } from "./sections/expire-writeoff";
import { SectionFinancial } from "./sections/financial";
import { SectionOtherMarket } from "./sections/other-market";
import { SectionSalesTrend } from "./sections/sales-trend";
import { monthNameFull } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Download, FileUp, Info, Layers, Loader2, RefreshCw, X } from "lucide-react";
import { SlidePreview } from "./slide-preview";

export function ReportEditor({
  initial, isNew = false, siblings = [], monthFiles = [],
}: {
  initial: MonthReport;
  isNew?: boolean;
  siblings?: MonthReport[];
  /** This month's live RawFile rows (active only). Drives the section
   *  source chips — upload / view / delete / multi-select — so they
   *  always reflect the real upload state, not stale sourceFiles JSON. */
  monthFiles?: RawFileEntry[];
}) {
  const [report, setReport] = useState<MonthReport>(initial);
  const sp = useSearchParams();
  // Honour `?section=` when the user arrives from the import page so they land
  // on the exact tab they came from.
  const initialSection = ((): SectionKey => {
    const q = sp?.get("section") as SectionKey | null;
    return q && (SECTION_KEYS as readonly string[]).includes(q) ? q : "salesAchievement";
  })();
  const [active, setActive] = useState<SectionKey>(initialSection);
  // Keep the tab in sync if the URL changes later (e.g. next-link navigation).
  useEffect(() => {
    const q = sp?.get("section") as SectionKey | null;
    if (q && (SECTION_KEYS as readonly string[]).includes(q)) setActive(q);
  }, [sp]);
  const [saving, startSaving] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showNewBanner, setShowNewBanner] = useState(isNew);
  const [recalcState, setRecalcState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback((patch: Partial<MonthReport>) => {
    setReport(prev => {
      const next = { ...prev, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        startSaving(async () => {
          const res = await fetch(`/api/months/${next.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          });
          if (res.ok) setSavedAt(new Date());
        });
      }, 500);
      return next;
    });
  }, []);

  const onRecalculate = useCallback(async () => {
    // Flush any pending auto-save so the server sees the latest edits before recomputing.
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    setRecalcState("running");
    setRecalcMessage(null);
    try {
      const putRes = await fetch(`/api/months/${report.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!putRes.ok) throw new Error("Failed to save pending edits before recalculating");

      const res = await fetch(`/api/months/repair`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Recalculate failed (${res.status})`);

      const fresh = await fetch(`/api/months/${report.id}`).then(r => r.ok ? r.json() : null);
      if (fresh) setReport(fresh);

      const changed = typeof data.monthsChanged === "number" ? data.monthsChanged : 0;
      const checked = typeof data.monthsChecked === "number" ? data.monthsChecked : 0;
      const deduped = typeof data.filesDeduped === "number" ? data.filesDeduped : 0;
      const monthsMsg = changed === 0
        ? `All ${checked} months in sync.`
        : `Updated ${changed} of ${checked} month${checked === 1 ? "" : "s"}.`;
      const dedupMsg = deduped > 0
        ? ` ${deduped} duplicate/unused file${deduped === 1 ? "" : "s"} moved to Recently deleted.`
        : "";
      setRecalcMessage(monthsMsg + dedupMsg);
      setRecalcState("done");
      setSavedAt(new Date());
      setTimeout(() => setRecalcState(s => (s === "done" ? "idle" : s)), 4000);
    } catch (err) {
      setRecalcMessage(err instanceof Error ? err.message : "Recalculate failed");
      setRecalcState("error");
    }
  }, [report]);

  const progress = useMemo(() =>
    SECTION_KEYS.reduce((acc, k) => {
      acc[k] = Boolean(report[k]);
      return acc;
    }, {} as Record<SectionKey, boolean>),
  [report]);

  const missingCount = SECTION_KEYS.filter(k => !progress[k]).length;
  // Mobile: sidebar collapses into a slide-over drawer; desktop: stays sticky.
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Close the drawer when the active section changes (so tapping a slide returns to content).
  const closeDrawer = () => setDrawerOpen(false);
  const activeMeta = SECTION_META[active];

  return (
    <div className="md:grid md:grid-cols-[240px_1fr] md:gap-6">
      {/* Mobile-only top bar: section title + chevron to open the drawer */}
      <div className="md:hidden mb-3 flex items-center gap-2 rounded-xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] p-2">
        <Link href="/" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-ink-600)] hover:bg-[var(--color-ice-100)]" title="Back to months">
          <ArrowLeft size={16} />
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex-1 inline-flex items-center justify-between gap-2 rounded-lg bg-[var(--color-ice-50)] px-3 h-9 text-sm font-semibold text-[var(--color-ink-900)]"
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Layers size={14} className="text-[var(--color-ink-700)]" />
            <span className="opacity-70">{activeMeta.no}.</span>
            <span className="truncate">{activeMeta.title}</span>
          </span>
          <ChevronRight size={14} className="shrink-0 text-[var(--color-ink-600)]" />
        </button>
      </div>

      {/* Drawer scrim — phones only, taps close */}
      {drawerOpen && (
        <div
          aria-hidden
          onClick={closeDrawer}
          className="md:hidden fixed inset-0 z-40 bg-black/40 animate-fadein"
        />
      )}

      {/* Sidebar:
          - phones (default): off-canvas drawer; toggled by `drawerOpen`
          - desktop (md+): static sticky column */}
      <aside
        className={[
          "space-y-4 self-start",
          // Mobile drawer
          "md:relative md:translate-x-0 md:w-auto md:bg-transparent md:p-0 md:shadow-none md:border-0 md:overflow-visible",
          drawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // z-50 lifts the off-canvas drawer above the scrim on phones. On
          // desktop it MUST drop back to auto — otherwise this sticky sidebar
          // outranks the site header (z-40) and paints over the header's
          // dropdown menus (the "Months" popover overlap bug).
          "fixed left-0 top-0 z-50 md:z-auto h-full w-[88vw] max-w-[320px] overflow-y-auto",
          "bg-[var(--surface-1)] border-r border-[var(--color-ice-200)] shadow-xl",
          "p-3 transition-transform duration-200",
          // Desktop sticky behaviour
          "md:sticky md:top-24",
        ].join(" ")}
      >
        {/* Drawer close button (mobile only) */}
        <button
          type="button"
          onClick={closeDrawer}
          className="md:hidden absolute top-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-ink-600)] hover:bg-[var(--color-ice-100)]"
          aria-label="Close sections drawer"
        >
          <X size={18} />
        </button>
        <Link href="/" className="hidden md:inline-flex items-center gap-1 text-sm text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)]">
          <ArrowLeft size={14} /> Back to months
        </Link>

        {showNewBanner && (
          <div className="rounded-xl border border-[var(--color-ink-700)] bg-[var(--color-ice-100)] dark:bg-[var(--color-ink-900)] p-3 text-sm relative animate-fadein">
            <button
              onClick={() => setShowNewBanner(false)}
              aria-label="Dismiss"
              className="absolute top-2 right-2 text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)]"
            ><X size={13} /></button>
            <div className="flex items-start gap-2">
              <Info size={14} className="text-[var(--color-ink-800)] mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-[var(--color-ink-900)]">New month ready</p>
                <p className="text-[var(--color-ink-600)] mt-1">
                  Prior-month targets, 2025 actuals, product-registration rows, and inventory shape were carried forward.
                </p>
                <Link href="/files" className="mt-2 inline-flex items-center gap-1 text-[var(--color-ink-800)] font-semibold hover:underline">
                  <FileUp size={12} /> Upload POS raw files
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[var(--color-ice-200)] bg-white p-3">
          <div className="text-xs text-[var(--color-ink-600)] uppercase tracking-widest">Editing</div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold leading-tight mt-1">{monthNameFull(report.month)} {report.year}</h1>
          <div className="mt-2 text-xs text-[var(--color-ink-600)]">
            FX: 1 MYR ={" "}
            <input
              type="number" step="0.01"
              value={report.fxRate}
              onChange={e => update({ fxRate: Number(e.target.value) || 30.73 })}
              className="w-16 rounded border border-[var(--color-ice-200)] px-1.5 py-0.5 text-right"
            /> JPY
          </div>
          <button
            type="button"
            onClick={onRecalculate}
            disabled={recalcState === "running"}
            title="Re-derive ECP %, inventory totals, region growth%, and re-align product rows across all months"
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-ice-200)] bg-white hover:bg-[var(--color-ice-100)] px-2 py-1.5 text-xs font-semibold text-[var(--color-ink-800)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {recalcState === "running" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {recalcState === "running" ? "Recalculating…" : "Recalculate"}
          </button>
          {recalcMessage && (
            <p className={"mt-2 text-[11px] " + (recalcState === "error" ? "text-red-600" : "text-[var(--color-ink-600)]")}>
              {recalcMessage}
            </p>
          )}
        </div>
        <nav className="rounded-2xl border border-[var(--color-ice-200)] bg-white p-2 space-y-1">
          <div className="px-2 pt-1 pb-2 text-[11px] uppercase tracking-widest text-[var(--color-ink-600)] flex items-center justify-between">
            <span>Sections</span>
            {missingCount > 0 && (
              <span className="text-amber-700 dark:text-amber-400 font-semibold normal-case tracking-normal">
                {missingCount} missing
              </span>
            )}
          </div>
          {SECTION_KEYS.map(k => {
            const m = SECTION_META[k];
            const done = progress[k];
            return (
              <button
                key={k}
                onClick={() => { setActive(k); closeDrawer(); }}
                className={[
                  // Bigger tap target on mobile (44px), tighter on desktop.
                  "w-full flex items-center gap-2 rounded-lg px-2 py-2 md:py-1.5 text-left text-sm",
                  active === k ? "bg-[var(--color-ink-800)] text-white" : "hover:bg-[var(--color-ice-100)] text-[var(--color-ink-900)]",
                ].join(" ")}
              >
                <span
                  title={done ? "Has data" : "Empty — needs data"}
                  className={[
                    "h-2 w-2 rounded-full shrink-0",
                    done ? "bg-[var(--color-ok)]" : "bg-amber-400",
                  ].join(" ")}
                />
                <span className="text-xs opacity-70 w-5">{m.no}.</span>
                <span className="truncate">{m.title}</span>
              </button>
            );
          })}
        </nav>
        <Link href={`/export?month=${report.id}`} className="block w-full text-center rounded-lg bg-[var(--color-ink-800)] text-white px-3 py-2 text-sm font-semibold hover:bg-[var(--color-ink-700)]">
          <Download size={14} className="inline mr-1 -mt-1" /> Export PPTX
        </Link>
        <div className="text-[11px] text-[var(--color-ink-600)] text-right">
          {saving ? "Saving…" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "All changes auto-save"}
        </div>
      </aside>

      {/* Main pane — wrapped in the section-shell context so every SectionShell
          can access the current month + per-section source files. */}
      <SectionShellContext.Provider value={{
        reportId: report.id, year: report.year, month: report.month,
        sourceFiles: report.sourceFiles ?? {},
        monthFiles,
      }}>
        <section className="min-w-0">
          {active === "salesAchievement" && <SectionSalesAchievement report={report} update={update} />}
          {active === "salesTrend"       && <SectionSalesTrend report={report} update={update} />}
          {active === "marketOutlook"    && <SectionOutlook report={report} update={update} />}
          {active === "dailySales"       && <SectionDailySales report={report} update={update} />}
          {active === "salesByQuantity"  && <SectionSalesByQuantity report={report} update={update} siblings={siblings} />}
          {active === "topProducts"      && <SectionTopProducts report={report} update={update} />}
          {active === "salesByECP"       && <SectionSalesByECP report={report} update={update} />}
          {active === "salesByRegion"    && <SectionSalesByRegion report={report} update={update} />}
          {active === "productRegistration" && <SectionProductRegistration report={report} update={update} />}
          {active === "inventory"        && <SectionInventory report={report} update={update} />}
          {active === "expireWriteOff"   && <SectionExpireWriteOff report={report} update={update} siblings={siblings} />}
          {active === "financial"        && <SectionFinancial report={report} update={update} />}
          {active === "otherMarket"      && <SectionOtherMarket report={report} update={update} />}

          <SlidePreview section={active} report={report} siblings={siblings} />
        </section>
      </SectionShellContext.Provider>
    </div>
  );
}

export type SectionProps = {
  report: MonthReport;
  update: (patch: Partial<MonthReport>) => void;
  /** All months on file, most-recent first. Sections can reach into prior months for comparisons. */
  siblings?: MonthReport[];
};
