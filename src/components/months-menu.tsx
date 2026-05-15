"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Home } from "lucide-react";
import { monthNameFull } from "@/lib/utils";
import { SECTION_KEYS, type MonthReport } from "@/lib/schema";

/** Percentage of the 13 sections that already hold data — mirrors `src/app/page.tsx`. */
function completion(m: MonthReport): number {
  const filled = SECTION_KEYS.filter(k => (m as Record<string, unknown>)[k]).length;
  return Math.round((filled / SECTION_KEYS.length) * 100);
}

/** Extract the active month id (`2026-03`) from a `/report/<id>` route, else null. */
function activeMonthId(pathname: string | null): string | null {
  const match = pathname?.match(/^\/report\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Shared hook: lazily fetch the month list the first time it's needed, then
 * cache it for the lifetime of the component. Both the desktop dropdown and the
 * mobile drawer submenu use this — each pays one cached `GET /api/months` hit.
 */
function useLazyMonths(active: boolean) {
  const [months, setMonths] = useState<MonthReport[] | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (!active || requested.current) return;
    requested.current = true;
    fetch("/api/months")
      .then(r => (r.ok ? r.json() : []))
      .then((data: MonthReport[]) => setMonths(Array.isArray(data) ? data : []))
      .catch(() => setMonths([]));
  }, [active]);

  return months;
}

/**
 * Group a year-desc/month-desc sorted list into `{ year, months }` buckets.
 * `listMonthReports()` already sorts, so a single pass is enough.
 */
function groupByYear(months: MonthReport[]): { year: number; months: MonthReport[] }[] {
  const groups: { year: number; months: MonthReport[] }[] = [];
  for (const m of months) {
    let bucket = groups[groups.length - 1];
    if (!bucket || bucket.year !== m.year) {
      bucket = { year: m.year, months: [] };
      groups.push(bucket);
    }
    bucket.months.push(m);
  }
  return groups;
}

/**
 * Desktop "Months" nav item — a click-to-open dropdown listing every month
 * report. Built on the same popover pattern as `palette-picker.tsx`.
 */
export function MonthsMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const months = useLazyMonths(open);
  const activeId = activeMonthId(pathname);

  // Close the dropdown whenever the route changes (i.e. a month was picked).
  useEffect(() => setOpen(false), [pathname]);

  // Click-outside to dismiss — mirrors palette-picker.tsx.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        if (!(e.target as HTMLElement).closest("[data-months-popover]")) setOpen(false);
      }
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const groups = months ? groupByYear(months) : [];

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)]"
      >
        <Home size={15} />
        <span>Months</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          data-months-popover
          role="menu"
          className="absolute left-0 top-full mt-2 w-64 max-h-[70vh] overflow-auto rounded-xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] shadow-lg z-50 p-2"
        >
          <Link
            href="/"
            className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)]"
          >
            <span>View all months</span>
            <span aria-hidden>→</span>
          </Link>

          <div className="my-1 border-t border-[var(--color-ice-200)]" />

          {months === null && (
            <p className="px-3 py-3 text-xs text-[var(--color-ink-600)]">Loading…</p>
          )}

          {months !== null && months.length === 0 && (
            <p className="px-3 py-3 text-xs text-[var(--color-ink-600)]">
              No months yet —{" "}
              <Link href="/files" className="underline">
                import POS files
              </Link>
              .
            </p>
          )}

          {groups.map(group => (
            <div key={group.year} className="mb-1 last:mb-0">
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-ink-600)]">
                {group.year}
              </p>
              {group.months.map(m => {
                const isActive = m.id === activeId;
                return (
                  <Link
                    key={m.id}
                    href={`/report/${m.id}`}
                    role="menuitem"
                    className={[
                      "flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm",
                      isActive
                        ? "bg-[var(--color-ink-800)] text-white"
                        : "text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)]",
                    ].join(" ")}
                  >
                    <span>{monthNameFull(m.month)} {m.year}</span>
                    <span
                      className={[
                        "shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-[var(--color-ice-100)] text-[var(--color-ink-700)]",
                      ].join(" ")}
                    >
                      {completion(m)}%
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Mobile-drawer counterpart — an expandable "Jump to month" section. Lazily
 * fetches the same list when first expanded.
 */
export function MonthsDrawerSection() {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const months = useLazyMonths(expanded);
  const activeId = activeMonthId(pathname);
  const groups = months ? groupByYear(months) : [];

  return (
    <div className="border-t border-[var(--color-ice-200)] mt-1 pt-1">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between rounded-lg px-3 h-11 text-[15px] font-medium text-[var(--color-ink-900)] hover:bg-[var(--color-ice-100)]"
      >
        <span>Jump to month</span>
        <ChevronDown size={18} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="pb-1">
          {months === null && (
            <p className="px-3 py-2 text-xs text-[var(--color-ink-600)]">Loading…</p>
          )}
          {months !== null && months.length === 0 && (
            <p className="px-3 py-2 text-xs text-[var(--color-ink-600)]">No months yet.</p>
          )}
          {groups.map(group => (
            <div key={group.year}>
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-ink-600)]">
                {group.year}
              </p>
              {group.months.map(m => {
                const isActive = m.id === activeId;
                return (
                  <Link
                    key={m.id}
                    href={`/report/${m.id}`}
                    className={[
                      "flex items-center rounded-lg px-3 h-10 text-[14px]",
                      isActive
                        ? "bg-[var(--color-ink-800)] text-white font-medium"
                        : "text-[var(--color-ink-900)] hover:bg-[var(--color-ice-100)]",
                    ].join(" ")}
                  >
                    {monthNameFull(m.month)} {m.year}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
