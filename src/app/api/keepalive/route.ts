import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel Cron pings this once a day (see vercel.json) to run a trivial query,
// which keeps the Supabase project from auto-pausing after ~7 days of
// inactivity on the free tier. It runs INSIDE Vercel, which has the app's
// DATABASE_URL and direct network access to Supabase — unlike an external cloud
// agent, whose egress proxy blocked it. Kept public in middleware.
//
// If a CRON_SECRET env var is configured, Vercel adds it as a Bearer token and
// we require it; with no secret set the endpoint stays open (it only runs
// SELECT 1, so there is nothing sensitive to protect and the ping still works
// zero-config).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
