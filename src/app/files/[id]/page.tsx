// In-browser viewer for an uploaded source file.
//
// XLSX files (the bulk of what gets uploaded) render as HTML tables — the
// browser has no native viewer for them, so the previous `disposition=inline`
// trick downloaded them anyway. We parse server-side with `xlsx` and emit
// pre-rendered HTML so the page is plain Server Component, no client JS
// required, no download. PDFs fall back to the existing inline stream wrapped
// in an iframe.
import { notFound } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { ArrowLeft, Download, FileText } from "lucide-react";

export const runtime = "nodejs";

function bytesToKb(n: number): string {
  return (n / 1024).toFixed(1) + " KB";
}

export default async function FileViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.rawFile.findUnique({
    where: { id },
    select: {
      id: true,
      originalName: true,
      byteSize: true,
      bytes: true,
      createdAt: true,
      kind: true,
    },
  });
  if (!row || !row.bytes) notFound();

  const ext = row.originalName.toLowerCase().split(".").pop() ?? "";
  const isXlsx = ext === "xlsx" || ext === "xls";
  const isPdf = ext === "pdf";

  // Pre-render each XLSX sheet to an HTML table on the server.
  // `sheet_to_html` is part of xlsx-sheetjs; it produces a complete <table>
  // string we can drop straight into the page via dangerouslySetInnerHTML.
  // Note: rendered output is from a trusted file the user uploaded
  // themselves, but we still sanitise the surrounding chrome.
  let sheets: { name: string; html: string }[] = [];
  if (isXlsx) {
    try {
      const wb = XLSX.read(Buffer.from(row.bytes), { type: "buffer" });
      sheets = wb.SheetNames.map(name => ({
        name,
        html: XLSX.utils.sheet_to_html(wb.Sheets[name], { id: `sheet-${name}` }),
      }));
    } catch (e) {
      sheets = [{ name: "Error", html: `<p>Failed to render this spreadsheet: ${(e as Error).message}</p>` }];
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-ice-50)] dark:bg-[var(--surface-1)]">
      <header className="sticky top-0 z-10 border-b border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)]">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-3">
          <Link
            href="/files"
            className="inline-flex items-center gap-1 text-sm text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)]"
          >
            <ArrowLeft size={14} /> Files
          </Link>
          <FileText size={16} className="text-[var(--color-ink-600)] ml-2" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[var(--color-ink-900)] truncate">{row.originalName}</div>
            <div className="text-[11px] text-[var(--color-ink-600)]">
              {row.kind} · {bytesToKb(row.byteSize)} · imported {row.createdAt.toLocaleString()}
            </div>
          </div>
          <a
            href={`/api/files/${row.id}`}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-ice-200)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--color-ice-100)] text-[var(--color-ink-800)]"
          >
            <Download size={12} /> Download
          </a>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-5">
        {isPdf && (
          <iframe
            src={`/api/files/${row.id}?disposition=inline`}
            title={row.originalName}
            className="w-full rounded-xl border border-[var(--color-ice-200)] bg-white"
            style={{ height: "calc(100vh - 120px)" }}
          />
        )}

        {isXlsx && (
          <div className="space-y-4">
            {sheets.map(s => (
              <section
                key={s.name}
                className="rounded-xl border border-[var(--color-ice-200)] bg-white shadow-sm overflow-hidden"
              >
                <div className="px-4 py-2 border-b border-[var(--color-ice-200)] bg-[var(--color-ice-50)] text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--color-ink-600)]">
                  Sheet: {s.name}
                </div>
                <div
                  className="overflow-auto max-h-[75vh] xlsx-preview"
                  dangerouslySetInnerHTML={{ __html: s.html }}
                />
              </section>
            ))}
          </div>
        )}

        {!isPdf && !isXlsx && (
          <div className="rounded-xl border border-[var(--color-ice-200)] bg-white p-6 text-sm text-[var(--color-ink-600)]">
            No in-browser preview is available for <code>{ext}</code> files.
            Use the Download button above to open in its native app.
          </div>
        )}
      </main>

      {/* Tighten up the default sheet_to_html output: it ships giant cells
          with no padding and no borders, which makes a million-row XLSX
          unreadable. These styles only target tables produced above. */}
      <style>{`
        .xlsx-preview table { border-collapse: collapse; font-size: 12px; font-family: var(--font-body, Calibri, sans-serif); }
        .xlsx-preview td { border: 1px solid var(--color-ice-200, #e5e7eb); padding: 4px 8px; white-space: nowrap; vertical-align: top; }
        .xlsx-preview tr:nth-child(even) td { background: var(--color-ice-50, #f8fafc); }
      `}</style>
    </div>
  );
}
