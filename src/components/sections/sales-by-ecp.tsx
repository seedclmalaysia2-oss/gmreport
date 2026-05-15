"use client";
import type { SectionProps } from "../report-editor";
import { NumberCell, SectionShell, Table, Td, Th, CommentEditor } from "./shared";
import { ECP_CATEGORIES } from "@/lib/catalog/mappings";
import { fmtJPY, fmtMYR, fmtPct } from "@/lib/utils";

export function SectionSalesByECP({ report, update }: SectionProps) {
  const rows = report.salesByECP?.rows ?? ECP_CATEGORIES.map(category => ({ category, outlets: 0, pct: 0, salesMyr: 0 }));
  const commentary = report.salesByECP?.commentary ?? "";
  const totalSales = rows.reduce((s, r) => s + r.salesMyr, 0);
  const set = (next: typeof rows) => {
    const total = next.reduce((s, r) => s + r.salesMyr, 0);
    update({ salesByECP: { rows: next.map(r => ({ ...r, pct: total ? r.salesMyr / total : 0 })), commentary } });
  };
  const setCommentary = (html: string) => update({ salesByECP: { rows, commentary: html } });
  return (
    <SectionShell sectionKey="salesByECP" subtitle="Slide 9 — 5 fixed categories. Auto-filled from the outlet Excel import." isMissing={!report.salesByECP || report.salesByECP.rows.every(r => r.salesMyr === 0 && r.outlets === 0)}>
      <Table>
        <thead>
          <tr>
            <Th>Category</Th>
            <Th className="text-right">Outlets</Th>
            <Th className="text-right">Sales (MYR)</Th>
            <Th className="text-right">%</Th>
            <Th className="text-right">Sales (JPY)</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.category}>
              <Td className="font-medium">{r.category}</Td>
              <Td><NumberCell value={r.outlets} onChange={n => { const next = [...rows]; next[i] = { ...r, outlets: Math.round(n ?? 0) }; set(next); }} /></Td>
              <Td><NumberCell value={r.salesMyr} onChange={n => { const next = [...rows]; next[i] = { ...r, salesMyr: n ?? 0 }; set(next); }} /></Td>
              <Td className="text-right">{fmtPct(r.pct)}</Td>
              <Td className="text-right">{fmtJPY(r.salesMyr * report.fxRate)}</Td>
            </tr>
          ))}
          <tr>
            <Td className="font-semibold">Total</Td>
            <Td className="text-right font-semibold">{rows.reduce((s, r) => s + r.outlets, 0)}</Td>
            <Td className="text-right font-semibold">{fmtMYR(totalSales)}</Td>
            <Td className="text-right font-semibold">100%</Td>
            <Td className="text-right font-semibold">{fmtJPY(totalSales * report.fxRate)}</Td>
          </tr>
        </tbody>
      </Table>

      {/* Commentary — full formatting tools. */}
      <CommentEditor
        variant="rich"
        value={commentary}
        onSave={setCommentary}
        placeholder="Notes on channel mix — SIO growth, KCS seasonality, overseas push…"
        minHeight={140}
      />
    </SectionShell>
  );
}
