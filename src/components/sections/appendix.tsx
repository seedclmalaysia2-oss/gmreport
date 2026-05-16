"use client";
import type { SectionProps } from "../report-editor";
import { SectionShell, CommentEditor } from "./shared";

/**
 * Slide 14 — Appendix.
 * A free-form rich-text reference page exported as the deck's closing slide,
 * just before Thank You. Use it for methodology notes, glossaries, or any
 * supporting detail that doesn't belong on a numbered slide.
 */
export function SectionAppendix({ report, update }: SectionProps) {
  const body = report.appendix?.body ?? "";
  // Treat tag-only HTML (e.g. "<div><br></div>") as empty for the banner.
  const plain = body.replace(/<[^>]*>/g, "").trim();

  return (
    <SectionShell
      sectionKey="appendix"
      subtitle="Slide 14 — closing reference page. Formatted notes, glossary, or methodology; exported just before the Thank You slide."
      isMissing={!plain}
    >
      <CommentEditor
        variant="rich"
        heading={null}
        className=""
        value={body}
        onSave={v => update({ appendix: { body: v } })}
        placeholder="Supporting notes, definitions, methodology…"
        minHeight={320}
      />
    </SectionShell>
  );
}
