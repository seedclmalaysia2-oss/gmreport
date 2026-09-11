// Department access control.
//
// Replaces the old shared-password gate (`DASHBOARD_PASSWORD` + a signed
// cookie). Identity now comes from Supabase Auth, shared across every SEED CL
// department dashboard, and access to THIS dashboard means having "gm" in your
// `app.staff.departments` array.
//
// IMPORTANT — why this file exists at all:
// Prisma connects with the service role and therefore BYPASSES row level
// security completely. The RLS policies on the `gm` schema protect PostgREST,
// not this app. So every route that touches Prisma must call `requireDept()`
// itself. Middleware alone is not sufficient: Next.js middleware has had
// bypass vulnerabilities (CVE-2025-29927) and this project is on 15.1.x.
//
// The roster is read through Prisma rather than PostgREST on purpose — that
// keeps the `app` schema out of the project's exposed-schemas list, so the
// company roster is never reachable from a browser.
import { prisma } from "@/lib/db";
import { supabaseServer } from "@/lib/supabase/server";

export const DEPARTMENT = "gm";

export type Staff = {
  user_id: string;
  email: string;
  full_name: string | null;
  departments: string[];
  is_admin: boolean;
  active: boolean;
};

/** The signed-in user's staff row, or null when signed out / not on the roster. */
export async function getStaff(): Promise<Staff | null> {
  const supabase = await supabaseServer();
  // getUser() validates the JWT against Supabase rather than trusting the
  // cookie, which is what makes this safe to authorise on.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const rows = await prisma.$queryRaw<Staff[]>`
    select user_id::text, email, full_name, departments, is_admin, active
      from app.staff
     where user_id = ${user.id}::uuid
     limit 1
  `;
  return rows[0] ?? null;
}

function allowed(staff: Staff | null, dept: string): staff is Staff {
  if (!staff || !staff.active) return false;
  return staff.is_admin || staff.departments.includes(dept);
}

/** True when the signed-in user may open this dashboard. */
export async function hasDepartment(dept: string = DEPARTMENT): Promise<boolean> {
  return allowed(await getStaff(), dept);
}

/**
 * Returns the caller's staff row, or throws `UnauthorizedError`.
 * Call this at the top of every API route handler that touches Prisma.
 */
export async function requireDept(dept: string = DEPARTMENT): Promise<Staff> {
  const staff = await getStaff();
  if (!allowed(staff, dept)) throw new UnauthorizedError();
  return staff;
}

export class UnauthorizedError extends Error {
  readonly status = 403;
  constructor() {
    super("You don't have access to the GM dashboard.");
    this.name = "UnauthorizedError";
  }
}

/** Turns an UnauthorizedError into a 403 and rethrows anything else. */
export function authErrorResponse(err: unknown): Response | null {
  if (err instanceof UnauthorizedError) {
    return Response.json({ error: err.message }, { status: 403 });
  }
  return null;
}

/**
 * One-line guard for API routes:
 *
 *   const denied = await guardDept();
 *   if (denied) return denied;
 *
 * Returns a 403 Response when the caller may not use this dashboard, or null
 * when they may. Prefer this over requireDept() inside route handlers — no
 * try/catch, and the early return reads clearly.
 */
export async function guardDept(dept: string = DEPARTMENT): Promise<Response | null> {
  if (await hasDepartment(dept)) return null;
  return Response.json(
    { error: "You don't have access to the GM dashboard." },
    { status: 403 },
  );
}
