// Repair / re-link the month chain.
//
// Each monthly report has data that implicitly depends on its neighbours:
//   • Slide 7 Sales Quantity  — YTD total column is a sum of all earlier 2026 months
//   • Slide 10 Sales by Region — growth% compares salesThis vs the prior month's salesThis
//   • Slide 1 / Slide 3 Sales Achievement — 12-slot arrays must stay the full length
//   • Slide 7 product list    — must include every CANONICAL_PRODUCTS entry
//
// This endpoint walks every month chronologically, recomputes those cross-month
// fields, heals any truncated arrays, and saves the result back. It's safe to
// call repeatedly — it's idempotent.

import { NextResponse } from "next/server";
import { listMonthReports, upsertMonthReport } from "@/lib/month-report";
import { CANONICAL_PRODUCTS } from "@/lib/catalog/products";
import type { MonthReport, SalesByQuantity, SalesByRegion, SalesAchievement, SalesByECP, Inventory } from "@/lib/schema";
import { REGIONS } from "@/lib/catalog/mappings";

type RepairReport = {
  id: string;
  changed: boolean;
  notes: string[];
};

function ensure12(arr: (number | null)[] | undefined | null): (number | null)[] {
  const out = Array.from(arr ?? []) as (number | null)[];
  while (out.length < 12) out.push(null);
  return out.slice(0, 12);
}

function healSalesAchievement(sa: SalesAchievement | null): { value: SalesAchievement | null; changed: boolean } {
  if (!sa) return { value: null, changed: false };
  const nextTarget = ensure12(sa.target2026);
  const nextActual = ensure12(sa.actual2026);
  const nextPrior  = ensure12(sa.actual2025);
  const nextNi26   = ensure12(sa.netIncome2026);
  const nextNi25   = ensure12(sa.netIncome2025);
  const changed =
    nextTarget.length !== sa.target2026.length ||
    nextActual.length !== sa.actual2026.length ||
    nextPrior.length  !== sa.actual2025.length ||
    nextNi26.length   !== sa.netIncome2026.length ||
    nextNi25.length   !== sa.netIncome2025.length;
  return {
    value: {
      target2026: nextTarget,
      actual2026: nextActual,
      actual2025: nextPrior,
      netIncome2026: nextNi26,
      netIncome2025: nextNi25,
      kpi: sa.kpi,
    },
    changed,
  };
}

function healProducts(sq: SalesByQuantity | null): { value: SalesByQuantity | null; changed: boolean } {
  if (!sq) return { value: null, changed: false };
  const byProduct = new Map(sq.rows.map(r => [r.product, r]));
  let changed = false;
  const merged = CANONICAL_PRODUCTS.map(p => {
    const existing = byProduct.get(p);
    if (existing) return existing;
    changed = true;
    return { product: p, qty2026: 0, qty2025: 0 };
  });
  // Preserve any extra custom products the user typed in manually.
  for (const r of sq.rows) {
    if (!CANONICAL_PRODUCTS.includes(r.product as typeof CANONICAL_PRODUCTS[number])) {
      merged.push(r);
    }
  }
  return { value: { rows: merged, commentary: sq.commentary ?? "" }, changed };
}

function recomputeEcpPct(curr: SalesByECP | null): { value: SalesByECP | null; changed: boolean } {
  if (!curr) return { value: null, changed: false };
  const total = curr.rows.reduce((s, r) => s + (r.salesMyr || 0), 0);
  const nextRows = curr.rows.map(r => ({
    ...r,
    pct: total ? r.salesMyr / total : 0,
  }));
  const changed = nextRows.some((r, i) => Math.abs(r.pct - curr.rows[i].pct) > 1e-6);
  return { value: { rows: nextRows, commentary: curr.commentary ?? "" }, changed };
}

function recomputeInventoryTotals(curr: Inventory | null): { value: Inventory | null; changed: boolean } {
  if (!curr) return { value: null, changed: false };
  let tw = 0, tc = 0, anyW = false, anyC = false;
  for (const g of curr.groups) {
    for (const row of g.rows) {
      if (row.warehouse != null) { tw += row.warehouse; anyW = true; }
      if (row.consignment != null) { tc += row.consignment; anyC = true; }
    }
  }
  const nextW = anyW ? tw : null;
  const nextC = anyC ? tc : null;
  const changed = nextW !== curr.totalWarehouse || nextC !== curr.totalConsignment;
  return {
    value: { ...curr, totalWarehouse: nextW, totalConsignment: nextC },
    changed,
  };
}

function recomputeRegion(curr: SalesByRegion | null, prev: MonthReport | undefined): { value: SalesByRegion | null; changed: boolean } {
  if (!curr) return { value: null, changed: false };
  const priorByRegion = new Map((prev?.salesByRegion?.rows ?? []).map(r => [r.region, r.salesThis]));
  const next: SalesByRegion = {
    rows: REGIONS.map(region => {
      const existing = curr.rows.find(r => r.region === region) ?? { region, salesThis: 0, salesPrev: 0, growthPct: 0 };
      const salesPrev = priorByRegion.get(region) ?? 0;
      const growth = salesPrev ? (existing.salesThis - salesPrev) / salesPrev : 0;
      return { region, salesThis: existing.salesThis, salesPrev, growthPct: growth };
    }),
    commentary: curr.commentary ?? "",
  };
  const changed = JSON.stringify(next.rows) !== JSON.stringify(curr.rows);
  return { value: next, changed };
}

export async function POST() {
  const all = await listMonthReports();
  // Chronological order so each month can look at the *healed* prior month.
  const ordered = [...all].sort((a, b) => a.year - b.year || a.month - b.month);
  const results: RepairReport[] = [];
  let priorHealed: MonthReport | undefined;

  for (const m of ordered) {
    const notes: string[] = [];
    let changed = false;

    const sa = healSalesAchievement(m.salesAchievement);
    if (sa.changed) { notes.push("sales-achievement arrays padded to 12 months"); changed = true; }

    const sq = healProducts(m.salesByQuantity);
    if (sq.changed) { notes.push("sales-quantity product list re-aligned to catalogue"); changed = true; }

    const region = recomputeRegion(m.salesByRegion, priorHealed);
    if (region.changed) { notes.push("region growth% relinked to prior month"); changed = true; }

    const ecp = recomputeEcpPct(m.salesByECP);
    if (ecp.changed) { notes.push("ECP category % recomputed from salesMyr"); changed = true; }

    const inv = recomputeInventoryTotals(m.inventory);
    if (inv.changed) { notes.push("inventory totals recomputed from rows"); changed = true; }

    const healed: MonthReport = {
      ...m,
      salesAchievement: sa.value,
      salesByQuantity: sq.value,
      salesByRegion: region.value,
      salesByECP: ecp.value,
      inventory: inv.value,
    };

    if (changed) {
      await upsertMonthReport(healed);
    }
    results.push({ id: m.id, changed, notes });
    priorHealed = healed;
  }

  return NextResponse.json({
    ok: true,
    monthsChecked: results.length,
    monthsChanged: results.filter(r => r.changed).length,
    results,
  });
}
