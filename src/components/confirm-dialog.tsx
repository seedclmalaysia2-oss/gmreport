"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, X } from "lucide-react";

export type ConfirmDialogTone = "neutral" | "danger";

/**
 * Modal confirmation dialog in the app's own vocabulary — replaces the raw
 * browser `confirm()` on destructive paths (Remove / Delete forever / bulk
 * purge). Structurally mirrors the "Some files need attention" popup in
 * import-form.tsx so the two feel like one system.
 *
 * Renders only while `open` is true; parent owns the state.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "neutral",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus lands on the primary action; ESC dismisses.
    const t = setTimeout(() => confirmBtnRef.current?.focus(), 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [open, onCancel]);

  if (!open) return null;

  const isDanger = tone === "danger";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="relative max-w-md w-full overflow-hidden rounded-2xl bg-white shadow-lg flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header
          className={[
            "flex items-start justify-between gap-3 p-5 border-b border-[var(--color-ice-200)]",
            isDanger ? "bg-[var(--color-bad-50)]" : "bg-[var(--color-ice-50)]",
          ].join(" ")}
        >
          <div className="flex items-start gap-3">
            <AlertCircle
              size={22}
              className={isDanger ? "text-[var(--color-bad)] mt-0.5 shrink-0" : "text-[var(--color-ink-700)] mt-0.5 shrink-0"}
            />
            <h2
              id="confirm-title"
              className={[
                "font-[var(--font-display)] text-lg font-semibold",
                isDanger ? "text-[var(--color-bad-800)]" : "text-[var(--color-ink-900)]",
              ].join(" ")}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md p-1 hover:bg-[var(--color-ice-100)] text-[var(--color-ink-700)] disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div id="confirm-body" className="p-5 text-sm text-[var(--color-ink-800)] space-y-2">
          {body}
        </div>

        <footer className="flex items-center justify-end gap-2 p-4 border-t border-[var(--color-ice-200)] bg-[var(--color-ice-50)]">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-[var(--color-ice-200)] bg-white px-3 py-1.5 text-sm text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-semibold text-white transition disabled:opacity-60",
              isDanger
                ? "bg-[var(--color-bad)] hover:bg-[var(--color-bad-800)]"
                : "bg-[var(--color-ink-800)] hover:bg-[var(--color-ink-700)]",
            ].join(" ")}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
