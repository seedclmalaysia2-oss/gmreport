---
target: PPTX preview + export flow
total_score: 20
p0_count: 2
p1_count: 3
timestamp: 2026-07-25T01-05-50Z
slug: src-app-export-page-tsx
---
Method: dual-agent (A: abb481b23202b53a2 · B: a5741f89573f09ad9)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | PDF shows "Rendering N%"; PPTX flips a bare "Generating…" and hangs forever if the fetch throws |
| 2 | Match System / Real World | 3 | 4-step "Pick months / Pick template / Pick colour / Review before download" is plain-language Simon vocabulary |
| 3 | User Control and Freedom | 1 | No cancel on either exporter; a 3rd month selection silently swaps the oldest |
| 4 | Consistency and Standards | 2 | PDF vs PPTX have different loading affordances, different filenames, different error surfaces |
| 5 | Error Prevention | 2 | "Select at least one month" guard is good; nothing warns that switching template mid-render doesn't cancel it |
| 6 | Recognition Rather Than Recall | 3 | The palette picker with live mini-slide previews is genuinely excellent |
| 7 | Flexibility and Efficiency | 2 | No keyboard nav on the preview canvas, no "same as last month" shortcut for the monthly cycle |
| 8 | Aesthetic and Minimalist | 3 | Clean overall; palette card mini-previews are the strongest element |
| 9 | Error Recovery | 1 | `setErr("Export failed")` is the entire failure vocabulary — response body/status discarded |
| 10 | Help and Documentation | 1 | No explanation of what happens to Daily Sales when 2 months are selected; classic-vs-modern is one line |
| **Total** | | **20/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment: borderline.** The 4-step numbered scaffolding and 12-palette mini-slide picker are distinctive, product-grade work; the surrounding chrome leaks raw Tailwind colors, shadow depth, and vague error states that feel unfinished on a boardroom-adjacent surface.

