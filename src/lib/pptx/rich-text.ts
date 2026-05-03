// Parse the HTML produced by <RichTextEditor> into pptxgenjs text runs so that
// bold / italic / underline / font-size / font-family / colour / highlight /
// strikethrough / sub-super / alignment / bullet / numbered list / line spacing
// all carry through to the exported slide.
//
// Supported tags / attributes emitted by the editor:
//   <b> <strong>         → bold
//   <i> <em>             → italic
//   <u>                  → underline
//   <s> <strike>         → strikethrough
//   <sub> / <sup>        → subscript / superscript
//   <span style="font-size:Npt|Npx">   → pt font size
//   <span style="font-family:…">       → font face
//   <span style="color:…">             → font colour
//   <font color="…">                    → font colour (legacy from execCommand)
//   <span style="background-color:…">  → highlight (PPT's "highlight" maps to text fill)
//   <font face="…">                     → font face (legacy)
//   <ul>/<ol>/<li>                      → bullet / numbered list
//   <br>                                → line break
//   <div> <p>                           → paragraph separator (with optional align + line-height)

import type PptxGenJS from "pptxgenjs";

type Run = { text: string; options: PptxGenJS.TextPropsOptions };

type Style = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontSize?: number;    // points
  fontFace?: string;
  color?: string;       // hex, no '#'
  highlight?: string;   // hex, no '#'
  subscript?: boolean;
  superscript?: boolean;
  align?: "left" | "center" | "right" | "justify";
  bulletType?: "bullet" | "number";
  indent?: number;      // list nesting depth
  lineSpacingMultiple?: number; // 1.0 / 1.15 / 1.5 / 2.0 …
};

function pxToPt(px: number): number {
  // 1pt ≈ 0.75px in the browser.
  return Math.max(8, Math.round(px * 0.75));
}

