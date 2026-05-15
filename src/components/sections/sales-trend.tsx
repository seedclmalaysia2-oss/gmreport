"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SectionProps } from "../report-editor";
import { SectionShell, TextArea } from "./shared";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import { MONTH_NAMES, cn } from "@/lib/utils";
import { Move, Pencil, RotateCcw, Save } from "lucide-react";
import type { LabelOffset, SalesTrend } from "@/lib/schema";

type SeriesKey = "actual2026" | "target2026" | "actual2025";

const SERIES_CONFIG: Record<SeriesKey, { label: string; color: string; weight: number; fontSize: number }> = {
  actual2026: { label: "Actual 2026", color: "#0B1F5C", weight: 800, fontSize: 17 },
  target2026: { label: "Target 2026", color: "#DC2626", weight: 700, fontSize: 14 },
  actual2025: { label: "Actual 2025", color: "#15803D", weight: 700, fontSize: 14 },
};

// Default offset per series when no override exists. Keeps the three-tier
// placement we already tuned for.
const DEFAULT_POSITION: Record<SeriesKey, { dx: number; dy: number }> = {
  actual2026: { dx: 0,  dy: -22 }, // above the dot
  target2026: { dx: 28, dy: 5   }, // right of the dot
  actual2025: { dx: -28, dy: 5  }, // left of the dot
};

type DragState = {
  seriesKey: SeriesKey;
  monthIdx: number;
  startX: number;
  startY: number;
  origDx: number;
  origDy: number;
};

export function SectionSalesTrend({ report, update }: SectionProps) {
  const SA = report.salesAchievement;
  const trend: SalesTrend | null = report.salesTrend ?? null;

  // Pixel offsets: { seriesKey: { monthIdx: { dx, dy } } }
  const [offsets, setOffsets] = useState<Record<string, Record<string, LabelOffset>>>(
    () => trend?.labelOffsets ?? {},
  );
  const [editMode, setEditMode] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const chartBoxRef = useRef<HTMLDivElement>(null);

  // Keep local state in sync if the report changes elsewhere.
  useEffect(() => {
    setOffsets(report.salesTrend?.labelOffsets ?? {});
  }, [report.id, report.salesTrend?.labelOffsets]);

  const commitOffsets = useCallback((next: Record<string, Record<string, LabelOffset>>) => {
    setOffsets(next);
    update({ salesTrend: { ...(report.salesTrend ?? { series: {} }), labelOffsets: next } as SalesTrend });
  }, [update, report.salesTrend]);

  const resolveOffset = (key: SeriesKey, idx: number): { dx: number; dy: number } => {
    const saved = offsets[key]?.[String(idx)];
    const base = DEFAULT_POSITION[key];
    return saved ? { dx: saved.dx + base.dx, dy: saved.dy + base.dy } : base;
  };

  const setOffset = (key: SeriesKey, idx: number, next: LabelOffset) => {
    const nextAll = {
      ...offsets,
      [key]: { ...(offsets[key] ?? {}), [String(idx)]: next },
    };
    setOffsets(nextAll);
  };

  const resetAll = () => {
    commitOffsets({});
  };

  // Drag handlers on <document> so the drag continues even if the cursor
  // leaves the label itself.
  useEffect(() => {
    if (!editMode) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = d.origDx + (e.clientX - d.startX);
      const dy = d.origDy + (e.clientY - d.startY);
      setOffset(d.seriesKey, d.monthIdx, { dx, dy });
    };
    const onUp = () => {
      if (dragRef.current) {
        // Commit the final value to the server on release.
        commitOffsets({ ...offsets });
      }
      dragRef.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [editMode, offsets, commitOffsets]);

  if (!SA) {
    return (
      <SectionShell sectionKey="salesTrend" subtitle="Populate Sales Achievement first — this chart is driven by those numbers.">
        <p className="text-[var(--color-ink-600)]">No data yet.</p>
      </SectionShell>
    );
  }

  const lastFilled = SA.actual2026.reduce<number>((acc, v, i) => v != null ? i : acc, -1);
  const data = useMemo(() => MONTH_NAMES.map((m, i) => ({
    month: m,
    "Target 2026": SA.target2026[i] ?? null,
    "Actual 2026": i <= lastFilled ? (SA.actual2026[i] ?? null) : null,
    "Actual 2025": SA.actual2025[i] ?? null,
  })), [SA, lastFilled]);

  // Custom label renderer — returns an SVG <g> with a <text> element that can
  // optionally be dragged when editMode is on.
  const makeLabel = (seriesKey: SeriesKey) => {
    const cfg = SERIES_CONFIG[seriesKey];
    // eslint-disable-next-line react/display-name
    return (props: { x?: number | string; y?: number | string; value?: number | string; index?: number }) => {
      const x = typeof props.x === "number" ? props.x : Number(props.x);
      const y = typeof props.y === "number" ? props.y : Number(props.y);
      const value = typeof props.value === "number" ? props.value : Number(props.value);
      const index = props.index;
      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(value) || index == null) return null;
      const off = resolveOffset(seriesKey, index);
      const lx = x + off.dx;
      const ly = y + off.dy;
      const startDrag = (e: React.MouseEvent<SVGGElement>) => {
        if (!editMode) return;
        e.preventDefault(); e.stopPropagation();
        const saved = offsets[seriesKey]?.[String(index)] ?? { dx: 0, dy: 0 };
        dragRef.current = {
          seriesKey, monthIdx: index,
          startX: e.clientX, startY: e.clientY,
          origDx: saved.dx, origDy: saved.dy,
        };
      };
      return (
        <g
          onMouseDown={startDrag}
          style={{ cursor: editMode ? "grab" : "default", userSelect: "none" }}
        >
          {editMode && (
            <rect
              x={lx - 26} y={ly - cfg.fontSize} width={52} height={cfg.fontSize + 6}
              fill="#fff" stroke={cfg.color} strokeDasharray="2 2" rx={3}
              pointerEvents="all"
            />
          )}
          <text
            x={lx} y={ly}
            fill={cfg.color}
            fontSize={cfg.fontSize}
            fontWeight={cfg.weight}
            textAnchor="middle"
            style={{ pointerEvents: "all" }}
          >
            {(value / 1000).toFixed(0)}k
          </text>
        </g>
      );
    };
  };

  return (
    <SectionShell
      sectionKey="salesTrend"
      subtitle="Auto-generated from Sales Achievement. Toggle edit mode to drag any label into a better position."
      isMissing={!report.salesAchievement}
    >
      {/* Edit-mode toolbar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setEditMode(v => !v)}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold border transition",
            editMode
              ? "bg-[var(--color-ink-800)] text-white border-[var(--color-ink-800)]"
              : "bg-white dark:bg-[var(--surface-1)] text-[var(--color-ink-800)] border-[var(--color-ice-200)] hover:bg-[var(--color-ice-100)]",
          )}
        >
          <Move size={14} />
          {editMode ? "Editing labels — click anywhere to exit" : "Edit label positions"}
        </button>
        {Object.keys(offsets).length > 0 && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm border border-[var(--color-ice-200)] hover:bg-[var(--color-ice-100)] text-[var(--color-ink-800)]"
            title="Reset all labels to their default positions"
          >
            <RotateCcw size={14} /> Reset all
          </button>
        )}
        <span className="text-xs text-[var(--color-ink-600)] ml-auto">
          {editMode
            ? "Drag any number label to move it. Release to save."
            : "Custom positions apply to the dashboard preview only — PPTX uses defaults."}
        </span>
      </div>

      {/* Chart */}
      <div ref={chartBoxRef} className={cn("h-[540px]", editMode && "ring-2 ring-[var(--color-ink-700)] rounded-xl")}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 48, right: 64, bottom: 20, left: 56 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf7" />
            <XAxis dataKey="month" tick={{ fontSize: 14, fontWeight: 600 }} />
            <YAxis tick={{ fontSize: 13 }} tickFormatter={v => (v / 1000) + "k"} />
            <Tooltip formatter={(v: number) => v.toLocaleString("en-MY", { maximumFractionDigits: 0 })} />
            <Legend wrapperStyle={{ fontSize: 14, fontWeight: 600, paddingTop: 8 }} />

            <Line type="monotone" dataKey="Actual 2026" stroke={SERIES_CONFIG.actual2026.color} strokeWidth={4} dot={{ r: 6, fill: SERIES_CONFIG.actual2026.color, strokeWidth: 0 }} connectNulls={false}>
              <LabelList dataKey="Actual 2026" content={makeLabel("actual2026")} />
            </Line>
            <Line type="monotone" dataKey="Target 2026" stroke={SERIES_CONFIG.target2026.color} strokeWidth={3} strokeDasharray="5 3" dot={{ r: 4, fill: SERIES_CONFIG.target2026.color, strokeWidth: 0 }}>
              <LabelList dataKey="Target 2026" content={makeLabel("target2026")} />
            </Line>
            <Line type="monotone" dataKey="Actual 2025" stroke="#22C55E" strokeWidth={3} dot={{ r: 4, fill: "#22C55E", strokeWidth: 0 }}>
              <LabelList dataKey="Actual 2025" content={makeLabel("actual2025")} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Commentary — explicit Save / Edit workflow (no auto-save). */}
      <TrendCommentary
        value={trend?.commentary ?? ""}
        onSave={text => update({
          salesTrend: { ...(report.salesTrend ?? { series: {} }), commentary: text } as SalesTrend,
        })}
      />
    </SectionShell>
  );
}

