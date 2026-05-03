import { z } from "zod";
import { CANONICAL_PRODUCTS } from "./catalog/products";
import { ECP_CATEGORIES, REGIONS } from "./catalog/mappings";

// ---------- Section schemas ----------

export const MonetaryRowZ = z.object({
  year: z.number().int(),
  jan: z.number().nullable().optional(),
  feb: z.number().nullable().optional(),
  mar: z.number().nullable().optional(),
  apr: z.number().nullable().optional(),
  may: z.number().nullable().optional(),
  jun: z.number().nullable().optional(),
  jul: z.number().nullable().optional(),
  aug: z.number().nullable().optional(),
  sep: z.number().nullable().optional(),
  oct: z.number().nullable().optional(),
  nov: z.number().nullable().optional(),
  dec: z.number().nullable().optional(),
});
export type MonetaryRow = z.infer<typeof MonetaryRowZ>;

export const KPINoteZ = z.object({
  month: z.number().int().min(1).max(12),
  achievementPct: z.number().nullable(),
  yoyPct: z.number().nullable(),
  newStores: z.number().int().nullable(),
  ecpThis: z.number().int().nullable(),
  ecpPrior: z.number().int().nullable(),
  plMyr: z.number().nullable(),
  plJpy: z.number().nullable(),
  extraLines: z.array(z.string()).default([]),
});
export type KPINote = z.infer<typeof KPINoteZ>;

export const SalesAchievementZ = z.object({
  target2026: z.array(z.number().nullable()).length(12),
  actual2026: z.array(z.number().nullable()).length(12),
  actual2025: z.array(z.number().nullable()).length(12),
  netIncome2026: z.array(z.number().nullable()).length(12),
  netIncome2025: z.array(z.number().nullable()).length(12),
  kpi: z.array(KPINoteZ),
});
export type SalesAchievement = z.infer<typeof SalesAchievementZ>;

export const MarketOutlookZ = z.object({
  body: z.string(),
});
export type MarketOutlook = z.infer<typeof MarketOutlookZ>;

export const DailySalesDayZ = z.object({
  date: z.string(), // YYYY-MM-DD
  qty: z.number().int(),
});
export const HolidayZ = z.object({ date: z.string(), label: z.string() });

export const DailySalesZ = z.object({
  days: z.array(DailySalesDayZ),
  holidays: z.array(HolidayZ).default([]),
  commentary: z.string().default(""),
});
export type DailySales = z.infer<typeof DailySalesZ>;

export const SalesByQuantityRowZ = z.object({
  product: z.string(),
  qty2026: z.number().int(),
  qty2025: z.number().int(),
});
export const SalesByQuantityZ = z.object({
  rows: z.array(SalesByQuantityRowZ),
  commentary: z.string().default(""),
});
export type SalesByQuantity = z.infer<typeof SalesByQuantityZ>;

export const TopProductsRowZ = z.object({
  product: z.string(),
  myr: z.number(),
  pct: z.number(), // 0..1
});
export const TopProductsZ = z.object({
  rows: z.array(TopProductsRowZ),
  totalMyr: z.number(),
  commentary: z.string().default(""),
});
export type TopProducts = z.infer<typeof TopProductsZ>;

export const SalesByECPRowZ = z.object({
  category: z.enum(ECP_CATEGORIES as unknown as [string, ...string[]]),
  outlets: z.number().int(),
  pct: z.number(),     // 0..1
  salesMyr: z.number(),
});
export const SalesByECPZ = z.object({
  rows: z.array(SalesByECPRowZ),
  commentary: z.string().default(""),
});
export type SalesByECP = z.infer<typeof SalesByECPZ>;

export const SalesByRegionRowZ = z.object({
  region: z.enum(REGIONS as unknown as [string, ...string[]]),
  salesThis: z.number(),
  salesPrev: z.number(),
  growthPct: z.number(),
});
export const SalesByRegionZ = z.object({
  rows: z.array(SalesByRegionRowZ),
  commentary: z.string().default(""),
});
export type SalesByRegion = z.infer<typeof SalesByRegionZ>;

export const ProductRegistrationRowZ = z.object({
  product: z.string(),
  class: z.string().default(""),
  startDate: z.string().default(""),
  docOverseas: z.string().default(""),
  cabAssessment: z.string().default(""),
  mdaSubmission: z.string().default(""),
  mdaProcess: z.string().default(""),
  completionDate: z.string().default(""),
  mdaApprovalNo: z.string().default(""),
  category: z.enum(["new", "renewal"]).default("new"),
  notes: z.string().default(""),
});
export const ProductRegistrationZ = z.object({
  rows: z.array(ProductRegistrationRowZ),
});
export type ProductRegistration = z.infer<typeof ProductRegistrationZ>;

export const InventoryCellZ = z.object({
  product: z.string(),
  warehouse: z.number().nullable(),
  consignment: z.number().nullable(),
});
export const InventoryZ = z.object({
  groups: z.array(z.object({
    name: z.string(),
    rows: z.array(InventoryCellZ),
  })),
  totalWarehouse: z.number().nullable(),
  totalConsignment: z.number().nullable(),
  commentary: z.string().default(""),
});
export type Inventory = z.infer<typeof InventoryZ>;

