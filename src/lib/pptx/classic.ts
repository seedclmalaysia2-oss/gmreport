// Classic PPTX generator — reproduces the HQ layout position-for-position from the sample decks.
// Accepts 1 or 2 MonthReports (the 2-month case is the "combined" Jan+Feb variant).

import PptxGenJS from "pptxgenjs";
import { CLASSIC_PALETTE as C, applyThemeToClassic, brandImagePath, fmtJPY, fmtMYR, fmtPct, monthNameFull, monthShort, titleFor, type PptxInput, SLIDE_W, SLIDE_H, safeNum } from "./shared";
import { htmlToPptxRuns } from "./rich-text";
import { MONTH_NAMES } from "@/lib/utils";
import { AGENDA, ECP_CATEGORIES, REGIONS } from "@/lib/catalog/mappings";
import { INVENTORY_GROUPS } from "@/lib/catalog/products";

type Slide = PptxGenJS.Slide;

const FONT = "Calibri";

function titleBar(slide: Slide, text: string, x = 0.25, y = 0.15, w = 12.5, h = 0.7, size = 28) {
  slide.addText(text, { x, y, w, h, fontFace: FONT, fontSize: size, bold: true, color: C.text });
}

function headerFill(): PptxGenJS.ShapeFillProps { return { color: C.header }; }

export async function generateClassicPptx(input: PptxInput): Promise<Uint8Array> {
  // Swap the global CLASSIC_PALETTE to the requested theme BEFORE any slide draws.
  // The rest of the generator reads `C.*` which points at the same mutated object.
  applyThemeToClassic(input.paletteId);

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pptx.title = `Malaysia Review — ${titleFor(input.months)}`;
  pptx.author = input.months[0]?.presenter ?? "Simon (Malaysia GM)";

  slideCover(pptx, input);
  slideAgenda(pptx);
  slideSalesAchievement(pptx, input);
  slideSalesTrend(pptx, input);
  slideOutlook(pptx, input);
  for (const m of input.months) slideDailySales(pptx, input, m);
  slideSalesByQuantity(pptx, input);
  slideTopProducts(pptx, input);
  slideSalesByECP(pptx, input);
  slideSalesByRegion(pptx, input);
  slideProductRegistration(pptx, input);
  slideInventory(pptx, input);
  slideExpireWriteOff(pptx, input);
  slideFinancial(pptx, input);
  slideOtherMarket(pptx, input);
  slideAppendix(pptx, input);
  slideThankYou(pptx);

  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Uint8Array;
}

// =================== Slides ===================

function slideCover(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  s.background = { color: "FFFFFF" };
  try { s.addImage({ path: brandImagePath("logo.jpg"), x: 0.45, y: 0.41, w: 2.82, h: 1.63 }); } catch { /* no-op */ }

  s.addText("MALAYSIA REVIEW", {
    x: 1.67, y: 2.66, w: 10.0, h: 1.09,
    fontFace: FONT, fontSize: 54, bold: true, color: C.header, align: "center",
  });
  s.addText(titleFor(input.months).toUpperCase(), {
    x: 1.67, y: 4.01, w: 10.0, h: 0.58,
    fontFace: FONT, fontSize: 28, color: C.text, align: "center",
  });
  const m = input.months[input.months.length - 1];
  const dt = m.presentDate ? new Date(m.presentDate) : null;
  s.addText(
    dt ? `Present on ${dt.getDate()}/${m.month}/${m.year.toString().slice(-2)}` : "",
    { x: 0.21, y: 6.75, w: 3.69, h: 0.58, fontFace: FONT, fontSize: 14, color: C.muted },
  );
  s.addText(`By ${m.presenter}`, {
    x: 4.97, y: 4.54, w: 3.39, h: 0.43,
    fontFace: FONT, fontSize: 14, italic: true, color: C.muted, align: "center",
  });
}

function slideAgenda(pptx: PptxGenJS) {
  const s = pptx.addSlide();
  s.addText("Presentation Slide", {
    x: 1.09, y: 0.50, w: 11.50, h: 0.46,
    fontFace: FONT, fontSize: 24, bold: true, color: C.header,
  });
  s.addText(
    AGENDA.map((t, i) => ({ text: `${i + 1}.  ${t}`, options: { bullet: false } })),
    { x: 1.09, y: 1.25, w: 11.50, h: 5.68, fontFace: FONT, fontSize: 24, color: C.text, paraSpaceAfter: 10 },
  );
}