function parseFontSize(styleAttr: string): number | undefined {
  const m = styleAttr.match(/font-size\s*:\s*([\d.]+)\s*(px|pt)/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return m[2].toLowerCase() === "pt" ? Math.round(n) : pxToPt(n);
}

function parseFontFamily(styleAttr: string): string | undefined {
  const m = styleAttr.match(/font-family\s*:\s*([^;]+)/i);
  if (!m) return undefined;
  // execCommand inserts quoted families; take the first one and strip quotes.
  return m[1].split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}

function parseHexColor(value: string): string | undefined {
  const v = value.trim();
  if (!v || /transparent/i.test(v)) return undefined;
  if (v.startsWith("#")) return v.slice(1).toUpperCase().padStart(6, "0");
  // rgb(r,g,b)
  const m = v.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const [, r, g, b] = m;
    return [r, g, b].map(n => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  return undefined;
}

function parseStyles(styleAttr: string): Partial<Style> {
  const patch: Partial<Style> = {};
  if (!styleAttr) return patch;

  const fs = parseFontSize(styleAttr);  if (fs) patch.fontSize = fs;
  const ff = parseFontFamily(styleAttr); if (ff) patch.fontFace = ff;

  const colorM = styleAttr.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
  if (colorM) { const c = parseHexColor(colorM[1]); if (c) patch.color = c; }

  const bgM = styleAttr.match(/background(?:-color)?\s*:\s*([^;]+)/i);
  if (bgM) { const c = parseHexColor(bgM[1]); if (c) patch.highlight = c; }

  if (/font-weight\s*:\s*(bold|[6-9]\d0)/i.test(styleAttr)) patch.bold = true;
  if (/font-style\s*:\s*italic/i.test(styleAttr)) patch.italic = true;
  if (/text-decoration[^;]*underline/i.test(styleAttr)) patch.underline = true;
  if (/text-decoration[^;]*line-through/i.test(styleAttr)) patch.strike = true;

  const alignM = styleAttr.match(/text-align\s*:\s*(left|center|right|justify)/i);
  if (alignM) patch.align = alignM[1].toLowerCase() as Style["align"];

  const lhM = styleAttr.match(/line-height\s*:\s*([\d.]+)/i);
  if (lhM) patch.lineSpacingMultiple = Number(lhM[1]);

  return patch;
}

function styleForRun(style: Style): PptxGenJS.TextPropsOptions {
  const opts: PptxGenJS.TextPropsOptions = {};
  if (style.bold) opts.bold = true;
  if (style.italic) opts.italic = true;
  if (style.underline) opts.underline = { style: "sng" };
  if (style.strike) opts.strike = "sngStrike";
  if (style.fontSize) opts.fontSize = style.fontSize;
  if (style.fontFace) opts.fontFace = style.fontFace;
  if (style.color) opts.color = style.color;
  if (style.highlight) opts.highlight = style.highlight;
  if (style.subscript)   opts.subscript = true;
  if (style.superscript) opts.superscript = true;
  if (style.bulletType === "bullet") opts.bullet = true;
  if (style.bulletType === "number") opts.bullet = { type: "number" } as PptxGenJS.TextPropsOptions["bullet"];
  if (style.align) opts.align = style.align;
  return opts;
}

/**
 * Convert an HTML fragment to an array of pptxgenjs text runs.
 * Caller passes the runs straight to `slide.addText(runs, { x,y,w,h, ... })`.
 * `defaultFontSize` is used when a span doesn't override the size.
 */
export function htmlToPptxRuns(html: string | undefined, defaultFontSize = 14): Run[] {
  if (!html) return [{ text: "", options: { fontSize: defaultFontSize } }];

  // Use DOMParser when available (browser + Next SSR via undici in node 24).
  const doc = typeof DOMParser !== "undefined"
    ? new DOMParser().parseFromString(`<div>${html}</div>`, "text/html")
    : null;
  if (!doc) return [{ text: stripTags(html), options: { fontSize: defaultFontSize } }];

  const root = doc.body.firstChild as HTMLElement | null;
  if (!root) return [{ text: "", options: { fontSize: defaultFontSize } }];

  const runs: Run[] = [];

  const push = (text: string, style: Style) => {
    if (!text) return;
    runs.push({ text, options: styleForRun({ ...style, fontSize: style.fontSize ?? defaultFontSize }) });
  };

  const pushBreak = (style: Style) => {
    runs.push({
      text: "",
      options: { ...styleForRun(style), breakLine: true, fontSize: style.fontSize ?? defaultFontSize },
    });
  };

  const walk = (node: Node, inherited: Style) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").replace(/\u00a0/g, " ");
      push(text, inherited);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    const style: Style = { ...inherited };
    switch (tag) {
      case "b": case "strong": style.bold = true; break;
      case "i": case "em":     style.italic = true; break;
      case "u":                style.underline = true; break;
      case "s": case "strike": style.strike = true; break;
      case "sub":              style.subscript = true; break;
      case "sup":              style.superscript = true; break;
      case "br":               pushBreak(style); return;
    }

    // <font face="…" color="…"> — emitted by legacy execCommand.
    if (tag === "font") {
      const face = el.getAttribute("face");
      const color = el.getAttribute("color");
      const size = el.getAttribute("size");  // 1..7 scale
      if (face) style.fontFace = face.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
      if (color) { const c = parseHexColor(color); if (c) style.color = c; }
      if (size) {
        const idx = Math.max(1, Math.min(7, Number(size)));
        // Browser mapping (approx): 1=10, 2=13, 3=16, 4=18, 5=24, 6=32, 7=48
        style.fontSize = [10, 13, 16, 18, 24, 32, 48][idx - 1];
      }
    }

    // Inline style=""
    const inline = el.getAttribute("style") ?? "";
    if (inline) Object.assign(style, parseStyles(inline));

    const isBlock = tag === "div" || tag === "p";
    const isUl = tag === "ul";
    const isOl = tag === "ol";
    const isListItem = tag === "li";

    if (isListItem) {
      // List marker ownership: first text run in the <li> gets the bullet/number flag.
      // Nested <ul>/<ol> inside <li> propagate deeper indent.
      style.bulletType = inherited.bulletType ?? "bullet";
      style.indent = (inherited.indent ?? 0);
      let first = true;
      for (const child of Array.from(el.childNodes)) {
        const before = runs.length;
        walk(child, { ...style, bulletType: style.bulletType });
        if (first && runs.length > before) {
          runs[before].options = { ...runs[before].options, bullet: style.bulletType === "number" ? { type: "number" } : true };
          first = false;
        }
      }
      // Close the list item with a break so items stack vertically.
      const last = runs[runs.length - 1];
      if (last) last.options = { ...last.options, breakLine: true };
      return;
    }

    if (isUl || isOl) {
      const nested: Style = {
        ...style,
        bulletType: isOl ? "number" : "bullet",
        indent: (inherited.indent ?? 0) + 1,
      };
      for (const child of Array.from(el.childNodes)) walk(child, nested);
      return;
    }

    for (const child of Array.from(el.childNodes)) walk(child, style);

    if (isBlock) {
      const last = runs[runs.length - 1];
      if (last && !last.options.breakLine) last.options = { ...last.options, breakLine: true };
    }
  };

  for (const child of Array.from(root.childNodes)) walk(child, {});

  if (runs.length === 0) runs.push({ text: "", options: { fontSize: defaultFontSize } });
  return runs;
}

/** Extract the outermost line-height + alignment so callers can set `paraSpaceAfter` / `align` on the shape. */
export function paragraphDefaults(html: string | undefined): { align?: Style["align"]; lineSpacingMultiple?: number } {
  if (!html || typeof DOMParser === "undefined") return {};
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild as HTMLElement | null;
  if (!root) return {};
  // Scan first few block-level children.
  for (const el of Array.from(root.children).slice(0, 3)) {
    const style = parseStyles(el.getAttribute("style") ?? "");
    if (style.align || style.lineSpacingMultiple) {
      return { align: style.align, lineSpacingMultiple: style.lineSpacingMultiple };
    }
  }
  return {};
}

function stripTags(s: string) {
  return s.replace(/<[^>]*>/g, "");
}
