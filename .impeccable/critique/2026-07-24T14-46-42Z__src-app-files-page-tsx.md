---
target: Files page (upload + history + trash)
total_score: 21
p0_count: 2
p1_count: 3
timestamp: 2026-07-24T14-46-42Z
slug: src-app-files-page-tsx
---
Method: dual-agent (A: aaa5ec329347d98b3 · B: a1041144381a652b2)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Multi-file batch upload shows one global spinner, not per-file progress |
| 2 | Match System / Real World | 3 | Domain fluent; only friction is the "Files recognised" list showing `pos_ecp_list` raw keys instead of KIND_LABELS |
| 3 | User Control and Freedom | 2 | Soft-delete + Restore is right, but native `confirm()` is used and there's no undo toast — recovery requires scrolling to the trash section |
| 4 | Consistency and Standards | 1 | Six distinct button treatments across four sibling components; primary/secondary/destructive mapping is not stable |
| 5 | Error Prevention | 2 | `<input type="number">` for Year is unbounded (accepts 3025); no guard when a second drop hints a different month |
| 6 | Recognition Rather Than Recall | 3 | Icons + text on every button, filename hints table, "Detected as" column — strong |
| 7 | Flexibility and Efficiency | 1 | Bulk-select exists only in Trash. No search, no filter-by-kind, no sortable columns, no keyboard shortcuts |
| 8 | Aesthetic and Minimalist Design | 2 | Three warm banners can co-exist; action cluster stacks four verbs per row in mixed tints |
| 9 | Error Recovery | 1 | Bare `alert()` for network failures; no retry, no context — only TrashTable has an inline error strip |
| 10 | Help and Documentation | 3 | Drop-zone tip, filename hints table, teaching empty state |
| **Total** | | **21/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**Start here.** Does this look AI-generated?

**LLM assessment: borderline.** The IA and domain vocabulary earn user trust — this is not "some Notion clone" at first glance. But the action layer has drifted into 5+ competing button-color families that read more like a mid-2020s SaaS admin panel than "The Reporting Instrument." Simon might trust the page's information architecture, but a design-fluent teammate would pause at the fifth different button treatment and ask why.

