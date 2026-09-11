import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * POST /api/auth/logout
 *
 * Ends the Supabase session and clears its cookies. POST (not GET) so a stray
 * link prefetch can't sign the user out by accident.
 *
 * Note this signs the person out of every SEED CL department dashboard, not
 * just this one — the session is shared.
 */
export async function POST() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
