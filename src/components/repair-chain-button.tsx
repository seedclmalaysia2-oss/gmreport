"use client";
import { CheckCircle2, Link2, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RepairResult = {
  ok: boolean;
  monthsChecked: number;
  monthsChanged: number;
  filesDeduped?: number;
  dedupDetails?: string[];
  results: { id: string; changed: boolean; notes: string[] }[];
};

export function RepairChainButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RepairResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/months/repair", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const json: RepairResult = await res.json();
      setResult(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Repair failed");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setResult(null);
    setErr(null);
    // Refresh on dismiss so the months grid reflects any changes without
    // racing the modal's own render.
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-ink-800)] bg-white text-[var(--color-ink-800)] px-3 py-1.5 text-sm font-semibold hover:bg-[var(--color-ice-50)] disabled:opacity-60 dark:bg-[var(--surface-1)]"
        title="Walk every month chronologically. Carries prior-month data into empty new months (budgets, 2025 actuals, product registration, inventory shape) and relinks cross-month derivations (region growth%, totals)."
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
        {busy ? "Relinking months…" : "Repair chain"}
      </button>

      {(result || err) && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] grid place-items-center bg-black/50 backdrop-blur-sm p-6"
          onClick={close}
        >
          <div
            className="w-[520px] max-w-full rounded-2xl bg-white dark:bg-[var(--surface-1)] border border-[var(--color-ice-200)] p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            {err ? (
              <>
                <h3 className="text-lg font-semibold text-red-700">Repair failed</h3>
                <p className="text-sm">{err}</p>
              </>
            ) : result ? (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-[var(--color-ok)]" size={20} />
                  <h3 className="text-lg font-semibold">Month chain relinked</h3>
                </div>
                <p className="text-sm text-[var(--color-ink-600)]">
                  Checked {result.monthsChecked} month{result.monthsChecked === 1 ? "" : "s"};
                  {result.monthsChanged === 0
                    ? " nothing needed fixing."
                    : ` repaired ${result.monthsChanged}.`}
                </p>
                {!!result.filesDeduped && result.filesDeduped > 0 && (
                  <div className="text-xs rounded-lg border border-[var(--color-ice-200)] bg-[var(--color-ice-50)] p-3">
                    <p className="font-semibold text-[var(--color-ink-900)]">
                      {result.filesDeduped} duplicate / unused file{result.filesDeduped === 1 ? "" : "s"} moved to Recently deleted
                    </p>
                    {result.dedupDetails && result.dedupDetails.length > 0 && (
                      <ul className="mt-1 text-[var(--color-ink-600)] list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto">
                        {result.dedupDetails.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    )}
                  </div>
                )}
                {result.results.some(r => r.changed) && (
                  <ul className="text-xs max-h-64 overflow-y-auto border border-[var(--color-ice-200)] rounded-lg divide-y divide-[var(--color-ice-100)]">
                    {result.results.filter(r => r.changed).map(r => (
                      <li key={r.id} className="px-3 py-2">
                        <div className="font-semibold text-[var(--color-ink-900)]">{r.id}</div>
                        <ul className="mt-1 text-[var(--color-ink-600)] list-disc pl-4 space-y-0.5">
                          {r.notes.map((n, i) => <li key={i}>{n}</li>)}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={run}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-ice-200)] px-3 py-1.5 text-sm hover:bg-[var(--color-ice-50)] disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {busy ? "Running…" : "Run again"}
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-md bg-[var(--color-ink-800)] text-white px-3 py-1.5 text-sm font-semibold hover:bg-[var(--color-ink-700)]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
