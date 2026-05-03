import { Suspense } from "react";
import { ImportForm } from "@/components/import-form";

export default function ImportPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-600)] font-semibold">Import</div>
        <h1 className="font-[var(--font-display)] text-3xl font-semibold mt-1">Upload POS raw data</h1>
        <p className="text-sm text-[var(--color-ink-600)] mt-1">
          Drag &amp; drop the Summary-By-Group PDF plus any MCUV colour breakdowns. Optional: an outlet-level Excel for ECP &amp; region rollups. We&apos;ll auto-create the month if it doesn&apos;t exist yet.
        </p>
      </header>
      {/* `useSearchParams` inside ImportForm needs a Suspense boundary during build. */}
      <Suspense fallback={<div className="p-10 text-center text-sm text-[var(--color-ink-600)]">Loading…</div>}>
        <ImportForm />
      </Suspense>
    </div>
  );
}
