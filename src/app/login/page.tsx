"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      router.replace(sp.get("next") || "/");
    } else {
      setErr("Wrong password");
    }
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
