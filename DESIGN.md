---
name: Malaysia GM Report Dashboard
description: A reporting instrument that turns POS files into the HQ deck, month after month.
colors:
  ink-950: "#0b0f2b"
  ink-900: "#141a3d"
  ink-800: "#1e2761"
  ink-700: "#2b3883"
  ink-600: "#4353a6"
  ice-200: "#cadcfc"
  ice-100: "#e4ecff"
  ice-50:  "#f4f7ff"
  accent:  "#f96167"
  accent-2: "#f9e795"
  ok:   "#2c8a4a"
  warn: "#d97706"
  bad:  "#b91c1c"
  page-bg: "#f6f7fb"
  surface-1: "#ffffff"
  text-primary: "#141a3d"
  text-secondary: "#4353a6"
  text-muted: "#6b7280"
  border-subtle: "#e4ecff"
  border-strong: "#cadcfc"
typography:
  display:
    fontFamily: "Cambria, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: "1.15"
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Cambria, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "1.2"
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Calibri, Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.35"
  body:
    fontFamily: "Calibri, Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.5"
  label:
    fontFamily: "Calibri, Inter, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.2em"
  mono:
    fontFamily: "ui-monospace, Cascadia Code, Menlo, monospace"
    fontSize: "0.875rem"
    fontVariant: "tabular-nums"
rounded:
  sm: "6px"
  md: "8px"
  lg: "14px"
  xl: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink-800}"
    textColor: "{colors.surface-1}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.ink-700}"
  button-ghost:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-800}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.ice-100}"
  input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  chip:
    backgroundColor: "{colors.ice-50}"
    textColor: "{colors.ink-800}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.xl}"
    padding: "20px"
  table-header:
    backgroundColor: "{colors.ink-800}"
    textColor: "{colors.surface-1}"
    padding: "10px 16px"
---

# Design System: Malaysia GM Report Dashboard

## 1. Overview

**Creative North Star: "The Reporting Instrument"**

This is not a dashboard, it is an instrument. Every screen is calibrated to a
single job: turn a folder of raw POS Excel and PDF files into the standard
13-slide HQ deck, correctly, month after month. The reader is Simon (the
Malaysia GM) at his desk with a printed folder, and, downstream, HQ Japan
opening an exported PPTX. Neither one wants personality; both want the
numbers to line up. The interface disappears into the task.

The character is **executive, elegant, confident** — three words the owner
picked in the same breath. That means Cambria on the slide titles (the
same serif HQ uses in printed decks), Calibri on the body and every
number, restrained navy chrome, and no decorative motion. The system
carries authority the way a bound quarterly report does: through
typography, tabular precision, and negative space. Not through gradients,
not through animation, and never through the SaaS dashboard clichés this
project explicitly rejects.

What this system refuses, plainly: enterprise ERP density (gray-on-gray,
endless dropdowns), consumer SaaS marketing polish (hero metrics with
gradient accents), Excel-in-a-browser (rows and cells with no
hierarchy), and dev-tool aesthetics (dark-purple gradients, keyboard
shortcut chrome). Every one of those is a first-order reflex for the
category, and each is a Don't below.

**Key Characteristics:**

- **Serif titles, sans body, tabular numbers.** One serif for slide
  titles and section headers; one sans for everything else; `font-mono
  tabular-nums` for every figure so columns of numbers align vertically
  at every zoom level.
- **Ink → ice ramps, not gray.** The neutral scale is a navy-derived
  five-step ink (ink-600 through ink-950) and a three-step ice tint
  (ice-50 through ice-200). No true gray at any surface — even the
  "off-white" page-bg is #f6f7fb, tinted 2% toward the ink hue.
- **Full borders, no side stripes.** Cards and chips get a full 1px
  ice-200 border. Colored side stripes (`border-left: 3px`) are banned.
- **Sticky-left row labels on every wide table.** Every 12-month table
  keeps its row label sticky on horizontal scroll so users never lose
  context on mobile or narrow viewports.
- **Twelve palettes, one system.** The whole chrome is themeable through
  a palette picker (12 curated palettes: Midnight, Forest, Coral,
  Terracotta, Ocean, Charcoal, Teal, Berry, Sage, Cherry, Plum, Aurora).
  Each palette derives its own dark-mode surface ladder from its
  deepest hue — verified ≥11:1 contrast for numbers on cards, in every
  palette, in both light and dark.

## 2. Colors

