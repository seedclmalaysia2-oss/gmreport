// Full data audit: for every month, which of the 13 slides has data, and
// which RawFile kinds have been uploaded. Flags the missing source files.
//   node scripts/audit-data.cjs
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const envText = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

// Slide -> the section JSON column + the file kind(s) that feed it.
const SLIDES = [
  { no: 1,  key: "salesAchievement",    needs: ["pos_master", "ref_2025"] },
  { no: 2,  key: "salesTrend",          needs: ["(computed from Slide 1)"] },
  { no: 3,  key: "marketOutlook",       needs: ["(manual entry)"] },
  { no: 4,  key: "dailySales",          needs: ["pos_daily"] },
  { no: 5,  key: "salesByQuantity",     needs: ["pos_master", "pos_mcuv", "ref_2025"] },
  { no: 6,  key: "topProducts",         needs: ["pos_master", "pos_mcuv"] },
  { no: 7,  key: "salesByECP",          needs: ["pos_outlets/pos_salesman", "pos_ecp_list"] },
  { no: 8,  key: "salesByRegion",       needs: ["pos_region"] },
  { no: 9,  key: "productRegistration", needs: ["(manual entry)"] },
  { no: 10, key: "inventory",           needs: ["pos_inventory"] },
  { no: 11, key: "expireWriteOff",      needs: ["pos_writeoff"] },
  { no: 12, key: "financial",           needs: ["pos_collection/pos_salesman"] },
  { no: 13, key: "otherMarket",         needs: ["(manual entry)"] },
];
const MONTHS = ["", "JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

(async () => {
  const c = new Client({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const months = await c.query(`SELECT * FROM "MonthReport" ORDER BY year ASC, month ASC`);
  const files = await c.query(`
    SELECT "monthReportId", kind, "originalName"
    FROM "RawFile" WHERE "deletedAt" IS NULL
  `);
  const filesByMonth = {};
  for (const f of files.rows) (filesByMonth[f.monthReportId] ??= []).push(f);

  for (const m of months.rows) {
    const label = `${MONTHS[m.month]} ${m.year}`;
    const fk = filesByMonth[m.id] ?? [];
    const kinds = new Set(fk.map(f => f.kind));
    console.log(`\n========== ${label}  (id=${m.id}) ==========`);
    console.log(`Uploaded files (${fk.length}): ${fk.length ? fk.map(f => f.kind + ":" + f.originalName).join(" | ") : "NONE"}`);

    for (const s of SLIDES) {
      const raw = m[s.key];
      let present = raw != null && raw !== "";
      let detail = "";
      // Deeper check: parse the JSON and see if it actually carries numbers.
      if (present && typeof raw === "string") {
        try {
          const j = JSON.parse(raw);
          if (s.key === "salesAchievement") {
            const a26 = (j.actual2026 || []).filter(v => v != null).length;
            const a25 = (j.actual2025 || []).filter(v => v != null).length;
            detail = `actual2026 filled=${a26}/12, actual2025 filled=${a25}/12`;
            if (a26 === 0) present = false;
          } else if (s.key === "salesByQuantity") {
            const rows = j.rows || [];
            const q26 = rows.filter(r => (r.qty2026 ?? 0) !== 0).length;
            const q25 = rows.filter(r => (r.qty2025 ?? 0) !== 0).length;
            detail = `${rows.length} rows · qty2026 nonzero=${q26}, qty2025 nonzero=${q25}`;
            if (q26 === 0) present = false;
          } else if (Array.isArray(j.rows)) {
            detail = `${j.rows.length} rows`;
            if (j.rows.length === 0) present = false;
          } else if (Array.isArray(j.days)) {
            detail = `${j.days.length} days`;
            if (j.days.length === 0) present = false;
          }
        } catch { /* not json */ }
      }
      const flag = present ? "  OK " : "MISS ";
      console.log(`  ${flag} Slide ${String(s.no).padStart(2)} ${s.key.padEnd(20)} ${detail}`);
      if (!present && !s.needs[0].startsWith("(")) {
        const missing = s.needs.filter(n => !n.startsWith("(") && !n.split("/").some(k => kinds.has(k)));
        if (missing.length) console.log(`         -> upload: ${missing.join(", ")}`);
      }
    }
  }
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
