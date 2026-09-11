// Shown when someone is signed in to SEED CL but hasn't been given the GM
// department. They are a real colleague, not an intruder — so this says who to
// ask rather than pretending the page doesn't exist.
export function NoAccess({ email }: { email: string }) {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="w-[420px] max-w-full rounded-2xl bg-white border border-[var(--color-ice-200)] p-6 space-y-3">
        <h1 className="font-[var(--font-display)] text-2xl font-semibold">No access to this dashboard</h1>
        <p className="text-sm text-[var(--color-ink-600)]">
          You're signed in as <span className="font-semibold">{email}</span>, but your account
          isn't on the GM report team yet.
        </p>
        <p className="text-sm text-[var(--color-ink-600)]">
          Ask an admin to add <span className="font-mono text-xs">gm</span> to your departments.
          Your other dashboards still work.
        </p>
        <a href="https://seedclmalaysiastore.com"
           className="inline-block rounded-md bg-[var(--color-ink-800)] text-white px-3 py-2 text-sm font-semibold">
          Back to the hub
        </a>
      </div>
    </div>
  );
}
