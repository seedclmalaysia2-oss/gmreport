// Verify the customer-split BoC autofill: parse HQ's Sales Summary, run
// applyHqCustomerSplitRows against every 2026 month, print the resulting
// Slide 5 BoC rows. Confirms Aug 3/38 and any other month automatically
// picks up its own value from the same file.
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import y25Mod from "../src/lib/parsers/year-2025.ts";

const { parse2025Summary, applyHqCustomerSplitRows } = y25Mod as typeof import("../src/lib/parsers/year-2025.ts");
const p = new PrismaClient();

async function main() {
  const buf = fs.readFileSync("SEED(M) Sales Summary 2026.xlsx");
  const ref = parse2025Summary(new Uint8Array(buf));
  console.log("summary year:", ref.year);
  console.log("BoC domestic 12-month series:", ref.productQty["Breath O Correct"]);
  console.log("BoC overseas 12-month series:", ref.productQty["Breath O Correct (Overseas)"]);
  console.log("");

  for (const m of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const row = await p.monthReport.findFirst({ where: { year: 2026, month: m } });
    if (!row) continue;
    const rep = {
      id: row.id, year: row.year, month: row.month,
      salesAchievement: null, salesTrend: null, marketOutlook: null, dailySales: null,
      salesByQuantity: row.salesByQuantity ? JSON.parse(row.salesByQuantity as unknown as string) : null,
      topProducts: null, salesByECP: null, salesByRegion: null, productRegistration: null,
      inventory: null, expireWriteOff: null, financial: null, otherMarket: null,
      presenter: null, presentDate: null, fxRate: 30.73, sourceFiles: {},
    } as unknown as Parameters<typeof applyHqCustomerSplitRows>[0];
    const { changed, next } = applyHqCustomerSplitRows(rep, ref);
    const boc = next.salesByQuantity?.rows.find(r => r.product === "Breath O Correct");
    const bocO = next.salesByQuantity?.rows.find(r => r.product === "Breath O Correct (Overseas)");
    console.log(
      `2026-${String(m).padStart(2, "0")}  changed=${changed}  domestic=${boc?.qty2026 ?? "n/a"}  overseas=${bocO?.qty2026 ?? "n/a"}`,
    );
  }
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect(); process.exit(1); });
