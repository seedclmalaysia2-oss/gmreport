import type { MonthReport } from "../schema";
import { monthNameFull } from "../utils";

export type OutlookFacts = {
  monthLabel: string;
  priorMonthLabel: string | null;
  presenter: string;
  fxRate: number;

  sales: {
    actualMyr: number | null;
    targetMyr: number | null;
    priorYearMyr: number | null;
    attainmentPct: number | null;
    yoyPct: number | null;
    priorMonthMyr: number | null;
    momPct: number | null;
    ytdMyr: number | null;
    ytdPriorYearMyr: number | null;
    ytdYoyPct: number | null;
  } | null;

  topProductsByMyr: { product: string; myr: number; pct: number }[];
  softProducts: { product: string; qty2026: number; qty2025: number; dropPct: number }[];

  channel: { largest: string; pct: number; salesMyr: number } | null;

  region: {
    leader: { region: string; growthPct: number } | null;
    laggard: { region: string; growthPct: number } | null;
  } | null;

  risks: {
    writeOffMyr: number | null;
    writeOffQty: number | null;
    inventoryWarehouseMyr: number | null;
  };
};

function safeNum(n: number | null | undefined): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function sum(arr: (number | null)[] | undefined, upto: number): number | null {
  if (!arr) return null;
  let total = 0;
  let any = false;
  for (let i = 0; i <= upto && i < arr.length; i++) {
    const v = arr[i];
    if (typeof v === "number" && Number.isFinite(v)) { total += v; any = true; }
  }
  return any ? total : null;
}

export function buildOutlookFacts(current: MonthReport, prior: MonthReport | null): OutlookFacts {
  const monthIdx = current.month - 1;

  const sa = current.salesAchievement;
  const actual = sa ? safeNum(sa.actual2026[monthIdx]) : null;
  const target = sa ? safeNum(sa.target2026[monthIdx]) : null;
  const py = sa ? safeNum(sa.actual2025[monthIdx]) : null;
  const priorMonth = sa && monthIdx > 0 ? safeNum(sa.actual2026[monthIdx - 1]) : null;

  const ytd = sa ? sum(sa.actual2026, monthIdx) : null;
  const ytdPy = sa ? sum(sa.actual2025, monthIdx) : null;

  const attainmentPct = actual != null && target != null && target !== 0 ? actual / target : null;
  const yoyPct = actual != null && py != null && py !== 0 ? (actual - py) / py : null;
  const momPct = actual != null && priorMonth != null && priorMonth !== 0 ? (actual - priorMonth) / priorMonth : null;
  const ytdYoyPct = ytd != null && ytdPy != null && ytdPy !== 0 ? (ytd - ytdPy) / ytdPy : null;

  const sales = sa ? {
    actualMyr: actual,
    targetMyr: target,
    priorYearMyr: py,
    attainmentPct,
    yoyPct,
    priorMonthMyr: priorMonth,
    momPct,
    ytdMyr: ytd,
    ytdPriorYearMyr: ytdPy,
    ytdYoyPct,
  } : null;

  const topProductsByMyr = (current.topProducts?.rows ?? [])
    .slice()
    .sort((a, b) => b.myr - a.myr)
    .slice(0, 3)
    .map(r => ({ product: r.product, myr: r.myr, pct: r.pct }));

  const softProducts = (current.salesByQuantity?.rows ?? [])
    .filter(r => r.qty2025 > 0 && r.qty2026 < r.qty2025 * 0.85)
    .map(r => ({
      product: r.product,
      qty2026: r.qty2026,
      qty2025: r.qty2025,
      dropPct: (r.qty2026 - r.qty2025) / r.qty2025,
    }))
    .sort((a, b) => a.dropPct - b.dropPct)
    .slice(0, 3);

  const ecpRows = current.salesByECP?.rows ?? [];
  const largest = ecpRows.slice().sort((a, b) => b.pct - a.pct)[0];
  const channel = largest ? { largest: largest.category, pct: largest.pct, salesMyr: largest.salesMyr } : null;

  const regionRows = current.salesByRegion?.rows ?? [];
  const sortedByGrowth = regionRows.slice().sort((a, b) => b.growthPct - a.growthPct);
  const region = regionRows.length
    ? {
        leader: sortedByGrowth[0] ? { region: sortedByGrowth[0].region, growthPct: sortedByGrowth[0].growthPct } : null,
        laggard: sortedByGrowth[sortedByGrowth.length - 1] ? {
          region: sortedByGrowth[sortedByGrowth.length - 1].region,
          growthPct: sortedByGrowth[sortedByGrowth.length - 1].growthPct,
        } : null,
      }
    : null;

  const writeOffRows = current.expireWriteOff?.rows ?? [];
  const writeOffMyr = writeOffRows.length ? writeOffRows.reduce((s, r) => s + (r.amt || 0), 0) : null;
  const writeOffQty = writeOffRows.length ? writeOffRows.reduce((s, r) => s + (r.qty || 0), 0) : null;

  const inv = current.inventory;
  const inventoryWarehouseMyr = inv ? safeNum(inv.totalWarehouse) : null;

  return {
    monthLabel: `${monthNameFull(current.month)} ${current.year}`,
    priorMonthLabel: prior ? `${monthNameFull(prior.month)} ${prior.year}` : null,
    presenter: current.presenter,
    fxRate: current.fxRate,
    sales,
    topProductsByMyr,
    softProducts,
    channel,
    region,
    risks: { writeOffMyr, writeOffQty, inventoryWarehouseMyr },
  };
}
