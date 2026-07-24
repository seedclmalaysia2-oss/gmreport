"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Loader2, RotateCw, Trash2, Upload } from "lucide-react";
import { ConfirmDialog } from "./confirm-dialog";
import { Button } from "./ui/button";

/**
 * Per-row action buttons for the Files page upload-history table.
 *
 *   Replace — opens a hidden file input. The chosen file is POSTed to
 *             /api/import with the row's year/month, runs through the same
 *             parsing pipeline as a fresh import, and on success the OLD
 *             RawFile audit row is deleted so the new one replaces it
 *             visually. (Named "Replace" so it doesn't collide with the
 *             "Update — back to Slide" return CTA in the import-success
 *             card.)
 *   Remove  — DELETEs the RawFile audit row (soft-delete via /api/files).
 *             Surfaced in-vocabulary via <ConfirmDialog> because the slide
 *             data the file produced isn't reverted (we don't track per-row
 *             provenance back to numbers).
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
  const [busy, setBusy] = useState<"" | "remove" | "replace">("");
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

    setBusy("replace");
    setError(null);
    try {
      const fd = new FormData();
      fd.set("year", String(year));
      fd.set("month", String(month));
      fd.append("files", file);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Replace failed");
      }
      // Replace, not append: HARD-delete the old audit row (?purge=1) so
      // the new one cleanly takes its place. Without purge=1 the old row
      // would soft-delete into the trash, which would be confusing — the
      // user clicked Replace, not Remove.
      //
      // Purge failure isn't fatal (the new row is already saved), but we
      // surface it via the error strip so Simon knows the audit list may
      // temporarily show two entries — silent .catch(()=>{}) hid this and
      // let the list diverge from reality.
      let purgeFailed = false;
      try {
        const purgeRes = await fetch(`/api/files/${fileId}?purge=1`, { method: "DELETE" });
        if (!purgeRes.ok) purgeFailed = true;
      } catch {
        purgeFailed = true;
      }
      if (purgeFailed) {
        setError(
          "Replaced successfully, but couldn't clear the previous audit row. " +
          "Refresh the page — if you see two entries, remove the older one manually."
        );
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Replace failed");
    } finally {
      setBusy("");
    }
  }

  // Guard against tab close mid-request. Simon on a slow XLSX Replace can
  // reflex-Cmd-W the tab and lose track of whether the upload finished; the
  // native prompt gives him a bail-out.
  useEffect(() => {
    if (!isWorking) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isWorking]);

  // View = the in-app viewer page (`/files/<id>`). It renders XLSX as HTML
  // tables and PDFs in an iframe, so the file is previewed online instead of
  // being downloaded — browsers can't render .xlsx natively, so linking
  // straight to the raw-bytes API forced a "Save As" download.
  // Attachment download = forced "Save As" for an offline copy.
  const viewHref = `/files/${fileId}`;
  const downloadHref = `/api/files/${fileId}?disposition=attachment`;

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
            desktop. justify-start on mobile, justify-end on desktop (column
            is right-aligned). gap-1.5 leaves enough air between buttons that
            a thumb won't mistarget on a touch screen. */}
        <div className="flex flex-wrap items-center gap-1.5 justify-start sm:justify-end sm:flex-nowrap sm:whitespace-nowrap">
          {/* Hidden picker the Replace button drives. */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls"
            className="hidden"
            onChange={onFilePicked}
          />

          {hasBytes ? (
            <>
              <Button
                as="a"
                variant="primary"
                size="sm"
                href={viewHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Preview the file online in a new tab"
              >
                <Eye size={12} /> View
              </Button>
              <Button
                as="a"
                variant="secondary"
                size="sm"
                href={downloadHref}
                download={fileName}
                rel="noopener noreferrer"
                title="Download a copy"
              >
                <Download size={12} /> Save
              </Button>
            </>
          ) : (
            // Legacy row — uploaded before we started persisting bytea
            // content. Warn-tinted so the row visibly flags "needs
            // attention" and the one-click CTA opens the same picker as
            // Replace.
            <Button
              variant="warn"
              size="sm"
              onClick={pickFile}
              disabled={isWorking}
              title="This file was uploaded before previews were supported — re-attach it to enable View + Save"
            >
              {busy === "replace" ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Re-upload to enable preview
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={pickFile}
            disabled={isWorking}
            title="Upload a new version of this file, replacing the current one"
          >
            {busy === "replace" ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
            Replace
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={isWorking}
            title="Move this file to the trash"
          >
            {busy === "remove" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Remove
          </Button>
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
