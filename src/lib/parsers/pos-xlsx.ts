// Parse the POS outlet-level Excel (e.g. "Monthly Sales Performance" sheet)
// into a flat list of outlet rows used by the ECP + Region aggregations.

import * as XLSX from "xlsx";

export interface OutletRow {
  customerName: string;
  accountType: string;   // SIO-OPTC, KCS-EXC, …
  amount: number;        // MYR
  salesman: string;
}

export function parseOutletXlsx(buf: ArrayBuffer): OutletRow[] {
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sheetName =
    wb.SheetNames.find(n => /monthly.*sales.*performance/i.test(n)) ??
    wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  return rows
    .map((r): OutletRow | null => {
      const name = String(r["Customer Name"] ?? r["CUSTOMER NAME"] ?? "").trim();
      if (!name) return null;
      const accountType = String(r["Account Type"] ?? r["AccountType"] ?? "").trim();
      const amount = Number(r["Amount"] ?? 0) || 0;
      const salesman = String(r["Salesman"] ?? "").trim();
      return { customerName: name, accountType, amount, salesman };
    })
    .filter((x): x is OutletRow => x !== null && x.amount !== 0);
}

// ECP list sheet: Store Name → State + Type. Used to enrich outlet rows when not present.
export interface EcpListEntry {
  storeName: string;
  state: string;
  town: string;
  type: string;
  salesman: string;
}

// ----------------------------------------------------------------------------
// "Sales Analysis By Region" Excel — the POS "Customer UD Group" monthly report.
//
// The file is grouped into sections like `Customer UD Group : JOHOR (STATE)`,
// each followed by per-customer rows and a `Sub Total` row. Amounts are
// laid out across the sheet one band of columns per month (e.g. `Mar 26`),
// with merged headers so the visible data column drifts a few cells left of
// the header text. We pick a generous band around the header and read the
// first numeric value in the Sub Total row as that group's monthly total.
// ----------------------------------------------------------------------------
export interface RegionXlsxEntry {
  state: string;       // Upper-cased, e.g. "JOHOR"
  kind: "state" | "country";
  sales: number;       // MYR for the target month
}

const SHORT_MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] as const;