A committed ink-and-ice palette: navy authority with iced tints,
warm accent flourishes reserved for the current-month marker and
missing-data callouts. The full-colour band is 6 steps: 5 ink
(darkest ~ink-950 to lightest ~ink-600) plus 3 ice (softest ice-50
to firmest ice-200), so every screen composes from a single hue
family. No true grays.

### Primary

- **Ink 800** (`#1e2761`): Every branded surface — top nav logo tile,
  primary button, table header band, active section pill in the
  editor sidebar. This is what "the brand" reads as at a glance.
- **Ink 700** (`#2b3883`): Hover state for ink-800, current-month
  column header on the Sales Achievement table, borders on the
  ink-800 buttons.
- **Ink 600** (`#4353a6`): Secondary text and metadata labels
  (semantic `--text-secondary`).
- **Ink 900** (`#141a3d`): Body copy and headings in light mode
  (semantic `--text-primary`). In dark mode this token flips to
  `#f4f7ff` so components using `text-[var(--color-ink-900)]` stay
  legible without touching component code.
- **Ink 950** (`#0b0f2b`): Reserved for the dark-mode page background
  and the Modern PPTX template's header band.

### Secondary

- **Accent Coral** (`#f96167`): One warm signal. Used for missing-data
  banner accents, the current-month column dot in table headers, and
  the "reset zoom" icon. Never a text colour; never on primary CTAs.
- **Accent Butter** (`#f9e795`): Paired with Coral for the current-
  month marker glyph and the Slide 1 ACC%/YoY% row background tint
  (bg-[var(--color-accent-2)]/15). Warm hint on an otherwise cold
  palette.

### Tertiary (semantic)

- **OK Green** (`#2c8a4a`): Save-button fill in the Edit/Save lock,
  "changed" checkmark in the Repair Chain modal. Never used
  decoratively.
- **Warn Amber** (`#d97706`): "Re-upload to enable preview" chip on
  legacy Files rows, deprecated-file warnings.
- **Bad Red** (`#b91c1c`): Negative growth% in Sales by Region, ACC%
  cells below 100%, "Delete forever" button in the trash section.

### Neutral

- **Ice 200** (`#cadcfc`): Every card and chip border. The default
  divider colour. Dark-mode remap becomes a lifted navy so bordered
  surfaces still show a lift.
- **Ice 100** (`#e4ecff`): Hover-fill for ghost buttons, subtle row
  alternation on Slide 1's Sales Achievement, the neutral fill for
  KPI card `tone="plain"`.
- **Ice 50** (`#f4f7ff`): The lightest tint — used for month card
  eyebrow bar, alt-row background on 2026 highlighted rows, the
  section-shell source-chip fill.
- **Page bg** (`#f6f7fb`): The app body background. **Tinted 2%
  toward the ink hue** so it doesn't read as sterile white; explicitly
  NOT a warm cream (see The No-Cream Rule below).
- **Surface 1** (`#ffffff`): Card and header background in light
  mode. Remapped in dark mode to `#141a3d`.
- **Text muted** (`#6b7280`): The one true gray in the system, only
  for hints and captions where the surface is already low-contrast.

### Named Rules

**The No-Cream Rule.** The body background is `#f6f7fb`, an ink-
tinted near-white. Warm cream / sand / beige / paper backgrounds
(OKLCH warmth toward hue 40–100) are prohibited. This project is
boardroom-navy, not editorial-parchment; the 2026 AI cream default
is the category reflex to actively refuse.

**The Ink-and-Ice Rule.** The neutral scale is a single navy hue
family, never true gray. `text-[var(--color-ink-600)]` for
secondary copy, never `text-gray-500`. Any grey that slips in reads
as a bug.

**The One-Warm Rule.** Accent (Coral) and Accent-2 (Butter) are the
only warm tones. They appear on ≤5% of any screen: current-month
markers, missing-data callouts, saved-timestamp chips. Cold
everywhere else.

## 3. Typography

**Display Font:** Cambria (with Georgia fallback, then serif)
**Body Font:** Calibri (with Inter, then system-ui, sans-serif)
**Mono Font:** ui-monospace (with Cascadia Code, Menlo, monospace)

**Character:** A boardroom pairing. Cambria is what HQ's printed
decks use, so slide titles here echo their printed twin. Calibri
carries every number, label and body line — familiar, dense-legible,
and specifically tuned for tables. This is a contrast pairing
(serif × sans), not a same-family stack; the two fonts are picked to
sit visibly apart, so users read "title" and "body" as different
registers at a glance.

### Hierarchy