function slideSalesAchievement(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  const months = input.months;
  const lastMonth = months[months.length - 1];
  const headerTitle = months.length === 1
    ? `1. Sales Achievement (${monthShort(lastMonth.month)} ${lastMonth.year})`
    : `1. Sales Achievement (${monthShort(months[0].month)} & ${monthShort(lastMonth.month)} ${lastMonth.year})`;
  titleBar(s, headerTitle, 0.18, 0.14, 8.55, 0.50);

  const SA = lastMonth.salesAchievement;
  const headers = ["", ...MONTH_NAMES, "Total"];
  const row = (label: string, data: (number | null)[], isPct = false) => {
    const cells: PptxGenJS.TableCell[] = [{ text: label, options: { bold: true, fill: { color: C.rowAlt } } }];
    let total = 0;
    for (const v of data) {
      if (v != null && !isPct) total += v;
      cells.push({
        text: v == null ? "" : isPct ? fmtPct(v) : fmtMYR(v),
        options: { align: "right" },
      });
    }
    cells.push({ text: isPct ? "" : fmtMYR(total), options: { align: "right", bold: true } });
    return cells;
  };
  const headerCells: PptxGenJS.TableCell[] = headers.map(h => ({
    text: h, options: { bold: true, align: "center", fill: headerFill(), color: C.headerText },
  }));
  const rows: PptxGenJS.TableCell[][] = [headerCells];
  if (SA) {
    rows.push(row("Sales Target 2026",   SA.target2026));
    rows.push(row("Sales Result 2026",   SA.actual2026));
    // Accumulated % = actual/target per month
    const acc = SA.target2026.map((t, i) => (t && SA.actual2026[i] != null ? (SA.actual2026[i]! / t) : 0));
    rows.push(row("ACC %",               acc, true));
    rows.push(row("Sales Result 2025",   SA.actual2025));
    const yoy = SA.actual2025.map((p, i) => (p && SA.actual2026[i] != null ? (SA.actual2026[i]! / p) : 0));
    rows.push(row("YoY %",               yoy, true));
    rows.push(row("Net Income 2026",     SA.netIncome2026));
    rows.push(row("Net Income 2025",     SA.netIncome2025));
  } else {
    rows.push([{ text: "No data", options: { colspan: headers.length, align: "center" } }]);
  }
  // 14pt was too big — 7-digit totals like "4,165,903" clipped in the 0.77"
  // monthly columns. Pull body to 11pt (Total row stays emphasised via bold)
  // and align cells to the middle vertically so rows read evenly.
  s.addTable(rows, {
    x: 0.18, y: 0.95, w: 12.99, h: 4.8,
    fontFace: FONT, fontSize: 11,
    border: { type: "solid", pt: 0.5, color: C.tableBorder },
    colW: [1.9, ...Array(12).fill(0.77), 1.85],
    valign: "middle",
  });

  // KPI blurb(s) — moved down with the bigger table, font up for readability.
  if (months.length === 1) {
    const kpi = lastMonth.salesAchievement?.kpi.find(k => k.month === lastMonth.month);
    if (kpi) {
      const lines = [
        `Monthly achievement rate of ${fmtPct(kpi.achievementPct)}`,
        `Year on Year achievement rate for same month ${fmtPct(kpi.yoyPct)}`,
        `${kpi.newStores ?? 0} newly developed stores, traded in ${monthShort(lastMonth.month)} ${lastMonth.year} = ${kpi.ecpThis ?? 0} ECP vs ${monthShort(lastMonth.month)} ${lastMonth.year - 1} = ${kpi.ecpPrior ?? 0} ECP`,
        `${monthShort(lastMonth.month)} P/L: RM ${fmtMYR(kpi.plMyr, 0)} (approximately ${((kpi.plJpy ?? 0) / 1_000_000).toFixed(2)} mil yen)`,
        ...kpi.extraLines,
      ];
      s.addText(lines.map(text => ({ text, options: { bullet: true } })), {
        x: 0.18, y: 5.9, w: 12.47, h: 1.55, fontFace: FONT, fontSize: 16, color: C.text, paraSpaceAfter: 2,
      });
    }
  } else {
    const colW = 6.34;
    months.forEach((m, i) => {
      const x = 0.18 + i * (colW + 0.30);
      const kpi = m.salesAchievement?.kpi.find(k => k.month === m.month);
      s.addText(`${monthShort(m.month)} ${m.year}`, {
        x, y: 5.95, w: colW, h: 0.35, fontFace: FONT, fontSize: 18, bold: true, color: C.header,
      });
      if (!kpi) return;
      const lines = [
        `Monthly achievement rate of ${fmtPct(kpi.achievementPct)}`,
        `YoY achievement rate for same month ${fmtPct(kpi.yoyPct)}`,
        `${kpi.newStores ?? 0} new stores traded in ${monthShort(m.month)} ${m.year} = ${kpi.ecpThis ?? 0} ECP vs ${monthShort(m.month)} ${m.year - 1} = ${kpi.ecpPrior ?? 0} ECP`,
        `${monthShort(m.month)} P/L: RM ${fmtMYR(kpi.plMyr, 0)} (approx ${((kpi.plJpy ?? 0) / 1_000_000).toFixed(2)} mil yen)`,
      ];
      s.addText(lines.map(text => ({ text, options: { bullet: true } })), {
        x, y: 6.30, w: colW, h: 1.15, fontFace: FONT, fontSize: 14, color: C.text,
      });
    });
  }
}

function slideSalesTrend(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  titleBar(s, "2. Sales Trend 2026", 0.43, 0.35, 11.50, 0.60, 22);

  const last = input.months[input.months.length - 1];
  const SA = last.salesAchievement;
  if (!SA) {
    s.addText("No sales trend data yet.", { x: 0.5, y: 3, w: 12, h: 1, fontSize: 16, italic: true, color: C.muted });
    return;
  }
  const categories = MONTH_NAMES.slice();
  const safe = (a: (number | null)[]) => a.map(v => (v ?? 0));
  // Actual 2026 stops at the last month with real data — replace future months with the
  // last known value so the line sits flat rather than crashing to 0.
  const lastFilled = SA.actual2026.reduce<number>((acc, v, i) => v != null ? i : acc, -1);
  const actual2026Trimmed = lastFilled >= 0
    ? SA.actual2026.map((v, i) => i <= lastFilled ? (v ?? 0) : null)
    : SA.actual2026.map(() => null);
  // Commentary card pushes up from the bottom; the chart shrinks to fit.
  const commentary = (last.salesTrend?.commentary ?? "").trim();
  const chartH = commentary ? 4.5 : 5.7;
  // Order matters for overlap control: Actual 2026 sits on top (labels above),
  // Target 2026 below (red, labels below), Actual 2025 at bottom (light orange).
  s.addChart(pptx.ChartType.line, [
    { name: "Actual 2026", labels: [...categories], values: actual2026Trimmed as number[] },
    { name: "Target 2026", labels: [...categories], values: safe(SA.target2026) },
    { name: "Actual 2025", labels: [...categories], values: safe(SA.actual2025) },
  ], {
    showValue: true,
    dataLabelFontFace: FONT,
    dataLabelFontSize: 16,
    dataLabelFontBold: true,
    dataLabelPosition: "t",
    dataLabelFormatCode: "#,##0",
    x: 0.5, y: 0.95, w: 12.3, h: chartH,
    chartArea: { fill: { color: "FFFFFF" } },
    // Actual 2026 → navy bold, Target 2026 → red, Actual 2025 → green.
    chartColors: ["0B1F5C", "DC2626", "22C55E"],
    lineSize: 3,
    showLegend: true, legendPos: "b", legendFontFace: FONT, legendFontSize: 15,
    catAxisLabelFontFace: FONT, catAxisLabelFontSize: 14, catAxisLabelFontBold: true,
    valAxisLabelFontFace: FONT, valAxisLabelFontSize: 14,
    lineDataSymbol: "circle", lineDataSymbolSize: 10,
  });

  // ---- Commentary card ----
  if (commentary) {
    const commentY = 0.95 + chartH + 0.15;
    const commentH = 7.3 - commentY - 0.1;
    s.addShape("roundRect", {
      x: 0.25, y: commentY, w: 12.85, h: commentH, rectRadius: 0.08,
      fill: { color: "F4F7FF" }, line: { color: "CADCFC", width: 0.75 },
    });
    s.addText("COMMENTARY", {
      x: 0.40, y: commentY + 0.05, w: 12.6, h: 0.28,
      fontFace: FONT, fontSize: 10, bold: true, color: C.muted, charSpacing: 4,
    });
    s.addText(commentary, {
      x: 0.40, y: commentY + 0.36, w: 12.6, h: commentH - 0.42,
      fontFace: FONT, fontSize: 14, color: C.text, valign: "top", paraSpaceAfter: 4, wrap: true,
    });
  }
}