export function parseSalesByRegionXlsx(buf: ArrayBuffer, year: number, month: number): RegionXlsxEntry[] {
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  // Locate the header column for the target month label (e.g. "Mar 26").
  const label = `${SHORT_MONTH[month - 1]} ${String(year).slice(-2)}`;
  let headerCol = -1;
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (typeof v === "string" && v.trim().toLowerCase() === label.toLowerCase()) {
        headerCol = c; break;
      }
    }
    if (headerCol >= 0) break;
  }
  if (headerCol < 0) return [];

  // The numeric total for a given merged header can drift up to ~3 columns to
  // the left of the header cell, and rarely a column or two to the right.
  const bandStart = Math.max(0, headerCol - 4);
  const bandEnd = headerCol + 4;

  const pickInBand = (row: unknown[] | undefined): number | null => {
    if (!row) return null;
    let fallback: number | null = null;
    for (let c = bandStart; c <= bandEnd; c++) {
      const v = row[c];
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v !== 0) return v;
        if (fallback === null) fallback = v;
      }
    }
    return fallback;
  };

  const out: RegionXlsxEntry[] = [];
  let currentGroup: { name: string; kind: "state" | "country" } | null = null;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const labelCell = String(row[3] ?? "").trim();
    // Group header: "Customer UD Group : JOHOR (STATE)"
    if (labelCell === "Customer UD Group") {
      const name = String(row[8] ?? "").trim();
      if (name) {
        const m = name.match(/^(.+?)\s*\((STATE|COUNTRY)\)\s*$/i);
        if (m) {
          currentGroup = { name: m[1].trim().toUpperCase(), kind: m[2].toUpperCase() === "COUNTRY" ? "country" : "state" };
        } else {
          currentGroup = { name: name.toUpperCase(), kind: "state" };
        }
      }
      continue;
    }
    // Sub Total row closes out the current group. The value sits in the row *after* the label.
    if (labelCell === "Sub Total" && currentGroup) {
      const amount = pickInBand(rows[r + 1] as unknown[] | undefined) ?? pickInBand(row) ?? 0;
      out.push({ state: currentGroup.name, kind: currentGroup.kind, sales: amount });
      currentGroup = null;
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// "Salesman Sales and Collection Listing By Account Type" Excel.
//
// Columns (0-indexed) emitted by the POS:
//   c1  = Customer Name
//   c6  = Account Type  (SIO-OPTC, KCS-EXC, OVERSEA, …)
//   c12 = <month>' <year> Sales       (e.g. "Mar' 2026 Sales")
//   c16 = <month>' <year> Coll.       (e.g. "Mar' 2026 Coll.")
//
// The file provides everything Sales-by-ECP and Collection need in one shot —
// no separate ECP list join required, since each outlet row already carries
// its Account Type.
// ----------------------------------------------------------------------------
export interface SalesmanSalesParseResult {
  outlets: OutletRow[];
  collectionMyr: number;
}

export function parseSalesmanSalesXlsx(buf: ArrayBuffer, year: number, month: number): SalesmanSalesParseResult {
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { outlets: [], collectionMyr: 0 };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  // Find the header row that names each month column (e.g. row with "Mar' 2026 Sales").
  const salesLabel = `${SHORT_MONTH[month - 1]}' ${year} Sales`;
  const collLabel = `${SHORT_MONTH[month - 1]}' ${year} Coll.`;
  let salesCol = -1;
  let collCol = -1;
  let headerRow = -1;
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (typeof v !== "string") continue;
      const s = v.trim();
      if (salesCol < 0 && s.toLowerCase() === salesLabel.toLowerCase()) { salesCol = c; headerRow = r; }
      if (collCol < 0 && s.toLowerCase() === collLabel.toLowerCase()) { collCol = c; headerRow = r; }
    }
    if (salesCol >= 0 && collCol >= 0) break;
  }
  if (salesCol < 0 || headerRow < 0) return { outlets: [], collectionMyr: 0 };

  // Header columns and data columns drift by a few cells because the file uses
  // merged cells per month (header spans 3-4 cols; the numeric value lives at
  // one specific cell that doesn't always align with the header's start). Scan
  // a small band around each header column and pick the first numeric value.
  const pickFromBand = (row: unknown[], startCol: number): number => {
    for (let c = Math.max(0, startCol - 1); c <= startCol + 3; c++) {
      const v = row[c];
      if (typeof v === "number" && Number.isFinite(v) && v !== 0) return v;
    }
    return 0;
  };

  const outlets: OutletRow[] = [];
  let collectionMyr = 0;
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const name = String(row[1] ?? "").trim();
    const accountType = String(row[6] ?? "").trim();
    // Skip blank rows, salesman sub-headers ("Salesman ID : …"), and any row
    // without a real Account Type (totals / footers).
    if (!name || !accountType) continue;
    if (/^(salesman|grand\s*total|sub\s*total|total)/i.test(name)) continue;
    // The header row itself can repeat — ignore the literal "Account Type" label.
    if (accountType.toLowerCase() === "account type") continue;

    const sales = pickFromBand(row, salesCol);
    const coll = collCol >= 0 ? pickFromBand(row, collCol) : 0;
    if (sales !== 0) {
      outlets.push({ customerName: name, accountType, amount: sales, salesman: "" });
    }
    collectionMyr += coll;
  }
  return { outlets, collectionMyr };
}

export function parseEcpListXlsx(buf: ArrayBuffer): EcpListEntry[] {
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sheetName = wb.SheetNames.find(n => /ECP\s*List/i.test(n)) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, range: 0 });
  return rows
    .map((r): EcpListEntry | null => {
      const storeName = String(r["Store Name"] ?? "").trim();
      if (!storeName) return null;
      return {
        storeName,
        state: String(r["State"] ?? "").trim(),
        town: String(r["Town"] ?? "").trim(),
        type: String(r["Type"] ?? "").trim(),
        salesman: String(r["Salesman"] ?? "").trim(),
      };
    })
    .filter((x): x is EcpListEntry => x !== null);
}
