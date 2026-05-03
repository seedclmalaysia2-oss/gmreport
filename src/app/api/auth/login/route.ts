import { NextResponse } from "next/server";
import { AUTH_COOKIE, signToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));
  const expected = process.env.DASHBOARD_PASSWORD || "seed2026";
  if (password !== expected) return NextResponse.json({ ok: false }, { status: 401 });

  const token = await signToken(`${Date.now()}`);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
