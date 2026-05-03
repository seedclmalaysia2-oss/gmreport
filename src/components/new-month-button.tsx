"use client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { monthId, MONTH_NAMES } from "@/lib/utils";

export function NewMonthButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const res = await fetch("/api/months", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      setOpen(false);
      const suffix = data.isNew ? "?new=1" : "";
      router.push(`/report/${monthId(year, month)}${suffix}`);
      router.refresh();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-ink-800)] text-white px-3 py-1.5 text-sm font-semibold hover:bg-[var(--color-ink-700)]"
      >
        <Plus size={15} /> New month
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 animate-fadein" onClick={() => !busy && setOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-[360px] space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-[var(--font-display)] text-xl font-semibold">Create a month</h3>
            <div className="flex gap-3">
              <label className="flex-1 text-sm">
                <span className="block text-xs text-[var(--color-ink-600)] mb-1">Year</span>
                <input
                  type="number"
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  className="w-full rounded-md border border-[var(--color-ice-200)] px-3 py-2"
                />
              </label>
              <label className="flex-1 text-sm">
                <span className="block text-xs text-[var(--color-ink-600)] mb-1">Month</span>
                <select value={month} onChange={e => setMonth(Number(e.target.value))}
                  className="w-full rounded-md border border-[var(--color-ice-200)] px-3 py-2">
                  {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{i + 1} · {m}</option>)}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-sm">Cancel</button>
              <button
                disabled={busy}
                onClick={create}
                className="px-3 py-1.5 text-sm rounded-md bg-[var(--color-ink-800)] text-white disabled:opacity-60"
              >
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