/**
 * Commentary box with an explicit Save / Edit cycle:
 *  - empty / editing → textarea + Save (and Cancel once a value exists)
 *  - saved & idle    → read-only text + Edit button
 * The draft is local; nothing is persisted until Save is pressed.
 */
function TrendCommentary({ value, onSave }: { value: string; onSave: (text: string) => void }) {
  const [editing, setEditing] = useState(() => value.trim() === "");
  const [draft, setDraft] = useState(value);

  // Re-sync from the server value whenever it changes and we're not editing
  // (e.g. switching months) so the box never shows a stale draft.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">Commentary</h4>
        {!editing && (
          <button
            type="button"
            onClick={() => { setDraft(value); setEditing(true); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-ice-200)] px-2.5 py-1 text-xs font-semibold text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)]"
          >
            <Pencil size={13} /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <>
          <TextArea
            value={draft}
            onChange={setDraft}
            rows={5}
            placeholder="Add commentary on the sales trend — drivers, anomalies, outlook…"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => { onSave(draft); setEditing(false); }}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-ink-800)] text-white px-3 py-1.5 text-sm font-semibold hover:bg-[var(--color-ink-700)]"
            >
              <Save size={14} /> Save
            </button>
            {value.trim() !== "" && (
              <button
                type="button"
                onClick={() => { setDraft(value); setEditing(false); }}
                className="rounded-md border border-[var(--color-ice-200)] px-3 py-1.5 text-sm text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)]"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-ink-800)]">
          {value.trim() !== ""
            ? value
            : <span className="italic text-[var(--color-ink-600)]">No commentary yet.</span>}
        </p>
      )}
    </div>
  );
}
