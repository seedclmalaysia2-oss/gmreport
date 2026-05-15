"use client";
import type { SectionProps } from "../report-editor";
import { SectionShell, CommentEditor } from "./shared";

export function SectionOtherMarket({ report, update }: SectionProps) {
  const o = report.otherMarket ?? { body: "", imagePaths: [] };
  const plain = (o.body ?? "").replace(/<[^>]*>/g, "").trim();
  return (
    <SectionShell sectionKey="otherMarket" subtitle="Slide 15 — formatted competitor intel. Use the toolbar for bold / underline / font size." isMissing={!plain && o.imagePaths.length === 0}>
      <CommentEditor
        variant="rich"
        heading={null}
        className=""
        value={o.body ?? ""}
        onSave={v => update({ otherMarket: { ...o, body: v } })}
        minHeight={320}
      />
    </SectionShell>
  );
}
