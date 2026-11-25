---
name: gm-dashboard-slides-5-6-pipeline
description: Troubleshoot and maintain the Slide 5 (Sales Quantity by Product) and Slide 6 (Top Products by MYR) data pipeline on the SEED GM Report Dashboard. Use when Slide 5/6 numbers don't match HQ, a row shows zero, totals disagree with salesdashboard, new POS SKU codes appear in the unmapped drawer, the PPTX export looks cramped, or the owner asks about catalog fixes, HQ override behavior, Repair chain, auto-fix, or the live salesdashboard API integration.
---

# Slide 5 / Slide 6 pipeline — how it works and how to fix it

## Data flow (the whole thing, end to end)

```
POS master file (per month)
    ↓ parseMasterXlsx / parsePosPdf
    ↓ SKU_LEVEL_MAP + TORIC_PREFIX + SKU_MAP + TRIAL_LENS_ADJUSTMENTS
sq rows (per canonical product qty) + tp rows (per product MYR)
    ↓
On Repair / on master import:
  1. Re-parse stored master → rebuild sq.rows + tp.rows (clobbers saved values)
  2. applyYear2025ToReport for each ref in summaryRefs:
       • prior-year (year=N-1) ref → sets sa.actual2025 + qty2025
       • current-year (year=N) ref → sets sa.target2026 + calls applyHqCustomerSplitRows
  3. applyHqCustomerSplitRows — override qty2026 + MYR for every product in ref.productQty
       (self-heals missing rows by appending them)
  4. autoFixDriftFromSummary — catches any residual drift and snaps to the LAST same-year ref
```

Two ref sources, applied in order (older first, newer wins):

- **Uploaded Summary workbook** (kind `ref_2025` in `RawFile` table) — parsed by `parse2025Summary`
- **Live salesdashboard API** (`GET /api/hq-summary?year=N` on sales.seedclmalaysiastore.com) — fetched for every year in the chain PLUS year-1

The API is authoritative. It's fetched for both the report year and the prior year so `actual2025` fills from live data too.

## Env vars (required)

**gmdashboard (`prj_OrUgdBHA81Nos88WxK5AHAZNehm0`):**
- `SALESDASHBOARD_URL` = `https://sales.seedclmalaysiastore.com`
- `SALESDASHBOARD_API_KEY` = shared secret

**salesdashboard (`prj_wRXfOVLfU6giAj2KFqcWifou2kbv`):**
- `HQ_SUMMARY_API_KEY` = same shared secret as above
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase service role (bypasses RLS to read `data_files` + storage)
- `SUPABASE_URL` or `VITE_SUPABASE_URL` (fallback)

Set via Vercel MCP `create_project_env`, team `team_SFkzJOM4nCcRAfIQhejycTHt`.

## Key files

| What | File |
|---|---|
| Canonical products (Slide 5 row list) | `src/lib/catalog/products.ts` |
| POS SKU → product mappings | `src/lib/catalog/sku-map.ts` |
| Business rules (human doc) | `docs/CLAUDE-RULES.md` |
| HQ Summary parser + override + autofix | `src/lib/parsers/year-2025.ts` |
| Live API client (gmdashboard side) | `src/lib/salesdashboard-client.ts` |
| Live API endpoint (salesdashboard side) | `salesreport-src/api/hq-summary.js` (in the salesreport repo) |
| Repair chain | `src/app/api/months/repair/route.ts` |
| Import pipeline | `src/app/api/import/route.ts` |
| Slide 5 renderer | `src/components/sections/sales-by-quantity.tsx` |
| Slide 6 renderer | `src/components/sections/top-products.tsx` |
| PPTX Slide 11 (Expire Write-Off) | `src/lib/pptx/modern.ts` and `classic.ts` |

## Troubleshooting checklist

### Symptom: Slide 5/6 numbers don't match HQ / salesdashboard

Diagnose in this order:

1. **Hard-refresh the browser first** (Ctrl+Shift+R). React state can be stale even after a successful Repair.

2. **Confirm the DB actually has the right value.** DevTools Console on `/report/2026-09`:
   ```js
   fetch('/api/months/2026-09').then(r=>r.json()).then(j=>{const r=j.salesByQuantity.rows.find(x=>x.product==='MonthlyColour UV - Blue');console.log('Blue:',r)})
   ```
   If DB has it right, UI is stale. If DB is wrong, continue.

