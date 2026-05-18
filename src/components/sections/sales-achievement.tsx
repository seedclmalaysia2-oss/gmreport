"use client";
import type { SectionProps } from "../report-editor";
import { SectionShell, NumberCell } from "./shared";
import { MONTH_NAMES, cn, fmtMYR, fmtPct } from "@/lib/utils";
import type { SalesAchievement, KPINote } from "@/lib/schema";
import { CalendarClock, TrendingUp, Users, Wallet } from "lucide-react";

const empty = (): SalesAchievement => ({
  target2026: Array(12).fill(null),
  actual2026: Array(12).fill(null),
  actual2025: Array(12).fill(null),
  netIncome2026: Array(12).fill(null),
  netIncome2025: Array(12).fill(null),
  kpi: [],
});

type ValueKey = keyof Omit<SalesAchievement, "kpi">;

// Editable money rows + read-only computed % rows, in slide order.
type DataRow = { kind: "data"; key: ValueKey; label: string; year: 2026 | 2025 };
type CalcRow = { kind: "calc"; label: string; numer: ValueKey; denom: ValueKey };
type DisplayRow = DataRow | CalcRow;

const ROWS: DisplayRow[] = [
  { kind: "data", key: "target2026",    label: "Sales Target", year: 2026 },
  { kind: "data", key: "actual2026",    label: "Sales Result", year: 2026 },
  // ACC % = Sales Result 2026 ÷ Sales Target 2026
  { kind: "calc", label: "ACC %", numer: "actual2026", denom: "target2026" },
  { kind: "data", key: "actual2025",    label: "Sales Result", year: 2025 },
  // YoY % = Sales Result 2026 ÷ Sales Result 2025
  { kind: "calc", label: "YoY %", numer: "actual2026", denom: "actual2025" },
  { kind: "data", key: "netIncome2026", label: "Net Income",   year: 2026 },
  { kind: "data", key: "netIncome2025", label: "Net Income",   year: 2025 },
];

