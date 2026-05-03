// Turn parsed POS artefacts into section JSON (the Zod-typed shapes in src/lib/schema.ts).
// Deterministic + pure — every function takes its inputs explicitly, no DB reads.

import { CANONICAL_PRODUCTS, CanonicalProduct } from "@/lib/catalog/products";
import { classifyECP, classifyRegion, ECP_CATEGORIES, REGIONS } from "@/lib/catalog/mappings";
import type { PosMasterParseResult, PosMasterRow, PosMcuvParseResult } from "@/lib/parsers/pos-pdf";
import type { OutletRow, EcpListEntry, RegionXlsxEntry } from "@/lib/parsers/pos-xlsx";
import type { SalesByECP, SalesByQuantity, SalesByRegion, TopProducts } from "@/lib/schema";

// --- Top-line grand-total sales figure (feeds SalesAchievement row) ---
export function grandTotalMyr(master: PosMasterParseResult): number {
  return master.rows
    .filter(r => r.suffix !== "TR" && r.suffix !== "T") // exclude trial lenses only
    .reduce((s, r) => s + r.netSales, 0);
}

// --- Slide 7: Sales Quantity by Product (2026 vs 2025) ---
// MCUV colour PDFs feed the 3 MC lines; master PDF feeds everything else.
export function salesByQuantity(
  master: PosMasterParseResult,
  mcuv: PosMcuvParseResult[],
  priorYearQty: Partial<Record<CanonicalProduct, number>> = {},
): SalesByQuantity {
  const qty = new Map<string, number>();
  for (const p of CANONICAL_PRODUCTS) qty.set(p, 0);

  const haveMcuvFor = new Set(mcuv.map(m => m.canonicalProduct).filter((x): x is string => !!x));
  for (const row of master.rows) {
    if (!row.product) continue;
    // When a dedicated MCUV breakdown PDF is uploaded for a given variant,
    // skip the master's rollup row for that variant to avoid double counting.
    if (haveMcuvFor.has(row.product)) continue;
    qty.set(row.product, (qty.get(row.product) ?? 0) + row.qty);
  }
  for (const m of mcuv) {
    if (!m.canonicalProduct) continue;
    qty.set(m.canonicalProduct, m.grandTotal.qty);
  }

  return {
    rows: CANONICAL_PRODUCTS.map(p => ({
      product: p,
      qty2026: qty.get(p) ?? 0,
      qty2025: priorYearQty[p] ?? 0,
    })),
    commentary: "",
  };
}