- **Display** (Cambria, 600, `text-3xl` ~1.875rem, `leading-tight`,
  `letterSpacing: -0.01em`): Slide 1 through Slide 13 titles inside
  the editor's `SectionShell`. Also the month card titles on the
  dashboard. **Never used for labels or buttons.**
- **Headline** (Cambria, 600, `text-xl`–`text-2xl`, `leading-tight`):
  Card headers (e.g. "KPI commentary", "Recently deleted"), the
  dashboard hero heading.
- **Title** (Calibri, 600, `text-base`, `leading-normal`): Table row
  labels ("Sales Target 2026 · MYR"), section card titles.
- **Body** (Calibri, 400, `text-sm` 0.875rem, `leading-relaxed`):
  All descriptive prose, subtitles, hint text. Line length capped at
  ~70ch inside SectionShell subtitles.
- **Label** (Calibri, 600, `text-[11px]`, `uppercase`, `tracking-
  [0.2em]`): Column headers, section eyebrows, chip labels. Always
  uppercase; always wide-tracked. Colour: `text-[var(--color-ink-600)]`
  on ice fills, or `text-white` on ink-800 fills.
- **Mono / Numeric** (ui-monospace, tabular-nums, 0.875rem): Every
  figure in every table. Zero visual desync between columns of
  numbers.

### Named Rules

**The Tabular Numbers Rule.** Every table cell that holds a number
uses `font-mono` + `tabular-nums`. Never proportional digits for
figures. The eye tracks columns down, not word-shapes across.

**The Two-Family Rule.** Exactly two type families across the whole
app: Cambria for display, Calibri for everything else (mono is a
technical role, not a pairing). Never introduce a third display or
sans; introducing a third font is a bug.

**The Wide-Tracked Label Rule.** Labels are always `uppercase` and
`tracking-[0.15em]` or `tracking-[0.2em]`. Non-uppercase labels are
a bug, not a variant.

## 4. Elevation

**Flat by default. Borders instead of shadows.** Every card, chip,
input and panel is a 1px `--border-subtle` (ice-200) stroke on a
`--surface-1` fill. Depth comes from the border weight and the
surface tint contrast (surface-1 vs. surface-2 vs. surface-3), not
from box-shadows. This matches "The Reporting Instrument" register:
a printed report is flat; so is this.

Shadows appear in exactly three contexts, and only there:

- **Modals + drawers** (`shadow-lg`, `shadow-xl`): mobile section
  drawer, Repair Chain modal, New Month dialog. Functional lift so
  the user perceives the surface as above the page.
- **Header on scroll** (`backdrop-blur` + `bg-white/95`): the sticky
  top nav uses backdrop blur to signal "above the page" while
  staying nearly invisible.
- **Hover elevation on interactive cards** (`hover:shadow-md`): the
  month cards on the dashboard lift on hover as a "clickable"
  affordance. Static cards stay flat.

### Shadow Vocabulary

- **Ambient card lift** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`,
  Tailwind `shadow-sm`): reserved for the Sales Achievement table
  card and the write-off table card; used to lift a critical data
  surface off the page-bg by a hair.
- **Interactive hover** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1),
  0 2px 4px -2px rgb(0 0 0 / 0.1)`, Tailwind `shadow-md`): month cards
  on the dashboard on hover.
