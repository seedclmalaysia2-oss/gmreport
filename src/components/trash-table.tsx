"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { FileTrashActions } from "./file-trash-actions";
import { ConfirmDialog } from "./confirm-dialog";
import { Button } from "./ui/button";
import { monthNameFull } from "@/lib/utils";
import { fmtBytes, fmtTimestamp } from "@/lib/format";
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
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);

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

  async function bulkRestore() {
    if (selected.size === 0) return;
    await runBulk("restore");
  }

  async function bulkPurge() {
    if (selected.size === 0) return;
    await runBulk("purge");
    setPurgeConfirmOpen(false);
  }

  async function runBulk(action: "purge" | "restore") {
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

  // Guard against tab close mid-bulk PURGE only — a mid-purge close would
  // leave the list in a mixed irrecoverable state. Bulk Restore is
  // idempotent (rerunning it is safe), so prompting there is disruption
  // inflation; Simon closing the tab after "Restore selected" should just
  // work.
  useEffect(() => {
    if (busy !== "purge") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [busy]);

  return (
    <div className="space-y-3">
      {/* Selection toolbar — appears whenever ≥1 row is checked. Sticky so it
          stays visible as the user scrolls through a long trash list. */}
      {selected.size > 0 && (
        <div className="sticky top-14 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-ice-200)] bg-white shadow-sm px-3 sm:px-4 py-2">
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
            <Button
              variant="secondary"
              size="md"
              onClick={bulkRestore}
              disabled={isWorking}
            >
              {busy === "restore" ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Restore selected
            </Button>
            <Button
              variant="destructive-solid"
              size="md"
              onClick={() => setPurgeConfirmOpen(true)}
              disabled={isWorking}
            >
              {busy === "purge" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Delete {selected.size} forever
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-[var(--color-bad-200)] bg-[var(--color-bad-50)] px-3 py-2 text-xs text-[var(--color-bad-800)]"
        >
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

      <ConfirmDialog
        open={purgeConfirmOpen}
        tone="danger"
        title={`Delete ${selected.size} file${selected.size === 1 ? "" : "s"} permanently?`}
        confirmLabel={`Delete ${selected.size} forever`}
        cancelLabel="Keep in trash"
        busy={busy === "purge"}
        onCancel={() => (busy === "purge" ? undefined : setPurgeConfirmOpen(false))}
        onConfirm={bulkPurge}
        body={
          <>
            <p>
              The file bytes and audit rows will be removed from Supabase and cannot
              be recovered.
            </p>
            <p className="text-[var(--color-ink-600)]">
              Slide numbers produced by these files are not affected.
            </p>
          </>
        }
      />
    </div>
  );
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
              <div className="tabular-nums">{fmtBytes(file.byteSize)}</div>
              <div className="tabular-nums">Deleted {fmtTimestamp(file.deletedAt)}</div>
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
