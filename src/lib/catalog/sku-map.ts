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

  // Wohlk. The POS emits the short codes WHKE / WHCLS / WHCLA; "WOHLKKE" is
  // kept as a legacy alias (it never appeared in a real export, which is why
  // Wohlk KE printed 0 while WHKE sat in the unmapped drawer).
  "WHKE":      "Wohlk KE RGP",
  "WOHLKKE":   "Wohlk KE RGP",
  "WHCLS":     "Wohlk Contact Life Sph",
  // Base code for the toric line is inferred from the observed trial code
  // "WHCLAT" (Wohlk C.Life Toric trial lens) — no paid toric row has been
  // seen yet. If the real base code differs it will surface as unmapped.
  "WHCLA":     "Wohlk Contact Life Toric",

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
  // Toric trial lenses. The POS code carries no 10/30 marker, so the pack size
  // has to be chosen. These roll into the 10 Toric line at ÷10 (owner decision,
  // 2026-08-24): the divisor and the destination now agree. Previously they
  // landed on the 30 Toric line while still using the 10-pack divisor, which
  // inflated 30 Toric ~3x on its trial component and left 10 Toric with none.
  "ECRT-MT": { parentBase: "ECRT10-M", divisor: 10 },
  "ECWT-MT": { parentBase: "ECWT10-M", divisor: 10 },
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

