import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MONTH_NAMES = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"] as const;

export function monthNameFull(m: number): string {
  return ["January","February","March","April","May","June","July","August","September","October","November","December"][m - 1] ?? "";
}

export function monthId(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthId(id: string): { year: number; month: number } {
  const [y, m] = id.split("-").map(Number);
  return { year: y, month: m };
}

export function fmtMYR(n: number | null | undefined, digits = 0) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-MY", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtJPY(n: number | null | undefined) {
  if (n == null || isNaN(n)) return "—";
  return "¥" + Math.round(n).toLocaleString("en-US");
}

export function fmtPct(n: number | null | undefined, digits = 0) {
  if (n == null || isNaN(n)) return "—";
  return (n * 100).toFixed(digits) + "%";
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