- **Floating modal** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1),
  0 4px 6px -4px rgb(0 0 0 / 0.1)`, Tailwind `shadow-lg`): modals,
  the palette picker dropdown, the months menu dropdown.

### Named Rules

**The Flat-By-Default Rule.** A component at rest, on a page-bg or
surface-1, has zero box-shadow. Shadows are for functional lift
(modal, drawer, dropdown, hover) — never for decoration.

**The Border-First Rule.** When separating two surfaces, reach for a
`border-[var(--border-subtle)]` before reaching for a shadow. Only
if borders can't carry the affordance (modal above scrim, dropdown
above content) does a shadow enter.

## 5. Components

Every component in this system is **precise and understated** —
small radii, thin borders, muted transitions, no scale-on-hover
flourish. The physical metaphor is a slide caliper, not a rubber
mallet. Buttons feel decisive. Inputs feel exact. Chips feel like
metadata, not decoration.

### Buttons

- **Shape:** `rounded-md` (~6px). Never `rounded-lg` or `rounded-xl`
  on buttons; that reads as SaaS-consumer, not HQ.
- **Primary:** `bg-[var(--color-ink-800)] text-white px-3 py-1.5
  text-sm font-semibold hover:bg-[var(--color-ink-700)]`. This is
  the confirming action anywhere in the app: "Save", "Import",
  "Create month", "Repair chain".
- **Ghost:** `border border-[var(--color-ice-200)] px-3 py-1.5 text-
  sm text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)]`.
  Secondary or dismiss action. Never used as the primary CTA.
- **Save-mode primary:** `bg-[var(--color-ok)] text-white`. Only
  appears when an Edit/Save lock is in `editing` state, so the
  green fill signals "commit", not just "action".
- **Icon-only** (theme toggle, palette picker, logout): `rounded-md
  p-2 hover:bg-[var(--color-ice-100)]`. 16px icon inside a 32px hit
  target on desktop; 40px on touch.
- **Hover / Focus:** All buttons transition `background-color 180ms
  ease`. Focus rings use the browser default augmented by
  `focus:ring-2 focus:ring-[var(--color-ink-700)]` on inputs; no
  glow, no gradient outline.
- **Active:** `active:scale-95` on interactive icon buttons only;
  full-width buttons don't scale (movement on a full-width button
  reads as instability, not tactility).

### Chips

- **Style:** `rounded-full border border-[var(--color-ice-200)]
  bg-[var(--color-ice-50)] text-[var(--color-ink-800)] px-2 py-0.5
  text-[11px]`. The source-file chip and section-source strip use
  this shape.
- **Content order:** icon (11px) → label → date (opacity 0.7) →
  round action buttons (h-5 w-5, filled ink-800 for View, ice-200
  for Save, red-100 for Delete).
- **Selected state** (multi-select): `border-red-300 bg-red-50 text-
  red-900` and a red checkbox. Distinguishes selection from default
  without introducing a new hue.

### Cards / Containers

- **Corner Style:** `rounded-2xl` (~16px) on primary content cards;
  `rounded-xl` (~12px) on sub-cards; `rounded-md` on toolbars and
  banners. Never `rounded-full` on a card; never square (0 radius).
- **Background:** `bg-white dark:bg-[var(--surface-1)]`. In dark
  mode the `bg-white` re-skin is handled by a globals.css `!important`
  so component code never has to branch.
- **Shadow Strategy:** None at rest; see Elevation section.
- **Border:** `border border-[var(--color-ice-200)]`. Always full;
  never a side stripe (see The No-Side-Stripe Rule below).
- **Internal Padding:** `p-5` (20px) for content cards; `p-3` for
  toolbars; `p-6` for modals and dialogs. Cards containing a table
  drop internal padding entirely and let the table fill edge-to-
  edge.

### Inputs / Fields

- **Style:** `rounded-md border border-[var(--color-ice-200)] px-3
  py-2 text-sm`. Number cells use the `NumberCell` primitive which
  auto-sizes to fit content and switches to `font-mono tabular-nums`
  for figures.
- **Variants:** `card` (default, bordered) and `plain` (borderless,
  fills its parent table cell). `plain` gets a 1px `focus:ring-1`
  on focus so the edited cell is still legible.
- **Focus:** `focus:outline-none focus:ring-2 focus:ring-[var(--
  color-ink-700)]`. Never a glow, never a coloured shadow.
- **Read-only:** When an Edit/Save lock is `readOnly`, the input
  loses its border/ring (`border-transparent focus:ring-0`), gets
  `cursor-default`, drops out of the tab order (`tabIndex={-1}`),
  and rejects all onChange events. The value still displays with
  the same font and alignment so nothing shifts on toggle.

### Navigation

- **Style:** Sticky top bar, `bg-[var(--surface-1)]/95 backdrop-
  blur`, `border-b border-[var(--color-ice-200)]`, height 56px.
  z-40 (see semantic z scale in the section shell).
- **Desktop nav:** Icon + label pairs, `rounded-md px-3 py-1.5
  text-sm text-[var(--color-ink-800)] hover:bg-[var(--color-ice-
  100)]`.
- **Mobile:** Hamburger triggers an off-canvas drawer (fixed left-0
  top-0, w-88vw max-320px). A bottom tab bar with 3 pinned routes
  (Months / Files / Export) sits above the safe-area inset.
- **Active state:** Route match adds a pill `bg-[var(--color-ice-
  100)]` inside a rounded-full wrap on the mobile tab bar; desktop
  nav shows current-route with a subtle underline rather than a fill
  (route context is already visible from the page header).

### Tables (signature component)

The dashboard is table-heavy, and the table is the system's
signature. Every wide table follows the same pattern.

- **Header band:** `bg-[var(--color-ink-800)] text-white text-[11px]
  font-semibold uppercase tracking-[0.2em]`. `rounded-t-xl` on the
  first cell, `rounded-tr-xl` on the last. Current-month column
  header switches to `bg-[var(--color-ink-700)]` and shows a
  Coral+Butter dot.
- **Sticky row label:** the first column is `sticky left-0 z-10
  bg-[bgClass] border-r border-[var(--color-ice-200)]`. Stays put
  when the table scrolls horizontally on mobile.
- **Zebra:** 2026 rows use `bg-[var(--color-ice-50)]`, 2025 rows
  use `bg-white`. Computed % rows use `bg-[var(--color-accent-2)]/15`
  as a subtle butter tint.
- **Numbers:** every td that holds a figure gets
  `font-mono tabular-nums text-right`. The NumberCell primitive
  handles the input/display duality.

## 6. Do's and Don'ts

The strategic anti-references from PRODUCT.md carry directly into
the visual rules here. Each Don't below is one of those turned into
a concrete pixel-level prohibition.

### Do:

- **Do** use Cambria for slide titles and Calibri for everything
  else. The two-family pairing is the boardroom register; anything
  else fights the HQ deck the app produces.
- **Do** use `font-mono tabular-nums` on every number, in every
  table cell, in every KPI card. Columns of numbers must line up
  vertically at every zoom level.
- **Do** use `text-[var(--color-ink-*)]` semantic tokens instead of
  `text-gray-*` Tailwind primitives. The palette-picker system
  depends on it.
- **Do** wrap every keyed-in figure in an Edit/Save lock. Manual
  data on Slide 1 (KPI cards, Net Income rows) and Slide 12
  (Financial) uses the same `readOnly` NumberCell pattern.
- **Do** put a full `border border-[var(--color-ice-200)]` on cards
  and chips. Depth is a border, not a shadow.
- **Do** use `rounded-md` on buttons, `rounded-2xl` on cards,
  `rounded-full` on chips. The radius scale carries meaning.
- **Do** honor `prefers-reduced-motion` on every animation. The
  fade-in on section shells and the palette-transition CSS both
  drop to no-op under the media query.
- **Do** verify contrast on every palette + theme pair. Body text
  must be ≥4.5:1 on its surface, in every one of the 12 palettes,
  in both light and dark.

### Don't:

- **Don't** style this like enterprise ERP (SAP / SharePoint /
  Oracle Financials). No gray-on-gray, no dense chrome, no 2008-
  era dropdown lists. Density comes from tabular numbers, not from
  chrome.
- **Don't** style this like a consumer SaaS marketing dashboard
  (Stripe / Notion / Vercel). No hero metrics with gradient
  accents, no oversized number-with-tiny-label templates, no
  playful entry animations.
- **Don't** style this like Excel-in-a-browser. Rows and cells
  without hierarchy defeat the entire point of leaving Excel behind.
- **Don't** reach for the dev-tool aesthetic (Slack / Linear /
  Notion dark-purple gradients, keyboard-shortcut chrome). Wrong
  audience.
- **Don't** use `border-left: 3px` or `border-right: 3px` as a
  colored accent stripe on cards, alerts, or callouts. Colored side
  stripes are prohibited. Use a full border and a background tint
  instead. (The No-Side-Stripe Rule.)
- **Don't** use gradient text (`background-clip: text` on a
  gradient). Not on hero headings, not on numbers, not anywhere.
- **Don't** default to warm cream / sand / beige body backgrounds
  (OKLCH warmth toward hue 40–100). The AI 2026 default is refused
  here; the ink-tinted `#f6f7fb` is the body bg, always.
- **Don't** put a tiny uppercase tracked eyebrow above every
  section (`ABOUT / PROCESS / PRICING`). The system already uses
  wide-tracked labels for column headers and chip labels; adding
  eyebrow scaffolding on top is AI grammar. Use the section title
  as the entry point.
- **Don't** number sections decoratively (01 · About / 02 ·
  Process). Slide numbers appear where the slides genuinely ARE a
  sequence (1-13 in the deck), never as visual scaffolding.
- **Don't** introduce a third font family. Cambria and Calibri, or
  something is broken.
- **Don't** use `text-gray-500` or any raw Tailwind gray. Use the
  ink or ice semantic tokens.
- **Don't** put a box-shadow on a static card. Shadows are for
  functional lift only (modal, drawer, dropdown, hover on
  clickable card).
- **Don't** ship a component without a `readOnly` state if it holds
  keyed data. The Edit/Save lock is the rule, not the exception.
