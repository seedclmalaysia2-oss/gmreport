// Modern PPTX generator — Midnight Executive palette, large KPI callouts, 2-column flows,
// native pptxgenjs charts with navy fills. Same input shape as classic.ts.

import PptxGenJS from "pptxgenjs";
import { MODERN_PALETTE as P, applyThemeToModern, SLIDE_W, SLIDE_H, brandImageDataUrl, fmtJPY, fmtMYR, fmtPct, monthNameFull, monthShort, titleFor, type PptxInput, safeNum } from "./shared";
import { htmlToPptxRuns } from "./rich-text";
import { MONTH_NAMES } from "@/lib/utils";
import { AGENDA, ECP_CATEGORIES, REGIONS } from "@/lib/catalog/mappings";

const DISPLAY_FONT = "Cambria";
const BODY_FONT = "Calibri";

type Slide = PptxGenJS.Slide;

function setDarkBg(s: Slide) { s.background = { color: P.ink }; }
function setLightBg(s: Slide) { s.background = { color: "FFFFFF" }; }

function sectionHeader(s: Slide, kicker: string, title: string) {
  s.addShape("rect", { x: 0.5, y: 0.45, w: 0.08, h: 0.62, fill: { color: P.ink2 }, line: { color: P.ink2 } });
  s.addText(kicker, { x: 0.72, y: 0.42, w: 12, h: 0.30, fontFace: BODY_FONT, fontSize: 11, color: P.ink3, bold: true, charSpacing: 4 });
  s.addText(title, { x: 0.72, y: 0.70, w: 12, h: 0.55, fontFace: DISPLAY_FONT, fontSize: 28, bold: true, color: P.ink });
}

export async function generateModernPptx(input: PptxInput): Promise<Uint8Array> {
  applyThemeToModern(input.paletteId);

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = `Malaysia Review — ${titleFor(input.months)}`;
  pptx.author = input.months[0]?.presenter ?? "Simon (Malaysia GM)";

  cover(pptx, input);
  agenda(pptx);
  salesAchievement(pptx, input);
  salesTrend(pptx, input);
  outlook(pptx, input);
  for (const m of input.months) dailySales(pptx, input, m);
  salesByQuantity(pptx, input);
  topProducts(pptx, input);
  salesByECP(pptx, input);
  salesByRegion(pptx, input);
  productRegistration(pptx, input);
  inventory(pptx, input);
  expireWriteOff(pptx, input);
  financial(pptx, input);
  otherMarket(pptx, input);
  thankYou(pptx);

  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Uint8Array;
}

function cover(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  setDarkBg(s);
  // Big accent block on left
  s.addShape("rect", { x: 0, y: 0, w: 4.5, h: SLIDE_H, fill: { color: P.ink2 }, line: { color: P.ink2 } });
  // Embed the SEED logo via data URL — `addImage({ path })` reads the file
  // at PPT-write time and silently fails on serverless runtimes where the
  // public/ folder isn't co-located with the function. The data URL ships
  // the bytes with the PPT so the cover always carries the brand mark.
  {
    const logo = brandImageDataUrl("logo.jpg");
    if (logo) s.addImage({ data: logo, x: 0.6, y: 0.6, w: 2.4, h: 1.4, sizing: { type: "contain", w: 2.4, h: 1.4 } });
  }

  s.addText("MALAYSIA", { x: 0.6, y: 3.0, w: 3.8, h: 0.9, fontFace: DISPLAY_FONT, fontSize: 54, bold: true, color: P.white });
  s.addText("REVIEW", { x: 0.6, y: 3.9, w: 3.8, h: 0.9, fontFace: DISPLAY_FONT, fontSize: 54, bold: true, color: P.ice });
  s.addShape("rect", { x: 0.6, y: 4.9, w: 0.6, h: 0.06, fill: { color: P.accent }, line: { color: P.accent } });

  s.addText(titleFor(input.months).toUpperCase(), { x: 5.0, y: 3.1, w: 7.6, h: 0.6, fontFace: BODY_FONT, fontSize: 20, color: P.ice, charSpacing: 8 });
  const last = input.months[input.months.length - 1];
  s.addText(`HQ Executive Briefing • ${monthNameFull(last.month)} ${last.year}`, {
    x: 5.0, y: 3.75, w: 7.6, h: 0.45, fontFace: DISPLAY_FONT, fontSize: 36, bold: true, color: P.white,
  });
  s.addText([
    { text: last.presenter, options: { bold: true, color: P.white } },
    { text: "  •  General Manager, Malaysia", options: { color: P.ice } },
  ], { x: 5.0, y: 6.5, w: 7.6, h: 0.5, fontFace: BODY_FONT, fontSize: 14 });
}

function agenda(pptx: PptxGenJS) {
  const s = pptx.addSlide();
  setLightBg(s);
  sectionHeader(s, "CONTENTS", "What we'll cover");
  // Two-column grid, 7 + 6
  const colAx = 0.6, colBx = 7.0;
  const startY = 1.6, step = 0.78;
  AGENDA.forEach((item, i) => {
    const col = i < 7 ? "a" : "b";
    const idx = col === "a" ? i : i - 7;
    const x = col === "a" ? colAx : colBx;
    const y = startY + idx * step;
    // Index badge
    s.addShape("ellipse", { x, y, w: 0.55, h: 0.55, fill: { color: P.ink2 }, line: { color: P.ink2 } });
    s.addText(String(i + 1).padStart(2, "0"), { x, y, w: 0.55, h: 0.55, fontFace: BODY_FONT, fontSize: 14, bold: true, color: P.white, align: "center", valign: "middle" });
    s.addText(item, { x: x + 0.75, y: y + 0.05, w: 5.5, h: 0.5, fontFace: DISPLAY_FONT, fontSize: 18, color: P.ink, valign: "middle" });
  });
}