3. **Confirm salesdashboard API returns the right value:**
   ```sh
   curl -s -H "X-API-Key: $KEY" "https://sales.seedclmalaysiastore.com/api/hq-summary?year=2026" | jq '.products["MONTHLY COLOR UV - BLUE"]'
   ```
   If API is wrong, the fix is on salesdashboard (new POS brand → product mapping needed in `src/lib/reportProducts.js` on the salesreport repo). If API is right but DB is wrong, continue.

4. **Click Repair chain** on gmdashboard. Modal shows per-month notes. Look for `HQ Summary override — X: qty A→B` lines. If no such line fires for the problem row, check:
   - Is the ref being loaded? Run the diagnostic fetch:
     ```js
     fetch('/api/months/repair',{method:'POST'}).then(r=>r.json()).then(j=>console.log(j.summaryRefs))
     ```
     Should show one `source: "salesdashboard-api"` entry per year. If missing, env vars broken or deploy stale.
   - Is Vercel runtime erroring? Check logs:
     ```
     mcp__fe3e9cdf-bbff-41f4-84d0-e5c20c584f31__get_runtime_logs
     ```

### Symptom: PPTX Slide 11 (Expire Write-Off) is cramped / wrapping

Both exports (`modern.ts` and `classic.ts`) need explicit `colW` on the `addTable` call or pptxgenjs auto-divides columns equally and the product name column gets a tiny slice. The fix pattern is:
- Product column fixed at 1.7"
- Data columns split evenly across remaining width
- Font steps down at 14+ / 18+ data columns

Already implemented. Same pattern would apply if any other slide's table gets cramped with more months.

### Symptom: Zod error on upsert ("expected integer, received float")

Something is handing `salesByQuantity.rows[i].qty2026` or `qty2025` as a float. salesdashboard API rounds to 2 decimals (trial-lens divisions). Every ref-qty assignment MUST `Math.round()` before writing. If you add a new place that writes qty, round it.

