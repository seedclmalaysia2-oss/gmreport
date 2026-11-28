"use client";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/**
 * Compact icon button in the top-right corner of each month card. Click opens
 * a weighted confirm modal — a month represents weeks of keyed data, so a
 * single "Delete" + a native `confirm()` was too casual (P1 in the
 * 2026-11-28 critique). The modal spells out how many sections and files
 * will travel to the trash with this delete; the actual DELETE is soft-only
 * (the row reappears in "Recently deleted months" below the grid) so this
 * is undoable.
 *
 * Placement note: the button is `absolute` because its parent card is wrapped
 * in a `<Link>`; absolute positioning + stopPropagation keep the click from
 * navigating into the report Simon is trying to delete.
 */
export function DeleteMonthButton({
  monthId,
  label,
  filledSections,
  totalSections,
}: {
  monthId: string;
  /** e.g. "May 2026" — shown in the dialog title and body. */
  label: string;
  /** How many of the 13 sections carry data. Shown weighted in the confirm. */
  filledSections: number;
  totalSections: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isWorking = busy || pending;

  // Escape closes the modal, matching the Repair Chain / New month patterns.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openModal(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setErr(null);
    setOpen(true);
  }

  async function confirmDelete() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/months", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: monthId }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={isWorking}
        title={`Delete ${label}`}
        aria-label={`Delete ${label}`}
        className="absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center
                   rounded-full bg-white/0 text-[var(--color-ink-600)]
                   hover:bg-red-50 hover:text-red-700 active:scale-95
                   transition disabled:opacity-50"
      >
        {isWorking ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-${monthId}-title`}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/50 backdrop-blur-sm p-6"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-[480px] max-w-full rounded-2xl bg-white dark:bg-[var(--surface-1)] border border-[var(--color-ice-200)] p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span
                className="flex-none grid place-items-center h-10 w-10 rounded-full
                           bg-[var(--color-warn)]/10 text-[var(--color-warn)]"
                aria-hidden="true"
              >
                <AlertTriangle size={20} />
              </span>
              <div className="min-w-0">
                <h3 id={`delete-${monthId}-title`} className="text-lg font-semibold text-[var(--color-ink-900)]">
                  Delete {label}?
                </h3>
                <p className="mt-1 text-sm text-[var(--color-ink-600)]">
                  {filledSections > 0 ? (
                    <>
                      <strong className="text-[var(--color-ink-900)] tabular-nums">
                        {filledSections} of {totalSections} sections
                      </strong>
                      {" "}have data in this month. It will move to{" "}
                      <strong className="text-[var(--color-ink-900)]">Recently deleted months</strong>{" "}
                      on the home page — you can restore it there, or delete it for good later.
                    </>
                  ) : (
                    <>
                      This month has no section data. It will move to{" "}
                      <strong className="text-[var(--color-ink-900)]">Recently deleted months</strong>{" "}
                      on the home page where you can restore it.
                    </>
                  )}
                </p>
              </div>
            </div>

            {err && (
              <p
                role="alert"
                className="text-sm text-[var(--color-bad)] bg-red-50 border border-red-200 rounded-md px-3 py-2"
              >
                {err}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-md border border-[var(--color-ice-200)] px-3 py-1.5 text-sm font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--color-bad)] text-white px-3 py-1.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                autoFocus
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                {busy ? "Deleting…" : "Move to trash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
