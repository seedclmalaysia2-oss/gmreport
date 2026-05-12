"use client";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Compact icon button placed in the top-right corner of each month card on
 * the dashboard. Lets the user undo an accidental "New month" click
 * (typically because the upload form defaulted to today's calendar month).
 *
 * Click → confirm dialog → DELETE /api/months → router.refresh(). The API
 * route already calls revalidatePath("/") so the dashboard re-renders with
 * the card gone. We position the button OUTSIDE the Link wrapper (via the
 * parent's `relative` + this button's `absolute` placement) so a click on
 * the X doesn't navigate the user into the report they're trying to delete.
 */
export function DeleteMonthButton({
  monthId,
  label,
}: {
  monthId: string;
  /** e.g. "May 2026" — shown in the confirmation dialog. */
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const isWorking = busy || pending;

  async function remove(e: React.MouseEvent) {
    // Stop the click from bubbling into the wrapping <Link>.
    e.preventDefault();
    e.stopPropagation();

    const ok = confirm(
      `Delete ${label}?\n\n` +
      "All section data and uploaded files for this month will be removed " +
      "from Supabase. This cannot be undone."
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch("/api/months", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: monthId }),
      });
      if (!res.ok) throw new Error("Delete failed");
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
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
  );
}
