import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifyToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/_next", "/favicon", "/brand"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip auth entirely in dev.
  if (process.env.NODE_ENV === "development") return NextResponse.next();

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (await verifyToken(token)) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|brand).*)"],
};
