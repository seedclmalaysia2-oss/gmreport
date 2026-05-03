"use client";
import { Check, Palette as PaletteIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PALETTES, applyPalette, DEFAULT_PALETTE_ID, type Palette } from "@/lib/themes";

/**
 * 12-swatch palette picker — lives in the site header. Persists to localStorage
 * via `applyPalette()`, so the choice survives reloads.
 */
export function PalettePicker() {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>(DEFAULT_PALETTE_ID);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gm-palette") ?? DEFAULT_PALETTE_ID;
      setActiveId(saved);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        if (!(e.target as HTMLElement).closest("[data-palette-popover]")) setOpen(false);
      }
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const active = PALETTES.find(p => p.id === activeId) ?? PALETTES[0];

  const choose = (p: Palette) => {
    applyPalette(p);
    setActiveId(p.id);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] px-2 py-1.5 text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)]"
        title="Pick a dashboard theme"
      >
        <PaletteIcon size={14} />
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full ring-1 ring-black/10" style={{ background: active.ink800 }} />
          <span className="inline-block w-3 h-3 rounded-full ring-1 ring-black/10" style={{ background: active.ice200 }} />
          <span className="inline-block w-3 h-3 rounded-full ring-1 ring-black/10" style={{ background: active.accent }} />
        </span>
        <span className="hidden sm:inline">{active.name}</span>
      </button>

      {open && (
        <div
          data-palette-popover
          className="absolute right-0 top-full mt-2 w-[320px] rounded-xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] shadow-lg z-50 p-3"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-ink-600)] mb-2 flex items-center justify-between">
            <span>Pick a theme</span>
            <span className="text-[10px] font-normal tracking-normal normal-case opacity-80">PPTX exports stay Midnight.</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {PALETTES.map(p => {
              const isActive = p.id === activeId;
              return (
                <button
                  key={p.id}
                  onClick={() => choose(p)}
                  className={[
                    "group relative rounded-lg border p-2 text-left hover:shadow-md transition",
                    isActive ? "border-[var(--color-ink-800)] ring-2 ring-[var(--color-ink-700)]" : "border-[var(--color-ice-200)]",
                  ].join(" ")}
                  title={p.name}
                >
                  {/* Swatch strip */}
                  <div className="flex h-9 rounded-md overflow-hidden ring-1 ring-black/5">
                    <div style={{ flex: 2, background: p.ink800 }} />
                    <div style={{ flex: 1, background: p.ink700 }} />
                    <div style={{ flex: 1, background: p.ice200 }} />
                    <div style={{ flex: 1, background: p.accent }} />
                  </div>
                  <div className="mt-1.5">
                    <div className="text-[11px] font-semibold leading-tight truncate">{p.name}</div>
                    <div className="text-[9px] uppercase tracking-[0.12em] text-[var(--color-ink-600)] truncate">{p.mood}</div>
                  </div>
                  {isActive && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--color-ink-800)] text-white grid place-items-center">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
