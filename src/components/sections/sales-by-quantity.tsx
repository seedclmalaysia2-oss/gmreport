"use client";
import type { SectionProps } from "../report-editor";
import { NumberCell, SectionShell } from "./shared";
import { RichTextEditor } from "../rich-text-editor";
import { CANONICAL_PRODUCTS } from "@/lib/catalog/products";
import { MONTH_NAMES, cn } from "@/lib/utils";
import type { MonthReport, SalesByQuantity as SQQ } from "@/lib/schema";

/**
 * Slide 7 — Sales Quantity.
 * Layout mirrors the HQ PPTX:
 *   ┌─────────────────┬──── 2026 ──────┬──── 2025 ─────┬ Total 2026  ┐
 *   │ Product          │ PREV │ CURR   │ PREV │ CURR   │ YTD Jan..N  │
 *   │                  │      │ (hl)   │      │        │             │
 *
 * - Current-month 2026 column is tinted (green-ish highlight).
 * - Top-4 contributors (by MYR) are rendered in red.
 * - YTD column sums all 2026 months on file so far.
 */
export function SectionSalesByQuantity({ report, update, siblings = [] }: SectionProps) {
  const qtyRows = report.salesByQuantity?.rows
    ?? CANONICAL_PRODUCTS.map(p => ({ product: p, qty2026: 0, qty2025: 0 }));

  const commentary = report.salesByQuantity?.commentary ?? "";
  const setRows = (next: typeof qtyRows) => update({ salesByQuantity: { rows: next, commentary } });
  const setCommentary = (html: string) => update({ salesByQuantity: { rows: qtyRows, commentary: html } });

  // Prior month lookup (same year, month - 1) — provides the "FEB" column when viewing March.
  const prevMonth = report.month === 1 ? 12 : report.month - 1;
  const prevYear = report.month === 1 ? report.year - 1 : report.year;
  const priorReport = siblings.find(m => m.year === prevYear && m.month === prevMonth);
  const priorRowsMap = new Map(
    (priorReport?.salesByQuantity?.rows ?? []).map(r => [r.product, r]),
  );

  // YTD 2026 totals — sum every earlier 2026 month on file including this one.
  const ytdMap = new Map<string, number>();
  const ytdMonths = siblings.filter(m => m.year === report.year && m.month <= report.month);
  for (const m of ytdMonths) {
    if (m.id === report.id) {
      for (const r of qtyRows) ytdMap.set(r.product, (ytdMap.get(r.product) ?? 0) + r.qty2026);
    } else {
      for (const r of m.salesByQuantity?.rows ?? []) {
        ytdMap.set(r.product, (ytdMap.get(r.product) ?? 0) + r.qty2026);
      }
    }
  }

  // Top-4 contributors by MYR → red product label, matching the HQ deck's visual accent.
  const topSet = new Set(
    (report.topProducts?.rows ?? []).slice(0, 4).map(r => r.product.toLowerCase()),
  );
  const isHighlighted = (p: string) => topSet.has(p.toLowerCase());

  const prevShort = MONTH_NAMES[prevMonth - 1];
  const currShort = MONTH_NAMES[report.month - 1];

  const allRows = qtyRows.map(r => {
    const prior = priorRowsMap.get(r.product);
    return {
      product: r.product,
      prev2026: prior?.qty2026 ?? 0,
      prev2025: prior?.qty2025 ?? 0,
      curr2026: r.qty2026,
      curr2025: r.qty2025,
      ytd: ytdMap.get(r.product) ?? 0,
    };
  });

  const totals = allRows.reduce(
    (acc, r) => {
      acc.prev2026 += r.prev2026;
      acc.prev2025 += r.prev2025;
      acc.curr2026 += r.curr2026;
      acc.curr2025 += r.curr2025;
      acc.ytd += r.ytd;
      return acc;
    },
    { prev2026: 0, prev2025: 0, curr2026: 0, curr2025: 0, ytd: 0 },
  );

  const setCurr = (product: string, field: "qty2026" | "qty2025", n: number | null) => {
    const next = qtyRows.map(r => r.product === product ? { ...r, [field]: n ?? 0 } : r);
    setRows(next);
  };

  return (
    <SectionShell
      sectionKey="salesByQuantity"
      subtitle={`Slide 7 — per-product quantity for ${currShort} ${report.year}. Current-month column is highlighted; top-4 contributors shown in red.`}
      isMissing={!report.salesByQuantity || allRows.every(r => r.curr2026 === 0 && r.curr2025 === 0)}
    >
      {/* Slide banner (matches HQ format for pre-export preview) */}
      <div className="rounded-t-xl border border-b-0 border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] px-5 py-3">
        <h3 className="text-xl font-bold text-[var(--color-ink-900)] underline underline-offset-[6px] decoration-2 decoration-[var(--color-ink-800)]">
          5. Sales Quantity — {currShort} {report.year}
        </h3>
      </div>

      <div className="overflow-x-auto rounded-b-xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] shadow-sm">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm tabular-nums">
          <colgroup>{[260, 90, 90, 110, 90, 120].map((w, i) => (
            <col key={i} style={{ minWidth: w }} />
          ))}</colgroup>
          <thead>
            {/* Year row */}
            <tr>
              <th rowSpan={2} className="sticky left-0 z-20 bg-[var(--color-ink-800)] text-white text-left px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] border-r border-[var(--color-ink-700)]">
                Product
              </th>
              <th colSpan={1} className="bg-[var(--color-ink-800)] text-white text-center px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] border-b border-[var(--color-ink-700)]">
                2026
              </th>
              <th colSpan={1} className="bg-[var(--color-ink-800)] text-white text-center px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] border-b border-[var(--color-ink-700)]">
                2025
              </th>
              <th colSpan={1} className="bg-[var(--color-accent-2)] text-[var(--color-ink-900)] text-center px-3 py-2 text-[11px] font-bold uppercase tracking-[0.15em] border-b border-[var(--color-ink-700)]">
                2026
              </th>
              <th colSpan={1} className="bg-[var(--color-ink-800)] text-white text-center px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] border-b border-[var(--color-ink-700)]">
                2025
              </th>
              <th rowSpan={2} className="bg-[var(--color-ink-800)] text-white text-right px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] border-l border-[var(--color-ink-700)]">
                <div>Total 2026</div>
                <div className="font-normal opacity-70 normal-case mt-0.5">Jan&nbsp;~&nbsp;{currShort}</div>
              </th>
            </tr>
            {/* Month row */}
            <tr>
              <th className="bg-[var(--color-ink-700)] text-white text-center px-3 py-1.5 text-[11px] font-semibold uppercase">{prevShort}</th>
              <th className="bg-[var(--color-ink-700)] text-white text-center px-3 py-1.5 text-[11px] font-semibold uppercase">{prevShort}</th>
              <th className="bg-[var(--color-accent-2)] text-[var(--color-ink-900)] text-center px-3 py-1.5 text-[11px] font-bold uppercase">{currShort}</th>
              <th className="bg-[var(--color-ink-700)] text-white text-center px-3 py-1.5 text-[11px] font-semibold uppercase">{currShort}</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((r, i) => {
              const red = isHighlighted(r.product);
              const isLast = i === allRows.length - 1;
              return (
                <tr
                  key={r.product}
                  className={cn(
                    "group transition-colors",
                    i % 2 === 0 ? "bg-white dark:bg-[var(--surface-1)]" : "bg-[var(--color-ice-50)]",
                    "hover:bg-[var(--color-ice-100)]",
                  )}
                >
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 text-left px-4 py-1.5 font-medium whitespace-nowrap border-r border-[var(--color-ice-200)]",
                      "group-hover:bg-[var(--color-ice-100)]",
                      i % 2 === 0 ? "bg-white dark:bg-[var(--surface-1)]" : "bg-[var(--color-ice-50)]",
                      !isLast && "border-b border-[var(--color-ice-100)]",
                      red ? "text-[var(--color-accent)] font-semibold" : "text-[var(--color-ink-900)]",
                    )}
                  >
                    {r.product}
                  </th>
                  <td className={cn("px-2 py-1 text-right text-[var(--color-ink-900)]", !isLast && "border-b border-[var(--color-ice-100)]")}>
                    {r.prev2026 ? r.prev2026.toLocaleString("en-US") : <span className="opacity-30">—</span>}
                  </td>
                  <td className={cn("px-2 py-1 text-right text-[var(--color-ink-600)]", !isLast && "border-b border-[var(--color-ice-100)]")}>
                    {r.prev2025 ? r.prev2025.toLocaleString("en-US") : <span className="opacity-30">—</span>}
                  </td>
                  <td className={cn(
                    "px-2 py-1 text-right bg-[var(--color-accent-2)]/30",
                    !isLast && "border-b border-[var(--color-ice-100)]",
                    red && "font-semibold text-[var(--color-accent)]",
                  )}>
                    <NumberCell
                      variant="plain"
                      value={r.curr2026}
                      onChange={n => setCurr(r.product, "qty2026", n)}
                    />
                  </td>
                  <td className={cn("px-2 py-1 text-right", !isLast && "border-b border-[var(--color-ice-100)]")}>
                    <NumberCell
                      variant="plain"
                      value={r.curr2025}
                      onChange={n => setCurr(r.product, "qty2025", n)}
                    />
                  </td>
                  <td className={cn(
                    "px-3 py-1 text-right font-semibold",
                    red ? "text-[var(--color-accent)]" : "text-[var(--color-ink-900)]",
                    i % 2 === 0 ? "bg-[var(--color-ice-50)]" : "bg-[var(--color-ice-100)]/60",
                    !isLast && "border-b border-[var(--color-ice-100)]",
                  )}>
                    {r.ytd ? r.ytd.toLocaleString("en-US") : <span className="opacity-30">—</span>}
                  </td>
                </tr>
              );
            })}
            {/* Totals row */}
            <tr className="bg-[var(--color-ink-800)] text-white">
              <th scope="row" className="sticky left-0 z-10 bg-[var(--color-ink-800)] text-white text-left px-4 py-2 text-xs uppercase tracking-[0.2em]">
                Total
              </th>
              <td className="px-2 py-2 text-right font-semibold tabular-nums">{totals.prev2026.toLocaleString("en-US")}</td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums opacity-90">{totals.prev2025.toLocaleString("en-US")}</td>
              <td className="px-2 py-2 text-right font-bold tabular-nums bg-[var(--color-accent-2)] text-[var(--color-ink-900)]">
                {totals.curr2026.toLocaleString("en-US")}
              </td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums opacity-90">{totals.curr2025.toLocaleString("en-US")}</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">{totals.ytd.toLocaleString("en-US")}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--color-ink-600)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-[var(--color-accent-2)]" /> Current month (2026)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-[var(--color-accent)]" /> Top-4 contributing product
        </span>
        {priorReport ? (
          <span className="ml-auto">Prior month ({prevShort} {prevYear}) auto-pulled from saved data.</span>
        ) : (
          <span className="ml-auto italic">No {prevShort} {prevYear} report on file — prior columns show zeros.</span>
        )}
      </div>

      {/* Commentary — same formatting tools as Market Outlook. */}
      <div className="mt-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-600)] mb-2">Commentary</div>
        <RichTextEditor value={commentary} onChange={setCommentary} placeholder="Observations on this month's quantity mix…" minHeight={140} />
      </div>
    </SectionShell>
  );
}

// Keeps the import graph clean; unused type alias kept explicit for future parser tweaks.
export type _SalesByQuantityProps = SQQ;
