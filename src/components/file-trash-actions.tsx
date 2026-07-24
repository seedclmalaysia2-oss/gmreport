"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * Action buttons for rows in the "Recently deleted" section.
 *
 *   Restore        — POST /api/files/{id}/restore. Clears the deletedAt
 *                    tombstone so the row reappears in the active list
 *                    above. One-tap recovery for accidental deletes.
 *   Delete forever — DELETE /api/files/{id}?purge=1. Actually removes
 *                    the bytea + metadata from Postgres. Confirmation
 *                    is firm because there's no further undo.
 */
export function FileTrashActions({
  fileId,
  fileName,
}: {
  fileId: string;
  fileName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"" | "restore" | "purge">("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isWorking = busy !== "" || pending;

  async function restore() {
    setBusy("restore");
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Restore failed");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy("");
    }
  }

  async function doPurge() {
    setBusy("purge");
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}?purge=1`, { method: "DELETE" });
      if (!res.ok) throw new Error("Permanent delete failed");
      setConfirmOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Permanent delete failed");
    } finally {
      setBusy("");
    }
  }

  const secondary =
    "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold " +
    "bg-white border border-[var(--color-ice-200)] text-[var(--color-ink-800)] " +
    "hover:bg-[var(--color-ice-50)] active:scale-95 transition disabled:opacity-50";
  const destructive =
    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold " +
    "text-[var(--color-bad)] hover:bg-[var(--color-bad-50)] " +
    "active:scale-95 transition disabled:opacity-50";

  return (
    <>
      <div className="flex flex-col items-start sm:items-end gap-1 sm:gap-1.5 w-full sm:w-auto">
        {error && (
          <div
            role="alert"
            className="w-full sm:w-auto rounded-md border border-[var(--color-bad-200)] bg-[var(--color-bad-50)] px-2 py-1 text-[11px] text-[var(--color-bad-800)]"
          >
            {error}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5 justify-start sm:justify-end sm:flex-nowrap sm:whitespace-nowrap">
          <button
            type="button"
            onClick={restore}
            disabled={isWorking}
            title="Restore to the active list"
            className={secondary}
          >
            {busy === "restore" ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            Restore
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={isWorking}
            title="Delete permanently — cannot be undone"
            className={destructive}
          >
            {busy === "purge" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Delete forever
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title="Delete permanently?"
        confirmLabel="Delete forever"
        cancelLabel="Keep in trash"
        busy={busy === "purge"}
        onCancel={() => (busy === "purge" ? undefined : setConfirmOpen(false))}
        onConfirm={doPurge}
        body={
          <>
            <p>
              <span className="font-semibold text-[var(--color-ink-900)] break-all">{fileName}</span>{" "}
              will be removed from Supabase along with its file bytes and audit row.
              This cannot be undone.
            </p>
            <p className="text-[var(--color-ink-600)]">
              Slide numbers produced by this file are not affected.
            </p>
          </>
        }
      />
    </>
  );
}
