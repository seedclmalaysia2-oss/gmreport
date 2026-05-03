import { generateText } from "ai";
import type { OutlookFacts } from "../aggregation/outlook-facts";

const SYSTEM_PROMPT = `You are the Malaysian General Manager writing a short Market Outlook slide for Japanese HQ in Tokyo.

Rules:
- Ground every number in the provided fact sheet. Do not invent figures.
- Tone: confident, measured, factual. Avoid hype. Think senior-executive-reporting-to-board.
- Length: 2 to 3 short paragraphs, ~70-110 words total.
- Output ONLY raw HTML using just these tags: <p>, <strong>, <em>. No other tags, no markdown, no headings, no lists, no inline styles.
- Open with a one-sentence performance summary (attainment vs target, YoY).
- Mention the top contributor or the biggest risk if the facts surface one.
- Close with a forward-looking sentence on outlook for the coming month.
- If a fact is null/missing, skip it silently. Do not write "data unavailable".
- Wrap key numbers (MYR amounts, percentages) in <strong>.`;

const ALLOWED_TAG = /^<\/?(p|strong|em|br)\s*\/?>$/i;

function sanitizeHtml(html: string): string {
  const trimmed = html.trim();
  // Drop any tag that isn't in the allow-list.
  return trimmed.replace(/<[^>]+>/g, tag => (ALLOWED_TAG.test(tag) ? tag : ""));
}

export async function generateOutlookHtml(facts: OutlookFacts): Promise<string> {
  const result = await generateText({
    model: "anthropic/claude-sonnet-4-6",
    temperature: 0.4,
    system: SYSTEM_PROMPT,
    prompt:
      `Fact sheet for ${facts.monthLabel}:\n\n` +
      JSON.stringify(facts, null, 2) +
      `\n\nWrite the Market Outlook slide body now. HTML only.`,
  });

  const cleaned = sanitizeHtml(result.text);
  // Ensure at least one <p> wrapper so the RichTextEditor renders paragraphs correctly.
  if (!/^<p[>\s]/i.test(cleaned)) return `<p>${cleaned}</p>`;
  return cleaned;
}
