import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { paletteBootstrapScript } from "@/lib/themes";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        {/* Mobile-first: tighter horizontal padding on small screens, expand on tablets+. */}
        <main className="mx-auto max-w-[1400px] px-3 sm:px-6 py-4 sm:py-8 pb-[env(safe-area-inset-bottom)]">
          {children}
        </main>
      </body>
    </html>
  );
}
