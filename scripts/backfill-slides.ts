/**
 * One-off backfill: recompute the slides that are derived purely from an
 * uploaded POS file, using the bytes already stored in RawFile, so a mapping
 * or aggregation fix takes effect without re-uploading every month by hand.
 *
 *   Slide 5 Sales Quantity + Slide 6 Top Products  <- pos_master   (.xlsx)
 *   Slide 7 Sales by ECP                           <- pos_salesman (.xlsx)
 *
 * Preserves, verbatim:
 *   • every product row's qty2025 (the prior-year reference — NOT re-derived)
 *   • every slide's commentary
 *   • any manually-added product row that isn't in CANONICAL_PRODUCTS
 *
 * A month with no stored source file for a slide leaves that slide untouched —
 * nothing is ever zeroed out.
 *
 * Usage:  npx tsx scripts/backfill-slides.ts          # dry run (default)
 *         npx tsx scripts/backfill-slides.ts --write  # apply
 */
import fs from "fs";
import path from "path";
import { Client } from "pg";
import { parseMasterXlsx, parseSalesmanSalesXlsx } from "@/lib/parsers/pos-xlsx";
import { salesByECP, salesByQuantity, topProducts } from "@/lib/aggregation";
import { CANONICAL_PRODUCTS, type CanonicalProduct } from "@/lib/catalog/products";
import { SalesByECPZ, SalesByQuantityZ, TopProductsZ } from "@/lib/schema";

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
    `SELECT id, year, month, "salesByQuantity", "topProducts", "salesByECP" FROM "MonthReport" ORDER BY year, month`);

  // Snapshot everything we are about to touch, before touching it.
  const backupDir = process.env.BACKUP_DIR || ".";
  const backupPath = path.join(backupDir, "backfill-quantity.backup.json");
  fs.writeFileSync(backupPath, JSON.stringify(months.rows, null, 2), "utf8");
  console.log(`backup of ${months.rows.length} months -> ${backupPath}\n`);

  /** Newest active .xlsx upload of a given kind for a month, or null. */
  const latestXlsx = async (monthId: string, kind: string) => {
    const f = await c.query(
      `SELECT "originalName", bytes FROM "RawFile"
       WHERE "monthReportId"=$1 AND kind=$2 AND "deletedAt" IS NULL AND bytes IS NOT NULL
       ORDER BY "createdAt" DESC LIMIT 1`, [monthId, kind]);
    if (!f.rows.length) return null;
    if (!/\.xlsx?$/i.test(f.rows[0].originalName)) return null;
    return { name: f.rows[0].originalName as string, buf: toArrayBuffer(f.rows[0].bytes as Buffer) };
  };

  let touched = 0;
  for (const m of months.rows) {
    // ---------- Slide 7: Sales by ECP ----------
    const salesmanFile = await latestXlsx(m.id, "pos_salesman");
    if (salesmanFile) {
      const parsedSalesman = parseSalesmanSalesXlsx(salesmanFile.buf, m.year, m.month);
      if (!parsedSalesman.outlets.length) {
        console.log(`${m.id}: salesman file parsed 0 outlet rows — ECP left alone`);
      } else {
        // Every row the salesman parser emits already carries an Account Type,
        // so the ECP-list fallback can't change any classification here.
        const nextEcp = salesByECP(parsedSalesman.outlets, []);
        const oldEcp = m.salesByECP ? JSON.parse(m.salesByECP) : null;
        nextEcp.commentary = oldEcp?.commentary ?? "";
        const oldByCat = new Map<string, { outlets: number }>(
          (oldEcp?.rows ?? []).map((r: { category: string; outlets: number }) => [r.category, r]));
        const ecpDiffs = nextEcp.rows.filter(r => oldByCat.get(r.category)?.outlets !== r.outlets);
        if (ecpDiffs.length) {
          touched++;
          console.log(`${m.id}: ECP outlet counts change  [${salesmanFile.name}]`);
          for (const d of ecpDiffs) {
            console.log(`    ${d.category.padEnd(34)} ${String(oldByCat.get(d.category)?.outlets ?? "(new)").padStart(6)} -> ${String(d.outlets).padStart(4)}`);
          }
          if (WRITE) {
            SalesByECPZ.parse(nextEcp);
            await c.query(`UPDATE "MonthReport" SET "salesByECP"=$2, "updatedAt"=NOW() WHERE id=$1`,
              [m.id, JSON.stringify(nextEcp)]);
            console.log(`    written`);
          }
        }
      }
    }

    // ---------- Slides 5 + 6: quantity / top products ----------
    const masterFile = await latestXlsx(m.id, "pos_master");
    if (!masterFile) { console.log(`${m.id}: no stored .xlsx master — quantity SKIPPED`); continue; }
    const master = parseMasterXlsx(masterFile.buf);

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
    if (!diffs.length) { console.log(`${m.id}: no quantity change`); continue; }
    touched++;
    console.log(`${m.id}: ${diffs.length} quantity row(s) change  [${masterFile.name}]`);
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
