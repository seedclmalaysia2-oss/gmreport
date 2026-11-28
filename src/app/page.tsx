import Link from "next/link";
import { listDeletedMonthSummaries, listMonthSummaries, type MonthSummary } from "@/lib/month-report";
import { DeletedMonthsSection } from "@/components/deleted-months-section";

// Always re-fetch the months list. Without this, Next's router cache can
// hand out a stale snapshot when the user navigates back from the editor
// after creating a fresh month. revalidatePath() in /api/months handles
// the server-side cache, force-dynamic handles the client router cache.
export const dynamic = "force-dynamic";
import { MONTH_NAMES, monthNameFull } from "@/lib/utils";
import { NewMonthButton } from "@/components/new-month-button";
import { RepairChainButton } from "@/components/repair-chain-button";
import { DeleteMonthButton } from "@/components/delete-month-button";
import { SECTION_KEYS } from "@/lib/schema";

const SECTION_COUNT = SECTION_KEYS.length;
import { AlertTriangle, ArrowRight, FileDown, FileUp } from "lucide-react";

function completion(m: MonthSummary): number {
  return Math.round((m.filledSections / SECTION_COUNT) * 100);
}

function missingCount(m: MonthSummary): number {
  return SECTION_COUNT - m.filledSections;
}

export default async function Home() {
  // Lightweight summary query — no section JSON blobs, fast initial load.
  // listMonthSummaries() already returns year DESC, month DESC — so the
  // first row is the current cycle Simon is working on. Trashed months come
  // in parallel for the Recently-deleted section below the grid.
  const [months, deletedMonths] = await Promise.all([
    listMonthSummaries(),
    listDeletedMonthSummaries(),
  ]);
  const current = months[0] ?? null;
  const missing = current ? missingCount(current) : 0;

  return (
    <div className="space-y-8">
      {/* Briefing band — the current reporting cycle at a glance, primary action
          to jump into it, and the two monthly rituals (upload, export). The old
          hero carried trivia ("Default FX", "Templates: 2") that is not status;
          this one carries only real status for the month Simon is in. */}
      <section
        className="rounded-2xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        aria-label="Current reporting cycle"
      >
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-ink-600)] font-semibold">
            Current cycle
          </p>
          {current ? (
            <div className="mt-1 flex items-baseline gap-x-3 gap-y-1 flex-wrap">
              <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink-900)] leading-none">
                {monthNameFull(current.month)} {current.year}
              </h1>
              <p className="text-sm text-[var(--color-ink-600)] tabular-nums">
                <span>{current.filledSections} of {SECTION_COUNT} sections filled</span>
                {missing > 0 && (
                  <>
                    {" · "}
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-warn)]">
                      <AlertTriangle size={12} aria-hidden="true" />
                      {missing} need data
                    </span>
                  </>
                )}
              </p>
            </div>
          ) : (
            <h1 className="mt-1 font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink-900)] leading-none">
              No months yet
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {current && (
            <Link
              href={`/report/${current.id}`}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--color-ink-800)] text-white px-3 py-1.5 text-sm font-semibold hover:bg-[var(--color-ink-700)]"
            >
              Open {MONTH_NAMES[current.month - 1]}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
          <Link
            href="/files"
            className="inline-flex items-center gap-2 rounded-md border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] text-[var(--color-ink-800)] px-3 py-1.5 text-sm font-semibold hover:bg-[var(--color-ice-100)]"
          >
            <FileUp size={14} aria-hidden="true" /> Upload POS
          </Link>
          <Link
            href="/export"
            className="inline-flex items-center gap-2 rounded-md border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] text-[var(--color-ink-800)] px-3 py-1.5 text-sm font-semibold hover:bg-[var(--color-ice-100)]"
          >
            <FileDown size={14} aria-hidden="true" /> Export
          </Link>
        </div>
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
          No months yet. Use <strong>New month</strong> to start, or go straight to <Link href="/files" className="underline">Import</Link> — we'll auto-create the month from the POS files.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {months.map((m) => (
            <MonthCard key={m.id} report={m} completion={completion(m)} missing={missingCount(m)} />
          ))}
        </div>
      )}

      <DeletedMonthsSection initial={deletedMonths} />
    </div>
  );
}

function MonthCard({ report, completion, missing }: { report: MonthSummary; completion: number; missing: number }) {
  // Wrap in a `relative` so DeleteMonthButton can absolute-position itself
  // in the corner of the card without being trapped inside the Link's click
  // target.
  return (
    <div className="relative">
      <DeleteMonthButton
        monthId={report.id}
        label={`${monthNameFull(report.month)} ${report.year}`}
        filledSections={report.filledSections}
        totalSections={SECTION_COUNT}
      />
      <MonthCardLink report={report} completion={completion} missing={missing} />
    </div>
  );
}

function MonthCardLink({ report, completion, missing }: { report: MonthSummary; completion: number; missing: number }) {
  return (
    <Link
      href={`/report/${report.id}`}
      className="group block rounded-2xl border border-[var(--color-ice-200)] bg-white p-5 hover:shadow-md transition"
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
