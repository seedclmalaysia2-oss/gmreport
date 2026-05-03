// Canonical product list used across the 13 sections. Order mirrors Slide 7 of the HQ sample deck.
export const CANONICAL_PRODUCTS = [
  "1dayPureUP (32P)",
  "1dayPure Silfa",
  "1dayPureUP Astig (32P)",
  "1dayPureUP Multistage (32P)",
  "1dayPureUP EDOF (32P)",
  "1 Day View Support",
  "2weekPure Multistage (6P)",
  "2weekPure Up Toric",
  "2weekPure Up (6P)",
  "Eye coffret-M",
  "Eye Coffret-M 10 Toric",
  "Eye Coffret-M 30 Toric",
  "MonthlyFine Plus (3P)",
  "Monthly Pure 3",
  "Monthly Pure 6",
  "MonthlyColour UV - Pegavision",
  "MonthlyColour UV - Blue",
  "MonthlyColour UV - Orange",
  "MonthlyColour UV II",
  "Minasoft 1Day Color UV",
  "Minasoft Care UV",
  "UV-1 / UV-1 KC",
  "As-Luna / O2 Noah",
  "Iris Lens",
  "Ultra Vision",
  "Breath O Correct",
  "Wohlk KE RGP",
  "DISOP H2O2 Solution",
  "DISOP Ultra Eyedrop",
] as const;

export type CanonicalProduct = (typeof CANONICAL_PRODUCTS)[number];

// Inventory groups — map to Slide 12 layout
export const INVENTORY_GROUPS = [
  {
    name: "Clear CL (Daily)",
    products: ["1DP", "1DP ASTIG", "1DP MS", "1DP V.S", "1DP EDOF", "1D SILFA"],
  },
  {
    name: "Clear CL (Monthly/2W)",
    products: ["Mfine UV+", "MTPure3", "MTPure6", "2WK Pure", "2WK Multi", "2WK Toric"],
  },
  {
    name: "Color CL (Eye Coffret / Minasoft)",
    products: ["EC-10 M", "EC-10 M Toric", "EM-30 M Toric", "Minasoft Col Sihy", "Minasoft Care Sihy"],
  },
  {
    name: "Color CL (Monthly Colour)",
    products: ["MC - Blue", "MC - Orange", "MC - II", "MC-Pega (Old)"],
  },
  {
    name: "CL Care",
    products: ["DISOP H202 SOL", "DISOP A. ULTRA", "DISOP A.Dual Gel", "BOC"],
  },
] as const;
