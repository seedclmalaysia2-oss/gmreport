"use client";
import { useState } from "react";
import type { SectionProps } from "../report-editor";
import { NumberCell, SectionShell } from "./shared";
import { fmtJPY, fmtMYR } from "@/lib/utils";
import { Check, Lock, Pencil } from "lucide-react";

/**
 * Slide 12 — Financial Relationship.
 *
 * The five figures here (AR, long-term AR, AP, Collection, Cash Flow) are
 * high-value numbers that mostly come from manual entry. To stop accidental
 * edits, the cards are LOCKED by default: they render as read-only formatted
 * values. Clicking "Edit" unlocks the inputs; "Save" locks them again. Edits
 * still auto-save through the normal report `update()` debounce — Save just
 * re-locks so the figures can't be nudged afterwards.
 */
export function SectionFinancial({ report, update }: SectionProps) {
  const f = report.financial ?? { arMyr: 0, arLongTermMyr: 0, apMyr: 0, collectionMyr: 0, cashFlowMyr: 0 };
  const set = (patch: Partial<typeof f>) => update({ financial: { ...f, ...patch } });

  // Locked by default — only an explicit Edit click allows changes.
  const [editing, setEditing] = useState(false);

  const cards: [string, keyof typeof f][] = [
    ["Accounts Receivable (Aging Total)", "arMyr"],
    ["AR 180–365 days (long-term)", "arLongTermMyr"],
    ["Accounts Payable", "apMyr"],
    ["Collection this month", "collectionMyr"],
    ["Cash Flow", "cashFlowMyr"],
  ];

  return (
    <SectionShell
      sectionKey="financial"
      subtitle="Slide 14 — enter MYR values; JPY is computed live from the header's FX rate."
      isMissing={!report.financial || (report.financial.arMyr === 0 && report.financial.apMyr === 0 && report.financial.collectionMyr === 0 && report.financial.cashFlowMyr === 0)}
    >
      {/* Lock toolbar — status on the left, Edit / Save on the right. */}
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--color-ice-200)] bg-[var(--color-ice-50)] px-3 py-2">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-ink-700)]">
          {editing ? (
            <><Pencil size={13} className="text-[var(--color-ink-700)]" /> Editing — values unlocked. Click Save when done.</>
          ) : (
            <><Lock size={13} className="text-[var(--color-ink-600)]" /> Locked — figures are read-only. Click Edit to change them.</>
          )}
        </span>
        {editing ? (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-ok)] text-white px-3 py-1.5 text-sm font-semibold hover:opacity-90 active:scale-95 transition"
          >
            <Check size={14} /> Save
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-ink-800)] text-[var(--color-ink-800)] px-3 py-1.5 text-sm font-semibold hover:bg-[var(--color-ice-100)] active:scale-95 transition"
          >
            <Pencil size={14} /> Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map(([label, key]) => {
          const myr = (f as Record<string, number>)[key] ?? 0;
          return (
            <div
              key={key}
              className={[
                "rounded-xl border p-4 transition-colors",
                editing
                  ? "border-[var(--color-ink-700)] bg-[var(--surface-1)]"
                  : "border-[var(--color-ice-200)] bg-[var(--color-ice-50)]",
              ].join(" ")}
            >
              <div className="text-xs uppercase tracking-widest text-[var(--color-ink-600)]">{label}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-[var(--color-ink-600)]">MYR</span>
                {editing ? (
                  <NumberCell value={myr} onChange={n => set({ [key]: n ?? 0 } as Partial<typeof f>)} />
                ) : (
                  // Locked view — static formatted value, not an input.
                  <span className="font-mono tabular-nums text-lg font-semibold text-[var(--color-ink-900)]">
                    {fmtMYR(myr)}
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--color-ink-600)] mt-1">{fmtJPY(myr * report.fxRate)}</div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
