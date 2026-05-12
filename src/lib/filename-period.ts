// Detect "what month is this file for?" from a POS file's name. Used by the
// upload form to auto-target the right month/year — without this, the form
// defaults to today's calendar month and people upload e.g. April files
// into a freshly-created May month by accident.
//
// Patterns supported, in priority order:
//   1. "Mar26" / "Mar 26"             — POS Mac-folder naming style
//   2. "DD.MM.YYYY" / "DD-MM-YYYY"    — SCLM Stock List dated naming
//   3. "March 2026" / "MARCH 2026"    — long-form month name + year
//   4. "01/04/2026 To 30/04/2026"     — date range (matches the period
//                                       string we sometimes see embedded
//                                       in renamed PDFs)
//
// Returns null if no hint can be found — caller should fall back to today.

const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export function detectPeriod(filename: string): { year: number; month: number } | null {
  // "Mar26" — three-letter month immediately followed by 2-digit year. We
  // anchor with a word boundary to avoid grabbing "Mar" out of "marketing".
  let m = filename.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(\d{2})\b/i);
  if (m) {
    return { year: 2000 + Number(m[2]), month: MONTH_ABBR[m[1].toLowerCase()] };
  }

  // "31.03.2026" / "31-03-2026" / "31/03/2026" — DAY.MONTH.YEAR with a
  // 4-digit year. Stock List uses dots; we accept the common separators.
  m = filename.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d{2})/);
  if (m) {
    const day = Number(m[1]);
    const mo  = Number(m[2]);
    const yr  = Number(m[3]);
    if (day >= 1 && day <= 31 && mo >= 1 && mo <= 12) {
      return { year: yr, month: mo };
    }
  }

  // "March 2026" — long-form English month + 4-digit year.
  m = filename.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/i);
  if (m) {
    return { year: Number(m[2]), month: MONTH_ABBR[m[1].slice(0, 3).toLowerCase()] };
  }

  return null;
}
