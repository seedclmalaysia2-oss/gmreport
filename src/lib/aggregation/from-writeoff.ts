// Turn a write-off PDF (one or more WOFF events) into per-month ExpireWriteOff sections.

import type { PosWriteOffParseResult } from "@/lib/parsers/pos-pdf";
import type { ExpireWriteOff } from "@/lib/schema";

// Friendly product label for Slide 13. Keep close to the labels Simon's deck uses.
function friendlyProductLabel(raw: string): string {
  const d = raw.trim().toUpperCase();
  if (d.startsWith("1 DAY PURE EDOF")) return "1dayPure Edof";
  if (d.startsWith("1 DAY PURE TORIC")) return "1dayPure Astigmatism";
  if (d.startsWith("1 DAY PURE MULTISTAGE")) return "1dayPure Multistage";
  if (d.startsWith("1 DAY PURE VIEW")) return "1dayPure View support";
  if (d.startsWith("1 DAY PURE SILFA")) return "1dayPure Silfa";
  if (d === "1 DAY PURE") return "1dayPure";
  if (d.startsWith("2 WEEK PURE UP TORIC")) return "2 Week Pure Toric";
  if (d.startsWith("2 WEEK PURE MULT")) return "2 Week Pure Multistage";
  if (d === "2 WEEK PURE UP") return "2 Week Pure";
  if (/EC[A-Z]*10-M/.test(d) && !d.includes("TORIC")) return "Eye Coffret M-10";
  if (d.startsWith("EYE COFFRET-M TORIC 10")) return "Eye Coffret-M Toric 10";
  if (d.startsWith("EYE COFFRET-M TORIC 30")) return "Eye Coffret-30";
  if (d === "MONTHLY PURE6") return "Monthly Pure 6P";
  if (d === "MONTHLY PURE3") return "Monthly Pure 3P";
  if (d.startsWith("MONTHLY FINE UV")) return "Monthly Fine UV Plus";
  if (d.startsWith("MONTHLY COLOR UV II")) return "Monthly Color UV II";
  if (d.startsWith("MONTHLY COLOR UV") || d.startsWith("MONTHLY COLOR")) return "Monthly Color UV";
  if (d.startsWith("MINASOFT 1DAY")) return "Minasoft 1Day Color";
  if (d.startsWith("MINASOFT CARE")) return "Minasoft Care UV";
  if (d.startsWith("DISOP HIDRO")) return "DISOP H2O2";
  if (d.startsWith("DISOP ACUAISS")) return "DISOP Eyedrop";
  if (d.startsWith("SEED BOC")) return "Breath O Correct";
  return raw.trim();
}

// Aggregate a write-off event's rows by friendly label.
export function expireFromEvent(ev: PosWriteOffParseResult["events"][number]): ExpireWriteOff {
  const byLabel = new Map<string, { qty: number; amt: number }>();
  for (const r of ev.rows) {
    const label = friendlyProductLabel(r.productDesc);
    const cur = byLabel.get(label) ?? { qty: 0, amt: 0 };
    cur.qty += r.qty;
    cur.amt += r.totalCost;
    byLabel.set(label, cur);
  }
  return {
    rows: [...byLabel.entries()]
      .map(([product, v]) => ({ product, qty: v.qty, amt: Math.round(v.amt * 100) / 100 }))
      .sort((a, b) => b.amt - a.amt),
  };
}

// Split a multi-month PDF (e.g. Jan-Mar) into per-month ExpireWriteOff payloads,
// keyed by YYYY-MM.
export function expireByMonth(parse: PosWriteOffParseResult): Record<string, ExpireWriteOff> {
  const byMonth: Record<string, { qty: number; amt: number; rowsByLabel: Map<string, { qty: number; amt: number }> }> = {};
  for (const ev of parse.events) {
    if (!ev.monthKey) continue;
    const bucket = (byMonth[ev.monthKey] ??= { qty: 0, amt: 0, rowsByLabel: new Map() });
    for (const r of ev.rows) {
      const label = friendlyProductLabel(r.productDesc);
      const cur = bucket.rowsByLabel.get(label) ?? { qty: 0, amt: 0 };
      cur.qty += r.qty;
      cur.amt += r.totalCost;
      bucket.rowsByLabel.set(label, cur);
      bucket.qty += r.qty;
      bucket.amt += r.totalCost;
    }
  }
  const result: Record<string, ExpireWriteOff> = {};
  for (const [mk, bucket] of Object.entries(byMonth)) {
    result[mk] = {
      rows: [...bucket.rowsByLabel.entries()]
        .map(([product, v]) => ({ product, qty: v.qty, amt: Math.round(v.amt * 100) / 100 }))
        .sort((a, b) => b.amt - a.amt),
    };
  }
  return result;
}
