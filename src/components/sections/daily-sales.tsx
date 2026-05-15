"use client";
import type { SectionProps } from "../report-editor";
import { NumberCell, SectionShell, TextCell, CommentEditor } from "./shared";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { Calendar, Plus, RefreshCw, Trash2 } from "lucide-react";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function SectionDailySales({ report, update }: SectionProps) {
  const D = report.dailySales ?? { days: [], holidays: [], commentary: "" };
  const set = (patch: Partial<typeof D>) => update({ dailySales: { ...D, ...patch } });
  const daysInMonth = new Date(report.year, report.month, 0).getDate();

  function ensureFullMonth() {
    const out: { date: string; qty: number }[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const iso = `${report.year}-${String(report.month).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const existing = D.days.find(d => d.date === iso);
      out.push({ date: iso, qty: existing?.qty ?? 0 });
    }
    set({ days: out });
  }

  // Build a full-month dataset that always shows every day (chart mirrors the HQ PPTX slide).
  const holidaySet = new Set(D.holidays.map(h => h.date));
  const chartData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const iso = `${report.year}-${String(report.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const row = D.days.find(d => d.date === iso);
    const weekday = new Date(report.year, report.month - 1, day).getDay();
    return {
      day,
      iso,
      weekdayIdx: weekday,
      weekdayShort: WEEKDAY_SHORT[weekday],
      dateLabel: `${day}-${MONTH_ABBR[report.month - 1]}`,
      qty: row?.qty ?? 0,
      isWeekend: weekday === 0 || weekday === 6,
      isHoliday: holidaySet.has(iso),
    };
  });

  const totalQty = chartData.reduce((s, d) => s + d.qty, 0);
  const avgQty = Math.round(totalQty / Math.max(1, chartData.filter(d => d.qty > 0).length));
  const maxQty = chartData.reduce((m, d) => Math.max(m, d.qty), 0);
  const peak = chartData.find(d => d.qty === maxQty && maxQty > 0);

  return (
    <SectionShell sectionKey="dailySales" subtitle="Slide 6 — daily sales quantity. Weekends and holidays marked in red to match the HQ format.">
      {/* Top KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiBox label="Month" value={`${MONTH_ABBR[report.month - 1]} ${report.year}`} />
        <KpiBox label="Total units" value={totalQty.toLocaleString("en-US")} accent />
        <KpiBox label="Avg / trading day" value={avgQty ? avgQty.toLocaleString("en-US") : "—"} />
        <KpiBox label="Peak" value={peak ? `${peak.qty.toLocaleString("en-US")} (${peak.dateLabel})` : "—"} />
      </div>

      {/* Chart card — matches HQ slide 6 aesthetic */}
      <div className="rounded-xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-ice-200)] bg-[var(--color-ice-50)]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-600)]">
            <Calendar size={13} /> Daily Sales Quantity
          </div>
          <button
            type="button"
            onClick={ensureFullMonth}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-ink-800)] text-white px-3 py-1 text-xs font-semibold hover:bg-[var(--color-ink-700)]"
            title="Seed an editable row for each day of the month"
          >
            <RefreshCw size={12} /> Fill {daysInMonth} days
          </button>
        </div>
        <div className="p-4 overflow-x-auto">
          <div style={{ minWidth: Math.max(640, daysInMonth * 34) }} className="h-[360px]">
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 30, right: 16, left: 12, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf7" vertical={false} />
                <XAxis
                  dataKey="day"
                  interval={0}
                  axisLine={{ stroke: "#CBD5E1" }}
                  tickLine={false}
                  height={50}
                  tick={<DayTick data={chartData} />}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  axisLine={{ stroke: "#CBD5E1" }}
                  tickLine={false}
                  label={{ value: "Quantity", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#4B5563" } }}
                />
                <Bar dataKey="qty" fill="#1E2761" radius={[3, 3, 0, 0]} maxBarSize={32}>
                  <LabelList
                    dataKey="qty"
                    position="top"
                    formatter={(v: number) => (v > 0 ? v.toLocaleString("en-US") : "")}
                    style={{ fontSize: 11, fill: "#1F2937", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--color-ink-600)] px-1">
            <LegendChip color="#1E2761">Trading day</LegendChip>
            <LegendChip color="transparent" textColor="#B91C1C" outlined>Weekend / Holiday</LegendChip>
            {D.holidays.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                {D.holidays.map(h => (
                  <span key={h.date} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 text-red-700 px-2 py-0.5 text-[11px]">
                    <span className="font-semibold">{h.date.slice(-2)}/{h.date.slice(5, 7)}</span>
                    {h.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Holidays */}
      <div className="mt-6 rounded-xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-sm">Public holidays</h4>
          <button
            type="button"
            onClick={() => set({ holidays: [...D.holidays, { date: "", label: "" }] })}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-ink-800)] hover:underline"
          >
            <Plus size={12} /> Add
          </button>
        </div>
        {D.holidays.length === 0 ? (
          <p className="text-xs text-[var(--color-ink-600)]">No holidays — chart treats only weekends as non-trading days.</p>
        ) : (
          <div className="space-y-2">
            {D.holidays.map((h, i) => (
              <div key={i} className="grid grid-cols-[160px_1fr_auto] gap-2 items-center">
                <TextCell
                  value={h.date}
                  onChange={v => { const n = [...D.holidays]; n[i] = { ...h, date: v }; set({ holidays: n }); }}
                  placeholder="YYYY-MM-DD"
                />
                <TextCell
                  value={h.label}
                  onChange={v => { const n = [...D.holidays]; n[i] = { ...h, label: v }; set({ holidays: n }); }}
                  placeholder="Hari Raya Aidilfitri"
                />
                <button
                  type="button"
                  onClick={() => set({ holidays: D.holidays.filter((_, j) => j !== i) })}
                  className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editable day values — collapsible grid (all days, no table of one-per-row) */}
      <details className="mt-6 rounded-xl border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)]">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold flex items-center justify-between list-none [&::-webkit-details-marker]:hidden">
          <span>Edit per-day quantities</span>
          <span className="text-xs text-[var(--color-ink-600)]">{chartData.filter(d => d.qty > 0).length} / {daysInMonth} days filled</span>
        </summary>
        <div className="p-4 grid grid-cols-5 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-10 gap-2 border-t border-[var(--color-ice-200)]">
          {chartData.map((d, i) => {
            const isNonTrading = d.isWeekend || d.isHoliday;
            return (
              <label key={d.iso} className="flex flex-col gap-1">
                <span className={cn(
                  "text-[10px] uppercase tracking-wider flex items-center gap-1",
                  isNonTrading ? "text-red-600" : "text-[var(--color-ink-600)]",
                )}>
                  {d.dateLabel}
                  <span className="opacity-70">{d.weekdayShort}</span>
                </span>
                <NumberCell
                  value={d.qty}
                  onChange={n => {
                    const existing = D.days.find(x => x.date === d.iso);
                    const newDays = existing
                      ? D.days.map(x => x.date === d.iso ? { ...x, qty: n ?? 0 } : x)
                      : [...D.days, { date: d.iso, qty: n ?? 0 }].sort((a, b) => a.date.localeCompare(b.date));
                    set({ days: newDays });
                  }}
                />
              </label>
            );
          })}
        </div>
      </details>

      <CommentEditor
        variant="plain"
        className="mt-6"
        value={D.commentary ?? ""}
        onSave={v => set({ commentary: v })}
        rows={5}
      />
    </SectionShell>
  );
}

function KpiBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border px-4 py-3",
      accent
        ? "border-[var(--color-ink-700)] bg-[var(--color-ink-800)] text-white"
        : "border-[var(--color-ice-200)] bg-[var(--color-ice-50)]",
    )}>
      <div className={cn(
        "text-[10px] uppercase tracking-[0.2em] font-semibold",
        accent ? "text-[var(--color-ice-200)]" : "text-[var(--color-ink-600)]",
      )}>{label}</div>
      <div className={cn("font-[var(--font-display)] text-xl font-semibold mt-0.5", accent ? "" : "text-[var(--color-ink-900)]")}>
        {value}
      </div>
    </div>
  );
}

function LegendChip({ color, textColor, outlined, children }: { color: string; textColor?: string; outlined?: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={outlined ? { border: `2px solid ${textColor ?? color}` } : { background: color }}
      />
      <span style={{ color: textColor }}>{children}</span>
    </span>
  );
}

// Custom X-axis tick: two lines (date + weekday), colored red for weekend/holiday.
// Receives standard Recharts tick props (`x`, `y`, `payload`) plus the data array via closure.
type TickData = {
  day: number; dateLabel: string; weekdayShort: string; isWeekend: boolean; isHoliday: boolean;
};
function DayTick({ x, y, payload, data }: {
  x?: number; y?: number; payload?: { value: number }; data: TickData[];
}) {
  const d = data.find(row => row.day === payload?.value);
  if (!d) return null;
  const isNonTrading = d.isWeekend || d.isHoliday;
  const color = isNonTrading ? "#B91C1C" : "#1F2937";
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Red bracket around weekend/holiday days — mirrors the HQ slide styling */}
      {isNonTrading && (
        <rect x={-14} y={2} width={28} height={34} rx={3} fill="none" stroke="#B91C1C" strokeWidth={1} />
      )}
      <text x={0} y={16} textAnchor="middle" fontSize={10} fill={color} fontWeight={isNonTrading ? 600 : 500}>
        {d.dateLabel}
      </text>
      <text x={0} y={30} textAnchor="middle" fontSize={9} fill={color} opacity={0.85}>
        {d.weekdayShort}
      </text>
    </g>
  );
}