// --- Slide 8: Top-contribution ranking by MYR Net Sales ---
export function topProducts(
  master: PosMasterParseResult,
  mcuv: PosMcuvParseResult[],
): TopProducts {
  const myrByProduct = new Map<string, number>();
  const push = (p: string | null, n: number) => {
    if (!p || !n) return;
    myrByProduct.set(p, (myrByProduct.get(p) ?? 0) + n);
  };
  const haveMcuvFor = new Set(mcuv.map(m => m.canonicalProduct).filter((x): x is string => !!x));
  for (const r of master.rows) {
    if (r.product && !haveMcuvFor.has(r.product)) push(r.product, r.netSales);
  }
  for (const m of mcuv) push(m.canonicalProduct, m.grandTotal.amt);

  const all = [...myrByProduct.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalMyr = all.reduce((s, [, v]) => s + v, 0);
  const rows = all.map(([product, myr]) => ({
    product,
    myr,
    pct: totalMyr ? myr / totalMyr : 0,
  }));
  return { rows, totalMyr, commentary: "" };
}

// --- Slide 9: Sales by ECP category ---
export function salesByECP(outlets: OutletRow[], ecpList: EcpListEntry[] = []): SalesByECP {
  const typeByStore = new Map(ecpList.map(e => [e.storeName.toUpperCase(), e.type]));
  const agg = new Map<string, { outlets: Set<string>; sales: number }>();
  for (const cat of ECP_CATEGORIES) agg.set(cat, { outlets: new Set(), sales: 0 });

  for (const row of outlets) {
    const typ = row.accountType || typeByStore.get(row.customerName.toUpperCase()) || "";
    const cat = classifyECP(typ);
    const bucket = agg.get(cat)!;
    bucket.outlets.add(row.customerName);
    bucket.sales += row.amount;
  }
  const totalSales = [...agg.values()].reduce((s, v) => s + v.sales, 0) || 1;
  return {
    rows: ECP_CATEGORIES.map(category => {
      const b = agg.get(category)!;
      return {
        category,
        outlets: b.outlets.size,
        pct: b.sales / totalSales,
        salesMyr: b.sales,
      };
    }),
    commentary: "",
  };
}

// --- Slide 10: Sales by Region, from the dedicated "Sales Analysis By Region" Excel ---
// Preferred path when the POS can export the grouped-by-state sheet — every
// state total comes straight from the file, no outlet-level joining required.
export function salesByRegionFromStates(
  stateTotals: RegionXlsxEntry[],
  priorMonth: { region: string; sales: number }[] = [],
): SalesByRegion {
  const totals = new Map<string, number>();
  for (const r of REGIONS) totals.set(r, 0);
  for (const entry of stateTotals) {
    if (entry.kind !== "state") continue; // skip country rollups like INDONESIA/PAKISTAN
    const region = classifyRegion(entry.state);
    if (!region) continue;
    totals.set(region, (totals.get(region) ?? 0) + entry.sales);
  }
  const prev = new Map(priorMonth.map(p => [p.region, p.sales]));
  return {
    rows: REGIONS.map(region => {
      const salesThis = totals.get(region) ?? 0;
      const salesPrev = prev.get(region) ?? 0;
      const growthPct = salesPrev ? (salesThis - salesPrev) / salesPrev : 0;
      return { region, salesThis, salesPrev, growthPct };
    }),
    commentary: "",
  };
}

// --- Slide 10: Sales by Region, from the outlet-level Excel + ECP list join. ---
// Fallback when only the Monthly Sales Performance file is provided.
export function salesByRegion(
  outlets: OutletRow[],
  ecpList: EcpListEntry[],
  priorMonth: { region: string; sales: number }[] = [],
): SalesByRegion {
  const stateByStore = new Map(ecpList.map(e => [e.storeName.toUpperCase(), e.state]));
  const totals = new Map<string, number>();
  for (const r of REGIONS) totals.set(r, 0);
  for (const row of outlets) {
    const state = stateByStore.get(row.customerName.toUpperCase());
    const region = classifyRegion(state);
    if (!region) continue; // skip unmapped outlets rather than dumping them into the first region
    totals.set(region, (totals.get(region) ?? 0) + row.amount);
  }
  const prev = new Map(priorMonth.map(p => [p.region, p.sales]));
  return {
    rows: REGIONS.map(region => {
      const salesThis = totals.get(region) ?? 0;
      const salesPrev = prev.get(region) ?? 0;
      const growthPct = salesPrev ? (salesThis - salesPrev) / salesPrev : 0;
      return { region, salesThis, salesPrev, growthPct };
    }),
    commentary: "",
  };
}

// --- Utility: surface unmapped SKUs for the UI drawer ---
export function unmappedSkus(master: PosMasterParseResult): { code: string; desc: string; netSales: number; qty: number }[] {
  const excluded = /PRM$|TR$|FC$|T$/;
  return master.unmapped
    .filter(r => !excluded.test(r.code) && (r.netSales > 0 || r.qty > 0))
    .map(r => ({ code: r.code, desc: r.description, netSales: r.netSales, qty: r.qty }));
}

// Prior-year quantity: pulled from a neighbouring month report when present.
// Helper to convert a MonthReport.salesByQuantity into a lookup map.
export function priorYearQtyLookup(prior: SalesByQuantity | null): Partial<Record<CanonicalProduct, number>> {
  const m: Partial<Record<CanonicalProduct, number>> = {};
  if (!prior) return m;
  for (const row of prior.rows) (m as Record<string, number>)[row.product] = row.qty2026;
  return m;
}

// Re-export for convenience.
export type { PosMasterRow };
