import { listMonthReports } from "@/lib/month-report";
import { ExportForm } from "@/components/export-form";

export default async function ExportPage() {
  const months = await listMonthReports();
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-600)] font-semibold">Export</div>
        <h1 className="font-[var(--font-display)] text-3xl font-semibold mt-1">Generate the PPTX</h1>
        <p className="text-sm text-[var(--color-ink-600)] mt-1">Pick months, template, colour theme — then review the slides and download.</p>
      </header>
      <ExportForm allReports={months} />
    </div>
  );
}
