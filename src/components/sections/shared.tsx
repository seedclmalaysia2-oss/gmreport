"use client";
import * as React from "react";
import Link from "next/link";
import type { SourceFile } from "@/lib/schema";
import { SECTION_META, type SectionKey } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { AlertTriangle, Eye, FileText, FileUp } from "lucide-react";

// Per-section hint about which raw POS file feeds it. Drives the missing-data banner.
const FILE_HINT: Partial<Record<SectionKey, string>> = {
  salesAchievement:    "POS master PDF (Stock Sales Analysis Summary - By Group). The Grand Total fills this month's actual.",
  salesTrend:          "Auto-computed from Sales Achievement — fill that section first.",
  marketOutlook:       "Manual entry — paste your monthly market commentary.",
  dailySales:          "POS daily PDF/Excel (e.g. Daily Sales Quantity.xlsx).",
  salesByQuantity:     "POS master PDF + the three MCUV colour PDFs (BLUE / ORANGE / PEGA).",
  topProducts:         "POS master PDF + the three MCUV colour PDFs.",
  salesByECP:          "Outlet-level Excel (Monthly Sales Performance.xlsx) + ECP List.xlsx.",
  salesByRegion:       "Same as ECP — needs the outlet Excel + ECP List.xlsx.",
  productRegistration: "Manual entry — MDA pipeline status.",
  inventory:           "Stock list Excel (SCLM - Stock List YYYY.MM.DD.xlsx).",
  expireWriteOff:      "Stock write-off PDF (Stocks Write Off Report MMM-MMM YY.pdf).",
  financial:           "Collection Listing.xlsx for the Collection row; AR / AP / Cashflow are manual.",
  otherMarket:         "Manual entry — competitor intel, launch notes, pricing comps.",
};

// Context fed by <ReportEditor> so every SectionShell knows which month we're
// editing (for the "Go to Import" deep-link) and which files last fed it
// (for the source chips rendered below the missing-data banner).
export type SectionShellContextValue = {
  reportId: string;
  year: number;
  month: number;
  sourceFiles?: Record<string, SourceFile[]>;
  /** Filename → RawFile.id for active uploads. Lets each source chip
   *  expose a "View" link that streams the file out of /api/files/{id}
   *  with disposition=inline. */
  fileIdsByName?: Record<string, string>;
};
export const SectionShellContext = React.createContext<SectionShellContextValue | null>(null);

function useSectionShellContext() {
  return React.useContext(SectionShellContext);
}

