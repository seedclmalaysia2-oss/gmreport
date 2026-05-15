// Additional POS Excel parsers — inventory, collection, daily sales.
// Calibrated against the real exports shared for March 2026.

import * as XLSX from "xlsx";
import type { CanonicalProduct } from "@/lib/catalog/products";
import { lookupProduct } from "@/lib/catalog/sku-map";

// ---------- Stock list (inventory at month end) ----------
export interface StockRow {
  stockId: string;
  description: string;
  balance: number;
  expiryYm: string | null;   // YYYYMM as string
  totalCost: number;
}

export interface StockParseResult {
  asOf: Date | null;
  rows: StockRow[];
  byCanonical: Record<string, number>;   // canonical product -> total balance qty
  byMcuvVariant: Record<"BLUE" | "ORANGE" | "PEGA", number>;
  nearExpiryRows: StockRow[];             // expiring within 3 months of asOf
  grandTotalQty: number;
}

// Map a stock-list description to a canonical product label.
// These patterns are tuned to the real names seen in SCLM export.
function mapStockDescription(desc: string): CanonicalProduct | null {
  const d = desc.trim().toUpperCase();
  if (!d) return null;
  if (d === "1 DAY PURE") return "1dayPureUP (32P)";
  if (d === "1 DAY PURE TORIC") return "1dayPureUP Astig (32P)";
  if (d.startsWith("1 DAY PURE MULTISTAGE")) return "1dayPureUP Multistage (32P)";
  if (d.startsWith("1 DAY PURE EDOF")) return "1dayPureUP EDOF (32P)";
  if (d === "1 DAY PURE VIEW SUPPORT") return "1 Day View Support";
  if (d === "1 DAY PURE SILFA") return "1dayPure Silfa";
  if (d === "2 WEEK PURE UP") return "2weekPure Up (6P)";
  if (d === "2 WEEK PURE UP TORIC") return "2weekPure Up Toric";
  if (d.startsWith("2 WEEK PURE MULTISTAGE")) return "2weekPure Multistage (6P)";
  if (d.startsWith("EC") && /\d\d?-M/.test(d) && !d.includes("TORIC")) return "Eye coffret-M";
  if (d.startsWith("EYE COFFRET-M TORIC 10")) return "Eye Coffret-M 10 Toric";
  if (d.startsWith("EYE COFFRET-M TORIC 30")) return "Eye Coffret-M 30 Toric";
  if (d === "MONTHLY PURE6") return "Monthly Pure 6";
  if (d === "MONTHLY PURE3") return "Monthly Pure 3";
  if (d === "MONTHLY FINE UV PLUS") return "MonthlyFine Plus (3P)";
  if (d.includes("MONTHLY COLOR UV II")) return "MonthlyColour UV II";
  if (d.startsWith("MINASOFT 1DAY")) return "Minasoft 1Day Color UV";
  if (d.startsWith("MINASOFT CARE UV")) return "Minasoft Care UV";
  if (d.startsWith("SEED BOC")) return "Breath O Correct";
  if (d.startsWith("DISOP HIDROHEALTH")) return "DISOP H2O2 Solution";
  if (d.startsWith("DISOP ACUAISS")) return "DISOP Ultra Eyedrop";
  if (d.startsWith("SEED AS LUNA") || d.startsWith("SEED AS-LUNA")) return "As-Luna / O2 Noah";
  if (d.startsWith("SEED UV-1")) return "UV-1 / UV-1 KC";
  if (d.startsWith("SEED SOFT IRIS")) return "Iris Lens";
  if (d.startsWith("WOHLK KE")) return "Wohlk KE RGP";
  if (d.startsWith("UV ") || d.startsWith("UV HYDROWAVE") || d.startsWith("UV KERASOFT") || d.startsWith("UV AVANTI") || d.startsWith("UV DURAWAVE") || d.startsWith("UV SIMPLON") || d.startsWith("UV SPECIALIST")) return "Ultra Vision";
  // Monthly Color UV (colour variants) mapped by sub-case below via mapMcuvVariant()
  return null;
}

