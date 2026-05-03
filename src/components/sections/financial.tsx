"use client";
import type { SectionProps } from "../report-editor";
import { NumberCell, SectionShell } from "./shared";
import { fmtJPY } from "@/lib/utils";

export function SectionFinancial({ report, update }: SectionProps) {
  const f = report.financial ?? { arMyr: 0, arLongTermMyr: 0, apMyr: 0, collectionMyr: 0, cashFlowMyr: 0 };
  const set = (patch: Partial<typeof f>) => update({ financial: { ...f, ...patch } });
  const cards: [string, keyof typeof f][] = [
    ["Accounts Receivable (Aging Total)", "arMyr"],
    ["AR 180–365 days (long-term)", "arLongTermMyr"],
    ["Accounts Payable", "apMyr"],
    ["Collection this month", "collectionMyr"],
    ["Cash Flow", "cashFlowMyr"],
  ];
  return (
    <SectionShell sectionKey="financial" subtitle="Slide 14 — enter MYR values; JPY is computed live from the header's FX rate." isMissing={!report.financial || (report.financial.arMyr === 0 && report.financial.apMyr === 0 && report.financial.collectionMyr === 0 && report.financial.cashFlowMyr === 0)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map(([label, key]) => {
          const myr = (f as Record<string, number>)[key] ?? 0;
          return (
            <div key={key} className="rounded-xl border border-[var(--color-ice-200)] bg-[var(--color-ice-50)] p-4">
              <div className="text-xs uppercase tracking-widest text-[var(--color-ink-600)]">{label}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm">MYR</span>
                <NumberCell value={myr} onChange={n => set({ [key]: n ?? 0 } as Partial<typeof f>)} />
              </div>
              <div className="text-xs text-[var(--color-ink-600)] mt-1">{fmtJPY(myr * report.fxRate)}</div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