// ----------------------------------------------------------------------------
// SKU-LEVEL ("exploded") exports.
//
// Newer POS "Summary By Group" exports break each product into its individual
// shade / power / variant SKUs instead of the aggregated group codes above —
// e.g. MonthlyColour UV arrives as MC-NAT BROWN, MC-FIRE GRAY, … instead of a
// single MCUV line, and 1D Pure EDOF as HIGH/LOW/MID. This table maps each such
// SKU straight to its canonical product + qty divisor, bypassing the suffix
// logic (these codes don't strip cleanly). base/FOC rows use divisor 1; trial
// ("...T"/"...TR"/"...-T") rows use the pack size, matching the aggregated codes.
//
// MonthlyColour colour-box grouping (defined by the project owner):
//   Blue box   = Nat Brown/Gray (NB,NY), Glit Brown/Gray (GB,GY), Fire Brown/Gray (FB,FY)
//   Orange box = Jade Green (JG), Spark Brown/Gray (SB,SY), Shining Honey (SH)
//   Pegavision = Cocoa Brown (CB), Gray Dgry (GD)  [+ Pink, Gold when present]
//   II         = the MCII-* shades
// ----------------------------------------------------------------------------
export const SKU_LEVEL_MAP: Record<string, { product: CanonicalProduct; divisor: number }> = {
  // 1D Pure UP (32-pack; trials ÷32)
  "1DPR": { product: "1dayPureUP (32P)", divisor: 1 }, "1DPRFC": { product: "1dayPureUP (32P)", divisor: 1 }, "1DPRTR": { product: "1dayPureUP (32P)", divisor: 32 },
  "1DTT": { product: "1dayPureUP Astig (32P)", divisor: 32 },
  "1MSA": { product: "1dayPureUP Multistage (32P)", divisor: 1 }, "1MSB": { product: "1dayPureUP Multistage (32P)", divisor: 1 },
  "1MSAFC": { product: "1dayPureUP Multistage (32P)", divisor: 1 }, "1MSBFC": { product: "1dayPureUP Multistage (32P)", divisor: 1 },
  "1MAT": { product: "1dayPureUP Multistage (32P)", divisor: 32 }, "1MBT": { product: "1dayPureUP Multistage (32P)", divisor: 32 },
  "1DPEHI": { product: "1dayPureUP EDOF (32P)", divisor: 1 }, "1DPELO": { product: "1dayPureUP EDOF (32P)", divisor: 1 }, "1DPEMID": { product: "1dayPureUP EDOF (32P)", divisor: 1 },
  "1DPELOFC": { product: "1dayPureUP EDOF (32P)", divisor: 1 }, "1DPEMDFC": { product: "1dayPureUP EDOF (32P)", divisor: 1 },
  "1DPEHITR": { product: "1dayPureUP EDOF (32P)", divisor: 32 }, "1DPELOTR": { product: "1dayPureUP EDOF (32P)", divisor: 32 }, "1DPEMDTR": { product: "1dayPureUP EDOF (32P)", divisor: 32 },
  "1DPVS": { product: "1 Day View Support", divisor: 1 }, "1DPVSFC": { product: "1 Day View Support", divisor: 1 }, "1DPVST": { product: "1 Day View Support", divisor: 32 },
  "1DPS": { product: "1dayPure Silfa", divisor: 1 }, "1DPSFC": { product: "1dayPure Silfa", divisor: 1 }, "1DPSTR": { product: "1dayPure Silfa", divisor: 32 },
  // 2 Week Pure (6-pack; trials ÷6)
  "2UWK": { product: "2weekPure Up (6P)", divisor: 1 }, "2UWKFC": { product: "2weekPure Up (6P)", divisor: 1 }, "2UWKT": { product: "2weekPure Up (6P)", divisor: 6 },
  "2UWKAT": { product: "2weekPure Up Toric", divisor: 6 },
  "2MSA": { product: "2weekPure Multistage (6P)", divisor: 1 }, "2MSB": { product: "2weekPure Multistage (6P)", divisor: 1 },
  "2UWKMSFC": { product: "2weekPure Multistage (6P)", divisor: 1 }, "2UMBT": { product: "2weekPure Multistage (6P)", divisor: 6 },
  // Eye Coffret-M colour makes (10-pack; trials ÷10)
  "ECB-M": { product: "Eye coffret-M", divisor: 1 }, "ECDW-M": { product: "Eye coffret-M", divisor: 1 }, "ECF-M": { product: "Eye coffret-M", divisor: 1 }, "ECLV-M": { product: "Eye coffret-M", divisor: 1 }, "ECMY-M": { product: "Eye coffret-M", divisor: 1 }, "ECN-M": { product: "Eye coffret-M", divisor: 1 }, "ECR-M": { product: "Eye coffret-M", divisor: 1 }, "ECS-M": { product: "Eye coffret-M", divisor: 1 }, "ECST-M": { product: "Eye coffret-M", divisor: 1 }, "ECW-M": { product: "Eye coffret-M", divisor: 1 },
  "ECB-MFC": { product: "Eye coffret-M", divisor: 1 }, "ECDW-MFC": { product: "Eye coffret-M", divisor: 1 }, "ECF-MFC": { product: "Eye coffret-M", divisor: 1 }, "ECLV-MFC": { product: "Eye coffret-M", divisor: 1 }, "ECMY-MFC": { product: "Eye coffret-M", divisor: 1 }, "ECN-MFC": { product: "Eye coffret-M", divisor: 1 }, "ECR-MFC": { product: "Eye coffret-M", divisor: 1 }, "ECS-MFC": { product: "Eye coffret-M", divisor: 1 }, "ECST-MFC": { product: "Eye coffret-M", divisor: 1 }, "ECW-MFC": { product: "Eye coffret-M", divisor: 1 },
  "ECB-MT": { product: "Eye coffret-M", divisor: 10 }, "ECDW-MT": { product: "Eye coffret-M", divisor: 10 }, "ECF-MT": { product: "Eye coffret-M", divisor: 10 }, "ECMY-MT": { product: "Eye coffret-M", divisor: 10 }, "ECN-MT": { product: "Eye coffret-M", divisor: 10 }, "ECR-MT": { product: "Eye coffret-M", divisor: 10 }, "ECS-MT": { product: "Eye coffret-M", divisor: 10 }, "ECST-MT": { product: "Eye coffret-M", divisor: 10 }, "ECW-MT": { product: "Eye coffret-M", divisor: 10 },
  "ECRT30-MFC": { product: "Eye Coffret-M 30 Toric", divisor: 1 }, "ECWT30-MFC": { product: "Eye Coffret-M 30 Toric", divisor: 1 },
  // Exploded-export spelling of the toric trial codes — same rule as
  // ECRT-MT / ECWT-MT above: 10 Toric line, ÷10.
  "ECRT-MTR": { product: "Eye Coffret-M 10 Toric", divisor: 10 }, "ECWT-MTR": { product: "Eye Coffret-M 10 Toric", divisor: 10 },
  // MonthlyFine Plus (3-pack ÷3) / MonthlyPure
  "MHFN+": { product: "MonthlyFine Plus (3P)", divisor: 1 }, "MHFTFC+": { product: "MonthlyFine Plus (3P)", divisor: 1 }, "MHFT": { product: "MonthlyFine Plus (3P)", divisor: 3 },
  "MTPR": { product: "Monthly Pure 6", divisor: 1 }, "MTPRTR": { product: "Monthly Pure 6", divisor: 6 },
  "MTPR3": { product: "Monthly Pure 3", divisor: 1 }, "MTPRFC3": { product: "Monthly Pure 3", divisor: 1 },
  // MonthlyColour UV — Blue box (÷2 trials)
  "MCNB": { product: "MonthlyColour UV - Blue", divisor: 1 }, "MCNBFC": { product: "MonthlyColour UV - Blue", divisor: 1 }, "MCNBT": { product: "MonthlyColour UV - Blue", divisor: 2 },
  "MCNG": { product: "MonthlyColour UV - Blue", divisor: 1 }, "MCNGFC": { product: "MonthlyColour UV - Blue", divisor: 1 }, "MCNYT": { product: "MonthlyColour UV - Blue", divisor: 2 },
  "MCGLB": { product: "MonthlyColour UV - Blue", divisor: 1 }, "MCGLBFC": { product: "MonthlyColour UV - Blue", divisor: 1 }, "MCGLBT": { product: "MonthlyColour UV - Blue", divisor: 2 },
  "MCGLG": { product: "MonthlyColour UV - Blue", divisor: 1 }, "MCGLGFC": { product: "MonthlyColour UV - Blue", divisor: 1 }, "MCGLGT": { product: "MonthlyColour UV - Blue", divisor: 2 },
  "MCFB": { product: "MonthlyColour UV - Blue", divisor: 1 }, "MCFBFC": { product: "MonthlyColour UV - Blue", divisor: 1 },
  "MCFY": { product: "MonthlyColour UV - Blue", divisor: 1 }, "MCFYFC": { product: "MonthlyColour UV - Blue", divisor: 1 },
  // MonthlyColour UV — Orange box
  "MCJD": { product: "MonthlyColour UV - Orange", divisor: 1 }, "MCJDFC": { product: "MonthlyColour UV - Orange", divisor: 1 },
  "MCSBR": { product: "MonthlyColour UV - Orange", divisor: 1 }, "MCSBRFC": { product: "MonthlyColour UV - Orange", divisor: 1 },
  "MCSGY": { product: "MonthlyColour UV - Orange", divisor: 1 }, "MCSGYFC": { product: "MonthlyColour UV - Orange", divisor: 1 },
  "MCSH": { product: "MonthlyColour UV - Orange", divisor: 1 }, "MCSHFC": { product: "MonthlyColour UV - Orange", divisor: 1 }, "MCSHT": { product: "MonthlyColour UV - Orange", divisor: 2 },
  // MonthlyColour UV — Pegavision box (leftover shades)
  "MCCB": { product: "MonthlyColour UV - Pegavision", divisor: 1 }, "MCCBFC": { product: "MonthlyColour UV - Pegavision", divisor: 1 }, "MCCBT": { product: "MonthlyColour UV - Pegavision", divisor: 2 },
  "MCGD": { product: "MonthlyColour UV - Pegavision", divisor: 1 }, "MCGDFC": { product: "MonthlyColour UV - Pegavision", divisor: 1 }, "MCGDT": { product: "MonthlyColour UV - Pegavision", divisor: 2 },
  // MonthlyColour UV II
  "MCDB": { product: "MonthlyColour UV II", divisor: 1 }, "MCDBFC": { product: "MonthlyColour UV II", divisor: 1 }, "MCDBT": { product: "MonthlyColour UV II", divisor: 2 },
  "MCDY": { product: "MonthlyColour UV II", divisor: 1 }, "MCDYFC": { product: "MonthlyColour UV II", divisor: 1 }, "MCDYT": { product: "MonthlyColour UV II", divisor: 2 },
  // Minasoft
  "MNSFBG": { product: "Minasoft 1Day Color UV", divisor: 1 }, "MNSFRB": { product: "Minasoft 1Day Color UV", divisor: 1 }, "MNSFVI": { product: "Minasoft 1Day Color UV", divisor: 1 }, "MNSFVIFC": { product: "Minasoft 1Day Color UV", divisor: 1 },
  "MNSFBG-T": { product: "Minasoft 1Day Color UV", divisor: 10 }, "MNSFRB-T": { product: "Minasoft 1Day Color UV", divisor: 10 }, "MNSFVI-T": { product: "Minasoft 1Day Color UV", divisor: 10 },
  "MNSFCUV": { product: "Minasoft Care UV", divisor: 1 }, "MNSFCUV-T": { product: "Minasoft Care UV", divisor: 3 },
  // Ultra Vision specialty series
  "UVAVMT": { product: "Ultra Vision", divisor: 1 }, "UVAVT": { product: "Ultra Vision", divisor: 1 }, "UVBDSP": { product: "Ultra Vision", divisor: 1 }, "UVDWSH": { product: "Ultra Vision", divisor: 1 }, "UVHYST": { product: "Ultra Vision", divisor: 1 }, "UVKRIC": { product: "Ultra Vision", divisor: 1 }, "UVKRTH": { product: "Ultra Vision", divisor: 1 }, "UVSPL": { product: "Ultra Vision", divisor: 1 },
  // RGP / hard lens / drops
  "SDUV1": { product: "UV-1 / UV-1 KC", divisor: 1 }, "SDUV1KC": { product: "UV-1 / UV-1 KC", divisor: 1 },
  "SDASL": { product: "As-Luna / O2 Noah", divisor: 1 },
  "SDIRS": { product: "Iris Lens", divisor: 1 },
  "SDBRHOC": { product: "Breath O Correct", divisor: 1 }, "SDBRHOCCSG": { product: "Breath O Correct", divisor: 1 }, "SDBRHOCTC": { product: "Breath O Correct", divisor: 1 },
  // DISOP care solutions & eyedrops
  "SDEYEDSP10M": { product: "DISOP Ultra Eyedrop", divisor: 1 }, "SDDSPEY10S": { product: "DISOP Ultra Eyedrop", divisor: 1 }, "SDEYEDSP20V": { product: "DISOP Ultra Eyedrop", divisor: 1 }, "SDDSP20S": { product: "DISOP Ultra Eyedrop", divisor: 1 }, "SDDSPVS": { product: "DISOP Ultra Eyedrop", divisor: 1 },
  "SDSOLDSP": { product: "DISOP H2O2 Solution", divisor: 1 }, "SDDSP60S": { product: "DISOP H2O2 Solution", divisor: 1 }, "SDSOLCC": { product: "DISOP H2O2 Solution", divisor: 1 },
};