function slideOutlook(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  const last = input.months[input.months.length - 1];
  titleBar(s, `3. Malaysia Outlook – ${monthShort(last.month)} ${last.year}`, 0.49, 0.27, 11, 0.61, 22);
  const body = last.marketOutlook?.body;
  // Parse the editor's HTML into styled runs. The bounding box forces auto-wrap so
  // formatted paragraphs always stay inside the slide margins.
  const runs = htmlToPptxRuns(body, 16);
  s.addText(runs.length ? runs : [{ text: "—", options: { fontSize: 16 } }], {
    x: 0.84, y: 0.95, w: 11.66, h: 5.84, fontFace: FONT, color: C.text,
    valign: "top", paraSpaceAfter: 6, wrap: true,
  });
}

function slideDailySales(pptx: PptxGenJS, input: PptxInput, m: typeof input.months[number]) {
  const s = pptx.addSlide();
  titleBar(s, `4. Daily Sales Quantity – ${monthNameFull(m.month).toUpperCase()} ${m.year}`, 0.25, 0.15, 12.8, 0.6, 24);

  const D = m.dailySales;
  if (!D) {
    s.addText("No daily sales data.", { x: 0.5, y: 3, w: 12, h: 1, fontSize: 16, italic: true, color: C.muted });
    return;
  }

  // ---- Stats ----
  const daysInMonth = new Date(m.year, m.month, 0).getDate();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const wdShort = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const holidayMap = new Map(D.holidays.map(h => [h.date, h.label]));

  const labels: string[] = [];
  const values: number[] = [];
  const nonTradingIndexes: number[] = [];
  let totalQty = 0; let peak = { qty: 0, dateLabel: "" };
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${m.year}-${String(m.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const row = D.days.find(d => d.date === iso);
    const wd = new Date(m.year, m.month - 1, day).getDay();
    const nonTrading = wd === 0 || wd === 6 || holidayMap.has(iso);
    const qty = row?.qty ?? 0;
    labels.push(`${day}-${months[m.month - 1]}\n${wdShort[wd]}`);
    values.push(qty);
    if (nonTrading) nonTradingIndexes.push(day - 1);
    totalQty += qty;
    if (qty > peak.qty) peak = { qty, dateLabel: `${day}-${months[m.month - 1]}` };
  }
  const tradingDays = values.filter(v => v > 0).length;
  const avg = tradingDays ? Math.round(totalQty / tradingDays) : 0;

  // ---- KPI strip (navy-on-white cards, one accent card) ----
  const kpis = [
    { label: "MONTH", value: `${monthNameFull(m.month)} ${m.year}`, accent: false },
    { label: "TOTAL UNITS", value: totalQty.toLocaleString("en-US"), accent: true },
    { label: "AVG / TRADING DAY", value: avg ? avg.toLocaleString("en-US") : "—", accent: false },
    { label: "PEAK", value: peak.qty ? `${peak.qty.toLocaleString("en-US")} (${peak.dateLabel})` : "—", accent: false },
  ];
  const kpiY = 0.90;
  const kpiH = 0.82;
  const kpiGap = 0.14;
  const kpiW = (13.33 - 0.5 - kpiGap * 3) / 4;
  kpis.forEach((k, i) => {
    const x = 0.25 + i * (kpiW + kpiGap);
    s.addShape("roundRect", {
      x, y: kpiY, w: kpiW, h: kpiH, rectRadius: 0.08,
      fill: { color: k.accent ? C.header : "F4F7FF" },
      line: { color: k.accent ? C.header : "CADCFC", width: 0.75 },
    });
    s.addText(k.label, {
      x: x + 0.12, y: kpiY + 0.06, w: kpiW - 0.24, h: 0.25,
      fontFace: FONT, fontSize: 10, bold: true,
      color: k.accent ? "CADCFC" : C.muted, charSpacing: 4,
    });
    s.addText(k.value, {
      x: x + 0.12, y: kpiY + 0.34, w: kpiW - 0.24, h: 0.42,
      fontFace: FONT, fontSize: 18, bold: true,
      color: k.accent ? "FFFFFF" : C.text,
    });
  });

  // ---- Chart card ----
  const chartY = 1.90;
  const chartH = 3.55;
  s.addShape("roundRect", {
    x: 0.25, y: chartY, w: 12.85, h: chartH, rectRadius: 0.08,
    fill: { color: "FFFFFF" }, line: { color: "CADCFC", width: 0.75 },
  });
  s.addChart(pptx.ChartType.bar, [{ name: "Qty", labels, values }], {
    x: 0.38, y: chartY + 0.12, w: 12.59, h: chartH - 0.24,
    barDir: "col",
    barGapWidthPct: 30,
    chartColors: [C.header],
    showLegend: false,
    catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9, catAxisLabelRotate: 0,
    valAxisLabelFontFace: FONT, valAxisLabelFontSize: 10,
    valAxisTitle: "Quantity", valAxisTitleFontFace: FONT, valAxisTitleFontSize: 11,
    showValue: true, dataLabelFontFace: FONT, dataLabelFontSize: 9, dataLabelFontBold: true,
  });
  // Red-bracket callouts under x-axis for weekends + holidays.
  const chartLeft = 0.38, chartWidth = 12.59, plotInsetL = 0.55, plotInsetR = 0.25;
  const plotW = chartWidth - plotInsetL - plotInsetR;
  const bandW = plotW / daysInMonth;
  for (const i of nonTradingIndexes) {
    const cx = chartLeft + plotInsetL + bandW * (i + 0.5);
    s.addShape("rect", {
      x: cx - bandW * 0.42, y: chartY + chartH - 0.70, w: bandW * 0.84, h: 0.34,
      fill: { type: "none" }, line: { color: C.negative, width: 1 },
    });
  }

  // ---- Holiday pills (red soft chips) ----
  let pillX = 0.25;
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
      fontFace: FONT, fontSize: 11, bold: true, color: "B91C1C", valign: "middle",
    });
    pillX += w + 0.15;
  }

  // ---- Commentary card ----
  const commentY = pillY + (D.holidays.length ? 0.48 : 0.0);
  const commentH = 7.3 - commentY - 0.1;
  s.addShape("roundRect", {
    x: 0.25, y: commentY, w: 12.85, h: commentH, rectRadius: 0.08,
    fill: { color: "F4F7FF" }, line: { color: "CADCFC", width: 0.75 },
  });
  s.addText("COMMENTARY", {
    x: 0.40, y: commentY + 0.05, w: 12.6, h: 0.28,
    fontFace: FONT, fontSize: 10, bold: true, color: C.muted, charSpacing: 4,
  });
  s.addText(D.commentary || "", {
    x: 0.40, y: commentY + 0.36, w: 12.6, h: commentH - 0.42,
    fontFace: FONT, fontSize: 14, color: C.text, valign: "top", paraSpaceAfter: 4, wrap: true,
  });
}

