// Client for the salesdashboard HQ Summary API.
//
// salesdashboard (sibling app at sales.seedclmalaysiastore.com) parses the
// per-invoice Stock-Detail files uploaded there and computes the authoritative
// per-product × per-month qty + MYR grid — the same grid the SEED(M) Sales
// Summary Excel export is built from. Instead of asking the operator to
// re-export + upload that workbook here each month, we fetch the grid as
// JSON over HTTP and feed it into the same HQ-override pipeline that handles
// an uploaded Summary workbook.
//
// Returns a `Year2025Reference`-shaped object so the existing
// applyHqCustomerSplitRows / applyYear2025ToReport / autoFixDriftFromSummary
// code paths work unchanged.
//
// Env (set in Vercel on gmdashboard):
//   SALESDASHBOARD_URL         — e.g. "https://sales.seedclmalaysiastore.com"
//   SALESDASHBOARD_API_KEY     — shared secret, matches HQ_SUMMARY_API_KEY on salesdashboard

import type { CanonicalProduct } from "@/lib/catalog/products";
import type { Year2025Reference } from "@/lib/parsers/year-2025";

// salesdashboard's REPORT_PRODUCTS labels → our CanonicalProduct labels.
// Mirrors the NAME_MAP in year-2025.ts, which parses the HQ workbook that
// salesdashboard generates. Keep both in sync.
const API_NAME_MAP: Record<string, CanonicalProduct> = {
  "1 DAY PURE": "1dayPureUP (32P)",
  "1 DAY PURE SILFA": "1dayPure Silfa",
  "1 DAY PURE ASTIGMATISM": "1dayPureUP Astig (32P)",
  "1 DAY MULSTISTAGE": "1dayPureUP Multistage (32P)",
  "1 DAYPURE EDOF": "1dayPureUP EDOF (32P)",
  "1 DAY VIEW SUPPORT": "1 Day View Support",
  "2 WEEK PURE MULTISTAGE": "2weekPure Multistage (6P)",
  "2 WEEK PURE UP TORIC": "2weekPure Up Toric",
  "2 WEEK PURE UP": "2weekPure Up (6P)",
  "EYE COFFRET-M": "Eye coffret-M",
  "EYE COFFRET-M 10 TORIC": "Eye Coffret-M 10 Toric",
  "EYE COFFRET-M 30 TORIC": "Eye Coffret-M 30 Toric",
  "MONTHLY FINE PLUS": "MonthlyFine Plus (3P)",
  "MONTHLY PURE3": "Monthly Pure 3",
  "MONTHLY PURE6": "Monthly Pure 6",
  "MONTHLY COLOR UV - PEGAVISION": "MonthlyColour UV - Pegavision",
  "MONTHLY COLOR UV - BLUE": "MonthlyColour UV - Blue",
  "MONTHLY COLOR UV - ORANGE": "MonthlyColour UV - Orange",
  "MONTHLY COLOR UV  II": "MonthlyColour UV II",
  "MONTHLY COLOR UV II": "MonthlyColour UV II", // tolerate single-space variant
  "MINASOFT 1DAY COLOR UV": "Minasoft 1Day Color UV",
  "MINASOFT CARE UV": "Minasoft Care UV",
  "RGP UV-1 / UV-1 KC": "UV-1 / UV-1 KC",
  "RGP AS-LUNA/O2 NOAH": "As-Luna / O2 Noah",
  "IRIS LENS": "Iris Lens",
  "ULTRA VISION": "Ultra Vision",
  "BREATH O CORRECT": "Breath O Correct",
  "BREATH O CORRECT (OVERSEAS)": "Breath O Correct (Overseas)",
  "WOHLK KE RGP": "Wohlk KE RGP",
  "DISOP H2O2 SOLUTION": "DISOP H2O2 Solution",
  "DISOP ULTRA EYEDROP": "DISOP Ultra Eyedrop",
  "DISOP ACUAISS DUAL GEL EYEDROP": "DISOP Acuaiss Dual Gel Eyedrop",
  "ACCESSORIES/OTHERS": "Accessories / Others",
};

interface HqSummaryApiResponse {
  year: number;
  generatedAt: string;
  sources: { name: string; uploadedAt: string | null }[];
  products: Record<string, { qty: number[]; amount: number[] }>;
  unmapped: Record<string, { qty: number; amount: number }>;
}

/**
 * Fetch the live HQ Summary grid from salesdashboard. Returns null when the
 * env vars are missing (feature disabled) OR the fetch fails for any reason
 * — callers should fall back to the on-file Summary workbook ref.
 */
