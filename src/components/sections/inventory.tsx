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

  // Column count = max subgroup length → determines table width.
  const MAX_COLS = Math.max(6, ...inv.groups.map(g => g.rows.length));

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

      <div className="rounded-b-xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] shadow-sm">
        {/* Fluid layout: `table-fixed` + percentage <colgroup> lets the grid
            shrink to the viewport so there's no horizontal scrollbar. */}
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm tabular-nums">
          <colgroup>{[
            "9%", "11%", "12%", "12%", "12%", "12%", "12%", "12%", "8%",
          ].map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
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
                      "sticky left-0 z-10 align-middle text-center px-3 py-2 border-r border-[var(--color-ice-200)]",
                      "bg-[var(--color-ice-100)] text-[var(--color-ink-900)] font-bold uppercase tracking-[0.15em] text-xs",
                      !isLastParent && "border-b border-[var(--color-ice-200)]",
                    )}
                    style={{ minWidth: 96 }}
                  >
                    <div className="vertical-label">{parent}</div>
                  </th>
                ) : null;

                const showTotals = isLastParent && isLastSubgroup;

                return [
                  /* Row 1: category (rowspan anchor) + empty "location" cell + 6 product names */
                  <tr key={`${gIdx}-head`} className="bg-[var(--color-ice-50)]">
                    {categoryCell}
                    <td className="px-3 py-1.5 text-xs text-[var(--color-ink-600)] italic border-b border-[var(--color-ice-100)] whitespace-nowrap">
                      {sub.group.name !== parent && sub.group.name.replace(`${parent} `, "").replace(/^\(|\)$/g, "")}
                    </td>
                    {rows.map((r, i) => (
                      <td
                        key={i}
                        className="p-0 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-800)] border-b border-l border-[var(--color-ice-100)]"
                      >
                        <TextCell
                          value={r.product}
                          onChange={v => updateProduct(gIdx, i, v)}
                          placeholder="SKU"
                          className="!border-0 !rounded-none !bg-transparent !text-center !font-semibold !uppercase !tracking-wider text-[11px] focus:!bg-[var(--color-ice-50)]"
                        />
                      </td>
                    ))}
                    {/* Totals right-side slot */}
                    <td rowSpan={3} className={cn(
                      "px-3 py-1 text-right align-middle",
                      !isLastSubgroup && "border-b border-[var(--color-ice-100)]",
                      "border-l border-[var(--color-ice-200)]",
                    )} />
                  </tr>,
                  /* Row 2: warehouse values */
                  <tr key={`${gIdx}-wh`}>
                    <td className="px-3 py-1 text-xs font-semibold text-[var(--color-ink-800)] border-b border-[var(--color-ice-100)] bg-[var(--color-ice-50)] whitespace-nowrap">
                      warehouse
                    </td>
                    {rows.map((r, i) => (
                      <td key={i} className="px-1 py-1 text-center border-b border-l border-[var(--color-ice-100)]">
                        <NumberCell
                          variant="plain"
                          align="center"
                          size="lg"
                          bold
                          value={r.warehouse}
                          onChange={n => updateRow(gIdx, i, "warehouse", n)}
                        />
                      </td>
                    ))}
                    {/* Totals column — rendered only on last parent's last subgroup */}
                    {showTotals && (
                      <td className="px-3 text-center align-middle bg-[var(--color-ink-800)] text-white font-bold border-b border-l border-[var(--color-ice-200)]">
                        <div className="text-[10px] uppercase tracking-widest opacity-80">Total</div>
                        <NumberCell
                          variant="plain"
                          align="center"
                          size="lg"
                          bold
                          value={inv.totalWarehouse}
                          onChange={n => set({ totalWarehouse: n ?? 0 })}
                          className="text-white [&_input]:!text-white"
                        />
                      </td>
                    )}
                  </tr>,
                  /* Row 3: Consignment values */
                  <tr key={`${gIdx}-co`} className="bg-[var(--color-ice-50)]/40">
                    <td className={cn(
                      "px-3 py-1 text-xs font-semibold text-[var(--color-ink-800)] whitespace-nowrap bg-[var(--color-ice-50)]",
                      !isLastSubgroup && "border-b border-[var(--color-ice-100)]",
                    )}>
                      Consignment
                    </td>
                    {rows.map((r, i) => (
                      <td key={i} className={cn(
                        "px-1 py-1 text-center border-l border-[var(--color-ice-100)]",
                        !isLastSubgroup && "border-b border-[var(--color-ice-100)]",
                      )}>
                        <NumberCell
                          variant="plain"
                          align="center"
                          size="lg"
                          bold
                          value={r.consignment}
                          onChange={n => updateRow(gIdx, i, "consignment", n)}
                        />
                      </td>
                    ))}
                    {showTotals && (
                      <td className="px-3 text-center align-middle bg-[var(--color-ink-700)] text-white font-bold border-l border-[var(--color-ice-200)]">
                        <div className="text-[10px] uppercase tracking-widest opacity-80">Total</div>
                        <NumberCell
                          variant="plain"
                          align="center"
                          size="lg"
                          bold
                          value={inv.totalConsignment}
                          onChange={n => set({ totalConsignment: n ?? 0 })}
                          className="text-white [&_input]:!text-white"
                        />
                      </td>
                    )}
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
