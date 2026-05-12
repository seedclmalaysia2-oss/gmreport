import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

/**
 * POST /api/auth/logout
 *
 * Clears the signed auth cookie. The next navigation hits the middleware
 * with no cookie and is redirected to /login. We use POST (not GET) so a
 * stray link prefetch can't sign the user out by accident.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Delete and also explicitly overwrite to a past-dated empty value — some
  // browsers cache cookies aggressively and the second header makes the
  // intent unambiguous.
  res.cookies.delete(AUTH_COOKIE);
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