export function SectionShell({
  sectionKey, subtitle, isMissing, children,
}: { sectionKey: SectionKey; subtitle?: string; isMissing?: boolean; children: React.ReactNode }) {
  const m = SECTION_META[sectionKey];
  const hint = FILE_HINT[sectionKey];
  const ctx = useSectionShellContext();

  // "Go to Import" now carries the source URL so the Files page (which hosts
  // the uploader) can route you back to this exact slide when the upload
  // finishes. /import still works as a redirect for old bookmarks.
  const importHref = ctx
    ? `/files?year=${ctx.year}&month=${ctx.month}&from=${encodeURIComponent(`/report/${ctx.reportId}?section=${sectionKey}`)}&section=${sectionKey}#upload`
    : "/files#upload";

  const sources: SourceFile[] = ctx?.sourceFiles?.[sectionKey] ?? [];

  return (
    <div className="space-y-5 animate-fadein">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-600)]">
          Slide {m.no}
        </div>
        <h2 className="font-[var(--font-display)] text-3xl font-semibold mt-1">{m.title}</h2>
        {subtitle && <p className="text-[var(--color-ink-600)] mt-1 text-sm">{subtitle}</p>}
      </header>

      {/* Source-file chips — shown when an import has populated this slide.
          Each chip surfaces a quick "View" eye-icon that opens our in-browser
          viewer page at /files/{id}. The page renders XLSX as HTML tables and
          PDFs in an iframe, so the user can sanity-check the source numbers
          without triggering a download. The chip falls back to a plain label
          (no view button) on legacy rows where we don't have an id. */}
      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-ink-600)]">
          <span className="uppercase tracking-[0.15em] font-semibold">Source</span>
          {sources.map((f, i) => {
            const fileId = ctx?.fileIdsByName?.[f.name];
            const viewHref = fileId ? `/files/${fileId}` : null;
            return (
              <span
                key={i}
                title={f.at ? `Imported ${new Date(f.at).toLocaleString()}` : undefined}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-ice-200)] bg-[var(--color-ice-50)] pl-2 pr-1 py-0.5 text-[var(--color-ink-800)] max-w-[320px]"
              >
                <FileText size={11} />
                <span className="truncate">{f.name}</span>
                {f.at && (
                  <span className="text-[var(--color-ink-600)] opacity-70 hidden sm:inline">
                    · {new Date(f.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                )}
                {viewHref ? (
                  <a
                    href={viewHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Quick view — opens ${f.name} in a new tab`}
                    aria-label={`Quick view ${f.name}`}
                    className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full
                               bg-[var(--color-ink-800)] text-white hover:bg-[var(--color-ink-700)]
                               active:scale-95 transition"
                  >
                    <Eye size={11} />
                  </a>
                ) : (
                  <span
                    title="No stored copy of this file — re-upload from the Files page to enable Quick view"
                    className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full
                               bg-[var(--color-ice-200)] text-[var(--color-ink-600)] opacity-50"
                  >
                    <Eye size={11} />
                  </span>
                )}
              </span>
            );
          })}
          <Link
            href={importHref}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-[var(--color-ice-200)] px-2 py-0.5 hover:bg-[var(--color-ice-100)] text-[var(--color-ink-800)]"
          >
            <FileUp size={11} /> Replace file
          </Link>
        </div>
      )}

      {isMissing && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30 p-3 flex items-start gap-3">
          <AlertTriangle className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" size={18} />
          <div className="text-sm flex-1">
            <p className="font-semibold text-amber-900 dark:text-amber-100">No data yet on this slide.</p>
            {hint && (
              <p className="text-amber-800 dark:text-amber-200/80 mt-0.5">
                {hint}
              </p>
            )}
            <Link
              href={importHref}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-700 dark:bg-amber-600 hover:bg-amber-800 text-white px-2.5 py-1 text-xs font-semibold"
            >
              <FileUp size={12} /> Go to Import
            </Link>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-[var(--color-ice-200)] bg-white p-5">
        {children}
      </div>
    </div>
  );
}

export function NumberCell({
  value, onChange, placeholder, suffix, className,
  decimals = 0, variant = "card",
  align = "right", size = "sm",
  bold = false,
}: {
  value: number | null | undefined;
  onChange: (n: number | null) => void;
  placeholder?: string;
  suffix?: string;
  className?: string;
  /** Number of decimal places to preserve. Default 0 (whole numbers). */
  decimals?: number;
  /** "card" = default bordered input; "plain" = borderless, fills the parent cell. */
  variant?: "card" | "plain";
  /** Horizontal alignment of the text inside the input. Default "right". */
  align?: "left" | "center" | "right";
  /** Font size preset. Default "sm". */
  size?: "sm" | "base" | "lg" | "xl";
  /** Render in semibold. */
  bold?: boolean;
}) {
  const factor = Math.pow(10, decimals);
  const round = (n: number) => Math.round(n * factor) / factor;

  // Focused state lets user type raw digits; blur reformats with commas.
  const [focused, setFocused] = React.useState(false);

  const display = React.useMemo(() => {
    if (value == null) return "";
    const n = round(value);
    if (focused) return String(n);
    return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }, [value, decimals, focused]);

  // Auto-size the input so each column shrinks to fit its widest value.
  // `htmlSize` is the HTML `size` attribute that sets width in character units.
  // minSize=4 keeps empty cells tappable without collapsing to nothing.
  const htmlSize = Math.max(4, (display || placeholder || "").length);

  const sizeClass =
    size === "xl"   ? "text-xl"
  : size === "lg"   ? "text-lg"
  : size === "base" ? "text-base"
  :                   "text-sm";

  const alignClass =
    align === "center" ? "text-center"
  : align === "left"   ? "text-left"
  :                      "text-right";

  // When centred, `flex` parent needs justify-center so a `w-auto` input (whose
  // width is sized in ch) still sits in the middle of the column.
  const parentAlignClass =
    align === "center" ? "justify-center"
  : align === "left"   ? "justify-start"
  :                      "justify-end";

  return (
    <div className={cn("flex items-center gap-1 min-w-0", parentAlignClass, className)}>
      <input
        type="text"
        inputMode={decimals === 0 ? "numeric" : "decimal"}
        value={display}
        size={htmlSize}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => {
          // Strip everything except digits, dot, and sign.
          const cleaned = e.target.value.replace(/[^0-9.\-]/g, "");
          if (cleaned === "" || cleaned === "-") return onChange(null);
          const n = Number(cleaned);
          if (Number.isNaN(n)) return;
          onChange(round(n));
        }}
        className={cn(
          // Plain variant (tight grid cells) fills its cell so columns can shrink
          // with the viewport. Card variant keeps the auto-size + 56px tap target.
          "no-spinner px-1.5 py-1 font-mono tabular-nums focus:outline-none",
          variant === "card" ? "w-auto min-w-[56px] max-w-full" : "w-full min-w-0",
          sizeClass,
          alignClass,
          bold && "font-semibold",
          variant === "card"
            ? "rounded-md border border-[var(--color-ice-200)] focus:ring-2 focus:ring-[var(--color-ink-700)]"
            : "bg-transparent border-0 focus:ring-1 focus:ring-[var(--color-ink-700)] focus:bg-white dark:focus:bg-[var(--surface-2)]",
        )}
      />
      {suffix && <span className="text-xs text-[var(--color-ink-600)]">{suffix}</span>}
    </div>
  );
}

export function TextCell({ value, onChange, placeholder, className }: {
  value: string | null | undefined;
  onChange: (s: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      value={value ?? ""}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className={cn("w-full rounded-md border border-[var(--color-ice-200)] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ink-700)]", className)}
    />
  );
}

export function TextArea({ value, onChange, placeholder, rows = 10 }: {
  value: string | undefined;
  onChange: (s: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value ?? ""}
      placeholder={placeholder}
      rows={rows}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg border border-[var(--color-ice-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ink-700)] leading-relaxed"
    />
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  // Inner table is left to size naturally so all 14 columns + min-width inputs
  // get their full footprint; the wrapper scrolls horizontally when needed.
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-max min-w-full text-sm border-separate border-spacing-0">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-600)] px-2 py-2 bg-[var(--color-ice-50)] border-b border-[var(--color-ice-200)] whitespace-nowrap", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-2 py-1 border-b border-[var(--color-ice-100)] align-middle whitespace-nowrap", className)}>{children}</td>;
}

/** Sticky-left variants — pin the row-label column when the table scrolls horizontally. */
export function StickyTh({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn(
      "sticky left-0 z-10 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-600)] px-2 py-2 bg-[var(--color-ice-50)] border-b border-r border-[var(--color-ice-200)] whitespace-nowrap",
      className,
    )}>{children}</th>
  );
}
export function StickyTd({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={cn(
      "sticky left-0 z-10 px-2 py-1 bg-white border-b border-r border-[var(--color-ice-100)] whitespace-nowrap",
      className,
    )}>{children}</td>
  );
}
