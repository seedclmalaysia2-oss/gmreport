---
target: Files page (upload + history + trash) — post-harden
total_score: 38
p0_count: 0
p1_count: 2
timestamp: 2026-07-24T16-37-58Z
slug: src-app-files-page-tsx
---
Method: dual-agent (A: a011bad6002379546 · B: ae9d693e33dcaecdd)

## Design Health Score

| # | Heuristic | Score | Δ | Key Issue |
|---|-----------|-------|---|-----------|
| 1 | Visibility of System Status | 4 | 0 | Coverage chips, retargeted banner, auto-set month notice, per-action spinners |
| 2 | Match System / Real World | 4 | +1 | KIND_LABELS, "Waiting for a file", MonthBlock reads in slide order |
| 3 | User Control and Freedom | 4 | 0 | Dismissable retarget banner, trash + restore, filter clearable, confirm dialogs |
| 4 | Consistency and Standards | 4 | +1 | Button primitive + Modal shell centralise the vocabulary |
| 5 | Error Prevention | 3 | 0 | Year clamp, cross-month guard, beforeunload — BUT Modal initial-focus lands on destructive primary |
| 6 | Recognition Rather Than Recall | 4 | +1 | Coverage chip + Manual pill preempt "am I done?" |
| 7 | Flexibility and Efficiency | 4 | +1 | Auto-set month, bulk trash, sm/md/lg button sizes, slide-chip nav |
| 8 | Aesthetic and Minimalist | 3 | -1 | Ink-and-Ice restraint holds; but the clickable partial coverage chip toggles an always-empty filter |
| 9 | Error Recovery | 4 | 0 | Replace error copy is genuinely excellent, network error prefixed, warnings in-vocabulary |
| 10 | Help and Documentation | 4 | +1 | Dropzone tip, filename hints modal, tooltips on Manual pill, section-scoped returns |
| **Total** | | **38/40** | **+4** | **Excellent — minor polish only** |

## Delta from prior critiques (21 → 34 → 38)

Round 3 mostly delivered on production-hardening (year clamp, network try/catch, cross-month guard, beforeunload) and on shared primitives (Button + Modal). Focus trap is real. Semantic tokens are honoured. The score doesn't move much because two new-round additions introduce fresh smells: an always-empty filter mode (coverage-chip click) and a modal focus target that lands on the destructive primary in alertdialogs.

## Anti-Patterns Verdict

**LLM assessment: PASS.** The vocabulary ("Files recognised", "Waiting for a file", "Month auto-set", "Slides refreshed"), the coverage-chip roll-up, and the Cambria/ink-navy chrome read like a bespoke internal tool at a serious company, not a Vercel template. One genuinely inventive touch — the coverage chip pair — that no scaffold would have arrived at.

**Deterministic scan: 0 findings** (unchanged from round 2). Clean state held through coverage → refactor → harden cycles.

**Visual overlays:** skipped — no dev server running.

## Overall Impression

Materially good — Linear-adjacent quality in structure and copy. Rating-band **Excellent (36-40)**. What's left is two P1s that both bit precisely because we shipped fast: a Modal initial-focus that assumes "last button = primary" (backwards for alertdialogs), and a coverage-chip click that toggles a filter guaranteed to return zero rows. Both are 30-line fixes that would land the score in the high 39s. Neither is a design regression — they're consequences of the P2 refactor and coverage-feature shipping close together.

## What's Genuinely Excellent

- **Coverage-chip roll-up** ([coverage-chip.tsx:82–107](src/components/coverage-chip.tsx:82) + [coverage.ts:60–80](src/lib/coverage.ts:60)) — the "8/8 inputs ready" + "Manual: 2 · 3 · 9 · 12 · 13" pair is the kind of small invention that lifts a form-heavy page into a dashboard. The chip tells him state, the pill preempts the obvious follow-up.
- **Modal focus-trap** ([modal.tsx:92–157](src/components/ui/modal.tsx:92)) — captures `previouslyFocused`, cycles Tab both ways, `focusin` belt-and-braces net, restore on close. Well built for a two-consumer shell.
- **Error copy in the Replace flow** ([file-row-actions.tsx:101–106](src/components/file-row-actions.tsx:101)) — names the exact failure state, gives a concrete recovery step, doesn't blame the user or hide state divergence.

## Priority Issues

### [P1] Modal initial focus lands on the destructive primary in alertdialogs
- **What:** [modal.tsx:108](src/components/ui/modal.tsx:108) picks `nodes[nodes.length - 1]` as initial focus. For the "Delete permanently?" confirmation the focusable order is `[X close, Cancel, Delete forever]` — so opening lands focus on **Delete forever**. A stray Enter or Space commits the irreversible purge.
- **Why it matters:** WCAG best practice for destructive alertdialogs is to focus the safe default. I introduced this in the P2 refactor along with the focus trap — the trap works, but the initial target picks the wrong end.
- **Fix:** honour a `data-modal-initial-focus` marker on Cancel for `tone="danger"`; keep "primary-last-focus" only for informational modals. Simpler variant: when `role="alertdialog"`, focus the first non-close focusable (Cancel) instead of the last.
- **Failure scenario:** Simon opens bulk-purge, reflexively hits Space thinking it will scroll — bytes and audit rows are gone.
- **Suggested:** `/impeccable harden`