export async function fetchHqSummaryFromSalesDashboard(year: number): Promise<{
  ref: Year2025Reference;
  sources: HqSummaryApiResponse["sources"];
  generatedAt: string;
} | null> {
  const base = process.env.SALESDASHBOARD_URL;
  const key = process.env.SALESDASHBOARD_API_KEY;
  if (!base || !key) return null;

  const url = `${base.replace(/\/+$/, "")}/api/hq-summary?year=${year}`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "GET",
      headers: { "X-API-Key": key },
      // Repair chain is server-side; no cache so we always get the freshest
      // aggregation from the latest Stock-Detail uploads.
      cache: "no-store",
    });
  } catch (e) {
    console.error("[salesdashboard] fetch failed:", e);
    return null;
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    console.error(`[salesdashboard] HTTP ${resp.status}: ${body.slice(0, 200)}`);
    return null;
  }

  let json: HqSummaryApiResponse;
  try {
    json = await resp.json();
  } catch (e) {
    console.error("[salesdashboard] response not JSON:", e);
    return null;
  }

  // Translate salesdashboard product labels → CanonicalProduct and pad series
  // to a stable 12-slot (number | null)[] shape. Zeros are preserved; the API
  // returns 0 when a product has no activity in that month, which is a
  // positive "zero sales" signal (not a null "we don't know").
  const productQty: Year2025Reference["productQty"] = {};
  const productAmount: Year2025Reference["productAmount"] = {};
  for (const [apiName, series] of Object.entries(json.products)) {
    const canonical = API_NAME_MAP[apiName];
    if (!canonical) continue; // unknown product on the API side — ignore
    productQty[canonical] = padTo12(series.qty);
    productAmount[canonical] = padMyrTo12(series.amount);
  }

  // --- Wohlk collapse ---
  // salesdashboard rolls every Wohlk sale (Sph / Toric / KE) into a single
  // "Wohlk KE RGP" row. gmdashboard has three canonical rows for Wohlk, so
  // without collapsing them the dashboard total would double-count by the
  // Sph+Toric amount that's ALREADY inside the API's KE RGP figure. For every
  // month the API reports Wohlk KE RGP data, zero out the sibling Sph/Toric
  // rows so KE RGP alone carries the Wohlk total. If the API has no Wohlk
  // row for a month (series missing), leave Sph/Toric at their master values.
  const wohlkKe = productQty["Wohlk KE RGP"];
  if (wohlkKe) {
    const sphQty: (number | null)[] = Array(12).fill(0);
    const toricQty: (number | null)[] = Array(12).fill(0);
    const sphMyr: (number | null)[] = Array(12).fill(0);
    const toricMyr: (number | null)[] = Array(12).fill(0);
    // Preserve null when the API didn't report Wohlk for a month — don't
    // force Sph/Toric to 0 then (master-driven value stays).
    for (let i = 0; i < 12; i++) {
      if (wohlkKe[i] == null) { sphQty[i] = null; toricQty[i] = null; sphMyr[i] = null; toricMyr[i] = null; }
    }
    productQty["Wohlk Contact Life Sph"] = sphQty;
    productQty["Wohlk Contact Life Toric"] = toricQty;
    productAmount["Wohlk Contact Life Sph"] = sphMyr;
    productAmount["Wohlk Contact Life Toric"] = toricMyr;
  }

  // monthlyTarget / monthlySales / monthlyQty aren't served by the API — the
  // Summary workbook workflow still owns Slide 1 target/actual. Set them to
  // all-nulls so applyYear2025ToReport doesn't accidentally wipe target2026.
  const nulls: (number | null)[] = Array(12).fill(null);
  const ref: Year2025Reference = {
    year: json.year,
    monthlySales: nulls,
    monthlyQty: nulls,
    monthlyTarget: nulls,
    productQty,
    productAmount,
  };
  return { ref, sources: json.sources, generatedAt: json.generatedAt };
}

function padTo12(a: number[]): (number | null)[] {
  // salesdashboard rounds qty to 2 decimals (trial-lens pack divisions
  // produce fractional pieces like 1.17). The dashboard's Zod schema
  // requires integer qty, so round here before handing the series on —
  // without this, upsertMonthReport fails validation and the whole
  // Repair-chain write is discarded with a ZodError.
  const out: (number | null)[] = [];
  for (let i = 0; i < 12; i++) {
    const v = a[i];
    out.push(typeof v === "number" ? Math.round(v) : null);
  }
  return out;
}

/** Same as padTo12 but preserves 2-decimal precision — used for MYR series
 *  where fractional ringgit are meaningful (Slide 6 totals tie out to the sen). */
function padMyrTo12(a: number[]): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < 12; i++) {
    const v = a[i];
    out.push(typeof v === "number" ? Math.round(v * 100) / 100 : null);
  }
  return out;
}
