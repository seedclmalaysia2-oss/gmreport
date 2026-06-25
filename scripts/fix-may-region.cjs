// One-off: parse the May 2026 Sales Analysis By Region file with the new
// (May-format-tolerant) logic and write the resulting salesByRegion to the
// May 2026 month report. Uses April's salesThis as priorMonth.
const XLSX = require("xlsx");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const SHORT_MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parse(buf, year, month) {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const re = new RegExp(`^${SHORT_MONTH[month - 1]}[\\s\\-'.]*(?:${year}|${String(year).slice(-2)})$`, "i");
  let headerCol = -1;
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (typeof v === "string" && re.test(v.trim())) { headerCol = c; break; }
    }
    if (headerCol >= 0) break;
  }
  if (headerCol < 0) return [];
  const bs = Math.max(0, headerCol - 4), be = headerCol + 4;
  const pick = (row) => {
    if (!row) return null;
    let fb = null;
    for (let c = bs; c <= be; c++) {
      const v = row[c];
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v !== 0) return v;
        if (fb === null) fb = v;
      }
    }
    return fb;
  };
  const groupRe = /^Customer\s+UD\s+Group(?:\s*:\s*(.+))?$/i;
  const nameRe = /^(.+?)\s*\((STATE|COUNTRY)\)\s*$/i;
  const findName = (row) => {
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (typeof cell !== "string") continue;
      const m = cell.trim().match(groupRe);
      if (!m) continue;
      if (m[1]) return m[1].trim();
      for (let cc = c + 1; cc < row.length; cc++) {
        const nx = row[cc];
        if (typeof nx === "string" && nx.trim()) return nx.trim();
      }
      return null;
    }
    return null;
  };
  const out = [];
  let cg = null;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const gn = findName(row);
    if (gn) {
      const m = gn.match(nameRe);
      cg = m
        ? { name: m[1].trim().toUpperCase(), kind: m[2].toUpperCase() === "COUNTRY" ? "country" : "state" }
        : { name: gn.toUpperCase(), kind: "state" };
      continue;
    }
    const has = row.some((c) => typeof c === "string" && c.trim().toLowerCase() === "sub total");
    if (has && cg) {
      const amt = pick(row) ?? pick(rows[r + 1]) ?? 0;
      out.push({ state: cg.name, kind: cg.kind, sales: amt });
      cg = null;
    }
  }
  return out;
}

const REGIONS = [
  "Southern Region (Johor, Melaka & Negeri Sembilan)",
  "Central Region (KL, Selangor & Putrajaya)",
  "Northern Region (Kedah, Penang, Perak & Perlis)",
  "East Coast Region (Pahang, Kelantan & Terengganu)",
  "East Malaysia (Sabah & Sarawak) & Brunei",
];
const STATE_TO_REGION = {
  JOHOR: REGIONS[0], MELAKA: REGIONS[0], "NEGERI SEMBILAN": REGIONS[0],
  KL: REGIONS[1], "KUALA LUMPUR": REGIONS[1], SELANGOR: REGIONS[1], PUTRAJAYA: REGIONS[1],
  KEDAH: REGIONS[2], "PULAU PINANG": REGIONS[2], PENANG: REGIONS[2], PERAK: REGIONS[2], PERLIS: REGIONS[2],
  PAHANG: REGIONS[3], KELANTAN: REGIONS[3], TERENGGANU: REGIONS[3],
  SABAH: REGIONS[4], SARAWAK: REGIONS[4], BRUNEI: REGIONS[4],
};

(async () => {
  const p = new PrismaClient();
  const buf = fs.readFileSync("C:/Users/Expert/Downloads/Gm report Assistant/May/Sales Analysis By Region May26.xlsx");
  const states = parse(buf, 2026, 5);
  const totals = Object.fromEntries(REGIONS.map((r) => [r, 0]));
  for (const e of states) {
    if (e.kind !== "state") continue;
    const region = STATE_TO_REGION[e.state];
    if (region) totals[region] += e.sales;
    else console.log("[unmapped state]", e.state, e.sales);
  }
  const apr = await p.monthReport.findFirst({ where: { year: 2026, month: 4 } });
  const aprSbr = apr && apr.salesByRegion ? JSON.parse(apr.salesByRegion) : null;
  const priorMap = aprSbr
    ? Object.fromEntries(aprSbr.rows.map((r) => [r.region, r.salesThis]))
    : {};
  const rows = REGIONS.map((region) => {
    const salesThis = totals[region];
    const salesPrev = priorMap[region] || 0;
    return {
      region,
      salesThis,
      salesPrev,
      growthPct: salesPrev ? (salesThis - salesPrev) / salesPrev : 0,
    };
  });
  await p.monthReport.update({
    where: { id: "2026-05" },
    data: { salesByRegion: JSON.stringify({ rows, commentary: "" }) },
  });
  console.log("Updated May 2026 salesByRegion:");
  for (const r of rows) {
    console.log(
      " ",
      r.region.padEnd(60),
      "this=" + r.salesThis.toFixed(2).padStart(10),
      "prev=" + r.salesPrev.toFixed(2).padStart(10),
      "growth=" + (r.growthPct * 100).toFixed(1) + "%",
    );
  }
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
