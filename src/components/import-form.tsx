"use client";
import { useEffect, useRef, useState } from "react";
import { MONTH_NAMES, monthId } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, UploadCloud } from "lucide-react";
import { SECTION_META, type SectionKey } from "@/lib/schema";

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
  const urlYear  = Number(sp?.get("year"))  || now.getFullYear();
  const urlMonth = Number(sp?.get("month")) || (now.getMonth() + 1);
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
  } | null>(null);
  const [err, setErr] = useState("");

  // Keep inputs in sync if the URL changes while the page is mounted.
  useEffect(() => {
    if (sp?.get("year"))  setYear(Number(sp.get("year")));
    if (sp?.get("month")) setMonth(Number(sp.get("month")));
  }, [sp]);

  // When the user retargets a different month/year, clear the staged file
  // queue so they can't accidentally send March files into February. We
  // skip the very first run (initial mount) so URL-derived defaults don't
  // wipe a fresh queue. We also clear any previous result/error so the
  // success or failure of a prior import doesn't linger over a new context.
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    setFiles([]);
    setResult(null);
    setErr("");
  }, [year, month]);

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
            const dropped = [...e.dataTransfer.files];
            setFiles(prev => [...prev, ...dropped]);
          }}
          className="rounded-xl border-2 border-dashed border-[var(--color-ice-200)] p-8 text-center hover:border-[var(--color-ink-700)] cursor-pointer"
          onClick={() => document.getElementById("fileInput")?.click()}
        >
          <UploadCloud className="mx-auto text-[var(--color-ink-700)]" size={40} />
          <p className="mt-2 font-medium">Drop POS files here</p>
          <p className="text-xs text-[var(--color-ink-600)]">PDF + XLSX — you can attach multiple. They'll be routed to the right parser automatically.</p>
          <input
            id="fileInput"
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls"
            className="hidden"
            onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])}
          />
        </div>

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
          <p className="text-sm">POS Net Sales Grand Total (minus trial lenses): <strong>MYR {result.result.grandTotalMyr.toLocaleString()}</strong></p>

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

          {result.result.unmapped.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-amber-700">Unmapped SKUs (ignored in rollups):</p>
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
