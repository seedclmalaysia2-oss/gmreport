// Map a parsed StockParseResult into the Slide 10 inventory grid.
//
// Two modes:
//   • Master file only      → everything lands in `warehouse`, `consignment`
//                             is left null (user can split manually).
//   • Master + HQ + HQ2     → each product is split per the rules doc:
//                             warehouse  = HQ + HQ2 (actual stock)
//                             consignment = master − warehouse

import type { StockParseResult } from "@/lib/parsers/pos-extra-xlsx";
import { INVENTORY_GROUPS } from "@/lib/catalog/products";
import type { Inventory } from "@/lib/schema";

type Row = Inventory["groups"][number]["rows"][number];

/**
 * @param stock          parsed master SCLM (optionally warehouse-split)
 * @param bocConsignment BOC consignment qty from the dedicated "SCLM Stock
 *                       List BOC" file. BOC consignment is NOT in the master,
 *                       so when this file is supplied it overrides the BOC
 *                       row's consignment cell directly.
 */
export function inventoryFromStock(stock: StockParseResult, bocConsignment?: number): Inventory {
  const canon = { ...stock.byCanonical };
  const mcuv = stock.byMcuvVariant;
  // Warehouse-split data — present only when HQ/HQ2 were uploaded.
  const canonWh = stock.byCanonicalWarehouse;
  const mcuvWh = stock.byMcuvVariantWarehouse;
  const split = canonWh != null && mcuvWh != null;

  // slot label → canonical/total qty
  const labelToTotal: Record<string, number> = {
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
    "DISOP A.Dual Gel": 0,      // derived from raw rows below
    "BOC": canon["Breath O Correct"] ?? 0,
  };

  // Parallel warehouse map — same keys, warehouse (actual) portion only.
  const labelToWarehouse: Record<string, number> = split ? {
    "1DP": canonWh["1dayPureUP (32P)"] ?? 0,
    "1DP ASTIG": canonWh["1dayPureUP Astig (32P)"] ?? 0,
    "1DP MS": canonWh["1dayPureUP Multistage (32P)"] ?? 0,
    "1DP V.S": canonWh["1 Day View Support"] ?? 0,
    "1DP EDOF": canonWh["1dayPureUP EDOF (32P)"] ?? 0,
    "1D SILFA": canonWh["1dayPure Silfa"] ?? 0,

    "Mfine UV+": canonWh["MonthlyFine Plus (3P)"] ?? 0,
    "MTPure3": canonWh["Monthly Pure 3"] ?? 0,
    "MTPure6": canonWh["Monthly Pure 6"] ?? 0,
    "2WK Pure": canonWh["2weekPure Up (6P)"] ?? 0,
    "2WK Multi": canonWh["2weekPure Multistage (6P)"] ?? 0,
    "2WK Toric": canonWh["2weekPure Up Toric"] ?? 0,

    "EC-10 M": canonWh["Eye coffret-M"] ?? 0,
    "EC-10 M Toric": canonWh["Eye Coffret-M 10 Toric"] ?? 0,
    "EM-30 M Toric": canonWh["Eye Coffret-M 30 Toric"] ?? 0,
    "Minasoft Col Sihy": canonWh["Minasoft 1Day Color UV"] ?? 0,
    "Minasoft Care Sihy": canonWh["Minasoft Care UV"] ?? 0,

    "MC - Blue": mcuvWh.BLUE,
    "MC - Orange": mcuvWh.ORANGE,
    "MC - II": canonWh["MonthlyColour UV II"] ?? 0,
    "MC-Pega (Old)": mcuvWh.PEGA,

    "DISOP H202 SOL": canonWh["DISOP H2O2 Solution"] ?? 0,
    "DISOP A. ULTRA": canonWh["DISOP Ultra Eyedrop"] ?? 0,
    "DISOP A.Dual Gel": 0,
    "BOC": canonWh["Breath O Correct"] ?? 0,
  } : {};

  // Dual Gel is identified by raw description (no canonical mapping for it).
  for (const s of stock.rows) {
    if (/Acuaiss\s*Dual\s*Gel/i.test(s.description)) {
      labelToTotal["DISOP A.Dual Gel"] += s.balance;
      if (split) labelToWarehouse["DISOP A.Dual Gel"] += s.warehouseBalance;
    }
  }

  // BOC consignment is sourced from its own file — not derivable from the
  // master. When provided, it overrides the "BOC" slot's consignment.
  const hasBoc = typeof bocConsignment === "number";

  const groups = INVENTORY_GROUPS.map(g => ({
    name: g.name,
    rows: g.products.map((p): Row => {
      const total = labelToTotal[p] ?? 0;
      if (p === "BOC" && hasBoc) {
        // Warehouse still comes from the master/HQ split (or total in legacy
        // mode); consignment is the dedicated BOC file's grand total.
        const warehouse = split ? (labelToWarehouse[p] ?? 0) : total;
        return { product: p, warehouse, consignment: bocConsignment! };
      }
      if (!split) {
        // Legacy: master file only — everything is warehouse, consignment unknown.
        return { product: p, warehouse: total, consignment: null };
      }
      const warehouse = labelToWarehouse[p] ?? 0;
      const consignment = Math.max(0, total - warehouse);
      return { product: p, warehouse, consignment };
    }),
  }));

  const totalAll = Object.values(labelToTotal).reduce((s, v) => s + v, 0);
  const totalWarehouse = split
    ? Object.values(labelToWarehouse).reduce((s, v) => s + v, 0)
    : totalAll;
  // Roll the explicit BOC consignment into the grand total. In split mode the
  // master-derived BOC consignment is ~0 (BOC isn't in the master), so adding
  // the file figure doesn't double-count.
  let totalConsignment = split ? Math.max(0, totalAll - totalWarehouse) : null;
  if (hasBoc) {
    const masterBocConsignment = split
      ? Math.max(0, (labelToTotal["BOC"] ?? 0) - (labelToWarehouse["BOC"] ?? 0))
      : 0;
    totalConsignment = (totalConsignment ?? 0) - masterBocConsignment + bocConsignment!;
  }

  return {
    groups,
    totalWarehouse,
    totalConsignment,
    commentary: "",
  };
}
