// Seed DB with the exact figures pulled from the user's sample decks so the UI
// has real data to show and exports can be compared against the originals.
import { upsertMonthReport } from "@/lib/month-report";
import type { MonthReport } from "@/lib/schema";

const target2026 = [322860, 268004, 308134, 321214, 285093, 436306, 314813, 279986, 340133, 409971, 430927, 448462];
const actual2026 = [411381.22, 304589.39, 323818.71, null, null, null, null, null, null, null, null, null];
const actual2025 = [300142.49, 237850.93, 251730.75, 290926, 229079.78, 441765.46, 297505.44, 252462.98, 290588.2, 337040.48, 314266.73, 476261.71];
const ni2026 =     [47495.13, 38164.89, 45756.37, null, null, null, null, null, null, null, null, null];
const ni2025 =     [5899.24, 30089.16, 17112.73, 16103.66, 14518.04, 92598.2, 23327.66, 13059, 15770.76, 41849, 55110, -148327];

const sa = {
  target2026, actual2026, actual2025, netIncome2026: ni2026, netIncome2025: ni2025,
  kpi: [
    { month: 1, achievementPct: 1.27, yoyPct: 1.37, newStores: 11, ecpThis: 365, ecpPrior: 303, plMyr: 47495, plJpy: 1459434, extraLines: [] },
    { month: 2, achievementPct: 1.14, yoyPct: 1.28, newStores: 2, ecpThis: 311, ecpPrior: 268, plMyr: 38165, plJpy: 1172911, extraLines: [] },
    { month: 3, achievementPct: 1.05, yoyPct: 1.29, newStores: 2, ecpThis: 304, ecpPrior: 265, plMyr: 45756, plJpy: 1406094, extraLines: [] },
  ],
};

const marchOutlook = `Malaysia's economy continues to show resilience in early 2026, supported by strong domestic demand, festive spending, and stable labor conditions. Growth momentum remains positive despite global uncertainties, elevated oil prices, and geopolitical tensions.

Services Sector
• Retail & wholesale trade remained strong due to Ramadan and early Raya preparations.
• Tourism activity continued to recover, supporting accommodation and F&B segments.
• Transportation services saw stable demand.

Implications for Contact Lens & Eye-Care Sector
• Retailers adopted cautious inventory planning, balancing steady demand with potential cost pressures from global supply chain uncertainties.
• Consumer spending remained resilient, with no major disruptions affecting optical retail performance in March.
• Overall sector outlook remained positive, supported by strong domestic fundamentals and stable operating conditions.`;

const marchDailyQty = [
  305, 340, 290, 330, 0, 0, 260, 410, 380, 360, 340, 0, 0,
  320, 300, 360, 280, 260, 0, 0, 310, 340, 290, 300, 280, 0,
  0, 110, 80, 250, 300,
];

const marchDaily = {
  days: marchDailyQty.map((qty, i) => ({ date: `2026-03-${String(i + 1).padStart(2, "0")}`, qty })),
  holidays: [{ date: "2026-03-17", label: "Nuzul Al-Quran - PH" }, { date: "2026-03-31", label: "Hari Raya Aidilfitri - PH" }],
  commentary: "In March we had the nationwide muslim new year (Hari Raya) — Fri/Sat + Monday add'l PH caused a long break for the muslim community. EDOF 253 boxes aligned with our 200/mo target. Total 1daypure series (1dp/1dpa/1dms/1dVS/Silfa/EDOF) contributed RM148,704 = 45% of March's RM323,819 sales. Q1 complete; Q2 focus on navigating rising fuel and logistics costs.",
};

