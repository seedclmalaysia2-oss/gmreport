# Product

## Register

product

## Platform

web

## Users

Primary operator is Simon, the Malaysia General Manager, who runs the monthly
reporting cycle end-to-end: uploading a dozen POS Excel and PDF exports,
reviewing the auto-built slides, keying the manual figures, and exporting the
HQ deck. Simon uses the tool on a monthly cadence, at his desk, focused, with
context on every SKU and salesman in the file.

Secondary audience is HQ Japan — colleagues who open the exported PPTX (and
occasionally the live dashboard) to review Malaysia's month. They don't
operate the tool; they consume its output. Every number they see must be
identical to what Simon saw in the editor — the deck can never disagree
with the source.

## Product Purpose

Turn a folder of raw POS files into the standard 13-slide HQ deck each
month, without formula juggling in Excel, without format drift between
months, and without losing multi-year history. The dashboard replaces a
three-day copy-paste process with an evening. Success is three-fold: the
deck lands on time and matches the underlying numbers exactly; monthly
production drops from days to hours; and the accumulated history (Sales
Achievement chain, YoY quantities, region growth) becomes something Simon
can actually look at, not just report.

## Positioning

The only system where the POS file catalogue, the HQ deck format, and the
multi-year history live inside one linked pipeline. Excel plus PowerPoint
gives you two of those, brittly. This gives all three, with the mapping
between them enforced by code rather than by memory.

## Brand Personality

Executive, elegant, confident. Boardroom-facing, HQ-serif display, quiet
navy palette (Midnight Executive is the anchor), every pixel earns its
place. The voice is measured — a senior finance manager writing a memo,
not a startup announcing itself. No exclamation marks in copy, no cheer
in empty states, no marketing polish anywhere.

## Anti-references

- **Enterprise ERP / SAP / SharePoint / Oracle Financials**. Dense gray,
  endless dropdowns, 2008-era chrome. This is the dominant category
  reflex for "reporting tool" and the one to actively refuse.
- **Consumer SaaS marketing dashboards (Stripe / Notion style)**. Big
  gradient hero metrics, playful micro-interactions, marketing polish.
  Wrong register for HQ reporting.
- **Excel-in-a-browser (data grids, no personality)**. Rows and cells
  with no visual hierarchy — becomes another spreadsheet and defeats the
  point of leaving Excel behind.
- **Slack / Linear / Notion (dev-tool aesthetic)**. Dark-purple gradients,
  keyboard-shortcut-first, generic dev-tool feel. Wrong audience.

## Design Principles

1. **Match the deck, not just the data.** The dashboard is a live mirror
   of the HQ PPTX. Every table, every total, every row order aligns
   between the editor, the inline slide preview, and the exported deck.
   Sync between editor and export is not optional — a Total row present in
   one must be present in both.

2. **Auto-detect, then let the user confirm.** Filename period detection,
   file-kind classification, month inference all happen automatically,
   but every automatic decision is visible and correctable. Detected
   month shows in an emerald banner; each file's "Detected as" label is
   shown on the Files page; an Update button on every row re-runs
   parsing when the automatic answer was wrong.

3. **Preserve history, don't overwrite it.** The 2025 Sales Summary
   feeds 2025 columns; the 2026 file feeds only target2026; POS master
   feeds current-month actual2026. No file silently overwrites another
   year's data, and no auto-parse assumes a year that wasn't detected.

4. **Every keyed figure is locked by default.** Edit / Save toggles guard
   manual data (Sales Achievement KPIs, Financial ledger). The dashboard
   opens in read-only; edits are deliberate. Keyed figures cannot be
   nudged or wiped by a stray tap.

5. **Boardroom register, boardroom restraint.** Cambria/Georgia serif for
   slide titles, Calibri/Inter sans for body and numbers, restrained
   motion (150–250 ms crossfades, no bounce, no orchestrated page
   loads), no gradient text, no eyebrow scaffolding, no numbered section
   markers as decorative grammar.

## Accessibility & Inclusion

WCAG AA baseline. Dark mode is a first-class rendering path — every one
of the 12 palettes derives a dark surface ladder from its own hues so
contrast stays ≥11:1 for numbers in tables, verified with real WCAG
math, not eyeballed. Mobile-friendly: 44 px tap targets on `hover: none,
pointer: coarse`, safe-area insets on notched devices, viewport
`user-scalable=yes` up to 500%, and a visible zoom widget for users who
want it. The palette picker and theme toggle are both present in the
main chrome; users can pick a palette that suits their light conditions
and eyes.
