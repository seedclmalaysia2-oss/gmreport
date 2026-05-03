/**
 * 12 curated palettes for the dashboard UI. Each palette re-maps the ink / ice /
 * accent scales via CSS custom properties set on <html>. The PPTX generators stay
 * on the default Midnight Executive palette — only the dashboard chrome changes.
 *
 * Shape of a palette: one dominant "ink" for branded buttons / header chrome,
 * three ice tints (light backgrounds), and two accents. Everything else cascades.
 */

export type Palette = {
  id: string;
  name: string;
  mood: string;

  // Brand / ink scale — used for buttons, headers, strong text.
  ink950: string;
  ink900: string;
  ink800: string;
  ink700: string;
  ink600: string;

  // Soft tints — card/row backgrounds and borders.
  ice200: string;
  ice100: string;
  ice50:  string;

  // Accents — highlights, status markers, current-month markers.
  accent:  string;
  accent2: string;

  // Dark-mode page background (optional — falls back to ink950 if omitted).
  pageDark?: string;
};

export const PALETTES: Palette[] = [
  {
    id: "midnight", name: "Midnight Executive", mood: "navy · ice",
    ink950: "#0b0f2b", ink900: "#141a3d", ink800: "#1e2761", ink700: "#2b3883", ink600: "#4353a6",
    ice200: "#cadcfc", ice100: "#e4ecff", ice50: "#f4f7ff",
    accent: "#f96167", accent2: "#f9e795",
  },
  {
    id: "forest", name: "Forest & Moss", mood: "forest · moss",
    ink950: "#0e2512", ink900: "#1a3a21", ink800: "#2c5f2d", ink700: "#3f7a41", ink600: "#6a9b4d",
    ice200: "#c7dcb2", ice100: "#e4efd6", ice50: "#f2f6ea",
    accent: "#d97706", accent2: "#f5f5dc",
  },
  {
    id: "coral", name: "Coral Energy", mood: "coral · gold",
    ink950: "#2f3c7e", ink900: "#3b4a94", ink800: "#2f3c7e", ink700: "#4a58a3", ink600: "#7079b8",
    ice200: "#fdd8d8", ice100: "#fde7e7", ice50: "#fff6f5",
    accent: "#f96167", accent2: "#f9e795",
  },
  {
    id: "terracotta", name: "Warm Terracotta", mood: "clay · sand",
    ink950: "#4a1d16", ink900: "#6b2a1f", ink800: "#b85042", ink700: "#c9604f", ink600: "#d88778",
    ice200: "#e7e8d1", ice100: "#f0f1dd", ice50: "#faf8ed",
    accent: "#a7beae", accent2: "#e7e8d1",
  },
  {
    id: "ocean", name: "Ocean Gradient", mood: "deep · teal",
    ink950: "#03334a", ink900: "#054a6a", ink800: "#065a82", ink700: "#1c7293", ink600: "#3891ad",
    ice200: "#bae1ee", ice100: "#dcecf3", ice50: "#eff6fa",
    accent: "#21295c", accent2: "#f5c245",
  },
  {
    id: "charcoal", name: "Charcoal Minimal", mood: "graphite",
    ink950: "#0f1114", ink900: "#1a1d22", ink800: "#36454f", ink700: "#4a5a66", ink600: "#72808a",
    ice200: "#e5e7eb", ice100: "#f1f2f4", ice50: "#f8f9fa",
    accent: "#111827", accent2: "#fbbf24",
  },
  {
    id: "teal", name: "Teal Trust", mood: "teal · seafoam",
    ink950: "#00373e", ink900: "#015462", ink800: "#028090", ink700: "#009dac", ink600: "#3bbccb",
    ice200: "#b2ead1", ice100: "#daf3e6", ice50: "#edfaf2",
    accent: "#02c39a", accent2: "#f5f5f5",
  },
  {
    id: "berry", name: "Berry & Cream", mood: "berry · cream",
    ink950: "#2d0d17", ink900: "#4a1d2b", ink800: "#6d2e46", ink700: "#893b58", ink600: "#a87181",
    ice200: "#ece2d0", ice100: "#f4eee0", ice50: "#fbf8f0",
    accent: "#a26769", accent2: "#ece2d0",
  },
  {
    id: "sage", name: "Sage Calm", mood: "sage · eucalyptus",
    ink950: "#244034", ink900: "#34594b", ink800: "#50808e", ink700: "#69a297", ink600: "#84b59f",
    ice200: "#d4e6dc", ice100: "#e8f0ea", ice50: "#f3f8f4",
    accent: "#50808e", accent2: "#e5e0cd",
  },
  {
    id: "cherry", name: "Cherry Bold", mood: "cherry · ivory",
    ink950: "#3a0009", ink900: "#5c0009", ink800: "#990011", ink700: "#b5152a", ink600: "#d2374a",
    ice200: "#f5d4d9", ice100: "#fae4e7", ice50: "#fcf6f5",
    accent: "#2f3c7e", accent2: "#f9e795",
  },
  {
    id: "plum", name: "Plum Royalty", mood: "plum · lavender",
    ink950: "#2a0e3c", ink900: "#3e1856", ink800: "#5b2879", ink700: "#763a97", ink600: "#9162b3",
    ice200: "#e4d4f1", ice100: "#f0e5f7", ice50: "#f9f3fc",
    accent: "#c084fc", accent2: "#fde68a",
  },
  {
    id: "aurora", name: "Aurora", mood: "violet · indigo",
    ink950: "#1b1036", ink900: "#2a1958", ink800: "#3f2a7e", ink700: "#5a44ae", ink600: "#7b62d0",
    ice200: "#d7cdf5", ice100: "#e6defa", ice50: "#f4f0fe",
    accent: "#22d3ee", accent2: "#facc15",
  },
];