function slideSalesByQuantity(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  const last = input.months[input.months.length - 1];
  // Bold + underlined title — mirrors the HQ deck's slide heading.
  s.addText("5. Sales Quantity – " + monthShort(last.month).toUpperCase() + " " + last.year, {
    x: 0.25, y: 0.12, w: 12.8, h: 0.55,
    fontFace: FONT, fontSize: 24, bold: true, color: C.text,
    underline: { style: "sng", color: C.text },
  });

  // Prior-month lookup (FEB when looking at MAR). Try `input.months[0]` first for the
  // combined-month case, then the context list the export route provides.
  const priorMonth = last.month === 1 ? 12 : last.month - 1;
  const priorYear  = last.month === 1 ? last.year - 1 : last.year;
  const prior = input.months.length === 2
    ? input.months[0]
    : input.context?.find(m => m.year === priorYear && m.month === priorMonth);

  const priorRowMap = new Map((prior?.salesByQuantity?.rows ?? []).map(r => [r.product, r]));

  // YTD Total across every 2026 month on file up to and including `last`.
  const ytdMonths = (input.context ?? input.months).filter(
    m => m.year === last.year && m.month <= last.month,
  );
  const ytdMap = new Map<string, number>();
  for (const m of ytdMonths) {
    for (const r of m.salesByQuantity?.rows ?? []) {
      ytdMap.set(r.product, (ytdMap.get(r.product) ?? 0) + r.qty2026);
    }
  }

  // Top-4 contributor products — drawn in red to match the HQ slide accent.
  const topSet = new Set((last.topProducts?.rows ?? []).slice(0, 4).map(r => r.product.toLowerCase()));
  const RED = "C00000";

  const products = last.salesByQuantity?.rows ?? [];
  const prevShort = monthShort(priorMonth);
  const currShort = monthShort(last.month);

  // Header — single row, each year/month combined into one cell to keep pptxgenjs happy.
  // Current-month 2026 cell gets the green HQ highlight.
  const headerFill2026 = { color: C.header };
  const headerFillCurr = { color: "70AD47" };
  const headerText: PptxGenJS.TextPropsOptions = { bold: true, color: "FFFFFF", fontFace: FONT };
  const headerTextDark: PptxGenJS.TextPropsOptions = { bold: true, color: "1F3864", fontFace: FONT };

  const header: PptxGenJS.TableCell[] = [
    { text: "Product", options: { ...headerText, valign: "middle", fill: headerFill2026, align: "left" } },
    { text: `${prevShort}\n2026`, options: { ...headerText, align: "center", fill: headerFill2026 } },
    { text: `${prevShort}\n2025`, options: { ...headerText, align: "center", fill: headerFill2026 } },
    { text: `${currShort}\n2026`, options: { ...headerTextDark, align: "center", fill: headerFillCurr } },
    { text: `${currShort}\n2025`, options: { ...headerText, align: "center", fill: headerFill2026 } },
    { text: `Total 2026\nJan~${currShort}`, options: { ...headerText, valign: "middle", align: "right", fill: headerFill2026 } },
  ];

  const rows: PptxGenJS.TableCell[][] = [header];

  const fmt = (n: number) => (n === 0 ? "" : n.toLocaleString("en-US"));

  let totPrev26 = 0, totPrev25 = 0, totCurr26 = 0, totCurr25 = 0, totYtd = 0;

  for (const r of products) {
    const priorR = priorRowMap.get(r.product);
    const prev26 = priorR?.qty2026 ?? 0;
    const prev25 = priorR?.qty2025 ?? 0;
    const ytd    = ytdMap.get(r.product) ?? 0;
    totPrev26 += prev26; totPrev25 += prev25;
    totCurr26 += r.qty2026; totCurr25 += r.qty2025; totYtd += ytd;

    const isTop = topSet.has(r.product.toLowerCase());
    const labelColor = isTop ? RED : C.text;
    const labelBold = isTop;
    const highlightFill = { color: "E2EFDA" };  // green tint on current-month 2026

    rows.push([
      { text: r.product, options: { fontFace: FONT, color: labelColor, bold: labelBold } },
      { text: fmt(prev26), options: { fontFace: FONT, align: "right", color: C.text } },
      { text: fmt(prev25), options: { fontFace: FONT, align: "right", color: C.muted } },
      { text: fmt(r.qty2026), options: { fontFace: FONT, align: "right", color: labelColor, bold: labelBold, fill: highlightFill } },
      { text: fmt(r.qty2025), options: { fontFace: FONT, align: "right", color: C.muted } },
      { text: fmt(ytd), options: { fontFace: FONT, align: "right", color: labelColor, bold: true } },
    ]);
  }

  rows.push([
    { text: "Total", options: { fontFace: FONT, bold: true, fill: headerFill2026, color: "FFFFFF" } },
    { text: fmt(totPrev26), options: { fontFace: FONT, align: "right", bold: true, fill: headerFill2026, color: "FFFFFF" } },
    { text: fmt(totPrev25), options: { fontFace: FONT, align: "right", bold: true, fill: headerFill2026, color: "FFFFFF" } },
    { text: fmt(totCurr26), options: { fontFace: FONT, align: "right", bold: true, fill: headerFillCurr, color: "1F3864" } },
    { text: fmt(totCurr25), options: { fontFace: FONT, align: "right", bold: true, fill: headerFill2026, color: "FFFFFF" } },
    { text: fmt(totYtd), options: { fontFace: FONT, align: "right", bold: true, fill: headerFill2026, color: "FFFFFF" } },
  ]);

  // 29 products + 1 header + 1 total = 31 rows. Slide h 7.5 - title 0.75 ≈ 6.7in available.
  // Leave ~0.7in at the bottom for an optional commentary runs block.
  const hasCommentary = !!(input.months[input.months.length - 1].salesByQuantity?.commentary ?? "").replace(/<[^>]*>/g, "").trim();
  s.addTable(rows, {
    x: 0.25, y: 0.82, w: 12.85, h: hasCommentary ? 5.8 : 6.48,
    fontFace: FONT, fontSize: 9.5,
    colW: [4.35, 1.45, 1.45, 1.75, 1.45, 2.40],
    border: { type: "solid", pt: 0.5, color: C.tableBorder },
    autoPage: false,
  });
  if (hasCommentary) {
    const runs = htmlToPptxRuns(input.months[input.months.length - 1].salesByQuantity?.commentary, 11);
    s.addText(runs, { x: 0.25, y: 6.70, w: 12.85, h: 0.72, fontFace: FONT, color: C.text, valign: "top", wrap: true });
  }
}

