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
  "SDBRHOCCSG80":   "Breath O Correct",
  "SDBRHOCCSG202":  "Breath O Correct",
  "SDBRHOCCSG2025": "Breath O Correct",
  "SDBRHOCCSG2026": "Breath O Correct",

  "WOHLKKE":   "Wohlk KE RGP",

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

// ----------------------------------------------------------------------------
// Trial-Lens / PRM / Exclusion tables.
//
// Sourced verbatim from docs/CLAUDE-RULES.md (the SEED Malaysia POS rules
// document). The contract is:
//
//   - Trial-Lens codes (TR-style): the POS reports a *trial-pack* qty; for
//     Slide 5 we need to convert it back into individual-lens equivalents by
//     dividing by the pack size (32 / 10 / 6 / 3 / 2) and rolling into the
//     parent product. Sales MYR is unchanged.
//   - PRM codes: full qty rolls into the parent product. No divide. MYR
//     unchanged.
//   - EXCLUDED codes are dropped from Slide 5 / 6 entirely (e.g. "PRMSD" is a
//     free-gift promo with zero revenue).
//
// When you touch this table, also update docs/CLAUDE-RULES.md so the human
// reference stays in sync.
// ----------------------------------------------------------------------------

export const TRIAL_LENS_ADJUSTMENTS: Record<string, { parentBase: string; divisor: number }> = {
  // ÷32 (1-day, 32-pack)
  "1DPETR": { parentBase: "1DPE", divisor: 32 },
  "1DPSTR": { parentBase: "1DPS", divisor: 32 },
  "1DTR":   { parentBase: "1DPR", divisor: 32 },
  "1DTT":   { parentBase: "1DPT", divisor: 32 },
  "1MTR":   { parentBase: "1DMS", divisor: 32 },
  // Trial pack of View Support (1 Day Pure Trial - View Support).
  "1DTRVS": { parentBase: "1DPVS", divisor: 32 },

  // ÷3 (Monthly Fine Plus 3-pack — trial pack rolls back into the parent.)
  // Codes are intentionally listed here even though their suffix is just "T":
  // see the rules doc for the divisor table.
  "MHFT":   { parentBase: "MFN+", divisor: 3 },
  "MHFT+":  { parentBase: "MFN+", divisor: 3 },

  // ÷6 (2-week, 6-pack + Monthly Pure 6)
  "2UWKAT": { parentBase: "2UWK", divisor: 6 },
  "2UWT":   { parentBase: "2UWK", divisor: 6 },
  "2WKUT":  { parentBase: "2WMS", divisor: 6 },
  "MTPRT":  { parentBase: "MTPR", divisor: 6 },

  // ÷10
  "EC-MT":   { parentBase: "EC10-M",   divisor: 10 },
  "ECRT-MT": { parentBase: "ECRT30-M", divisor: 10 }, // match by name (ECRT30-M / ECRT10-M)
  "ECWT-MT": { parentBase: "ECWT30-M", divisor: 10 }, // match by name (ECWT30-M / ECWT10-M)
  "ECTR":    { parentBase: "EC10-M",   divisor: 10 },
  "MNSFTR":  { parentBase: "MNSF10",   divisor: 10 },

  // ÷3
  "MNSFCUVTR": { parentBase: "MNSFCUV", divisor: 3 },

  // ÷2
  "MCUV2T": { parentBase: "MCUV2", divisor: 2 },
  "MCUVT":  { parentBase: "MCUV",  divisor: 2 },
};

export const PRM_TO_PARENT: Record<string, string> = {
  "1DMSPRM":     "1DMS",
  "1DPEPRM":     "1DPE",
  "1DPRPRM":     "1DPR",
  "1DPRVSPRM":   "1DPVS", // PRM variant of the View Support line
  "1DPSPRM":     "1DPS",
  "1DPTPRM":     "1DPT",
  "EC10-MPRM":   "EC10-M",
  "ECPRM":       "EC10-M", // legacy short form of EC10-MPRM
  "ECRT30-MPRM": "ECRT30-M",
  "ECR30-MPRM":  "ECRT30-M", // typo-tolerant alias
  "ECWT30-MPRM": "ECWT30-M",
  "MCIIPHRM":    "MCUV2",
  "MCIIPRM":     "MCUV2",   // file uses MCIIPRM; docs say MCIIPHRM — both map here
  "MCUPRM":      "MCUV",
  "MHFPRM":      "MFN+",
  "MHFPRM+":     "MFN+",
  "MNSFCUVPRM":  "MNSFCUV",
  "MNSFPRM":     "MNSF10",
  "MTPRPRM3":    "MTPR3",
  "2UWKPRM":     "2UWK",
  "2WMSPRM":     "2WMS",
  "2WPTPRM":     "2WPT",
};

// Codes that the parser should silently drop (qty = 0, no revenue, no product).
export const EXCLUDED_CODES: ReadonlySet<string> = new Set(["PRMSD"]);

export function normaliseGroupCode(raw: string): { base: string; suffix: SkuSuffix } {
  const code = raw.trim().toUpperCase();
  for (const s of SUFFIX_TAGS) {
    if (code.endsWith(s) && SKU_MAP[code.slice(0, -s.length)]) {
      return { base: code.slice(0, -s.length), suffix: s };
    }
  }
  return { base: code, suffix: null };
}

export interface SkuLookupResult {
  product: CanonicalProduct | null;
  suffix: SkuSuffix;
  /** Divide reported qty by this before rolling into the parent product.
   *  Always 1 for normal/PRM rows; 2/3/6/10/32 for trial-lens rows. */
  qtyDivisor: number;
  /** True for codes the rules doc says to drop entirely (e.g. PRMSD). */
  excluded: boolean;
}

export function lookupProduct(rawGroupCode: string): SkuLookupResult {
  const code = rawGroupCode.trim().toUpperCase();

  if (EXCLUDED_CODES.has(code)) {
    return { product: null, suffix: null, qtyDivisor: 1, excluded: true };
  }

  // Trial-lens explicit table — checked before the generic suffix strip so
  // codes like "2UWKAT" (which the suffix strip can't recover) hit the right
  // parent + divisor.
  const trial = TRIAL_LENS_ADJUSTMENTS[code];
  if (trial) {
    return {
      product: SKU_MAP[trial.parentBase] ?? null,
      suffix: "TR",
      qtyDivisor: trial.divisor,
      excluded: false,
    };
  }

  // PRM explicit table — full qty into parent.
  const prmParent = PRM_TO_PARENT[code];
  if (prmParent) {
    return {
      product: SKU_MAP[prmParent] ?? null,
      suffix: "PRM",
      qtyDivisor: 1,
      excluded: false,
    };
  }

  // Fallback: generic suffix-strip. Per the rules doc, "all remaining trial
  // lens items not listed above" should be EXCLUDED (qty = 0, no parent).
  // We treat a code as "trial-lens-shaped" when the suffix-strip recovered a
  // TR / T suffix that maps to a known base. PRM and FC variants without an
  // explicit mapping still roll into their base at full qty — those aren't
  // covered by the exclusion rule.
  const { base, suffix } = normaliseGroupCode(code);
  if ((suffix === "TR" || suffix === "T") && SKU_MAP[base]) {
    return { product: null, suffix, qtyDivisor: 1, excluded: true };
  }
  return { product: SKU_MAP[base] ?? null, suffix, qtyDivisor: 1, excluded: false };
}
