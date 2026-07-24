"use client";
import { useEffect, useRef, useState } from "react";
import { MONTH_NAMES, monthId } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, FileText, UploadCloud } from "lucide-react";
import { SECTION_META, type SectionKey } from "@/lib/schema";
import { detectPeriod } from "@/lib/filename-period";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";

/**
 * Friendly labels for the parser's internal file-kind identifiers. Kept in
 * sync with the KIND_LABELS map on the Files page so "Files recognised" in
 * the import summary reads in Simon's own vocabulary rather than raw snake
 * case (`pos_master`, `pos_ecp_list`).
 */
const KIND_LABELS: Record<string, string> = {
  pos_master:     "POS Master (Stock Sales Analysis)",
  pos_mcuv:       "MCUV breakdown",
  pos_writeoff:   "Stocks Write-Off",
  pos_outlets:    "Monthly Sales Performance",
  pos_ecp_list:   "ECP List",
  pos_region:     "Sales Analysis By Region",
  pos_salesman:   "Salesman Sales & Collection",
  pos_inventory:  "Stock List (SCLM)",
  pos_collection: "Collection Listing",
  pos_daily:      "Daily Sales Quantity",
  ref_2025:       "2025 Sales Summary (prior-year reference)",
  unknown:        "Unrecognised file",
};

/**
 * Filename keyword hints surfaced in the "Some files need attention" popup.
 * Mirrors the regex-based router in src/app/api/import/route.ts — when a file
 * is tagged `unknown` (or parsing succeeded but produced no data), the dialog
 * shows this table so the user can rename + re-upload.
 */
const FILENAME_HINTS: { label: string; keywords: string; example: string }[] = [
  { label: "Stock Sales / POS master",            keywords: "Stock Sales Analysis Summary",       example: "Stock Sales Analysis Summary - By Group Apr26.xlsx" },
  { label: "MCUV colour breakdown",               keywords: "MCUV-<COLOUR>",                       example: "MCUV-BLUE.pdf, MCUV-ORANGE.pdf, MCUV-PEGA.pdf" },
  { label: "Stocks Write-Off",                    keywords: "Write Off",                           example: "Stocks Write Off Report Jan-Mar.pdf" },
  { label: "Inventory master (SCLM)",             keywords: "Stock List or SCLM",                  example: "SCLM - Stock List 2026.04.30.xlsx" },
  { label: "Inventory HQ split",                  keywords: "Stock List HQ or SCLM … HQ",          example: "SCLM Stock List HQ Apr26.xlsx" },
  { label: "Inventory HQ2 split",                 keywords: "Stock List HQ2 or SCLM … HQ2",        example: "SCLM Stock List HQ2 Apr26.xlsx" },
  { label: "Inventory BOC consignment",           keywords: "Stock List BOC or SCLM … BOC",        example: "SCLM Stock List BOC Apr26.xlsx" },
  { label: "Daily Sales Quantity",                keywords: "Daily Sales",                          example: "Daily Sales Quantity Apr26.xlsx" },
  { label: "Sales by Region",                     keywords: "Sales Analysis Region or Sales by Region", example: "Sales Analysis By Region Apr26.xlsx" },
  { label: "Salesman Sales & Collection",         keywords: "Salesman + Sales/Collection, or Account Type", example: "Salesman Sales and Collection Listing By Account Type Apr26.xlsx" },
  { label: "Collection Listing",                  keywords: "Collection Listing",                  example: "Collection Listing Apr26.xlsx" },
  { label: "Monthly Sales Performance (outlets)", keywords: "Monthly Sales Performance",           example: "Monthly Sales Performance Apr26.xlsx" },
  { label: "ECP List",                            keywords: "ECP List",                            example: "ECP List.xlsx" },
  { label: "2025 prior-year reference",           keywords: "Sales Summary + 2025",                 example: "2025 Sales Summary.xlsx" },
];

