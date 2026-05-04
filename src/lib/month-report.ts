import { prisma } from "./db";
import {
  MonthReport,
  MonthReportZ,
  SECTION_KEYS,
  SourceFiles,
  emptyMonthReport,
} from "./schema";
import { monthId } from "./utils";
import { LEGACY_REGION_REMAP } from "./catalog/mappings";

type DbRow = Awaited<ReturnType<typeof prisma.monthReport.findUnique>>;

type LooseRegionRow = { region?: unknown } & Record<string, unknown>;
type LooseSalesByRegion = { rows?: unknown; commentary?: unknown };

function migrateSalesByRegion(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const sbr = raw as LooseSalesByRegion;
  if (!Array.isArray(sbr.rows)) return raw;
  const nextRows = (sbr.rows as LooseRegionRow[]).map(row => {
    const current = typeof row.region === "string" ? row.region : "";
    const remapped = LEGACY_REGION_REMAP[current];
    return remapped ? { ...row, region: remapped } : row;
  });
  return { ...sbr, rows: nextRows };
}

function rowToReport(row: NonNullable<DbRow>): MonthReport {
  const parse = <T>(raw: string | null): T | null => {
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  };
  const r: MonthReport = {
    id: row.id,
    year: row.year,
    month: row.month,
    presenter: row.presenter,
    presentDate: row.presentDate ? row.presentDate.toISOString() : null,
    fxRate: row.fxRate,
    salesAchievement:    parse(row.salesAchievement),
    salesTrend:          parse(row.salesTrend),
    marketOutlook:       parse(row.marketOutlook),
    dailySales:          parse(row.dailySales),
    salesByQuantity:     parse(row.salesByQuantity),
    topProducts:         parse(row.topProducts),
    salesByECP:          parse(row.salesByECP),
    salesByRegion:       migrateSalesByRegion(parse(row.salesByRegion)) as MonthReport["salesByRegion"],
    productRegistration: parse(row.productRegistration),
    inventory:           parse(row.inventory),
    expireWriteOff:      parse(row.expireWriteOff),
    financial:           parse(row.financial),
    otherMarket:         parse(row.otherMarket),
    sourceFiles:         parse<SourceFiles>((row as { sourceFiles: string | null }).sourceFiles) ?? {},
  };
  return r;
}

export async function getMonthReport(year: number, month: number): Promise<MonthReport | null> {
  const row = await prisma.monthReport.findUnique({ where: { year_month: { year, month } } });
  return row ? rowToReport(row) : null;
}

export async function getMonthReportById(id: string): Promise<MonthReport | null> {
  const row = await prisma.monthReport.findUnique({ where: { id } });
  return row ? rowToReport(row) : null;
}

export async function listMonthReports(): Promise<MonthReport[]> {
  const rows = await prisma.monthReport.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }] });
  return rows.map(rowToReport);
}

export async function upsertMonthReport(input: Partial<MonthReport> & { year: number; month: number }): Promise<MonthReport> {
  const id = monthId(input.year, input.month);
  const existing = await getMonthReport(input.year, input.month);
  const merged: MonthReport = { ...(existing ?? emptyMonthReport(id, input.year, input.month)), ...input, id } as MonthReport;
  const parsed = MonthReportZ.parse(merged);

  const data: Record<string, unknown> = {
    presenter: parsed.presenter,
    presentDate: parsed.presentDate ? new Date(parsed.presentDate) : null,
    fxRate: parsed.fxRate,
    sourceFiles: parsed.sourceFiles && Object.keys(parsed.sourceFiles).length
      ? JSON.stringify(parsed.sourceFiles)
      : null,
  };
  for (const k of SECTION_KEYS) {
    data[k] = parsed[k] ? JSON.stringify(parsed[k]) : null;
  }

  await prisma.monthReport.upsert({
    where: { id },
    create: { id, year: parsed.year, month: parsed.month, ...data } as Parameters<typeof prisma.monthReport.upsert>[0]["create"],
    update: data as Parameters<typeof prisma.monthReport.upsert>[0]["update"],
  });
  return parsed;
}

export async function deleteMonthReport(id: string) {
  await prisma.monthReport.delete({ where: { id } });
}

// ----- Raw upload log (Files page) -----

export type RawFileEntry = {
  id: string;
  monthReportId: string;
  year: number;
  month: number;
  kind: string;
  originalName: string;
  byteSize: number;
  sectionKeys: string[];
  createdAt: string; // ISO
};

/**
 * Returns every uploaded file recorded in the RawFile table, joined with its
 * MonthReport so the UI can group by year/month. Sorted by createdAt desc so
 * the most recent uploads land at the top.
 */
export async function listRawFiles(): Promise<RawFileEntry[]> {
  const rows = await prisma.rawFile.findMany({
    include: { monthReport: { select: { year: true, month: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(r => ({
    id: r.id,
    monthReportId: r.monthReportId,
    year: r.monthReport.year,
    month: r.monthReport.month,
    kind: r.kind,
    originalName: r.originalName,
    byteSize: r.byteSize,
    sectionKeys: r.sectionKeys ? safeParseStringArray(r.sectionKeys) : [],
    createdAt: r.createdAt.toISOString(),
  }));
}

function safeParseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}
