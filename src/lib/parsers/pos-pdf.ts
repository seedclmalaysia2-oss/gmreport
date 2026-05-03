// Parser for the SEED POS "Stock Sales Analysis" reports.
// Input: .pdf file bytes; Output: normalised row records.
//
// Two schemas are supported, both detected from header text:
//   1. "Summary By Group"           (master monthly dump)
//   2. "Grouping vs Monthly Summary" (per-colour MCUV breakdown — BLUE/ORANGE/PEGA)

import { lookupProduct, MCUV_FILE_TO_PRODUCT } from "@/lib/catalog/sku-map";

export interface PosMasterRow {
  code: string;         // raw group code (incl. suffix)
  baseCode: string;     // stripped of PRM/TR/FC/T
  suffix: string | null;
  description: string;
  qty: number;
  discount: number;
  netSales: number;
  netCost: number;
  grossProfit: number;
  gpPct: number;
  product: string | null;  // canonical product label if mapped
}

export interface PosMasterParseResult {
  kind: "master";
  periodStart: string | null;  // YYYY-MM-DD
  periodEnd: string | null;
  rows: PosMasterRow[];
  grandTotal: { qty: number; netSales: number };
  unmapped: PosMasterRow[];
}

export interface PosMcuvParseResult {
  kind: "mcuv";
  variant: "BLUE" | "ORANGE" | "PEGA" | "OTHER";
  periodStart: string | null;
  periodEnd: string | null;
  items: { code: string; description: string; qty: number; amt: number }[];
  grandTotal: { qty: number; amt: number };
  canonicalProduct: string | null;
}

export interface PosWriteOffRow {
  productDesc: string;
  qty: number;
  totalCost: number;
}

export interface PosWriteOffEvent {
  writeOffNo: string;
  date: string | null;        // YYYY-MM-DD
  monthKey: string | null;    // YYYY-MM
  rows: PosWriteOffRow[];
  totalQty: number;
  totalAmt: number;
}

export interface PosWriteOffParseResult {
  kind: "writeoff";
  events: PosWriteOffEvent[];
}

export type PosParseResult = PosMasterParseResult | PosMcuvParseResult | PosWriteOffParseResult | { kind: "unknown"; text: string };

// Turn raw PDF bytes into a plain text string using pdfjs-dist (no native deps).
async function pdfToText(buf: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const loadingTask = pdfjs.getDocument({ data: buf, useSystemFonts: true, isEvalSupported: false });
  const doc = await loadingTask.promise;
  const lines: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Group items by their y-coordinate to rebuild lines.
    const grouped: Record<number, { x: number; str: string }[]> = {};
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      (grouped[y] ??= []).push({ x, str: item.str });
    }
    const ys = Object.keys(grouped).map(Number).sort((a, b) => b - a);
    for (const y of ys) {
      grouped[y].sort((a, b) => a.x - b.x);
      lines.push(grouped[y].map(p => p.str).join(" ").replace(/\s+/g, " ").trim());
    }
    lines.push("");
  }
  return lines.join("\n");
}

