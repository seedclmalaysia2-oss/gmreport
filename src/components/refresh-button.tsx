"use client";

/**
 * Reloads the whole page, beside the build label in the top bar. A full reload, not a router refresh,
 * so a phone that has kept the site open picks up a newer build as well as fresh figures.
 */
export function RefreshButton({ className = "shrink-0 rounded-md p-2 hover:bg-[var(--color-ice-100)] text-[var(--color-ink-800)] transition-colors" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      aria-label="Refresh the page"
      title="Refresh"
      className={className}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
