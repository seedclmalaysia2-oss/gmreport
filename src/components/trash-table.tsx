"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { FileTrashActions } from "./file-trash-actions";
import { monthNameFull } from "@/lib/utils";
import type { RawFileEntry } from "@/lib/month-report";

/**
 * Client-side table for the "Recently deleted" trash bin.
 *
 * Wraps the per-row Restore / Delete forever actions with a multi-select
 * UI: a checkbox in every row + a header "select all" checkbox + a
 * floating action bar that appears whenever something is selected.
 *
 * Bulk actions hit POST /api/files/bulk so the whole batch is one
 * round-trip instead of N individual DELETE calls.
 */
export function TrashTable({
  files,
}: {
  files: (RawFileEntry & { deletedAt: string })[];
}) {
  const router = useRouter();
  const [pendingNav, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<"" | "purge" | "restore">("");
  const [error, setError] = useState<string | null>(null);

  const allIds = useMemo(() => files.map(f => f.id), [files]);
  const allSelected = selected.size > 0 && selected.size === allIds.length;
  const someSelected = selected.size > 0 && !allSelected;
  const isWorking = busy !== "" || pendingNav;

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev => (prev.size === allIds.length ? new Set() : new Set(allIds)));
  }

  async function bulk(action: "purge" | "restore") {
    if (selected.size === 0) return;
    if (action === "purge") {
      const ok = confirm(
        `Permanently delete ${selected.size} file${selected.size === 1 ? "" : "s"}?\n\n` +
        "The file content and audit rows will be removed from Supabase and " +
        "cannot be recovered. (Slide numbers produced by these files are not affected.)"
      );
      if (!ok) return;
    }
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/files/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Bulk ${action} failed (${res.status})`);
      setSelected(new Set());
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : `Bulk ${action} failed`);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-3">
      {/* Selection toolbar — appears whenever ≥1 row is checked. Sticky so it
          stays visible as the user scrolls through a long trash list. */}
      {selected.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-ink-200)] bg-white shadow-sm px-3 sm:px-4 py-2">
          <span className="text-sm font-semibold text-[var(--color-ink-900)]">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            disabled={isWorking}
            className="text-xs text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)] underline disabled:opacity-50"
          >
            Clear selection
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => bulk("restore")}
              disabled={isWorking}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold
                         bg-emerald-100 text-emerald-800 hover:bg-emerald-200
                         active:scale-95 transition disabled:opacity-50"
            >
              {busy === "restore" ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Restore selected
            </button>
            <button
              type="button"
              onClick={() => bulk("purge")}
              disabled={isWorking}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold
                         bg-red-600 text-white hover:bg-red-700
                         active:scale-95 transition disabled:opacity-50"
            >
              {busy === "purge" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Delete {selected.size} forever
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--color-ice-200)] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-[var(--color-ink-600)] bg-[var(--color-ice-50)]">
              <tr>
                <th className="px-3 sm:px-4 py-2 w-[40px]">
                  {/* Header select-all checkbox. `indeterminate` triggers when some
                      but not all rows are selected — pure UX cue. */}
                  <input
                    type="checkbox"
                    aria-label={allSelected ? "Deselect all" : "Select all"}
                    checked={allSelected}
                    ref={el => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    disabled={isWorking || files.length === 0}
                    className="size-4 cursor-pointer accent-[var(--color-ink-800)]"
                  />
                </th>
                <th className="text-left px-3 sm:px-5 py-2">File</th>
                <th className="text-left px-3 sm:px-5 py-2 hidden sm:table-cell">Month</th>
                <th className="text-right px-3 sm:px-5 py-2 w-[80px] hidden sm:table-cell">Size</th>
                <th className="text-right px-3 sm:px-5 py-2 w-[140px] hidden md:table-cell">Deleted</th>
                <th className="text-right px-3 sm:px-5 py-2 w-[220px] hidden sm:table-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map(f => (
                <TrashRow
                  key={f.id}
                  file={f}
                  checked={selected.has(f.id)}
                  disabled={isWorking}
                  onToggle={() => toggleOne(f.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function fmtBytes(size: number | null | undefined): string {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function TrashRow({
  file,
  checked,
  disabled,
  onToggle,
}: {
  file: RawFileEntry & { deletedAt: string };
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <tr
      className={[
        "border-t border-[var(--color-ice-100)] align-top transition-colors",
        checked ? "bg-[var(--color-ice-50)]" : "",
      ].join(" ")}
    >
      <td className="px-3 sm:px-4 py-2.5">
        <input
          type="checkbox"
          aria-label={`Select ${file.originalName}`}
          checked={checked}
          onChange={onToggle}
          disabled={disabled}
          className="size-4 cursor-pointer accent-[var(--color-ink-800)]"
        />
      </td>
      <td className="px-3 sm:px-5 py-2.5">
        <div className="flex items-start gap-2">
          <FileText size={14} className="text-[var(--color-ink-600)] mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="break-all font-medium text-[var(--color-ink-900)]">{file.originalName}</div>
            <div className="sm:hidden text-[11px] text-[var(--color-ink-600)] mt-0.5 space-y-0.5">
              <div>{monthNameFull(file.month)} {file.year}</div>
              <div>{fmtBytes(file.byteSize)}</div>
              <div>Deleted {fmtTimestamp(file.deletedAt)}</div>
            </div>
            <div className="sm:hidden mt-2">
              <FileTrashActions fileId={file.id} fileName={file.originalName} />
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 sm:px-5 py-2.5 hidden sm:table-cell text-[var(--color-ink-700)]">
        {monthNameFull(file.month)} {file.year}
      </td>
      <td className="px-3 sm:px-5 py-2.5 text-right text-[var(--color-ink-600)] tabular-nums hidden sm:table-cell">
        {fmtBytes(file.byteSize)}
      </td>
      <td className="px-3 sm:px-5 py-2.5 text-right text-[var(--color-ink-600)] tabular-nums whitespace-nowrap hidden md:table-cell">
        {fmtTimestamp(file.deletedAt)}
      </td>
      <td className="px-3 sm:px-5 py-2.5 hidden sm:table-cell">
        <FileTrashActions fileId={file.id} fileName={file.originalName} />
      </td>
    </tr>
  );
}
