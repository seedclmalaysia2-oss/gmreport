// One-off: reprocess docs/Stock Sales Analysis Summary - By Group Aug26.xlsx
// (the new "By Brand" export) through the shipped master parser + slide-5
// aggregation, then persist qty2026 for every canonical product onto the
// August MonthReport. Uses the same code path production runs, so the SKU
// catalog we extended for this format is exercised end-to-end.
//
// The project is CJS (no "type": "module" in package.json), so tsx exposes
// each TS file's named exports on `default` — namespace-import each one.
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import posXlsxMod from "../src/lib/parsers/pos-xlsx.ts";
import aggMod from "../src/lib/aggregation/index.ts";

const { parseMasterXlsx } = posXlsxMod as { parseMasterXlsx: typeof import("../src/lib/parsers/pos-xlsx.ts").parseMasterXlsx };
const { salesByQuantity, topProducts, priorYearQtyLookup, unmappedSkus } = aggMod as typeof import("../src/lib/aggregation/index.ts");

const p = new PrismaClient();

async function main() {
  const buf = fs.readFileSync("docs/Stock Sales Analysis Summary - By Group Aug26.xlsx");
  const master = parseMasterXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  const grand = master.grandTotal.netSales;
  console.log("master rows:", master.rows.length, " unmapped:", master.unmapped.length);
  console.log("grandTotal.netSales (Sales/cust adj applied):", grand);

  const priorYear = await p.monthReport.findFirst({ where: { year: 2025, month: 8 } });
  const priorSbq = priorYear?.salesByQuantity ? JSON.parse(priorYear.salesByQuantity as unknown as string) : null;
  const priorQty = priorYearQtyLookup(priorSbq);

  const sq = salesByQuantity(master, [], priorQty);
  const tp = topProducts(master, []);

  const aug = await p.monthReport.findFirst({ where: { id: "2026-08" } });
  const sa = aug?.salesAchievement ? JSON.parse(aug.salesAchievement as unknown as string) : null;
  if (sa) {
    sa.actual2026 = [...sa.actual2026];
    sa.actual2026[7] = grand;
  }

  await p.monthReport.update({
    where: { id: "2026-08" },
    data: {
      salesByQuantity: JSON.stringify(sq),
      topProducts: JSON.stringify(tp),
      ...(sa ? { salesAchievement: JSON.stringify(sa) } : {}),
    },
  });

  console.log("\nSlide 5 (salesByQuantity) — rows written:", sq.rows.length);
  for (const r of sq.rows) console.log(" ", r.product.padEnd(35), "qty2026=" + String(r.qty2026).padStart(5), " qty2025=" + r.qty2025);

  console.log("\nSlide 6 (topProducts) — rows written:", tp.rows.length, " totalMyr:", tp.totalMyr);
  console.log("\nSlide 1 salesAchievement.actual2026[Aug] =", sa?.actual2026?.[7]);

  const uns = unmappedSkus(master);
  console.log("\nUnmapped SKUs after catalog run:", uns.length);
  for (const u of uns.slice(0, 25)) console.log(" ", u.code.padEnd(22), "RM=" + String(u.netSales).padStart(9), " qty=" + String(u.qty).padStart(4), " |", u.desc.slice(0, 45));
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect(); process.exit(1); });