export const DEFAULT_PALETTE_ID = "midnight";

/** Palette shape the slide-preview component uses for its internal rendering. */
export type SlidePalette = {
  header: string;
  bg: string;
  text: string;
  muted: string;
  rowAlt: string;
  border: string;
  positive: string;
  negative: string;
};

function findPalette(id: string | undefined): Palette {
  return PALETTES.find(p => p.id === (id ?? DEFAULT_PALETTE_ID)) ?? PALETTES[0];
}

/** Build the slide-preview palette for the Classic template at a given theme. */
export function classicSlidePalette(paletteId: string | undefined): SlidePalette {
  const p = findPalette(paletteId);
  return {
    header: p.ink800,
    bg: "#ffffff",
    text: p.ink900,
    muted: p.ink600,
    rowAlt: p.ice50,
    border: p.ice200,
    positive: "#2C8A4A",
    negative: "#B91C1C",
  };
}

/** Build the slide-preview palette for the Modern template at a given theme. */
export function modernSlidePalette(paletteId: string | undefined): SlidePalette {
  const p = findPalette(paletteId);
  return {
    header: p.ink950,
    bg: "#ffffff",
    text: p.ink900,
    muted: p.ink600,
    rowAlt: p.ice50,
    border: p.ice200,
    positive: "#2C8A4A",
    negative: "#B91C1C",
  };
}

/** Apply a palette to the <html> element by writing CSS variables. */
export function applyPalette(p: Palette) {
  const root = document.documentElement;
  const set = (k: string, v: string) => root.style.setProperty(k, v);
  set("--color-ink-950", p.ink950);
  set("--color-ink-900", p.ink900);
  set("--color-ink-800", p.ink800);
  set("--color-ink-700", p.ink700);
  set("--color-ink-600", p.ink600);
  set("--color-ice-200", p.ice200);
  set("--color-ice-100", p.ice100);
  set("--color-ice-50",  p.ice50);
  set("--color-accent",  p.accent);
  set("--color-accent-2", p.accent2);
  // Keep semantic surface tokens coherent too.
  set("--surface-3", p.ice200);
  set("--surface-2", p.ice100);
  set("--surface-1", p.ice50.replace(/^#/, "#"));
  set("--border-strong", p.ice200);
  set("--border-subtle", p.ice100);
  try { localStorage.setItem("gm-palette", p.id); } catch { /* */ }
}

/** Inline bootstrap script content — applies the saved palette before hydration. */
export function paletteBootstrapScript(): string {
  const lookup = JSON.stringify(
    Object.fromEntries(PALETTES.map(p => [p.id, p])),
  );
  return `
(function(){
  try {
    var id = localStorage.getItem("gm-palette") || "${DEFAULT_PALETTE_ID}";
    var map = ${lookup};
    var p = map[id] || map["${DEFAULT_PALETTE_ID}"];
    if (!p) return;
    var r = document.documentElement.style;
    r.setProperty("--color-ink-950", p.ink950);
    r.setProperty("--color-ink-900", p.ink900);
    r.setProperty("--color-ink-800", p.ink800);
    r.setProperty("--color-ink-700", p.ink700);
    r.setProperty("--color-ink-600", p.ink600);
    r.setProperty("--color-ice-200", p.ice200);
    r.setProperty("--color-ice-100", p.ice100);
    r.setProperty("--color-ice-50",  p.ice50);
    r.setProperty("--color-accent",  p.accent);
    r.setProperty("--color-accent-2", p.accent2);
    r.setProperty("--surface-3", p.ice200);
    r.setProperty("--surface-2", p.ice100);
    r.setProperty("--surface-1", p.ice50);
    r.setProperty("--border-strong", p.ice200);
    r.setProperty("--border-subtle", p.ice100);
  } catch(e){}
})();
`;
}
