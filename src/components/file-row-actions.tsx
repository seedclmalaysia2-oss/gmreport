"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Loader2, RotateCw, Trash2, Upload } from "lucide-react";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * Per-row action buttons for the Files page upload-history table.
 *
 *   Update — opens a hidden file input. The chosen file is POSTed to
 *            /api/import with the row's year/month, runs through the same
 *            parsing pipeline as a fresh import, and on success the OLD
 *            RawFile audit row is deleted so the new one replaces it
 *            visually.
 *   Remove — DELETEs the RawFile audit row. We surface an in-vocabulary
 *            confirmation because the slide data the file produced is NOT
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isWorking = busy !== "" || pending;

  async function doRemove() {
    setBusy("remove");
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Remove failed");
      setConfirmOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
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
    setError(null);
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
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy("");
    }
  }

  // View = the in-app viewer page (`/files/<id>`). It renders XLSX as HTML
  // tables and PDFs in an iframe, so the file is previewed online instead of
  // being downloaded — browsers can't render .xlsx natively, so linking
  // straight to the raw-bytes API forced a "Save As" download.
  // Attachment download = forced "Save As" for an offline copy.
  const viewHref = `/files/${fileId}`;
  const downloadHref = `/api/files/${fileId}?disposition=attachment`;

  // Three button roles across the row: primary (ink-solid, one per row), the
  // remaining verbs share the secondary shell, destructive is text-only. Same
  // vocabulary as file-trash-actions.tsx so the two rows read as one system.
  const primary =
    "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold " +
    "bg-[var(--color-ink-800)] text-white hover:bg-[var(--color-ink-700)] " +
    "active:scale-95 transition disabled:opacity-50";
  const secondary =
    "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold " +
    "bg-white border border-[var(--color-ice-200)] text-[var(--color-ink-800)] " +
    "hover:bg-[var(--color-ice-50)] active:scale-95 transition disabled:opacity-50";
  const destructive =
    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold " +
    "text-[var(--color-bad)] hover:bg-[var(--color-bad-50)] " +
    "disabled:opacity-50 disabled:cursor-not-allowed transition";
  const warnPrimary =
    "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold " +
    "bg-[var(--color-warn-100)] text-[var(--color-warn-800)] hover:bg-[var(--color-warn-200)] " +
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
        {/* flex-wrap on mobile (row sits under filename) — straight line on
            desktop. justify-start on mobile, justify-end on desktop (column is
            right-aligned). gap-1.5 leaves enough air between buttons that a
            thumb won't mistarget on a touch screen. */}
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
              <a
                href={viewHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Preview the file online in a new tab"
                className={primary}
              >
                <Eye size={12} /> View
              </a>
              <a
                href={downloadHref}
                download={fileName}
                title="Download a copy"
                rel="noopener noreferrer"
                className={secondary}
              >
                <Download size={12} /> Save
              </a>
            </>
          ) : (
            // Legacy row — uploaded before we started persisting bytea content.
            // Warn-tinted so the row visibly flags "needs attention" and the
            // one-click CTA opens the same picker as Update.
            <button
              type="button"
              onClick={pickFile}
              disabled={isWorking}
              title="This file was uploaded before previews were supported — re-attach it to enable View + Save"
              className={warnPrimary}
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
            className={secondary}
          >
            {busy === "update" ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
            Update
          </button>

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={isWorking}
            title="Move this file to the trash"
            className={destructive}
          >
            {busy === "remove" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Remove
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        tone="neutral"
        title="Move file to trash?"
        confirmLabel="Move to trash"
        cancelLabel="Keep"
        busy={busy === "remove"}
        onCancel={() => (busy === "remove" ? undefined : setConfirmOpen(false))}
        onConfirm={doRemove}
        body={
          <>
            <p>
              <span className="font-semibold text-[var(--color-ink-900)] break-all">{fileName}</span>{" "}
              will disappear from the active list but you can restore it from the
              <em> Recently deleted</em> section at the bottom of this page.
            </p>
            <p className="text-[var(--color-ink-600)]">
              Slide numbers produced by this file are unaffected either way.
            </p>
          </>
        }
      />
    </>
  );
}