const marchSalesByQuantity = {
  rows: [
    { product: "1dayPureUP (32P)", qty2026: 1140, qty2025: 888 },
    { product: "1dayPure Silfa", qty2026: 169, qty2025: 72 },
    { product: "1dayPureUP Astig (32P)", qty2026: 543, qty2025: 371 },
    { product: "1dayPureUP Multistage (32P)", qty2026: 42, qty2025: 19 },
    { product: "1dayPureUP EDOF (32P)", qty2026: 253, qty2025: 190 },
    { product: "1 Day View Support", qty2026: 14, qty2025: 11 },
    { product: "2weekPure Multistage (6P)", qty2026: 12, qty2025: 94 },
    { product: "2weekPure Up Toric", qty2026: 5, qty2025: 20 },
    { product: "2weekPure Up (6P)", qty2026: 24, qty2025: 126 },
    { product: "Eye coffret-M", qty2026: 1667, qty2025: 1186 },
    { product: "Eye Coffret-M 10 Toric", qty2026: 105, qty2025: 95 },
    { product: "Eye Coffret-M 30 Toric", qty2026: 52, qty2025: 41 },
    { product: "MonthlyFine Plus (3P)", qty2026: 185, qty2025: 166 },
    { product: "Monthly Pure 3", qty2026: 16, qty2025: 64 },
    { product: "Monthly Pure 6", qty2026: 348, qty2025: 553 },
    { product: "MonthlyColour UV - Pegavision", qty2026: 117, qty2025: 373 },
    { product: "MonthlyColour UV - Blue", qty2026: 1660, qty2025: 773 },
    { product: "MonthlyColour UV - Orange", qty2026: 165, qty2025: 151 },
    { product: "MonthlyColour UV II", qty2026: 421, qty2025: 200 },
    { product: "Minasoft 1Day Color UV", qty2026: 143, qty2025: 100 },
    { product: "Minasoft Care UV", qty2026: 168, qty2025: 0 },
    { product: "UV-1 / UV-1 KC", qty2026: 6, qty2025: 9 },
    { product: "As-Luna / O2 Noah", qty2026: 10, qty2025: 4 },
    { product: "Iris Lens", qty2026: 10, qty2025: 2 },
    { product: "Ultra Vision", qty2026: 35, qty2025: 15 },
    { product: "Breath O Correct", qty2026: 32, qty2025: 33 },
    { product: "Wohlk KE RGP", qty2026: 0, qty2025: 0 },
    { product: "DISOP H2O2 Solution", qty2026: 368, qty2025: 393 },
    { product: "DISOP Ultra Eyedrop", qty2026: 934, qty2025: 638 },
  ],
};

const marchTop = {
  rows: [
    { product: "1dayPureUP (32P)", myr: 63470, pct: 0.196 },
    { product: "1dayPureUP Astig (32P)", myr: 47785, pct: 0.148 },
    { product: "Eye Coffret-M", myr: 40828, pct: 0.126 },
    { product: "1dayPureUP EDOF", myr: 25332, pct: 0.078 },
    { product: "MonthlyColour UV - Blue", myr: 20372, pct: 0.063 },
    { product: "DISOP Ultra Eyedrop", myr: 18706, pct: 0.058 },
    { product: "Breath O Correct", myr: 14674, pct: 0.045 },
    { product: "Monthly Pure 6", myr: 11200, pct: 0.035 },
    { product: "MonthlyColour UV II", myr: 9392, pct: 0.029 },
    { product: "DISOP H2O2 Solution", myr: 8568, pct: 0.026 },
    { product: "Ultra Vision", myr: 8396, pct: 0.026 },
    { product: "1dayPure Silfa", myr: 7832, pct: 0.024 },
    { product: "Minasoft Care UV", myr: 7065, pct: 0.022 },
    { product: "Minasoft 1Day Color UV", myr: 5715, pct: 0.018 },
    { product: "Eye Coffret-M 30 Toric", myr: 5657, pct: 0.017 },
    { product: "MonthlyFine Plus (3P)", myr: 5343, pct: 0.017 },
    { product: "Eye Coffret-M 10 Toric", myr: 3892, pct: 0.012 },
  ],
  totalMyr: 323819,
};

const marchECP = {
  rows: [
    { category: "Single Independent Outlet (SIO)" as const, outlets: 212, pct: 0.52, salesMyr: 169627 },
    { category: "Key Chain Store (KCS)" as const, outlets: 66, pct: 0.29, salesMyr: 92735 },
    { category: "Key Individual Outlet (KIO)" as const, outlets: 12, pct: 0.08, salesMyr: 27145 },
    { category: "Hospital & University Clinic" as const, outlets: 7, pct: 0.02, salesMyr: 7409 },
    { category: "Overseas" as const, outlets: 7, pct: 0.08, salesMyr: 26903 },
  ],
};