function salesAchievement(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  setLightBg(s);
  sectionHeader(s, "01 • SALES ACHIEVEMENT", titleFor(input.months));

  const last = input.months[input.months.length - 1];
  const SA = last.salesAchievement;

  // Big stat callouts across the top
  const callout = (x: number, title: string, big: string, sub: string, accent = P.accent) => {
    s.addShape("roundRect", { x, y: 1.5, w: 2.95, h: 1.75, rectRadius: 0.12, fill: { color: P.mutedBg }, line: { color: P.mutedBg } });
    s.addText(title, { x: x + 0.2, y: 1.6, w: 2.6, h: 0.3, fontFace: BODY_FONT, fontSize: 11, color: P.ink3, bold: true, charSpacing: 3 });
    s.addText(big, { x: x + 0.2, y: 1.95, w: 2.6, h: 0.9, fontFace: DISPLAY_FONT, fontSize: 36, bold: true, color: P.ink });
    s.addText(sub, { x: x + 0.2, y: 2.85, w: 2.6, h: 0.3, fontFace: BODY_FONT, fontSize: 11, color: P.ink3 });
    s.addShape("rect", { x, y: 3.25, w: 2.95, h: 0.04, fill: { color: accent }, line: { color: accent } });
  };
  const idx = last.month - 1;
  const target = SA?.target2026[idx] ?? 0;
  const actual = SA?.actual2026[idx] ?? 0;
  const prior = SA?.actual2025[idx] ?? 0;
  const ni = SA?.netIncome2026[idx] ?? 0;
  // Achievement / YoY are derived straight from the figures so they always
  // match the ACC % / YoY % table rows — no separately stored percentage.
  const achievementRate = target ? actual / target : null;
  const yoyRate = prior ? actual / prior : null;

  callout(0.60, "TARGET",    `RM ${fmtMYR(target, 0)}`, `${monthShort(last.month)} ${last.year}`, P.ice);
  callout(3.70, "ACTUAL",    `RM ${fmtMYR(actual, 0)}`, `${fmtPct(achievementRate, 0)} of target`, P.accent);
  callout(6.80, "YoY",       `${fmtPct(yoyRate, 0)}`, `vs RM ${fmtMYR(prior, 0)} in ${last.year - 1}`, P.accent2);
  callout(9.90, "NET INCOME",`RM ${fmtMYR(ni, 0)}`, `≈ ${((ni * last.fxRate) / 1_000_000).toFixed(2)} mil JPY`, P.ink2);

  // YTD mini-table underneath
  const rows: PptxGenJS.TableCell[][] = [[
    { text: "", options: { fill: { color: P.ink } } },
    ...MONTH_NAMES.map(m => ({ text: m, options: { bold: true, align: "center" as const, color: P.white, fill: { color: P.ink } } })),
    { text: "Total", options: { bold: true, align: "center", color: P.white, fill: { color: P.ink } } },
  ]];
  // `totalOverride` carries the WEIGHTED ratio total for percent rows so
  // the Total cell matches the editor (which does sumNumer ÷ sumDenom).
  const row = (label: string, data: (number | null)[], pct = false, totalOverride: number | null = null): PptxGenJS.TableCell[] => {
    const r: PptxGenJS.TableCell[] = [{ text: label, options: { bold: true, fill: { color: P.ice2 }, color: P.ink } }];
    let total = 0;
    for (const v of data) {
      if (v != null && !pct) total += v;
      r.push({ text: v == null ? "" : pct ? fmtPct(v) : fmtMYR(v), options: { align: "right", color: P.ink } });
    }
    const effectiveTotal: number | null = pct ? totalOverride : total;
    r.push({
      text: effectiveTotal == null ? "" : pct ? fmtPct(effectiveTotal) : fmtMYR(effectiveTotal),
      options: { bold: true, align: "right", color: P.ink },
    });
    return r;
  };
  if (SA) {
    const sumOf = (arr: (number | null)[]) => arr.reduce<number>((s, v) => s + (v ?? 0), 0);
    const totalTarget = sumOf(SA.target2026);
    const totalActual = sumOf(SA.actual2026);
    const totalPrior  = sumOf(SA.actual2025);
    rows.push(row("Target 2026",  SA.target2026));
    rows.push(row("Actual 2026",  SA.actual2026));
    rows.push(row("ACC %",        SA.target2026.map((t, i) => (t && SA.actual2026[i] != null ? SA.actual2026[i]! / t : 0)), true, totalTarget ? totalActual / totalTarget : null));
    rows.push(row("Actual 2025",  SA.actual2025));
    rows.push(row("YoY %",        SA.actual2025.map((p, i) => (p && SA.actual2026[i] != null ? SA.actual2026[i]! / p : 0)), true, totalPrior ? totalActual / totalPrior : null));
    rows.push(row("Net Income",   SA.netIncome2026));
  }
  s.addTable(rows, {
    x: 0.60, y: 3.55, w: 12.15, h: 3.3, fontFace: BODY_FONT, fontSize: 9,
    border: { type: "solid", pt: 0.5, color: P.ice },
  });
}