function parseDateRange(text: string): { start: string | null; end: string | null } {
  const m = text.match(/Date\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*To\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (!m) return { start: null, end: null };
  const toISO = (dmy: string) => {
    const [d, mo, y] = dmy.split("/").map(Number);
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  return { start: toISO(m[1]), end: toISO(m[2]) };
}

function num(s: string): number {
  const cleaned = s.replace(/,/g, "").replace(/\s/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseMaster(text: string): PosMasterParseResult {
  const { start, end } = parseDateRange(text);
  const lines = text.split("\n");
  const rows: PosMasterRow[] = [];
  const unmapped: PosMasterRow[] = [];
  let grandQty = 0, grandNet = 0;

  const rowRe = /^([A-Z0-9][A-Z0-9\-+]*)\s+(.+?)\s+([\d,]+)\s+([\d,\.-]+)\s+([\d,\.-]+)\s+([\d,\.-]+)\s+([\d,\.-]+)\s+([\d,\.-]+)\s*$/;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^Grand\s+Total\b/i.test(line)) {
      const parts = line.split(/\s+/);
      const nums = parts.map(num).filter(n => n > 0);
      if (nums.length >= 2) {
        grandQty = nums[0];
        grandNet = nums[2] ?? nums[1];
      }
      continue;
    }
    const m = line.match(rowRe);
    if (!m) continue;
    const [, code, description, qty, disc, net, cost, gp, gpp] = m;
    const { product, suffix } = lookupProduct(code);
    const baseCode = suffix ? code.slice(0, -suffix.length) : code;
    const row: PosMasterRow = {
      code, baseCode, suffix,
      description: description.trim(),
      qty: Math.round(num(qty)),
      discount: num(disc),
      netSales: num(net),
      netCost: num(cost),
      grossProfit: num(gp),
      gpPct: num(gpp),
      product,
    };
    rows.push(row);
    if (!product) unmapped.push(row);
  }

  if (!grandQty) {
    grandQty = rows.reduce((s, r) => s + r.qty, 0);
    grandNet = rows.reduce((s, r) => s + r.netSales, 0);
  }

  return {
    kind: "master",
    periodStart: start,
    periodEnd: end,
    rows,
    grandTotal: { qty: grandQty, netSales: grandNet },
    unmapped,
  };
}

function parseMcuv(text: string, fileHint: string): PosMcuvParseResult {
  const { start, end } = parseDateRange(text);
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const items: PosMcuvParseResult["items"] = [];

  // Layout (per observation): many triplets like
  //   "Amt 5,996.65 5,996.65"
  //   "MCFB Monthly Color UV F.Brown"
  //   "Qty 171 171"
  let grandQty = 0, grandAmt = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const amtMatch = l.match(/^Amt(?:\s|$)(.*)$/i);
    if (!amtMatch) continue;
    const amtNums = amtMatch[1].split(/\s+/).map(num).filter(n => !isNaN(n));
    const codeLine = lines[i + 1] ?? "";
    const qtyLine = lines[i + 2] ?? "";
    const codeM = codeLine.match(/^([A-Z0-9\-]+)\s+(.+)$/);
    const qtyM = qtyLine.match(/^Qty(?:\s|$)(.*)$/i);
    if (!codeM || !qtyM) continue;
    const qtyNums = qtyM[1].split(/\s+/).map(num).filter(n => !isNaN(n));
    const amt = amtNums[amtNums.length - 1] ?? 0;
    const qty = Math.round(qtyNums[qtyNums.length - 1] ?? 0);
    items.push({ code: codeM[1], description: codeM[2], qty, amt });
    i += 2;
  }
  const grandTotalLineIdx = lines.findIndex(l => /^Grand\s+Total/i.test(l));
  if (grandTotalLineIdx >= 0) {
    // Grand Total Amt and Qty usually appear directly nearby
    for (let j = grandTotalLineIdx - 2; j <= grandTotalLineIdx + 4 && j < lines.length; j++) {
      if (j < 0) continue;
      const amtM = lines[j].match(/^Amt\s+(.+)$/i);
      const qtyM = lines[j].match(/^Qty\s+(.+)$/i);
      if (amtM) {
        const parts = amtM[1].split(/\s+/).map(num).filter(n => !isNaN(n));
        if (parts.length) grandAmt = parts[parts.length - 1];
      }
      if (qtyM) {
        const parts = qtyM[1].split(/\s+/).map(num).filter(n => !isNaN(n));
        if (parts.length) grandQty = Math.round(parts[parts.length - 1]);
      }
    }
  }
  if (!grandQty) grandQty = items.reduce((s, r) => s + r.qty, 0);
  if (!grandAmt) grandAmt = items.reduce((s, r) => s + r.amt, 0);

  const variantGuess: PosMcuvParseResult["variant"] =
    /BLUE/i.test(fileHint)   ? "BLUE"
  : /ORANGE/i.test(fileHint) ? "ORANGE"
  : /PEGA/i.test(fileHint)   ? "PEGA"
  : "OTHER";

  return {
    kind: "mcuv",
    variant: variantGuess,
    periodStart: start,
    periodEnd: end,
    items,
    grandTotal: { qty: grandQty, amt: grandAmt },
    canonicalProduct: variantGuess === "OTHER" ? null : MCUV_FILE_TO_PRODUCT[variantGuess],
  };
}

function parseWriteOff(text: string): PosWriteOffParseResult {
  const lines = text.split("\n").map(l => l.trim());
  const events: PosWriteOffEvent[] = [];
  let current: PosWriteOffEvent | null = null;
  // Row pattern captures: Item | StockID | Desc+MDA | Power | ExpireYYYYMM | UnitCost | TotalCost | Qty | UOM
  // Example: "46 2406012489 Monthly Color UV - NG.GBr8a7y79019-35815 -6.50 202601 8.5000 93.50 11 BOX"
  const rowRe = /^(\d+)\s+([A-Z0-9]+)\s+(.+?)\s+(-?[\d.]+)\s+(\d{6})\s+([\d.]+)\s+([\d.,]+)\s+(\d+)\s+[A-Z]+$/;

  for (const line of lines) {
    const mNo = line.match(/WRITE-OFF NO\s*:\s*(WOFF\d+)/i);
    if (mNo) {
      if (current) events.push(current);
      current = { writeOffNo: mNo[1], date: null, monthKey: null, rows: [], totalQty: 0, totalAmt: 0 };
      continue;
    }
    const mDate = line.match(/DATE\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (mDate && current) {
      current.date = `${mDate[3]}-${mDate[2].padStart(2, "0")}-${mDate[1].padStart(2, "0")}`;
      current.monthKey = `${mDate[3]}-${mDate[2].padStart(2, "0")}`;
      continue;
    }
    const mRow = line.match(rowRe);
    if (mRow && current) {
      const desc = mRow[3]
        .replace(/GB\d{5,}.*$/i, "")
        .replace(/MGEBD\d.*$/i, "")
        .replace(/LGOBW\d.*$/i, "")
        .replace(/SGUBP\d.*$/i, "")
        .replace(/GIBST\d.*$/i, "")
        .replace(/GEB\d.*$/i, "")
        .replace(/MBA\d.*$/i, "")
        .trim();
      current.rows.push({
        productDesc: desc || mRow[3].trim(),
        qty: Number(mRow[8]) || 0,
        totalCost: Number(mRow[7].replace(/,/g, "")) || 0,
      });
    }
  }
  if (current) events.push(current);
  for (const ev of events) {
    ev.totalQty = ev.rows.reduce((s, r) => s + r.qty, 0);
    ev.totalAmt = ev.rows.reduce((s, r) => s + r.totalCost, 0);
  }
  return { kind: "writeoff", events };
}

export async function parsePosPdf(bytes: Uint8Array, fileHint = ""): Promise<PosParseResult> {
  const text = await pdfToText(bytes);
  if (/STOCK\s+WRITE-OFF/i.test(text)) return parseWriteOff(text);
  if (/Summary\s+By\s+Group/i.test(text)) return parseMaster(text);
  if (/Grouping\s+vs\s+Monthly\s+Summary/i.test(text) || /By\s+Brand\s+Description/i.test(text)) {
    return parseMcuv(text, fileHint);
  }
  return { kind: "unknown", text: text.slice(0, 2000) };
}
