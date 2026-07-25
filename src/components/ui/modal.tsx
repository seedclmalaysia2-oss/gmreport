"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Shared modal shell used by ConfirmDialog + the "Some files need attention"
 * import popup. Owns the pattern the app-vocabulary dialogs share:
 *
 *   - Backdrop with click-to-dismiss (respects `dismissOnBackdrop`).
 *   - ESC to dismiss.
 *   - Real focus trap: captures `document.activeElement` on open, cycles
 *     Tab / Shift+Tab within the modal's focusable elements, restores focus
 *     on close.
 *   - Header tone (neutral | warn | danger) driven by DESIGN semantic tokens.
 *   - Optional close button; footer slot for action buttons.
 *
 * The dialog role defaults to `dialog`. Passing `alertdialog` (used by
 * destructive confirmations) tells screen readers this is a synchronous
 * interruption that needs user attention.
 */
export type ModalTone = "neutral" | "warn" | "danger";

const TONE_HEADER: Record<ModalTone, string> = {
  neutral: "bg-[var(--color-ice-50)] border-[var(--color-ice-200)]",
  warn:    "bg-[var(--color-warn-50)] border-[var(--color-ice-200)]",
  danger:  "bg-[var(--color-bad-50)] border-[var(--color-ice-200)]",
};

const TONE_ICON: Record<ModalTone, string> = {
  neutral: "text-[var(--color-ink-700)]",
  warn:    "text-[var(--color-warn)]",
  danger:  "text-[var(--color-bad)]",
};

const TONE_TITLE: Record<ModalTone, string> = {
  neutral: "text-[var(--color-ink-900)]",
  warn:    "text-[var(--color-warn-900)]",
  danger:  "text-[var(--color-bad-800)]",
};

const TONE_CLOSE: Record<ModalTone, string> = {
  neutral: "hover:bg-[var(--color-ice-100)] text-[var(--color-ink-700)]",
  warn:    "hover:bg-[var(--color-warn-100)] text-[var(--color-warn-800)]",
  danger:  "hover:bg-[var(--color-bad-100)] text-[var(--color-bad-800)]",
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Modal({
  open,
  onClose,
  role = "dialog",
  tone = "neutral",
  size = "md",
  icon,
  title,
  subtitle,
  children,
  footer,
  showClose = true,
  dismissOnBackdrop = true,
  labelledById = "modal-title",
  describedById = "modal-body",
}: {
  open: boolean;
  onClose: () => void;
  role?: "dialog" | "alertdialog";
  tone?: ModalTone;
  /** md ≈ 28rem, lg ≈ 42rem (wider info dialogs like the filename hints table). */
  /** md ≈ 28rem, lg ≈ 42rem, full ≈ viewport-width up to 1600px (content-heavy previews). */
  size?: "md" | "lg" | "full";
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  showClose?: boolean;
  dismissOnBackdrop?: boolean;
  labelledById?: string;
  describedById?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // Capture the currently-focused element so we can restore focus on
    // close. Ignore body/documentElement — those aren't meaningful.
    const prev = document.activeElement as HTMLElement | null;
    const canRestore = prev && prev !== document.body && prev !== document.documentElement;

    // Focus target on open:
    //
    //   role="alertdialog"  → the SAFE default (first non-X focusable, which
    //                         is Cancel in every current call site). A
    //                         destructive alertdialog opening with focus on
    //                         the destructive button means a stray Enter or
    //                         Space commits the irreversible action.
    //   role="dialog"       → the primary action (last focusable). Info
    //                         dialogs benefit from "hit Enter to proceed"
    //                         because the destructive path isn't the default.
    //
    // In both cases fall back to the first focusable when only the X is
    // present.
    const focusables = () => Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    );
    const t = setTimeout(() => {
      const nodes = focusables();
      if (nodes.length === 0) return;
      if (nodes.length === 1) { nodes[0].focus(); return; }
      // nodes[0] is the X close button in every current layout. Skip it.
      const safeFirst = nodes[1];
      const primary = nodes[nodes.length - 1];
      const target = role === "alertdialog" ? safeFirst : primary;
      target?.focus();
    }, 20);

    // ESC dismisses.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab") return;
      // Trap Tab / Shift+Tab within the modal.
      const nodes = focusables();
      if (nodes.length === 0) { e.preventDefault(); return; }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !containerRef.current?.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !containerRef.current?.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // Second belt-and-braces layer: if focus escapes the modal via a
    // programmatic focus() call (rare but real), pull it back.
    const onFocusIn = (e: FocusEvent) => {
      if (!containerRef.current) return;
      const target = e.target as Node | null;
      if (target && !containerRef.current.contains(target)) {
        e.stopPropagation();
        const nodes = focusables();
        nodes[0]?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      if (canRestore) prev.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthClass =
    size === "full" ? "max-w-[1600px]" :
    size === "lg" ? "max-w-2xl" :
    "max-w-md";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => (dismissOnBackdrop ? onClose() : undefined)}
    >
      <div
        ref={containerRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledById}
        aria-describedby={describedById}
        className={`relative w-full ${widthClass} max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-lg flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        <header className={`flex items-start justify-between gap-3 p-5 border-b ${TONE_HEADER[tone]}`}>
          <div className="flex items-start gap-3">
            {icon && <span className={`mt-0.5 shrink-0 ${TONE_ICON[tone]}`}>{icon}</span>}
            <div>
              <h2 id={labelledById} className={`font-[var(--font-display)] text-lg font-semibold ${TONE_TITLE[tone]}`}>
                {title}
              </h2>
              {subtitle && (
                <p className={`text-sm mt-0.5 ${tone === "warn" ? "text-[var(--color-warn-800)]" : tone === "danger" ? "text-[var(--color-bad-800)]" : "text-[var(--color-ink-700)]"}`}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              className={`rounded-md p-1 disabled:opacity-50 ${TONE_CLOSE[tone]}`}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </header>

        <div id={describedById} className="overflow-y-auto p-5 text-sm text-[var(--color-ink-800)] space-y-2">
          {children}
        </div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 p-4 border-t border-[var(--color-ice-200)] bg-[var(--color-ice-50)]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