export const ExpireRowZ = z.object({
  product: z.string(),
  qty: z.number().int(),
  amt: z.number(),
});
export const ExpireWriteOffZ = z.object({
  rows: z.array(ExpireRowZ),
});
export type ExpireWriteOff = z.infer<typeof ExpireWriteOffZ>;

export const FinancialZ = z.object({
  arMyr: z.number().default(0),
  arLongTermMyr: z.number().default(0),
  apMyr: z.number().default(0),
  collectionMyr: z.number().default(0),
  cashFlowMyr: z.number().default(0),
});
export type Financial = z.infer<typeof FinancialZ>;

export const OtherMarketZ = z.object({
  body: z.string().default(""),
  imagePaths: z.array(z.string()).default([]),
});
export type OtherMarket = z.infer<typeof OtherMarketZ>;

// One label offset: pixel shift from the default position, keyed by month index (0-11).
export const LabelOffsetZ = z.object({ dx: z.number(), dy: z.number() });
export type LabelOffset = z.infer<typeof LabelOffsetZ>;

export const SalesTrendZ = z.object({
  // Year trends used in the Sales Trend line chart. Keys = year, values = 12-length array.
  series: z.record(z.string(), z.array(z.number().nullable())),
  targetSeries: z.array(z.number().nullable()).length(12).optional(),
  /**
   * Per-series, per-month label position overrides. Only used by the dashboard
   * chart. PPTX export keeps default placement. Saved on drag-end so overrides
   * survive page reloads.
   */
  labelOffsets: z.record(z.string(), z.record(z.string(), LabelOffsetZ)).optional(),
});
export type SalesTrend = z.infer<typeof SalesTrendZ>;

// Per-section provenance: which POS file(s) last fed each slide, and when.
// Lets the UI show "Source: outlets-mar.xlsx (Apr 22)" above a section, and
// the Import page confirms the right raw file was used.
export const SourceFileZ = z.object({
  name: z.string(),
  size: z.number().int().nullable().optional(),
  at: z.string(),            // ISO timestamp
});
export type SourceFile = z.infer<typeof SourceFileZ>;

export const SourceFilesZ = z.record(z.string(), z.array(SourceFileZ));
export type SourceFiles = z.infer<typeof SourceFilesZ>;

// ---------- Aggregate MonthReport ----------

export const MonthReportZ = z.object({
  id: z.string(),          // YYYY-MM
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  presenter: z.string(),
  presentDate: z.string().nullable(),
  fxRate: z.number(),
  salesAchievement: SalesAchievementZ.nullable(),
  salesTrend: SalesTrendZ.nullable(),
  marketOutlook: MarketOutlookZ.nullable(),
  dailySales: DailySalesZ.nullable(),
  salesByQuantity: SalesByQuantityZ.nullable(),
  topProducts: TopProductsZ.nullable(),
  salesByECP: SalesByECPZ.nullable(),
  salesByRegion: SalesByRegionZ.nullable(),
  productRegistration: ProductRegistrationZ.nullable(),
  inventory: InventoryZ.nullable(),
  expireWriteOff: ExpireWriteOffZ.nullable(),
  financial: FinancialZ.nullable(),
  otherMarket: OtherMarketZ.nullable(),
  sourceFiles: SourceFilesZ.default({}),
});
export type MonthReport = z.infer<typeof MonthReportZ>;

export function emptyMonthReport(id: string, year: number, month: number): MonthReport {
  return {
    id, year, month,
    presenter: "Simon (Malaysia GM)",
    presentDate: null,
    fxRate: 30.73,
    salesAchievement: null,
    salesTrend: null,
    marketOutlook: null,
    dailySales: null,
    salesByQuantity: null,
    topProducts: null,
    salesByECP: null,
    salesByRegion: null,
    productRegistration: null,
    inventory: null,
    expireWriteOff: null,
    financial: null,
    otherMarket: null,
    sourceFiles: {},
  };
}

// Empty 12-month row helper
export const ZERO_12 = () => [0,0,0,0,0,0,0,0,0,0,0,0] as number[];

export const SECTION_KEYS = [
  "salesAchievement",
  "salesTrend",
  "marketOutlook",
  "dailySales",
  "salesByQuantity",
  "topProducts",
  "salesByECP",
  "salesByRegion",
  "productRegistration",
  "inventory",
  "expireWriteOff",
  "financial",
  "otherMarket",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_META: Record<SectionKey, { no: number; title: string }> = {
  salesAchievement:    { no: 1,  title: "Sales Achievement" },
  salesTrend:          { no: 2,  title: "Sales Trend" },
  marketOutlook:       { no: 3,  title: "Malaysia Outlook" },
  dailySales:          { no: 4,  title: "Daily Sales Quantity" },
  salesByQuantity:     { no: 5,  title: "Sales Quantity (by Product)" },
  topProducts:         { no: 6,  title: "Sales by Product — Top Contribution" },
  salesByECP:          { no: 7,  title: "Sales by ECP" },
  salesByRegion:       { no: 8,  title: "Sales by Region" },
  productRegistration: { no: 9,  title: "Product Registration" },
  inventory:           { no: 10, title: "Inventory Situation" },
  expireWriteOff:      { no: 11, title: "Expire Stock (Write-Off)" },
  financial:           { no: 12, title: "Financial Relationship" },
  otherMarket:         { no: 13, title: "Other Market Update" },
};