function slideTopProducts(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  titleBar(s, `6. Sales by Product – ${titleFor(input.months)}`, 0.29, 0.14, 11.5, 0.58, 22);
  s.addText(`*1 MYR = ${input.months[input.months.length - 1].fxRate} JPY`, {
    x: 9.27, y: 0.43, w: 2.95, h: 0.37, fontFace: FONT, fontSize: 12, italic: true, color: C.muted,
  });

  const placeTable = (month: typeof input.months[number], x: number, w: number) => {
    const rows: PptxGenJS.TableCell[][] = [[
      { text: `Product (${monthShort(month.month)})`, options: { bold: true, fill: headerFill(), color: C.headerText } },
      { text: "MYR", options: { bold: true, align: "right", fill: headerFill(), color: C.headerText } },
      { text: "%", options: { bold: true, align: "right", fill: headerFill(), color: C.headerText } },
      { text: "JPY", options: { bold: true, align: "right", fill: headerFill(), color: C.headerText } },
    ]];
    const top = (month.topProducts?.rows ?? []).slice(0, 16);
    top.forEach((r, i) => {
      const zebra = i % 2 === 0 ? { fill: { color: C.rowAlt } } : {};
      rows.push([
        { text: r.product, options: { ...zebra } },
        { text: fmtMYR(r.myr, 0), options: { ...zebra, align: "right" } },
        { text: fmtPct(r.pct, 1), options: { ...zebra, align: "right" } },
        { text: fmtJPY(r.myr * month.fxRate), options: { ...zebra, align: "right" } },
      ]);
    });
    s.addTable(rows, { x, y: 1.0, w, h: 5.5, fontFace: FONT, fontSize: 14, border: { type: "solid", pt: 0.5, color: C.tableBorder } });
  };

  if (input.months.length === 2) {
    placeTable(input.months[0], 0.24, 6.0);
    placeTable(input.months[1], 6.80, 6.0);
  } else {
    placeTable(input.months[0], 0.86, 11.77);
  }

  // Optional commentary below the table.
  const commentary = input.months[input.months.length - 1].topProducts?.commentary ?? "";
  if (commentary.replace(/<[^>]*>/g, "").trim()) {
    s.addText(htmlToPptxRuns(commentary, 12), {
      x: 0.86, y: 6.60, w: 11.77, h: 0.82, fontFace: FONT, color: C.text, valign: "top", wrap: true,
    });
  }
}

