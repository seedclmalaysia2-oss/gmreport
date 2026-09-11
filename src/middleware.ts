import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";

// /api/keepalive is the Vercel Cron DB-warm ping — it must run without a
// session, so it stays public (it only executes SELECT 1; see the route).
const PUBLIC_PATHS = ["/login", "/auth", "/api/keepalive", "/_next", "/favicon", "/brand"];

/**
 * Two jobs, in this order:
 *   1. Refresh the Supabase session cookie so it doesn't expire mid-session.
 *   2. Bounce signed-out visitors to /login.
 *
 * It deliberately does NOT check department membership. That check needs the
 * database, and middleware runs on the edge on every request — so it lives in
 * `requireDept()`, called by each page and API route. Middleware here is a
 * convenience redirect, never the security boundary.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip auth entirely in dev.
  if (process.env.NODE_ENV === "development") return NextResponse.next();

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

  let res = NextResponse.next({ request: req });

  // Annotated for the same reason as in src/lib/supabase/server.ts.
  const cookieMethods: CookieMethodsServer = {
    getAll: () => req.cookies.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
      res = NextResponse.next({ request: req });
      cookiesToSet.forEach(({ name, value, options }) =>
        res.cookies.set(name, value, options),
      );
    },
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieMethods },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user) return res;

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand).*)"],
};
