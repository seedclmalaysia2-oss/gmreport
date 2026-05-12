"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Loader2, RotateCw, Trash2, Upload } from "lucide-react";

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
      `Move "${fileName}" to the trash?\n\n` +
      "It will disappear from the active list but you can restore it from " +
      'the "Recently deleted" section at the bottom of this page. Slide ' +
      "numbers produced by this file are unaffected either way."
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
      // Replace, not append: HARD-delete the old audit row (?purge=1) so
      // the new one cleanly takes its place. Without purge=1 the old row
      // would soft-delete into the trash, which would be confusing — the
      // user clicked Update, not Remove. Failures here are non-fatal.
      await fetch(`/api/files/${fileId}?purge=1`, { method: "DELETE" }).catch(() => {});
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
    // flex-wrap on mobile (when this row sits under the filename) — straight
    // line on desktop. justify-start on mobile, justify-end on desktop, since
    // the desktop column is right-aligned. gap-1.5 leaves enough air between
    // buttons that a thumb won't mistarget on a touch screen.
    <div className="flex flex-wrap items-center gap-1.5 justify-start sm:justify-end sm:flex-nowrap sm:whitespace-nowrap">
      {/* Hidden picker the Update button drives. */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.xlsx,.xls"
        className="hidden"
        onChange={onFilePicked}
      />

      {hasBytes ? (
        <>
          {/* View + Save are the primary affordances — filled background so
              they read as "do something with the file", whereas Update +
              Remove read as secondary. */}
          <a
            href={viewHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Open file in a new tab"
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold
                       bg-[var(--color-ink-800)] text-white hover:bg-[var(--color-ink-700)]
                       active:scale-95 transition"
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
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold
                       bg-[var(--color-ice-100)] text-[var(--color-ink-800)] hover:bg-[var(--color-ice-200)]
                       active:scale-95 transition"
          >
            <Download size={12} /> Save
          </a>
        </>
      ) : (
        // Legacy row — uploaded before we started persisting bytea content.
        // Surface a single clear CTA that triggers the same picker as Update,
        // so the user can attach the original file again and unlock preview
        // / download with one click instead of hunting through the menu.
        <button
          type="button"
          onClick={pickFile}
          disabled={isWorking}
          title="This file was uploaded before previews were supported — re-attach it to enable View + Save"
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold
                     bg-amber-100 text-amber-800 hover:bg-amber-200
                     active:scale-95 transition disabled:opacity-50"
        >
          {busy === "update" ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          Re-upload to enable preview
        </button>
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