export function SectionSalesAchievement({ report, update }: SectionProps) {
  const SA = report.salesAchievement ?? empty();
  const set = (patch: Partial<SalesAchievement>) => update({ salesAchievement: { ...SA, ...patch } });

  const setCell = (key: ValueKey, i: number, n: number | null) => {
    const arr = [...SA[key]]; arr[i] = n;
    set({ [key]: arr } as Partial<SalesAchievement>);
  };

  const rowTotal = (key: ValueKey) => SA[key].reduce<number>((s, v) => s + (v ?? 0), 0);
  // Per-month ratio for a computed row (e.g. ACC %, YoY %) — null when the
  // denominator is missing/zero so the cell shows "—" instead of Infinity.
  const ratioAt = (numer: ValueKey, denom: ValueKey, i: number): number | null => {
    const n = SA[numer][i], d = SA[denom][i];
    if (n == null || d == null || d === 0) return null;
    return n / d;
  };
  const ratioTotal = (numer: ValueKey, denom: ValueKey): number | null => {
    const n = rowTotal(numer), d = rowTotal(denom);
    return d === 0 ? null : n / d;
  };
  const monthIdx = report.month - 1;

  return (
    <SectionShell
      sectionKey="salesAchievement"
      subtitle="Monthly target vs actual, YoY, and Net Income. Current year rows are highlighted."
      isMissing={!report.salesAchievement || report.salesAchievement.actual2026[monthIdx] == null}
    >
      {/* Polished data grid */}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] shadow-sm">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm tabular-nums">
          <colgroup>{[
            <col key="head" className="w-[220px]" />,
            ...MONTH_NAMES.map(m => <col key={m} />),
            <col key="tail" className="w-[120px]" />,
          ]}</colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 z-20 bg-[var(--color-ink-800)] text-white text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] border-r border-[var(--color-ink-700)] rounded-tl-xl">
                Row
              </th>
              {MONTH_NAMES.map((m, i) => (
                <th
                  key={m}
                  className={cn(
                    "px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-right",
                    "bg-[var(--color-ink-800)] text-white",
                    i === monthIdx && "bg-[var(--color-ink-700)]",
                  )}
                >
                  <span className={i === monthIdx ? "inline-flex items-center gap-1 text-[var(--color-accent-2)]" : ""}>
                    {m}
                    {i === monthIdx && <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--color-accent-2)]" />}
                  </span>
                </th>
              ))}
              <th className="bg-[var(--color-ink-800)] text-white text-right px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] rounded-tr-xl">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, rowIdx) => {
              const isLast = rowIdx === ROWS.length - 1;

              // ---- Computed % row (ACC %, YoY %) — read-only, auto-filled ----
              if (r.kind === "calc") {
                const total = ratioTotal(r.numer, r.denom);
                return (
                  <tr key={r.label} className="group transition-colors hover:bg-[var(--color-ice-100)] bg-[var(--color-accent-2)]/15">
                    <th
                      scope="row"
                      className={cn(
                        "sticky left-0 z-10 text-left px-4 py-2 font-medium whitespace-nowrap border-r",
                        "border-[var(--color-ice-200)] group-hover:bg-[var(--color-ice-100)] bg-[var(--color-accent-2)]/15",
                        !isLast && "border-b border-[var(--color-ice-100)]",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span aria-hidden className="inline-block h-5 w-[3px] rounded-sm bg-[var(--color-accent)]" />
                        <div className="flex flex-col leading-tight">
                          <span className="text-[13px] font-semibold text-[var(--color-ink-900)]">{r.label}</span>
                          <span className="text-[10px] uppercase tracking-widest text-[var(--color-ink-600)]">auto-computed</span>
                        </div>
                      </div>
                    </th>
                    {MONTH_NAMES.map((_, i) => {
                      const v = ratioAt(r.numer, r.denom, i);
                      return (
                        <td
                          key={i}
                          className={cn(
                            "px-2 py-1.5 text-right tabular-nums border-r border-[var(--color-ice-100)] last:border-r-0",
                            !isLast && "border-b border-[var(--color-ice-100)]",
                            i === monthIdx && "bg-[var(--color-ice-100)]/60",
                            v != null && v < 1 ? "text-red-600" : "text-[var(--color-ink-900)]",
                          )}
                        >
                          {v == null ? <span className="opacity-30">—</span> : fmtPct(v, 0)}
                        </td>
                      );
                    })}
                    <td
                      className={cn(
                        "px-3 py-1.5 text-right font-semibold tabular-nums text-[var(--color-ink-900)] bg-[var(--color-ice-100)]",
                        !isLast && "border-b border-[var(--color-ice-100)]",
                      )}
                    >
                      {total == null ? "—" : fmtPct(total, 0)}
                    </td>
                  </tr>
                );
              }

              // ---- Editable money row ----
              const is2026 = r.year === 2026;
              const bgClass = is2026 ? "bg-[var(--color-ice-50)]" : "bg-white dark:bg-[var(--surface-1)]";
              const total = rowTotal(r.key);
              return (
                <tr key={r.key} className={cn("group transition-colors hover:bg-[var(--color-ice-100)]", bgClass)}>
                  {/* Sticky row label */}
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 text-left px-4 py-2.5 font-medium whitespace-nowrap border-r",
                      "border-[var(--color-ice-200)] group-hover:bg-[var(--color-ice-100)]",
                      bgClass,
                      !isLast && "border-b border-[var(--color-ice-100)]",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Year accent bar — navy for 2026, muted slate for 2025 */}
                      <span
                        aria-hidden
                        className={cn(
                          "inline-block h-5 w-[3px] rounded-sm",
                          is2026 ? "bg-[var(--color-ink-700)]" : "bg-[var(--color-ice-200)]",
                        )}
                      />
                      <div className="flex flex-col leading-tight">
                        <span className={cn("text-[13px]", is2026 ? "text-[var(--color-ink-900)] font-semibold" : "text-[var(--color-ink-600)]")}>
                          {r.label}
                        </span>
                        <span className={cn(
                          "text-[10px] uppercase tracking-widest",
                          is2026 ? "text-[var(--color-ink-700)]" : "text-[var(--color-ink-600)] opacity-70",
                        )}>
                          {r.year} · MYR
                        </span>
                      </div>
                    </div>
                  </th>
                  {MONTH_NAMES.map((_, i) => (
                    <td
                      key={i}
                      className={cn(
                        "px-2 py-1.5 text-right border-r border-[var(--color-ice-100)] last:border-r-0",
                        !isLast && "border-b border-[var(--color-ice-100)]",
                        i === monthIdx && "bg-[var(--color-ice-100)]/60",
                      )}
                    >
                      <NumberCell
                        variant="plain"
                        value={SA[r.key][i]}
                        onChange={n => setCell(r.key, i, n)}
                      />
                    </td>
                  ))}
                  <td
                    className={cn(
                      "px-3 py-1.5 text-right font-semibold",
                      is2026 ? "text-[var(--color-ink-900)] bg-[var(--color-ice-100)]" : "text-[var(--color-ink-800)] bg-[var(--color-ice-50)]",
                      !isLast && "border-b border-[var(--color-ice-100)]",
                    )}
                  >
                    {total ? total.toLocaleString("en-US") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* KPI commentary cards */}
      <KpiCards
        report={report}
        kpi={SA.kpi.find(k => k.month === report.month) ?? emptyKpi(report.month)}
        setKpi={patch => {
          const others = SA.kpi.filter(k => k.month !== report.month);
          const current = SA.kpi.find(k => k.month === report.month) ?? emptyKpi(report.month);
          set({ kpi: [...others, { ...current, ...patch }].sort((a, b) => a.month - b.month) });
        }}
      />
    </SectionShell>
  );
}

function emptyKpi(month: number): KPINote {
  return {
    month, achievementPct: null, yoyPct: null, newStores: null, ecpThis: null, ecpPrior: null,
    plMyr: null, plJpy: null, extraLines: [],
  };
}

function KpiCards({ report, kpi, setKpi }: {
  report: SectionProps["report"];
  kpi: KPINote;
  setKpi: (patch: Partial<KPINote>) => void;
}) {
  return (
    <div className="mt-7">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-[var(--font-display)] text-lg font-semibold">KPI commentary</h3>
        <span className="text-[11px] uppercase tracking-widest text-[var(--color-ink-600)]">
          {MONTH_NAMES[report.month - 1]} {report.year}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<TrendingUp size={15} />}
          title="Achievement"
          tone="accent"
          trailing={<span className="text-[11px] text-[var(--color-ink-600)]">(0.00–2.00)</span>}
        >
          <NumberCell
            value={kpi.achievementPct}
            onChange={n => setKpi({ achievementPct: n })}
            decimals={2}
          />
        </KpiCard>
        <KpiCard
          icon={<CalendarClock size={15} />}
          title="Year on Year"
          tone="accent"
          trailing={<span className="text-[11px] text-[var(--color-ink-600)]">(0.00–2.00)</span>}
        >
          <NumberCell value={kpi.yoyPct} onChange={n => setKpi({ yoyPct: n })} decimals={2} />
        </KpiCard>
        <KpiCard icon={<Users size={15} />} title="New stores traded">
          <NumberCell value={kpi.newStores} onChange={n => setKpi({ newStores: n })} />
        </KpiCard>
        <KpiCard icon={<Users size={15} />} title={`ECP in ${MONTH_NAMES[report.month - 1]}`}>
          <div className="flex items-end gap-2">
            <NumberCell value={kpi.ecpThis} onChange={n => setKpi({ ecpThis: n })} />
            <span className="text-[11px] text-[var(--color-ink-600)] pb-1.5">vs</span>
            <NumberCell value={kpi.ecpPrior} onChange={n => setKpi({ ecpPrior: n })} />
            <span className="text-[11px] text-[var(--color-ink-600)] pb-1.5">{report.year - 1}</span>
          </div>
        </KpiCard>
        <KpiCard icon={<Wallet size={15} />} title={`${MONTH_NAMES[report.month - 1]} P/L (MYR)`} tone="accent">
          <NumberCell value={kpi.plMyr} onChange={n => setKpi({ plMyr: n })} />
        </KpiCard>
        <KpiCard icon={<Wallet size={15} />} title="P/L JPY (computed if blank)">
          <NumberCell
            value={kpi.plJpy ?? (kpi.plMyr != null ? kpi.plMyr * report.fxRate : null)}
            onChange={n => setKpi({ plJpy: n })}
          />
        </KpiCard>
      </div>
      {kpi.achievementPct != null && kpi.yoyPct != null && (
        <div className="mt-3 rounded-lg border border-[var(--color-ice-200)] bg-[var(--color-ice-50)] px-3 py-2 text-[13px] text-[var(--color-ink-900)]">
          <span className="font-medium">{MONTH_NAMES[report.month - 1]} {report.year}:</span>{" "}
          achievement <strong>{fmtPct(kpi.achievementPct, 0)}</strong> · YoY <strong>{fmtPct(kpi.yoyPct, 0)}</strong>
          {kpi.plMyr != null && <> · P/L <strong>RM {fmtMYR(kpi.plMyr, 0)}</strong></>}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon, title, children, trailing, tone = "plain",
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  tone?: "plain" | "accent";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        tone === "accent"
          ? "border-[var(--color-ice-200)] bg-[var(--color-ice-50)]"
          : "border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)]",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-[var(--color-ink-600)]">
        <span className="text-[var(--color-ink-700)]">{icon}</span>
        <span className="font-semibold">{title}</span>
        {trailing && <span className="ml-auto">{trailing}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