const marchRegion = {
  rows: [
    { region: "Southern Region (Johor, Melaka & Negeri Sembilan)" as const, salesThis: 68723, salesPrev: 71923, growthPct: -0.0445 },
    { region: "Central Region (KL, Selangor & Putrajaya)" as const, salesThis: 155582, salesPrev: 125924, growthPct: 0.2355 },
    { region: "Northern Region (Kedah, Penang, Perak & Perlis)" as const, salesThis: 35214, salesPrev: 36567, growthPct: -0.0370 },
    { region: "East Coast Region (Pahang, Kelantan & Terengganu)" as const, salesThis: 14419, salesPrev: 6585, growthPct: 1.1896 },
    { region: "East Malaysia (Sabah & Sarawak) & Brunei" as const, salesThis: 25919, salesPrev: 26140, growthPct: -0.0084 },
  ],
  commentary: "Central region led the growth this month, boosted by KL and Selangor festive spending. East Coast saw strong recovery off a low February base. Other regions largely flat.",
};

const marchInventory = {
  groups: [
    { name: "Clear CL (Daily)", rows: [
      { product: "1DP", warehouse: 7323, consignment: 4120 },
      { product: "1DP ASTIG", warehouse: 22763, consignment: null },
      { product: "1DP MS", warehouse: 853, consignment: null },
      { product: "1DP V.S", warehouse: 175, consignment: 0 },
      { product: "1DP EDOF", warehouse: 9191, consignment: 1238 },
      { product: "1D SILFA", warehouse: 1363, consignment: 1774 },
    ] },
    { name: "Clear CL (Monthly/2W)", rows: [
      { product: "Mfine UV+", warehouse: 2046, consignment: 891 },
      { product: "MTPure3", warehouse: 1863, consignment: 518 },
      { product: "MTPure6", warehouse: 4831, consignment: 2087 },
      { product: "2WK Pure", warehouse: 291, consignment: null },
      { product: "2WK Multi", warehouse: 170, consignment: null },
      { product: "2WK Toric", warehouse: 150, consignment: null },
    ] },
    { name: "Color CL (Eye Coffret / Minasoft)", rows: [
      { product: "EC-10 M", warehouse: 40962, consignment: 16377 },
      { product: "EC-10 M Toric", warehouse: 1187, consignment: null },
      { product: "EM-30 M Toric", warehouse: 1180, consignment: null },
      { product: "Minasoft Col Sihy", warehouse: 22448, consignment: null },
      { product: "Minasoft Care Sihy", warehouse: 12779, consignment: 1264 },
    ] },
    { name: "Color CL (Monthly Colour)", rows: [
      { product: "MC - Blue", warehouse: 23395, consignment: 6602 },
      { product: "MC - Orange", warehouse: 17573, consignment: 2484 },
      { product: "MC - II", warehouse: 9039, consignment: 3078 },
      { product: "MC-Pega (Old)", warehouse: 10820, consignment: 231 },
    ] },
    { name: "CL Care", rows: [
      { product: "DISOP H202 SOL", warehouse: 1160, consignment: null },
      { product: "DISOP A. ULTRA", warehouse: 614, consignment: null },
      { product: "DISOP A.Dual Gel", warehouse: 2639, consignment: null },
      { product: "BOC", warehouse: null, consignment: 1207 },
    ] },
  ],
  totalWarehouse: 194815,
  totalConsignment: 45794,
  commentary: "DISOP product arrival in April 24th: DISOP Hidro Health 360ml = 3,620 btl (balance from 5,000 btl previously ordered); DISOP Aquaiss Ultra 10ml = 5,000 btl (bottle eyedrop).",
};

const marchExpire = {
  rows: [
    { product: "1dayPure", qty: 4, amt: 105 },
    { product: "1dayPure Astigmatism", qty: 88, amt: 2475 },
    { product: "1dayPure Multistage", qty: 10, amt: 264 },
    { product: "1dayPure Edof", qty: 11, amt: 461 },
    { product: "1dayPure View support", qty: 58, amt: 1524 },
    { product: "Eye Coffret M-10", qty: 39, amt: 577 },
    { product: "2 Week Pure Multistage", qty: 4, amt: 53 },
    { product: "Monthly Color UV", qty: 29, amt: 294.26 },
    { product: "Monthly Pure 3P", qty: 2, amt: 12.8 },
    { product: "Monthly Pure 6P", qty: 7, amt: 88 },
  ],
};

