"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileDown, Files, Settings } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { LogoutButton } from "./logout-button";
import { MonthsMenu } from "./months-menu";
import { RefreshButton } from "./refresh-button";

/** The parent SEED CL Malaysia hub, so this dashboard reads as a sub-app of the store. */
const HUB_URL = "https://seedclmalaysiastore.com";

/** Who is signed in, worked out on the server in the root layout. Null when signed out (/login). */
export type Who = { name: string; role: string } | null;

function initials(name: string) {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** "LOW KHUN KEONG" -> "Low Khun Keong"; a name already in mixed case is left as typed. */
function nameCase(name: string) {
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) return name;
  return name.toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase());
}

/**
 * The SEED top navigation (house standard, first built for SEED MY HR on 2026-11-21; see the HR
 * repo's seed-app-icon skill). One full-width sticky row: logo, app pill, build badge, refresh and
 * theme on the left; the app's pages and the hub link in the middle (the page you are on is the
 * filled pill); who is signed in and the exit icon at the right end. Styles: `.tb-*` in topbar.css.
 *
 * `build` is the running build label ("202611 build 00142", or "test build" off live), worked out
 * on the server by `buildNumber()` in the root layout.
 */
export function SiteHeader({ build, who }: { build: string; who: Who }) {
  const pathname = usePathname() || "/";
  const here = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="tb">
      <div className="tb-left">
        <Link className="tb-brand" href="/" aria-label="GM Report, all months">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="tb-logo" src="/brand/logo.jpg" alt="" width={64} height={36} />
        </Link>
        <span className="tb-pill">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /><path d="M8 17v-3M12 17v-6M16 17v-2" /></svg>
          GM Report
        </span>
        <span className="tb-build">{build}</span>
        <RefreshButton className="tb-icon" />
        <ThemeToggle className="tb-icon" />
      </div>

      <nav className="tb-nav" aria-label="Top bar">
        <MonthsMenu buttonClassName="tb-link" />
        <Link className="tb-link" href="/files" aria-current={here("/files") ? "page" : undefined}>
          <Files size={16} aria-hidden="true" /> Files
        </Link>
        <Link className="tb-link" href="/export" aria-current={here("/export") ? "page" : undefined}>
          <FileDown size={16} aria-hidden="true" /> Export PPTX
        </Link>
        <a className="tb-link" href={HUB_URL} title="Back to the SEED CL Malaysia hub">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
          </svg>
          SEED CL HUB
        </a>
        {/* Preferences live on /settings now; the palette picker that used to sit
            here was a daily control for a decision Simon makes once. */}
        <Link className="tb-link tb-end" href="/settings" aria-current={here("/settings") ? "page" : undefined} title="Dashboard preferences">
          <Settings size={15} aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Settings</span>
        </Link>
      </nav>

      {who && (
        <div className="tb-right">
          <div className="tb-who" aria-label="Signed in as">
            <span className="tb-avatar" aria-hidden="true">{initials(who.name)}</span>
            <span className="tb-who-text">
              <span className="tb-name" title={who.name}>{nameCase(who.name)}</span>
              <span className="tb-role">{who.role}</span>
            </span>
          </div>
          <LogoutButton variant="exit" />
        </div>
      )}
    </header>
  );
}
