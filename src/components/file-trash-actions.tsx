"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";

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
  const isWorking = busy !== "" || pending;

  async function restore() {
    setBusy("restore");
    try {
      const res = await fetch(`/api/files/${fileId}/restore`, { method: "POST" });
      if (!res.ok) throw new Error("Restore failed");
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy("");
    }
  }

  async function purge() {
    const ok = confirm(
      `Permanently delete "${fileName}"?\n\n` +
      "The file content and audit row will be removed from Supabase and " +
      "cannot be recovered. (Slide numbers produced by this file are not " +
      "affected.)"
    );
    if (!ok) return;
    setBusy("purge");
    try {
      const res = await fetch(`/api/files/${fileId}?purge=1`, { method: "DELETE" });
      if (!res.ok) throw new Error("Permanent delete failed");
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Permanent delete failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 justify-start sm:justify-end sm:flex-nowrap sm:whitespace-nowrap">
      <button
        type="button"
        onClick={restore}
        disabled={isWorking}
        title="Restore to the active list"
        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold
                   bg-emerald-100 text-emerald-800 hover:bg-emerald-200
                   active:scale-95 transition disabled:opacity-50"
      >
        {busy === "restore" ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
        Restore
      </button>
      <button
        type="button"
        onClick={purge}
        disabled={isWorking}
        title="Delete permanently — cannot be undone"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold
                   text-red-700 hover:bg-red-50
                   active:scale-95 transition disabled:opacity-50"
      >
        {busy === "purge" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        Delete forever
      </button>
    </div>
  );
}
