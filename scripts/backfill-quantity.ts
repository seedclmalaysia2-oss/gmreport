/**
 * One-off backfill: recompute Slide 5 (Sales Quantity) and Slide 6 (Top
 * Products) for every month from the POS master file already stored in
 * RawFile.bytes, so the corrected SKU mappings take effect without the user
 * having to re-upload each month.
 *
 * Preserves, verbatim:
 *   • every row's qty2025 (the prior-year reference — NOT re-derived here)
 *   • both slides' commentary
 *   • any manually-added product row that isn't in CANONICAL_PRODUCTS
 *
 * Months with no stored master file are skipped, never zeroed.
 *
 * Usage:  npx tsx scripts/backfill-quantity.ts          # dry run (default)
 *         npx tsx scripts/backfill-quantity.ts --write  # apply
 */
import fs from "fs";
import path from "path";
import { Client } from "pg";
import { parseMasterXlsx } from "@/lib/parsers/pos-xlsx";
import { salesByQuantity, topProducts } from "@/lib/aggregation";
import { CANONICAL_PRODUCTS, type CanonicalProduct } from "@/lib/catalog/products";
import { SalesByQuantityZ, TopProductsZ } from "@/lib/schema";

const WRITE = process.argv.includes("--write");
const env = fs.readFileSync(".env", "utf8");
const url = (env.match(/^DIRECT_URL=(.*)$/m)?.[1] ?? env.match(/^DATABASE_URL=(.*)$/m)![1])
  .trim().replace(/^["']|["']$/g, "");

const toArrayBuffer = (b: Buffer): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const months = await c.query(
    `SELECT id, "salesByQuantity", "topProducts" FROM "MonthReport" ORDER BY year, month`);

  // Snapshot everything we are about to touch, before touching it.
  const backupDir = process.env.BACKUP_DIR || ".";
  const backupPath = path.join(backupDir, "backfill-quantity.backup.json");
  fs.writeFileSync(backupPath, JSON.stringify(months.rows, null, 2), "utf8");
  console.log(`backup of ${months.rows.length} months -> ${backupPath}\n`);

  let touched = 0;
  for (const m of months.rows) {
    const f = await c.query(
      `SELECT "originalName", bytes FROM "RawFile"
       WHERE "monthReportId"=$1 AND kind='pos_master' AND "deletedAt" IS NULL AND bytes IS NOT NULL
       ORDER BY "createdAt" DESC LIMIT 1`, [m.id]);
    if (!f.rows.length) { console.log(`${m.id}: no stored master file — SKIPPED`); continue; }
    if (!/\.xlsx?$/i.test(f.rows[0].originalName)) {
      console.log(`${m.id}: master is not an .xlsx (${f.rows[0].originalName}) — SKIPPED`); continue;
    }

    const master = parseMasterXlsx(toArrayBuffer(f.rows[0].bytes as Buffer));

    // Carry the existing prior-year column across unchanged.
    const oldSq = m.salesByQuantity ? JSON.parse(m.salesByQuantity) : null;
    const oldRows: { product: string; qty2026: number; qty2025: number }[] = oldSq?.rows ?? [];
    const priorQty: Partial<Record<CanonicalProduct, number>> = {};
    for (const r of oldRows) (priorQty as Record<string, number>)[r.product] = r.qty2025;

    // No MCUV colour-breakdown PDFs are on file for any month, so the master's
    // own rows feed the three MC lines — same as at original import time.
    const nextSq = salesByQuantity(master, [], priorQty);
    nextSq.commentary = oldSq?.commentary ?? "";
    // Keep any hand-added product row the canonical list doesn't cover.
    const canon = new Set<string>(CANONICAL_PRODUCTS);
    for (const r of oldRows) if (!canon.has(r.product)) nextSq.rows.push(r);

    const oldTp = m.topProducts ? JSON.parse(m.topProducts) : null;
    const nextTp = topProducts(master, []);
    nextTp.commentary = oldTp?.commentary ?? "";

    // Report the quantity deltas.
    const oldByProduct = new Map(oldRows.map(r => [r.product, r.qty2026]));
    const diffs = nextSq.rows
      .map(r => ({ p: r.product, from: oldByProduct.get(r.product), to: r.qty2026 }))
      .filter(d => d.from !== d.to);
    if (!diffs.length) { console.log(`${m.id}: no change`); continue; }
    touched++;
    console.log(`${m.id}: ${diffs.length} row(s) change  [${f.rows[0].originalName}]`);
    for (const d of diffs) {
      console.log(`    ${d.p.padEnd(28)} ${String(d.from ?? "(new row)").padStart(9)} -> ${String(d.to).padStart(6)}`);
    }

    if (WRITE) {
      SalesByQuantityZ.parse(nextSq);   // refuse to write anything malformed
      TopProductsZ.parse(nextTp);
      await c.query(
        `UPDATE "MonthReport" SET "salesByQuantity"=$2, "topProducts"=$3, "updatedAt"=NOW() WHERE id=$1`,
        [m.id, JSON.stringify(nextSq), JSON.stringify(nextTp)]);
      console.log(`    written`);
    }
  }
  console.log(`\n${WRITE ? "APPLIED" : "DRY RUN"} — ${touched} month(s) with changes`);
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
