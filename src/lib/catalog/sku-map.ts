import type { CanonicalProduct } from "./products";

// POS "Summary By Group" code -> canonical product label.
// Suffixes like *PRM / *TR / *T / *FC on the raw code are stripped before lookup.
export const SKU_MAP: Record<string, CanonicalProduct> = {
  "1DPR":   "1dayPureUP (32P)",
  "1DPT":   "1dayPureUP Astig (32P)",
  "1DMS":   "1dayPureUP Multistage (32P)",
  "1DPE":   "1dayPureUP EDOF (32P)",
  "1DPVS":  "1 Day View Support",
  "1DPS":   "1dayPure Silfa",

  "2UWK":   "2weekPure Up (6P)",
  "2WMS":   "2weekPure Multistage (6P)",
  "2WPT":   "2weekPure Up Toric",

  "EC10-M":   "Eye coffret-M",
  "ECRT10-M": "Eye Coffret-M 10 Toric",
  "ECWT10-M": "Eye Coffret-M 10 Toric",
  "ECRT30-M": "Eye Coffret-M 30 Toric",
  "ECWT30-M": "Eye Coffret-M 30 Toric",

  "MHF":    "MonthlyFine Plus (3P)",
  "MHFP":   "MonthlyFine Plus (3P)",
  "MFN+":   "MonthlyFine Plus (3P)",
  "MTPR":   "Monthly Pure 6",
  "MTPR3":  "Monthly Pure 3",

  "MCII":   "MonthlyColour UV II",
  "MCUV2":  "MonthlyColour UV II",
  // Master PDF's rolled-up "MONTHLY COLOR UV" when the colour-breakdown PDFs
  // are NOT uploaded. Acts as a catch-all into the Pegavision bucket so nothing
  // is lost; if MCUV colour PDFs are present, those override these totals.
  "MCUV":   "MonthlyColour UV - Pegavision",

  "MNSF10":   "Minasoft 1Day Color UV",
  "MNSFCUV":  "Minasoft Care UV",

  "SDUV1":     "UV-1 / UV-1 KC",
  "SDUV1KC":   "UV-1 / UV-1 KC",
  "SDASL":     "As-Luna / O2 Noah",
  "SDO2N":     "As-Luna / O2 Noah",
  "SDIRIS":    "Iris Lens",
  "UVSCL":     "Ultra Vision",
  "UVSPCL":    "Ultra Vision",
  "SDBRHOC":   "Breath O Correct",
  "SDBRHOCCSG":"Breath O Correct",
  "SDBRHOCCSG202": "Breath O Correct",

  "SDRGPSL":   "DISOP H2O2 Solution",
  "SDEYEDROP": "DISOP Ultra Eyedrop",
};

// MCUV colour-variant PDFs roll up to these three product lines.
export const MCUV_FILE_TO_PRODUCT: Record<string, CanonicalProduct> = {
  BLUE:   "MonthlyColour UV - Blue",
  ORANGE: "MonthlyColour UV - Orange",
  PEGA:   "MonthlyColour UV - Pegavision",
};

// Strip meaningful suffixes to obtain the base code (and tag the variant).
// Order matters — longest suffix wins.
const SUFFIX_TAGS = ["PRM", "TR", "FC", "T"] as const;
export type SkuSuffix = (typeof SUFFIX_TAGS)[number] | null;

export function normaliseGroupCode(raw: string): { base: string; suffix: SkuSuffix } {
  const code = raw.trim().toUpperCase();
  for (const s of SUFFIX_TAGS) {
    if (code.endsWith(s) && SKU_MAP[code.slice(0, -s.length)]) {
      return { base: code.slice(0, -s.length), suffix: s };
    }
  }
  return { base: code, suffix: null };
}

export function lookupProduct(rawGroupCode: string): { product: CanonicalProduct | null; suffix: SkuSuffix } {
  const { base, suffix } = normaliseGroupCode(rawGroupCode);
  return { product: SKU_MAP[base] ?? null, suffix };
}
