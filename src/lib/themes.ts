/**
 * 12 curated palettes for the dashboard UI. Each palette re-maps the ink / ice /
 * accent scales via CSS custom properties set on <html>. The PPTX generators stay
 * on the default Midnight Executive palette — only the dashboard chrome changes.
 *
 * IMPORTANT — dark-mode handling:
 *
 *   Earlier versions wrote the LIGHT-mode ice/ink values as inline styles on
 *   <html>. Inline styles trump the `html.dark { ... }` CSS rules, so any non-
 *   default palette + dark theme produced low-contrast text (e.g. teal text on
 *   teal cards for the "Teal Trust" palette). applyPalette() and the bootstrap
 *   script now branch on document.documentElement.classList.contains("dark")
 *   and write a DARK-mode variant of the palette derived from its own hues.
 *   ThemeToggle re-applies the active palette every time the theme flips so
 *   the surface/text tokens stay coherent.
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

// ----- Color math helpers (no deps) -----
//
// All hex strings, no rgba/hsla. Used to derive dark-mode tokens from each
// palette without requiring designers to specify two parallel scales.

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const v = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
}
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return "#" + ((clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).padStart(6, "0");
}
/** Mix two hex colors. weight=0 returns a, weight=1 returns b. */
function mix(a: string, b: string, weight: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(
    A.r * (1 - weight) + B.r * weight,
    A.g * (1 - weight) + B.g * weight,
    A.b * (1 - weight) + B.b * weight,
  );
}
const darken  = (hex: string, w: number) => mix(hex, "#000000", w);
const lighten = (hex: string, w: number) => mix(hex, "#ffffff", w);

/**
 * Derive the full token set we write to <html> for a given palette + theme.
 * Returns a flat record { '--token': value } so the caller can apply it via
 * setProperty.
 *
 * Light mode: ink scale is the palette's "real" dark hues; ice scale is the
 * palette's "real" light tints; surfaces are mostly white.
 *
 * Dark mode: ink scale flips so primary text (--color-ink-900) becomes
 * near-white; the ice scale is remapped to *dark* tints derived from the
 * palette so cards/borders read as dark surfaces with the palette's hue.
 * Page bg = a very dark version of ink950, surfaces step up from there.
 */
export function tokensFor(p: Palette, isDark: boolean): Record<string, string> {
  if (!isDark) {
    return {
      "--color-ink-950": p.ink950,
      "--color-ink-900": p.ink900,
      "--color-ink-800": p.ink800,
      "--color-ink-700": p.ink700,
      "--color-ink-600": p.ink600,
      "--color-ice-200": p.ice200,
      "--color-ice-100": p.ice100,
      "--color-ice-50":  p.ice50,
      "--color-accent":  p.accent,
      "--color-accent-2": p.accent2,
      "--page-bg":       "#f6f7fb",
      "--surface-1":     "#ffffff",
      "--surface-2":     p.ice50,
      "--surface-3":     p.ice100,
      "--text-primary":  p.ink900,
      "--text-secondary": p.ink600,
      "--text-muted":    "#6b7280",
      "--border-subtle": p.ice100,
      "--border-strong": p.ice200,
    };
  }

  // ---- DARK MODE ----
  // Derive a dark surface ladder from the palette's deepest hue. Each step
  // lightens by ~5% so cards / hover / borders all read as elevations of
  // the page bg without losing the palette's character.
  const pageBg   = p.pageDark ?? darken(p.ink950, 0.35);
  const surface1 = lighten(pageBg, 0.06);   // primary card
  const surface2 = lighten(pageBg, 0.10);   // hover / row-alt
  const surface3 = lighten(pageBg, 0.16);   // chip / divider tint

  // Light text with a hint of the palette hue so the UI doesn't feel
  // disconnected from the chosen theme. Mix the palette's lightest ice
  // toward pure white at high weight.
  const textPrimary   = lighten(p.ice50, 0.20);   // headings + numbers
  const textSecondary = mix(p.ice200, "#ffffff", 0.55); // body / labels
  const textMuted     = mix(p.ice200, "#94a3b8", 0.40); // hints

  return {
    // Keep the brand-button hues unchanged in dark mode so buttons still
    // pop. ink900 swaps to a light tint because it's used as primary
    // text colour across the editor.
    "--color-ink-950": p.ink950,
    "--color-ink-900": textPrimary,
    "--color-ink-800": p.ink800,
    "--color-ink-700": p.ink700,
    "--color-ink-600": textSecondary,
    // The ice scale doubles as "card background" in many components, so
    // remap to the dark surface ladder. Anything reading from these
    // tokens automatically lands on a readable dark surface.
    "--color-ice-50":  surface1,
    "--color-ice-100": surface2,
    "--color-ice-200": surface3,
    "--color-accent":  p.accent,
    "--color-accent-2": p.accent2,
    "--page-bg":       pageBg,
    "--surface-1":     surface1,
    "--surface-2":     surface2,
    "--surface-3":     surface3,
    "--text-primary":  textPrimary,
    "--text-secondary": textSecondary,
    "--text-muted":    textMuted,
    "--border-subtle": surface2,
    "--border-strong": surface3,
  };
}

