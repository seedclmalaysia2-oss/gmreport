---
target: Files page (upload + history + trash) — post-polish
total_score: 34
p0_count: 0
p1_count: 1
timestamp: 2026-07-24T16-01-42Z
slug: src-app-files-page-tsx
---
Method: dual-agent (A: abaac196d75ad39ce · B: a80b22b043473222c)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Auto-detect banner, per-file spinners, totals, filename-hint popup all fire predictably |
| 2 | Match System / Real World | 3 | Domain register strong; "Update" verb still needs decoding, destructive verb ladder (Remove → Delete forever) re-reads |
| 3 | User Control and Freedom | 4 | Trash + restore + bulk restore + "Keep in trash" language give genuinely reversible destructive paths |
| 4 | Consistency and Standards | 3 | 3-role button system mostly honoured, but Import + "Update — back to Slide" re-inline the primary recipe instead of sharing a primitive |
| 5 | Error Prevention | 3 | ConfirmDialog + auto-detect are strong; year field still accepts anything, wrong file kind only caught post-import |
| 6 | Recognition Rather Than Recall | 3 | "Slides fed" chips show what did feed, never what's missing per month |
| 7 | Flexibility and Efficiency | 3 | Bulk actions still only on trash, no keyboard shortcuts |
| 8 | Aesthetic and Minimalist | 4 | Reads clean, ink-and-ice throughout, eyebrow removed, hierarchies breathe |
| 9 | Error Recovery | 4 | Filename-keyword table is well-crafted embedded help; inline error strips replace alert() |
| 10 | Help and Documentation | 3 | Tooltips + hints enough for Simon; first-run user still wants "how do I import?" pointer |
| **Total** | | **34/40** | **Good — solid foundation, address weak areas** |

## Delta from prior run

The polish sweep moved the total from **21/40 → 34/40** — a +13 lift, mostly driven by:
- **Consistency +2** (1 → 3): the four sibling components share a genuine three-role button vocabulary.
- **Aesthetic +2** (2 → 4): eyebrow deleted, shadow flattened, tokens routed through the palette picker.
- **Error Recovery +3** (1 → 4): browser `alert()` gone, inline error strips in-vocabulary.
- **User Control +2** (2 → 4): destructive paths now speak the app's language via `ConfirmDialog`.
- **Visibility +1**, **Aesthetic +2**, **Recognition +0** (still the same gap that motivates a separate craft pass).

## Anti-Patterns Verdict

**LLM assessment: PASS.** Reads like a considered internal tool, not template scaffolding. Semantic tokens, restrained button roles, and domain-native copy ("Slides fed", "POS Master (Stock Sales Analysis)") are visible signs of intent. What was borderline last run is now clearly on-brand for the register.

**Deterministic scan: 0 findings** (down from 1 advisory). The `text-[10px]` → `text-[11px]` polish resolved the type-ramp advisory. Six files, no rule triggered.

**Visual overlays:** skipped — no dev server running.

## Overall Impression

The sweep moved this page from "borderline template" to "considered product surface." No P0/P1 defects survive. What's left is one strategic gap — **no per-month slide-coverage roll-up**, which was raised as an open question last time and remains unanswered — plus tightening opportunities: extract the button recipe into a primitive, unify the two dialogs under one shell, real focus trap on `ConfirmDialog`. The single biggest opportunity is now a *feature* addition (coverage badges on `MonthBlock`) rather than a design fix.

## What Improved

- **Semantic tokens fully adopted.** Fresh grep for `red-|amber-|emerald-|yellow-|green-` across the five polished files returns **zero matches** — the token migration is clean.
- **Destructive confirmation is in-vocabulary** via [confirm-dialog.tsx:16–131](src/components/confirm-dialog.tsx) — `role="alertdialog"`, ESC dismiss, autofocus on confirm, danger vs neutral tones — cleanly replaces the three raw `confirm()` sites.
- **Friendly kind labels** at [page.tsx:19–32](src/app/files/page.tsx:19) mirrored in [import-form.tsx:15–28](src/components/import-form.tsx:15) — "Files recognised" reads "POS Master (Stock Sales Analysis)" instead of `pos_master`.

