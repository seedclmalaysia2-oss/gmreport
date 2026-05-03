"use client";
import type { SectionProps } from "../report-editor";
import { SectionShell } from "./shared";
import { RichTextEditor } from "../rich-text-editor";

export function SectionOtherMarket({ report, update }: SectionProps) {
  const o = report.otherMarket ?? { body: "", imagePaths: [] };
  const plain = (o.body ?? "").replace(/<[^>]*>/g, "").trim();
  return (
    <SectionShell sectionKey="otherMarket" subtitle="Slide 15 — formatted competitor intel. Use the toolbar for bold / underline / font size." isMissing={!plain && o.imagePaths.length === 0}>
      <RichTextEditor
        value={o.body}
        onChange={v => update({ otherMarket: { ...o, body: v } })}
        minHeight={320}
      />
    </SectionShell>
  );
}
