// One-off: re-parse the Aug 2026 Stock Write Off Listing with the corrected
// column-detection parser and write the aggregated ExpireWriteOff payload to
// the August MonthReport. The stored RawFile was uploaded but its sections
// stayed null because the pre-fix parser looked at the wrong columns.
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");

function friendlyProductLabel(raw) {
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

function parseWriteOffXlsx(buf) {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  const cell = (r, i) => r[i] == null ? "" : String(r[i]).trim();

  let docNoCol = 1, docDateCol = 10, itemCol = 3, descCol = 11, qtyCol = 29, amtCol = 44;
  const seen = new Set();
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const label = cell(row, c).toLowerCase();
      if (!label) continue;
      if (label === "document no" && !seen.has("docNo")) { docNoCol = c; seen.add("docNo"); }
      else if (label === "doc date" && !seen.has("docDate")) { docDateCol = c; seen.add("docDate"); }
      else if (label === "item" && !seen.has("item")) { itemCol = c; seen.add("item"); }
      else if (label === "description" && !seen.has("desc")) { descCol = c; seen.add("desc"); }
      else if (label === "quantity" && !seen.has("qty")) { qtyCol = c; seen.add("qty"); }
      else if (label === "amount" && !seen.has("amt")) { amtCol = c; seen.add("amt"); }
    }
  }

  const events = [];
  let cur = null;
  for (const row of rows) {
    const cDocNo = cell(row, docNoCol);
    if (/^WOFF\s*\d+/i.test(cDocNo)) {
      if (cur) events.push(cur);
      const dm = cell(row, docDateCol).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      const monthKey = dm ? `${dm[3]}-${dm[2].padStart(2, "0")}` : null;
      cur = { monthKey, rows: [] };
      continue;
    }
    if (!cur) continue;
    const itemNo = cell(row, itemCol);
    const desc = cell(row, descCol);
    if (/^\d+$/.test(itemNo) && desc) {
      const readAt = c => {
        const v = row[c];
        if (v == null || v === "") return null;
        const n = Number(String(v).replace(/,/g, "").trim());
        return Number.isFinite(n) ? n : null;
      };
      const qty = Math.round(readAt(qtyCol) ?? readAt(qtyCol - 1) ?? readAt(qtyCol - 2) ?? 0);
      const amt = readAt(amtCol) ?? readAt(amtCol - 1) ?? readAt(amtCol - 2) ?? 0;
      if (qty !== 0 || amt !== 0) cur.rows.push({ productDesc: desc, qty, totalCost: amt });
    }
  }
  if (cur) events.push(cur);
  return events;
}

(async () => {
  const p = new PrismaClient();
  const f = await p.rawFile.findFirst({
    where: { originalName: "Stock Write Off Listing Aug26.xlsx", deletedAt: null },
  });
  if (!f || !f.bytes) throw new Error("Aug26 write-off file not found");

  const events = parseWriteOffXlsx(f.bytes);
  const augEvents = events.filter(e => e.monthKey === "2026-08");
  const byLabel = new Map();
  for (const ev of augEvents) {
    for (const r of ev.rows) {
      const label = friendlyProductLabel(r.productDesc);
      const cur = byLabel.get(label) ?? { qty: 0, amt: 0 };
      cur.qty += r.qty;
      cur.amt += r.totalCost;
      byLabel.set(label, cur);
    }
  }
  const payload = {
    rows: [...byLabel.entries()]
      .map(([product, v]) => ({ product, qty: v.qty, amt: Math.round(v.amt * 100) / 100 }))
      .sort((a, b) => b.amt - a.amt),
  };

  // Update Aug 2026 report's expireWriteOff + tag the RawFile with the section.
  await p.$transaction([
    p.monthReport.update({
      where: { id: "2026-08" },
      data: { expireWriteOff: JSON.stringify(payload) },
    }),
    p.rawFile.update({
      where: { id: f.id },
      data: { sectionKeys: JSON.stringify(["expireWriteOff"]) },
    }),
  ]);

  console.log("Aug 2026 expireWriteOff written — %d product rows:", payload.rows.length);
  for (const r of payload.rows) console.log("  %s  qty=%d  amt=%s", r.product.padEnd(28), r.qty, r.amt.toFixed(2));
  const totQty = payload.rows.reduce((s, r) => s + r.qty, 0);
  const totAmt = payload.rows.reduce((s, r) => s + r.amt, 0);
  console.log("Total: qty=%d  amt=RM %s", totQty, totAmt.toFixed(2));
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
