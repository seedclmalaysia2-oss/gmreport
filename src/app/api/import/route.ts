import { NextResponse } from "next/server";
import { parsePosPdf, type PosMasterParseResult, type PosMcuvParseResult, type PosWriteOffParseResult } from "@/lib/parsers/pos-pdf";
import { parseEcpListXlsx, parseMasterXlsx, parseOutletXlsx, parseSalesByRegionXlsx, parseSalesmanSalesXlsx } from "@/lib/parsers/pos-xlsx";
import { parseCollectionXlsx, parseDailySalesXlsx, parseStockListXlsx, parseStockBalancesById, parseBocConsignmentXlsx, parseWriteOffXlsx } from "@/lib/parsers/pos-extra-xlsx";
import { grandTotalMyr, priorYearQtyLookup, salesByECP, salesByQuantity, salesByRegion, salesByRegionFromStates, topProducts, unmappedSkus } from "@/lib/aggregation";
import { inventoryFromStock } from "@/lib/aggregation/from-stock";
import { expireByMonth } from "@/lib/aggregation/from-writeoff";
import { getMonthReport, listMonthReports, upsertMonthReport } from "@/lib/month-report";
import { monthId } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { applyYear2025ToReport, is2025SummaryFile, parse2025Summary, type Year2025Reference } from "@/lib/parsers/year-2025";
import type { MonthReport, SectionKey, SourceFile, SourceFiles } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

type FileKind =
  | "pos_master"      // Stock Sales Analysis Summary - By Group.pdf
  | "pos_mcuv"        // MCUV-BLUE/ORANGE/PEGA.pdf
  | "pos_writeoff"    // Stocks Write Off Report.pdf
  | "pos_outlets"     // Monthly Sales Performance.xlsx
  | "pos_ecp_list"    // ECP List.xlsx
  | "pos_region"      // Sales Analysis By Region.xlsx — grouped by state/country
  | "pos_salesman"    // Salesman Sales and Collection Listing By Account Type.xlsx
  | "pos_inventory"   // SCLM - Stock List *.xlsx
  | "pos_collection"  // Collection Listing.xlsx
  | "pos_daily"       // Daily Sales Quantity.xlsx
  | "ref_2025"        // SEED(M) Sales Summary <year>.xlsx — prior-year reference
  | "unknown";

// Which file kinds drive which slides. Used to populate MonthReport.sourceFiles.
const KIND_TO_SECTIONS: Record<FileKind, SectionKey[]> = {
  pos_master:     ["salesAchievement", "salesByQuantity", "topProducts"],
  pos_mcuv:       ["salesByQuantity", "topProducts"],
  pos_writeoff:   ["expireWriteOff"],
  pos_outlets:    ["salesByECP", "salesByRegion"],
  pos_ecp_list:   ["salesByECP", "salesByRegion"],
  pos_region:     ["salesByRegion"],
  pos_salesman:   ["salesByECP", "financial"],
  pos_inventory:  ["inventory"],
  pos_collection: ["financial"],
  pos_daily:      ["dailySales"],
  ref_2025:       ["salesAchievement", "salesByQuantity"],
  unknown:        [],
};

/**
 * Classify an SCLM stock-list filename into its Slide 10 role. Assumes the
 * name already matched the stock-file guard `/stock\s*list|sclm/i`.
 *
 * The `(?!\d)` guard stops a plain HQ file whose name carries a date year —
 * e.g. "SCLM-Stock List HQ 2026.04.30.xlsx" — from reading as HQ2 ("HQ" +
 * space + the "2" of "2026").
 */
function classifyStockFile(name: string): "hq" | "hq2" | "boc" | "master" {
  if (/(stock\s*list|sclm).*hq\s*2(?!\d)|hq\s*2(?!\d).*(stock\s*list|sclm)/i.test(name)) return "hq2";
  if (/(stock\s*list|sclm).*hq|hq.*(stock\s*list|sclm)/i.test(name)) return "hq";
  if (/(stock\s*list|sclm).*boc|boc.*(stock\s*list|sclm)/i.test(name)) return "boc";
  return "master";
}

