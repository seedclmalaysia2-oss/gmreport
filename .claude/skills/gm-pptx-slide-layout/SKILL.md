---
name: gm-pptx-slide-layout
description: Layout and formatting patterns for the Classic PPTX template on the SEED GM Report Dashboard. Use when the owner reports a slide looks wrong in the exported deck — numbers right-aligned instead of centered, header text wrapping awkwardly, column widths uneven, data labels piled on top of each other, cells too narrow for the content — or when adding a new table or chart to a slide. Covers pptxgenjs gotchas (equal-width colW, combo chart for per-series data labels), the dual-render rule (inline preview + PPTX must agree), and the conventions we've settled on for alignment, column widths, and label shortening across slides 2, 5, 6, 8, 11.
---

# GM Report Dashboard — PPTX slide layout playbook

The exported deck is what HQ opens. The inline preview is what Simon reads to
sign off before he exports. **They must agree** — DESIGN.md principle 1 is
"match the deck, not just the data." If you change one, change the other.

## Where every slide lives

| Slide | Classic PPTX | Modern PPTX | Inline preview | Editor section |
|---|---|---|---|---|
| 1 Sales Achievement | `src/lib/pptx/classic.ts` → `slideSalesAchievement` | `src/lib/pptx/modern.ts` → `salesAchievement` | `src/components/slide-preview.tsx` → `SlideSalesAchievement` | `src/components/sections/sales-achievement.tsx` |
| 2 Sales Trend | `slideSalesTrend` | `salesTrend` | `SlideSalesTrend` | `sections/sales-trend.tsx` |
| 3 Malaysia Outlook | `slideOutlook` | `outlook` | `SlideOutlook` | `sections/market-outlook.tsx` |
| 4 Daily Sales | `slideDailySales` | `dailySales` | `SlideDailySales` | `sections/daily-sales.tsx` |
| 5 Sales Quantity | `slideSalesByQuantity` | `salesByQuantity` | `SlideSalesByQuantity` | `sections/sales-by-quantity.tsx` |
| 6 Top Products | `slideTopProducts` | `topProducts` | `SlideTopProducts` | `sections/top-products.tsx` |
| 7 Sales by ECP | `slideSalesByECP` | `salesByECP` | `SlideSalesByECP` | `sections/sales-by-ecp.tsx` |
| 8 Sales by Region | `slideSalesByRegion` | `salesByRegion` | `SlideSalesByRegion` | `sections/sales-by-region.tsx` |
| 9 Product Registration | `slideProductRegistration` | `productRegistration` | `SlideProductRegistration` | `sections/product-registration.tsx` |
| 10 Inventory | `slideInventory` | `inventory` | `SlideInventory` | `sections/inventory.tsx` |
| 11 Expire Write-Off | `slideExpireWriteOff` | `expireWriteOff` | `SlideExpireWriteOff` | `sections/expire-writeoff.tsx` |
| 12 Financial | `slideFinancial` | `financial` | `SlideFinancial` | `sections/financial.tsx` |
| 13 Other Market | `slideOtherMarket` | `otherMarket` | `SlideOtherMarket` | `sections/other-market.tsx` |

The Modern template often uses a different layout (chart instead of table,
callouts instead of row-heavy grid). Check it before assuming a Classic fix
also applies — often it doesn't.

## The three-places rule

Any visible change to a slide usually touches **three files**:

1. **`src/lib/pptx/classic.ts`** — what HQ opens in PowerPoint
2. **`src/components/slide-preview.tsx`** — what Simon sees in the Export review
3. **`src/components/sections/<slide>.tsx`** — what Simon fills in the editor

The editor is a **data-entry grid**, not a presentation slide — numbers there
stay right-aligned for comparison. The PPTX and the preview, by contrast, are
boardroom surfaces: they should match each other and match the HQ convention.

If you change only the PPTX, the Export review shows one thing and HQ opens
another — Simon loses trust in the preview.
If you change only the preview, Simon signs off a layout HQ never sees.

## pptxgenjs gotchas we've been burned by

