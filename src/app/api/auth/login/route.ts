import { NextResponse } from "next/server";

/**
 * Gone. The shared-password gate was replaced by Supabase Auth on the
 * company-wide `auth.users` table — sign-in now happens client-side on
 * /login via supabase.auth.signInWithPassword().
 *
 * Kept as a 410 rather than deleted so that a stale browser tab posting an
 * old password gets a clear answer instead of a confusing 404.
 */
export async function POST() {
  return NextResponse.json(
    { error: "The shared password has been retired. Sign in with your work email." },
    { status: 410 },
  );
}
