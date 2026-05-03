import type { MonthReport } from "@/lib/schema";
import { MONTH_NAMES } from "@/lib/utils";
import path from "node:path";
import fs from "node:fs";

export const SLIDE_W = 13.33;
export const SLIDE_H = 7.5;

export type Template = "classic" | "modern";

export type PptxInput = {
  months: MonthReport[];       // 1 or 2 consecutive months
  template: Template;
  /** All months on file — lets generators cross-reference prior months (YTD, FEB vs MAR). */
  context?: MonthReport[];
  /** Brand palette for the deck. Defaults to "midnight" if missing. */
  paletteId?: string;
};

// Mutable palette objects — both generators reference these module-level objects
// directly. Calling `applyThemeToClassic/Modern()` at the start of each export
// swaps the colour values before any slide is drawn. Generation is synchronous
// between the two calls so there's no interleaving even under concurrent requests.
export const CLASSIC_PALETTE = {
  header: "1F3864",
  headerText: "FFFFFF",
  rowAlt: "F2F4F8",
  tableBorder: "D0D4DE",
  positive: "2C8A4A",
  negative: "B91C1C",
  muted: "6B7280",
  text: "1F2937",
};

export const MODERN_PALETTE = {
  ink:      "0B0F2B",
  ink2:     "1E2761",
  ink3:     "2B3883",
  ice:      "CADCFC",
  ice2:     "E4ECFF",
  accent:   "F96167",
  accent2:  "F9E795",
  white:    "FFFFFF",
  mutedBg:  "F4F7FF",
  rowAlt:   "F1F4FC",
  positive: "2C8A4A",
  negative: "B91C1C",
};

/** Hex colour as pptxgenjs expects — uppercase, no leading "#". */
function hex(c: string): string {
  return (c.startsWith("#") ? c.slice(1) : c).toUpperCase().padStart(6, "0");
}

import { PALETTES, DEFAULT_PALETTE_ID, type Palette } from "../themes";

function findPalette(paletteId: string | undefined): Palette {
  return PALETTES.find(p => p.id === (paletteId ?? DEFAULT_PALETTE_ID)) ?? PALETTES[0];
}

export function applyThemeToClassic(paletteId: string | undefined) {
  const p = findPalette(paletteId);
  CLASSIC_PALETTE.header     = hex(p.ink800);
  CLASSIC_PALETTE.headerText = "FFFFFF";
  CLASSIC_PALETTE.rowAlt     = hex(p.ice50);
  CLASSIC_PALETTE.tableBorder = hex(p.ice200);
  CLASSIC_PALETTE.text       = hex(p.ink900);
  CLASSIC_PALETTE.muted      = hex(p.ink600);
  // positive / negative stay the universal red/green semantics.
}

export function applyThemeToModern(paletteId: string | undefined) {
  const p = findPalette(paletteId);
  MODERN_PALETTE.ink     = hex(p.ink950);
  MODERN_PALETTE.ink2    = hex(p.ink800);
  MODERN_PALETTE.ink3    = hex(p.ink700);
  MODERN_PALETTE.ice     = hex(p.ice200);
  MODERN_PALETTE.ice2    = hex(p.ice100);
  MODERN_PALETTE.accent  = hex(p.accent);
  MODERN_PALETTE.accent2 = hex(p.accent2);
  MODERN_PALETTE.mutedBg = hex(p.ice50);
  MODERN_PALETTE.rowAlt  = hex(p.ice50);
  // positive / negative stay universal.
}

export function titleFor(months: MonthReport[]): string {
  if (months.length === 1) {
    const m = months[0];
    return `${monthNameFull(m.month)} ${m.year}`;
  }
  const first = months[0], last = months[months.length - 1];
  const sameYear = first.year === last.year;
  return sameYear
    ? `${MONTH_NAMES[first.month - 1]} & ${MONTH_NAMES[last.month - 1]} ${first.year}`
    : `${MONTH_NAMES[first.month - 1]} ${first.year} & ${MONTH_NAMES[last.month - 1]} ${last.year}`;
}

export function monthNameFull(m: number): string {
  return ["January","February","March","April","May","June","July","August","September","October","November","December"][m - 1] ?? "";
}

export function monthShort(m: number): string { return MONTH_NAMES[m - 1]; }

export function brandImagePath(name: string): string {
  return path.join(process.cwd(), "public", "brand", name);
}

export function brandImageDataUrl(name: string): string | null {
  try {
    const p = brandImagePath(name);
    const buf = fs.readFileSync(p);
    const ext = path.extname(p).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch { return null; }
}

export function fmtMYR(n: number | null | undefined, digits = 0): string {
  if (n == null || isNaN(n)) return "";
  return n.toLocaleString("en-MY", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtJPY(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "";
  return "¥" + Math.round(n).toLocaleString("en-US");
}

export function fmtPct(ratio: number | null | undefined, digits = 0): string {
  if (ratio == null || isNaN(ratio)) return "";
  return (ratio * 100).toFixed(digits) + "%";
}

export function safeNum(n: number | null | undefined, fallback = 0): number {
  if (n == null || isNaN(n)) return fallback;
  return n;
}
