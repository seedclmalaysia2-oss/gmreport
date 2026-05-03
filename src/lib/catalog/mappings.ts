// Outlet Account-Type prefix -> ECP category (Slide 9)
export const ECP_CATEGORIES = [
  "Single Independent Outlet (SIO)",
  "Key Chain Store (KCS)",
  "Key Individual Outlet (KIO)",
  "Hospital & University Clinic",
  "Overseas",
] as const;
export type ECPCategory = (typeof ECP_CATEGORIES)[number];

export function classifyECP(accountType: string | null | undefined): ECPCategory {
  const t = (accountType ?? "").trim().toUpperCase();
  if (t.startsWith("SIO")) return "Single Independent Outlet (SIO)";
  if (t.startsWith("KCS")) return "Key Chain Store (KCS)";
  if (t.startsWith("KIO")) return "Key Individual Outlet (KIO)";
  if (t.startsWith("HOS") || t.startsWith("UNI") || t.startsWith("SPE")) return "Hospital & University Clinic";
  if (t.startsWith("OVE") || t.startsWith("EXPORT") || t === "") return "Overseas";
  return "Single Independent Outlet (SIO)";
}

// State -> Region (Slide 10)
export const REGIONS = [
  "Southern Region (Johor, Melaka & Negeri Sembilan)",
  "Central Region (KL, Selangor & Putrajaya)",
  "Northern Region (Kedah, Penang, Perak & Perlis)",
  "East Coast Region (Pahang, Kelantan & Terengganu)",
  "East Malaysia (Sabah & Sarawak) & Brunei",
] as const;
export type Region = (typeof REGIONS)[number];

const STATE_TO_REGION: Record<string, Region> = {
  MELAKA: "Southern Region (Johor, Melaka & Negeri Sembilan)",
  JOHOR: "Southern Region (Johor, Melaka & Negeri Sembilan)",
  "NEGERI SEMBILAN": "Southern Region (Johor, Melaka & Negeri Sembilan)",

  "W.P KL": "Central Region (KL, Selangor & Putrajaya)",
  "W.P. KL": "Central Region (KL, Selangor & Putrajaya)",
  "W.P KUALA LUMPUR": "Central Region (KL, Selangor & Putrajaya)",
  "W.P. KUALA LUMPUR": "Central Region (KL, Selangor & Putrajaya)",
  KL: "Central Region (KL, Selangor & Putrajaya)",
  "KUALA LUMPUR": "Central Region (KL, Selangor & Putrajaya)",
  SELANGOR: "Central Region (KL, Selangor & Putrajaya)",
  PUTRAJAYA: "Central Region (KL, Selangor & Putrajaya)",
  "W.P PUTRAJAYA": "Central Region (KL, Selangor & Putrajaya)",

  KEDAH: "Northern Region (Kedah, Penang, Perak & Perlis)",
  PERLIS: "Northern Region (Kedah, Penang, Perak & Perlis)",
  "PULAU PINANG": "Northern Region (Kedah, Penang, Perak & Perlis)",
  PENANG: "Northern Region (Kedah, Penang, Perak & Perlis)",
  PERAK: "Northern Region (Kedah, Penang, Perak & Perlis)",

  PAHANG: "East Coast Region (Pahang, Kelantan & Terengganu)",
  TERENGGANU: "East Coast Region (Pahang, Kelantan & Terengganu)",
  KELANTAN: "East Coast Region (Pahang, Kelantan & Terengganu)",

  SABAH: "East Malaysia (Sabah & Sarawak) & Brunei",
  SARAWAK: "East Malaysia (Sabah & Sarawak) & Brunei",
  LABUAN: "East Malaysia (Sabah & Sarawak) & Brunei",
  BRUNEI: "East Malaysia (Sabah & Sarawak) & Brunei",
};

// Legacy region labels used by earlier imports. Remap at read time so saved
// records keep parsing after the region-label refresh (NS moved from Central
// to Southern).
export const LEGACY_REGION_REMAP: Record<string, Region> = {
  "Southern Region (Melaka & Johor)": "Southern Region (Johor, Melaka & Negeri Sembilan)",
  "Central Region (KL, Selangor, Putrajaya & NS9)": "Central Region (KL, Selangor & Putrajaya)",
  "East Coast Region (Pahang, Terengganu & Kelantan)": "East Coast Region (Pahang, Kelantan & Terengganu)",
};

export function classifyRegion(state: string | null | undefined): Region | null {
  if (!state) return null;
  return STATE_TO_REGION[state.trim().toUpperCase()] ?? null;
}

// Agenda items (Slide 2) — fixed.
export const AGENDA = [
  "Sales Achievement",
  "Sales Trend",
  "Malaysia Market Outlook",
  "Monthly - Daily Sales",
  "Summary Sales by Quantity",
  "Sales By Product – Top 5 Contribution",
  "Sales By ECP",
  "Sales By Region",
  "Product Registration Update",
  "Inventory",
  "Expire Stock (Write OFF)",
  "Financial Related",
  "Other Market Update",
];
