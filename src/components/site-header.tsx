import Link from "next/link";
import { FileDown, FileUp, Files, Home } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { PalettePicker } from "./palette-picker";

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--color-ice-200)] bg-[var(--surface-1)]/90 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto max-w-[1400px] px-6 py-3 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-block h-8 w-8 rounded-md bg-[var(--color-ink-800)] text-white grid place-items-center">
            <span className="text-[11px] tracking-widest font-bold">GM</span>
          </span>
          <span className="text-[var(--color-ink-900)] font-[var(--font-display)] text-lg">Malaysia Review</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm ml-4">
          <NavLink href="/" icon={<Home size={15} />}>Months</NavLink>
          <NavLink href="/import" icon={<FileUp size={15} />}>Import POS</NavLink>
          <NavLink href="/files" icon={<Files size={15} />}>Files</NavLink>
          <NavLink href="/export" icon={<FileDown size={15} />}>Export PPTX</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[var(--color-ink-600)] hidden lg:inline mr-1">Simon • Malaysia GM</span>
          <PalettePicker />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[var(--color-ink-800)] hover:bg-[var(--color-ice-100)]"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
