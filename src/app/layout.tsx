import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { paletteBootstrapScript } from "@/lib/themes";

export const metadata: Metadata = {
  title: "Malaysia GM Report Dashboard",
  description: "Upload POS data, edit monthly figures, export HQ-ready PPTX.",
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
        <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