function salesTrend(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  setLightBg(s);
  sectionHeader(s, "02 • SALES TREND", `${input.months[input.months.length - 1].year} performance`);

  const SA = input.months[input.months.length - 1].salesAchievement;
  if (!SA) return;
  const cats = [...MONTH_NAMES];
  const safe = (a: (number | null)[]) => a.map(v => v ?? 0);
  const lastFilled = SA.actual2026.reduce<number>((acc, v, i) => v != null ? i : acc, -1);
  const actual2026Trimmed = lastFilled >= 0
    ? SA.actual2026.map((v, i) => i <= lastFilled ? (v ?? 0) : null)
    : SA.actual2026.map(() => null);
  // Commentary card pushes up from the bottom; the chart shrinks to fit.
  const commentary = (input.months[input.months.length - 1].salesTrend?.commentary ?? "").trim();
  const chartH = commentary ? 3.9 : 5.3;
  s.addChart(pptx.ChartType.line, [
    { name: "Actual 2026", labels: cats, values: actual2026Trimmed as number[] },
    { name: "Target 2026", labels: cats, values: safe(SA.target2026) },
    { name: "Actual 2025", labels: cats, values: safe(SA.actual2025) },
  ], {
    showValue: true,
    dataLabelFontFace: BODY_FONT,
    dataLabelFontSize: 16,
    dataLabelFontBold: true,
    dataLabelPosition: "t",
    dataLabelFormatCode: "#,##0",
    x: 0.6, y: 1.5, w: 12.15, h: chartH,
    chartColors: ["0B1F5C", "DC2626", "22C55E"],
    lineSize: 3,
    catAxisLabelFontFace: BODY_FONT, catAxisLabelColor: P.ink3, catAxisLabelFontSize: 14, catAxisLabelFontBold: true,
    valAxisLabelFontFace: BODY_FONT, valAxisLabelColor: P.ink3, valAxisLabelFontSize: 14,
    showLegend: true, legendPos: "b", legendFontFace: BODY_FONT, legendFontSize: 15, legendColor: P.ink,
    lineDataSymbol: "circle", lineDataSymbolSize: 10,
  });

  // ---- Commentary card ----
  if (commentary) {
    const commentY = 1.5 + chartH + 0.15;
    const commentH = Math.max(0.4, 7.3 - commentY - 0.1);
    s.addShape("roundRect", {
      x: 0.6, y: commentY, w: 12.15, h: commentH, rectRadius: 0.10,
      fill: { color: P.mutedBg }, line: { color: P.ice, width: 0.75 },
    });
    s.addText("COMMENTARY", {
      x: 0.74, y: commentY + 0.05, w: 12.0, h: 0.28,
      fontFace: BODY_FONT, fontSize: 10, bold: true, color: P.ink3, charSpacing: 4,
    });
    s.addText(commentary, {
      x: 0.74, y: commentY + 0.36, w: 12.0, h: commentH - 0.42,
      fontFace: BODY_FONT, fontSize: 13, color: P.ink, valign: "top", paraSpaceAfter: 4, wrap: true,
    });
  }
}

function outlook(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  setLightBg(s);
  const last = input.months[input.months.length - 1];
  sectionHeader(s, "03 • MARKET OUTLOOK", `Malaysia – ${monthNameFull(last.month)} ${last.year}`);
  // Navy quote block on the right, body text on left
  s.addShape("rect", { x: 8.4, y: 1.6, w: 4.4, h: 5.2, fill: { color: P.ink }, line: { color: P.ink } });
  s.addText('"Resilient domestic demand continues to anchor performance through festive season and supply-chain headwinds."', {
    x: 8.7, y: 1.9, w: 3.9, h: 4.6, fontFace: DISPLAY_FONT, fontSize: 18, italic: true, color: P.white, valign: "middle",
  });
  const runs = htmlToPptxRuns(last.marketOutlook?.body, 13);
  s.addText(runs.length ? runs : [{ text: "—", options: { fontSize: 13 } }], {
    x: 0.6, y: 1.6, w: 7.6, h: 5.5, fontFace: BODY_FONT, color: P.ink, valign: "top", paraSpaceAfter: 8, wrap: true,
  });
}

