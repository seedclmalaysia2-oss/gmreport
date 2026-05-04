"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FileDown, Files, Home, Menu, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { PalettePicker } from "./palette-picker";

/**
 * Top-level navigation. Layout:
 *  - phones: brand + hamburger; tap-out drawer reveals nav links + utilities
 *  - tablets and up: inline horizontal nav, palette + theme toggle on the right
 *
 * The hamburger collapses the auxiliary chrome (palette / theme / "Simon" label)
 * into the same drawer so they remain reachable even on a 360-px screen.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on every route change so it doesn't stay over the new page.
  useEffect(() => setOpen(false), [pathname]);

  // Lock body scroll while the drawer is open — keeps it feeling like a sheet.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className="border-b border-[var(--color-ice-200)] bg-[var(--surface-1)]/95 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-[1400px] px-3 sm:px-6 py-3 flex items-center gap-3 sm:gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold min-w-0">
          <span className="inline-block h-8 w-8 rounded-md bg-[var(--color-ink-800)] text-white grid place-items-center shrink-0">
            <span className="text-[11px] tracking-widest font-bold">GM</span>
          </span>
          <span className="text-[var(--color-ink-900)] font-[var(--font-display)] text-base sm:text-lg truncate">
            Malaysia Review
          </span>
        </Link>

        {/* Desktop nav (hidden on phones) */}
        <nav className="hidden md:flex items-center gap-1 text-sm ml-4">
          <NavLink href="/" icon={<Home size={15} />}>Months</NavLink>
          <NavLink href="/files" icon={<Files size={15} />}>Files</NavLink>
          <NavLink href="/export" icon={<FileDown size={15} />}>Export PPTX</NavLink>
        </nav>

        {/* Right-side utilities */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[var(--color-ink-600)] hidden lg:inline mr-1">Simon · Malaysia GM</span>
          <div className="hidden md:flex items-center gap-2">
            <PalettePicker />
            <ThemeToggle />
          </div>

          {/* Hamburger — phones only */}
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-[var(--color-ice-100)] text-[var(--color-ink-900)] active:scale-95 transition"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden absolute inset-x-0 top-full bg-[var(--surface-1)] border-t border-b border-[var(--color-ice-200)] shadow-lg animate-fadein z-30">
          <nav className="px-3 py-2 flex flex-col">
            <DrawerLink href="/" icon={<Home size={18} />}>Months</DrawerLink>
            <DrawerLink href="/files" icon={<Files size={18} />}>Files</DrawerLink>
            <DrawerLink href="/export" icon={<FileDown size={18} />}>Export PPTX</DrawerLink>
          </nav>
          <div className="px-3 py-3 border-t border-[var(--color-ice-200)] flex items-center justify-between">
            <span className="text-xs text-[var(--color-ink-600)]">Simon · Malaysia GM</span>
            <div className="flex items-center gap-2">
              <PalettePicker />
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
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

function DrawerLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  // Bigger tap target than NavLink — 44px height satisfies WCAG 2.5.5 / Android touch guidelines.
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 h-11 text-[15px] font-medium text-[var(--color-ink-900)] hover:bg-[var(--color-ice-100)] active:bg-[var(--color-ice-100)]"
    >
      <span className="text-[var(--color-ink-700)]">{icon}</span>
      {children}
    </Link>
  );
}