const marchFinancial = {
  arMyr: 786179,
  arLongTermMyr: 44762,
  apMyr: 1702113,
  collectionMyr: 471613,
  cashFlowMyr: 1442412,
};

const marchOther = {
  body: `For internal study for upcoming launch:
• SEED FINE D Toric / SEED FINE D Sphere
• ACUVUE VITA is Silicone Hydrogel, costs ECP RM121 / RM150.70
• Wohlk products are non-SiHy so pricing will sit lower — probably ~half of current VITA price
• Market is competitive between SiHy offerings right now.`,
  imagePaths: [],
};

const feb2026 = {
  year: 2026, month: 2, fxRate: 30.73,
  salesAchievement: sa,
  marketOutlook: { body: "February 2026 – CNY fell mid-month, causing a tough month but sales momentum held up. Consumer spending remained resilient through the festive period." },
  dailySales: {
    days: Array.from({ length: 28 }, (_, i) => ({ date: `2026-02-${String(i + 1).padStart(2, "0")}`, qty: [290, 270, 300, 0, 0, 260, 280, 300, 260, 250, 270, 0, 0, 270, 0, 100, 80, 220, 250, 0, 0, 240, 260, 280, 240, 230, 0, 0][i] || 250 })),
    holidays: [{ date: "2026-02-11", label: "Thaipusam" }, { date: "2026-02-16", label: "Chinese New Year" }],
    commentary: "February – Thaipusam + CNY + fewer working days (~20). CNY in the middle of the month causes Chinese employees to take extended AL. EDOF 304 boxes hit target on the back of a strong 2025 client base.",
  },
};

const jan2026 = {
  year: 2026, month: 1, fxRate: 30.73,
  salesAchievement: sa,
  marketOutlook: { body: "January 2026 – retail sales growth carried from Dec 2025 (6.9% YoY nominal). Festive boost from CNY prep and school holidays. Consumer confidence steady." },
  dailySales: {
    days: Array.from({ length: 31 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, "0")}`, qty: 350 })),
    holidays: [{ date: "2026-01-01", label: "New Year" }],
    commentary: "January started strong. Sales activity re-strategized to focus on EDOF, 1daypure, 1daypure astig & monthly pure; nationwide promos moved to 6-month cycle (2x/yr) instead of 4x in 2025.",
  },
};

const marchReport: Omit<MonthReport, "id" | "presentDate"> = {
  year: 2026, month: 3,
  presenter: "Simon (Malaysia GM)",
  fxRate: 30.73,
  salesAchievement: sa,
  salesTrend: null,
  marketOutlook: { body: marchOutlook },
  dailySales: marchDaily,
  salesByQuantity: { ...marchSalesByQuantity, commentary: "" },
  topProducts: { ...marchTop, commentary: "" },
  salesByECP: { ...marchECP, commentary: "" },
  salesByRegion: marchRegion,
  productRegistration: {
    rows: [
      { product: "SEED Correct Clean (Progent)", class: "C", startDate: "1/6/2025", docOverseas: "Revised (24/10/25)", cabAssessment: "Submitted", mdaSubmission: "Work In Progress", mdaProcess: "", completionDate: "", mdaApprovalNo: "", category: "new", notes: "" },
      { product: "DISOP HIDRO HEALTH", class: "C", startDate: "1/11/2025", docOverseas: "Disop delay", cabAssessment: "Waiting doc", mdaSubmission: "", mdaProcess: "", completionDate: "Expire 12 Jun 2026", mdaApprovalNo: "", category: "renewal", notes: "" },
    ],
    commentary: "",
  },
  inventory: marchInventory,
  expireWriteOff: marchExpire,
  financial: marchFinancial,
  otherMarket: marchOther,
  sourceFiles: {},
};

async function main() {
  await upsertMonthReport({ ...marchReport, presentDate: null });
  await upsertMonthReport(jan2026);
  await upsertMonthReport(feb2026);
  console.log("Seeded: 2026-01, 2026-02, 2026-03");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => {
  const { prisma } = await import("@/lib/db");
  await prisma.$disconnect();
});
