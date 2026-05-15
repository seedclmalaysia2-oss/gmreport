"use client";
import { useEffect, useRef, useState } from "react";
import { MONTH_NAMES, monthId } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, UploadCloud } from "lucide-react";
import { SECTION_META, type SectionKey } from "@/lib/schema";
import { detectPeriod } from "@/lib/filename-period";

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
  const now = new Date();
  const urlYearStr  = sp?.get("year")  ?? null;
  const urlMonthStr = sp?.get("month") ?? null;
  const urlYear  = Number(urlYearStr)  || now.getFullYear();
  const urlMonth = Number(urlMonthStr) || (now.getMonth() + 1);
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

  // Keep inputs in sync ONLY when the URL params themselves change.
  // Depending on the `sp` object reference would re-fire on every render
  // (Next.js can hand back a fresh ReadonlyURLSearchParams instance) and
  // clobber whatever the user just picked in the dropdown — that was the
  // "month keeps snapping back to MAY" bug.
  useEffect(() => {
    if (urlYearStr)  setYear(Number(urlYearStr));
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
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    if (skipNextReset.current) { skipNextReset.current = false; return; }
    setFiles([]);
    setResult(null);
    setErr("");
    setAutoDetected(null);
  }, [year, month]);

  // Centralised "add these files" path. Used by the drop handler and the
  // hidden file input's onChange. When the queue was empty, scans the new
  // files for a month/year hint (e.g. "Apr26") and retargets the form
  // automatically so users don't accidentally upload April files into a
  // May report just because today is May.
  function addFiles(added: File[]) {
    if (files.length === 0 && added.length > 0) {
      for (const f of added) {
        const hint = detectPeriod(f.name);
        if (!hint) continue;
        if (hint.year === year && hint.month === month) {
          // Already on the right month — no need to retarget OR show a banner.
          break;
        }
        // Retarget WITHOUT triggering the queue-clearing effect.
        skipNextReset.current = true;
        setYear(hint.year);
        setMonth(hint.month);
        setAutoDetected(hint);
        break;
      }
    }
    setFiles(prev => [...prev, ...added]);
  }

  const sectionLabel = section && SECTION_META[section] ? `${SECTION_META[section].no}. ${SECTION_META[section].title}` : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setResult(null);
    const fd = new FormData();
    fd.set("year", String(year));
    fd.set("month", String(month));
    for (const f of files) fd.append("files", f);
    const res = await fetch("/api/import", { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error || "Import failed");
      return;
    }
    setResult(await res.json());
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
            <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-28 rounded-md border border-[var(--color-ice-200)] px-3 py-2" />
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
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 flex items-center gap-2">
            <strong>Month auto-set</strong> to{" "}
            <span className="tabular-nums">{MONTH_NAMES[autoDetected.month - 1]} {autoDetected.year}</span>{" "}
            from the file name. Override above if that&rsquo;s wrong.
          </div>
        )}

        {files.length > 0 && (
          <ul className="space-y-1 text-sm">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md bg-[var(--color-ice-50)] px-3 py-1.5">
                <FileText size={14} />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-xs text-[var(--color-ink-600)]">{(f.size / 1024).toFixed(0)} KB</span>
                <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-xs text-red-600">Remove</button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between">
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            disabled={busy || files.length === 0}
            className="ml-auto rounded-md bg-[var(--color-ink-800)] text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Parsing…" : "Import"}
          </button>
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
                  <li key={kind}><span className="font-mono">{kind}</span> → {names.join(", ")}</li>
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
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <strong>2025 reference applied.</strong> Prior-year sales &amp; quantity
              comparison columns filled across{" "}
              <strong>{result.year2025Applied}</strong> month{result.year2025Applied === 1 ? "" : "s"}.
            </div>
          )}

          {result.result.unmapped.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-amber-700">Unmapped SKUs (counted in Grand Total, not broken out per product):</p>
              <p className="text-[11px] text-[var(--color-ink-600)] mb-1">
                Add these codes to <code>catalog/sku-map.ts</code> if you want them to appear on Slide 5 / 6 next month.
              </p>
              <ul className="text-xs mt-1 space-y-1 max-h-40 overflow-auto">
                {result.result.unmapped.map(u => (
                  <li key={u.code} className="flex gap-2">
                    <code className="bg-[var(--color-ice-50)] px-1 rounded">{u.code}</code>
                    <span className="flex-1 truncate">{u.desc}</span>
                    <span className="text-[var(--color-ink-600)]">qty {u.qty} / MYR {u.netSales.toFixed(0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <ul className="text-sm text-amber-700">
              {result.warnings.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={goBack}
              className="rounded-md bg-[var(--color-ink-800)] text-white px-4 py-1.5 text-sm font-semibold inline-flex items-center gap-2 hover:bg-[var(--color-ink-700)]"
            >
              <ArrowLeft size={14} />
              Update {sectionLabel ? `— back to Slide ${sectionLabel}` : "— back to report"}
            </button>
            <button
              onClick={() => { setResult(null); setFiles([]); }}
              className="rounded-md border border-[var(--color-ice-200)] px-3 py-1.5 text-sm"
            >
              Import another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
