"use client";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Floating zoom widget for mobile users who don't want to pinch the screen.
 *
 * Strategy:
 *   We drive a CSS zoom level via `document.documentElement.style.zoom`.
 *   `zoom` is a non-standard CSS property but is supported in Chromium
 *   (Android Chrome, Edge), Safari (incl. iOS), and recent Firefox. Applying
 *   it on <html> scales the *entire* page including this widget, which is
 *   exactly what we want — the user sees their tap target grow with the rest
 *   of the UI.
 *
 *   We persist the level to localStorage so the choice survives reloads, and
 *   re-apply it on mount.
 */

const STEPS = [0.8, 0.9, 1.0, 1.1, 1.25, 1.5] as const;
const DEFAULT_INDEX = 2; // 1.0
const STORAGE_KEY = "gm-zoom-level";

function applyZoom(level: number) {
  if (typeof document === "undefined") return;
  // Setting on documentElement (html) is what Chromium honours.
  // String value with no unit is the established usage.
  document.documentElement.style.zoom = String(level);
}

export function ZoomControls() {
  const [idx, setIdx] = useState<number>(DEFAULT_INDEX);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage and apply once on mount.
  useEffect(() => {
    try {
      const saved = parseFloat(localStorage.getItem(STORAGE_KEY) || "");
      if (Number.isFinite(saved)) {
        const i = STEPS.findIndex(s => Math.abs(s - saved) < 0.001);
        if (i >= 0) {
          setIdx(i);
          applyZoom(STEPS[i]);
        }
      }
    } catch {/* ignore quota / private mode */}
    setMounted(true);
  }, []);

  function setLevel(nextIdx: number) {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, nextIdx));
    setIdx(clamped);
    const value = STEPS[clamped];
    applyZoom(value);
    try { localStorage.setItem(STORAGE_KEY, String(value)); } catch {/* ignore */}
  }

  // Hide widget completely until mounted to avoid hydration mismatch on the
  // percentage label.
  if (!mounted) return null;

  const pct = Math.round(STEPS[idx] * 100);
  const atMin = idx === 0;
  const atMax = idx === STEPS.length - 1;
  const atDefault = idx === DEFAULT_INDEX;

  return (
    <div
      // md:hidden — desktop users have OS zoom + browser zoom, no need.
      // bottom-20 sits above the mobile tab bar (which is bottom-0 + safe-area).
      className="md:hidden fixed right-3 bottom-20 z-40 flex flex-col items-stretch
                 rounded-2xl border border-[var(--color-ice-200)]
                 bg-[var(--surface-1)]/95 backdrop-blur shadow-lg
                 pb-[env(safe-area-inset-bottom)] select-none"
      role="group"
      aria-label="Zoom controls"
    >
      <button
        type="button"
        onClick={() => setLevel(idx + 1)}
        disabled={atMax}
        aria-label="Zoom in"
        className="h-11 w-11 grid place-items-center rounded-t-2xl
                   text-[var(--color-ink-900)] hover:bg-[var(--color-ice-100)]
                   active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                   transition"
      >
        <Plus size={20} />
      </button>

      <div
        className="px-1 py-1 text-center text-[10px] font-semibold tabular-nums
                   text-[var(--color-ink-700)] border-y border-[var(--color-ice-200)]"
        aria-live="polite"
      >
        {pct}%
      </div>

      <button
        type="button"
        onClick={() => setLevel(idx - 1)}
        disabled={atMin}
        aria-label="Zoom out"
        className="h-11 w-11 grid place-items-center
                   text-[var(--color-ink-900)] hover:bg-[var(--color-ice-100)]
                   active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                   transition"
      >
        <Minus size={20} />
      </button>

      <button
        type="button"
        onClick={() => setLevel(DEFAULT_INDEX)}
        disabled={atDefault}
        aria-label="Reset zoom"
        title="Reset zoom"
        className="h-9 w-11 grid place-items-center rounded-b-2xl
                   text-[var(--color-ink-600)] hover:bg-[var(--color-ice-100)]
                   active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                   border-t border-[var(--color-ice-200)] transition"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
}