Spots that currently round correctly:
- `salesdashboard-client.ts` `padTo12` (also hosts the **empty-month pass** — nulls out months where every product is 0/0, so Repair doesn't wipe the in-flight month; see symptom below)
- `applyYear2025ToReport` prior-year branch
- `applyHqCustomerSplitRows`
- `autoFixDriftFromSummary`

### Symptom: HQ Summary override zeroes out a correct master value

Check `applyHqCustomerSplitRows` in `src/lib/parsers/year-2025.ts`. The rule: if `series[monthIdx] == null`, LEAVE the master value alone. Never default null→0 (that silently blanks out correct master values when Summary cells are empty for a month).

### Symptom: Owner provides a per-row HQ-vs-GM-Dashboard comparison showing small drifts (±1 to ±10) on several rows for the current month, no HQ Summary workbook for this year is on file

This is the expected steady state until the owner uploads the month's `SEED(M) Sales Summary <Month>_<Year>.xlsx` to gmdashboard. Without a current-year Summary workbook (`gm."RawFile"` row with `kind='ref_2025'` whose title parses as year=N), the HQ override has no data to apply for N's months — the live salesdashboard API covers earlier months but returns all-zero for the in-flight month (empty-month pass null-promotes it), so Slide 5 / Slide 6 for that month shows raw master values, which drift from HQ by SKU-splitting rounding (trial lens packs, MC colour splits, BoC customer split, Wohlk collapse).

Check with SQL:

```sql
SELECT id, "originalName", "monthReportId", "createdAt"
FROM gm."RawFile"
WHERE kind='ref_2025' AND "deletedAt" IS NULL
ORDER BY "createdAt" DESC;
```

If the newest row is still last year's Dec file, that's the cause. Fix: have the owner upload `SEED(M) Sales Summary <Month>_<Year>.xlsx` via the POS files UI (year+month+file) — or do it programmatically from a known-good source via `POST /api/import` with `year`, `month`, and the xlsx `files` field — and then click Repair chain. applyHqCustomerSplitRows will then override every HQ-owned row for every month the Summary has data for.

If the owner only gave you a HQ-vs-GM comparison file (with an extra "GM Dashboard" column stuffed into the NOV position next to HQ Oct), do NOT upload it as-is: the parser reads columns B..M, so the NOV column's comparison annotations would get planted as fake NOV values. Rebuild the sheet first — keep A (product), B..K (Jan..Oct), clear L..M (Nov..Dec).

### Symptom: Repair wipes Slide 5 + Slide 6 to zero for the in-flight month

This is the killer scenario. The owner uploads the October POS master on gmdashboard (slide 5/6 fill correctly from `parseMasterXlsx`), clicks Repair chain, and **every row drops to 0** — repair notes show a wall of `HQ Summary override — <product>: qty X→0`.

Cause: salesdashboard returns `qty: 0, amount: 0` for every product in months where no Stock-Detail file has been uploaded there yet. Preserving those as real zeros makes `applyHqCustomerSplitRows` override the master values down to 0.

Fix lives in `src/lib/salesdashboard-client.ts`'s **empty-month pass** (added 2026-11-25, commit `fe87cf6`). After building `productQty` / `productAmount`, it scans each month slot; if **every** tracked product has `0` qty AND `0` MYR for that slot, it promotes the whole month to `null` for every product. The override then skips it and the master value stands.

Do not weaken or remove that pass. The heuristic is safe because a genuine sales month never has literally every product at 0 qty AND 0 MYR — a few always sell. If you add a new product category to the API, this pass keeps working automatically.

Verification: re-run Repair; `octNotes` should no longer include any `HQ Summary override — … → 0` lines, and the only remaining notes are "Rebuilt Slide 5 + Slide 6 from stored master" and "2025 comparison columns filled from Sales Summary reference".

### Symptom: Wohlk Contact Life Sph / Toric still drifts after a Summary upload

HQ's Summary workbook now splits Wohlk into three rows (`WOHLK KE RGP`, `WOHLK CONTACT LIFE SPH`, `WOHLK CONTACT LIFE TORIC`), but the parser's `NAME_MAP` and the live API's `API_NAME_MAP` only knew about KE RGP historically — the Sph / Toric rows parsed off the sheet dropped on the floor because no CanonicalProduct mapping existed. Both maps now include all three Wohlk variants (commit `56aac91`).

If HQ ever adds a NEW product row that the dashboard already has a canonical row for (e.g. a split of an existing combined row), add it to **both** `NAME_MAP` in `src/lib/parsers/year-2025.ts` AND `API_NAME_MAP` in `src/lib/salesdashboard-client.ts`. The canonical name on the right must match an entry in `CANONICAL_PRODUCTS` exactly. Then click Repair.

### Symptom: Wohlk double-counts

salesdashboard rolls all Wohlk sales into one "Wohlk KE RGP" row; gmdashboard has three canonical rows (Sph / Toric / KE). The `salesdashboard-client.ts` COLLAPSES Sph and Toric to zero for every month the API returns Wohlk KE RGP data. Don't undo this. If you add another product that salesdashboard combines but gmdashboard splits, add the same collapse pattern.

### Symptom: A new POS code appears in the unmapped drawer

Add to `SKU_LEVEL_MAP` in `src/lib/catalog/sku-map.ts` with the correct canonical product and divisor. Trial-lens codes (`*T`, `*TR`) divide by pack size; FOC codes (`*FC`) count at full qty; sample codes (various `SD*S` DISOP suffixes) have product-specific rules documented in the memory files. Then click Repair chain — re-parses every stored master through the updated catalog.

### Symptom: "salesdashboard API returned 401 from Supabase"

`SUPABASE_SERVICE_ROLE_KEY` isn't set on salesdashboard, or was rotated. Get the current value from Supabase dashboard → Settings → API → "service_role secret", set it on salesdashboard via Vercel. Then trigger a redeploy (empty commit works).

## Memory files already written

Durable project memory in `.claude/projects/C--Users-Expert-GM-report-dashboard/memory/`:

- `monthlycolour-box-mapping.md` — MC shade → colour box (Blue/Orange/Pegavision/II)
- `disop-mapping-inferred.md` — DISOP SKU split incl. SDDSPVS ÷20
- `boc-overseas-glodisa.md` — BoC domestic/overseas customer split (GLODISA only)
- `wohlk-single-lens-trials.md` — WHCLST/WHCLAT count full qty, not ÷pack
- `mcuv-colour-split-from-summary.md` — Summary overrides MC colours on group-level master
- `hq-api-empty-month-null.md` — API returns 0 for every product in unseeded months; client null-promotes

Read these before touching catalog code — they capture owner decisions that aren't obvious from the data.

## The owner's workflow going forward

1. Upload Stock-Detail file to salesdashboard (as they already do for sales analytics)
2. Click Repair chain on gmdashboard (home page OR the button in every slide's top-right header)
3. Done — every Slide 5/6 row lands at the live salesdashboard value, YoY columns fill from salesdashboard's 2025 history, no HQ Summary workbook upload needed

## Fixing: write the change, commit with the attribution line, push to main

Standing rule per `CLAUDE.md`: auto-commit and push to `main` (no PR branch). Commits end with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`. Vercel auto-deploys from main — wait ~90s then test.
