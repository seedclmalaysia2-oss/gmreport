"use client";
import * as React from "react";
import Link from "next/link";
import type { SourceFile } from "@/lib/schema";
import { SECTION_META, type SectionKey } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { AlertTriangle, FileUp, Pencil, Save } from "lucide-react";
import type { RawFileEntry } from "@/lib/month-report";
import { SectionSourceFiles } from "../section-source-files";
import { RichTextEditor } from "../rich-text-editor";

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
  /** Legacy per-section filename JSON. Kept for back-compat; the source
   *  chips now render from `monthFiles` instead so they stay in sync with
   *  the RawFile table. */
  sourceFiles?: Record<string, SourceFile[]>;
  /** This month's live RawFile rows (active only). The section source
   *  strip filters these by `sectionKeys` so deleted files vanish and
   *  fresh uploads appear without a stale-JSON round-trip. */
  monthFiles?: RawFileEntry[];
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

  // Source files for THIS section, taken from the live RawFile list. A file
  // feeds a section when its sectionKeys array (recorded at import time)
  // contains this sectionKey. This replaces the old sourceFiles-JSON read,
  // which never reflected deletes done on the Files page.
  const sectionFiles: RawFileEntry[] = (ctx?.monthFiles ?? []).filter(
    f => f.sectionKeys.includes(sectionKey),
  );

  return (
    <div className="space-y-5 animate-fadein">
      <header>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-600)]">
          Slide {m.no}
        </div>
        <h2 className="font-[var(--font-display)] text-3xl font-semibold mt-1">{m.title}</h2>
        {subtitle && <p className="text-[var(--color-ink-600)] mt-1 text-sm">{subtitle}</p>}
      </header>

      {/* Source-file strip — wired directly to the RawFile table so it always
          matches the Files page. View / Delete / multi-select + an inline
          Upload button. Shown whenever this slide has source files OR the
          slide is import-fed and currently empty (so the user can upload). */}
      {(sectionFiles.length > 0 || isMissing) && ctx && (
        <SectionSourceFiles files={sectionFiles} year={ctx.year} month={ctx.month} />
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
  size?: "xs" | "sm" | "base" | "lg" | "xl";
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
  : size === "xs"   ? "text-[12px]"
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

/** True when the string has no visible content (ignoring HTML tags / whitespace). */
function isBlankComment(s: string): boolean {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim() === "";
}

/**
 * Manual-comment field with an explicit Save / Edit cycle (no auto-save):
 *  - empty / editing → the editor (rich or plain) + Save (and Cancel once a
 *    value exists)
 *  - saved & idle    → the comment rendered read-only + an Edit button
 *
 * The draft is local; nothing is persisted until Save is pressed. External
 * changes (switching months, AI generation) are synced in unless the user has
 * an unsaved draft that would be lost.
 */
export function CommentEditor({
  value, onSave,
  variant = "plain",
  heading = "Commentary",
  placeholder,
  rows = 5,
  minHeight = 200,
  toolbar,
  className = "mt-5",
}: {
  value: string;
  onSave: (value: string) => void;
  variant?: "plain" | "rich";
  /** Label above the field. Pass null for no heading. */
  heading?: React.ReactNode | null;
  placeholder?: string;
  rows?: number;
  minHeight?: number;
  /** Extra controls shown above the editor while editing (e.g. AI generate). */
  toolbar?: React.ReactNode;
  className?: string;
}) {
  const blank = isBlankComment(value);
  const [editing, setEditing] = React.useState(blank);
  const [draft, setDraft] = React.useState(value);

  // Pull in external changes (month switch, AI generate) without trampling an
  // in-progress edit that holds the user's own content.
  React.useEffect(() => {
    if (!editing || isBlankComment(draft)) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 mb-2">
        {heading != null ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-600)]">
            {heading}
          </div>
        ) : <span />}
        {!editing && (
          <button
            type="button"
            onClick={() => { setDraft(value); setEditing(true); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-ice-200)] px-2.5 py-1 text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)]"
          >
            <Pencil size={13} /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <>
          {toolbar}
          {variant === "rich" ? (
            <RichTextEditor value={draft} onChange={setDraft} placeholder={placeholder} minHeight={minHeight} />
          ) : (
            <TextArea value={draft} onChange={setDraft} placeholder={placeholder} rows={rows} />
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => { onSave(draft); setEditing(false); }}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-ink-800)] text-white px-3 py-1.5 text-sm font-semibold hover:bg-[var(--color-ink-700)]"
            >
              <Save size={14} /> Save
            </button>
            {!blank && (
              <button
                type="button"
                onClick={() => { setDraft(value); setEditing(false); }}
                className="rounded-md border border-[var(--color-ice-200)] px-3 py-1.5 text-sm text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)]"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      ) : blank ? (
        <p className="text-sm italic text-[var(--color-ink-600)]">No commentary yet.</p>
      ) : variant === "rich" ? (
        <div
          className="text-sm leading-relaxed text-[var(--color-ink-800)] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
          // Trusted HTML — produced by our own RichTextEditor.
          dangerouslySetInnerHTML={{ __html: value }}
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink-800)]">{value}</p>
      )}
    </div>
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