### 1. `addTable` needs explicit `colW` when any column holds long text

Without `colW`, pptxgenjs splits the table width equally across every column.
On a slide with 4 columns (Product + 3 numeric), that gives Product a 1/4
slice — not nearly enough for "Southern Region (Johor, Melaka & Negeri
Sembilan)" at 15pt bold, which then wraps onto 2–3 lines in every row.

**Pattern:** reserve the first column generously, split the rest evenly.

```ts
// Slide 8 (classic.ts): Region needs ~5", three numeric cols share the rest.
s.addTable(rows, {
  x: 0.69, y: 1.35, w: 11.70, h: 3.8,
  colW: [5.10, 2.20, 2.20, 2.20],
  ...
});

// Slide 5 (classic.ts): Product + 5 month cols; every numeric col identical
// so the eye reads them as a like-for-like series.
s.addTable(rows, {
  x: 0.25, y: 0.82, w: 12.85, h: ...,
  colW: [4.35, 1.70, 1.70, 1.70, 1.70, 1.70],   // (12.85 − 4.35) / 5 = 1.70
  ...
});

// Slide 11 (classic.ts): long month-pair sequence; reserve ~1.7" for
// product, split the rest across 2 × N_months numeric cols.
```

If you add a new slide with a label column + numeric columns, start with
explicit `colW` on day one. Every slide we've shipped without it eventually
grew long content that broke the auto-layout.

### 2. Multi-series line charts need the **combo-chart signature** when labels collide

A `pptx.ChartType.line` chart takes a single `dataLabelPosition` for every
series. If three series share x-positions (every month on Slide 2), every
label stacks at the same place and they collide.

**Pattern:** switch to the combo-chart signature so each series gets its own
`dataLabelPosition`. **Critical:** the runtime signature is
`addChart(comboArray, options)` — TWO args, not three — even though the
TypeScript types declare `(type, data, options)`. Internally pptxgenjs does
`tmpOpt = data || opt` for the multi-chart branch, so passing `[]` as `data`
(truthy array) silently clobbers every option (x, y, w, h fall back to
`1, 1, "50%", "50%"`) and the generated OOXML crashes the export with a 500.
Pass options in the second slot and cast past the typed overload.

```ts
// Slide 2 (classic.ts): three single-series sub-charts, each with its own
// label offset so the three bands clear each other even where the lines run
// close together.
const labelOpts = {
  showValue: true,
  dataLabelFontFace: FONT, dataLabelFontSize: 11, dataLabelFontBold: true,
  dataLabelFormatCode: "#,##0",
  lineSize: 3, lineDataSymbol: "circle" as const, lineDataSymbolSize: 8,
};
const comboSeries = [
  { type: pptx.ChartType.line, data: [{ name: "Actual 2026", labels, values: actual26 }],
    options: { ...labelOpts, chartColors: ["0B1F5C"], dataLabelPosition: "t" } },
  { type: pptx.ChartType.line, data: [{ name: "Target 2026", labels, values: target26 }],
    options: { ...labelOpts, chartColors: ["DC2626"], dataLabelPosition: "r" } },
  { type: pptx.ChartType.line, data: [{ name: "Actual 2025", labels, values: actual25 }],
    options: { ...labelOpts, chartColors: ["22C55E"], dataLabelPosition: "b" } },
];
const comboOptions = {
  x: 0.5, y: 0.95, w: 12.3, h: chartH,
  chartArea: { fill: { color: "FFFFFF" } },
  showLegend: true, legendPos: "b" as const, ...
};
// 2-arg runtime call; cast past the 3-arg TS types.
(s.addChart as unknown as (t: typeof comboSeries, o: typeof comboOptions) => void)(
  comboSeries,
  comboOptions,
);
```

Keep the label font small (11pt, not 16pt) — even with t/r/b offsets, 16pt
labels bump into each other when the three lines run within ~40k of one
another. **Sanity-check before shipping** any combo-chart change: write a
scratch `tsx` script that imports `pptxgenjs` and calls `pptx.write(...)` with
the same chart shape; if the buffer comes back ≥10KB with no throw, the
XML will survive the real export. Dev-server preview doesn't exercise the
PPTX generator, so you can't catch this in the browser.