## What's Working (continuing)

- **Auto-month detection** at [import-form.tsx:134](src/components/import-form.tsx:134) + confirmation banner remain the page's best feature — a genuinely elegant piece of intent-inference.
- **Slides-fed chips** link straight to the section they populated — turns the file table into a report navigator, not just an audit log.
- **Empty-months row** at [page.tsx:321](src/app/files/page.tsx:321) is a quiet but effective "here's what still needs uploading" nudge without moralising.

## Priority Issues

### [P1] No per-month slide-coverage roll-up (from prior "Questions to Consider")
- **What:** Simon's core job on this page is verifying "did I upload everything for July?" — the UI shows *what he uploaded*, never *what's missing*.
- **Why it matters:** flagged last time as a question, remains an open gap. Simon has to open each MonthBlock, mentally union all the "Slides fed" chips across every file, and cross-check the 13-slide contract by eye.
- **Fix:** on the `MonthBlock` header ([page.tsx:170–191](src/app/files/page.tsx:170)), add a wide-tracked chip: "8 / 13 slides ready", `--color-ok-200` when full, `--color-warn-200` when partial. On click, filter the table to files feeding unfilled slides.
- **Failure scenario:** July MonthBlock is missing a file feeding Slide 9 (Salesman); the export runs with stale June salesman data, discovered only in the boardroom.
- **Suggested:** `/impeccable shape` (this crosses into new-feature territory)

### [P2] `<ConfirmDialog>` describes focus trap but doesn't implement one
- **What:** the primitive auto-focuses the confirm button but has no `focusin` guard. Tab from confirm exits to the underlying page.
- **Why it matters:** Sam persona regression — a keyboard-only user can trigger row actions "behind" the modal.
- **Fix:** capture `document.activeElement` on open; trap tab-cycle between cancel + confirm; restore focus on close.
- **Failure scenario:** Simon opens Delete N forever dialog, tabs once expecting Cancel, focus lands on the underlying row's "Delete forever" trigger. Confidence collapses.
- **Suggested:** `/impeccable harden`
- **File:** [confirm-dialog.tsx:39–48](src/components/confirm-dialog.tsx:39)

### [P2] "Some files need attention" popup bypasses the ConfirmDialog primitive
- **What:** the whole polish story is that destructive paths speak in-app. But the *most consequential* post-import modal — the issues popup at [import-form.tsx:382–493](src/components/import-form.tsx:382) — still uses raw `role="dialog"` without autofocus or the shared vocabulary.
- **Why it matters:** the two dialogs subtly render as "two systems" again.
- **Fix:** hoist the issues popup into a wider `<InfoDialog>` variant of `ConfirmDialog` (or shared `<Modal>` shell) with the same focus, ESC, and tone handling.
- **Suggested:** `/impeccable distill`

### [P2] Duplicated primary/secondary button recipes across three components
- **What:** three copies of the `bg-ink-800 text-white px-… rounded-md` recipe live at [import-form.tsx:289](src/components/import-form.tsx:289), [import-form.tsx:365–370](src/components/import-form.tsx:365), and [file-row-actions.tsx:105–108](src/components/file-row-actions.tsx:105).
- **Why it matters:** the token migration is clean but the *composition* is now the drift risk. A future palette tweak becomes an N-place edit and consistency slips silently.
- **Fix:** extract `<Button variant="primary|secondary|destructive|warn">` primitive that owns the class recipes; the local objects in `file-row-actions.tsx` and `file-trash-actions.tsx` become import statements.
- **Suggested:** `/impeccable distill`

