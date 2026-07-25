"use client";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import type { MonthReport, SectionKey } from "@/lib/schema";
import { MONTH_NAMES, fmtMYR, fmtJPY, fmtPct, monthNameFull } from "@/lib/utils";
import {
  salesAchievementRows,
  totalForSalesAchievementRow,
  salesAchievementRates,
  trimActualToLastFilled,
} from "@/lib/slide-math";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronUp, Maximize2 } from "lucide-react";
import { Modal } from "./ui/modal";

// Slide canvas in PPT inches: 13.33 × 7.5 (16:9 widescreen).
const SLIDE_W_IN = 13.33;
const SLIDE_H_IN = 7.5;

type Palette = {
  header: string;
  bg: string;
  text: string;
  muted: string;
  rowAlt: string;
  border: string;
  positive: string;
  negative: string;
};

const CLASSIC: Palette = {
  header: "#1F3864",
  bg: "#ffffff",
  text: "#1F2937",
  muted: "#6B7280",
  rowAlt: "#F2F4F8",
  border: "#D0D4DE",
  positive: "#2C8A4A",
  negative: "#B91C1C",
};

const MODERN: Palette = {
  header: "#0B0F2B",
  bg: "#FFFFFF",
  text: "#0B0F2B",
  muted: "#4353A6",
  rowAlt: "#F1F4FC",
  border: "#CADCFC",
  positive: "#2C8A4A",
  negative: "#B91C1C",
};

type Template = "classic" | "modern";

// Measure the inner slide element and derive scale = container_px / slide_inches.
// Synchronous first-measure via layout effect avoids the initial-render flicker.
function useSlideScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / SLIDE_W_IN);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, scale };
}

export function SlidePreview({
  section, report, siblings = [],
  controlledTemplate, controlledPalette, hideChrome = false,
}: {
  /** Accepts any of the 13 editor sections + "cover" / "agenda" / "thankyou" for PDF export. */
  section: DeckSlide;
  report: MonthReport;
  siblings?: MonthReport[];
  /** When provided, the internal template toggle is hidden and this value is used. */
  controlledTemplate?: Template;
  /** When provided, overrides the built-in CLASSIC/MODERN palette for the rendered slide. */
  controlledPalette?: Palette;
  /** Hide the header (title + toggle + maximize) — used when embedded in the Export page which supplies its own chrome. */
  hideChrome?: boolean;
}) {
  const [internalTemplate, setTemplate] = useState<Template>("classic");
  const template = controlledTemplate ?? internalTemplate;
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className={hideChrome ? "" : "mt-6 rounded-2xl border border-[var(--color-ice-200)] bg-white overflow-hidden"}>
        {!hideChrome && (
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-ice-200)] px-4 py-2 bg-[var(--color-ice-50)]">
            <button
              onClick={() => setCollapsed(v => !v)}
              className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-[var(--color-ink-600)] font-semibold hover:text-[var(--color-ink-900)]"
              title={collapsed ? "Expand preview" : "Collapse preview"}
            >
              {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
              Slide preview
            </button>
            <div className="flex items-center gap-2">
              {!controlledTemplate && (
                <div className="inline-flex rounded-md border border-[var(--color-ice-200)] overflow-hidden text-xs">
                  {(["classic","modern"] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTemplate(t)}
                      className={[
                        "px-3 py-1 font-semibold",
                        template === t ? "bg-[var(--color-ink-800)] text-white" : "bg-transparent text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)]",
                      ].join(" ")}
                    >
                      {t === "classic" ? "Classic" : "Modern"}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setExpanded(true)}
                className="rounded-md p-1.5 hover:bg-[var(--color-ice-100)] text-[var(--color-ink-800)]"
                title="Open full-size preview"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>
        )}
        {!collapsed && (
          <PreviewCanvas section={section} report={report} template={template} siblings={siblings} paletteOverride={controlledPalette} noPadding={hideChrome} />
        )}
      </div>
      {expanded && (
        <ExpandedPreview section={section} report={report} template={template} siblings={siblings} paletteOverride={controlledPalette} onClose={() => setExpanded(false)} />
      )}
    </>
  );
}

// Inner canvas: horizontally scrollable wrapper + a min-width on the measured element
// so narrow viewports (dev tools open, split screens) don't crush the slide into a blur.
function PreviewCanvas({ section, report, template, siblings, minWidth = 640, paletteOverride, noPadding = false }: {
  section: DeckSlide; report: MonthReport; template: Template; siblings: MonthReport[]; minWidth?: number; paletteOverride?: Palette;
  /** When true, the slide fills its parent edge-to-edge (used by PDF export stage). */
  noPadding?: boolean;
}) {
  const { ref, scale } = useSlideScale();
  const palette = paletteOverride ?? (template === "classic" ? CLASSIC : MODERN);
  return (
    <div className={noPadding ? "" : "overflow-x-auto bg-[var(--color-ice-50)] p-4"}>
      <div
        ref={ref}
        className={noPadding ? "relative" : "relative mx-auto ring-1 ring-[var(--color-ice-200)] border border-[var(--color-ice-200)]"}
        style={{
          width: "100%",
          minWidth: noPadding ? undefined : minWidth,
          height: noPadding ? "100%" : undefined,
          aspectRatio: noPadding ? undefined : `${SLIDE_W_IN} / ${SLIDE_H_IN}`,
          background: palette.bg,
          overflow: "hidden",
        }}
      >
        {scale > 0 && <SlideBody section={section} report={report} template={template} scale={scale} siblings={siblings} paletteOverride={paletteOverride} />}
      </div>
    </div>
  );
}

// Full-screen modal — viewport-width preview for detail review. Uses the
// shared <Modal> shell so it inherits the focus trap, ESC dismiss,
// role="dialog" + aria-modal + labelled-by, and restore-on-close from
// the same primitive the Files-page dialogs use.
function ExpandedPreview({ section, report, template, siblings, onClose, paletteOverride }: {
  section: DeckSlide; report: MonthReport; template: Template; siblings: MonthReport[]; onClose: () => void; paletteOverride?: Palette;
}) {
  const templateLabel = template === "classic" ? "Classic" : "Modern";
  return (
    <Modal
      open={true}
      onClose={onClose}
      role="dialog"
      tone="neutral"
      size="full"
      title={`${templateLabel} preview`}
      subtitle="Full-size review — press Esc to close."
      labelledById="expanded-preview-title"
      describedById="expanded-preview-body"
    >
      <div className="-m-5">
        <PreviewCanvas section={section} report={report} template={template} siblings={siblings} minWidth={900} paletteOverride={paletteOverride} />
      </div>
    </Modal>
  );
}

// -------- Slide-body router --------

/** Extended slide identifier — same 13 section keys plus the 3 chrome slides
 *  (cover / agenda / thankyou) that bracket the real PPTX deck. */
export type DeckSlide = SectionKey | "cover" | "agenda" | "thankyou";