### 3. Do NOT pass `[]` as `data` in a combo-chart call

The TypeScript types declare `addChart(type, data: any[], options?)`, so it
looks like you should pass `[]` for `data` when the combo array already
carries every series. **Don't.** The runtime reads `data || opt` for the
multi-chart branch; `[]` is truthy, so pptxgenjs reads `[]` as the options
object, every chart option is lost, and the export 500s. Always use the
2-arg form shown above and cast past the typed overload.

## Alignment conventions we've settled on

### Boardroom slides (PPTX + inline preview): center numeric columns

Headers AND body AND total rows. The eye reads a column of numbers as a
vertical stack; centering keeps the stack visually aligned under its center-
set header. Right-aligned flush-to-edge numbers leave an uneven left ragged
edge that reads as drift.

Applied so far: Slide 5 (Sales Quantity), Slide 6 (Top Products). Pattern to
reach for on any PPTX slide with 3+ numeric columns the owner surfaces as
"doesn't look balanced."

### Editor tables (sections/*): right-align numeric columns

The editor is data entry, not presentation. Right-alignment supports digit-
by-digit comparison when the owner scans a column for outliers. Don't change
editor sections to match the slide — they serve different jobs.

### Label text: short enough to fit on one line at the smallest column

Long header text ("QUANTITY" / "AMOUNT") wraps into narrow columns and
inflates the header row's height. Prefer the abbreviations the file's own
doc-comments already use ("QTY" / "AMT"). Applied so far: Slide 11.

## Slide-by-slide notes (2026-11-28 sweep)

**Slide 2 — Sales Trend** (`c3810e3`)
3-series line chart; combo signature with per-series dataLabelPosition
(t/r/b) + 11pt labels so labels don't pile on. If a new series is added,
pick a 4th offset (`l`, or `ctr` with a color-contrast nudge).

**Slide 5 — Sales Quantity** (`c8fcbaf`)
Uniform 1.70" numeric colW across the five month columns; header + body +
total all center-aligned; current-month green highlight and top-4 red
preserved via per-cell options.

**Slide 6 — Top Products (Sales by Product)** (`e268757`)
MYR / % / JPY center-aligned in header AND body AND total. Product column
stays left. Inline preview updated to match. Modern template uses a
different layout (horizontal bars) — no change needed there.

**Slide 8 — Sales by Region** (`e268757`)
`colW: [5.10, 2.20, 2.20, 2.20]` on the `addTable` call so every region
name fits on one line at 15pt bold. The Southern Region string is the
natural width floor; any shorter Region column will wrap it.

**Slide 11 — Expire Stock (Write-Off)** (`771cdfd`)
"Quantity" / "Amount" → "Qty" / "Amt" on every surface (editor, inline
preview, Classic PPTX, Modern PPTX). The abbreviations were already in
the file's own doc comment.

## How to verify a slide change

1. **TypeScript:** `npx tsc --noEmit` from the project root. pptxgenjs's
   combo-chart overload is picky — if your call signature slipped, you'll
   see a `TS2353` here, not at runtime.
2. **Inline preview:** `/report/<YYYY-MM>`, click the slide in the left
   rail, scroll to SLIDE PREVIEW (bottom of the editor). This is what
   Simon sees before export.
3. **Actual PPTX:** you can't verify the exported file from Claude — the
   `/api/export` call needs an authenticated session the built-in browser
   pane doesn't carry, and pptxgenjs renders differently from any browser
   preview. Ship the fix, note in the commit that re-download is required,
   and ask the owner to confirm. (This is the one surface where chat
   verification stops.)

## Standing rule (per CLAUDE.md)

Auto-commit each slide fix by name (never `git add -A`), Conventional
Commits with a short "why" body, end with
`Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`, push to `main`.
The push is the merge; no PR. Vercel auto-deploys ~90s later.
