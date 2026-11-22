import { NextResponse } from "next/server";
import { getStaff } from "@/lib/auth";

// The signed-in person's own name, for the welcome screen shown while the dashboard loads after sign-in
// (components/welcome-splash.tsx). Nothing about anyone else; nothing at all unless signed in and on the
// roster. Middleware lets a signed-in request through and bounces a signed-out one to /login.
export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await getStaff();
  const name = staff && staff.active ? staff.full_name?.trim() || null : null;
  return NextResponse.json({ name }, { headers: { "Cache-Control": "private, no-store" } });
}
