"use client";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import type { SectionProps } from "../report-editor";
import { SectionShell, CommentEditor } from "./shared";
import { cn } from "@/lib/utils";

export function SectionOutlook({ report, update }: SectionProps) {
  const body = report.marketOutlook?.body ?? "";
  // Treat the body as empty when it only contains HTML tags (e.g. "<div><br></div>")
  // so the missing-data banner fires correctly after the editor has been initialised.
  const plain = body.replace(/<[^>]*>/g, "").trim();

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = Boolean(report.salesAchievement);

  async function onGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/months/${report.id}/generate-outlook`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      if (typeof data.body !== "string") throw new Error("No body in response");
      update({ marketOutlook: { body: data.body } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <SectionShell
      sectionKey="marketOutlook"
      subtitle="Slide 5 — formatted market commentary. Click Generate outlook to draft from this month's figures, then edit."
      isMissing={!plain}
    >
      <CommentEditor
        variant="rich"
        heading={null}
        className=""
        value={body}
        onSave={v => update({ marketOutlook: { body: v } })}
        placeholder="Malaysia's economy continues to show resilience…"
        minHeight={320}
        toolbar={
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <button
              type="button"
              onClick={onGenerate}
              disabled={!canGenerate || isGenerating}
              title={canGenerate ? "Draft commentary from this month's figures" : "Import POS data first"}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold border transition",
                "bg-[var(--color-ink-800)] text-white border-[var(--color-ink-800)] hover:bg-[var(--color-ink-700)]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {isGenerating ? "Generating…" : "Generate outlook"}
            </button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        }
      />
    </SectionShell>
  );
}
