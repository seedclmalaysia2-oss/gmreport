"use client";
import type { SectionProps } from "../report-editor";
import { NumberCell, SectionShell, Table, Td, Th, TextArea } from "./shared";
import { REGIONS } from "@/lib/catalog/mappings";
import { fmtMYR, fmtPct } from "@/lib/utils";

export function SectionSalesByRegion({ report, update }: SectionProps) {
  const rows = report.salesByRegion?.rows ?? REGIONS.map(region => ({ region, salesThis: 0, salesPrev: 0, growthPct: 0 }));
  const commentary = report.salesByRegion?.commentary ?? "";
  const set = (next: typeof rows, c = commentary) => {
    const withGrowth = next.map(r => ({ ...r, growthPct: r.salesPrev ? (r.salesThis - r.salesPrev) / r.salesPrev : 0 }));
    update({ salesByRegion: { rows: withGrowth, commentary: c } });
  };
  return (
    <SectionShell sectionKey="salesByRegion" subtitle="Slide 10 — 5 fixed regions. Growth % is auto-computed." isMissing={!report.salesByRegion || report.salesByRegion.rows.every(r => r.salesThis === 0 && r.salesPrev === 0)}>
      <Table>
        <thead>
          <tr>
            <Th>Region</Th>
            <Th className="text-right">Sales this month (MYR)</Th>
            <Th className="text-right">Sales previous month (MYR)</Th>
            <Th className="text-right">Growth %</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.region}>
              <Td className="font-medium">{r.region}</Td>
              <Td><NumberCell value={r.salesThis} onChange={n => { const next = [...rows]; next[i] = { ...r, salesThis: n ?? 0 }; set(next); }} /></Td>
              <Td><NumberCell value={r.salesPrev} onChange={n => { const next = [...rows]; next[i] = { ...r, salesPrev: n ?? 0 }; set(next); }} /></Td>
              <Td className={"text-right " + (r.growthPct >= 0 ? "text-[var(--color-ok)]" : "text-red-600")}>{fmtPct(r.growthPct, 2)}</Td>
            </tr>
          ))}
          <tr>
            <Td className="font-semibold">Total</Td>
            <Td className="text-right font-semibold">{fmtMYR(rows.reduce((s, r) => s + r.salesThis, 0))}</Td>
            <Td className="text-right font-semibold">{fmtMYR(rows.reduce((s, r) => s + r.salesPrev, 0))}</Td>
            <Td></Td>
          </tr>
        </tbody>
      </Table>
      <h4 className="font-semibold mt-5">Commentary</h4>
      <TextArea value={commentary} onChange={v => set(rows, v)} rows={5} />
    </SectionShell>
  );
}