// Monthly Colour UV colour → MCUV line (BLUE / ORANGE / PEGA)
function mapMcuvVariant(desc: string): "BLUE" | "ORANGE" | "PEGA" | null {
  const d = desc.trim().toUpperCase();
  if (!d.startsWith("MONTHLY COLOR")) return null;
  if (d.includes("II")) return null;  // handled by canonical mapping as "MonthlyColour UV II"
  // PEGA (older MONTHLY COLOR * names + N.Brown/Gray + Cocoa/Gold/Pink + GrayDarkGray)
  if (/\b(COCOA|GOLD|PINK|DARK GRAY|D\.GRAY|D\.BROWN)\b/.test(d)) return "PEGA";
  if (/\b(G\.BROWN|G\.GRAY)\b/.test(d)) return "PEGA";
  // BLUE colours: Natural, Fire, GLIT
  if (/\b(N\.BROWN|N\.GRAY|FIRE|GLIT)\b/.test(d)) return "BLUE";
  // ORANGE colours: Jade, Spark, Shining Honey
  if (/\b(JADE|SPARK|SHINING)\b/.test(d)) return "ORANGE";
  // Fallback: treat bare MONTHLY COLOR GRAY DARK GRAY / similar as PEGA (old naming)
  if (/MONTHLY COLOR (GRAY|GOLD|PINK|COCOA|BROWN)/.test(d)) return "PEGA";
  return null;
}

export function parseStockListXlsx(buf: ArrayBuffer, asOf?: Date): StockParseResult {
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

  const stock: StockRow[] = [];
  for (const r of rows) {
    const desc = String(r["Stock Description"] ?? r["Description"] ?? "").trim();
    if (!desc || /^total$/i.test(desc)) continue;
    const bal = Number(r["Balance Quantity"] ?? 0);
    if (!bal) continue;
    const exp = r["Expiry Date"] == null ? null : String(r["Expiry Date"]).trim();
    stock.push({
      stockId: String(r["Stock ID"] ?? "").trim(),
      description: desc,
      balance: bal,
      expiryYm: exp,
      totalCost: Number(r["Total Cost"] ?? 0),
    });
  }

  const byCanonical: Record<string, number> = {};
  const byMcuv = { BLUE: 0, ORANGE: 0, PEGA: 0 };
  for (const s of stock) {
    const canonical = mapStockDescription(s.description);
    if (canonical) {
      byCanonical[canonical] = (byCanonical[canonical] ?? 0) + s.balance;
      continue;
    }
    const mcuv = mapMcuvVariant(s.description);
    if (mcuv) byMcuv[mcuv] += s.balance;
  }

  const effectiveAsOf = asOf ?? new Date();
  const cutoff = new Date(effectiveAsOf);
  cutoff.setMonth(cutoff.getMonth() + 3);
  const nearExpiry = stock.filter(s => {
    if (!s.expiryYm || s.expiryYm.length !== 6) return false;
    const y = +s.expiryYm.slice(0, 4), m = +s.expiryYm.slice(4, 6);
    const expDate = new Date(y, m, 0);
    return expDate <= cutoff;
  });

  return {
    asOf: asOf ?? null,
    rows: stock,
    byCanonical,
    byMcuvVariant: byMcuv,
    nearExpiryRows: nearExpiry,
    grandTotalQty: stock.reduce((s, r) => s + r.balance, 0),
  };
}

// ---------- Collection Listing ----------
export interface CollectionParseResult {
  monthStart: Date | null;
  monthEnd: Date | null;
  totalCollectionMyr: number;
  rowCount: number;
}

export function parseCollectionXlsx(buf: ArrayBuffer): CollectionParseResult {
  const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  let start: Date | null = null, end: Date | null = null, total = 0;
  for (const r of rows) {
    const dateRaw = r["Document Date"];
    // Prefer Total Payment Amount, fallback to applied amount.
    const amt = Number(r["Total Payment Amount"] ?? r["Total Applied Amount"] ?? 0);
    if (!amt) continue;
    total += amt;
    if (dateRaw instanceof Date && !isNaN(dateRaw.getTime())) {
      if (!start || dateRaw < start) start = dateRaw;
      if (!end || dateRaw > end) end = dateRaw;
    }
  }
  return {
    monthStart: start,
    monthEnd: end,
    totalCollectionMyr: total,
    rowCount: rows.length,
  };
}

