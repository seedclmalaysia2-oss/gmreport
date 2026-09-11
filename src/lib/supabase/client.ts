"use client";
// Browser-side Supabase client. Only ever sees the anon key, and only used for
// sign-in / sign-out on /login — every authorisation decision happens on the
// server in src/lib/auth.ts.
import { createBrowserClient } from "@supabase/ssr";

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
