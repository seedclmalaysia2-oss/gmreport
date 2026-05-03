"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileDown, FileUp, Files, Home } from "lucide-react";

/**
 * Bottom tab bar — phones only.
 *
 * Why a tab bar in addition to the hamburger drawer?
 *   The four primary destinations (Months / Import / Files / Export) are the
 *   ones a GM hits 95% of the time. A bottom bar puts them inside the thumb
 *   reach zone (bottom 1/3 of the screen) which is the iOS HIG / Material
 *   recommendation for one-handed phone use. The hamburger stays for the
 *   secondary chrome (palette + theme + identity).
 *
 * Active state is derived from `usePathname()`. We treat "/" specially so it
 * only highlights on an exact match, not any nested route.
 */

type Tab = { href: string; label: string; Icon: typeof Home };

const TABS: Tab[] = [
  { href: "/",       label: "Months",  Icon: Home },
  { href: "/import", label: "Import",  Icon: FileUp },
  { href: "/files",  label: "Files",   Icon: Files },
  { href: "/export", label: "Export",  Icon: FileDown },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function MobileTabBar() {
  const pathname = usePathname() || "/";

  return (
    <nav
      aria-label="Primary"
      // pb-[env(...)] adds the iPhone home-indicator inset on top of base padding.
      className="md:hidden fixed inset-x-0 bottom-0 z-40
                 border-t border-[var(--color-ice-200)]
                 bg-[var(--surface-1)]/95 backdrop-blur
                 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="contents">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex flex-col items-center justify-center gap-0.5",
                  "min-h-[56px] py-1 text-[11px] font-medium",
                  "active:scale-95 transition",
                  active
                    ? "text-[var(--color-ink-800)]"
                    : "text-[var(--color-ink-600)] hover:text-[var(--color-ink-800)]",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid place-items-center h-7 w-12 rounded-full transition-colors",
                    active ? "bg-[var(--color-ice-100)]" : "",
                  ].join(" ")}
                >
                  <Icon size={20} />
                </span>
                <span className="leading-tight">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