function slideSalesByECP(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  titleBar(s, `7. Sales by ECP – ${titleFor(input.months)}`, 0.96, 0.34, 11.5, 0.74, 22);

  const placeTable = (month: typeof input.months[number], y: number) => {
    const rows: PptxGenJS.TableCell[][] = [[
      { text: `ECP (${monthShort(month.month)})`, options: { bold: true, fill: headerFill(), color: C.headerText } },
      { text: "Outlets", options: { bold: true, align: "right", fill: headerFill(), color: C.headerText } },
      { text: "%", options: { bold: true, align: "right", fill: headerFill(), color: C.headerText } },
      { text: "Sales (JPY)", options: { bold: true, align: "right", fill: headerFill(), color: C.headerText } },
      { text: "Sales (MYR)", options: { bold: true, align: "right", fill: headerFill(), color: C.headerText } },
    ]];
    const data = month.salesByECP?.rows ?? ECP_CATEGORIES.map(category => ({ category, outlets: 0, pct: 0, salesMyr: 0 }));
    data.forEach((r, i) => {
      const zebra = i % 2 === 0 ? { fill: { color: C.rowAlt } } : {};
      rows.push([
        { text: r.category, options: { ...zebra } },
        { text: String(r.outlets), options: { ...zebra, align: "right" } },
        { text: fmtPct(r.pct, 0), options: { ...zebra, align: "right" } },
        { text: fmtJPY(r.salesMyr * month.fxRate), options: { ...zebra, align: "right" } },
        { text: `MYR ${fmtMYR(r.salesMyr, 0)}`, options: { ...zebra, align: "right" } },
      ]);
    });
    s.addTable(rows, { x: 0.96, y, w: 11.11, h: 2.9, fontFace: FONT, fontSize: 16, border: { type: "solid", pt: 0.5, color: C.tableBorder } });
  };
  if (input.months.length === 2) {
    placeTable(input.months[0], 1.15);
    placeTable(input.months[1], 3.35);
  } else {
    placeTable(input.months[0], 1.62);
  }

  // Commentary — plenty of free room on this slide (table ends ~4.52), so we get a comfortable block.
  const commentary = input.months[input.months.length - 1].salesByECP?.commentary ?? "";
  if (commentary.replace(/<[^>]*>/g, "").trim()) {
    s.addText(htmlToPptxRuns(commentary, 13), {
      x: 0.96, y: 4.90, w: 11.11, h: 2.3, fontFace: FONT, color: C.text, valign: "top", wrap: true, paraSpaceAfter: 4,
    });
  }
}

function slideSalesByRegion(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  const last = input.months[input.months.length - 1];
  titleBar(s, `8. Sales by Region – ${titleFor(input.months)}`, 0.47, 0.25, 11.5, 0.73, 22);

  const rows: PptxGenJS.TableCell[][] = [[
    { text: "Region", options: { bold: true, fill: headerFill(), color: C.headerText } },
    { text: `Sales in ${monthShort(last.month)} ${last.year}`, options: { bold: true, align: "right", fill: headerFill(), color: C.headerText } },
    { text: `Sales in ${monthShort((last.month - 1) || 12)} ${last.month === 1 ? last.year - 1 : last.year}`, options: { bold: true, align: "right", fill: headerFill(), color: C.headerText } },
    { text: "Growth %", options: { bold: true, align: "right", fill: headerFill(), color: C.headerText } },
  ]];
  const data = last.salesByRegion?.rows ?? REGIONS.map(region => ({ region, salesThis: 0, salesPrev: 0, growthPct: 0 }));
  data.forEach((r, i) => {
    const zebra = i % 2 === 0 ? { fill: { color: C.rowAlt } } : {};
    rows.push([
      { text: r.region, options: { ...zebra } },
      { text: fmtMYR(r.salesThis, 0), options: { ...zebra, align: "right" } },
      { text: fmtMYR(r.salesPrev, 0), options: { ...zebra, align: "right" } },
      { text: fmtPct(r.growthPct, 2), options: { ...zebra, align: "right", color: r.growthPct >= 0 ? C.positive : C.negative } },
    ]);
  });
  const total = data.reduce((s, r) => s + r.salesThis, 0);
  const totalPrev = data.reduce((s, r) => s + r.salesPrev, 0);
  rows.push([
    { text: "Total", options: { bold: true, fill: headerFill(), color: C.headerText } },
    { text: fmtMYR(total, 0), options: { bold: true, align: "right", fill: headerFill(), color: C.headerText } },
    { text: fmtMYR(totalPrev, 0), options: { bold: true, align: "right", fill: headerFill(), color: C.headerText } },
    { text: "", options: { fill: headerFill() } },
  ]);

  s.addTable(rows, { x: 0.69, y: 1.35, w: 11.70, h: 3.8, fontFace: FONT, fontSize: 15, border: { type: "solid", pt: 0.5, color: C.tableBorder } });

  s.addText(last.salesByRegion?.commentary ?? "", {
    x: 0.92, y: 5.35, w: 11.22, h: 2.0, fontFace: FONT, fontSize: 14, color: C.text, valign: "top",
  });
}

function slideProductRegistration(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  titleBar(s, "9. Product Registration in Progress", 0.20, 0.28, 11.5, 0.68, 22);

  const last = input.months[input.months.length - 1];
  const headers = ["Product", "Class", "Start Date", "Doc Overseas", "CAB Assessment", "MDA Submission", "MDA Process", "Completion", "MDA Approval No"];
  const rows: PptxGenJS.TableCell[][] = [headers.map(h => ({ text: h, options: { bold: true, fill: headerFill(), color: C.headerText, fontSize: 12 } }))];
  const data = last.productRegistration?.rows ?? [];
  data.forEach((r, i) => {
    const zebra = i % 2 === 0 ? { fill: { color: C.rowAlt } } : {};
    rows.push([
      { text: r.product, options: { ...zebra } },
      { text: r.class, options: { ...zebra } },
      { text: r.startDate, options: { ...zebra } },
      { text: r.docOverseas, options: { ...zebra } },
      { text: r.cabAssessment, options: { ...zebra } },
      { text: r.mdaSubmission, options: { ...zebra } },
      { text: r.mdaProcess, options: { ...zebra } },
      { text: r.completionDate, options: { ...zebra } },
      { text: r.mdaApprovalNo, options: { ...zebra } },
    ]);
  });
  s.addTable(rows, { x: 0.36, y: 1.20, w: 12.62, h: 5.5, fontFace: FONT, fontSize: 13, border: { type: "solid", pt: 0.5, color: C.tableBorder } });
}

