import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { MobileTabBar } from "@/components/mobile-tabbar";
import { ZoomControls } from "@/components/zoom-controls";
import { paletteBootstrapScript } from "@/lib/themes";
import { DEPARTMENT, getStaff } from "@/lib/auth";
import { NoAccess } from "@/components/no-access";

export const metadata: Metadata = {
  title: "Malaysia GM Report Dashboard",
  description: "Upload POS data, edit monthly figures, export HQ-ready PPTX.",
};

// Mobile-friendly viewport — pinch-to-zoom enabled (Android + iOS),
// initial scale matches device, viewport-fit=cover for notched phones.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,           // up to 500% zoom on tap
  userScalable: true,         // explicit — accessibility win
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)",  color: "#0b0f2b" },
  ],
};

// Inline scripts run before hydration so the right theme class AND brand palette
// are applied before paint — avoids the colour flash on navigation.
const THEME_BOOTSTRAP = `
(function(){try{var t=localStorage.getItem("gm-theme")||(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");if(t==="dark")document.documentElement.classList.add("dark");}catch(e){}})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Department gate. Three cases:
  //   signed out          -> staff is null, render children (that's /login, or
  //                          the middleware has already redirected there)
  //   signed in, has gm   -> render children
  //   signed in, no gm    -> render NoAccess instead
  // This is the page-level half of the gate; API routes call requireDept()
  // themselves, because Prisma bypasses RLS.
  const staff = await getStaff();
  const locked = staff !== null && !(staff.is_admin || staff.departments.includes(DEPARTMENT));

  return (
    // `suppressHydrationWarning` is required here: the two inline scripts below
    // mutate <html> (add `.dark`, write CSS variables) before React hydrates, so
    // the client-side <html> legitimately differs from the server-rendered one.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <script dangerouslySetInnerHTML={{ __html: paletteBootstrapScript() }} />
      </head>
      <body className="min-h-screen" suppressHydrationWarning>
        <SiteHeader />
        {/* Mobile-first: tighter horizontal padding on small screens, expand on tablets+.
            Extra bottom padding on phones leaves room for the fixed MobileTabBar so the
            last cards aren't hidden behind it. md:pb-8 restores normal padding on tablets+. */}
        <main className="mx-auto max-w-[1400px] px-3 sm:px-6 py-4 sm:py-8 pb-24 md:pb-8">
          {locked ? <NoAccess email={staff!.email} /> : children}
        </main>
        {/* Phone-only bottom navigation — thumb-reach friendly. */}
        <MobileTabBar />
        {/* Phone-only floating zoom widget (+/-). Sits above the tab bar. */}
        <ZoomControls />
      </body>
    </html>
  );
}
