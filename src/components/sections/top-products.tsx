"use client";
import type { SectionProps } from "../report-editor";
import { NumberCell, SectionShell, Table, Td, Th, TextCell, CommentEditor } from "./shared";
import { fmtJPY, fmtMYR, fmtPct } from "@/lib/utils";

export function SectionTopProducts({ report, update }: SectionProps) {
  const rows = report.topProducts?.rows ?? [];
  const commentary = report.topProducts?.commentary ?? "";
  const total = rows.reduce((s, r) => s + r.myr, 0);
  const set = (next: typeof rows) => {
    const totalNext = next.reduce((s, r) => s + r.myr, 0);
    const withPct = next.map(r => ({ ...r, pct: totalNext ? r.myr / totalNext : 0 }));
    update({ topProducts: { rows: withPct, totalMyr: totalNext, commentary } });
  };
  const setCommentary = (html: string) => update({ topProducts: { rows, totalMyr: total, commentary: html } });
  return (
    <SectionShell sectionKey="topProducts" subtitle="Slide 8 — ranked by net sales MYR. Auto-populated from POS PDF; edit here to tweak." isMissing={!report.topProducts || report.topProducts.rows.length === 0}>
      <Table>
        <thead>
          <tr>
            <Th>#</Th><Th>Product</Th><Th className="text-right">MYR</Th><Th className="text-right">%</Th><Th className="text-right">JPY</Th><Th></Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <Td>{i + 1}</Td>
              <Td><TextCell value={r.product} onChange={v => { const n = [...rows]; n[i] = { ...r, product: v }; set(n); }} /></Td>
              <Td><NumberCell value={r.myr} onChange={v => { const n = [...rows]; n[i] = { ...r, myr: v ?? 0 }; set(n); }} /></Td>
              <Td className="text-right">{fmtPct(r.pct, 1)}</Td>
              <Td className="text-right">{fmtJPY(r.myr * report.fxRate)}</Td>
              <Td><button onClick={() => set(rows.filter((_, j) => j !== i))} className="text-xs text-red-600">×</button></Td>
            </tr>
          ))}
          <tr>
            <Td></Td>
            <Td className="font-semibold">Total</Td>
            <Td className="text-right font-semibold">{fmtMYR(total)}</Td>
            <Td className="text-right font-semibold">100%</Td>
            <Td className="text-right font-semibold">{fmtJPY(total * report.fxRate)}</Td>
            <Td></Td>
          </tr>
        </tbody>
      </Table>
      <button
        onClick={() => set([...rows, { product: "", myr: 0, pct: 0 }])}
        className="mt-3 text-sm text-[var(--color-ink-800)] underline"
      >+ Add product</button>

      {/* Commentary — full formatting tools. */}
      <CommentEditor
        variant="rich"
        value={commentary}
        onSave={setCommentary}
        placeholder="Why this ranking matters — new launches, seasonal movers…"
        minHeight={140}
      />
    </SectionShell>
  );
}
