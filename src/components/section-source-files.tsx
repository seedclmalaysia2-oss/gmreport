"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, FileText, Loader2, RefreshCw, Trash2, Upload, X } from "lucide-react";
import type { RawFileEntry } from "@/lib/month-report";

/**
 * Source-file strip shown in each section header.
 *
 * Wired DIRECTLY to the RawFile table (via the monthFiles the report page
 * fetches), so it always matches the Files page:
 *   - a file deleted on the Files page disappears here too
 *   - a file deleted here disappears on the Files page too
 *   - uploads here are the same /api/import call the Files page makes
 *
 * Per chip: a View (eye) button, a Delete (x) button, and — when more than
 * one file feeds the section — a checkbox for multi-select bulk delete.
 * A standalone "Upload file" button lets the user add POS files without
 * leaving the report; after the import finishes the page refreshes and the
 * section figures update (they can also hit Recalculate in the sidebar).
 */
export function SectionSourceFiles({
  files,
  year,
  month,
}: {
  /** RawFile rows already filtered to this section. */
  files: RawFileEntry[];
  year: number;
  month: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const multi = files.length > 1;
  const isWorking = busy || pending;

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteIds(ids: string[], label: string) {
    if (ids.length === 0) return;
    const ok = confirm(
      `Move ${label} to the trash?\n\n` +
      "It stays recoverable from the Files page → Recently deleted. " +
      "Slide figures are not rolled back — re-upload or Recalculate to refresh them."
    );
    if (!ok) return;
    setBusy(true);
    try {
      // Soft-delete each (same endpoint the Files page uses).
      await Promise.all(ids.map(id => fetch(`/api/files/${id}`, { method: "DELETE" })));
      setSelected(new Set());
      startTransition(() => router.refresh());
    } catch {
      alert("Delete failed — please try again.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Re-process the section's already-uploaded files. Pulls each file's stored
   * bytes from /api/files/{id}, re-POSTs them through the same /api/import
   * pipeline, then refreshes. This rebuilds the slide from the files on record
   * — the one-click fix when a slide's figures look stale or empty.
   */
  async function onUpdate() {
    const reusable = files.filter(f => f.hasBytes);
    if (reusable.length === 0) {
      alert("No stored file copies to re-process. Re-upload the POS file.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("year", String(year));
      fd.set("month", String(month));
      for (const f of reusable) {
        const res = await fetch(`/api/files/${f.id}`);
        if (!res.ok) throw new Error(`Could not load ${f.originalName}`);
        const blob = await res.blob();
        fd.append("files", new File([blob], f.originalName));
      }
      const imp = await fetch("/api/import", { method: "POST", body: fd });
      if (!imp.ok) {
        const body = await imp.json().catch(() => ({}));
        throw new Error(body.error || "Update failed");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = [...(e.target.files ?? [])];
    e.target.value = ""; // allow re-picking the same file
    if (picked.length === 0) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("year", String(year));
      fd.set("month", String(month));
      for (const f of picked) fd.append("files", f);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-ink-600)]">
        <span className="uppercase tracking-[0.15em] font-semibold">Source</span>

        {files.map(f => (
          <SourceChip
            key={f.id}
            file={f}
            showCheckbox={multi}
            selected={selected.has(f.id)}
            onToggle={() => toggle(f.id)}
            onDelete={() => deleteIds([f.id], `"${f.originalName}"`)}
            disabled={isWorking}
          />
        ))}

        {/* Update — re-process the files already on record for this slide. */}
        {files.length > 0 && (
          <button
            type="button"
            onClick={onUpdate}
            disabled={isWorking}
            title="Re-process this slide's uploaded file(s) and refresh the figures"
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-ink-800)]
                       bg-white text-[var(--color-ink-800)] px-2.5 py-1 font-semibold
                       hover:bg-[var(--color-ice-100)] active:scale-95 transition
                       disabled:opacity-50 dark:bg-[var(--surface-1)]"
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            Update
          </button>
        )}

        {/* Upload button — same /api/import pipeline as the Files page. */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isWorking}
          title="Upload POS file(s) for this month"
          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-ink-800)]
                     bg-[var(--color-ink-800)] text-white px-2.5 py-1 font-semibold
                     hover:bg-[var(--color-ink-700)] active:scale-95 transition
                     disabled:opacity-50"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          Upload file
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls"
          className="hidden"
          onChange={onUpload}
        />
      </div>

      {/* Bulk-delete bar — only when the user has ticked one or more chips. */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 text-[11px] rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 w-fit">
          <span className="font-semibold text-red-800">{selected.size} selected</span>
          <button
            type="button"
            onClick={() => deleteIds([...selected], `${selected.size} files`)}
            disabled={isWorking}
            className="inline-flex items-center gap-1 rounded-md bg-red-700 text-white px-2 py-1
                       font-semibold hover:bg-red-800 active:scale-95 transition disabled:opacity-50"
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            Delete selected
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={isWorking}
            className="rounded-md px-2 py-1 text-red-700 hover:bg-red-100 transition"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

function SourceChip({
  file,
  showCheckbox,
  selected,
  onToggle,
  onDelete,
  disabled,
}: {
  file: RawFileEntry;
  showCheckbox: boolean;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const dateLabel = file.createdAt
    ? new Date(file.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;
  // View opens the in-browser viewer page (renders XLSX as tables, PDF in an
  // iframe) — same destination as before, unchanged per the user's request.
  const viewHref = file.hasBytes ? `/files/${file.id}` : null;

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border pl-1.5 pr-1 py-0.5 max-w-[320px] transition",
        selected
          ? "border-red-300 bg-red-50 text-red-900"
          : "border-[var(--color-ice-200)] bg-[var(--color-ice-50)] text-[var(--color-ink-800)]",
      ].join(" ")}
    >
      {showCheckbox && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${file.originalName}`}
          className="h-3 w-3 accent-red-600 cursor-pointer"
        />
      )}
      <FileText size={11} className="shrink-0" />
      <span className="truncate">{file.originalName}</span>
      {dateLabel && (
        <span className="text-[var(--color-ink-600)] opacity-70 hidden sm:inline">· {dateLabel}</span>
      )}

      {/* View — opens the file in a new tab. Unchanged behaviour. */}
      {viewHref ? (
        <a
          href={viewHref}
          target="_blank"
          rel="noopener noreferrer"
          title={`Quick view — opens ${file.originalName}`}
          aria-label={`Quick view ${file.originalName}`}
          className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full
                     bg-[var(--color-ink-800)] text-white hover:bg-[var(--color-ink-700)]
                     active:scale-95 transition"
        >
          <Eye size={11} />
        </a>
      ) : (
        <span
          title="No stored copy — re-upload from the Files page to enable Quick view"
          className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full
                     bg-[var(--color-ice-200)] text-[var(--color-ink-600)] opacity-50"
        >
          <Eye size={11} />
        </span>
      )}

      {/* Delete — soft-delete this RawFile row. */}
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        title={`Delete ${file.originalName}`}
        aria-label={`Delete ${file.originalName}`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full
                   text-red-600 hover:bg-red-100 active:scale-95 transition
                   disabled:opacity-40"
      >
        <X size={11} />
      </button>
    </span>
  );
}