/** Apply a palette to the <html> element by writing CSS variables. */
export function applyPalette(p: Palette) {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const tokens = tokensFor(p, isDark);
  for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);
  try { localStorage.setItem("gm-palette", p.id); } catch { /* */ }
}

/** Re-apply whichever palette is currently saved. Used by ThemeToggle so the
 *  surface ladder switches between light and dark variants on theme flip. */
export function reapplyActivePalette() {
  try {
    const id = localStorage.getItem("gm-palette") || DEFAULT_PALETTE_ID;
    const p = PALETTES.find(x => x.id === id) ?? PALETTES[0];
    applyPalette(p);
  } catch { /* */ }
}

/** Inline bootstrap script content — applies the saved palette before hydration.
 *  We inline the color math so this runs without importing the module. */
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
    var isDark = document.documentElement.classList.contains("dark");

    function h2rgb(hex){var h=hex.replace("#","");var v=parseInt(h.length===3?h.split("").map(function(c){return c+c}).join(""):h,16);return {r:(v>>16)&255,g:(v>>8)&255,b:v&255}}
    function rgb2h(r,g,b){function c(n){return Math.max(0,Math.min(255,Math.round(n)))}return "#"+((c(r)<<16)|(c(g)<<8)|c(b)).toString(16).padStart(6,"0")}
    function mix(a,b,w){var A=h2rgb(a),B=h2rgb(b);return rgb2h(A.r*(1-w)+B.r*w,A.g*(1-w)+B.g*w,A.b*(1-w)+B.b*w)}
    var dk=function(x,w){return mix(x,"#000000",w)};
    var lt=function(x,w){return mix(x,"#ffffff",w)};

    var r = document.documentElement.style;
    function set(k,v){r.setProperty(k,v)}

    if (!isDark) {
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
      set("--page-bg",       "#f6f7fb");
      set("--surface-1",     "#ffffff");
      set("--surface-2",     p.ice50);
      set("--surface-3",     p.ice100);
      set("--text-primary",  p.ink900);
      set("--text-secondary", p.ink600);
      set("--text-muted",    "#6b7280");
      set("--border-subtle", p.ice100);
      set("--border-strong", p.ice200);
    } else {
      var pageBg = p.pageDark || dk(p.ink950, 0.35);
      var s1 = lt(pageBg, 0.06);
      var s2 = lt(pageBg, 0.10);
      var s3 = lt(pageBg, 0.16);
      var tPri = lt(p.ice50, 0.20);
      var tSec = mix(p.ice200, "#ffffff", 0.55);
      var tMut = mix(p.ice200, "#94a3b8", 0.40);
      set("--color-ink-950", p.ink950);
      set("--color-ink-900", tPri);
      set("--color-ink-800", p.ink800);
      set("--color-ink-700", p.ink700);
      set("--color-ink-600", tSec);
      set("--color-ice-50",  s1);
      set("--color-ice-100", s2);
      set("--color-ice-200", s3);
      set("--color-accent",  p.accent);
      set("--color-accent-2", p.accent2);
      set("--page-bg",       pageBg);
      set("--surface-1",     s1);
      set("--surface-2",     s2);
      set("--surface-3",     s3);
      set("--text-primary",  tPri);
      set("--text-secondary", tSec);
      set("--text-muted",    tMut);
      set("--border-subtle", s2);
      set("--border-strong", s3);
    }
  } catch(e){}
})();
`;
}