**Deterministic scan:** 1 advisory only.
- `src/components/import-form.tsx:423` — `text-[10px]` is off the DESIGN.md type ramp (min is 11px per the frontmatter's `body` role). Ratifiable if 10px is desired as the "micro-label" step; otherwise bump to 11px or add a documented step.

The detector was quiet on the big issues (color drift, button vocabulary drift, native dialogs, eyebrow) because the rule engine doesn't yet cover *system-token vs. raw-Tailwind-classes* drift or *button-vocabulary consistency* — both are surfaced by Assessment A's review. This is the exact case where the detector agreeing with the design review would be a false comfort. Trust the review here.

**Visual overlays:** skipped — no dev server running.

## Overall Impression

The page's bones are right: three-block IA (Upload → History → Trash), month-grouped table, per-row actions, soft-delete + restore, auto-detect month from filename. The domain language reads like Simon's own speech. The single biggest opportunity is *palette + button discipline* — collapse the six action-button treatments into three roles, route every `red/amber/emerald` class through the semantic tokens, and replace the two `alert()` + three `confirm()` calls with in-vocabulary dialogs. That single sweep will move the score from 21 to the high 20s and stop the page from being the "one screen where the palette picker breaks" in the app.

## What's Working

- **Domain fluency is real.** `KIND_LABELS` (page.tsx:18–31) and `FILENAME_HINTS` (import-form.tsx:15–30) speak Simon's language. "POS Master (Stock Sales Analysis)" is the exact register; "Detected as" is the right phrasing for auto-classification.
- **Auto-detect + visible confirmation** (import-form.tsx:113–131, banner at 239). Drop a file with `Apr26` in the name, watch the emerald banner say the month has been retargeted — this is the textbook expression of PRODUCT.md Design Principle #2.
- **Soft-delete → trash → restore → hard-purge** is end-to-end and modelled correctly, with bulk actions in the trash to keep it from becoming a chore. The one-tap Restore is the reassurance the "Remove" button needs to feel safe.

## Priority Issues

### [P0] Broken token in the trash selection toolbar
- **What:** `trash-table.tsx:83` uses `border-[var(--color-ink-200)]`, but the ink scale in `globals.css` starts at ink-600. That token resolves to nothing.
- **Why it matters:** the sticky toolbar sits over the `bg-[var(--color-ice-50)]` header of the trash table with no visible edge at the moment the user is committing to a bulk purge. The eye can't fix the toolbar as a distinct object; the "Delete selected" button becomes visually adjacent to whatever it happens to overlap.
- **Fix:** replace with `border-[var(--color-ice-200)]` (matches every other card border on the page).
- **Failure scenario:** user selects 8 files, scrolls, the sticky toolbar hovers with no stroke, misclicks Delete-forever thinking it's still the neutral chrome.
- **Suggested:** `/impeccable harden`

### [P0] Semantic-color drift: 20+ raw Tailwind classes bypass DESIGN tokens
- **What:** every warn/ok/bad surface reaches for `amber-*`, `emerald-*`, `red-*` instead of `--color-ok / --color-warn / --color-bad / --color-accent`. Representative locations: `file-row-actions.tsx:159, 186–187`; `file-trash-actions.tsx:69–70, 81–82`; `trash-table.tsx:101–102, 112–113, 123`; `import-form.tsx:240, 254, 261, 302, 311, 327, 363, 365, 367, 370, 378, 391, 408`.
- **Why it matters:** breaks the 12-palette promise. Terracotta, Ocean, Sage etc. all derive their semantic hues from the palette's own hue; hardcoded emerald-100 renders identically in every palette. Also stacks three warm surfaces on one screen — direct violation of the **One-Warm Rule** and the **Ink-and-Ice Rule** simultaneously.
- **Failure scenario:** Simon switches from Midnight to Coral in the header palette picker. The Files page still shows emerald Restore + amber "Re-upload legacy" + amber modal — looks like the theme is broken.
- **Fix:** route every hardcoded color through `--color-ok / --color-warn / --color-bad / --color-accent`. Add small `.ok-chip / .warn-chip / .bad-chip` classes so the ladder is picked up automatically. Delete `emerald-*/amber-*/red-*` from these five files.
- **Suggested:** `/impeccable colorize`

### [P1] Six-way button-vocabulary drift across four sibling components
- **What:** the surface uses six button treatments: ink-800 solid (View, Import, Update CTA), ice-100 solid (Save), ghost with ink text (Update), red-text ghost (Remove), amber-100 solid (Re-upload legacy), emerald-100 solid (Restore), red-600 solid (bulk Delete). None obey a stable "primary / secondary / destructive" hierarchy.
- **Why it matters:** in one row, `View` (dark navy filled) and `Save` (pale ice filled) both read as "primary weight." In the trash, `Restore` is emerald-filled — the same visual signal that says "commit / save" on other product surfaces. Mental model of *fill = commit* breaks.
- **Fix:** collapse to three button roles applied uniformly:
  - **Primary:** `bg-[var(--color-ink-800)] text-white` (Import, main CTAs)
  - **Secondary:** `bg-white border border-[var(--color-ice-200)] text-[var(--color-ink-800)]` (View / Save / Update / Restore — same visual weight across all four contexts)
  - **Destructive:** `text-[var(--color-bad)] hover:bg-[var(--color-bad)]/10` (Remove / Delete forever)
- **Failure scenario:** the palette picker + the row buttons together telegraph "this isn't one system" — the exact "AI made this" tell for the product register.
- **Suggested:** `/impeccable distill`

### [P1] Native `confirm()` and `alert()` for the most consequential paths
- **What:** three `confirm()` gates (`file-row-actions.tsx:42`, `file-trash-actions.tsx:42`, `trash-table.tsx:52`) and four `alert()` failure paths (`file-row-actions.tsx:55, 89`; `file-trash-actions.tsx:35, 55`).
- **Why it matters:** the browser's blocking `confirm()` interrupts a boardroom-navy dashboard with stock Windows/Chrome chrome — ignores the palette, ignores dark mode, ignores focus management. Sam persona: no ARIA live region, announced outside the app's landmarks. Riley persona: focus returns to nowhere predictable after dismiss.
- **Fix:** build one `<ConfirmDialog>` component in the same vocabulary as the existing "Some files need attention" popup (import-form.tsx:351–462 is the structural template). Route the three call sites through it. Replace `alert()` with inline error strips (TrashTable already has one — copy that pattern).
- **Failure scenario:** on a shared screen during an HQ review, a stock Chrome dialog pops in the middle of the navy dashboard when Simon clicks Remove.
- **Suggested:** `/impeccable harden`

### [P1] AI-grammar eyebrow at page top
- **What:** `page.tsx:98` renders `<p>Files</p>` in uppercase with `tracking-[0.2em]` above the h1. DESIGN.md's Don't list explicitly bans the "tiny uppercase tracked eyebrow above every section" pattern.
- **Why it matters:** the route is already visible in the nav; the h1 "Upload & history" is the entry point. Adding this eyebrow becomes the reflex for every new route → the app becomes wallpaper-y.
- **Fix:** delete `page.tsx:97–98`. Let the h1 lead.
- **Suggested:** `/impeccable distill`

### [P2] `shadow-2xl` on the issues modal contradicts the elevation vocabulary
- **What:** `import-form.tsx:360` renders the modal with `shadow-2xl`. DESIGN.md's elevation scale caps modals at `shadow-lg` (Flat-By-Default Rule).
- **Fix:** `shadow-lg`.
- **Suggested:** `/impeccable quieter`

## Persona Red Flags

**Alex (power user):**
- No keyboard shortcuts anywhere. No `⌘K`, no `⌫` on selected trash rows, no arrow-key row navigation.
- Bulk actions exist in Trash but not on the active list. Eight wrong files = eight sequential `confirm()` dialogs.
- No sortable columns, no filter-by-kind, no search across months. With a year of data (~144 rows) this becomes scrolling-only.

**Riley (stress tester):**
- `Update` handler (`file-row-actions.tsx:86`) fires the delete-old-audit-row *after* new import and silently swallows failures (`.catch(() => {})`). If the DELETE fails, list shows the same filename twice, both with `hasBytes: true`. Silent state divergence.
- `addFiles` (`import-form.tsx:113`) auto-retargets month only when `files.length === 0`. Dropping a second batch with a different month is silently absorbed.
- Year input (`import-form.tsx:204`) accepts `3025`. No min/max. Submitting creates a MonthReport for year 3025.
- No `beforeunload` guard mid-parse. Tab close during a long XLSX parse silently discards the queue.
- "Some files need attention" popup re-opens on the same set of warnings every re-Import — no ack state.

**Sam (accessibility):**
- Native `alert()` and `confirm()` are announced as system prompts, outside the app's ARIA context.
- Header select-all `<input>` (trash-table.tsx:140) sets `indeterminate` via ref. The visual cue relies on `accent-color` only (which only paints the tick), and many screen readers don't announce the indeterminate state.
- Drop zone `<div>` (`import-form.tsx:214`) has no `role="button"`, no `tabIndex`, no keyboard handler. Clickable-only.
- Focus rings inherit browser default; `active:scale-95` shrinks the ring with the button.

**Simon-GM (project persona):**
- **Biggest gap:** the page tells him what he uploaded, not what's *still missing*. There's no "N/13 slides covered" chip per month, no warn on months missing critical slides. He has to union the "Slides fed" chips across every row in every month by eye.
- "Months without uploads" only lists MonthReports that already exist. His next month doesn't appear until it's created elsewhere.
- Same-name re-upload "supersedes the old copy" (per the comment at page.tsx:228) but no chip on the row says so. "Replaced Apr 30 22:15 upload" would close the loop.
- No "current month" marker on any month block. PRODUCT.md's Coral+Butter current-month dot is absent here.
- "Files recognised" fingerprint (import-form.tsx:283–291) uses `<code>{kind}</code>` — Simon reads `pos_master`, `pos_ecp_list`. He shouldn't have to translate his own tool.

## Cognitive Load

**5/8 checklist items fail.**
- FAIL: Multiple competing accent hues on screen (amber modal + emerald banners + red buttons + ink primary).
- FAIL: Unclear primary-action hierarchy in the row cluster (View is ink-solid, Delete-forever bulk is red-solid — same visual weight, different semantics).
- FAIL: Four verbs per active row (View / Save / Update / Remove) when two would carry it; drift between filled and ghost styles inside the same cluster.
- FAIL: Up to four success surfaces can co-exist (autodetect banner + 2025-applied banner + return-context banner + "Files recognised" list).
- FAIL: Dense table (six desktop columns + slide-chip stack + action column) with no zebra + tight action buttons.
- PASS: Consistent icon + label pattern.
- PASS: Clean top-level grouping (Upload → History → Trash).
- PASS: Slide chip color and shape are consistent across desktop and mobile.

## Minor Observations

- Queued-files list (`import-form.tsx:247–258`) doesn't `tabular-nums` the KB column — minor Tabular-Numbers Rule miss.
- `TrashTable` duplicates `fmtBytes` / `fmtTimestamp` already defined in `page.tsx` (page.tsx:33, 40 vs. trash-table.tsx:173, 180). Extract to `@/lib/utils`.
- Sticky selection toolbar uses `top-16` (trash-table.tsx:83), a hardcoded 64px — but the nav is 56px. Off by 8px, so it either hovers or clips.
- Language drift: EmptyMonthRow calls the button verb "Upload here" (`page.tsx:350`) while the primary form CTA is "Import" (`import-form.tsx:266`). Pick one verb for the whole cycle.
- The "Some files need attention" modal's `Got it` + `Pick files again` pairing is the one place the button vocabulary is right (ghost + primary). Preserve it as the reference pattern when distilling the others.

## Questions to Consider

1. Should the Files page be a **13-slide coverage board for the current month** first, and the upload history second? Simon's primary post-drop question is "am I done?" — the current design makes him count chips across 12 rows to answer that.
2. Do you need `Remove` at all when `Update` covers replace-with-new and `Restore` covers accidental delete? Two destructive verbs on the same row invites drift — killing `Remove` collapses the row cluster from four verbs to three and lets the button vocabulary breathe.
3. If auto-detect is trusted enough to retarget the month, why not one step further and auto-`Import` on drop with a 5-second undo toast, Linear-style? The two-step drop → click-Import is friction in the exact place PRODUCT.md says the tool should disappear.

## DESIGN.md rule compliance

| Rule | Status | Evidence |
|------|--------|----------|
| No-Cream Rule | PASS | Body bg is ice/ink, no warm neutral |
| Ink-and-Ice Rule | **FAIL** | 20+ raw amber/emerald/red classes across all four action files |
| One-Warm Rule | **FAIL** | Amber modal + emerald autodetect + emerald 2025-applied + amber legacy + red bulk on one screen |
| Tabular Numbers Rule | PARTIAL | Missing on the queued-files KB column (import-form.tsx:253) |
| Two-Family Rule | PASS | Cambria display, Calibri body, no third family |
| Wide-Tracked Label Rule | **FAIL** | Top-of-page eyebrow at page.tsx:98 — explicitly banned in DESIGN Don'ts |
| Flat-By-Default Rule | PARTIAL FAIL | `shadow-2xl` on modal (import-form.tsx:360); `shadow-sm` on trash toolbar (trash-table.tsx:83) is decorative not structural |
| Border-First Rule | FAIL @ 1 site | trash-table.tsx:83 uses a non-existent `--color-ink-200` token — border doesn't render |
| No-Side-Stripe Rule | PASS | No colored left/right stripes anywhere |
