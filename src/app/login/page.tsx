"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const sp = useSearchParams();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    // `credentials: "same-origin"` is the fetch default but state it explicitly
    // so we know cookies are sent on the next navigation.
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      // Use a HARD navigation (not `router.replace`) so the browser re-issues
      // a full GET with the freshly-set `gm_dash_auth` cookie attached, giving
      // the middleware a clean shot at validating it. `router.replace` does an
      // RSC fetch that occasionally races the cookie write on slow networks.
      window.location.assign(sp.get("next") || "/");
      return;
    }
    setBusy(false);
    setErr("Wrong password");
  }

  return (
    <div className="min-h-[70vh] grid place-items-center">
      <form onSubmit={submit} className="w-[360px] rounded-2xl bg-white border border-[var(--color-ice-200)] p-6 space-y-4">
        <h1 className="font-[var(--font-display)] text-2xl font-semibold">Dashboard access</h1>
        <p className="text-sm text-[var(--color-ink-600)]">Enter the shared password to continue.</p>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full rounded-md border border-[var(--color-ice-200)] px-3 py-2"
          placeholder="Password"
          autoFocus
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          disabled={busy}
          className="w-full rounded-md bg-[var(--color-ink-800)] text-white px-3 py-2 font-semibold disabled:opacity-60"
        >
          {busy ? "Checking…" : "Enter"}
        </button>
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