function SlideBody({ section, report, template, scale, siblings, paletteOverride }: {
  section: DeckSlide; report: MonthReport; template: Template; scale: number; siblings: MonthReport[]; paletteOverride?: Palette;
}) {
  const P = paletteOverride ?? (template === "classic" ? CLASSIC : (MODERN as Palette));
  switch (section) {
    case "cover":               return <SlideCover report={report} P={P} scale={scale} />;
    case "agenda":              return <SlideAgenda P={P} scale={scale} />;
    case "thankyou":            return <SlideThankYou P={P} scale={scale} />;
    case "salesAchievement":    return <SlideSalesAchievement report={report} P={P} template={template} scale={scale} />;
    case "salesTrend":          return <SlideSalesTrend report={report} P={P} scale={scale} />;
    case "marketOutlook":       return <SlideOutlook report={report} P={P} scale={scale} />;
    case "dailySales":          return <SlideDailySales report={report} P={P} scale={scale} />;
    case "salesByQuantity":     return <SlideSalesByQuantity report={report} P={P} scale={scale} siblings={siblings} />;
    case "topProducts":         return <SlideTopProducts report={report} P={P} scale={scale} template={template} />;
    case "salesByECP":          return <SlideSalesByECP report={report} P={P} scale={scale} />;
    case "salesByRegion":       return <SlideSalesByRegion report={report} P={P} scale={scale} />;
    case "productRegistration": return <SlideProductRegistration report={report} P={P} scale={scale} />;
    case "inventory":           return <SlideInventory report={report} P={P} scale={scale} />;
    case "expireWriteOff":      return <SlideExpireWriteOff report={report} P={P} scale={scale} siblings={siblings} />;
    case "financial":           return <SlideFinancial report={report} P={P} scale={scale} />;
    case "otherMarket":         return <SlideOtherMarket report={report} P={P} scale={scale} />;
  }
}

// -------- Building blocks --------

function px(inches: number, scale: number) { return `${inches * scale}px`; }
// scale is px-per-inch of the rendered slide. 1 point = 1/72 inch.
// Font size in css pixels = (pt / 72) * scale.
function fs(pt: number, scale: number) { return `${(pt / 72) * scale}px`; }

function SlideTitle({ text, palette, scale, x = 0.3, y = 0.22, w = 12.7, size = 22 }: {
  text: string; palette: Palette; scale: number; x?: number; y?: number; w?: number; size?: number;
}) {
  return (
    <div
      style={{
        position: "absolute", left: px(x, scale), top: px(y, scale), width: px(w, scale),
        fontWeight: 700, fontSize: fs(size, scale), color: palette.text, lineHeight: 1.1,
        fontFamily: "Calibri, Inter, system-ui",
      }}
    >
      {text}
    </div>
  );
}

// -------- Individual slides --------