### [P3] "Update" verb collision
- **What:** "Update" as an in-row action (replace the file) and "Update — back to Slide" as the return CTA on the import-success card are different actions with the same label.
- **Fix:** rename the row action to **Replace** (Linear/Notion vocabulary); keep "Update" only for the return CTA.
- **Failure scenario:** on a call Simon is told "click Update on the June ECP row" — he replaces the ECP audit trail instead of returning to a slide.
- **Suggested:** `/impeccable clarify`
- **File:** [file-row-actions.tsx:192–193](src/components/file-row-actions.tsx:192)

## Persona Red Flags

**Alex (power user / analyst):** would want a filter box ("find the June SCLM I re-uploaded last week") and keyboard shortcuts (`u` upload, `/` filter). Page has neither. Bulk actions still absent on the active list.

**Riley (stress tester):** year input still accepts `3025` (unbounded `<input type="number">`). Update handler still swallows the post-import DELETE silently (`file-row-actions.tsx:86`). No `beforeunload` mid-parse.

**Sam (accessibility):** ConfirmDialog missing focus trap (P2 above). Issues popup missing `role="alertdialog"` (P2 above). Semantic error strips and `aria-modal="true"` are correct. Real progress vs prior run.

**Simon-GM (project persona):** the coverage roll-up remains the single most important thing this page could do for him. Everything else on the page now feels made for him.

## Cognitive Load

**3/8 fail** (down from 5/8).
- FAIL: **Destructive verb fatigue** — Remove / Delete forever / Restore / Keep in trash / Delete N forever = five distinct destructive-adjacent labels.
- FAIL: **Recognition** — no per-month slide-coverage badge, Simon must open reports to verify.
- FAIL: **Progressive disclosure** — Recently-Deleted preamble is three sentences ([page.tsx:158–162](src/app/files/page.tsx:158)) explaining a trash can he already understands.

Passes: single focus, chunking, grouping, visual hierarchy, one-thing-at-a-time.

## Minor Observations

- Table `thead` uses `tracking-wider` (0.05em) at [page.tsx:195](src/app/files/page.tsx:195) — under-committed vs DESIGN.md's "Wide-Tracked Label" rule (elsewhere 0.15em). Consider `tracking-[0.12em]`.
- Header subtitle at [page.tsx:84–87](src/app/files/page.tsx:84) is two sentences; the second ("Files you import here are saved to Supabase…") tells Simon implementation details he doesn't care about — cut.
- Auto-detect banner uses `bg-[var(--color-ok-50)]` — but the semantic content ("we changed your target month") is closer to info than success. Consider `bg-[var(--color-ice-50)]` + a `Sparkles` icon.
- The `warnPrimary` variant appears in exactly one call-site (legacy re-upload). Justified today, but flag for removal once no `hasBytes: false` rows remain in the corpus.

## Questions to Consider

1. Should the primary action be **one-click**? Drop → review → click Import is a handshake a returning user doesn't need. A `localStorage` "Import on drop" toggle could offer both modes.
2. Would a **"Files & Coverage" view** — files grouped by slide instead of by month — match Simon's mental model better than files-by-month? He thinks in slides, not months.
3. If Remove is fully undoable via trash, does it need a modal at all — or is Slack's toast-with-undo pattern (`5 seconds to undo`) better fit for the register?

## DESIGN.md rule compliance

| Rule | Status | Note |
|------|--------|------|
| No-Cream | PASS | Whites and ice tints only |
| Ink-and-Ice | PASS | Ink 600–900 for text/CTAs, ice 50–200 for surfaces |
| One-Warm | PASS | Coral accent unused on this page; warn/bad hits are semantic |
| Tabular Numbers | PASS | Bytes, timestamps, unmapped qty, KB queue all `tabular-nums` |
| Two-Family | PASS | Cambria display, Calibri body |
| Wide-Tracked Label | PARTIAL | Table thead sits at 0.05em; DESIGN targets 0.12–0.15em |
| Flat-By-Default | PASS | Only `shadow-sm` on trash toolbar, `shadow-lg` on modals |
| Border-First | PASS | Every card is `rounded-2xl border border-ice-200 bg-white` |
| No-Side-Stripe | PASS | No colored left/right stripes anywhere |