// ---------- Daily Sales Quantity ----------
// Layout: per-customer blocks with header rows. Col A carries `DocumentDate` header, then
// `DD/MM/YYYY` values. Each date row is followed by pairs where col G is the type-flag
// (1 = amount, 2 = qty) and columns H onwards contain per-SKU numbers.
export interface DailySalesDay {
  date: string;        // YYYY-MM-DD
  qty: number;         // total quantity across all SKUs that day
  amount: number;      // total MYR across all SKUs that day
}
export interface DailySalesParseResult {
  days: DailySalesDay[];
  monthStart: string | null;
  monthEnd: string | null;
}

function toIsoDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val).trim();
  // DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

// Convert Excel date serial (days since 1899-12-30) to YYYY-MM-DD.
// Use UTC components so we don't accidentally shift across timezones.
function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// When XLSX returns a Date object (cellDates: true), it represents the
// authored calendar day in LOCAL time. Reading the local-time components
// gives us the same calendar day regardless of the server's timezone.
function dateObjectToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDailySalesXlsx(buf: ArrayBuffer): DailySalesParseResult {
  const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { defval: null, header: 1 });

  // ------------------------------------------------------------------
  // FORMAT B — pre-consolidated daily summary
  //
  // Detect by header row 0: col [1] === "Date" and col [4]+ holding
  // product-level codes (1DMS, 1DPE, …). The cells in this file are ALREADY
  // adjusted for trial-lens divisors and PRM rollups; we trust them as-is.
  // Used by HQ when they share a pre-rolled summary instead of the raw
  // per-SKU file (Format A below).
  // ------------------------------------------------------------------
  const h0 = grid[0];
  if (h0 && typeof h0[1] === "string" && /^date$/i.test(h0[1].trim())) {
    const totalCol = h0.findIndex(c => typeof c === "string" && /^total$/i.test(c.trim()));
    const amtCol = h0.findIndex(c => typeof c === "string" && /^amt$/i.test(c.trim()));
    const productColStart = 4;
    const productColEnd = totalCol > 0 ? totalCol - 1 : 29;

    const days: DailySalesDay[] = [];
    for (let r = 1; r < grid.length; r++) {
      const row = grid[r];
      if (!row) continue;
      // Date sits in col 1 as either an Excel serial (number) or a real Date.
      const cell = row[1];
      let iso: string | null = null;
      if (typeof cell === "number") iso = excelSerialToIso(cell);
      else if (cell instanceof Date) iso = dateObjectToIso(cell);
      else if (typeof cell === "string") iso = toIsoDate(cell);
      if (!iso) continue;

      // The HQ "Daily sales qty <Mmm>YY.xlsx" file uses Sunday rows as the
      // WEEKLY SUBTOTAL of the prior week (Mon–Sat). The Total cell in those
      // rows is not a daily qty and must be skipped to avoid double-counting.
      // Real Sundays show 0 in the manual chart anyway (no trading), so
      // emitting 0 for every Sunday is correct.
      const dow = typeof row[0] === "string" ? row[0].trim().toLowerCase() : "";
      const isSunday = dow.startsWith("sun");

      let qty = 0;
      let amount = 0;
      if (!isSunday) {
        if (totalCol > 0 && typeof row[totalCol] === "number" && Number.isFinite(row[totalCol] as number)) {
          qty = row[totalCol] as number;
        } else {
          for (let c = productColStart; c <= productColEnd; c++) {
            const v = row[c];
            if (typeof v === "number" && Number.isFinite(v)) qty += v;
          }
        }
        if (amtCol > 0 && typeof row[amtCol] === "number" && Number.isFinite(row[amtCol] as number)) {
          amount = row[amtCol] as number;
        }
      }

      days.push({ date: iso, qty: Math.round(qty), amount });
    }
    return {
      days,
      monthStart: days[0]?.date ?? null,
      monthEnd: days.at(-1)?.date ?? null,
    };
  }

  // ------------------------------------------------------------------
  // FORMAT A — raw per-SKU file (Daily Sales Quantity.xlsx)
  // ------------------------------------------------------------------

  // Observed layout:
  //   • A row near the top has col [1] = "DocumentDate" and per-SKU codes in
  //     subsequent columns (e.g. col 8 = "1DMS", col 19 = "1DPETR", …).
  //   • Each date row pair: col [1] = DD/MM/YYYY, col [7] = type flag
  //     (1 = amount, 2 = qty).
  //   • The Grand Total column (was col 90) sums the row UN-ADJUSTED.
  //
  // PERMANENT RULE (docs/CLAUDE-RULES.md): trial-lens SKU columns must be
  // divided by their pack-size divisor before being summed into the day's qty;
  // PRMSD-style codes are excluded entirely. Sales amount (RM) is never
  // adjusted. We therefore compute the daily qty by walking the per-SKU
  // columns ourselves rather than trusting the raw Grand Total.

  // Step 1: locate the SKU-header row (col [1] === "DocumentDate") and build
  // a colIndex → divisor map. Skips excluded codes outright.
  const skuColumns: { col: number; divisor: number }[] = [];
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    if (typeof row[1] === "string" && /^documentdate$/i.test(row[1].trim())) {
      for (let c = 2; c < row.length; c++) {
        const code = row[c];
        if (typeof code !== "string" || !code.trim()) continue;
        if (/^grand\s*total$/i.test(code.trim())) continue; // skip the Grand Total column
        const { excluded, qtyDivisor } = lookupProduct(code);
        if (excluded) continue;
        skuColumns.push({ col: c, divisor: qtyDivisor || 1 });
      }
      break;
    }
  }
  // Fallback: if the header row layout ever moves, fall back to the legacy
  // behaviour (treat col 90 as the qty grand total) so we don't return zero.
  const useFallback = skuColumns.length === 0;

  const byDate = new Map<string, { qty: number; amount: number }>();
  let pendingDate: string | null = null;

  for (const r of grid) {
    if (!r || !r.length) continue;
    const flag = typeof r[7] === "number" ? r[7] : Number(r[7]);
    const label = r[1];

    if (label && typeof label === "string" && /^total$/i.test(label.trim())) {
      pendingDate = null;
      continue;
    }
    const d = toIsoDate(label);
    if (d) {
      pendingDate = d;
      byDate.set(d, byDate.get(d) ?? { qty: 0, amount: 0 });
      // Header date cell rows sometimes also carry the amount/qty totals.
      // Fall through into the flag handling below.
    }

    if (!pendingDate) continue;
    const cur = byDate.get(pendingDate) ?? { qty: 0, amount: 0 };

    if (flag === 2) {
      // Qty row — apply trial-lens divisors per-column.
      let sum = 0;
      if (useFallback) {
        const grand = typeof r[90] === "number" ? r[90] : 0;
        sum = grand;
      } else {
        for (const { col, divisor } of skuColumns) {
          const v = r[col];
          if (typeof v !== "number" || !Number.isFinite(v)) continue;
          sum += v / divisor;
        }
      }
      cur.qty = Math.max(cur.qty, sum);
    } else if (flag === 1) {
      // Amount row — MYR is never adjusted, so the file's Grand Total is fine.
      const grand = typeof r[90] === "number" ? r[90] : 0;
      cur.amount = Math.max(cur.amount, grand);
    }
    byDate.set(pendingDate, cur);
  }

  const days: DailySalesDay[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { qty, amount }]) => ({ date, qty: Math.round(qty), amount }));
  return {
    days,
    monthStart: days[0]?.date ?? null,
    monthEnd: days.at(-1)?.date ?? null,
  };
}
