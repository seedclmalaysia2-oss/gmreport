"use client";
import { useEffect, useRef, useState } from "react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight,
  Baseline, Bold, Highlighter, Indent, Italic, List, ListOrdered,
  Minus, Outdent, Plus, RotateCcw, Strikethrough, Subscript, Superscript,
  Type, Underline as UnderlineIcon,
} from "lucide-react";

/**
 * PowerPoint-style rich-text editor built on `contenteditable` + `document.execCommand`.
 * Toolbar exposes: font family, font size, bold/italic/underline/strike, sub/super,
 * font + highlight colour, bullet / numbered list, indent, line spacing, alignment.
 *
 * Output HTML is consumed by `src/lib/pptx/rich-text.ts` — every format is round-tripped
 * into pptxgenjs text-run options so the exported slide matches what you see here.
 */
export function RichTextEditor({
  value, onChange, placeholder, minHeight = 260,
}: {
  value: string | undefined;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Seed the editor's HTML only when the incoming value diverges — avoids clobbering caret while typing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== (value ?? "")) el.innerHTML = value ?? "";
  }, [value]);

  const commit = () => onChange(ref.current?.innerHTML ?? "");
  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    // `document.execCommand` is deprecated but still the broadest supported primitive
    // for contenteditable formatting across Chromium / WebKit / Firefox. Good enough
    // for an internal single-user tool, and every command below has a matching parser
    // in lib/pptx/rich-text.ts so formats survive into the PPTX.
    document.execCommand(command, false, arg);
    commit();
  };

  // -------- Font size (absolute) --------
  const setFontSize = (pt: number) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;                 // nothing selected — no-op
    const span = document.createElement("span");
    span.style.fontSize = `${pt}pt`;
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      sel.removeAllRanges();
      const r = document.createRange();
      r.selectNodeContents(span);
      sel.addRange(r);
      commit();
    } catch { /* invalid selection */ }
  };

  const bumpFontSize = (delta: number) => {
    const current = getCurrentFontSizePt() ?? 14;
    setFontSize(clampFontSize(current + delta));
  };

  const getCurrentFontSizePt = (): number | null => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || !sel.rangeCount) return null;
    return findAncestorFontSizePt(sel.getRangeAt(0).startContainer, el);
  };

  // -------- Font family --------
  const setFontFamily = (family: string) => {
    ref.current?.focus();
    document.execCommand("fontName", false, family);
    commit();
  };

  // -------- Colours (foreColor / backColor) --------
  const setFontColor = (hex: string) => {
    ref.current?.focus();
    document.execCommand("foreColor", false, hex);
    commit();
  };
  const setHighlight = (hex: string) => {
    ref.current?.focus();
    // Firefox wants "hiliteColor"; Chromium accepts both. Try both.
    try { document.execCommand("hiliteColor", false, hex); } catch { /* */ }
    document.execCommand("backColor", false, hex);
    commit();
  };

  // -------- Line spacing (inline via CSS) --------
  const setLineSpacing = (v: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    // Apply to the containing block (p/div/li). Walk up until we find one.
    let node: Node | null = r.startContainer;
    while (node && node !== el) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName.toLowerCase();
        if (["p", "div", "li", "ul", "ol"].includes(tag)) {
          (node as HTMLElement).style.lineHeight = v;
          commit();
          return;
        }
      }
      node = node.parentNode;
    }
    // Fallback — wrap in a div so we have a block to style.
    const div = document.createElement("div");
    div.style.lineHeight = v;
    try {
      div.appendChild(r.extractContents());
      r.insertNode(div);
      commit();
    } catch { /* */ }
  };

  // -------- Text case --------
  const applyTextCase = (kind: "upper" | "lower" | "title" | "sentence" | "toggle") => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const text = range.toString();
    if (!text) return;
    const next =
      kind === "upper"    ? text.toUpperCase()
    : kind === "lower"    ? text.toLowerCase()
    : kind === "title"    ? text.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())
    : kind === "sentence" ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
    : /* toggle */          [...text].map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join("");
    range.deleteContents();
    range.insertNode(document.createTextNode(next));
    commit();
  };

  // -------- Popover state (dropdowns) --------
  const [openMenu, setOpenMenu] = useState<null | "font" | "size" | "color" | "highlight" | "line" | "case" | "more">(null);
  const toggle = (m: typeof openMenu) => setOpenMenu(o => (o === m ? null : m));

  return (
    <div
      className="rounded-lg border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] overflow-hidden"
      onClick={e => {
        // Close dropdowns on outside click within the editor wrapper
        if ((e.target as HTMLElement).closest("[data-menu]")) return;
        setOpenMenu(null);
      }}
    >
      {/* ======================== Single toolbar row ========================
          Font + Paragraph groups merged into one bar. `flex-nowrap` + `overflow-x-auto`
          means on narrow viewports the bar scrolls horizontally rather than wrapping
          onto a second row. */}
      <div className="flex flex-nowrap items-center gap-0.5 px-2 py-1.5 border-b border-[var(--color-ice-200)] bg-[var(--color-ice-50)] overflow-x-auto">
        {/* --- Font family --- */}
        <Dropdown
          label={<span className="inline-flex items-center gap-1 text-xs font-medium w-[72px] text-left truncate">Font</span>}
          open={openMenu === "font"} onToggle={() => toggle("font")} title="Font family"
        >
          <ul className="min-w-[160px] py-1">
            {FONT_FAMILIES.map(f => (
              <MenuItem key={f} onClick={() => { setFontFamily(f); setOpenMenu(null); }}>
                <span style={{ fontFamily: f }}>{f}</span>
              </MenuItem>
            ))}
          </ul>
        </Dropdown>

        {/* --- Font size --- */}
        <Dropdown
          label={<span className="tabular-nums text-xs font-medium px-0.5">Size</span>}
          open={openMenu === "size"} onToggle={() => toggle("size")} title="Font size (pt)"
        >
          <ul className="max-h-64 overflow-y-auto py-1 w-20">
            {FONT_SIZES.map(s => (
              <MenuItem key={s} onClick={() => { setFontSize(s); setOpenMenu(null); }}>
                <span className="tabular-nums">{s}</span>
              </MenuItem>
            ))}
          </ul>
        </Dropdown>

        <Btn onClick={() => bumpFontSize(+1)} title="Increase font size"><Plus size={14} /></Btn>
        <Btn onClick={() => bumpFontSize(-1)} title="Decrease font size"><Minus size={14} /></Btn>
        <Btn onClick={() => exec("removeFormat")} title="Clear formatting">
          <span className="text-[13px] font-bold">A<sub className="text-[8px]">x</sub></span>
        </Btn>

        <Divider />

        {/* --- Inline styling --- */}
        <Btn onClick={() => exec("bold")}          title="Bold (Ctrl+B)"><Bold size={14} /></Btn>
        <Btn onClick={() => exec("italic")}        title="Italic (Ctrl+I)"><Italic size={14} /></Btn>
        <Btn onClick={() => exec("underline")}     title="Underline (Ctrl+U)"><UnderlineIcon size={14} /></Btn>
        <Btn onClick={() => exec("strikeThrough")} title="Strikethrough"><Strikethrough size={14} /></Btn>
        <Btn onClick={() => exec("subscript")}     title="Subscript"><Subscript size={14} /></Btn>
        <Btn onClick={() => exec("superscript")}   title="Superscript"><Superscript size={14} /></Btn>

        {/* --- Text case --- */}
        <Dropdown
          label={<span className="text-[13px] font-semibold">Aa</span>}
          open={openMenu === "case"} onToggle={() => toggle("case")} title="Change case"
        >
          <ul className="py-1 min-w-[180px]">
            <MenuItem onClick={() => { applyTextCase("sentence"); setOpenMenu(null); }}>Sentence case</MenuItem>
            <MenuItem onClick={() => { applyTextCase("lower");    setOpenMenu(null); }}>lowercase</MenuItem>
            <MenuItem onClick={() => { applyTextCase("upper");    setOpenMenu(null); }}>UPPERCASE</MenuItem>
            <MenuItem onClick={() => { applyTextCase("title");    setOpenMenu(null); }}>Capitalize Each Word</MenuItem>
            <MenuItem onClick={() => { applyTextCase("toggle");   setOpenMenu(null); }}>tOGGLE cASE</MenuItem>
          </ul>
        </Dropdown>

        {/* --- Highlight + Font colour --- */}
        <Dropdown
          label={<Highlighter size={14} />} open={openMenu === "highlight"} onToggle={() => toggle("highlight")} title="Text highlight colour"
        >
          <ColorGrid onPick={c => { setHighlight(c); setOpenMenu(null); }} includeNone onNone={() => { setHighlight("transparent"); setOpenMenu(null); }} />
        </Dropdown>
        <Dropdown
          label={<Baseline size={14} />} open={openMenu === "color"} onToggle={() => toggle("color")} title="Font colour"
        >
          <ColorGrid onPick={c => { setFontColor(c); setOpenMenu(null); }} />
        </Dropdown>

        <Divider />

        {/* --- Lists + indent --- */}
        <Btn onClick={() => exec("insertUnorderedList")} title="Bulleted list"><List size={14} /></Btn>
        <Btn onClick={() => exec("insertOrderedList")}   title="Numbered list"><ListOrdered size={14} /></Btn>
        <Btn onClick={() => exec("outdent")}             title="Decrease indent"><Outdent size={14} /></Btn>
        <Btn onClick={() => exec("indent")}              title="Increase indent"><Indent size={14} /></Btn>

        <Divider />

        {/* --- Alignment --- */}
        <Btn onClick={() => exec("justifyLeft")}   title="Align left"><AlignLeft size={14} /></Btn>
        <Btn onClick={() => exec("justifyCenter")} title="Align center"><AlignCenter size={14} /></Btn>
        <Btn onClick={() => exec("justifyRight")}  title="Align right"><AlignRight size={14} /></Btn>
        <Btn onClick={() => exec("justifyFull")}   title="Justify"><AlignJustify size={14} /></Btn>

        <Divider />

        {/* --- Line spacing --- */}
        <Dropdown
          label={<span className="inline-flex items-center gap-1 text-xs"><Type size={13} /> Spacing</span>}
          open={openMenu === "line"} onToggle={() => toggle("line")} title="Line spacing"
        >
          <ul className="py-1 min-w-[120px]">
            {LINE_SPACINGS.map(s => (
              <MenuItem key={s} onClick={() => { setLineSpacing(s); setOpenMenu(null); }}>
                <span className="tabular-nums">{s}</span>
              </MenuItem>
            ))}
          </ul>
        </Dropdown>

        {/* --- Reset --- */}
        <Btn onClick={() => exec("removeFormat")} title="Reset formatting"><RotateCcw size={14} /></Btn>
      </div>

      {/* ======================== Editor ======================== */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={e => onChange((e.currentTarget as HTMLDivElement).innerHTML)}
        onKeyDown={e => {
          // Let `Tab` indent inside lists instead of leaving the editor.
          if (e.key === "Tab") {
            const insideList = (window.getSelection()?.anchorNode as HTMLElement | null)?.closest?.("li");
            if (insideList) {
              e.preventDefault();
              exec(e.shiftKey ? "outdent" : "indent");
            }
          }
        }}
        data-placeholder={placeholder}
        className="px-4 py-3 text-sm leading-relaxed focus:outline-none [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-[var(--color-ink-600)] [&:empty:before]:opacity-60"
        style={{ minHeight }}
      />
    </div>
  );
}

