"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

// Three phases, matching the sales dashboard so the two feel like one product:
//   "signin" – work email + password
//   "forgot" – request a reset link
//   "reset"  – set a new password after clicking that link
type Mode = "signin" | "forgot" | "reset";

function LoginForm() {
  const sp = useSearchParams();
  const supabase = supabaseBrowser();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  // Supabase sends people back here with type=recovery in the URL fragment and
  // a short-lived session already established — enough for one updateUser call.
  useEffect(() => {
    if ((window.location.hash || "").includes("type=recovery")) {
      setMode("reset");
      history.replaceState(null, "", window.location.pathname + window.location.search);
      setInfo("You clicked a reset link. Set a new password below.");
    }
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setInfo("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      setErr(error.message === "Invalid login credentials"
        ? "That email and password don't match."
        : error.message);
      return;
    }
    // Hard navigation so the browser re-issues a full GET with the fresh
    // session cookie attached, giving the middleware a clean shot at it.
    window.location.assign(sp.get("next") || "/");
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setErr("Enter the email you sign in with."); return; }
    setBusy(true); setErr(""); setInfo("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setInfo(`Reset link sent to ${email}. The link opens back here.`);
  }

  async function applyReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setErr("Those two passwords don't match."); return; }
    setBusy(true); setErr("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    window.location.assign("/");
  }

  const field = "w-full rounded-md border border-[var(--color-ice-200)] px-3 py-2";
  const submit = mode === "signin" ? signIn : mode === "forgot" ? sendReset : applyReset;

  return (
    <div className="min-h-[70vh] grid place-items-center">
      <form onSubmit={submit} className="w-[360px] rounded-2xl bg-white border border-[var(--color-ice-200)] p-6 space-y-4">
        <h1 className="font-[var(--font-display)] text-2xl font-semibold">
          {mode === "reset" ? "Set a new password" : "GM report dashboard"}
        </h1>
        <p className="text-sm text-[var(--color-ink-600)]">
          {mode === "signin" && "Sign in with your SEED CL work email — the same one you use for the sales dashboard."}
          {mode === "forgot" && "We'll email you a link to set a new password."}
          {mode === "reset" && "Pick something at least 8 characters long."}
        </p>

        {mode !== "reset" && (
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            className={field} placeholder="you@seedclmalaysia.com" autoComplete="username" autoFocus
          />
        )}

        {mode === "signin" && (
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            className={field} placeholder="Password" autoComplete="current-password"
          />
        )}

        {mode === "reset" && (
          <>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className={field} placeholder="New password" autoComplete="new-password" autoFocus
            />
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              className={field} placeholder="Repeat new password" autoComplete="new-password"
            />
          </>
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}
        {info && <p className="text-sm text-[var(--color-ink-600)]">{info}</p>}

        <button
          disabled={busy}
          className="w-full rounded-md bg-[var(--color-ink-800)] text-white px-3 py-2 font-semibold disabled:opacity-60"
        >
          {busy ? "Working…" : mode === "signin" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Save password"}
        </button>

        {mode === "signin" && (
          <button type="button" onClick={() => { setMode("forgot"); setErr(""); setInfo(""); }}
            className="w-full text-sm text-[var(--color-ink-600)] underline underline-offset-2">
            Forgot your password?
          </button>
        )}
        {mode === "forgot" && (
          <button type="button" onClick={() => { setMode("signin"); setErr(""); setInfo(""); }}
            className="w-full text-sm text-[var(--color-ink-600)] underline underline-offset-2">
            Back to sign in
          </button>
        )}
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-[var(--color-ink-600)]">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
