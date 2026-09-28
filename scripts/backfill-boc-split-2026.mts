// Backfill: reapply the customer-based BoC split (HQ authoritative) to
// every 2026 month by running applyHqCustomerSplitRows against the SEED
// Sales Summary 2026 workbook. Corrects the old SKU-based split values.
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import y25Mod from "../src/lib/parsers/year-2025.ts";

const { parse2025Summary, applyHqCustomerSplitRows } = y25Mod as typeof import("../src/lib/parsers/year-2025.ts");
const p = new PrismaClient();

async function main() {
  const buf = fs.readFileSync("SEED(M) Sales Summary 2026.xlsx");
  const ref = parse2025Summary(new Uint8Array(buf));

  for (const m of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const row = await p.monthReport.findFirst({ where: { year: 2026, month: m } });
    if (!row || !row.salesByQuantity) continue;
    const rep = { id: row.id, year: row.year, month: row.month, salesByQuantity: JSON.parse(row.salesByQuantity as unknown as string) } as unknown as Parameters<typeof applyHqCustomerSplitRows>[0];
    const { changed, next } = applyHqCustomerSplitRows(rep, ref);
    if (!changed) { console.log(`2026-${String(m).padStart(2, "0")}: no change`); continue; }
    await p.monthReport.update({
      where: { id: row.id },
      data: { salesByQuantity: JSON.stringify(next.salesByQuantity) },
    });
    const boc = next.salesByQuantity?.rows.find(r => r.product === "Breath O Correct");
    const bocO = next.salesByQuantity?.rows.find(r => r.product === "Breath O Correct (Overseas)");
    console.log(`2026-${String(m).padStart(2, "0")}: updated  domestic=${boc?.qty2026}  overseas=${bocO?.qty2026}`);
  }
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect(); process.exit(1); });