### [P1] Partial-coverage filter is guaranteed to be empty
- **What:** [month-block.tsx:48–56](src/components/month-block.tsx:48) filters `visibleFiles` to those whose `sectionKeys` intersect `uncoveredInputs`. By construction, any file with sectionKey X puts X in `coveredInputs` — so X can never be in `uncoveredInputs`. Every partial-chip click produces the empty state. My inline comment about "if the parser downgrades a file to `unknown` mid-import" doesn't hold: unknown files have empty sectionKeys and still won't match.
- **Why it matters:** the click is an inviting interaction that leads to a dead end. The valuable info (the "Waiting for a file:" chip strip) already sits ABOVE the empty table.
- **Fix:** drop the filter mode. Turn the partial chip into a "reveal what's missing" toggle that shows the `UncoveredSlideList` strip (or make the strip permanent under the header) and leaves the file table untouched.
- **Failure scenario:** Simon clicks amber "6/8 inputs" expecting to see the problem files → table empties → disorienting.
- **Suggested:** `/impeccable distill`

### [P2] `KIND_LABELS` copy-pasted in two places
- **What:** [import-form.tsx:17–30](src/components/import-form.tsx:17) and [month-block.tsx:14–27](src/components/month-block.tsx:14) define byte-identical maps. The import-form comment even says "Kept in sync with the KIND_LABELS map on the Files page" — a "don't do this" comment.
- **Fix:** extract to `src/lib/kind-labels.ts` (or add to `src/lib/schema.ts` next to SECTION_META). Both callers import.
- **Failure scenario:** a new parser kind (`pos_credits`) is added; developer updates one file and misses the other.
- **Suggested:** `/impeccable distill`

### [P2] Button primitive is over-composed
- **What:** six variants defined; `ghost` has zero call-sites; `warn` has exactly one (legacy re-upload). `--color-bad-700` is declared in globals and never referenced.
- **Fix:** trim to `primary | secondary | destructive | destructive-solid`; fold the one warn CTA into a `tone?: "warn"` on secondary, or treat as a special-case shell.
- **Suggested:** `/impeccable distill`

### [P2] Cross-month drop uses only the FIRST detected filename hint
- **What:** [import-form.tsx:177–181](src/components/import-form.tsx:177) walks the drop and takes the first period hint. If Simon multi-drops mixed Feb + Apr files together, all get bundled into whichever hint appears first. The retarget banner says "switched to Feb", the Apr files silently go into February.
- **Fix:** collect the set of detected periods across the drop; if `>1` distinct period, refuse the queue with an inline warn strip listing the offending filenames.
- **Failure scenario:** Simon drags a whole "this week's POS drop" folder — 4 Feb + 5 Apr. Retarget "switched to Feb", Apr files parsed for February.
- **Suggested:** `/impeccable harden`

### [P3] `beforeunload` fires during benign bulk Restore
- **What:** [trash-table.tsx:87–94](src/components/trash-table.tsx:87) guards on `isWorking`, true for both purge and restore. Restore is idempotent; the native prompt is disruption inflation.
- **Fix:** gate on `busy === "purge"` only.
- **Suggested:** `/impeccable harden`

## Persona Red Flags

- **Alex** — nothing left.
- **Riley** — the Replace error path is real, the retarget banner is a real safety net. The only residual: mixed-month multi-drop (P2 above).
- **Sam** — Modal focus trap is real. But the initial-focus-on-destructive (P1) undoes some of the gain for keyboard-first users.
- **Simon-GM** — Coverage chip + Manual pill is exactly what a GM needs. Residual: clicking the partial chip does nothing productive (always-empty filter, P1 above).

## Cognitive Load

**0/8 checklist items failed.** Everything's labelled + iconed, undo exists on destructive paths, primary CTA unmistakable, similar tasks use identical shells.

## Minor Observations

- MonthBlock header container has both `shrink-0` and `min-w-0` at [month-block.tsx:68](src/components/month-block.tsx:68) — mutually contradictory. `flex-wrap` on the parent lets it wrap anyway, but the intent isn't legible.
- `--color-warn` (base semantic) is used exactly once, for the modal icon. Everything else uses the tinted scale. The base tokens for warn/ok are effectively vestigial.
- The FileRow "Slides fed" chip-links have a stronger hover (`hover:bg-ink-800 hover:text-white`) than the row itself — the chip has more affordance than the row.
- Modal's initial-focus computation runs after a 20ms `setTimeout`. Fine, but a fast keyboard user could type before focus lands anywhere. Rare but not impossible.

## Questions to Consider

1. If the "click the partial chip to filter" flow is always empty, what if the coverage chip instead **scrolled to** a permanent `UncoveredSlideList` strip under the header? Current click-to-toggle-a-dead-filter is inventing an interaction where a static list would tell the whole story.
2. The Recently Deleted section only appears when `deletedFiles.length > 0`. A GM auditing "what did I delete last week" during a review has no answer when the trash is empty — should the section render with a "Trash is empty" state?
3. The Modal focus target picks "last focusable" on the theory that's the primary action. In destructive alertdialogs, last footer button is the destructive one — is that theory just backwards for `role="alertdialog"`?

## DESIGN.md rule compliance

| Rule | Status |
|------|--------|
| No-Cream | PASS |
| Ink-and-Ice | PASS |
| One-Warm | PASS |
| Tabular Numbers | PASS |
| Two-Family | PASS |
| Wide-Tracked Label | PASS (`tracking-[0.12em]` throughout) |
| Flat-By-Default | PASS |
| Border-First | PASS |
| No-Side-Stripe | PASS |
