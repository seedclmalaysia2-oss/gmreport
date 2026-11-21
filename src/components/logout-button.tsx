"use client";
import { LogOut } from "lucide-react";
import { useState } from "react";

/**
 * Two visual variants of the same logout action:
 *
 *   icon   — compact icon-only button for the desktop top bar, sits next to
 *            ThemeToggle/PalettePicker
 *   drawer — full-width row for the mobile slide-out drawer, with label
 *   exit   — the SEED top bar's exit icon, the very last item at the right end (`.tb-exit`)
 *
 * On click we POST to /api/auth/logout (which clears the signed cookie)
 * and then do a HARD navigation to /login. We intentionally avoid
 * router.push — the middleware needs to re-evaluate auth against the now-
 * empty cookie, and a soft RSC navigation occasionally races the cookie
 * delete on slow networks (same gotcha that bit the login flow earlier).
 */
export function LogoutButton({ variant = "icon" }: { variant?: "icon" | "drawer" | "exit" }) {
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      // Hard navigation — see comment above.
      window.location.assign("/login");
    }
  }

  if (variant === "exit") {
    return (
      <button type="button" onClick={logout} disabled={busy} title="Sign out" aria-label="Sign out" className="tb-exit">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
        </svg>
      </button>
    );
  }

  if (variant === "drawer") {
    return (
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="flex items-center gap-3 rounded-lg px-3 h-11 text-[15px] font-medium
                   text-red-700 hover:bg-red-50 active:bg-red-50 disabled:opacity-60
                   w-full text-left"
      >
        <LogOut size={18} className="text-red-600" />
        {busy ? "Signing out…" : "Sign out"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      title="Sign out"
      aria-label="Sign out"
      className="rounded-md p-2 text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)]
                 hover:text-red-700 transition-colors disabled:opacity-60"
    >
      <LogOut size={16} />
    </button>
  );
}
