# Phase 2 cutover — GM dashboard onto the shared backbone

What changed in this branch, what is still manual, and how to roll back.
Companion to `SUPABASE-CONSOLIDATION.md` in the Claude project.

## Why

This dashboard had its own Supabase project (`gmreport`, Tokyo) and its own
shared password (`seed2026`). It now shares the `salesreport` project
(Singapore) as schema `gm`, and shares that project's `auth.users` with the
sales dashboard — so one sign-in works across every department dashboard.

The Free plan allows two active projects per organization, and the org was
already at the cap. Schema-per-department is what makes room for HR, Account,
Warehouse, Marketing, Customer Service and Regulatory.

## What this branch changes

| File | Change |
|---|---|
| `prisma/schema.prisma` | `multiSchema` preview feature, `schemas = ["gm"]`, `@@schema("gm")` on all three models |
| `src/lib/supabase/server.ts` | **new** — server client bound to Next's cookie store |
| `src/lib/supabase/client.ts` | **new** — browser client, sign-in only |
| `src/lib/auth.ts` | **rewritten** — `getStaff`, `hasDepartment`, `requireDept`, `guardDept`. The HMAC cookie helpers are gone |
| `src/middleware.ts` | **rewritten** — refreshes the Supabase session and redirects signed-out visitors. No longer the security boundary |
| `src/app/login/page.tsx` | **rewritten** — work email + password, forgot-password, reset, matching the sales dashboard |
| `src/app/api/auth/login/route.ts` | now returns 410 Gone |
| `src/app/api/auth/logout/route.ts` | Supabase `signOut()` instead of clearing the HMAC cookie |
| `src/app/layout.tsx` | renders `<NoAccess>` for someone signed in without the `gm` department |
| `src/components/no-access.tsx` | **new** |
| 9 × `src/app/api/**/route.ts` | `guardDept()` at the top of all 14 handlers |
| `package.json` | `@supabase/ssr`, `@supabase/supabase-js` |
| `.env.example` | new Supabase vars; password-gate vars marked retired |

## The one thing worth understanding

**Prisma connects as the service role and bypasses row level security entirely.**
The RLS policies created by `0018_gm_schema_move.sql` protect PostgREST — they do
nothing for this app. That is why every route handler calls `guardDept()` itself,
and why middleware is explicitly *not* trusted as the boundary here: Next.js
middleware has had bypass vulnerabilities (CVE-2025-29927) and this project is on
15.1.x. If you add a new API route, add the two-line guard:

```ts
const denied = await guardDept();
if (denied) return denied;
```

`/api/keepalive` is deliberately exempt — it is the Vercel cron warm ping and runs
with no session. It only executes `SELECT 1`.

## Still to do by hand

1. `pnpm install` — pulls the two new Supabase packages.
2. `pnpm prisma generate`, then `pnpm prisma migrate diff` against the new
   database. **Read the diff before running anything.** It should show no
   changes: `0018_gm_schema_move.sql` already created the tables in the shape
   this schema expects.
3. Env vars, locally and in Vercel:
   - `DATABASE_URL` / `DIRECT_URL` → the salesreport project, `?schema=gm` on both
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - delete `DASHBOARD_PASSWORD` and `AUTH_COOKIE_SECRET`
4. Grant yourself the department, or you will be locked out by your own gate:
   ```sql
   update app.staff
      set departments = array(select distinct unnest(departments || array['gm']))
    where email = 'you@example.com';
   ```
5. Set the Supabase Auth redirect allow-list to include
   `https://gmdashboard.seedclmalaysiastore.com/login`, or password-reset links
   will bounce.
6. `pnpm build` locally before deploying. The layout is now `async`, which will
   surface any page that assumed a synchronous root layout.
7. Deploy, verify on the real domain, and only then pause `gmreport`.

## Rollback

Everything here is one revert plus the old env vars. The `gmreport` project is
untouched by the migration — `0018` only reads from it — so until you pause it,
pointing `DATABASE_URL` back at Tokyo and reverting this branch restores the
previous app exactly.

## Why this wasn't pushed to main

`CLAUDE.md` says to commit and push to `main` without asking, and normally that
is what happens. Not here: `main` auto-deploys to production, and this branch
cannot work until `0017` and `0018` have been run on the database. Pushing it
first would lock every user out of the GM dashboard. Merge it after the data
move, not before.