function slideInventory(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  titleBar(s, `10. Inventory Situation – ${monthShort(input.months[input.months.length - 1].month)} ${input.months[input.months.length - 1].year}`, 0.25, 0.27, 11.5, 0.52, 22);

  const last = input.months[input.months.length - 1];
  const inv = last.inventory;
  const rows: PptxGenJS.TableCell[][] = [];
  if (inv) {
    for (const g of inv.groups) {
      rows.push([
        { text: g.name, options: { bold: true, fill: headerFill(), color: C.headerText, colspan: 7, align: "left" } } as PptxGenJS.TableCell,
      ]);
      const header: PptxGenJS.TableCell[] = [{ text: "", options: {} }];
      for (let i = 0; i < 6; i++) {
        const prod = g.rows[i]?.product ?? "";
        header.push({ text: prod, options: { bold: true, align: "center", fontSize: 11 } });
      }
      rows.push(header);
      for (const loc of ["warehouse", "consignment"] as const) {
        const r: PptxGenJS.TableCell[] = [{ text: loc === "warehouse" ? "Warehouse" : "Consignment", options: { italic: true, fontSize: 11 } }];
        for (let i = 0; i < 6; i++) {
          const v = g.rows[i]?.[loc];
          // Centered + slightly bigger number cells to match the dashboard view,
          // but capped at 13pt so 6-digit values like "57,339" fit the 1.0" column.
          r.push({
            text: v == null ? "" : fmtMYR(v, 0),
            options: { align: "center", bold: true, fontSize: 13, color: C.text },
          });
        }
        rows.push(r);
      }
    }
  } else {
    for (const g of INVENTORY_GROUPS) {
      rows.push([
        { text: g.name, options: { bold: true, fill: headerFill(), color: C.headerText, colspan: 7 } } as PptxGenJS.TableCell,
      ]);
      rows.push([{ text: "" }, ...g.products.slice(0, 6).map(p => ({ text: p, options: { bold: true, fontSize: 13 } }) as PptxGenJS.TableCell)]);
    }
  }
  s.addTable(rows, { x: 0.20, y: 1.05, w: 12.98, h: 4.6, fontFace: FONT, fontSize: 14, border: { type: "solid", pt: 0.5, color: C.tableBorder }, valign: "middle" });

  s.addText(
    [
      { text: `Warehouse Total: ${fmtMYR(inv?.totalWarehouse ?? 0, 0)}`, options: { bold: true } },
      { text: `Consignment Total: ${fmtMYR(inv?.totalConsignment ?? 0, 0)}`, options: { bold: true } },
      { text: inv?.commentary ?? "", options: {} },
    ],
    { x: 0.20, y: 5.85, w: 12.78, h: 1.5, fontFace: FONT, fontSize: 14, color: C.text, valign: "top" },
  );
}

function slideExpireWriteOff(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  titleBar(s, "11. Expire Stock – Monthly Write-Off Activity", 0.36, 0.40, 11.5, 0.46, 22);

  // Cumulative view: every month in the current year up to the latest selected month.
  // Falls back to input.months when context isn't available.
  const lastSel = input.months[input.months.length - 1];
  const currentIds = new Set(input.months.map(m => m.id));
  const contextMonths = (input.context ?? input.months)
    .filter(m => m.year === lastSel.year && m.month <= lastSel.month)
    .sort((a, b) => a.month - b.month);
  const months = contextMonths.length ? contextMonths : input.months;

  // Yellow highlight for the currently-selected month(s) — matches editor + preview.
  const HL_FILL = "F9E795";
  const HL_TEXT = "141A3D";
  const headCurrFill = { color: HL_FILL };
  const headCurrText = HL_TEXT;

  const headers: PptxGenJS.TableCell[] = [{
    text: "Expire Write-Off Activity",
    options: { bold: true, fill: headerFill(), color: C.headerText, rowspan: 2, valign: "middle" },
  }];
  for (const m of months) {
    const curr = currentIds.has(m.id);
    headers.push({
      text: `${monthShort(m.month)}-${String(m.year).slice(-2)}`,
      options: {
        bold: true, colspan: 2, align: "center",
        fill: curr ? headCurrFill : headerFill(),
        color: curr ? headCurrText : C.headerText,
      },
    });
  }
  headers.push({
    text: "Total Write-Off",
    options: { bold: true, colspan: 2, align: "center", fill: headerFill(), color: C.headerText },
  });

  const subHead: PptxGenJS.TableCell[] = [{ text: "" }];
  for (const m of months) {
    const curr = currentIds.has(m.id);
    const bg = curr ? headCurrFill : { color: C.rowAlt };
    const fg = curr ? HL_TEXT : C.text;
    subHead.push({ text: "QUANTITY", options: { bold: true, align: "center", fill: bg, color: fg, fontSize: 11 } });
    subHead.push({ text: "AMOUNT",   options: { bold: true, align: "center", fill: bg, color: fg, fontSize: 11 } });
  }
  subHead.push({ text: "QUANTITY", options: { bold: true, align: "center", fill: { color: C.rowAlt }, fontSize: 11 } });
  subHead.push({ text: "AMOUNT",   options: { bold: true, align: "center", fill: { color: C.rowAlt }, fontSize: 11 } });

  const allProducts = new Set<string>();
  for (const m of months) for (const r of m.expireWriteOff?.rows ?? []) allProducts.add(r.product);

  const productRows: PptxGenJS.TableCell[][] = [];
  for (const p of [...allProducts].sort()) {
    const r: PptxGenJS.TableCell[] = [{ text: p, options: { bold: true } }];
    let rowQ = 0, rowA = 0;
    for (const m of months) {
      const match = m.expireWriteOff?.rows.find(x => x.product === p);
      const curr = currentIds.has(m.id);
      const bg = curr ? { color: "FDF4C7" } : undefined;   // lighter yellow band for body rows
      rowQ += match?.qty ?? 0; rowA += match?.amt ?? 0;
      r.push({ text: match?.qty ? String(match.qty) : "", options: { align: "center", bold: curr, ...(bg ? { fill: bg } : {}) } });
      r.push({ text: match?.amt ? fmtMYR(match.amt, 0) : "", options: { align: "center", bold: curr, ...(bg ? { fill: bg } : {}) } });
    }
    r.push({ text: rowQ ? String(rowQ) : "", options: { align: "center", bold: true } });
    r.push({ text: rowA ? fmtMYR(rowA, 0) : "", options: { align: "center", bold: true } });
    productRows.push(r);
  }

  const totalRow: PptxGenJS.TableCell[] = [{ text: "Total", options: { bold: true, fill: headerFill(), color: C.headerText } }];
  let grandQ = 0, grandA = 0;
  for (const m of months) {
    const sumQ = (m.expireWriteOff?.rows ?? []).reduce((s, r) => s + r.qty, 0);
    const sumA = (m.expireWriteOff?.rows ?? []).reduce((s, r) => s + r.amt, 0);
    grandQ += sumQ; grandA += sumA;
    const curr = currentIds.has(m.id);
    const fill = curr ? headCurrFill : headerFill();
    const color = curr ? HL_TEXT : C.headerText;
    totalRow.push({ text: String(sumQ), options: { align: "center", bold: true, fill, color } });
    totalRow.push({ text: fmtMYR(sumA, 0), options: { align: "center", bold: true, fill, color } });
  }
  totalRow.push({ text: String(grandQ), options: { align: "center", bold: true, fill: headerFill(), color: C.headerText } });
  totalRow.push({ text: fmtMYR(grandA, 0), options: { align: "center", bold: true, fill: headerFill(), color: C.headerText } });

  s.addTable([headers, subHead, ...productRows, totalRow], {
    x: 0.30, y: 1.10, w: 12.73, h: 6.00, fontFace: FONT, fontSize: 11,
    border: { type: "solid", pt: 0.5, color: C.tableBorder },
    valign: "middle",
  });
}

