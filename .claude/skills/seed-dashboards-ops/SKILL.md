---
name: seed-dashboards-ops
description: >-
  Operational runbook for SEED Malaysia's two dashboards — the GM Report
  Dashboard (Next.js, repo gmreport) and the Sales Performance Dashboard
  (React/Vite, repo salesreport). Use when working on either app; when a
  dashboard "cannot connect" / shows a 500 / server-side exception (the
  Supabase project auto-paused); when setting up or debugging the DB
  keep-alive; when diagnosing live data by querying Supabase directly; or when
  you need the repos, URLs, Supabase project refs, deploy setup, git workflow,
  or the data-flow quirks (weekly board source file, Cust Adj reconciliation,
  daily-sales raw-net rule, SKU-level master mapping).
metadata:
  type: reference
---

# SEED dashboards — operations runbook

Two separate apps, two separate repos, two separate Supabase projects. Don't
confuse them.

## App A — GM Report Dashboard
- **Local:** `C:\Users\Expert\GM report dashboard`
- **Repo:** https://github.com/seedclmalaysia2-oss/gmreport (branch `main`)
- **Live:** https://gmdashboard-seedclmalaysia2s-projects.vercel.app (Vercel)
- **Stack:** Next.js App Router + Prisma + Supabase Postgres (pooled, port 6543).
  Pages are `force-dynamic` and query the DB on every render.
- **Supabase project ref:** `ryiosvlwepmwvredeunz` — **free tier, auto-pauses** after ~7 days idle.
- **Data model:** `MonthReport` (one row per `YYYY-MM`, section JSON blobs incl. `dailySales`) + `RawFile` (one per uploaded POS file, bytes inline). Auth is cookie-based; `src/middleware.ts` gates everything except `PUBLIC_PATHS`.
- **Git:** CLAUDE.md rule = **auto commit & push to `main`** after a code change. Stage changed files **by name** (never `git add -A`), Conventional Commits with a short "why" body, end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. The push is the merge; no PR. Never skip hooks / force-push.
- **Domain rules:** `docs/CLAUDE-RULES.md`. SKU→product mapping: `src/lib/catalog/sku-map.ts`. The specific SKU groupings live in persistent **memory files** (monthlycolour-box-mapping, disop-mapping-inferred, boc-overseas-glodisa, wohlk-single-lens-trials, mcuv-colour-split-from-summary) — read those, don't re-derive.

## App B — Sales Performance Dashboard
- **Local:** `C:\Users\Expert\OneDrive\Documents\SalesDashboard`
- **Repo:** https://github.com/seedclmalaysia2-oss/salesreport (branch `main`)
- **Live:** https://sales.seedmalaysiastore.com (Vercel)
- **Stack:** Vite + React + Supabase. Tests: `npx vitest run`. Build: `npx vite build`.
- **Supabase project ref:** `fgqiwitiqwftvfhkchpt`. `.env` holds `SUPABASE_SERVICE_ROLE_KEY` (plus `VITE_SUPABASE_*`).
- **No CLAUDE.md**, but the owner confirmed the **same auto-commit-to-`main`** workflow.
- **Key tables:** `weekly_sales`, `customers_data`, `brand_sales_data`, `sales_targets`, `data_files`.

---

## "Cannot connect" / 500 / server-side exception  →  Supabase is paused
Both DBs are free-tier and auto-pause after ~7 days idle. Signature:
`FATAL: (ENOTFOUND) tenant/user postgres.<ref> not found`, `db.<ref>.supabase.co`
→ NXDOMAIN, REST → no response. Every server-rendered page then 500s.

- **Only the owner can fix it:** app.supabase.com → the paused project → **Restore** (1–3 min). No redeploy/code change needed.
- **You can't restore it from here:** the connected Supabase MCP is a *different* account (`seed-cl-b2b-portal` / `obrimylrfsvzxybbtnod`), not these two projects.
- **Confirm it's back:** run a `tsx` script that calls `listMonthSummaries()` (App A) — if it returns the months, the DB is live.

