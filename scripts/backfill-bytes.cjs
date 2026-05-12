// One-shot backfill: locate every RawFile row in production whose `bytes`
// column is NULL, find the original file on the local filesystem (by
// exact basename), and write the bytes back into the bytea column. This
// unlocks View + Save on the Files page for every row we can match.
//
//   node scripts/backfill-bytes.cjs
//
// Files we DON'T find are reported at the end with their byteSize so the
// user can decide whether to chase them down manually.
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// Mirror .env loading from the other diagnostic scripts so this runs
// standalone (no dotenv dep needed).
const envText = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const SEARCH_DIRS = [
  "C:/Users/Expert/Downloads/Gm report Assistant/Jan",
  "C:/Users/Expert/Downloads/Gm report Assistant/Feb",
  "C:/Users/Expert/Downloads/Gm report Assistant/Mac",
  "C:/Users/Expert/Downloads/Gm report Assistant",
];

function findLocalFile(name) {
  for (const dir of SEARCH_DIRS) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

(async () => {
  const c = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  console.log("Connected to Supabase.\n");

  const { rows } = await c.query(`
    SELECT id, "originalName", "byteSize"
    FROM "RawFile"
    WHERE bytes IS NULL
    ORDER BY "createdAt" DESC
  `);

  console.log(`Rows needing backfill: ${rows.length}\n`);

  let ok = 0;
  const missing = [];
  for (const r of rows) {
    const local = findLocalFile(r.originalName);
    if (!local) {
      missing.push(r);
      continue;
    }
    const buf = fs.readFileSync(local);
    await c.query(
      `UPDATE "RawFile" SET bytes = $1, "byteSize" = $2 WHERE id = $3`,
      [buf, buf.length, r.id],
    );
    const flag = buf.length === r.byteSize ? "" : ` (size changed ${r.byteSize} -> ${buf.length})`;
    console.log(`  OK    ${r.originalName}  [${buf.length} bytes]${flag}`);
    ok++;
  }

  console.log(`\nBackfilled ${ok} rows.`);
  if (missing.length) {
    console.log(`\nMissing locally — these still need a manual re-upload:`);
    for (const r of missing) {
      console.log(`  - ${r.originalName}  (${r.byteSize} bytes)`);
    }
  }
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