function slideFinancial(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  titleBar(s, "12. Financial Relationship", 0.92, 0.35, 11.5, 0.52, 22);

  const months = input.months;
  const headers: PptxGenJS.TableCell[] = [{ text: "Item", options: { bold: true, fill: headerFill(), color: C.headerText } }];
  for (const m of months) {
    headers.push({ text: `${monthShort(m.month)} (JPY)`, options: { bold: true, align: "right", fill: headerFill(), color: C.headerText } });
    headers.push({ text: `${monthShort(m.month)} (MYR)`, options: { bold: true, align: "right", fill: headerFill(), color: C.headerText } });
  }

  const rowFor = (label: string, pick: (f: NonNullable<typeof months[0]["financial"]>) => number, negative = false): PptxGenJS.TableCell[] => {
    const r: PptxGenJS.TableCell[] = [{ text: label, options: { bold: true } }];
    for (const m of months) {
      const f = m.financial;
      if (!f) { r.push({ text: "—" }); r.push({ text: "—" }); continue; }
      const myr = safeNum(pick(f));
      const jpy = myr * m.fxRate;
      r.push({ text: fmtJPY(jpy), options: { align: "right", color: negative && myr < 0 ? C.negative : C.text } });
      r.push({ text: fmtMYR(myr, 0), options: { align: "right", color: negative && myr < 0 ? C.negative : C.text } });
    }
    return r;
  };

  const rows: PptxGenJS.TableCell[][] = [
    headers,
    rowFor("Account Receivable Aging", f => f.arMyr),
    rowFor("180-365 days long-term",    f => f.arLongTermMyr),
    rowFor("Account Payable",           f => f.apMyr),
    rowFor("Collection",                f => f.collectionMyr),
    rowFor("Cash Flow",                 f => f.cashFlowMyr),
  ];
  s.addTable(rows, { x: 0.92, y: 1.20, w: 11.50, h: 4.8, fontFace: FONT, fontSize: 16, border: { type: "solid", pt: 0.5, color: C.tableBorder } });
}

function slideOtherMarket(pptx: PptxGenJS, input: PptxInput) {
  const s = pptx.addSlide();
  titleBar(s, "13. Other Market Information", 0.60, 0.30, 10, 0.75, 22);
  const o = input.months[input.months.length - 1].otherMarket;
  if (o?.imagePaths[0]) {
    try { s.addImage({ path: brandImagePath(o.imagePaths[0]), x: 0.92, y: 1.66, w: 6.5, h: 4.76 }); } catch { /* */ }
  }
  const runs = htmlToPptxRuns(o?.body, 15);
  s.addText(runs.length ? runs : [{ text: "", options: { fontSize: 15 } }], {
    x: 7.5, y: 1.66, w: 5.5, h: 5.5, fontFace: FONT, color: C.text, valign: "top", paraSpaceAfter: 6, wrap: true,
  });
}

// Appendix — the deck's closing reference page. Skipped entirely when the
// appendix body is empty so a deck without one doesn't gain a blank slide.
function slideAppendix(pptx: PptxGenJS, input: PptxInput) {
  const a = input.months[input.months.length - 1].appendix;
  const plain = (a?.body ?? "").replace(/<[^>]*>/g, "").trim();
  if (!plain) return;
  const s = pptx.addSlide();
  titleBar(s, "Appendix", 0.60, 0.30, 11.5, 0.52, 22);
  const runs = htmlToPptxRuns(a?.body, 15);
  s.addText(runs.length ? runs : [{ text: "", options: { fontSize: 15 } }], {
    x: 0.92, y: 1.30, w: 11.50, h: 5.6, fontFace: FONT, color: C.text, valign: "top", paraSpaceAfter: 6, wrap: true,
  });
}

function slideThankYou(pptx: PptxGenJS) {
  const s = pptx.addSlide();
  try { s.addImage({ path: brandImagePath("thankyou.jpg"), x: 0.47, y: 0.46, w: 3.31, h: 1.72 }); } catch { /* */ }
  s.addText("Thank you!", {
    x: 3.57, y: 3.09, w: 6.19, h: 1.31,
    fontFace: FONT, fontSize: 72, bold: true, color: C.header, align: "center",
  });
}
