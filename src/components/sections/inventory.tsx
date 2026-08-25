"use client";
import type { SectionProps } from "../report-editor";
import { NumberCell, SectionShell, TextCell, CommentEditor } from "./shared";
import { INVENTORY_GROUPS } from "@/lib/catalog/products";
import type { Inventory } from "@/lib/schema";
import { cn } from "@/lib/utils";

/**
 * Slide 12 — Inventory Situation.
 *
 * Layout mirrors the HQ PPTX: one compact grid spanning three top-level categories
 * (Clear CL, Color CL, CL Care). Each category rowspan covers its subgroups, and
 * each subgroup renders as three rows: Product header → warehouse → Consignment.
 * The rightmost column carries the warehouse + consignment grand totals.
 */

function seed(): Inventory {
  return {
    groups: INVENTORY_GROUPS.map(g => ({
      name: g.name,
      rows: g.products.map(p => ({ product: p, warehouse: null, consignment: null })),
    })),
    totalWarehouse: 0,
    totalConsignment: 0,
    commentary: "",
  };
}

// Map subgroup name → parent category. Anything before the "(" is the parent;
// items without parentheses are their own parent.
function parentOf(name: string): string {
  const m = name.match(/^([^(]+)\s*\(/);
  return (m ? m[1] : name).trim();
}

export function SectionInventory({ report, update }: SectionProps) {
  const inv = report.inventory ?? seed();
  const set = (patch: Partial<Inventory>) => update({ inventory: { ...inv, ...patch } });

  // Grow a subgroup's row array on demand so the grid's trailing empty slots
  // accept edits too — the schema just needs {product, warehouse, consignment}.
  const ensureRows = (rows: Inventory["groups"][number]["rows"], target: number) => {
    if (rows.length >= target + 1) return rows;
    const out = [...rows];
    while (out.length < target + 1) out.push({ product: "", warehouse: null, consignment: null });
    return out;
  };

  const updateRow = (groupIdx: number, rowIdx: number, field: "warehouse" | "consignment", value: number | null) => {
    const groups = inv.groups.map((g, gi) => {
      if (gi !== groupIdx) return g;
      const padded = ensureRows(g.rows, rowIdx);
      const rows = padded.map((r, ri) => ri === rowIdx ? { ...r, [field]: value } : r);
      return { ...g, rows };
    });
    // Recompute totals live.
    let totW = 0, totC = 0;
    for (const g of groups) for (const r of g.rows) { totW += r.warehouse ?? 0; totC += r.consignment ?? 0; }
    set({ groups, totalWarehouse: totW, totalConsignment: totC });
  };

  const updateProduct = (groupIdx: number, rowIdx: number, value: string) => {
    const groups = inv.groups.map((g, gi) => {
      if (gi !== groupIdx) return g;
      const padded = ensureRows(g.rows, rowIdx);
      const rows = padded.map((r, ri) => ri === rowIdx ? { ...r, product: value } : r);
      return { ...g, rows };
    });
    set({ groups });
  };

  // Group subgroups by parent category so we can issue one rowspan per parent.
  const parentOrder: string[] = [];
  const parentMap = new Map<string, { idx: number; group: Inventory["groups"][number] }[]>();
  inv.groups.forEach((g, idx) => {
    const p = parentOf(g.name);
    if (!parentMap.has(p)) { parentMap.set(p, []); parentOrder.push(p); }
    parentMap.get(p)!.push({ idx, group: g });
  });

  // Column count = widest subgroup → table width. The LAST subgroup additionally
  // has to leave two free cells at its right-hand end, because that is where the
  // TOTAL label and value sit (bottom-right of the grid), so widen the table if
  // that block is nearly full. Keeps the totals INSIDE the one table rather than
  // in a separate column bolted onto the side.
  const lastGroupLen = inv.groups.length ? inv.groups[inv.groups.length - 1].rows.length : 0;
  const MAX_COLS = Math.max(6, ...inv.groups.map(g => g.rows.length), lastGroupLen + 2);
  // Column indices of the two totals cells, used only on the last subgroup.
  const TOTAL_LABEL_COL = MAX_COLS - 2;
  const TOTAL_VALUE_COL = MAX_COLS - 1;

  // The corner TOTAL block. Both rows sit on ink-800 — the design system's
  // single `table-header` surface — so the block reads as one object rather
  // than two differently-weighted badges; the rows are separated by a hairline
  // instead of by a second ink. The label follows the Wide-Tracked Label Rule
  // (uppercase, 0.2em) at the same 10px as this table's other labels.
  const totalCellBase = "px-2 py-1 align-middle bg-[var(--color-ink-800)] text-white";
  const totalLabelCls = "text-center text-[10px] font-semibold uppercase tracking-[0.2em] border-l border-[var(--color-ice-200)]";
  // The figures themselves are handed NumberCell's `onDark` variant rather than
  // patched from outside — see shared.tsx. Doing it in the primitive means the
  // focus state is actually defined for a dark fill instead of relying on
  // arbitrary-variant overrides winning a specificity race.

  return (
    <SectionShell
      sectionKey="inventory"
      subtitle="Slide 12 — inventory by category. Grid layout mirrors the HQ deck; leave cells blank for products you don't track."
      isMissing={!report.inventory || (!inv.totalWarehouse && !inv.totalConsignment && inv.groups.every(g => g.rows.every(r => r.warehouse == null && r.consignment == null)))}
    >
      {/* Slide-style title */}
      <div className="rounded-t-xl border border-b-0 border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] px-5 py-3">
        <h3 className="text-xl font-bold text-[var(--color-ink-900)] underline underline-offset-[6px] decoration-2 decoration-[var(--color-ink-800)]">
          10. Inventory Situation
        </h3>
      </div>

      <div className="overflow-x-auto rounded-b-xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] shadow-sm">
        {/* table-auto lets each column size to its content so numbers stop
            being crammed, and overflow-x-auto on the wrapper drops in a
            horizontal scrollbar when the viewport can't fit all of it. */}
        <table className="min-w-full table-auto border-separate border-spacing-0 text-xs tabular-nums">
          <tbody>
            {parentOrder.map((parent, parentIdx) => {
              const subgroups = parentMap.get(parent)!;
              // Rows per subgroup = 1 product header + 1 warehouse + 1 Consignment = 3.
              const parentRowspan = subgroups.length * 3;
              const isLastParent = parentIdx === parentOrder.length - 1;

              return subgroups.flatMap((sub, subIdx) => {
                const isFirstSub = subIdx === 0;
                const isLastSubgroup = subIdx === subgroups.length - 1;
                const gIdx = sub.idx;
                const rows = [...sub.group.rows];
                while (rows.length < MAX_COLS) rows.push({ product: "", warehouse: null, consignment: null });

                const categoryCell = isFirstSub ? (
                  <th
                    rowSpan={parentRowspan}
                    className={cn(
                      "sticky left-0 z-10 align-middle text-center px-2 py-1.5 border-r border-[var(--color-ice-200)]",
                      "bg-[var(--color-ice-100)] text-[var(--color-ink-900)] font-bold uppercase tracking-[0.12em] text-[10px]",
                      !isLastParent && "border-b border-[var(--color-ice-200)]",
                    )}
                    style={{ minWidth: 80 }}
                  >
                    <div className="vertical-label">{parent}</div>
                  </th>
                ) : null;

                const showTotals = isLastParent && isLastSubgroup;

                return [
                  /* Row 1: category (rowspan anchor) + empty "location" cell + product names */
                  <tr key={`${gIdx}-head`} className="bg-[var(--color-ice-50)]">
                    {categoryCell}
                    <td className="px-2 py-1 text-[10px] text-[var(--color-ink-600)] italic border-b border-[var(--color-ice-100)] whitespace-nowrap">
                      {sub.group.name !== parent && sub.group.name.replace(`${parent} `, "").replace(/^\(|\)$/g, "")}
                    </td>
                    {rows.map((r, i) => (
                      <td
                        key={i}
                        className="p-0 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-800)] border-b border-l border-[var(--color-ice-100)]"
                        style={{ minWidth: 80 }}
                      >
                        {/* The two cells directly above the TOTAL block stay
                            blank - no SKU placeholder over the corner. */}
                        {showTotals && i >= TOTAL_LABEL_COL ? null : (
                          <TextCell
                            value={r.product}
                            onChange={v => updateProduct(gIdx, i, v)}
                            placeholder="SKU"
                            className="!border-0 !rounded-none !bg-transparent !text-center !font-semibold !uppercase !tracking-wider text-[10px] focus:!bg-[var(--color-ice-50)]"
                          />
                        )}
                      </td>
                    ))}
                  </tr>,
                  /* Row 2: warehouse values */
                  <tr key={`${gIdx}-wh`}>
                    <td className="px-2 py-0.5 text-[10px] font-semibold text-[var(--color-ink-800)] border-b border-[var(--color-ice-100)] bg-[var(--color-ice-50)] whitespace-nowrap">
                      warehouse
                    </td>
                    {/* On the last block the final two cells carry the grand
                        total (label + value) instead of product figures, so the
                        table keeps ONE consistent column count. */}
                    {rows.map((r, i) => {
                      if (showTotals && i === TOTAL_LABEL_COL) return (
                        <td key={i} className={cn(totalCellBase, totalLabelCls, "border-b border-b-white/15")}>
                          Total
                        </td>
                      );
                      if (showTotals && i === TOTAL_VALUE_COL) return (
                        <td key={i} className={cn(totalCellBase, "border-b border-b-white/15")}>
                          <NumberCell
                            variant="plain"
                            align="center"
                            size="sm"
                            bold
                            value={inv.totalWarehouse}
                            onDark
                            onChange={n => set({ totalWarehouse: n ?? 0 })}
                          />
                        </td>
                      );
                      return (
                        <td key={i} className="px-0.5 py-0.5 text-center border-b border-l border-[var(--color-ice-100)]">
                          <NumberCell
                            variant="plain"
                            align="center"
                            size="sm"
                            bold
                            value={r.warehouse}
                            onChange={n => updateRow(gIdx, i, "warehouse", n)}
                          />
                        </td>
                      );
                    })}
                  </tr>,
                  /* Row 3: Consignment values */
                  <tr key={`${gIdx}-co`} className="bg-[var(--color-ice-50)]/40">
                    <td className={cn(
                      "px-2 py-0.5 text-[10px] font-semibold text-[var(--color-ink-800)] whitespace-nowrap bg-[var(--color-ice-50)]",
                      !isLastSubgroup && "border-b border-[var(--color-ice-100)]",
                    )}>
                      Consignment
                    </td>
                    {rows.map((r, i) => {
                      if (showTotals && i === TOTAL_LABEL_COL) return (
                        <td key={i} className={cn(totalCellBase, totalLabelCls)}>
                          Total
                        </td>
                      );
                      if (showTotals && i === TOTAL_VALUE_COL) return (
                        <td key={i} className={cn(totalCellBase, "rounded-br-xl")}>
                          <NumberCell
                            variant="plain"
                            align="center"
                            size="sm"
                            bold
                            value={inv.totalConsignment}
                            onDark
                            onChange={n => set({ totalConsignment: n ?? 0 })}
                          />
                        </td>
                      );
                      return (
                        <td key={i} className={cn(
                          "px-0.5 py-0.5 text-center border-l border-[var(--color-ice-100)]",
                          !isLastSubgroup && "border-b border-[var(--color-ice-100)]",
                        )}>
                          <NumberCell
                            variant="plain"
                            align="center"
                            size="sm"
                            bold
                            value={r.consignment}
                            onChange={n => updateRow(gIdx, i, "consignment", n)}
                          />
                        </td>
                      );
                    })}
                  </tr>,
                ];
              });
            })}
          </tbody>
        </table>
      </div>

      {/* Commentary (rich text, matches slide bullet block) */}
      <CommentEditor
        variant="rich"
        className="mt-4"
        value={inv.commentary ?? ""}
        onSave={v => set({ commentary: v })}
        placeholder="DISOP Product Arrival in April 24th&#10;DISOP Hidro Health 360ml = 3,620 btl…"
        minHeight={140}
      />
    </SectionShell>
  );
}