**Deterministic scan: 16 advisories.** 3 font-size (`text-[8px]/[10px]/[12px]` in the palette picker's micro-labels — likely justified) + 13 color drift (all in `slide-preview.tsx`, mostly slide-canvas hexes that must pixel-match the PPTX output, plus semantic status hexes `#DC2626 / #22C55E / #FEF2F2 / #FECACA` that SHOULD route through `--color-bad / --color-ok` tokens). Detector defers intent to reviewer — most slide-canvas hexes are false positives (they mirror the PPTX by contract), but the semantic status hexes are real drift.

**Visual overlays:** skipped — no dev server running.

## Overall Impression

Information architecture is stronger than typical AI-generated exporters — Simon can genuinely see what he's about to send, and the 12-palette + template picker is inventive. But two things fight the score: the exporter chrome has real production gaps (silent PPTX failure path, no cancel, weak error messages, expanded preview modal with no a11y), and the **preview and PPTX are two independent implementations with no sync test enforcing PRODUCT.md Principle #1**. That last one is the biggest actual product risk on the surface — the entire "match the deck" promise rests on prose comments, not machine invariants.

## What's Working

- **The 4-step numbered scaffolding** at [export-form.tsx](src/components/export-form.tsx) is genuine product-register work, not a generic form. Simon reads it as a checklist.
- **The palette picker with live mini-slide previews** at [export-form.tsx:117–158](src/components/export-form.tsx:117) is distinctive and boardroom-appropriate — a header band + ice tints + accent ribbon in a card the size of a business card.
- **PDF exporter's `waitForChartsReady`** at [pdf-exporter.tsx:33–55](src/components/pdf-exporter.tsx:33) — thoughtful engineering that would be easy to shortcut with a `setTimeout(2000)`; it isn't.

## Priority Issues

### [P0] Preview and PPTX are two independent implementations with no sync guarantee
- **What:** the inline preview renders through `SlidePreview` (React); the PPTX comes from `src/lib/pptx/index.ts` server-side. The PDF exporter reuses `SlidePreview` so preview→PDF is guaranteed by construction, but **preview→PPTX is only guaranteed by comments** (e.g. `// mirrors the editor + PPTX`). PRODUCT.md Principle #1 ("Match the deck, not just the data") is the load-bearing promise of the whole product.
- **Why it matters:** Simon believes what he sees. The day the two drift is the day the deck sent to HQ contains numbers that never appeared in the editor.
- **Failure scenario:** Someone changes the Sales Achievement Total column to a weighted-ratio total in [slide-preview.tsx:258–268](src/components/slide-preview.tsx:258) but forgets the matching change in the server generator. Preview shows correct ACC% total; exported deck shows arithmetic sum of percentages. HQ opens the deck.
- **Fix:** golden-image regression tests that render each slide via both paths and diff PNGs; or (better) generate PPTX shapes from the same layout spec `SlidePreview` consumes.
- **Suggested:** `/impeccable harden`

### [P0] PPTX download has no try/catch — a network drop hangs the primary CTA forever
- **What:** [export-form.tsx:45–61](src/components/export-form.tsx:45) — `download()` has no `try`. If `fetch` throws (offline, DNS fail, connection reset mid-response), `setBusy(false)` never runs, the Download button stays greyed and spinning, and no error appears. Compare to `PdfExporter` which wraps in try/catch/finally at [pdf-exporter.tsx:101–134](src/components/pdf-exporter.tsx:101).
- **Failure scenario:** Simon on hotel Wi-Fi at 11pm before an HQ deadline. Clicks Download PPTX. Wi-Fi drops mid-request. Button says "Generating…" forever. He refreshes and loses the palette selection.
- **Fix:** wrap `fetch` + `blob()` in try/catch/finally; on catch, `setErr(String(err))` + `setBusy(false)`; when `!res.ok`, render the actual response body instead of hardcoded "Export failed".
- **Suggested:** `/impeccable harden`

### [P1] Cover / Agenda / Thank-you slides can't be previewed on the export page
- **What:** [export-form.tsx:180–189](src/components/export-form.tsx:180) iterates `SECTION_KEYS` — the 13 content sections. But the exported deck brackets those with `cover / agenda / thankyou` (see `buildDeckSequence` in [pdf-exporter.tsx:57–72](src/components/pdf-exporter.tsx:57), and `SlideCover / SlideAgenda / SlideThankYou` in `SlidePreview`). Simon cannot check the presenter name, month label, or agenda ordering before sending.
- **Failure scenario:** Presenter field is stale from last month. Cover slide goes to HQ with the previous presenter's name.
- **Fix:** iterate a `DECK_KEYS = ["cover", "agenda", ...SECTION_KEYS, "thankyou"]` union in the dropdown.
- **Suggested:** `/impeccable clarify`

### [P1] Flat-By-Default rule breached in the preview modal and palette picker
- **What:** DESIGN.md names Flat-By-Default and Border-First as governing rules — depth = borders, not shadows. Offenders: `shadow-2xl` at [slide-preview.tsx:176](src/components/slide-preview.tsx:176), `hover:shadow-md transition` at [export-form.tsx:126](src/components/export-form.tsx:126), `shadow-sm` at [slide-preview.tsx:148](src/components/slide-preview.tsx:148) and [export-form.tsx:151](src/components/export-form.tsx:151), plus `backdrop-blur-sm` on the modal that reads more SaaS-marketing than Midnight Executive.
- **Fix:** replace with `ring-1 ring-[var(--color-ice-200)]` for depth substitute; drop `hover:shadow-md`; use a stronger border on the active palette card. Drop `backdrop-blur-sm` on the modal (or keep only a solid black/50 backdrop).
- **Suggested:** `/impeccable polish`

### [P1] Expanded preview modal is not a real dialog (a11y regression)
- **What:** [slide-preview.tsx:174](src/components/slide-preview.tsx:174) — no `role="dialog"`, no `aria-modal`, no `aria-labelledby`, no focus trap, no restore-on-close. The Files page recently gained a shared `<Modal>` primitive with all of this; this modal doesn't use it.
- **Failure scenario:** Sam persona — screen reader announces nothing when the expanded preview opens; keyboard tab escapes back to the surrounding page while the modal is still visible.
- **Fix:** rebuild on the shared [Modal shell](src/components/ui/modal.tsx) (already handles alertdialog vs dialog focus targets, focus trap, ESC dismiss, restore-on-close).
- **Suggested:** `/impeccable harden`

### [P2] Raw Tailwind `text-red-600` in the chrome error paths
- **What:** [export-form.tsx:224](src/components/export-form.tsx:224) and [pdf-exporter.tsx:153](src/components/pdf-exporter.tsx:153) use `text-red-600` for error messages instead of the DESIGN token `--color-bad`. The slide bodies use hard-coded hexes correctly (mirrors PPTX) — the chrome around them shouldn't.
- **Fix:** `text-[var(--color-bad)]`; or promote to an inline `Alert` component that uses `--color-bad-50` background + `--color-bad-800` text.
- **Suggested:** `/impeccable polish`

### [P2] Tabular-Numbers rule breached across most number-heavy slides
- **What:** `fontVariantNumeric: "tabular-nums"` is only set on `SlideInventory` and `SlideExpireWriteOff`. `SlideSalesAchievement` (12 monthly columns + Total), `SlideTopProducts`, `SlideSalesByECP`, `SlideSalesByRegion`, `SlideFinancial`, `SlideSalesByQuantity` don't set it. Digits misalign — exactly what the rule exists to prevent in an executive deck.
- **Fix:** apply `fontVariantNumeric: "tabular-nums"` inside `tdStyle` when `align !== "left"` at [slide-preview.tsx:1224–1229](src/components/slide-preview.tsx:1224).
- **Suggested:** `/impeccable polish`

## Persona Red Flags

**Alex.** No arrow-key or `[` / `]` shortcut on the preview navigator — mouse-only. Escape closes the expanded modal (good) but that's the only keyboard affordance.

**Riley.** PPTX button has no try/catch — network flake leaves it stuck. Neither exporter has a cancel button. PDF exporter's `waitForChartsReady` has a 3-second hard timeout: on a slow laptop it will bail with blank chart pages and no warning. Selecting a 3rd month silently swaps the oldest without feedback ([export-form.tsx:38–42](src/components/export-form.tsx:38)).

**Sam.** Expanded preview modal has no `role="dialog"`, no `aria-modal`, no focus trap, no `aria-labelledby`. Export progress isn't in an `aria-live` region — screen readers won't hear "Rendering 40%…" or "Generating…". Palette buttons rely on a `title` attr, not `aria-label` with the color name.

**Simon-GM.** He runs this monthly. No "same as last month" shortcut — four clicks every cycle. Cover slide can't be previewed here, so no way to catch a stale presenter name before HQ sees it. If Wi-Fi drops during the PPTX download, the UI hangs with no error and no retry.

## Cognitive Load

**4/8 fail.**
- Decision fatigue — 12 palettes × 2 templates × N months = 24+ combinations before the primary CTA.
- Hierarchy leakage — the palette picker's `hover:shadow-md transition` puts hover-motion at the same visual level as the CTA.
- Unnecessary color — raw `text-red-600` for errors sits outside the semantic token vocabulary.
- Redundant labels — palette summary strip at [slide-preview.tsx:198–203](src/components/slide-preview.tsx:198) duplicates info the palette card already conveys.

## Minor Observations

- Duplicate template state: `SlidePreview` has its own `internalTemplate` at [slide-preview.tsx:79](src/components/slide-preview.tsx:79) that's dead weight in export-form's controlled usage.
- Slide number source of truth is split: `SECTION_META[k].no` in the dropdown, `sectionIndex + 1` in the "Slide X of N" caption — one is 1–13 (curated), the other is a JS array index. Drift risk.
- `SlideOutlook` and `SlideOtherMarket` use `dangerouslySetInnerHTML` with an editor-trusted contract. The trust is explicit in a comment; sanitisation is still worth pinning in case that boundary ever changes (a paste from HTML source).
- The filename in `download()` regex-parses `Content-Disposition` at [export-form.tsx:57](src/components/export-form.tsx:57) — doesn't handle `filename*=UTF-8''…`. Papercut, not a bug today.
- The `midnight` palette id lags DESIGN.md's "Midnight Executive" name. Small mismatch.
- Modal backdrop click closes; but any accidental click on the slide's edge triggers close via bubbling — consider requiring the close button or Escape.

## Questions to Consider

1. If preview and PPTX ever diverge (and Principle #1 says they mustn't), how would Simon find out — before HQ does? What test enforces the invariant today?
2. Why is PPTX the primary CTA and PDF the secondary, if the palette + slide layout Simon just previewed is only guaranteed to look that way in the PDF path? Are the two exporters actually different products?
3. This is a monthly ritual. Why does it take four decision steps every time? What would a "same as last month, just swap the data" button look like — and is that the real primary flow?

## DESIGN.md rule compliance

| Rule | Status | Note |
|------|--------|------|
| No-Cream | PASS | `bg-white` + `var(--color-ice-*)` in chrome |
| Ink-and-Ice | PASS in chrome | Slide bodies use hard-coded palette hexes deliberately (must pixel-match PPTX) |
| One-Warm | PASS in chrome | `RED = "#C00000"` in `SlideSalesByQuantity` mirrors PPTX, justified |
| Tabular Numbers | **FAIL** | Missing from 6 number-heavy slides; only 2 have it |
| Two-Family | PARTIAL | Slide bodies force Calibri to mirror PPTX (correct); chrome buttons inherit body font (no display leakage) |
| Wide-Tracked Label | PASS | "Export" eyebrow and "Slide preview" used as eyebrows, not top-of-page |
| Flat-By-Default | **FAIL** | `shadow-2xl` on modal, `hover:shadow-md` on palette cards, `shadow-sm` on preview canvas, `backdrop-blur-sm` on modal |
| Border-First | PARTIAL | Structure via `border-[var(--color-ice-200)]` mostly; depth substitution done with shadows in the modal + palette cards |
| No-Side-Stripe | PASS | No colored stripes |
| Raw Tailwind color families in chrome | **FAIL** | `text-red-600` at export-form.tsx:224 and pdf-exporter.tsx:153 |

## Editor–Preview–Export Sync Check (called out separately)

**High risk.** Inline preview and PDF export both render through `SlidePreview` (guaranteed to match by construction). The **PPTX export uses an entirely separate server implementation** in `src/lib/pptx/index.ts` invoked via `POST /api/export`. Nothing enforces that these two agree — no snapshot test, no shared spec, no runtime diff. Comments in `SlidePreview` like "matches the current HQ format position-for-position" and "mirrors the editor + PPTX" are prose promises, not machine-checked invariants.

Concrete drift risks visible from reading the preview alone:
- The ACC% / YoY% weighted-ratio Total logic at [slide-preview.tsx:258–268](src/components/slide-preview.tsx:258).
- Daily Sales `nonTrading` bar-dimming.
- Expire Write-Off current-month yellow highlight `#F9E795`.
- Top-Products red highlight for products present in Top-4.

Every one is a place where "I fixed the preview" won't fix the exported PPTX. **This is the single biggest risk on this surface** — it's PRODUCT.md's load-bearing Principle #1 with no enforcement.
