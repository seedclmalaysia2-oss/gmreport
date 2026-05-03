"use client";
import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import type { SectionProps } from "../report-editor";
import { NumberCell, SectionShell, TextCell } from "./shared";
import { MONTH_NAMES, cn, fmtMYR, monthId } from "@/lib/utils";
import type { ExpireWriteOff, MonthReport } from "@/lib/schema";
import { Trash2, Plus } from "lucide-react";

/**
 * Slide 13 — Expire Stock / Monthly Write-Off Activity.
 *
 * HQ layout: products down the side, months (Jan, Feb, Mar, …) across the top,
 * each with QTY + AMOUNT subcolumns, then a rightmost TOTAL WRITE-OFF column.
 * The current month's two columns are highlighted green to mark "this period".
 *
 * Every cell is editable:
 *   - Current month edits flow through the normal `update` prop (auto-saves).
 *   - Prior-month edits fire a PUT to /api/months/:id so siblings stay in sync.
 *   - Product renames, adds, and deletes propagate across all month records
 *     in the same year so the row key stays stable.
 */
export function SectionExpireWriteOff({ report, update, siblings = [] }: SectionProps) {
  // Year-to-current months, in order.
  const yearMonths = useMemo(() =>
    siblings
      .filter(m => m.year === report.year && m.month <= report.month)
      .sort((a, b) => a.month - b.month),
  [siblings, report.year, report.month]);

  // Make sure the current report is represented — it might not be in siblings
  // (edge case for brand-new months before first save).
  const months = useMemo(() => {
    if (yearMonths.some(m => m.id === report.id)) return yearMonths;
    return [...yearMonths, report].sort((a, b) => a.month - b.month);
  }, [yearMonths, report]);

  // Union of product labels across every month on file.
  const products = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    // Current month first so newly-added products stay near the top.
    const mine = report.expireWriteOff?.rows ?? [];
    for (const r of mine) if (!seen.has(r.product)) { seen.add(r.product); ordered.push(r.product); }
    for (const m of months) {
      for (const r of m.expireWriteOff?.rows ?? []) {
        if (!seen.has(r.product)) { seen.add(r.product); ordered.push(r.product); }
      }
    }
    return ordered;
  }, [months, report.expireWriteOff]);

  // Lookup helpers.
  const cellFor = (m: MonthReport, product: string) =>
    (m.id === report.id
      ? (report.expireWriteOff?.rows ?? [])
      : (m.expireWriteOff?.rows ?? []))
      .find(r => r.product === product);

  // --- Persistence for sibling months ---
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const siblingSaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Optimistic local copy so sibling edits render immediately without a round-trip.
  const [siblingOverrides, setSiblingOverrides] = useState<Record<string, ExpireWriteOff>>({});
  const siblingPayload = useCallback((m: MonthReport): ExpireWriteOff =>
    siblingOverrides[m.id] ?? m.expireWriteOff ?? { rows: [] },
  [siblingOverrides]);

  const saveSibling = useCallback(async (m: MonthReport, payload: ExpireWriteOff) => {
    setSiblingOverrides(prev => ({ ...prev, [m.id]: payload }));
    // Debounce per-month so rapid keystrokes don't spam the API.
    const existing = siblingSaveTimers.current.get(m.id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      setBusyKey(m.id);
      await fetch(`/api/months/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...m, expireWriteOff: payload }),
      }).catch(() => {});
      setBusyKey(null);
    }, 500);
    siblingSaveTimers.current.set(m.id, t);
  }, []);

  // --- Mutations ---
  const updateCell = (m: MonthReport, product: string, field: "qty" | "amt", value: number | null) => {
    const payload = m.id === report.id
      ? (report.expireWriteOff ?? { rows: [] })
      : siblingPayload(m);

    const rows = [...payload.rows];
    const idx = rows.findIndex(r => r.product === product);
    const v = field === "qty" ? Math.round(value ?? 0) : (value ?? 0);
    if (idx >= 0) rows[idx] = { ...rows[idx], [field]: v };
    else rows.push({ product, qty: field === "qty" ? v : 0, amt: field === "amt" ? v : 0 });

    if (m.id === report.id) update({ expireWriteOff: { rows } });
    else saveSibling(m, { rows });
  };

  const renameProduct = (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) return;
    // Rename in current month
    const myRows = (report.expireWriteOff?.rows ?? []).map(r =>
      r.product === oldName ? { ...r, product: newName } : r,
    );
    update({ expireWriteOff: { rows: myRows } });
    // Rename in every sibling that has this product
    for (const m of months) {
      if (m.id === report.id) continue;
      const existing = siblingPayload(m);
      if (!existing.rows.some(r => r.product === oldName)) continue;
      saveSibling(m, { rows: existing.rows.map(r => r.product === oldName ? { ...r, product: newName } : r) });
    }
  };

  const addProduct = () => {
    const name = `New product ${(report.expireWriteOff?.rows ?? []).length + 1}`;
    const rows = [...(report.expireWriteOff?.rows ?? []), { product: name, qty: 0, amt: 0 }];
    update({ expireWriteOff: { rows } });
  };

  const removeProduct = (product: string) => {
    // Remove from current month
    const myRows = (report.expireWriteOff?.rows ?? []).filter(r => r.product !== product);
    update({ expireWriteOff: { rows: myRows } });
    // Also purge from every sibling so the row disappears from the grid entirely.
    for (const m of months) {
      if (m.id === report.id) continue;
      const existing = siblingPayload(m);
      if (!existing.rows.some(r => r.product === product)) continue;
      saveSibling(m, { rows: existing.rows.filter(r => r.product !== product) });
    }
  };

  // --- Totals per row / per month / grand ---
  const rowTotals = (product: string) => {
    let qty = 0, amt = 0;
    for (const m of months) {
      const c = m.id === report.id ? (report.expireWriteOff?.rows ?? []).find(r => r.product === product) : siblingPayload(m).rows.find(r => r.product === product);
      qty += c?.qty ?? 0;
      amt += c?.amt ?? 0;
    }
    return { qty, amt };
  };

  const monthTotals = (m: MonthReport) => {
    const payload = m.id === report.id ? (report.expireWriteOff?.rows ?? []) : siblingPayload(m).rows;
    return payload.reduce((acc, r) => ({ qty: acc.qty + r.qty, amt: acc.amt + r.amt }), { qty: 0, amt: 0 });
  };

  const grand = products.reduce((acc, p) => {
    const t = rowTotals(p);
    return { qty: acc.qty + t.qty, amt: acc.amt + t.amt };
  }, { qty: 0, amt: 0 });

  const currShort = MONTH_NAMES[report.month - 1];
  const isMissing = (report.expireWriteOff?.rows ?? []).every(r => r.qty === 0 && r.amt === 0);

  return (
    <SectionShell
      sectionKey="expireWriteOff"
      subtitle={`Slide 13 — cumulative write-off matrix Jan→${currShort}. Current month highlighted; every cell is editable and saves back to the matching month.`}
      isMissing={!report.expireWriteOff || isMissing}
    >
      {/* Slide-style banner */}
      <div className="rounded-t-xl border border-b-0 border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] px-5 py-3">
        <h3 className="text-xl font-bold text-[var(--color-ink-900)] underline underline-offset-[6px] decoration-2 decoration-[var(--color-ink-800)]">
          11. Expire Stock — Monthly Write-Off Activity
        </h3>
      </div>

      <div className="rounded-b-xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] shadow-sm">
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm tabular-nums">
          <colgroup>{(() => {
            // Even-split across months; cap at a reasonable min so 4–6 months still read cleanly.
            const colPct = Math.max(7, (56 - 22) / (months.length * 2 + 2));
            const cols: React.ReactNode[] = [<col key="lead" style={{ width: "22%" }} />];
            for (const m of months) {
              cols.push(<col key={`${m.id}-q`} style={{ width: `${colPct}%` }} />);
              cols.push(<col key={`${m.id}-a`} style={{ width: `${colPct}%` }} />);
            }
            cols.push(<col key="t-q" style={{ width: "8%" }} />);
            cols.push(<col key="t-a" style={{ width: "10%" }} />);
            cols.push(<col key="t-spacer" style={{ width: "3%" }} />);
            return cols;
          })()}</colgroup>

          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 z-10 bg-[var(--color-ink-800)] text-white text-left align-middle px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] border-r border-[var(--color-ink-700)]">
                Expire Write-Off Activity
              </th>
              {months.map(m => {
                const current = m.id === report.id;
                return (
                  <th
                    key={m.id}
                    colSpan={2}
                    className={cn(
                      "text-center px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] border-b border-l border-[var(--color-ink-700)]",
                      current
                        ? "bg-[var(--color-accent-2)] text-[var(--color-ink-900)]"
                        : "bg-[var(--color-ink-800)] text-white",
                    )}
                  >
                    {MONTH_NAMES[m.month - 1]}-{String(m.year).slice(-2)}
                    {busyKey === m.id && <span className="ml-1 text-[9px] opacity-70">saving…</span>}
                  </th>
                );
              })}
              <th colSpan={2} className="bg-[var(--color-ink-800)] text-white text-center px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] border-b border-l border-[var(--color-ink-700)]">
                Total Write-Off
              </th>
              <th rowSpan={2} className="bg-[var(--color-ink-800)] border-b border-[var(--color-ink-700)]" />
            </tr>
            <tr>
              {months.map(m => {
                const current = m.id === report.id;
                const bg = current
                  ? "bg-[var(--color-accent-2)] text-[var(--color-ink-900)]"
                  : "bg-[var(--color-ink-700)] text-white";
                return (
                  <Fragment key={m.id}>
                    <th className={cn("text-center px-2 py-1 text-[10px] font-semibold uppercase tracking-wider border-l border-[var(--color-ink-600)]", bg)}>Quantity</th>
                    <th className={cn("text-center px-2 py-1 text-[10px] font-semibold uppercase tracking-wider border-l border-[var(--color-ink-600)]", bg)}>Amount</th>
                  </Fragment>
                );
              })}
              <th className="bg-[var(--color-ink-700)] text-white text-center px-2 py-1 text-[10px] font-semibold uppercase tracking-wider border-l border-[var(--color-ink-600)]">Quantity</th>
              <th className="bg-[var(--color-ink-700)] text-white text-center px-2 py-1 text-[10px] font-semibold uppercase tracking-wider border-l border-[var(--color-ink-600)]">Amount</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, i) => {
              const rt = rowTotals(product);
              const isLastRow = i === products.length - 1;
              const zebra = i % 2 === 0 ? "bg-white dark:bg-[var(--surface-1)]" : "bg-[var(--color-ice-50)]";
              return (
                <tr key={product} className={cn("group transition-colors hover:bg-[var(--color-ice-100)]", zebra)}>
                  <th scope="row" className={cn(
                    "sticky left-0 z-10 text-left px-2 py-1 font-medium border-r border-[var(--color-ice-200)]",
                    zebra,
                    !isLastRow && "border-b border-[var(--color-ice-100)]",
                  )}>
                    <TextCell
                      value={product}
                      onChange={v => renameProduct(product, v)}
                      placeholder="Product"
                      className="!border-0 !rounded-none !bg-transparent !px-1 !py-0 text-[12px] focus:!bg-[var(--color-ice-50)]"
                    />
                  </th>
                  {months.map(m => {
                    const current = m.id === report.id;
                    const c = cellFor(m, product);
                    const monthBg = current ? "bg-[color:var(--color-accent-2)]/30" : "";
                    return (
                      <Fragment key={m.id}>
                        <td className={cn(
                          "px-1 py-1 text-center border-l border-[var(--color-ice-100)]",
                          !isLastRow && "border-b border-[var(--color-ice-100)]",
                          monthBg,
                        )}>
                          <NumberCell
                            variant="plain"
                            align="center"
                            size="base"
                            bold={current}
                            value={c?.qty ?? 0}
                            onChange={n => updateCell(m, product, "qty", n)}
                          />
                        </td>
                        <td className={cn(
                          "px-1 py-1 text-center border-l border-[var(--color-ice-100)]",
                          !isLastRow && "border-b border-[var(--color-ice-100)]",
                          monthBg,
                        )}>
                          <NumberCell
                            variant="plain"
                            align="center"
                            size="base"
                            bold={current}
                            value={c?.amt ?? 0}
                            onChange={n => updateCell(m, product, "amt", n)}
                          />
                        </td>
                      </Fragment>
                    );
                  })}
                  <td className={cn(
                    "px-2 py-1 text-center font-semibold text-[var(--color-ink-900)] border-l border-[var(--color-ice-200)]",
                    !isLastRow && "border-b border-[var(--color-ice-100)]",
                  )}>
                    {rt.qty ? rt.qty.toLocaleString("en-US") : "—"}
                  </td>
                  <td className={cn(
                    "px-2 py-1 text-center font-semibold text-[var(--color-ink-900)] border-l border-[var(--color-ice-200)]",
                    !isLastRow && "border-b border-[var(--color-ice-100)]",
                  )}>
                    {rt.amt ? fmtMYR(rt.amt, 0) : "—"}
                  </td>
                  <td className={cn("px-1 py-1 text-center", !isLastRow && "border-b border-[var(--color-ice-100)]")}>
                    <button
                      onClick={() => removeProduct(product)}
                      className="p-1 rounded hover:bg-red-50 text-red-600 opacity-40 group-hover:opacity-100 transition"
                      title={`Delete ${product}`}
                    ><Trash2 size={13} /></button>
                  </td>
                </tr>
              );
            })}
            {/* Grand total row */}
            <tr className="bg-[var(--color-ink-800)] text-white">
              <th scope="row" className="sticky left-0 z-10 text-left px-3 py-2 font-bold uppercase tracking-[0.12em] text-[11px] bg-[var(--color-ink-800)] border-r border-[var(--color-ink-700)]">
                Total
              </th>
              {months.map(m => {
                const mt = monthTotals(m);
                const current = m.id === report.id;
                const bg = current ? "bg-[var(--color-accent-2)] text-[var(--color-ink-900)]" : "";
                return (
                  <Fragment key={m.id}>
                    <td className={cn("px-2 py-2 text-center font-bold text-base border-l border-[var(--color-ink-700)]", bg)}>
                      {mt.qty.toLocaleString("en-US")}
                    </td>
                    <td className={cn("px-2 py-2 text-center font-bold text-base border-l border-[var(--color-ink-700)]", bg)}>
                      {fmtMYR(mt.amt, 0)}
                    </td>
                  </Fragment>
                );
              })}
              <td className="px-2 py-2 text-center font-bold text-base border-l border-[var(--color-ink-700)]">{grand.qty.toLocaleString("en-US")}</td>
              <td className="px-2 py-2 text-center font-bold text-base border-l border-[var(--color-ink-700)]">{fmtMYR(grand.amt, 0)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-ink-600)]">
        <button
          onClick={addProduct}
          className="inline-flex items-center gap-1 font-semibold text-[var(--color-ink-800)] hover:underline"
        >
          <Plus size={12} /> Add product
        </button>
        <span>Prior-month cells also save — they update the corresponding month's record via /api/months.</span>
      </div>
    </SectionShell>
  );
}