## Keep-alive (stops it re-pausing — already shipped on App A)
- **Working approach:** a **Vercel Cron** inside the app. App A has `src/app/api/keepalive/route.ts` (runs `SELECT 1`, made public in middleware) + `vercel.json` with a daily cron. Runs on Vercel, which has `DATABASE_URL` and direct DB access.
- **Do NOT** use an external Claude cloud routine to curl the app — the routine sandbox's egress proxy **blocks the vercel.app domain (403)**, so it's a silent no-op. A now-**disabled** such routine exists: `trig_01QDyHsyGXwP4Si63i62ndnk`.
- Keep-alive only **prevents** pausing while the DB is up; it **cannot revive** an already-paused project (restore first, then it stays alive).
- **Permanent fix:** upgrade the Supabase project to **Pro** (Pro projects never auto-pause). App B has no cron keep-alive yet — add the same `/api/keepalive` + `vercel.json` pattern if it starts pausing.

## Diagnosing live data (query Supabase directly — it's the source of truth)
- **App A:** write a `scratch_*.ts` in the repo, run `node_modules/.bin/tsx scratch_*.ts`, import from `./src/lib/...` (Prisma auto-loads `.env`). Filter noise with `grep -viE "DeprecationWarning|trace-deprecation|prisma:error"`. **Delete the scratch file after.** The pooler occasionally throws a transient "Can't reach database server" — just retry once.
- **App B:** write a temp `.mjs` using `@supabase/supabase-js` + the service-role key parsed from `.env`; run with `node` from the repo. **Read-only for diagnosis;** confirm with the owner before writing to production financial tables (`weekly_sales`, `customers_data`, …).
- Don't trust the local `src/data.json` snapshot in App B — it's only an offline fallback; the live app uses Supabase.

---

## Data-flow quirks that caused real bugs (remember these)

### App A (GM)
- **Daily-sales parser** (`src/lib/parsers/pos-extra-xlsx.ts`): trial-lens SKU columns are divided by pack size. A large full-size **credit note (CN / return)** can push the divisor-adjusted daily total negative, and it was floored to 0 (missing bar). **Rule now in code:** if the adjusted daily total is ≤ 0 **but the raw net (gross sales − CN) is positive, use the raw net** — a return must never zero out a trading day.
- **Region parser** (`src/lib/parsers/pos-xlsx.ts`): the "Customer UD Group : `<STATE>`" header comes as a single cell *or* 3 cells (`"Customer UD Group"`, `":"`, `"JOHOR (STATE)"`); `matchToricPrefix` + skipping the `":"` cell fixed garbled state names. The import also refuses to overwrite Slide 8/10 when group sub-totals parse but **none map to a Malaysian region** (prevents silent zeroing).
- **SKU-level "exploded" master exports**: products arrive per shade/power/variant (e.g. `MC-NAT BROWN`, `1DPEHI/LO/MID`, toric by power/axis). Handled by `SKU_LEVEL_MAP` + `matchToricPrefix` in `sku-map.ts`, checked before the group-level suffix logic. Backward-compatible with old grouped exports.
- **Same-name re-upload supersedes** the prior `RawFile` (soft-delete), so re-importing a revised file doesn't leave a duplicate that corrupts aggregates.
- **Repair chain** (`/api/months/repair`) re-applies every on-file reference (incl. the full-year `ref_2025` Sales Summary workbook) across all months; import now also auto-re-applies the on-file 2025 reference so `qty2025` never silently resets.

### App B (Sales)
- **The Weekly board (`weekly_sales`) is fed ONLY by the "Stock Sales Analysis - Detail" (invoice-kind) file** — *not* by the "Sales Analysis by customer" file (that one feeds the customer charts). Updating the customer file will NOT move the weekly numbers; that's by design and the UI warns about it.
- `syncWeeklyFromFiles` folds **all** active invoice files via `dedupeInvoiceUnits` (newest wins *per invoice*). A same-name re-upload must supersede the old copy (`uploadFile` in `src/lib/files.js` now soft-deletes same-name actives) — otherwise an invoice removed in a revision keeps counting and the board stays stale.
- **Cust Adj**: `WeeklySalesCard` reconciles the board to the **Sales Analysis grand total** — a per-rep adjustment folded onto the **final week** of each month, computed live from `data.summary` (customers_data). Display-only; nothing is written to `weekly_sales`.

## Scheduling / routines
Use the `schedule` skill / `RemoteTrigger` tool for cloud routines — but cloud
routines **cannot reach these dashboards or their DBs** (egress-blocked, and the
Supabase MCP is scoped to a different account), so never rely on them for
keep-alive or DB pings. Keep that work inside Vercel (cron) instead.
