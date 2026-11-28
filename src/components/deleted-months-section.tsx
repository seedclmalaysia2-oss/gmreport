"use client";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { MONTH_NAMES, monthNameFull } from "@/lib/utils";
import type { DeletedMonthSummary } from "@/lib/month-report";

/**
 * Recently deleted months — the trash section at the bottom of the home page.
 * Mirrors the Files trash: each row shows the month label, how many sections
 * had data at delete time, when it was deleted, and gives Restore (one click,
 * instant) + Delete forever (confirm, hard-delete).
 *
 * Collapsed by default so it doesn't clutter the home page; a one-line header
 * with the count opens the list. Nothing to show → the whole section hides.
 */
export function DeletedMonthsSection({ initial }: { initial: DeletedMonthSummary[] }) {
  const router = useRouter();
  const [months, setMonths] = useState(initial);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => { setMonths(initial); }, [initial]);

  if (months.length === 0) return null;

  async function restore(id: string) {
    setWorking(id);
    try {
      const res = await fetch(`/api/months/${encodeURIComponent(id)}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Restore failed");
      setMonths(prev => prev.filter(m => m.id !== id));
      startTransition(() => router.refresh());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setWorking(null);
    }
  }

  async function purge(id: string, label: string) {
    const ok = confirm(
      `Permanently delete ${label}?\n\nThis cannot be undone. All section ` +
      "data and any uploaded files tied to this month will be removed from " +
      "Supabase for good."
    );
    if (!ok) return;
    setWorking(id);
    try {
      const res = await fetch(`/api/months/${encodeURIComponent(id)}/purge`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete forever failed");
      setMonths(prev => prev.filter(m => m.id !== id));
      startTransition(() => router.refresh());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete forever failed");
    } finally {
      setWorking(null);
    }
  }

  return (
    <section
      className="rounded-2xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)]"
      aria-label="Recently deleted months"
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls="deleted-months-list"
        className="w-full flex items-center justify-between gap-3 p-5 text-left rounded-2xl hover:bg-[var(--color-ice-50)] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid place-items-center h-9 w-9 rounded-full bg-[var(--color-ice-100)] text-[var(--color-ink-700)] flex-none" aria-hidden="true">
            <Trash2 size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-[var(--color-ink-900)] leading-tight">
              Recently deleted months
              <span className="ml-2 font-normal text-sm text-[var(--color-ink-600)] tabular-nums">
                {months.length}
              </span>
            </h3>
            <p className="text-[11px] text-[var(--color-ink-600)] mt-0.5">
              Restore a mis-click, or delete forever when you are sure.
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-[var(--color-ink-800)]">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <ul id="deleted-months-list" className="divide-y divide-[var(--color-ice-200)] border-t border-[var(--color-ice-200)]">
          {months.map(m => {
            const label = `${monthNameFull(m.month)} ${m.year}`;
            const whenDeleted = new Date(m.deletedAt);
            const relDeleted = formatRelative(whenDeleted);
            const busy = working === m.id;
            return (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--color-ink-900)]">
                    <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-ink-600)] mr-2 tabular-nums">
                      {MONTH_NAMES[m.month - 1]}
                    </span>
                    {label}
                  </p>
                  <p className="text-[11px] text-[var(--color-ink-600)] mt-0.5 tabular-nums">
                    {m.filledSections} of 13 sections at delete · {relDeleted}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => restore(m.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-ice-200)] px-2.5 py-1 text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)] disabled:opacity-60"
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => purge(m.id, label)}
                    disabled={busy}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-[var(--color-bad)] hover:bg-red-100 disabled:opacity-60"
                  >
                    <Trash2 size={13} />
                    Delete forever
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime();
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const days = Math.round(h / 24);
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString();
}
