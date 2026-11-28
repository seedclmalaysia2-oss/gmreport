import type { Metadata } from "next";
import { PalettePicker } from "@/components/palette-picker";
import { ThemeToggle } from "@/components/theme-toggle";

// A settings surface: today holds the dashboard-chrome palette (moved out of
// the top bar, where it was decoration for Simon who picks a palette once and
// leaves it), plus the theme toggle. Kept narrow so adding future preferences
// (default FX override, PPTX template default, etc.) slots in without a
// redesign.
export const metadata: Metadata = {
  title: "Settings · Malaysia GM Report Dashboard",
};

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-ink-600)] font-semibold">
          Settings
        </p>
        <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink-900)] leading-none">
          Dashboard preferences
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-600)]">
          These change what the dashboard looks like on this machine. They do
          not affect the exported PPTX or anything HQ sees.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] p-5 space-y-4">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0 max-w-md">
            <h2 className="text-sm font-semibold text-[var(--color-ink-900)]">Theme</h2>
            <p className="mt-1 text-sm text-[var(--color-ink-600)]">
              Light or dark surface. Follows your system setting by default;
              toggles here override it until you change it back.
            </p>
          </div>
          <ThemeToggle className="inline-flex items-center gap-2 rounded-md border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] px-3 py-1.5 text-sm font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)]" />
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] p-5 space-y-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--color-ink-900)]">Dashboard palette</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-600)]">
            Twelve calibrated palettes, each derived from a single hue family.
            Every palette ships a dark-mode surface ladder with verified ≥11:1
            number contrast. PPTX exports are controlled separately on the
            Export page.
          </p>
        </div>
        <div>
          <PalettePicker />
        </div>
      </section>
    </div>
  );
}