// Toric SKUs are exploded by power/axis ("1DPT -0.75/AX10", "ECRT30-M -1.25X180",
// "2UWKA -0.75/AX180") — too many to list — so match them by code prefix. All
// are base sales (divisor 1). Trials/FOC of the toric lines are handled above.
const TORIC_PREFIXES: { re: RegExp; product: CanonicalProduct }[] = [
  { re: /^1DPT[\s\-]/i, product: "1dayPureUP Astig (32P)" },
  { re: /^2UWKA[\s\-]/i, product: "2weekPure Up Toric" },
  { re: /^ECRT10-M[\s\-]/i, product: "Eye Coffret-M 10 Toric" },
  { re: /^ECWT10-M[\s\-]/i, product: "Eye Coffret-M 10 Toric" },
  { re: /^ECRT30-M[\s\-]/i, product: "Eye Coffret-M 30 Toric" },
  { re: /^ECWT30-M[\s\-]/i, product: "Eye Coffret-M 30 Toric" },
];

/** Match an exploded toric power/axis SKU by prefix, or null. */
export function matchToricPrefix(code: string): CanonicalProduct | null {
  for (const t of TORIC_PREFIXES) if (t.re.test(code)) return t.product;
  return null;
}

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

  // SKU-level ("exploded") exports: exact code → product + divisor. Checked
  // first so a shade/power SKU never falls into the group-level suffix logic
  // (which can't strip these codes cleanly).
  const skuLevel = SKU_LEVEL_MAP[code];
  if (skuLevel) {
    return { product: skuLevel.product, suffix: null, qtyDivisor: skuLevel.divisor, excluded: false };
  }
  // Toric power/axis SKUs (e.g. "1DPT -0.75/AX10") — matched by prefix, base qty.
  const toric = matchToricPrefix(code);
  if (toric) {
    return { product: toric, suffix: null, qtyDivisor: 1, excluded: false };
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
