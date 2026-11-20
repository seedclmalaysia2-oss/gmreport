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
- `salesdashboard-client.ts` `padTo12`
- `applyYear2025ToReport` prior-year branch
- `applyHqCustomerSplitRows`
- `autoFixDriftFromSummary`

### Symptom: HQ Summary override zeroes out a correct master value

Check `applyHqCustomerSplitRows` in `src/lib/parsers/year-2025.ts`. The rule: if `series[monthIdx] == null`, LEAVE the master value alone. Never default null→0 (that silently blanks out correct master values when Summary cells are empty for a month).

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

Read these before touching catalog code — they capture owner decisions that aren't obvious from the data.

## The owner's workflow going forward

1. Upload Stock-Detail file to salesdashboard (as they already do for sales analytics)
2. Click Repair chain on gmdashboard (home page OR the button in every slide's top-right header)
3. Done — every Slide 5/6 row lands at the live salesdashboard value, YoY columns fill from salesdashboard's 2025 history, no HQ Summary workbook upload needed

## Fixing: write the change, commit with the attribution line, push to main

Standing rule per `CLAUDE.md`: auto-commit and push to `main` (no PR branch). Commits end with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`. Vercel auto-deploys from main — wait ~90s then test.