/**
 * Year window for the target-month picker. Widened to three years back +
 * one year forward so Simon can backfill 2023/24 data if a historical POS
 * file surfaces, while still blocking typos like 3025.
 *
 * Recomputed at module load; if the app runs across a year boundary the
 * bounds shift with it. In practice the page is a monthly workflow so a
 * fresh mount happens every session.
 */
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR - 3;
const MAX_YEAR = CURRENT_YEAR + 1;

function clampYear(y: number): number {
  if (!Number.isFinite(y)) return CURRENT_YEAR;
  if (y < MIN_YEAR) return MIN_YEAR;
  if (y > MAX_YEAR) return MAX_YEAR;
  return Math.trunc(y);
}

/**
 * POS import page form.
 *
 * URL params:
 *   - `year` / `month`      → pre-fill target month
 *   - `section`             → which slide the user came from (used in the return banner)
 *   - `from`                → the URL to return to once the Update button is clicked
 */
export function ImportForm() {
  const router = useRouter();
  const sp = useSearchParams();

  // Prefer the URL params over today's date so re-opening the page keeps context.
  const urlYearStr  = sp?.get("year")  ?? null;
  const urlMonthStr = sp?.get("month") ?? null;
  const urlYear  = clampYear(Number(urlYearStr)  || CURRENT_YEAR);
  const urlMonth = Number(urlMonthStr) || (new Date().getMonth() + 1);
  const section  = (sp?.get("section") as SectionKey | null) ?? null;
  const from     = sp?.get("from") ?? null;

  const [year, setYear]   = useState(urlYear);
  const [month, setMonth] = useState(urlMonth);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy]   = useState(false);
  const [result, setResult] = useState<{
    saved: { id: string };
    result: {
      grandTotalMyr: number;
      unmapped: { code: string; desc: string; netSales: number; qty: number }[];
      sectionsTouched?: SectionKey[];
      filesByKind?: Record<string, string[]>;
    };
    warnings: string[];
    /** Set when a 2025 Sales Summary was uploaded — # months it filled. */
    year2025Applied?: number;
  } | null>(null);
  const [err, setErr] = useState("");
  // "Some files need attention" popup — opens automatically after an import
  // that produced unrecognised filenames or parser warnings, so the user
  // doesn't have to spot the silent "no update" by eye.
  const [issuesOpen, setIssuesOpen] = useState(false);

  // Keep inputs in sync ONLY when the URL params themselves change.
  // Depending on the `sp` object reference would re-fire on every render
  // (Next.js can hand back a fresh ReadonlyURLSearchParams instance) and
  // clobber whatever the user just picked in the dropdown — that was the
  // "month keeps snapping back to MAY" bug.
  useEffect(() => {
    if (urlYearStr)  setYear(clampYear(Number(urlYearStr)));
    if (urlMonthStr) setMonth(Number(urlMonthStr));
  }, [urlYearStr, urlMonthStr]);

  // When the user retargets a different month/year, clear the staged file
  // queue so they can't accidentally send March files into February. We
  // skip the very first run (initial mount) so URL-derived defaults don't
  // wipe a fresh queue. We also clear any previous result/error so the
  // success or failure of a prior import doesn't linger over a new context.
  const isInitialMount = useRef(true);
  // When addFiles() retargets the form from a detected filename hint, we
  // need to skip the next "reset on year/month change" pass — otherwise
  // setYear/setMonth would fire the effect below and wipe the very files
  // that triggered the retarget.
  const skipNextReset = useRef(false);
  // Last detected period — surfaced as an inline note so the user knows the
  // form auto-updated and didn't silently mis-target the wrong month.
  const [autoDetected, setAutoDetected] = useState<{ year: number; month: number } | null>(null);
  // Set when a second drop hints a DIFFERENT month than the current queue.
  // We retarget + clear the queue (safer than silently absorbing files into
  // the wrong month), then show a warn banner so Simon can't miss the
  // switch. Cleared on the next successful add or when the user dismisses.
  const [retargeted, setRetargeted] = useState<
    | { from: { year: number; month: number }; to: { year: number; month: number } }
    | null
  >(null);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    if (skipNextReset.current) { skipNextReset.current = false; return; }
    setFiles([]);
    setResult(null);
    setErr("");
    setAutoDetected(null);
  }, [year, month]);

  // Centralised "add these files" path. Used by the drop handler and the
  // hidden file input's onChange. Two retarget flows:
  //
  //   Empty queue → new drop hinting a different month
  //     Retarget silently + green "auto-set" banner. This is the happy
  //     path — Simon dropped files whose names encode the period.
  //
  //   Non-empty queue → new drop hinting a DIFFERENT month than the queue
  //     Retarget + CLEAR the previous queue + warn banner. Silently
  //     absorbing would let Simon send March files into a February
  //     report; refusing the drop would lose the file. Retargeting to
  //     the new drop's month is the honest middle ground: the latest
  //     drop wins, and the banner tells him what happened so he can
  //     override.
  function addFiles(added: File[]) {
    if (added.length === 0) return;

    // First hint present in the new drop (usually the first file, but skip
    // untitled/unhinted files until we find one).
    let hint: { year: number; month: number } | null = null;
    for (const f of added) {
      const h = detectPeriod(f.name);
      if (h) { hint = h; break; }
    }

    const isEmptyQueue = files.length === 0;
    const hintDiffers = hint !== null && (hint.year !== year || hint.month !== month);

    if (isEmptyQueue && hint && hintDiffers) {
      // Fresh queue with an auto-detectable period — retarget quietly.
      skipNextReset.current = true;
      setYear(hint.year);
      setMonth(hint.month);
      setAutoDetected(hint);
      setRetargeted(null);
      setFiles([...added]);
      return;
    }

    if (!isEmptyQueue && hint && hintDiffers) {
      // Non-empty queue AND a cross-month drop — retarget noisily.
      skipNextReset.current = true;
      const from = { year, month };
      setYear(hint.year);
      setMonth(hint.month);
      setAutoDetected(null);
      setRetargeted({ from, to: hint });
      setFiles([...added]);
      return;
    }

    // Normal path: same month (or no detectable hint) → just append.
    setRetargeted(null);
    setFiles(prev => [...prev, ...added]);
  }

  const sectionLabel = section && SECTION_META[section] ? `${SECTION_META[section].no}. ${SECTION_META[section].title}` : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Belt-and-braces validation — the input has min/max attrs and clamps
    // on change, but a hostile paste + submit still needs a bouncer.
    const yr = clampYear(year);
    if (yr !== year) {
      setYear(yr);
    }
    if (month < 1 || month > 12) {
      setErr("Month must be between January and December.");
      return;
    }
    setBusy(true); setErr(""); setResult(null);
    const fd = new FormData();
    fd.set("year", String(yr));
    fd.set("month", String(month));
    for (const f of files) fd.append("files", f);
    let res: Response;
    try {
      res = await fetch("/api/import", { method: "POST", body: fd });
    } catch (netErr) {
      setBusy(false);
      setErr(netErr instanceof Error ? `Network error: ${netErr.message}` : "Network error");
      return;
    }
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error || `Import failed (${res.status})`);
      return;
    }
    setResult(await res.json());
  }

  // Guard against tab close mid-parse. Chrome shows a generic prompt (the
  // returnValue string is ignored for security reasons), but that's enough
  // to let Simon cancel a stray Cmd-W and finish uploading a slow XLSX.
  useEffect(() => {
    if (!busy) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [busy]);

  // Open the issues popup automatically when an import returns either an
  // `unknown` file kind (filename didn't match any parser) or any parser
  // warnings (e.g. "could not find May 26 column").
  useEffect(() => {
    if (!result) { setIssuesOpen(false); return; }
    const hasUnknown = (result.result.filesByKind?.unknown?.length ?? 0) > 0;
    const hasWarnings = result.warnings.length > 0;
    if (hasUnknown || hasWarnings) setIssuesOpen(true);
  }, [result]);

  function reUpload() {
    setIssuesOpen(false);
    setFiles([]);
    setResult(null);
    setErr("");
    // Defer until the dialog is unmounted so the click doesn't bubble.
    setTimeout(() => document.getElementById("fileInput")?.click(), 50);
  }

  // After successful import the "Update" button routes back to the originating
  // section (or /report/<id> as a fallback).
  function goBack() {
    if (!result) return;
    const fallback = `/report/${result.saved.id}${section ? `?section=${section}` : ""}`;
    router.push(from || fallback);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Return-context banner — shown when the user arrived from a specific slide. */}
      {sectionLabel && (
        <div className="rounded-xl border border-[var(--color-ice-200)] bg-[var(--color-ice-50)] px-4 py-2.5 text-sm text-[var(--color-ink-800)] flex items-center gap-2">
          <ArrowLeft size={14} />
          <span>
            You came from <strong>Slide {sectionLabel}</strong>. Upload the matching POS file(s) below, then click <strong>Update</strong> to go back.
          </span>
        </div>
      )}

      <form onSubmit={submit} className="rounded-2xl border border-[var(--color-ice-200)] bg-white p-6 space-y-4">
        <div className="flex gap-3">
          <label className="text-sm">
            <span className="block text-xs text-[var(--color-ink-600)] mb-1">Year</span>
            <input
              type="number"
              value={year}
              min={MIN_YEAR}
              max={MAX_YEAR}
              step={1}
              inputMode="numeric"
              onChange={e => {
                const raw = Number(e.target.value);
                // Let intermediate values through so typing "202" while
                // heading to "2027" doesn't fight the user, but clamp any
                // value that's clearly out of range.
                if (raw >= 1000 && raw <= 9999) setYear(clampYear(raw));
              }}
              onBlur={() => setYear(clampYear(year))}
              className="w-28 rounded-md border border-[var(--color-ice-200)] px-3 py-2 tabular-nums"
              aria-describedby="year-range-hint"
            />
            <span id="year-range-hint" className="sr-only">
              Between {MIN_YEAR} and {MAX_YEAR}.
            </span>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-[var(--color-ink-600)] mb-1">Month</span>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-40 rounded-md border border-[var(--color-ice-200)] px-3 py-2">
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{i + 1} · {m}</option>)}
            </select>
          </label>
        </div>

        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            addFiles([...e.dataTransfer.files]);
          }}
          className="rounded-xl border-2 border-dashed border-[var(--color-ice-200)] p-8 text-center hover:border-[var(--color-ink-700)] cursor-pointer"
          onClick={() => document.getElementById("fileInput")?.click()}
        >
          <UploadCloud className="mx-auto text-[var(--color-ink-700)]" size={40} />
          <p className="mt-2 font-medium">Drop POS files here</p>
          <p className="text-xs text-[var(--color-ink-600)]">PDF + XLSX — you can attach multiple. They&rsquo;ll be routed to the right parser automatically.</p>
          <p className="text-[11px] text-[var(--color-ink-600)] mt-1 italic">
            Tip: the target month auto-updates from the file name (e.g. &ldquo;Apr26&rdquo; → April 2026).
          </p>
          <input
            id="fileInput"
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls"
            className="hidden"
            onChange={e => addFiles(Array.from(e.target.files ?? []))}
          />
        </div>

        {autoDetected && (
          <div className="rounded-md border border-[var(--color-ok-200)] bg-[var(--color-ok-50)] px-3 py-2 text-xs text-[var(--color-ok-800)] flex items-center gap-2">
            <strong>Month auto-set</strong> to{" "}
            <span className="tabular-nums">{MONTH_NAMES[autoDetected.month - 1]} {autoDetected.year}</span>{" "}
            from the file name. Override above if that&rsquo;s wrong.
          </div>
        )}

        {retargeted && (
          <div className="rounded-md border border-[var(--color-warn-200)] bg-[var(--color-warn-50)] px-3 py-2 text-xs text-[var(--color-warn-900)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <strong>Switched to a different month.</strong>{" "}
                The new files look like{" "}
                <span className="tabular-nums font-semibold">{MONTH_NAMES[retargeted.to.month - 1]} {retargeted.to.year}</span>, so the previous queue targeting{" "}
                <span className="tabular-nums">{MONTH_NAMES[retargeted.from.month - 1]} {retargeted.from.year}</span>{" "}
                was cleared. Change the year/month above if this is wrong.
              </div>
              <button
                type="button"
                onClick={() => setRetargeted(null)}
                aria-label="Dismiss month-change notice"
                className="shrink-0 rounded-md p-0.5 text-[var(--color-warn-800)] hover:bg-[var(--color-warn-100)]"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {files.length > 0 && (
          <ul className="space-y-1 text-sm">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md bg-[var(--color-ice-50)] px-3 py-1.5">
                <FileText size={14} />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-xs text-[var(--color-ink-600)] tabular-nums">{(f.size / 1024).toFixed(0)} KB</span>
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="text-xs text-[var(--color-bad)] hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between">
          {err && <p className="text-sm text-[var(--color-bad)]">{err}</p>}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={busy || files.length === 0}
            className="ml-auto"
          >
            {busy ? "Parsing…" : "Import"}
          </Button>
        </div>
      </form>

      {result && (
        <div className="rounded-2xl border border-[var(--color-ice-200)] bg-white p-5 space-y-3">
          <h3 className="font-semibold text-lg">Import complete</h3>
          <p className="text-sm">
            Saved to <a className="underline" href={`/report/${result.saved.id}`}>{result.saved.id}</a>
          </p>
          <p className="text-sm">
            POS Net Sales Grand Total (matches Excel Grand Total cell, including any Sales adj):{" "}
            <strong>MYR {result.result.grandTotalMyr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </p>

          {/* File fingerprint: which files were used for which slide. */}
          {result.result.filesByKind && Object.keys(result.result.filesByKind).length > 0 && (
            <div className="text-xs">
              <p className="font-semibold text-[var(--color-ink-800)] mb-1">Files recognised</p>
              <ul className="space-y-0.5 text-[var(--color-ink-600)]">
                {Object.entries(result.result.filesByKind).map(([kind, names]) => (
                  <li key={kind}>
                    <span className="text-[var(--color-ink-800)]">{KIND_LABELS[kind] ?? kind}</span>
                    {" → "}
                    {names.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.result.sectionsTouched && result.result.sectionsTouched.length > 0 && (
            <p className="text-xs text-[var(--color-ink-600)]">
              Slides refreshed:{" "}
              <strong>{result.result.sectionsTouched.map(s => SECTION_META[s]?.title ?? s).join(", ")}</strong>
            </p>
          )}

          {/* Prior-year reference confirmation. */}
          {typeof result.year2025Applied === "number" && (
            <div className="rounded-md border border-[var(--color-ok-200)] bg-[var(--color-ok-50)] px-3 py-2 text-xs text-[var(--color-ok-800)]">
              <strong>2025 reference applied.</strong> Prior-year sales &amp; quantity
              comparison columns filled across{" "}
              <strong>{result.year2025Applied}</strong> month{result.year2025Applied === 1 ? "" : "s"}.
            </div>
          )}

          {result.result.unmapped.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-[var(--color-warn-800)]">Unmapped SKUs (counted in Grand Total, not broken out per product):</p>
              <p className="text-[11px] text-[var(--color-ink-600)] mb-1">
                Add these codes to <code>catalog/sku-map.ts</code> if you want them to appear on Slide 5 / 6 next month.
              </p>
              <ul className="text-xs mt-1 space-y-1 max-h-40 overflow-auto">
                {result.result.unmapped.map(u => (
                  <li key={u.code} className="flex gap-2">
                    <code className="bg-[var(--color-ice-50)] px-1 rounded">{u.code}</code>
                    <span className="flex-1 truncate">{u.desc}</span>
                    <span className="text-[var(--color-ink-600)] tabular-nums">qty {u.qty} / MYR {u.netSales.toFixed(0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <ul className="text-sm text-[var(--color-warn-800)]">
              {result.warnings.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="primary" size="md" onClick={goBack}>
              <ArrowLeft size={14} />
              Update {sectionLabel ? `— back to Slide ${sectionLabel}` : "— back to report"}
            </Button>
            <Button variant="secondary" size="md" onClick={() => { setResult(null); setFiles([]); }}>
              Import another
            </Button>
          </div>
        </div>
      )}

      {/* Issues popup — automatic when the import returned unknown files or
          warnings. Uses the shared <Modal> shell so it inherits the focus
          trap, ESC dismiss, and same-vocabulary rendering as ConfirmDialog. */}
      {result && (
        <Modal
          open={issuesOpen}
          onClose={() => setIssuesOpen(false)}
          tone="warn"
          size="lg"
          icon={<AlertCircle size={22} />}
          title="Some files need attention"
          subtitle="A few uploads didn't update any slide. Rename them using the table below and re-upload so the report refreshes."
          labelledById="issues-title"
          describedById="issues-body"
          footer={
            <>
              <Button variant="secondary" size="md" onClick={() => setIssuesOpen(false)}>
                Got it
              </Button>
              <Button variant="primary" size="md" onClick={reUpload}>
                <UploadCloud size={14} /> Pick files again
              </Button>
            </>
          }
        >
          {(result.result.filesByKind?.unknown?.length ?? 0) > 0 && (
            <section>
              <h3 className="font-semibold text-[var(--color-ink-900)] mb-2">Unrecognised filenames</h3>
              <ul className="space-y-1">
                {result.result.filesByKind!.unknown!.map((name, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-md border border-[var(--color-bad-200)] bg-[var(--color-bad-50)] px-3 py-1.5 text-[var(--color-bad-800)]">
                    <FileText size={14} className="mt-0.5 shrink-0" />
                    <span className="break-all">{name}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[var(--color-ink-600)] mt-2">
                These didn&rsquo;t match any known POS file kind, so they fed no slide. Rename them using a keyword from the table below.
              </p>
            </section>
          )}

          {result.warnings.length > 0 && (
            <section>
              <h3 className="font-semibold text-[var(--color-ink-900)] mb-2">Parser warnings</h3>
              <ul className="space-y-1">
                {result.warnings.map((w, i) => (
                  <li key={i} className="rounded-md border border-[var(--color-warn-200)] bg-[var(--color-warn-50)] px-3 py-1.5 text-[var(--color-warn-900)] text-xs leading-relaxed">
                    {w}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="font-semibold text-[var(--color-ink-900)] mb-2">Expected filename keywords</h3>
            <p className="text-xs text-[var(--color-ink-600)] mb-2">
              The parser identifies each file by keywords anywhere in its name (case-insensitive). Include the month/year (e.g. <code className="rounded bg-[var(--color-ice-100)] px-1">Apr26</code>) so the form auto-targets the right month.
            </p>
            <div className="overflow-x-auto rounded-lg border border-[var(--color-ice-200)]">
              <table className="w-full text-xs">
                <thead className="bg-[var(--color-ice-50)] text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-600)]">
                  <tr>
                    <th className="text-left px-3 py-2">If you&rsquo;re uploading…</th>
                    <th className="text-left px-3 py-2">Filename must contain</th>
                    <th className="text-left px-3 py-2">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {FILENAME_HINTS.map(h => (
                    <tr key={h.label} className="border-t border-[var(--color-ice-100)] align-top">
                      <td className="px-3 py-1.5 font-medium text-[var(--color-ink-900)]">{h.label}</td>
                      <td className="px-3 py-1.5 text-[var(--color-ink-800)]"><code className="font-mono text-[11px]">{h.keywords}</code></td>
                      <td className="px-3 py-1.5 text-[var(--color-ink-600)] break-all">{h.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </Modal>
      )}
    </div>
  );
}