function SlideSalesAchievement({ report, P, scale, template }: { report: MonthReport; P: Palette; scale: number; template: Template }) {
  const SA = report.salesAchievement;
  // Row values + weighted-ratio totals come from lib/slide-math so the
  // preview and the server PPTX generator can't drift on this math. Any
  // edit here must land in one place.
  const rows = salesAchievementRows(SA);
  const kpi = SA?.kpi.find(k => k.month === report.month);
  // Achievement / YoY derived from the figures so they match the ACC % / YoY %
  // table rows exactly — a whole-number percent, no separately stored value.
  const { accRate, yoyRate } = salesAchievementRates(SA, report.month);
  return (
    <>
      <SlideTitle palette={P} scale={scale} text={`1. Sales Achievement (${MONTH_NAMES[report.month - 1]} ${report.year})`} size={20} />
      <div style={{ position: "absolute", left: px(0.3, scale), top: px(0.85, scale), width: px(12.7, scale), fontSize: fs(9, scale) }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Calibri" }}>
          <thead>
            <tr>
              <th style={thStyle(P, scale)}></th>
              {MONTH_NAMES.map(m => <th key={m} style={thStyle(P, scale, "right")}>{m}</th>)}
              <th style={thStyle(P, scale, "right")}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={14} style={{ padding: 12, textAlign: "center", color: P.muted }}>No data yet</td></tr>}
            {rows.map((r, i) => {
              const total = totalForSalesAchievementRow(r);
              return (
                <tr key={r.label} style={{ background: i % 2 === 0 ? P.rowAlt : "transparent" }}>
                  <td style={{ ...tdStyle(P, scale), fontWeight: 600 }}>{r.label}</td>
                  {r.values.map((v, j) => (
                    <td key={j} style={{ ...tdStyle(P, scale, "right") }}>
                      {v == null ? "" : r.isPct ? fmtPct(v, 0) : fmtMYR(v, 0)}
                    </td>
                  ))}
                  <td style={{ ...tdStyle(P, scale, "right"), fontWeight: 600 }}>
                    {total == null ? "" : r.isPct ? fmtPct(total, 0) : fmtMYR(total, 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {kpi && (
        <div style={{
          position: "absolute", left: px(0.3, scale), top: px(5.6, scale),
          width: px(12.7, scale), fontSize: fs(11, scale), color: P.text, lineHeight: 1.45,
        }}>
          <ul style={{ paddingLeft: px(0.22, scale), margin: 0 }}>
            <li>Monthly achievement rate of {fmtPct(accRate, 0)}</li>
            <li>YoY achievement rate for same month {fmtPct(yoyRate, 0)}</li>
            <li>{kpi.newStores ?? 0} newly developed stores, {MONTH_NAMES[report.month - 1]} {report.year} = {kpi.ecpThis ?? 0} ECP vs {MONTH_NAMES[report.month - 1]} {report.year - 1} = {kpi.ecpPrior ?? 0} ECP</li>
            <li>{MONTH_NAMES[report.month - 1]} P/L: RM {fmtMYR(kpi.plMyr, 0)} (≈ {(((kpi.plJpy ?? (kpi.plMyr ?? 0) * report.fxRate)) / 1_000_000).toFixed(2)} mil yen)</li>
          </ul>
        </div>
      )}
    </>
  );
}

function SlideSalesTrend({ report, P, scale }: { report: MonthReport; P: Palette; scale: number }) {
  const SA = report.salesAchievement;
  // Trim Actual 2026 to the last month with data via the shared helper —
  // the server PPTX generator uses the same function so the chart clip
  // point can't drift between preview and export.
  const actual2026Trimmed = trimActualToLastFilled(SA?.actual2026 ?? Array(12).fill(null));
  const data = MONTH_NAMES.map((m, i) => ({
    month: m,
    "Target 2026": SA?.target2026[i] ?? null,
    "Actual 2026": actual2026Trimmed[i],
    "Actual 2025": SA?.actual2025[i] ?? null,
  }));
  // Commentary: when present, the chart shrinks to make room for a card below.
  const commentary = (report.salesTrend?.commentary ?? "").trim();
  const hasComment = commentary.length > 0;
  return (
    <>
      <SlideTitle palette={P} scale={scale} text="2. Sales Trend 2026" />
      <div style={{ position: "absolute", left: px(0.4, scale), top: px(0.9, scale), width: px(12.6, scale), height: px(hasComment ? 4.5 : 6.1, scale) }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 12, right: 24, bottom: 20, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf7" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="Actual 2026" stroke="#0B1F5C" strokeWidth={4} dot={{ r: 5, fill: "#0B1F5C", strokeWidth: 0 }} connectNulls={false} isAnimationActive={false}>
              <LabelList dataKey="Actual 2026" position="top" offset={18} formatter={(v: number) => v ? (v / 1000).toFixed(0) + "k" : ""} style={{ fontSize: Math.max(12, Number(fs(11, scale).replace("px",""))), fill: "#0B1F5C", fontWeight: 800 }} />
            </Line>
            <Line type="monotone" dataKey="Target 2026" stroke="#DC2626" strokeWidth={3} strokeDasharray="5 3" dot={{ r: 4, fill: "#DC2626", strokeWidth: 0 }} isAnimationActive={false}>
              <LabelList dataKey="Target 2026" position="right" offset={8} formatter={(v: number) => v ? (v / 1000).toFixed(0) + "k" : ""} style={{ fontSize: Math.max(10, Number(fs(9, scale).replace("px",""))), fill: "#DC2626", fontWeight: 700 }} />
            </Line>
            <Line type="monotone" dataKey="Actual 2025" stroke="#22C55E" strokeWidth={3} dot={{ r: 4, fill: "#22C55E", strokeWidth: 0 }} isAnimationActive={false}>
              <LabelList dataKey="Actual 2025" position="left" offset={8} formatter={(v: number) => v ? (v / 1000).toFixed(0) + "k" : ""} style={{ fontSize: Math.max(10, Number(fs(9, scale).replace("px",""))), fill: "#15803D", fontWeight: 700 }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Commentary card — only when there's text, mirrors Daily Sales styling. */}
      {hasComment && (
        <div style={{
          position: "absolute", left: px(0.4, scale), top: px(5.55, scale),
          width: px(12.6, scale), height: px(1.65, scale),
          background: "#F4F7FF",
          border: `1px solid ${P.border}`,
          borderRadius: Math.max(4, 0.06 * scale),
          padding: px(0.14, scale),
          overflow: "hidden",
        }}>
          <div style={{ fontSize: fs(8, scale), color: P.muted, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, marginBottom: px(0.04, scale) }}>
            Commentary
          </div>
          <div style={{ fontSize: fs(11, scale), color: P.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            {commentary}
          </div>
        </div>
      )}
    </>
  );
}

function SlideOutlook({ report, P, scale }: { report: MonthReport; P: Palette; scale: number }) {
  const html = report.marketOutlook?.body || "—";
  return (
    <>
      <SlideTitle palette={P} scale={scale} text={`3. Malaysia Outlook – ${MONTH_NAMES[report.month - 1]} ${report.year}`} />
      <div
        style={{
          position: "absolute", left: px(0.5, scale), top: px(0.9, scale),
          width: px(12.3, scale), height: px(6.2, scale), fontSize: fs(11, scale),
          color: P.text, overflow: "hidden", lineHeight: 1.5,
        }}
        // Rich text from RichTextEditor. Trusted source (our own editor), so dangerouslySetInnerHTML is fine.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

function SlideDailySales({ report, P, scale }: { report: MonthReport; P: Palette; scale: number }) {
  const D = report.dailySales;
  const daysInMonth = new Date(report.year, report.month, 0).getDate();
  const holidaySet = new Set((D?.holidays ?? []).map(h => h.date));
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const weekdayShort = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const data = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const iso = `${report.year}-${String(report.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const row = D?.days.find(d => d.date === iso);
    const wd = new Date(report.year, report.month - 1, day).getDay();
    return {
      day,
      qty: row?.qty ?? 0,
      dateLabel: `${day}-${months[report.month - 1]}`,
      weekdayShort: weekdayShort[wd],
      nonTrading: wd === 0 || wd === 6 || holidaySet.has(iso),
    };
  });
  return (
    <>
      <SlideTitle palette={P} scale={scale} text={`4. Daily Sales Quantity – ${monthNameFull(report.month).toUpperCase()} ${report.year}`} size={20} />

      {/* Chart — KPI strip was removed (matches the editor); chart starts
          right under the title and uses the freed vertical space. */}
      <div style={{
        position: "absolute", left: px(0.3, scale), top: px(0.85, scale),
        width: px(12.7, scale), height: px(4.5, scale),
        background: "#fff",
        border: `1px solid ${P.border}`,
        borderRadius: Math.max(4, 0.06 * scale),
        padding: px(0.12, scale),
      }}>
        {data.length > 0 ? (
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 18, right: 8, left: 4, bottom: 34 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf7" vertical={false} />
              <XAxis
                dataKey="day"
                interval={0}
                axisLine={{ stroke: "#CBD5E1" }}
                tickLine={false}
                height={32}
                tick={(props: { x?: number; y?: number; payload?: { value: number } }) => {
                  const d = data.find(row => row.day === props.payload?.value);
                  if (!d) return <g />;
                  const color = d.nonTrading ? "#B91C1C" : "#1F2937";
                  return (
                    <g transform={`translate(${props.x ?? 0},${props.y ?? 0})`}>
                      <text x={0} y={12} textAnchor="middle" fontSize={Math.max(8, Number(fs(7, scale).replace("px","")))} fill={color} fontWeight={d.nonTrading ? 700 : 500}>{d.day}</text>
                      <text x={0} y={24} textAnchor="middle" fontSize={Math.max(7, Number(fs(6, scale).replace("px","")))} fill={color} opacity={0.85}>{d.weekdayShort}</text>
                    </g>
                  );
                }}
              />
              <YAxis tick={{ fontSize: Math.max(8, Number(fs(8, scale).replace("px","") || 8)), fill: "#6B7280" }} axisLine={{ stroke: "#CBD5E1" }} tickLine={false} />
              <Tooltip />
              <Bar dataKey="qty" fill={P.header} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {/* Per-day fill: weekends + holidays render dimmed so the eye lands on trading days. */}
                {data.map((d, i) => (
                  <Cell key={i} fill={d.nonTrading ? "#94A3B8" : P.header} />
                ))}
                {/* Value labels above each bar — mirrors the editor + PPTX. */}
                <LabelList
                  dataKey="qty"
                  position="top"
                  formatter={(v: number) => (v > 0 ? v.toLocaleString("en-US") : "")}
                  style={{
                    fontSize: Math.max(8, Number(fs(7, scale).replace("px","") || 8)),
                    fill: "#1F2937",
                    fontWeight: 700,
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyMsg scale={scale} P={P} />}
      </div>

      {/* Holiday pills */}
      {(D?.holidays ?? []).length > 0 && (
        <div style={{
          position: "absolute", left: px(0.3, scale), top: px(5.42, scale),
          width: px(12.7, scale), height: px(0.35, scale),
          display: "flex", flexWrap: "wrap", gap: px(0.10, scale), alignItems: "center",
        }}>
          {(D?.holidays ?? []).map((h, i) => (
            <span key={i} style={{
              background: "#FEF2F2",
              color: "#B91C1C",
              border: "1px solid #FECACA",
              padding: `${px(0.03, scale)} ${px(0.12, scale)}`,
              borderRadius: 999,
              fontSize: fs(9, scale),
              fontWeight: 600,
            }}>
              <span style={{ fontWeight: 700, marginRight: 4 }}>{h.date.slice(-2)}/{h.date.slice(5, 7)}</span>
              {h.label}
            </span>
          ))}
        </div>
      )}

      {/* Commentary card */}
      <div style={{
        position: "absolute", left: px(0.3, scale), top: px(5.88, scale),
        width: px(12.7, scale), height: px(1.4, scale),
        background: "#F4F7FF",
        border: `1px solid ${P.border}`,
        borderRadius: Math.max(4, 0.06 * scale),
        padding: px(0.14, scale),
        overflow: "hidden",
      }}>
        <div style={{ fontSize: fs(8, scale), color: P.muted, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, marginBottom: px(0.04, scale) }}>
          Commentary
        </div>
        <div style={{ fontSize: fs(11, scale), color: P.text, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {D?.commentary || ""}
        </div>
      </div>
    </>
  );
}

function SlideSalesByQuantity({ report, P, scale, siblings }: { report: MonthReport; P: Palette; scale: number; siblings: MonthReport[] }) {
  const rows = report.salesByQuantity?.rows ?? [];
  const prevMonthNum = report.month === 1 ? 12 : report.month - 1;
  const prevYearNum  = report.month === 1 ? report.year - 1 : report.year;
  const prior = siblings.find(m => m.year === prevYearNum && m.month === prevMonthNum);
  const priorMap = new Map((prior?.salesByQuantity?.rows ?? []).map(r => [r.product, r]));

  // YTD 2026 across every 2026 month on file ≤ current.
  const ytdMap = new Map<string, number>();
  for (const m of siblings.filter(m => m.year === report.year && m.month <= report.month)) {
    for (const r of m.salesByQuantity?.rows ?? []) {
      ytdMap.set(r.product, (ytdMap.get(r.product) ?? 0) + r.qty2026);
    }
  }
  // If the seeded report itself isn't in `siblings` yet, fold in its rows.
  if (!siblings.some(m => m.id === report.id)) {
    for (const r of rows) ytdMap.set(r.product, (ytdMap.get(r.product) ?? 0) + r.qty2026);
  }

  const topSet = new Set((report.topProducts?.rows ?? []).slice(0, 4).map(r => r.product.toLowerCase()));
  const RED = "#C00000";
  const GREEN = "#E2EFDA";
  const BLUE_H = "#4472C4";

  const prevShort = MONTH_NAMES[prevMonthNum - 1];
  const currShort = MONTH_NAMES[report.month - 1];

  // Totals
  let totPrev26 = 0, totPrev25 = 0, totCurr26 = 0, totCurr25 = 0, totYtd = 0;
  for (const r of rows) {
    const p = priorMap.get(r.product);
    totPrev26 += p?.qty2026 ?? 0;
    totPrev25 += p?.qty2025 ?? 0;
    totCurr26 += r.qty2026;
    totCurr25 += r.qty2025;
    totYtd    += ytdMap.get(r.product) ?? 0;
  }

  const fmt = (n: number) => (n === 0 ? "" : n.toLocaleString("en-US"));

  // Sized to fit the whole 13.33×7.5 slide with ~30 rows + header + total — no scroll.
  const bodyFont = fs(8.5, scale);
  const headFont = fs(9, scale);
  const titleFont = fs(18, scale);

  return (
    <>
      <div
        style={{
          position: "absolute", left: px(0.25, scale), top: px(0.14, scale), width: px(12.8, scale),
          fontFamily: "Calibri", fontSize: titleFont, fontWeight: 700, color: P.text,
          textDecoration: "underline", textUnderlineOffset: "0.15em",
        }}
      >
        5. Sales Quantity – {currShort.toUpperCase()} {report.year}
      </div>
      <div style={{ position: "absolute", left: px(0.25, scale), top: px(0.76, scale), width: px(12.85, scale), height: px(6.55, scale), overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Calibri", fontSize: bodyFont, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: `${(4.35 / 12.85) * 100}%` }} />
            <col style={{ width: `${(1.45 / 12.85) * 100}%` }} />
            <col style={{ width: `${(1.45 / 12.85) * 100}%` }} />
            <col style={{ width: `${(1.75 / 12.85) * 100}%` }} />
            <col style={{ width: `${(1.45 / 12.85) * 100}%` }} />
            <col style={{ width: `${(2.40 / 12.85) * 100}%` }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={{ background: P.header, color: "#fff", padding: fs(3, scale), fontSize: headFont, textAlign: "left", border: `1px solid ${P.border}` }}>Product</th>
              <th style={{ background: P.header, color: "#fff", padding: fs(3, scale), fontSize: headFont, textAlign: "center", border: `1px solid ${P.border}` }}>2026</th>
              <th style={{ background: P.header, color: "#fff", padding: fs(3, scale), fontSize: headFont, textAlign: "center", border: `1px solid ${P.border}` }}>2025</th>
              <th style={{ background: GREEN, color: "#1F3864", padding: fs(3, scale), fontSize: headFont, textAlign: "center", fontWeight: 700, border: `1px solid ${P.border}` }}>2026</th>
              <th style={{ background: P.header, color: "#fff", padding: fs(3, scale), fontSize: headFont, textAlign: "center", border: `1px solid ${P.border}` }}>2025</th>
              <th rowSpan={2} style={{ background: P.header, color: "#fff", padding: fs(3, scale), fontSize: headFont, textAlign: "center", border: `1px solid ${P.border}` }}>
                Total 2026<br/><span style={{ fontWeight: 400, opacity: 0.8 }}>Jan ~ {currShort}</span>
              </th>
            </tr>
            <tr>
              <th style={{ background: BLUE_H, color: "#fff", padding: fs(2, scale), fontSize: headFont, textAlign: "center", border: `1px solid ${P.border}` }}>{prevShort}</th>
              <th style={{ background: BLUE_H, color: "#fff", padding: fs(2, scale), fontSize: headFont, textAlign: "center", border: `1px solid ${P.border}` }}>{prevShort}</th>
              <th style={{ background: GREEN, color: "#1F3864", padding: fs(2, scale), fontSize: headFont, textAlign: "center", fontWeight: 700, border: `1px solid ${P.border}` }}>{currShort}</th>
              <th style={{ background: BLUE_H, color: "#fff", padding: fs(2, scale), fontSize: headFont, textAlign: "center", border: `1px solid ${P.border}` }}>{currShort}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const p = priorMap.get(r.product);
              const ytd = ytdMap.get(r.product) ?? 0;
              const isTop = topSet.has(r.product.toLowerCase());
              const color = isTop ? RED : P.text;
              const bold = isTop ? 700 : 400;
              return (
                <tr key={r.product} style={{ background: i % 2 === 0 ? "#ffffff" : "#F2F4F8" }}>
                  <td style={{ padding: fs(2.5, scale), border: `1px solid ${P.border}`, color, fontWeight: bold, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.product}</td>
                  <td style={{ padding: fs(2.5, scale), border: `1px solid ${P.border}`, textAlign: "center", color: P.text }}>{fmt(p?.qty2026 ?? 0)}</td>
                  <td style={{ padding: fs(2.5, scale), border: `1px solid ${P.border}`, textAlign: "center", color: P.muted }}>{fmt(p?.qty2025 ?? 0)}</td>
                  <td style={{ padding: fs(2.5, scale), border: `1px solid ${P.border}`, textAlign: "center", color, fontWeight: bold, background: GREEN }}>{fmt(r.qty2026)}</td>
                  <td style={{ padding: fs(2.5, scale), border: `1px solid ${P.border}`, textAlign: "center", color: P.muted }}>{fmt(r.qty2025)}</td>
                  <td style={{ padding: fs(2.5, scale), border: `1px solid ${P.border}`, textAlign: "center", color, fontWeight: 700 }}>{fmt(ytd)}</td>
                </tr>
              );
            })}
            <tr>
              <td style={{ padding: fs(2.5, scale), border: `1px solid ${P.border}`, background: P.header, color: "#fff", fontWeight: 700 }}>Total</td>
              <td style={{ padding: fs(2.5, scale), border: `1px solid ${P.border}`, background: P.header, color: "#fff", fontWeight: 700, textAlign: "center" }}>{fmt(totPrev26)}</td>
              <td style={{ padding: fs(2.5, scale), border: `1px solid ${P.border}`, background: P.header, color: "#fff", fontWeight: 700, textAlign: "center" }}>{fmt(totPrev25)}</td>
              <td style={{ padding: fs(2.5, scale), border: `1px solid ${P.border}`, background: GREEN, color: "#1F3864", fontWeight: 700, textAlign: "center" }}>{fmt(totCurr26)}</td>
              <td style={{ padding: fs(2.5, scale), border: `1px solid ${P.border}`, background: P.header, color: "#fff", fontWeight: 700, textAlign: "center" }}>{fmt(totCurr25)}</td>
              <td style={{ padding: fs(2.5, scale), border: `1px solid ${P.border}`, background: P.header, color: "#fff", fontWeight: 700, textAlign: "center" }}>{fmt(totYtd)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function SlideTopProducts({ report, P, scale, template }: { report: MonthReport; P: Palette; scale: number; template: Template }) {
  const rows = report.topProducts?.rows ?? [];
  return (
    <>
      <SlideTitle palette={P} scale={scale} text={`6. Sales by Product – ${MONTH_NAMES[report.month - 1]} ${report.year}`} />
      <div style={{
        position: "absolute", right: px(0.4, scale), top: px(0.35, scale),
        fontSize: fs(10, scale), color: P.muted, fontStyle: "italic",
      }}>
        *1 MYR = {report.fxRate} JPY
      </div>
      <div style={{ position: "absolute", left: px(0.5, scale), top: px(0.9, scale), width: px(12.2, scale), height: px(6.3, scale), fontSize: fs(9, scale), overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Calibri" }}>
          <thead>
            <tr>
              <th style={thStyle(P, scale)}>Product</th>
              <th style={thStyle(P, scale, "right")}>MYR</th>
              <th style={thStyle(P, scale, "right")}>%</th>
              <th style={thStyle(P, scale, "right")}>JPY</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} style={{ padding: 12, textAlign: "center", color: P.muted }}>No data yet</td></tr>}
            {rows.slice(0, 16).map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? P.rowAlt : "transparent" }}>
                <td style={tdStyle(P, scale)}>{r.product}</td>
                <td style={tdStyle(P, scale, "right")}>{fmtMYR(r.myr, 0)}</td>
                <td style={tdStyle(P, scale, "right")}>{fmtPct(r.pct, 1)}</td>
                <td style={tdStyle(P, scale, "right")}>{fmtJPY(r.myr * report.fxRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SlideSalesByECP({ report, P, scale }: { report: MonthReport; P: Palette; scale: number }) {
  const rows = report.salesByECP?.rows ?? [];
  return (
    <>
      <SlideTitle palette={P} scale={scale} text={`7. Sales by ECP – ${MONTH_NAMES[report.month - 1]} ${report.year}`} />
      <div style={{ position: "absolute", left: px(1.0, scale), top: px(1.6, scale), width: px(11.1, scale), fontSize: fs(11, scale) }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Calibri" }}>
          <thead>
            <tr>
              <th style={thStyle(P, scale)}>Category</th>
              <th style={thStyle(P, scale, "right")}>Outlets</th>
              <th style={thStyle(P, scale, "right")}>%</th>
              <th style={thStyle(P, scale, "right")}>Sales (JPY)</th>
              <th style={thStyle(P, scale, "right")}>Sales (MYR)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.category} style={{ background: i % 2 === 0 ? P.rowAlt : "transparent" }}>
                <td style={tdStyle(P, scale)}>{r.category}</td>
                <td style={tdStyle(P, scale, "right")}>{r.outlets}</td>
                <td style={tdStyle(P, scale, "right")}>{fmtPct(r.pct, 0)}</td>
                <td style={tdStyle(P, scale, "right")}>{fmtJPY(r.salesMyr * report.fxRate)}</td>
                <td style={tdStyle(P, scale, "right")}>MYR {fmtMYR(r.salesMyr, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SlideSalesByRegion({ report, P, scale }: { report: MonthReport; P: Palette; scale: number }) {
  const rows = report.salesByRegion?.rows ?? [];
  return (
    <>
      <SlideTitle palette={P} scale={scale} text={`8. Sales by Region – ${MONTH_NAMES[report.month - 1]} ${report.year}`} />
      <div style={{ position: "absolute", left: px(0.7, scale), top: px(1.35, scale), width: px(11.7, scale), fontSize: fs(11, scale) }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Calibri" }}>
          <thead>
            <tr>
              <th style={thStyle(P, scale)}>Region</th>
              <th style={thStyle(P, scale, "right")}>This month</th>
              <th style={thStyle(P, scale, "right")}>Prev month</th>
              <th style={thStyle(P, scale, "right")}>Growth %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.region} style={{ background: i % 2 === 0 ? P.rowAlt : "transparent" }}>
                <td style={tdStyle(P, scale)}>{r.region}</td>
                <td style={tdStyle(P, scale, "right")}>{fmtMYR(r.salesThis, 0)}</td>
                <td style={tdStyle(P, scale, "right")}>{fmtMYR(r.salesPrev, 0)}</td>
                <td style={{ ...tdStyle(P, scale, "right"), color: r.growthPct >= 0 ? P.positive : P.negative }}>{fmtPct(r.growthPct, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ position: "absolute", left: px(0.9, scale), top: px(4.8, scale), width: px(11.2, scale), fontSize: fs(10, scale), color: P.text, lineHeight: 1.4 }}>
        {report.salesByRegion?.commentary ?? ""}
      </div>
    </>
  );
}

function SlideProductRegistration({ report, P, scale }: { report: MonthReport; P: Palette; scale: number }) {
  const rows = report.productRegistration?.rows ?? [];
  const headers = ["Product","Class","Start","Doc OS","CAB","MDA Sub","MDA Proc","Completion","Approval No"];
  const cmt = report.productRegistration?.commentary || "";
  const hasCmt = cmt.replace(/<[^>]*>/g, "").trim().length > 0;
  return (
    <>
      <SlideTitle palette={P} scale={scale} text="9. Product Registration in Progress" />
      <div style={{ position: "absolute", left: px(0.4, scale), top: px(1.1, scale), width: px(12.6, scale), fontSize: fs(8.5, scale) }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Calibri" }}>
          <thead>
            <tr>{headers.map(h => <th key={h} style={thStyle(P, scale)}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={headers.length} style={{ padding: 12, textAlign: "center", color: P.muted }}>No registrations tracked yet</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? P.rowAlt : "transparent" }}>
                <td style={tdStyle(P, scale)}>{r.product}</td>
                <td style={tdStyle(P, scale)}>{r.class}</td>
                <td style={tdStyle(P, scale)}>{r.startDate}</td>
                <td style={tdStyle(P, scale)}>{r.docOverseas}</td>
                <td style={tdStyle(P, scale)}>{r.cabAssessment}</td>
                <td style={tdStyle(P, scale)}>{r.mdaSubmission}</td>
                <td style={tdStyle(P, scale)}>{r.mdaProcess}</td>
                <td style={tdStyle(P, scale)}>{r.completionDate}</td>
                <td style={tdStyle(P, scale)}>{r.mdaApprovalNo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasCmt && (
        <div
          style={{
            position: "absolute", left: px(0.4, scale), bottom: px(0.3, scale),
            width: px(12.6, scale), fontSize: fs(9, scale), fontStyle: "italic",
            color: P.muted, lineHeight: 1.4,
          }}
          // Rich text from our own editor — trusted source.
          dangerouslySetInnerHTML={{ __html: cmt }}
        />
      )}
    </>
  );
}

function SlideInventory({ report, P, scale }: { report: MonthReport; P: Palette; scale: number }) {
  const inv = report.inventory;
  return (
    <>
      <SlideTitle palette={P} scale={scale} text={`10. Inventory Situation – ${MONTH_NAMES[report.month - 1]} ${report.year}`} size={18} />
      <div style={{ position: "absolute", left: px(0.25, scale), top: px(0.85, scale), width: px(13, scale), fontSize: fs(8.5, scale) }}>
        {!inv && <div style={{ padding: 12, textAlign: "center", color: P.muted }}>No data yet</div>}
        {inv && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Calibri" }}>
            <tbody>
              {inv.groups.map((g, gi) => {
                const cells = g.rows.slice(0, 6);
                return (
                  <Fragment key={gi}>
                    <tr><td colSpan={7} style={{ ...thStyle(P, scale), padding: fs(6, scale) }}>{g.name}</td></tr>
                    <tr>
                      <td style={tdStyle(P, scale)}></td>
                      {cells.map((c, i) => <td key={i} style={{ ...tdStyle(P, scale, "center"), fontWeight: 600 }}>{c.product}</td>)}
                    </tr>
                    <tr>
                      <td style={{ ...tdStyle(P, scale), fontStyle: "italic", color: P.muted }}>Warehouse</td>
                      {cells.map((c, i) => (
                        <td
                          key={i}
                          style={{
                            ...tdStyle(P, scale, "center"),
                            // Match the dashboard + PPTX treatment: bigger, bolder, centered.
                            fontSize: fs(12, scale),
                            fontWeight: 700,
                            color: P.text,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {c.warehouse == null ? "" : fmtMYR(c.warehouse, 0)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ ...tdStyle(P, scale), fontStyle: "italic", color: P.muted }}>Consignment</td>
                      {cells.map((c, i) => (
                        <td
                          key={i}
                          style={{
                            ...tdStyle(P, scale, "center"),
                            fontSize: fs(12, scale),
                            fontWeight: 700,
                            color: P.text,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {c.consignment == null ? "" : fmtMYR(c.consignment, 0)}
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {inv && (
        <>
          {/* Commentary sits along the bottom-left of the slide.  */}
          {inv.commentary && (
            <div style={{
              position: "absolute", left: px(0.25, scale), top: px(6.55, scale),
              width: px(8.5, scale), fontSize: fs(9, scale), color: P.muted, lineHeight: 1.35,
              fontStyle: "italic",
            }}>
              {inv.commentary}
            </div>
          )}
          {/* Totals anchored to the bottom-right — boxed, never overlaps the table. */}
          <div style={{
            position: "absolute",
            right: px(0.25, scale), top: px(6.55, scale),
            textAlign: "right", lineHeight: 1.25,
            padding: `${fs(6, scale)}px ${fs(10, scale)}px`,
            border: `1px solid ${P.border}`,
            borderRadius: fs(4, scale),
            background: "#FFFFFF",
            minWidth: px(3.0, scale),
            fontVariantNumeric: "tabular-nums",
          }}>
            <div style={{ fontSize: fs(10, scale), color: P.text }}>
              <strong>Warehouse Total:</strong>{" "}
              <span style={{ fontWeight: 700 }}>{fmtMYR(inv.totalWarehouse ?? 0, 0)}</span>
            </div>
            <div style={{ fontSize: fs(10, scale), color: P.text, marginTop: fs(2, scale) }}>
              <strong>Consignment Total:</strong>{" "}
              <span style={{ fontWeight: 700 }}>{fmtMYR(inv.totalConsignment ?? 0, 0)}</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function SlideExpireWriteOff({ report, P, scale, siblings = [] }: { report: MonthReport; P: Palette; scale: number; siblings?: MonthReport[] }) {
  // HQ layout: months across the top (Jan → current), each with QTY + AMOUNT subcolumns,
  // rightmost "Total Write-Off" column, current month highlighted yellow.
  const months = (() => {
    const all = siblings
      .filter(m => m.year === report.year && m.month <= report.month)
      .sort((a, b) => a.month - b.month);
    if (!all.some(m => m.id === report.id)) all.push(report);
    return all.sort((a, b) => a.month - b.month);
  })();

  // Union of product labels across every month on file (current month first).
  const products: string[] = [];
  const seen = new Set<string>();
  for (const r of report.expireWriteOff?.rows ?? []) if (!seen.has(r.product)) { seen.add(r.product); products.push(r.product); }
  for (const m of months) for (const r of m.expireWriteOff?.rows ?? []) {
    if (!seen.has(r.product)) { seen.add(r.product); products.push(r.product); }
  }

  const cellFor = (m: MonthReport, product: string) =>
    (m.expireWriteOff?.rows ?? []).find(r => r.product === product);

  const rowTotals = (product: string) => {
    let qty = 0, amt = 0;
    for (const m of months) { const c = cellFor(m, product); qty += c?.qty ?? 0; amt += c?.amt ?? 0; }
    return { qty, amt };
  };
  const monthTotals = (m: MonthReport) => (m.expireWriteOff?.rows ?? []).reduce(
    (acc, r) => ({ qty: acc.qty + r.qty, amt: acc.amt + r.amt }),
    { qty: 0, amt: 0 },
  );
  const grand = products.reduce((acc, p) => {
    const t = rowTotals(p);
    return { qty: acc.qty + t.qty, amt: acc.amt + t.amt };
  }, { qty: 0, amt: 0 });

  // Yellow highlight tone mirrors the PPTX + editor header for the current month.
  const CURR_BG = "#F9E795";
  const CURR_INK = "#141A3D";

  return (
    <>
      <SlideTitle palette={P} scale={scale} text="11. Expire Stock – Monthly Write-Off Activity" />
      <div style={{ position: "absolute", left: px(0.35, scale), top: px(1.0, scale), width: px(12.6, scale), fontSize: fs(9.5, scale) }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Calibri", tableLayout: "fixed" }}>
          <colgroup>{(() => {
            const colW = `${Math.max(6, (56 / months.length) / 2)}%`;
            const cols: React.ReactNode[] = [<col key="lead" style={{ width: "24%" }} />];
            for (const m of months) {
              cols.push(<col key={`${m.id}-q`} style={{ width: colW }} />);
              cols.push(<col key={`${m.id}-a`} style={{ width: colW }} />);
            }
            cols.push(<col key="t-q" style={{ width: "9%" }} />);
            cols.push(<col key="t-a" style={{ width: "11%" }} />);
            return cols;
          })()}</colgroup>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...thStyle(P, scale, "left"), verticalAlign: "middle" }}>Expire Write-Off Activity</th>
              {months.map(m => {
                const curr = m.id === report.id;
                return (
                  <th
                    key={m.id}
                    colSpan={2}
                    style={{
                      ...thStyle(P, scale, "center"),
                      background: curr ? CURR_BG : P.header,
                      color: curr ? CURR_INK : "#fff",
                    }}
                  >
                    {MONTH_NAMES[m.month - 1]}-{String(m.year).slice(-2)}
                  </th>
                );
              })}
              <th colSpan={2} style={{ ...thStyle(P, scale, "center") }}>Total Write-Off</th>
            </tr>
            <tr>
              {months.map(m => {
                const curr = m.id === report.id;
                const bg = curr ? CURR_BG : P.header;
                const fg = curr ? CURR_INK : "#fff";
                return (
                  <Fragment key={m.id}>
                    <th style={{ ...thStyle(P, scale, "center"), background: bg, color: fg, fontSize: fs(8.5, scale) }}>QUANTITY</th>
                    <th style={{ ...thStyle(P, scale, "center"), background: bg, color: fg, fontSize: fs(8.5, scale) }}>AMOUNT</th>
                  </Fragment>
                );
              })}
              <th style={{ ...thStyle(P, scale, "center"), fontSize: fs(8.5, scale) }}>QUANTITY</th>
              <th style={{ ...thStyle(P, scale, "center"), fontSize: fs(8.5, scale) }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={2 + months.length * 2 + 2} style={{ padding: 12, textAlign: "center", color: P.muted }}>No expiry recorded</td></tr>
            )}
            {products.map((product, i) => {
              const rt = rowTotals(product);
              return (
                <tr key={product} style={{ background: i % 2 === 0 ? "transparent" : P.rowAlt }}>
                  <td style={{ ...tdStyle(P, scale, "left"), fontWeight: 600 }}>{product}</td>
                  {months.map(m => {
                    const c = cellFor(m, product);
                    const curr = m.id === report.id;
                    const bg = curr ? `${CURR_BG}66` : undefined;
                    return (
                      <Fragment key={m.id}>
                        <td style={{ ...tdStyle(P, scale, "center"), background: bg, fontWeight: curr ? 700 : 400, fontVariantNumeric: "tabular-nums" }}>
                          {c?.qty ? c.qty.toLocaleString("en-US") : ""}
                        </td>
                        <td style={{ ...tdStyle(P, scale, "center"), background: bg, fontWeight: curr ? 700 : 400, fontVariantNumeric: "tabular-nums" }}>
                          {c?.amt ? fmtMYR(c.amt, 0) : ""}
                        </td>
                      </Fragment>
                    );
                  })}
                  <td style={{ ...tdStyle(P, scale, "center"), fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {rt.qty ? rt.qty.toLocaleString("en-US") : "—"}
                  </td>
                  <td style={{ ...tdStyle(P, scale, "center"), fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {rt.amt ? fmtMYR(rt.amt, 0) : "—"}
                  </td>
                </tr>
              );
            })}
            {/* Grand total row */}
            {products.length > 0 && (
              <tr>
                <td style={{ ...tdStyle(P, scale, "left"), fontWeight: 700, background: P.header, color: "#fff" }}>Total</td>
                {months.map(m => {
                  const mt = monthTotals(m);
                  const curr = m.id === report.id;
                  const bg = curr ? CURR_BG : P.header;
                  const fg = curr ? CURR_INK : "#fff";
                  return (
                    <Fragment key={m.id}>
                      <td style={{ ...tdStyle(P, scale, "center"), fontWeight: 700, background: bg, color: fg, fontVariantNumeric: "tabular-nums" }}>
                        {mt.qty.toLocaleString("en-US")}
                      </td>
                      <td style={{ ...tdStyle(P, scale, "center"), fontWeight: 700, background: bg, color: fg, fontVariantNumeric: "tabular-nums" }}>
                        {fmtMYR(mt.amt, 0)}
                      </td>
                    </Fragment>
                  );
                })}
                <td style={{ ...tdStyle(P, scale, "center"), fontWeight: 700, background: P.header, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                  {grand.qty.toLocaleString("en-US")}
                </td>
                <td style={{ ...tdStyle(P, scale, "center"), fontWeight: 700, background: P.header, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                  {fmtMYR(grand.amt, 0)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SlideFinancial({ report, P, scale }: { report: MonthReport; P: Palette; scale: number }) {
  const f = report.financial;
  const fx = report.fxRate;
  const cards: [string, keyof NonNullable<typeof f>][] = [
    ["Accounts Receivable", "arMyr"],
    ["AR 180-365 days (long-term)", "arLongTermMyr"],
    ["Accounts Payable", "apMyr"],
    ["Collection", "collectionMyr"],
    ["Cash Flow", "cashFlowMyr"],
  ];
  return (
    <>
      <SlideTitle palette={P} scale={scale} text="12. Financial Relationship" />
      <div style={{ position: "absolute", left: px(0.9, scale), top: px(1.3, scale), width: px(11.5, scale), fontSize: fs(12, scale) }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Calibri" }}>
          <thead>
            <tr>
              <th style={thStyle(P, scale)}>Item</th>
              <th style={thStyle(P, scale, "right")}>{MONTH_NAMES[report.month - 1]} (JPY)</th>
              <th style={thStyle(P, scale, "right")}>{MONTH_NAMES[report.month - 1]} (MYR)</th>
            </tr>
          </thead>
          <tbody>
            {cards.map(([label, key], i) => {
              const myr = f ? ((f as Record<string, number>)[key] ?? 0) : 0;
              return (
                <tr key={key} style={{ background: i % 2 === 0 ? P.rowAlt : "transparent" }}>
                  <td style={{ ...tdStyle(P, scale), fontWeight: 600 }}>{label}</td>
                  <td style={tdStyle(P, scale, "right")}>{fmtJPY(myr * fx)}</td>
                  <td style={tdStyle(P, scale, "right")}>{fmtMYR(myr, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SlideOtherMarket({ report, P, scale }: { report: MonthReport; P: Palette; scale: number }) {
  const html = report.otherMarket?.body || "—";
  return (
    <>
      <SlideTitle palette={P} scale={scale} text="13. Other Market Information" />
      <div
        style={{
          position: "absolute", left: px(0.6, scale), top: px(1.0, scale),
          width: px(12.3, scale), height: px(6.3, scale),
          fontSize: fs(11, scale), color: P.text, lineHeight: 1.5, overflow: "hidden",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}

// -------- Cover / Agenda / Thank-you (chrome slides that bracket the deck) --------

function SlideCover({ report, P, scale }: { report: MonthReport; P: Palette; scale: number }) {
  return (
    <>
      {/* SEED contact lens lockup — same position the PPTX cover uses, served
          straight from public/brand/logo.jpg so the preview and the export
          match. object-fit: contain preserves the logo's aspect ratio inside
          the box. */}
      <img
        src="/brand/logo.jpg"
        alt="SEED contact lens"
        style={{
          position: "absolute", left: px(0.45, scale), top: px(0.41, scale),
          width: px(2.82, scale), height: px(1.63, scale),
          objectFit: "contain",
        }}
      />

      <div style={{
        position: "absolute", left: px(1.67, scale), top: px(2.66, scale), width: px(10, scale),
        fontFamily: "Calibri", fontWeight: 800, fontSize: fs(54, scale), color: P.header,
        textAlign: "center", lineHeight: 1.05,
      }}>MALAYSIA REVIEW</div>

      <div style={{
        position: "absolute", left: px(1.67, scale), top: px(4.01, scale), width: px(10, scale),
        fontFamily: "Calibri", fontSize: fs(28, scale), color: P.text, textAlign: "center",
      }}>
        {MONTH_NAMES[report.month - 1]} {report.year}
      </div>

      <div style={{
        position: "absolute", left: px(0.21, scale), top: px(6.75, scale), width: px(4, scale),
        fontFamily: "Calibri", fontSize: fs(14, scale), color: P.muted, lineHeight: 1.4,
      }}>
        {report.presentDate && (
          <>
            Present on {new Date(report.presentDate).toLocaleDateString("en-MY")}<br />
          </>
        )}
      </div>

      <div style={{
        position: "absolute", left: px(4.97, scale), top: px(4.54, scale), width: px(3.4, scale),
        fontFamily: "Calibri", fontSize: fs(14, scale), fontStyle: "italic", color: P.muted, textAlign: "center",
      }}>By {report.presenter}</div>
    </>
  );
}

function SlideAgenda({ P, scale }: { P: Palette; scale: number }) {
  return (
    <>
      <div style={{
        position: "absolute", left: px(1.09, scale), top: px(0.5, scale), width: px(11.5, scale),
        fontFamily: "Calibri", fontWeight: 700, fontSize: fs(24, scale), color: P.header,
      }}>Presentation Slide</div>

      <ol style={{
        position: "absolute", left: px(1.5, scale), top: px(1.25, scale), width: px(11, scale),
        fontFamily: "Calibri", fontSize: fs(24, scale), color: P.text, lineHeight: 1.55,
        margin: 0, padding: 0, listStyle: "decimal",
      }}>
        {[
          "Sales Achievement",
          "Sales Trend",
          "Malaysia Market Outlook",
          "Monthly - Daily Sales",
          "Summary Sales by Quantity",
          "Sales By Product – Top 5 Contribution",
          "Sales By ECP",
          "Sales By Region",
          "Product Registration Update",
          "Inventory",
          "Expire Stock (Write OFF)",
          "Financial Related",
          "Other Market Update",
        ].map((t, i) => <li key={i} style={{ marginBottom: px(0.06, scale) }}>{t}</li>)}
      </ol>
    </>
  );
}

function SlideThankYou({ P, scale }: { P: Palette; scale: number }) {
  return (
    <>
      <div style={{
        position: "absolute", inset: 0, display: "grid", placeItems: "center",
        fontFamily: "Calibri", fontWeight: 800, fontSize: fs(72, scale), color: P.header,
      }}>Thank you!</div>
    </>
  );
}

// -------- Helpers --------

function thStyle(P: Palette, scale: number, align: "left" | "right" | "center" = "left"): React.CSSProperties {
  return {
    background: P.header, color: "#fff", fontSize: fs(9, scale), padding: fs(5, scale),
    textAlign: align, fontWeight: 700, border: `1px solid ${P.border}`,
  };
}
function tdStyle(P: Palette, scale: number, align: "left" | "right" | "center" = "left"): React.CSSProperties {
  // Right- and center-aligned cells carry digits — turn on tabular-nums so
  // columns line up (DESIGN.md Tabular-Numbers rule). Left cells are usually
  // labels, so we leave them proportional.
  const isNumberCell = align !== "left";
  return {
    padding: fs(4, scale), fontSize: fs(9, scale), color: P.text,
    textAlign: align, border: `1px solid ${P.border}`, whiteSpace: "nowrap",
    ...(isNumberCell ? { fontVariantNumeric: "tabular-nums" as const } : {}),
  };
}
function EmptyMsg({ scale, P }: { scale: number; P: Palette }) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "grid", placeItems: "center",
      fontSize: fs(12, scale), color: P.muted, fontStyle: "italic",
    }}>
      No data yet — import POS or fill the section above.
    </div>
  );
}
