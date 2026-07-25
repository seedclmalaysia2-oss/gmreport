/**
 * Friendly labels for the parser's internal file-kind identifiers. Kept
 * in one module so the Files page, the import form, and any future
 * consumer read the same names — silent snake_case leaks (`pos_ecp_list`
 * appearing in the UI while `POS Master (Stock Sales Analysis)` appears
 * elsewhere) were a real drift risk when this map lived in two files.
 *
 * Mirrors the parser router in src/app/api/import/route.ts; if a new
 * kind is added there, add its label here.
 */
export const KIND_LABELS: Record<string, string> = {
  pos_master:     "POS Master (Stock Sales Analysis)",
  pos_mcuv:       "MCUV breakdown",
  pos_writeoff:   "Stocks Write-Off",
  pos_outlets:    "Monthly Sales Performance",
  pos_ecp_list:   "ECP List",
  pos_region:     "Sales Analysis By Region",
  pos_salesman:   "Salesman Sales & Collection",
  pos_inventory:  "Stock List (SCLM)",
  pos_collection: "Collection Listing",
  pos_daily:      "Daily Sales Quantity",
  ref_2025:       "2025 Sales Summary (prior-year reference)",
  unknown:        "Unrecognised file",
};

/** Fallback-safe accessor: returns the friendly label or the raw kind. */
export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}