function dailySales(pptx: PptxGenJS, input: PptxInput, m: typeof input.months[number]) {
  const s = pptx.addSlide();
  setLightBg(s);
  sectionHeader(s, "04 • DAILY SALES", `${monthNameFull(m.month)} ${m.year}`);
  const D = m.dailySales;
  if (!D) return;

  // ---- Stats (mirror the editor + Classic) ----
  const daysInMonth = new Date(m.year, m.month, 0).getDate();
  const monthsAbbr = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const wdShort = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const holidayMap = new Map(D.holidays.map(h => [h.date, h.label]));

  const labels: string[] = [];
  const values: number[] = [];
  const nonTradingIdx: number[] = [];
  let totalQty = 0;
  let peak = { qty: 0, dateLabel: "" };
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${m.year}-${String(m.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const row = D.days.find(d => d.date === iso);
    const wd = new Date(m.year, m.month - 1, day).getDay();
    const nonTrading = wd === 0 || wd === 6 || holidayMap.has(iso);
    const qty = row?.qty ?? 0;
    labels.push(`${day}-${monthsAbbr[m.month - 1]}\n${wdShort[wd]}`);
    values.push(qty);
    if (nonTrading) nonTradingIdx.push(day - 1);
    totalQty += qty;
    if (qty > peak.qty) peak = { qty, dateLabel: `${day}-${monthsAbbr[m.month - 1]}` };
  }
  const tradingDays = values.filter(v => v > 0).length;
  const avg = tradingDays ? Math.round(totalQty / tradingDays) : 0;

  // ---- KPI strip: 4 cards, accent on TOTAL UNITS ----
  const kpis = [
    { label: "MONTH",             value: `${monthNameFull(m.month)} ${m.year}`,    accent: false },
    { label: "TOTAL UNITS",       value: totalQty.toLocaleString("en-US"),         accent: true  },
    { label: "AVG / TRADING DAY", value: avg ? avg.toLocaleString("en-US") : "—",  accent: false },
    { label: "PEAK",              value: peak.qty ? `${peak.qty.toLocaleString("en-US")} (${peak.dateLabel})` : "—", accent: false },
  ];
  const kpiY = 1.45, kpiH = 0.85, kpiGap = 0.16;
  const kpiW = (12.15 - kpiGap * 3) / 4;
  kpis.forEach((k, i) => {
    const x = 0.6 + i * (kpiW + kpiGap);
    s.addShape("roundRect", {
      x, y: kpiY, w: kpiW, h: kpiH, rectRadius: 0.10,
      fill: { color: k.accent ? P.ink2 : P.mutedBg },
      line: { color: k.accent ? P.ink2 : P.ice, width: 0.75 },
    });
    s.addText(k.label, {
      x: x + 0.14, y: kpiY + 0.08, w: kpiW - 0.28, h: 0.26,
      fontFace: BODY_FONT, fontSize: 10, bold: true,
      color: k.accent ? P.ice : P.ink3, charSpacing: 4,
    });
    s.addText(k.value, {
      x: x + 0.14, y: kpiY + 0.36, w: kpiW - 0.28, h: 0.44,
      fontFace: DISPLAY_FONT, fontSize: 18, bold: true,
      color: k.accent ? P.white : P.ink,
    });
  });

  // ---- Chart card ----
  const chartY = 2.50;
  const chartH = 3.10;
  s.addShape("roundRect", {
    x: 0.6, y: chartY, w: 12.15, h: chartH, rectRadius: 0.10,
    fill: { color: P.white }, line: { color: P.ice, width: 0.75 },
  });
  s.addChart(pptx.ChartType.bar, [{ name: "Qty", labels, values }], {
    x: 0.72, y: chartY + 0.12, w: 11.91, h: chartH - 0.24,
    barDir: "col", barGapWidthPct: 30,
    chartColors: [P.ink2],
    showLegend: false, showValue: true,
    catAxisLabelFontFace: BODY_FONT, catAxisLabelFontSize: 9, catAxisLabelColor: P.ink3,
    valAxisLabelFontFace: BODY_FONT, valAxisLabelFontSize: 9, valAxisLabelColor: P.ink3,
    dataLabelFontFace: BODY_FONT, dataLabelFontSize: 9, dataLabelFontBold: true, dataLabelColor: P.ink,
  });
  // Red brackets under the x-axis for weekends + holidays.
  const chartLeft = 0.72, chartWidth = 11.91, plotInsetL = 0.55, plotInsetR = 0.25;
  const plotW = chartWidth - plotInsetL - plotInsetR;
  const bandW = plotW / daysInMonth;
  for (const i of nonTradingIdx) {
    const cx = chartLeft + plotInsetL + bandW * (i + 0.5);
    s.addShape("rect", {
      x: cx - bandW * 0.42, y: chartY + chartH - 0.62, w: bandW * 0.84, h: 0.30,
      fill: { type: "none" }, line: { color: P.accent, width: 1 },
    });
  }

  // ---- Holiday pills (red soft chips) ----
  let pillX = 0.6;
  const pillY = chartY + chartH + 0.12;
  for (const h of D.holidays) {
    const label = `${h.date.slice(-2)}/${h.date.slice(5, 7)} ${h.label}`;
    const w = Math.max(1.8, 0.12 + label.length * 0.10);
    s.addShape("roundRect", {
      x: pillX, y: pillY, w, h: 0.34, rectRadius: 0.17,
      fill: { color: "FEE2E2" }, line: { color: "FECACA", width: 0.5 },
    });
    s.addText(label, {
      x: pillX + 0.12, y: pillY, w: w - 0.24, h: 0.34,
      fontFace: BODY_FONT, fontSize: 11, bold: true, color: "B91C1C", valign: "middle",
    });
    pillX += w + 0.15;
  }

  // ---- Commentary card ----
  const commentY = pillY + (D.holidays.length ? 0.48 : 0.0);
  const commentH = Math.max(0.4, 7.3 - commentY - 0.1);
  s.addShape("roundRect", {
    x: 0.6, y: commentY, w: 12.15, h: commentH, rectRadius: 0.10,
    fill: { color: P.mutedBg }, line: { color: P.ice, width: 0.75 },
  });
  s.addText("COMMENTARY", {
    x: 0.74, y: commentY + 0.05, w: 12.0, h: 0.28,
    fontFace: BODY_FONT, fontSize: 10, bold: true, color: P.ink3, charSpacing: 4,
  });
  s.addText(D.commentary || "", {
    x: 0.74, y: commentY + 0.36, w: 12.0, h: commentH - 0.42,
    fontFace: BODY_FONT, fontSize: 13, color: P.ink, valign: "top", paraSpaceAfter: 4, wrap: true,
  });
}

function salesByQuantity(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  setLightBg(s);
  sectionHeader(s, "05 • SALES QUANTITY", titleFor(input.months));

  const last = input.months[input.months.length - 1];
  const rows: PptxGenJS.TableCell[][] = [[
    { text: "Product", options: { bold: true, color: P.white, fill: { color: P.ink } } },
    { text: `${monthShort(last.month)} 2026`, options: { bold: true, align: "center", color: P.white, fill: { color: P.ink } } },
    { text: `${monthShort(last.month)} 2025`, options: { bold: true, align: "center", color: P.white, fill: { color: P.ink } } },
    { text: "Δ", options: { bold: true, align: "center", color: P.white, fill: { color: P.ink } } },
    { text: "YTD 2026", options: { bold: true, align: "center", color: P.white, fill: { color: P.ink } } },
  ]];
  for (const [i, r] of (last.salesByQuantity?.rows ?? []).entries()) {
    const zebra = i % 2 === 0 ? { fill: { color: P.rowAlt } } : {};
    const ytd = input.months.reduce((sum, mm) => sum + (mm.salesByQuantity?.rows.find(x => x.product === r.product)?.qty2026 ?? 0), 0);
    const delta = r.qty2026 - r.qty2025;
    rows.push([
      { text: r.product, options: { ...zebra, color: P.ink } },
      { text: String(r.qty2026), options: { ...zebra, align: "right", color: P.ink, bold: true } },
      { text: String(r.qty2025), options: { ...zebra, align: "right", color: P.ink3 } },
      { text: (delta >= 0 ? "+" : "") + delta, options: { ...zebra, align: "right", color: delta >= 0 ? P.positive : P.negative, bold: true } },
      { text: String(ytd), options: { ...zebra, align: "right", color: P.ink, bold: true } },
    ]);
  }
  s.addTable(rows, { x: 0.6, y: 1.5, w: 12.15, h: 5.6, fontFace: BODY_FONT, fontSize: 9, border: { type: "solid", pt: 0.5, color: P.ice } });
}

function topProducts(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  setLightBg(s);
  sectionHeader(s, "06 • TOP CONTRIBUTION", titleFor(input.months));

  const place = (m: typeof input.months[number], x: number, w: number) => {
    const top = (m.topProducts?.rows ?? []).slice(0, 10);
    const maxMyr = Math.max(1, ...top.map(r => r.myr));
    s.addText(`${monthShort(m.month)} ${m.year}`, { x, y: 1.5, w, h: 0.35, fontFace: BODY_FONT, fontSize: 11, bold: true, color: P.ink3, charSpacing: 3 });
    top.forEach((r, i) => {
      const y = 1.95 + i * 0.50;
      s.addText(r.product, { x, y, w: w * 0.5, h: 0.45, fontFace: BODY_FONT, fontSize: 11, color: P.ink, valign: "middle" });
      // bar background
      s.addShape("rect", { x: x + w * 0.5, y: y + 0.12, w: w * 0.42, h: 0.22, fill: { color: P.mutedBg }, line: { color: P.mutedBg } });
      // bar fill
      const frac = Math.max(0.02, r.myr / maxMyr);
      s.addShape("rect", { x: x + w * 0.5, y: y + 0.12, w: w * 0.42 * frac, h: 0.22, fill: { color: P.ink2 }, line: { color: P.ink2 } });
      s.addText(`RM ${fmtMYR(r.myr, 0)}`, { x: x + w * 0.5, y, w: w * 0.42, h: 0.45, fontFace: BODY_FONT, fontSize: 10, color: P.white, bold: true, align: "center", valign: "middle" });
      s.addText(fmtPct(r.pct, 1), { x: x + w * 0.92, y, w: w * 0.08, h: 0.45, fontFace: BODY_FONT, fontSize: 10, color: P.ink3, align: "right", valign: "middle", italic: true });
    });
  };

  if (input.months.length === 2) {
    place(input.months[0], 0.6, 5.8);
    place(input.months[1], 7.0, 5.8);
  } else {
    place(input.months[0], 0.6, 12.2);
  }
}

function salesByECP(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  setLightBg(s);
  sectionHeader(s, "07 • SALES BY ECP", titleFor(input.months));

  const last = input.months[input.months.length - 1];
  const data = last.salesByECP?.rows ?? ECP_CATEGORIES.map(category => ({ category, outlets: 0, pct: 0, salesMyr: 0 }));

  // Donut-style pie chart on the left
  s.addChart(pptx.ChartType.doughnut, [{
    name: "Sales",
    labels: data.map(r => r.category),
    values: data.map(r => r.salesMyr),
  }], {
    x: 0.6, y: 1.5, w: 5.5, h: 5.5,
    chartColors: [P.ink2, P.accent, P.accent2, P.ink3, P.ice],
    showLegend: true, legendPos: "b", legendFontFace: BODY_FONT, legendFontSize: 10, legendColor: P.ink,
    dataLabelFontFace: BODY_FONT, dataLabelFontSize: 10, dataLabelColor: P.white,
    showPercent: true,
    holeSize: 55,
  });
  // Tabular rail on the right
  const rows: PptxGenJS.TableCell[][] = [[
    { text: "Category", options: { bold: true, color: P.white, fill: { color: P.ink } } },
    { text: "Outlets", options: { bold: true, color: P.white, fill: { color: P.ink }, align: "right" } },
    { text: "%", options: { bold: true, color: P.white, fill: { color: P.ink }, align: "right" } },
    { text: "MYR", options: { bold: true, color: P.white, fill: { color: P.ink }, align: "right" } },
    { text: "JPY", options: { bold: true, color: P.white, fill: { color: P.ink }, align: "right" } },
  ]];
  data.forEach((r, i) => {
    const zebra = i % 2 === 0 ? { fill: { color: P.rowAlt } } : {};
    rows.push([
      { text: r.category, options: { ...zebra, color: P.ink } },
      { text: String(r.outlets), options: { ...zebra, align: "right", color: P.ink } },
      { text: fmtPct(r.pct), options: { ...zebra, align: "right", color: P.ink } },
      { text: fmtMYR(r.salesMyr), options: { ...zebra, align: "right", color: P.ink, bold: true } },
      { text: fmtJPY(r.salesMyr * last.fxRate), options: { ...zebra, align: "right", color: P.ink3 } },
    ]);
  });
  // Total row — sums Outlets and MYR/JPY across the 5 categories. Styled
  // like the dark header so it reads as the footer.
  const totalOutlets   = data.reduce((s, r) => s + (r.outlets || 0), 0);
  const totalSalesMyr  = data.reduce((s, r) => s + (r.salesMyr || 0), 0);
  const totalCell = { bold: true, color: P.white, fill: { color: P.ink } };
  rows.push([
    { text: "Total",                                  options: { ...totalCell } },
    { text: String(totalOutlets),                     options: { ...totalCell, align: "right" } },
    { text: fmtPct(1),                                options: { ...totalCell, align: "right" } },
    { text: fmtMYR(totalSalesMyr),                    options: { ...totalCell, align: "right" } },
    { text: fmtJPY(totalSalesMyr * last.fxRate),      options: { ...totalCell, align: "right" } },
  ]);
  s.addTable(rows, { x: 6.3, y: 1.7, w: 6.5, h: 4.5, fontFace: BODY_FONT, fontSize: 11, border: { type: "solid", pt: 0.5, color: P.ice } });
}

function salesByRegion(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  setLightBg(s);
  sectionHeader(s, "08 • SALES BY REGION", titleFor(input.months));

  const last = input.months[input.months.length - 1];
  const data = last.salesByRegion?.rows ?? REGIONS.map(region => ({ region, salesThis: 0, salesPrev: 0, growthPct: 0 }));

  // Horizontal bar chart per region
  s.addChart(pptx.ChartType.bar, [{
    name: `${monthShort(last.month)} ${last.year}`,
    labels: data.map(r => r.region),
    values: data.map(r => r.salesThis),
  }, {
    name: "Prior Month",
    labels: data.map(r => r.region),
    values: data.map(r => r.salesPrev),
  }], {
    x: 0.6, y: 1.5, w: 8.5, h: 5.0, barDir: "bar",
    chartColors: [P.ink2, P.ice],
    showLegend: true, legendPos: "b", legendFontFace: BODY_FONT, legendFontSize: 10,
    catAxisLabelFontFace: BODY_FONT, catAxisLabelFontSize: 10, catAxisLabelColor: P.ink,
    valAxisLabelFontFace: BODY_FONT, valAxisLabelFontSize: 9, valAxisLabelColor: P.ink3,
  });

  // Growth callouts on the right
  data.forEach((r, i) => {
    const y = 1.5 + i * 1.05;
    s.addShape("roundRect", { x: 9.3, y, w: 3.5, h: 0.95, rectRadius: 0.08, fill: { color: P.mutedBg }, line: { color: P.mutedBg } });
    s.addText(r.region.split("(")[0].trim(), { x: 9.4, y: y + 0.05, w: 3.3, h: 0.35, fontFace: BODY_FONT, fontSize: 10, bold: true, color: P.ink });
    s.addText(fmtPct(r.growthPct, 1), {
      x: 9.4, y: y + 0.35, w: 3.3, h: 0.55, fontFace: DISPLAY_FONT, fontSize: 24, bold: true,
      color: r.growthPct >= 0 ? P.positive : P.negative,
    });
  });
}

function productRegistration(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  setLightBg(s);
  sectionHeader(s, "09 • PRODUCT REGISTRATION", "MDA pipeline");

  const data = input.months[input.months.length - 1].productRegistration?.rows ?? [];
  const headers = ["Product", "Class", "Start", "Doc OS", "CAB", "MDA Sub", "MDA Proc", "Completion", "Approval No"];
  const rows: PptxGenJS.TableCell[][] = [headers.map(h => ({ text: h, options: { bold: true, color: P.white, fill: { color: P.ink }, fontSize: 10 } }))];
  data.forEach((r, i) => {
    const zebra = i % 2 === 0 ? { fill: { color: P.rowAlt } } : {};
    rows.push([
      { text: r.product, options: { ...zebra, color: P.ink, bold: true } },
      { text: r.class, options: { ...zebra, color: P.ink } },
      { text: r.startDate, options: { ...zebra, color: P.ink } },
      { text: r.docOverseas, options: { ...zebra, color: P.ink } },
      { text: r.cabAssessment, options: { ...zebra, color: P.ink } },
      { text: r.mdaSubmission, options: { ...zebra, color: P.ink } },
      { text: r.mdaProcess, options: { ...zebra, color: P.ink } },
      { text: r.completionDate, options: { ...zebra, color: P.ink } },
      { text: r.mdaApprovalNo, options: { ...zebra, color: P.ink } },
    ]);
  });
  s.addTable(rows, { x: 0.6, y: 1.5, w: 12.15, h: 5.2, fontFace: BODY_FONT, fontSize: 10, border: { type: "solid", pt: 0.5, color: P.ice } });

  // Commentary line below the table — only when the user has written one.
  const cmt = (input.months[input.months.length - 1].productRegistration?.commentary ?? "").replace(/<[^>]*>/g, "").trim();
  if (cmt) {
    s.addText(htmlToPptxRuns(input.months[input.months.length - 1].productRegistration?.commentary, 11), {
      x: 0.6, y: 6.8, w: 12.15, h: 0.6, fontFace: BODY_FONT, color: P.ink3, italic: true, valign: "top", wrap: true,
    });
  }
}

function inventory(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  setLightBg(s);
  const last = input.months[input.months.length - 1];
  sectionHeader(s, "10 • INVENTORY SNAPSHOT", `${monthShort(last.month)} ${last.year}`);

  const inv = last.inventory;
  if (inv) {
    // KPI strip at top: totals
    const totW = (inv.totalWarehouse ?? 0);
    const totC = (inv.totalConsignment ?? 0);
    s.addShape("roundRect", { x: 0.6, y: 1.5, w: 5.9, h: 1.0, rectRadius: 0.10, fill: { color: P.ink }, line: { color: P.ink } });
    s.addText("WAREHOUSE", { x: 0.75, y: 1.55, w: 5.6, h: 0.3, fontFace: BODY_FONT, fontSize: 11, color: P.ice, charSpacing: 3 });
    s.addText(`${fmtMYR(totW, 0)}`, { x: 0.75, y: 1.85, w: 5.6, h: 0.6, fontFace: DISPLAY_FONT, fontSize: 26, bold: true, color: P.white });

    s.addShape("roundRect", { x: 6.85, y: 1.5, w: 5.9, h: 1.0, rectRadius: 0.10, fill: { color: P.ink2 }, line: { color: P.ink2 } });
    s.addText("CONSIGNMENT", { x: 7.0, y: 1.55, w: 5.6, h: 0.3, fontFace: BODY_FONT, fontSize: 11, color: P.ice, charSpacing: 3 });
    s.addText(`${fmtMYR(totC, 0)}`, { x: 7.0, y: 1.85, w: 5.6, h: 0.6, fontFace: DISPLAY_FONT, fontSize: 26, bold: true, color: P.white });

    // Groups as small tables — bigger + centered number cells to mirror the dashboard grid.
    inv.groups.forEach((g, gi) => {
      const y = 2.8 + gi * 0.95;
      s.addText(g.name, { x: 0.6, y, w: 3.5, h: 0.4, fontFace: BODY_FONT, fontSize: 12, bold: true, color: P.ink3, valign: "middle" });
      const headers: PptxGenJS.TableCell[] = [
        { text: "", options: { fill: { color: P.ice2 } } },
        ...g.rows.slice(0, 6).map(r => ({
          text: r.product,
          options: { bold: true, align: "center" as const, fill: { color: P.ice2 }, color: P.ink, fontSize: 11 },
        })),
      ];
      const warehouse: PptxGenJS.TableCell[] = [
        { text: "WH", options: { italic: true, color: P.ink3, fontSize: 11 } },
        ...g.rows.slice(0, 6).map(r => ({
          text: r.warehouse == null ? "" : fmtMYR(r.warehouse, 0),
          options: { align: "center" as const, color: P.ink, fontSize: 15, bold: true },
        })),
      ];
      const consign: PptxGenJS.TableCell[] = [
        { text: "Consign.", options: { italic: true, color: P.ink3, fontSize: 11 } },
        ...g.rows.slice(0, 6).map(r => ({
          text: r.consignment == null ? "" : fmtMYR(r.consignment, 0),
          options: { align: "center" as const, color: P.ink, fontSize: 15, bold: true },
        })),
      ];
      s.addTable([headers, warehouse, consign], {
        x: 4.2, y, w: 8.5, h: 0.9,
        fontFace: BODY_FONT, fontSize: 11, valign: "middle",
        border: { type: "solid", pt: 0.5, color: P.ice },
      });
    });

    s.addText(inv.commentary || "", { x: 0.6, y: 6.5, w: 12.15, h: 0.7, fontFace: BODY_FONT, fontSize: 10, color: P.ink3, italic: true, valign: "top" });
  }
}

function expireWriteOff(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  setLightBg(s);
  const lastSel = input.months[input.months.length - 1];
  sectionHeader(s, "11 • EXPIRY WRITE-OFF", `Cumulative through ${monthShort(lastSel.month)}`);

  // Cumulative months from Jan → current selected month (falls back to the selected ones).
  const currentIds = new Set(input.months.map(m => m.id));
  const ctx = (input.context ?? input.months)
    .filter(m => m.year === lastSel.year && m.month <= lastSel.month)
    .sort((a, b) => a.month - b.month);
  const months = ctx.length ? ctx : input.months;

  // Yellow highlight tones for the current month pair.
  const HL = P.accent2 || "F9E795";

  // Header row 1: Product | <month label colspan=2> … | Total Write-Off colspan=2
  const headers: PptxGenJS.TableCell[] = [{
    text: "Expire Write-Off Activity",
    options: { bold: true, color: P.white, fill: { color: P.ink }, rowspan: 2, valign: "middle" },
  }];
  for (const m of months) {
    const curr = currentIds.has(m.id);
    headers.push({
      text: `${monthShort(m.month)}-${String(m.year).slice(-2)}`,
      options: {
        bold: true, colspan: 2, align: "center",
        color: curr ? P.ink : P.white,
        fill: { color: curr ? HL : P.ink },
      },
    });
  }
  headers.push({ text: "Total Write-Off", options: { bold: true, colspan: 2, align: "center", color: P.white, fill: { color: P.ink } } });

  // Header row 2: sub columns
  const subHead: PptxGenJS.TableCell[] = [{ text: "" }];
  for (const m of months) {
    const curr = currentIds.has(m.id);
    const fill = { color: curr ? HL : P.ink3 };
    const color = curr ? P.ink : P.white;
    subHead.push({ text: "QUANTITY", options: { bold: true, align: "center", fill, color, fontSize: 9 } });
    subHead.push({ text: "AMOUNT",   options: { bold: true, align: "center", fill, color, fontSize: 9 } });
  }
  subHead.push({ text: "QUANTITY", options: { bold: true, align: "center", color: P.white, fill: { color: P.ink3 }, fontSize: 9 } });
  subHead.push({ text: "AMOUNT",   options: { bold: true, align: "center", color: P.white, fill: { color: P.ink3 }, fontSize: 9 } });

  const all = new Set<string>();
  for (const m of months) for (const r of m.expireWriteOff?.rows ?? []) all.add(r.product);
  const body: PptxGenJS.TableCell[][] = [];
  for (const p of [...all].sort()) {
    const row: PptxGenJS.TableCell[] = [{ text: p, options: { color: P.ink, bold: true } }];
    let rowQ = 0, rowA = 0;
    for (const m of months) {
      const match = m.expireWriteOff?.rows.find(x => x.product === p);
      const curr = currentIds.has(m.id);
      rowQ += match?.qty ?? 0; rowA += match?.amt ?? 0;
      const cellOpts: PptxGenJS.TableCellProps = {
        align: "center", color: P.ink, bold: curr,
        ...(curr ? { fill: { color: "FDF4C7" } } : {}),
      };
      row.push({ text: match?.qty ? String(match.qty) : "", options: cellOpts });
      row.push({ text: match?.amt ? fmtMYR(match.amt, 0) : "", options: cellOpts });
    }
    row.push({ text: rowQ ? String(rowQ) : "", options: { align: "center", bold: true, color: P.ink } });
    row.push({ text: rowA ? fmtMYR(rowA, 0) : "", options: { align: "center", bold: true, color: P.ink } });
    body.push(row);
  }

  const total: PptxGenJS.TableCell[] = [{ text: "Total", options: { bold: true, color: P.white, fill: { color: P.ink2 } } }];
  let grandQ = 0, grandA = 0;
  for (const m of months) {
    const sumQ = (m.expireWriteOff?.rows ?? []).reduce((s, r) => s + r.qty, 0);
    const sumA = (m.expireWriteOff?.rows ?? []).reduce((s, r) => s + r.amt, 0);
    grandQ += sumQ; grandA += sumA;
    const curr = currentIds.has(m.id);
    total.push({ text: String(sumQ), options: { bold: true, align: "center", color: curr ? P.ink : P.white, fill: { color: curr ? HL : P.ink2 } } });
    total.push({ text: fmtMYR(sumA, 0), options: { bold: true, align: "center", color: curr ? P.ink : P.white, fill: { color: curr ? HL : P.ink2 } } });
  }
  total.push({ text: String(grandQ), options: { bold: true, align: "center", color: P.white, fill: { color: P.ink2 } } });
  total.push({ text: fmtMYR(grandA, 0), options: { bold: true, align: "center", color: P.white, fill: { color: P.ink2 } } });

  s.addTable([headers, subHead, ...body, total], {
    x: 0.6, y: 1.5, w: 12.15, h: 5.6,
    fontFace: BODY_FONT, fontSize: 10, valign: "middle",
    border: { type: "solid", pt: 0.5, color: P.ice },
  });
}

function financial(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  setLightBg(s);
  sectionHeader(s, "12 • FINANCIAL RELATIONSHIP", titleFor(input.months));

  const headers: PptxGenJS.TableCell[] = [{ text: "Item", options: { bold: true, color: P.white, fill: { color: P.ink } } }];
  for (const m of input.months) {
    headers.push({ text: `${monthShort(m.month)} JPY`, options: { bold: true, align: "right", color: P.white, fill: { color: P.ink } } });
    headers.push({ text: `${monthShort(m.month)} MYR`, options: { bold: true, align: "right", color: P.white, fill: { color: P.ink } } });
  }
  const mk = (label: string, key: keyof NonNullable<typeof input.months[number]["financial"]>): PptxGenJS.TableCell[] => {
    const r: PptxGenJS.TableCell[] = [{ text: label, options: { bold: true, color: P.ink, fill: { color: P.ice2 } } }];
    for (const m of input.months) {
      const f = m.financial;
      const myr = safeNum(f?.[key] as number | undefined);
      r.push({ text: fmtJPY(myr * m.fxRate), options: { align: "right", color: P.ink3 } });
      r.push({ text: fmtMYR(myr, 0), options: { align: "right", color: P.ink, bold: true } });
    }
    return r;
  };
  const rows: PptxGenJS.TableCell[][] = [
    headers,
    mk("Account Receivable", "arMyr"),
    mk("AR 180-365d (long-term)", "arLongTermMyr"),
    mk("Account Payable", "apMyr"),
    mk("Collection", "collectionMyr"),
    mk("Cash Flow", "cashFlowMyr"),
  ];
  s.addTable(rows, { x: 0.6, y: 1.6, w: 12.15, h: 4.5, fontFace: BODY_FONT, fontSize: 12, border: { type: "solid", pt: 0.5, color: P.ice } });
}

function otherMarket(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  setLightBg(s);
  sectionHeader(s, "13 • MARKET UPDATE", "Competitive intel & pipeline");
  const o = input.months[input.months.length - 1].otherMarket;
  const runs = htmlToPptxRuns(o?.body, 14);
  s.addText(runs.length ? runs : [{ text: "", options: { fontSize: 14 } }], { x: 0.6, y: 1.5, w: 12.15, h: 5.5, fontFace: BODY_FONT, color: P.ink, valign: "top", paraSpaceAfter: 10, wrap: true });
}

function thankYou(pptx: PptxGenJS) {
  const s = pptx.addSlide();
  setDarkBg(s);
  s.addShape("rect", { x: 0, y: 3.3, w: SLIDE_W, h: 0.06, fill: { color: P.accent }, line: { color: P.accent } });
  s.addText("THANK YOU", {
    x: 0, y: 2.5, w: SLIDE_W, h: 1, fontFace: DISPLAY_FONT, fontSize: 72, bold: true, color: P.white, align: "center",
  });
  s.addText("Questions welcome — let's discuss.", {
    x: 0, y: 3.6, w: SLIDE_W, h: 0.6, fontFace: BODY_FONT, fontSize: 18, color: P.ice, align: "center", italic: true,
  });
  {
    const ty = brandImageDataUrl("thankyou.jpg");
    if (ty) s.addImage({ data: ty, x: SLIDE_W / 2 - 1.5, y: 4.8, w: 3, h: 1.55 });
  }
}