// ============================ Toolbar building blocks ============================

function Btn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onMouseDown={e => e.preventDefault() /* keep selection alive */}
      onClick={onClick}
      title={title}
      className="rounded-md p-1.5 hover:bg-[var(--color-ice-100)] text-[var(--color-ink-800)]"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="h-5 w-px bg-[var(--color-ice-200)] mx-0.5" aria-hidden />;
}

function Dropdown({ label, open, onToggle, title, children }: {
  label: React.ReactNode; open: boolean; onToggle: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <div className="relative" data-menu>
      <button
        type="button"
        onMouseDown={e => e.preventDefault()}
        onClick={onToggle}
        title={title}
        className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 hover:bg-[var(--color-ice-100)] text-[var(--color-ink-800)]"
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="opacity-60"><path fill="currentColor" d="M1 3l4 4 4-4z" /></svg>
      </button>
      {open && (
        <div className="absolute z-30 left-0 top-full mt-1 rounded-md border border-[var(--color-ice-200)] bg-white dark:bg-[var(--surface-1)] shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onMouseDown={e => e.preventDefault()}
        onClick={onClick}
        className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-ice-100)] text-[var(--color-ink-900)]"
      >
        {children}
      </button>
    </li>
  );
}

function ColorGrid({ onPick, includeNone, onNone }: { onPick: (hex: string) => void; includeNone?: boolean; onNone?: () => void }) {
  return (
    <div className="p-2">
      {includeNone && (
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={onNone}
          className="w-full text-left text-xs mb-1.5 px-2 py-1 rounded hover:bg-[var(--color-ice-100)]"
        >
          No colour
        </button>
      )}
      <div className="grid grid-cols-8 gap-1">
        {COLORS.map(c => (
          <button
            key={c}
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => onPick(c)}
            title={c}
            className="h-5 w-5 rounded border border-[var(--color-ice-200)] hover:scale-110 transition"
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================ Constants ============================

const FONT_FAMILIES = [
  "Calibri", "Arial", "Cambria", "Georgia", "Times New Roman",
  "Segoe UI", "Verdana", "Tahoma", "Courier New", "Consolas",
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72];

const LINE_SPACINGS = ["1.0", "1.15", "1.5", "2.0", "2.5", "3.0"];

// PowerPoint-style swatch palette (theme + standard colours).
const COLORS = [
  "#000000", "#FFFFFF", "#1E2761", "#4353A6", "#2C8A4A", "#B91C1C", "#D97706", "#FFFF00",
  "#111827", "#6B7280", "#CADCFC", "#F96167", "#F9E795", "#A7BEAE", "#028090", "#990011",
];

// ============================ Helpers ============================

function clampFontSize(pt: number): number {
  return Math.max(8, Math.min(96, pt));
}

function findAncestorFontSizePt(node: Node | null, stop: Node): number | null {
  let cur: Node | null = node;
  while (cur && cur !== stop) {
    if (cur.nodeType === Node.ELEMENT_NODE) {
      const fs = (cur as HTMLElement).style.fontSize;
      if (fs) {
        // Either `14pt` (our writer) or `18.6667px` (browser-inserted via legacy size).
        const mPt = fs.match(/([\d.]+)\s*pt/);
        if (mPt) return Math.round(Number(mPt[1]));
        const mPx = fs.match(/([\d.]+)\s*px/);
        if (mPx) return Math.round(Number(mPx[1]) * 0.75);
      }
    }
    cur = cur.parentNode;
  }
  return null;
}