type ImportResult = {
  year: number;
  month: number;
  grandTotalMyr: number;
  sections: Partial<MonthReport>;
  sectionsTouched: SectionKey[];
  filesByKind: Partial<Record<FileKind, string[]>>;
  unmapped: { code: string; desc: string; netSales: number; qty: number }[];
};

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const year = Number(form.get("year"));
  const month = Number(form.get("month"));
  if (!year || !month) return NextResponse.json({ error: "year and month required" }, { status: 400 });

  const files = form.getAll("files") as File[];
  if (!files.length) return NextResponse.json({ error: "no files" }, { status: 400 });

  let master: PosMasterParseResult | null = null;
  const mcuv: PosMcuvParseResult[] = [];
  let writeOff: PosWriteOffParseResult | null = null;
  let outletsXlsxBuf: ArrayBuffer | null = null;
  let ecpListBuf: ArrayBuffer | null = null;
  let regionXlsxBuf: ArrayBuffer | null = null;
  let salesmanXlsxBuf: ArrayBuffer | null = null;
  let stockXlsxBuf: ArrayBuffer | null = null;       // master SCLM (nationwide total)
  let stockHqXlsxBuf: ArrayBuffer | null = null;     // HQ warehouse export
  let stockHq2XlsxBuf: ArrayBuffer | null = null;    // HQ2 warehouse export
  let stockBocXlsxBuf: ArrayBuffer | null = null;    // BOC consignment listing
  let collectionXlsxBuf: ArrayBuffer | null = null;
  let dailySalesXlsxBuf: ArrayBuffer | null = null;
  // Sales Summary workbooks (one or more). The user can upload both the
  // prior-year file (Dec_2025 → fills actual2025) and the current-year file
  // (Jan_2026 → fills target2026) in the same import. We collect every
  // detected ref and apply each one to every month after the main parse.
  const summaryRefs: Year2025Reference[] = [];
  const warnings: string[] = [];
  // Track each uploaded file against a FileKind so we can surface the list,
  // map it back to the slide(s) it drove, AND keep the raw bytes so we can
  // persist them to the RawFile table for download/view later. We hold the
  // ArrayBuffer here (not Buffer/Uint8Array) so a single object reference
  // is shared across the parse path and the persist path — Buffer.from(..)
  // is cheap and only happens once at insert time.
  type FileEntry = { name: string; size: number; buf: ArrayBuffer };
  const filesByKind: Partial<Record<FileKind, FileEntry[]>> = {};
  const pushFile = (kind: FileKind, f: File, buf: ArrayBuffer) => {
    (filesByKind[kind] ??= []).push({ name: f.name, size: f.size, buf });
  };

  for (const f of files) {
    const name = f.name;
    const lower = name.toLowerCase();
    if (lower.endsWith(".pdf")) {
      // arrayBuffer() can only be consumed once. pdfjs-dist may detach the
      // underlying ArrayBuffer while parsing, so we keep an independent copy
      // for the RawFile audit log alongside the working copy the parser owns.
      const original = await f.arrayBuffer();
      const audit = original.slice(0); // own buffer, never transferred elsewhere
      const bytes = new Uint8Array(original);
      const parsed = await parsePosPdf(bytes, name);
      if (parsed.kind === "master") { master = parsed; pushFile("pos_master", f, audit); }
      else if (parsed.kind === "mcuv") { mcuv.push(parsed); pushFile("pos_mcuv", f, audit); }
      else if (parsed.kind === "writeoff") { writeOff = parsed; pushFile("pos_writeoff", f, audit); }
      else { warnings.push(`Unrecognised PDF: ${name}`); pushFile("unknown", f, audit); }
    } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const buf = await f.arrayBuffer();
      // Order matters — several patterns overlap (Region also contains "sales",
      // master also says "Stock Sales Analysis"). Most-specific first.
      if (is2025SummaryFile(name)) {
        // Sales Summary workbook (any year). Parsed once; the apply step
        // below decides whether it feeds target2026 (current-year file) or
        // actual2025 + qty2025 (prior-year file) based on the title's year.
        try {
          summaryRefs.push(parse2025Summary(buf));
        } catch (e) {
          warnings.push(`Could not parse Sales Summary "${name}": ${e instanceof Error ? e.message : "unknown error"}`);
        }
        pushFile("ref_2025", f, buf);
      }
      else if (/write\s*-?\s*off/i.test(name)) {
        // XLSX twin of the "Stocks Write Off Report" PDF. Tested before the
        // master/stock-list checks because "Stock Write Off Listing" also
        // contains the word "Stock". Feeds Slide 11. The downstream
        // expireByMonth() block (shared with the PDF path) distributes it.
        try {
          writeOff = parseWriteOffXlsx(buf);
        } catch (e) {
          warnings.push(`Could not parse Write-Off file "${name}": ${e instanceof Error ? e.message : "unknown error"}`);
        }
        pushFile("pos_writeoff", f, buf);
      }
      else if (/stock\s*sales\s*analysis|summary\s*by\s*group/i.test(name)) {
        // The XLSX twin of the master "Stock Sales Analysis Summary By Group"
        // PDF. Drives Sales Achievement, Sales Quantity, Top Products.
        master = parseMasterXlsx(buf);
        pushFile("pos_master", f, buf);
      }
      else if (/ecp\s*list/i.test(name)) { ecpListBuf = buf; pushFile("pos_ecp_list", f, buf); }
      // SCLM stock files all feed Slide 10. A single guard detects a stock
      // file; classifyStockFile() routes it to master / HQ / HQ2 / BOC.
      else if (/stock\s*list|sclm/i.test(name)) {
        switch (classifyStockFile(name)) {
          case "hq2": stockHq2XlsxBuf = buf; break;
          case "hq":  stockHqXlsxBuf  = buf; break;
          case "boc": stockBocXlsxBuf = buf; break;
          default:    stockXlsxBuf    = buf; break;
        }
        pushFile("pos_inventory", f, buf);
      }
      else if (/sales.*analysis.*region|sales.*by.*region/i.test(name)) { regionXlsxBuf = buf; pushFile("pos_region", f, buf); }
      else if (/salesman.*(sales|colle?c?tion)|account\s*type/i.test(name)) { salesmanXlsxBuf = buf; pushFile("pos_salesman", f, buf); }
      else if (/daily\s*sales/i.test(name)) { dailySalesXlsxBuf = buf; pushFile("pos_daily", f, buf); }
      else if (/colle?c?tion\s*listing/i.test(name)) { collectionXlsxBuf = buf; pushFile("pos_collection", f, buf); }
      // Outlet file ("Monthly Sales Performance"). The previous code used a
      // blanket catch-all here, so any XLSX whose name didn't match any of the
      // patterns above (e.g. "Sales Quantity By Brand …xlsx") silently became
      // an outlet, parsed to zero rows, and OVERWROTE Slide 8 / Slide 7 with
      // zeros. Requiring an explicit match means stray files now fall through
      // to "unknown" and trigger the section-upload warnings popup instead.
      else if (/monthly\s*sales\s*performance|customer\s*sales\s*performance/i.test(name)) {
        outletsXlsxBuf = buf;
        pushFile("pos_outlets", f, buf);
      }
      else { pushFile("unknown", f, buf); }
    }
  }

  const sections: Partial<MonthReport> = {};
  // sectionsTouched = which slides this import actually updated. Used for the
  // UI banner ("Slides refreshed: Sales Quantity, Top Products, …").
  const sectionsTouched = new Set<SectionKey>();
  let grand = 0;
  let unmapped: ReturnType<typeof unmappedSkus> = [];

  if (master) {
    grand = grandTotalMyr(master);
    unmapped = unmappedSkus(master);
    const prior = await getMonthReport(year - 1, month);
    const priorQty = priorYearQtyLookup(prior?.salesByQuantity ?? null);
    sections.salesByQuantity = salesByQuantity(master, mcuv, priorQty);
    sections.topProducts = topProducts(master, mcuv);
    sectionsTouched.add("salesByQuantity");
    sectionsTouched.add("topProducts");
  }

  const priorMonthForRegion = (outletsXlsxBuf || regionXlsxBuf || salesmanXlsxBuf)
    ? await getMonthReport(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)
    : null;
  const priorRegionSales = priorMonthForRegion?.salesByRegion?.rows.map(r => ({ region: r.region, sales: r.salesThis })) ?? [];

  // The Salesman Sales file is the richer ECP source (Account Type per outlet),
  // so prefer it for Sales by ECP when both it and the outlet Excel are present.
  let salesmanOutlets: { customerName: string; accountType: string; amount: number; salesman: string }[] | null = null;
  let salesmanCollection: number | null = null;
  if (salesmanXlsxBuf) {
    const parsed = parseSalesmanSalesXlsx(salesmanXlsxBuf, year, month);
    salesmanOutlets = parsed.outlets;
    salesmanCollection = parsed.collectionMyr;
    if (parsed.outlets.length === 0) {
      warnings.push(`Salesman Sales file: could not find "${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month-1]}' ${year} Sales" column — check the month/year matches the file.`);
    }
  }

  if (outletsXlsxBuf || salesmanOutlets) {
    const ecpList = ecpListBuf ? parseEcpListXlsx(ecpListBuf) : [];
    const parsedOutlets = outletsXlsxBuf ? parseOutletXlsx(outletsXlsxBuf) : [];
    const outletsForEcp = salesmanOutlets && salesmanOutlets.length > 0
      ? salesmanOutlets
      : parsedOutlets;
    // Empty outlets used to slip through and zero out Slide 7 (ECP) — guard
    // it so a file with no "Customer Name" rows leaves the slide alone.
    if (outletsForEcp.length > 0) {
      sections.salesByECP = salesByECP(outletsForEcp, ecpList);
      sectionsTouched.add("salesByECP");
    } else if (outletsXlsxBuf) {
      warnings.push(`Outlet file: no "Customer Name" rows found — Slide 7 (Sales by ECP) was NOT changed. Confirm the file is "Monthly Sales Performance".`);
    }
    // Outlet-derived region: same guard. The previous code wrote a zero row
    // per region for empty outlets, which wiped Slide 8 with -100% growth.
    if (outletsXlsxBuf && !regionXlsxBuf) {
      if (parsedOutlets.length === 0) {
        warnings.push(`Outlet file: no rows parsed — Slide 8 (Sales by Region) was NOT changed. Confirm the file is "Monthly Sales Performance" or upload a "Sales Analysis By Region" file.`);
      } else {
        sections.salesByRegion = salesByRegion(parsedOutlets, ecpList, priorRegionSales);
        sectionsTouched.add("salesByRegion");
      }
    }
  }

  if (regionXlsxBuf) {
    const stateTotals = parseSalesByRegionXlsx(regionXlsxBuf, year, month);
    const monthLabel = `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month-1]} ${String(year).slice(-2)}`;
    if (stateTotals.length === 0) {
      // Don't overwrite existing rows with zeros — previously a header miss
      // wiped Slide 10's salesThis column and left only the inherited
      // salesPrev visible, which looked like a successful import.
      warnings.push(`Sales Analysis By Region: could not find a "${monthLabel}" column in the file — Slide 10 was NOT changed. Open the file and confirm the month header text matches.`);
    } else if (stateTotals.every(t => t.sales === 0)) {
      warnings.push(`Sales Analysis By Region: matched the "${monthLabel}" column but every value parsed as 0 — Slide 10 was NOT changed. The file may be a blank template.`);
    } else {
      const computedRegion = salesByRegionFromStates(stateTotals, priorRegionSales);
      const mappedTotal = computedRegion.rows.reduce((s, r) => s + r.salesThis, 0);
      if (mappedTotal === 0) {
        // We read real sub-totals but NONE mapped to a Malaysian region — the
        // file's "Customer UD Group : <STATE>" labels didn't resolve (e.g. a
        // POS layout change that garbles the state name). Refuse to overwrite
        // Slide 10 with an all-zero split, which is what silently zeroed a
        // month's region column before the multi-cell-header parser fix.
        warnings.push(`Sales Analysis By Region: matched the "${monthLabel}" column and read ${stateTotals.length} group totals, but none mapped to a Malaysian region — Slide 10 was NOT changed. The file's "Customer UD Group : <STATE>" labels may be in a new format.`);
      } else {
        sections.salesByRegion = computedRegion;
        sectionsTouched.add("salesByRegion");
      }
    }
  }

  // Slide 10 needs four companion files — master SCLM + HQ + HQ2 + BOC — but
  // users upload them in separate batches. An import carrying only some of
  // them would recompute inventory with the missing roles zeroed out, wiping
  // a good warehouse/consignment split. So whenever ANY stock file is in this
  // request, top up the roles NOT present from the month's stored RawFile
  // copies — re-importing just the master then still yields the full split.
  if (stockXlsxBuf || stockHqXlsxBuf || stockHq2XlsxBuf || stockBocXlsxBuf) {
    const storedStock = await prisma.rawFile.findMany({
      where: { monthReportId: monthId(year, month), kind: "pos_inventory", deletedAt: null },
      orderBy: { createdAt: "desc" }, // newest stored copy of each role wins
      select: { originalName: true, bytes: true },
    });
    for (const row of storedStock) {
      if (!row.bytes) continue;
      const ab = new Uint8Array(row.bytes).buffer as ArrayBuffer;
      switch (classifyStockFile(row.originalName)) {
        case "hq2":    if (!stockHq2XlsxBuf) stockHq2XlsxBuf = ab; break;
        case "hq":     if (!stockHqXlsxBuf)  stockHqXlsxBuf  = ab; break;
        case "boc":    if (!stockBocXlsxBuf) stockBocXlsxBuf = ab; break;
        default:       if (!stockXlsxBuf)    stockXlsxBuf    = ab; break;
      }
    }
  }

  if (stockXlsxBuf) {
    // When the HQ / HQ2 warehouse exports are also uploaded, build a combined
    // Stock ID → warehouse-balance map. The master parser then splits each
    // product: warehouse = HQ + HQ2, consignment = master − warehouse.
    let warehouseById: Map<string, number> | undefined;
    if (stockHqXlsxBuf || stockHq2XlsxBuf) {
      warehouseById = new Map<string, number>();
      for (const wbuf of [stockHqXlsxBuf, stockHq2XlsxBuf]) {
        if (!wbuf) continue;
        for (const [id, qty] of parseStockBalancesById(wbuf)) {
          warehouseById.set(id, (warehouseById.get(id) ?? 0) + qty);
        }
      }
    } else {
      warnings.push("Inventory: only the master SCLM file was uploaded — consignment can't be split. Add the HQ and HQ2 stock files for the warehouse/consignment breakdown.");
    }
    const stock = parseStockListXlsx(stockXlsxBuf, new Date(year, month, 0), warehouseById);
    // BOC consignment isn't in the master — it comes from its own SCLM file.
    let bocConsignment: number | undefined;
    if (stockBocXlsxBuf) {
      bocConsignment = parseBocConsignmentXlsx(stockBocXlsxBuf);
      if (!bocConsignment) {
        warnings.push("Inventory: the SCLM Stock List BOC file was uploaded but no BOC quantity could be read — BOC consignment left at 0.");
      }
    }
    sections.inventory = inventoryFromStock(stock, bocConsignment);
    sectionsTouched.add("inventory");
  } else if (stockHqXlsxBuf || stockHq2XlsxBuf || stockBocXlsxBuf) {
    warnings.push("Inventory: HQ / HQ2 / BOC stock files were uploaded without the master SCLM file — Slide 10 needs the master to compute consignment.");
  }

  if (collectionXlsxBuf || salesmanCollection != null) {
    const collectionFromSalesman = salesmanCollection ?? 0;
    const collectionFromListing = collectionXlsxBuf ? parseCollectionXlsx(collectionXlsxBuf).totalCollectionMyr : 0;
    const existing = await getMonthReport(year, month);
    // Prefer the Collection Listing total when it actually parsed to a real
    // figure (it's the authoritative receipt-level register). But a file
    // mis-named "Collection Listing" that's really a salesman-format export
    // parses to 0 here — in that case fall back to the salesman roll-up, and
    // failing that keep whatever was already saved, so a bad upload can't
    // zero out a good Collection figure.
    const collectionMyr =
      collectionFromListing > 0 ? collectionFromListing
      : collectionFromSalesman > 0 ? collectionFromSalesman
      : (existing?.financial?.collectionMyr ?? 0);
    if (collectionXlsxBuf && collectionFromListing === 0 && collectionFromSalesman === 0) {
      warnings.push("Collection: the uploaded Collection Listing didn't yield a total — check it's the receipt-level register, not a salesman sales export.");
    }
    sections.financial = {
      arMyr: existing?.financial?.arMyr ?? 0,
      arLongTermMyr: existing?.financial?.arLongTermMyr ?? 0,
      apMyr: existing?.financial?.apMyr ?? 0,
      cashFlowMyr: existing?.financial?.cashFlowMyr ?? 0,
      collectionMyr,
    };
    sectionsTouched.add("financial");
  }

  // Write-off PDF may contain multiple months. Each month's payload goes to
  // its own MonthReport record.
  if (writeOff) {
    const byMonth = expireByMonth(writeOff);
    for (const [mk, payload] of Object.entries(byMonth)) {
      const [y, m] = mk.split("-").map(Number);
      if (y === year && m === month) {
        sections.expireWriteOff = payload;
        sectionsTouched.add("expireWriteOff");
      } else {
        // Also record sourceFiles on the sibling month we just updated.
        const siblingSourceFiles: SourceFiles = {};
        const writeOffFiles = (filesByKind.pos_writeoff ?? []).map((f): SourceFile => ({ name: f.name, size: f.size, at: new Date().toISOString() }));
        if (writeOffFiles.length) siblingSourceFiles.expireWriteOff = writeOffFiles;
        await upsertMonthReport({ year: y, month: m, expireWriteOff: payload, sourceFiles: siblingSourceFiles });
      }
    }
  }

  if (dailySalesXlsxBuf) {
    const daily = parseDailySalesXlsx(dailySalesXlsxBuf);
    const existing = await getMonthReport(year, month);
    sections.dailySales = {
      days: daily.days.map(d => ({ date: d.date, qty: d.qty })),
      holidays: existing?.dailySales?.holidays ?? [],
      commentary: existing?.dailySales?.commentary ?? "",
    };
    sectionsTouched.add("dailySales");
  }

  // If a master PDF is present, stamp the month's actual sales into slide 3.
  if (grand) {
    const existing = await getMonthReport(year, month);
    const twelve = (): (number | null)[] => Array(12).fill(null);
    const salesAchievement = existing?.salesAchievement ?? {
      target2026: twelve(),
      actual2026: twelve(),
      target2025: twelve(),
      actual2025: twelve(),
      netIncome2026: twelve(),
      netIncome2025: twelve(),
      kpi: [],
    };
    salesAchievement.actual2026 = [...salesAchievement.actual2026];
    salesAchievement.actual2026[month - 1] = grand;
    sections.salesAchievement = salesAchievement;
    sectionsTouched.add("salesAchievement");
  }

  // Sales Summary references feed Slide 1 (target/actual) + Slide 5 (qty).
  // Mark those touched so the file shows in "Slides refreshed".
  if (summaryRefs.length) {
    sectionsTouched.add("salesAchievement");
    sectionsTouched.add("salesByQuantity");
  }

  // Build the sourceFiles map: for every FileKind we recognised, attach its
  // filenames to each downstream section, layering on top of anything already
  // saved so an incremental import (e.g. just the outlet Excel) doesn't wipe
  // the previously-recorded master PDF.
  const existingMonth = await getMonthReport(year, month);
  const sourceFiles: SourceFiles = { ...(existingMonth?.sourceFiles ?? {}) };
  const nowIso = new Date().toISOString();
  for (const [kindKey, entries] of Object.entries(filesByKind) as [FileKind, { name: string; size: number }[]][]) {
    if (kindKey === "unknown") continue;
    const sectionKeys = KIND_TO_SECTIONS[kindKey] ?? [];
    const records: SourceFile[] = entries.map(e => ({ name: e.name, size: e.size, at: nowIso }));
    for (const sk of sectionKeys) {
      if (!sectionsTouched.has(sk)) continue;
      const prior = sourceFiles[sk] ?? [];
      // Replace prior entries from the same kind (matched by filename prefix);
      // otherwise just merge.
      const filtered = prior.filter(p => !records.some(r => r.name === p.name));
      sourceFiles[sk] = [...filtered, ...records];
    }
  }

  const saved = await upsertMonthReport({ year, month, ...sections, sourceFiles });

  // ----- Persist a per-file audit log to the RawFile table -----
  // We write metadata (name, size, kind, which slides it fed) for every
  // uploaded file — including the ones we couldn't classify ("unknown") so
  // the user can still see they reached the server. This is what the Files
  // page renders going forward.
  const rawFileRows = (Object.entries(filesByKind) as [FileKind, FileEntry[]][])
    .flatMap(([kind, entries]) => {
      const sectionKeysForKind = (KIND_TO_SECTIONS[kind] ?? []).filter(sk => sectionsTouched.has(sk));
      return entries.map(e => ({
        monthReportId: saved.id,
        kind,
        originalName: e.name,
        byteSize: e.size,
        sectionKeys: sectionKeysForKind.length ? JSON.stringify(sectionKeysForKind) : null,
        // Buffer.from(ArrayBuffer) creates a zero-copy view, then Prisma
        // serializes it as Postgres bytea. POS files in this app are well
        // under 1 MB each, so storing inline is fine for our volume.
        bytes: Buffer.from(e.buf),
      }));
    });
  if (rawFileRows.length) {
    // Same-name re-upload = REPLACEMENT, not a new file. Before inserting the
    // fresh rows, soft-delete any active prior copy with the same filename in
    // this month so it drops into "Recently deleted" and the upload list never
    // shows two of the same name (and the row numbering stays stable — a
    // re-upload takes over the old slot rather than getting a new number).
    const names = [...new Set(rawFileRows.map(r => r.originalName))];
    await prisma.rawFile.updateMany({
      where: { monthReportId: saved.id, originalName: { in: names }, deletedAt: null },
      data: { deletedAt: new Date() },
    }).catch(err => console.error("[import] failed to supersede prior copies:", err));

    // createMany is fire-and-forget; if it fails (e.g. transient pooler hiccup)
    // we don't want to fail the whole import — the section data is already
    // saved. Log to server console instead.
    await prisma.rawFile.createMany({ data: rawFileRows }).catch(err => {
      console.error("[import] failed to persist RawFile rows:", err);
    });
  }

  // ----- Apply the Sales Summary references to EVERY month -----
  // A Sales Summary workbook is a whole-year dataset, not a single month's
  // POS dump. Each ref (prior-year or current-year) is fanned out across
  // every existing MonthReport so the YoY comparison and target columns
  // line up. Multiple refs in one upload are applied in order — each ref's
  // year determines what gets written (target vs actual; see applyYear2025).
  let year2025Applied = 0;
  if (summaryRefs.length) {
    const allMonths = await listMonthReports();
    for (const mr of allMonths) {
      let current = mr;
      let monthChanged = false;
      for (const ref of summaryRefs) {
        const { changed, next } = applyYear2025ToReport(current, ref);
        if (changed) { current = next; monthChanged = true; }
      }
      if (monthChanged) {
        await upsertMonthReport(current);
        year2025Applied++;
        revalidatePath(`/report/${mr.id}`);
      }
    }
    if (year2025Applied > 0) {
      revalidatePath("/");
      revalidatePath("/export");
    }
  }

  // ----- Re-apply the ON-FILE Sales Summary reference(s) to THIS month -----
  // A POS master import rebuilds salesByQuantity from scratch, reseeding every
  // row's qty2025 from last year's SAME-month POS report — which usually
  // doesn't exist, so qty2025 collapses to 0. The authoritative prior-year
  // figures live in the Sales Summary workbook that's already on file (uploaded
  // in an earlier batch). The fan-out above only fires when a Summary is in
  // *this* upload, so a plain POS import would leave qty2025 (and a
  // freshly-synthesized actual2025) empty until someone ran Repair by hand.
  //
  // So: whenever this import rebuilt a Summary-fed slide but carried no Summary
  // of its own, pull the stored reference(s) and re-apply them to the current
  // month. Idempotent — a re-run with nothing to change writes nothing. Only
  // the current month is touched; other months already hold their own values.
  if (!summaryRefs.length && (sectionsTouched.has("salesByQuantity") || sectionsTouched.has("salesAchievement"))) {
    try {
      const storedRefRows = await prisma.rawFile.findMany({
        where: { kind: "ref_2025", deletedAt: null },
        orderBy: { createdAt: "asc" }, // same order as the repair route
        select: { bytes: true, originalName: true },
      });
      const storedRefs: Year2025Reference[] = [];
      for (const r of storedRefRows) {
        if (!r.bytes) continue;
        try { storedRefs.push(parse2025Summary(new Uint8Array(r.bytes))); }
        catch (e) { console.error(`[import] failed to parse stored Sales Summary "${r.originalName}":`, e); }
      }
      // Only PRIOR-YEAR references matter here: they carry the qty2025 /
      // actual2025 comparison this month's rebuild just cleared. The
      // current-year workbook only feeds target2026 — which a POS import never
      // clears — so re-applying it would needlessly overwrite manual target
      // edits. Skip it; upload-time fan-out and Repair still keep it in sync.
      const priorYearRefs = storedRefs.filter(ref => ref.year === year - 1);
      if (priorYearRefs.length) {
        let current = saved;
        let monthChanged = false;
        for (const ref of priorYearRefs) {
          const { changed, next } = applyYear2025ToReport(current, ref);
          if (changed) { current = next; monthChanged = true; }
        }
        if (monthChanged) {
          await upsertMonthReport(current);
          revalidatePath(`/report/${saved.id}`);
          revalidatePath("/");
          revalidatePath("/export");
        }
      }
    } catch (e) {
      // Never fail the import over a reference re-sync — the POS data is
      // already saved. Worst case the user can still click Repair.
      console.error("[import] failed to re-apply on-file Sales Summary references:", e);
    }
  }

  const result: ImportResult = {
    year, month,
    grandTotalMyr: grand,
    sections,
    sectionsTouched: [...sectionsTouched],
    filesByKind: Object.fromEntries(
      (Object.entries(filesByKind) as [FileKind, { name: string; size: number }[]][])
        .map(([k, v]) => [k, v.map(f => f.name)]),
    ) as Partial<Record<FileKind, string[]>>,
    unmapped,
  };
  return NextResponse.json({
    ok: true,
    saved,
    result,
    warnings,
    // Surfaced in the import-complete panel when a Sales Summary was uploaded.
    year2025Applied: summaryRefs.length ? year2025Applied : undefined,
  });
}
