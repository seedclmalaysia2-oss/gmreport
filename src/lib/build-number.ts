// The running build number shown under "Malaysia Review" in the top bar (2026-11-13).
// Vercel builds without the git history, so the number can't be counted from commits at build time.
// Instead each live (production) deployment takes the next number the first time a page is opened,
// kept in the shared table public.app_build (app 'gmreport', one row per commit), so every later
// page view and every server instance agrees. Preview deployments and the dev server take no number.
// Raw SQL on purpose: Prisma's schema covers "gm" only, and public.app_build is shared by the sibling apps.
import { prisma } from "@/lib/db";

/** Builds before this scheme started: the 141 commits on main on 13 Nov 2026. The first live build is 142. */
const BEFORE = 141;

const APP = "gmreport";
const SHA = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
const LIVE = process.env.VERCEL_ENV === "production";

/** The month the build went live (YYYYMM, Malaysia time) and its number. */
export type Build = { month: string; n: number };

/** How the top bar writes it: "202611 build 00142". */
export const buildLabel = (b: Build | null) =>
  b ? `${b.month} build ${String(b.n).padStart(5, "0")}` : "test build";

let cached: Promise<Build | null> | null = null;

/** This deployment's build, or null when it isn't the live site (or the lookup failed; retried next request). */
export function buildNumber(): Promise<Build | null> {
  if (!LIVE || !SHA) return Promise.resolve(null);
  cached ??= assign().catch(() => { cached = null; return null; });
  return cached;
}

async function assign(): Promise<Build | null> {
  // Two first views at the same moment: the insert is skipped for the second, and both read the same row.
  await prisma.$executeRaw`
    INSERT INTO public.app_build (app, sha, n)
    SELECT ${APP}, ${SHA}, COALESCE(MAX(n), ${BEFORE}) + 1 FROM public.app_build WHERE app = ${APP}
    ON CONFLICT (app, sha) DO NOTHING`;
  const rows = await prisma.$queryRaw<{ n: number; went_live: Date }[]>`
    SELECT n, went_live FROM public.app_build WHERE app = ${APP} AND sha = ${SHA}`;
  const row = rows[0];
  const n = Number(row?.n);
  if (!row || !Number.isFinite(n)) throw new Error("app_build row missing");
  // went_live is set once, when the build first went live.
  const month = new Date(new Date(row.went_live).getTime() + 8 * 3600_000).toISOString().slice(0, 7).replace("-", "");
  return { month, n };
}
