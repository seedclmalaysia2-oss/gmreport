import Link from "next/link";
import { listMonthReports } from "@/lib/month-report";
import { MONTH_NAMES, monthNameFull } from "@/lib/utils";
import { NewMonthButton } from "@/components/new-month-button";
import { RepairChainButton } from "@/components/repair-chain-button";
import { SECTION_KEYS, type MonthReport } from "@/lib/schema";
import { AlertTriangle, ArrowRight, FileDown, FileUp } from "lucide-react";

function completion(m: MonthReport): number {
  const filled = SECTION_KEYS.filter(k => (m as Record<string, unknown>)[k]).length;
  return Math.round((filled / SECTION_KEYS.length) * 100);
}

function missingCount(m: MonthReport): number {
  return SECTION_KEYS.filter(k => !(m as Record<string, unknown>)[k]).length;
}

export default async function Home() {
  const months = await listMonthReports();
  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-[var(--color-ink-800)] text-white p-8 flex items-center gap-8 shadow-sm">
        <div className="flex-1">
          <p className="uppercase tracking-[0.25em] text-[var(--color-ice-200)] text-xs font-semibold">Dashboard</p>
          <h1 className="text-4xl font-semibold mt-2">Malaysia GM Monthly Review</h1>
          <p className="text-[var(--color-ice-100)] mt-3 max-w-2xl text-[15px]">
            Drop your POS PDFs, review the auto-built summaries, then export the HQ deck in one click — Classic layout to match the current HQ format, or a Modern redesign when you want to stand out.
          </p>
          <div className="mt-5 flex gap-3">
            <Link href="/import" className="inline-flex items-center gap-2 rounded-lg bg-white text-[var(--color-ink-900)] px-4 py-2 text-sm font-semibold hover:bg-[var(--color-ice-100)]">
              <FileUp size={15} /> Import POS data
            </Link>
            <Link href="/export" className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold hover:bg-white/10">
              <FileDown size={15} /> Export PPTX
            </Link>
          </div>
        </div>
        <div className="hidden md:block h-32 w-px bg-white/20" />
        <dl className="hidden md:grid grid-cols-2 gap-6 min-w-[260px]">
          <Stat label="Months on file" value={months.length.toString()} />
          <Stat label="Sections per month" value={SECTION_KEYS.length.toString()} />
          <Stat label="Default FX" value="30.73" />
          <Stat label="Templates" value="2" />
        </dl>
      </section>

      <section className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">Months</h2>
          <p className="text-[11px] text-[var(--color-ink-600)] mt-0.5">
            Each month references the previous one (YTD totals, region growth, product catalogue).
            Use <strong>Repair chain</strong> to relink every month if data ever drifts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RepairChainButton />
          <NewMonthButton />
        </div>
      </section>

      {months.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-ice-200)] bg-white p-10 text-center text-[var(--color-ink-600)]">
          No months yet. Use <strong>New month</strong> to start, or go straight to <Link href="/import" className="underline">Import</Link> — we'll auto-create the month from the POS files.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {months.map((m) => (
            <MonthCard key={m.id} report={m} completion={completion(m)} missing={missingCount(m)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-[var(--color-ice-200)]">{label}</dt>
      <dd className="mt-0.5 font-[var(--font-display)] text-2xl font-semibold">{value}</dd>
    </div>
  );
}

function MonthCard({ report, completion, missing }: { report: MonthReport; completion: number; missing: number }) {
  return (
    <Link
      href={`/report/${report.id}`}
      className="group rounded-2xl border border-[var(--color-ice-200)] bg-white p-5 hover:shadow-md transition"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[var(--color-ink-600)]">{MONTH_NAMES[report.month - 1]}</p>
          <h3 className="font-[var(--font-display)] text-2xl font-semibold">{monthNameFull(report.month)} {report.year}</h3>
        </div>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-ice-100)] text-[var(--color-ink-800)]">
          {completion}% done
        </span>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-[var(--color-ice-100)]">
        <div
          className="h-full rounded-full bg-[var(--color-ink-800)]"
          style={{ width: `${completion}%` }}
        />
      </div>
      {missing > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-amber-700 dark:text-amber-400">
          <AlertTriangle size={13} />
          <span>{missing} {missing === 1 ? "section" : "sections"} need data — upload POS files to fill them</span>
        </div>
      )}
      <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-ink-600)]">
        <span>FX: 1 MYR = {report.fxRate} JPY</span>
        <span className="flex items-center gap-1 opacity-60 group-hover:opacity-100">
          Open <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}
