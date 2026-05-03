// Map a parsed StockParseResult into the Slide 12 inventory grid.
// We only have nationwide totals (warehouse + consignment combined) so we drop
// everything into the `warehouse` column and leave `consignment` null — user can
// override or split later through the editor.

import type { StockParseResult } from "@/lib/parsers/pos-extra-xlsx";
import { INVENTORY_GROUPS } from "@/lib/catalog/products";
import type { Inventory } from "@/lib/schema";

type Row = Inventory["groups"][number]["rows"][number];

function mcuvCol(variant: "BLUE" | "ORANGE" | "PEGA"): Row["product"] {
  return variant === "BLUE" ? "MC - Blue" : variant === "ORANGE" ? "MC - Orange" : "MC-Pega (Old)";
}

export function inventoryFromStock(stock: StockParseResult): Inventory {
  // Build a quick map: canonical label → balance qty
  const canon = { ...stock.byCanonical };
  const mcuv = stock.byMcuvVariant;

  // Map canonical names to the slot labels used in INVENTORY_GROUPS.
  const labelToQty: Record<string, number> = {
    "1DP": canon["1dayPureUP (32P)"] ?? 0,
    "1DP ASTIG": canon["1dayPureUP Astig (32P)"] ?? 0,
    "1DP MS": canon["1dayPureUP Multistage (32P)"] ?? 0,
    "1DP V.S": canon["1 Day View Support"] ?? 0,
    "1DP EDOF": canon["1dayPureUP EDOF (32P)"] ?? 0,
    "1D SILFA": canon["1dayPure Silfa"] ?? 0,

    "Mfine UV+": canon["MonthlyFine Plus (3P)"] ?? 0,
    "MTPure3": canon["Monthly Pure 3"] ?? 0,
    "MTPure6": canon["Monthly Pure 6"] ?? 0,
    "2WK Pure": canon["2weekPure Up (6P)"] ?? 0,
    "2WK Multi": canon["2weekPure Multistage (6P)"] ?? 0,
    "2WK Toric": canon["2weekPure Up Toric"] ?? 0,

    "EC-10 M": canon["Eye coffret-M"] ?? 0,
    "EC-10 M Toric": canon["Eye Coffret-M 10 Toric"] ?? 0,
    "EM-30 M Toric": canon["Eye Coffret-M 30 Toric"] ?? 0,
    "Minasoft Col Sihy": canon["Minasoft 1Day Color UV"] ?? 0,
    "Minasoft Care Sihy": canon["Minasoft Care UV"] ?? 0,

    "MC - Blue": mcuv.BLUE,
    "MC - Orange": mcuv.ORANGE,
    "MC - II": canon["MonthlyColour UV II"] ?? 0,
    "MC-Pega (Old)": mcuv.PEGA,

    "DISOP H202 SOL": canon["DISOP H2O2 Solution"] ?? 0,
    "DISOP A. ULTRA": canon["DISOP Ultra Eyedrop"] ?? 0,
    "DISOP A.Dual Gel": 0,      // derived from separate SKU; would be nice to parse by desc
    "BOC": canon["Breath O Correct"] ?? 0,
  };

  // Look for Dual Gel explicitly in raw rows (common pattern: "DISOP Acuaiss Dual Gel")
  for (const s of stock.rows) {
    if (/Acuaiss\s*Dual\s*Gel/i.test(s.description)) {
      labelToQty["DISOP A.Dual Gel"] += s.balance;
    }
  }

  const groups = INVENTORY_GROUPS.map(g => ({
    name: g.name,
    rows: g.products.map(p => ({
      product: p,
      warehouse: labelToQty[p] ?? null,
      consignment: null as number | null,
    })),
  }));

  const totalWarehouse = Object.values(labelToQty).reduce((s, v) => s + v, 0);

  return {
    groups,
    totalWarehouse,
    totalConsignment: null,
    commentary: "",
  };
}
