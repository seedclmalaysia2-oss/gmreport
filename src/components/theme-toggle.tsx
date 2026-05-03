"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem("gm-theme") as Theme | null) ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    apply(saved);
    setTheme(saved);
    setMounted(true);
  }, []);

  function apply(next: Theme) {
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("gm-theme", next);
  }

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
  }

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
      className="rounded-md p-2 hover:bg-[var(--color-ice-100)] text-[var(--color-ink-800)] transition-colors"
    >
      {/* Render both icons; inline script toggles `html.dark` before hydration so this matches. */}
      {!mounted ? <Moon size={16} /> : theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
