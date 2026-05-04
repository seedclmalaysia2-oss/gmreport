"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Loader2, RotateCw, Trash2 } from "lucide-react";

/**
 * Per-row action buttons for the Files page upload-history table.
 *
 *   Update — opens a hidden file input. The chosen file is POSTed to
 *            /api/import with the row's year/month, runs through the same
 *            parsing pipeline as a fresh import, and on success the OLD
 *            RawFile audit row is deleted so the new one replaces it
 *            visually.
 *   Remove — DELETEs the RawFile audit row. We surface a confirmation
 *            dialog because the slide data the file produced is NOT
 *            reverted (we don't track per-row provenance back to numbers).
 *
 * Both end with router.refresh() so the server component re-renders the
 * list with the updated set of rows.
 */
export function FileRowActions({
  fileId,
  year,
  month,
  fileName,
  hasBytes,
}: {
  fileId: string;
  year: number;
  month: number;
  fileName: string;
  /** False for legacy rows imported before we started storing bytea content. */
  hasBytes: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"" | "remove" | "update">("");
  const isWorking = busy !== "" || pending;

  async function remove() {
    const ok = confirm(
      `Remove "${fileName}" from the upload log?\n\n` +
      "This deletes the file record from Supabase but does NOT roll back the " +
      "slide numbers it produced. To recompute the slides, re-import a fresh " +
      "version of this file."
    );
    if (!ok) return;
    setBusy("remove");
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Remove failed");
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy("");
    }
  }

  function pickFile() {
    fileInputRef.current?.click();
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Always reset the input so the SAME file can be picked twice in a row.
    if (e.target) e.target.value = "";
    if (!file) return;

    setBusy("update");
    try {
      const fd = new FormData();
      fd.set("year", String(year));
      fd.set("month", String(month));
      fd.append("files", file);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Update failed");
      }
      // Replace, not append: drop the old audit row so the new one takes its
      // place in the Files table. Failures here just mean both rows linger
      // — non-fatal.
      await fetch(`/api/files/${fileId}`, { method: "DELETE" }).catch(() => {});
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy("");
    }
  }

  // Inline view = open in a new tab (PDF renders, XLSX downloads — browsers
  // don't render xlsx natively but the request still streams).
  // Attachment download = forced "Save As".
  const viewHref = `/api/files/${fileId}?disposition=inline`;
  const downloadHref = `/api/files/${fileId}?disposition=attachment`;

  return (
    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
      {/* Hidden picker the Update button drives. */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.xlsx,.xls"
        className="hidden"
        onChange={onFilePicked}
      />

      {hasBytes && (
        <>
          <a
            href={viewHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Open file in a new tab"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold
                       text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)] transition"
          >
            <Eye size={12} /> View
          </a>
          <a
            href={downloadHref}
            // <a download> requests the browser save-as dialog. We still set
            // the header server-side so this works even when the attribute
            // is ignored (older browsers, cross-origin, etc.).
            download={fileName}
            title="Download a copy"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold
                       text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)] transition"
          >
            <Download size={12} /> Save
          </a>
        </>
      )}

      <button
        type="button"
        onClick={pickFile}
        disabled={isWorking}
        title="Upload a new version of this file"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold
                   text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)]
                   disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {busy === "update" ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
        Update
      </button>

      <button
        type="button"
        onClick={remove}
        disabled={isWorking}
        title="Delete the audit-log entry"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold
                   text-red-700 hover:bg-red-50
                   disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {busy === "remove" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        Remove
      </button>
    </div>
  );
}
