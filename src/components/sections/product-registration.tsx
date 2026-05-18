"use client";
import type { SectionProps } from "../report-editor";
import { SectionShell, Table, Td, Th, TextCell, CommentEditor } from "./shared";

const EMPTY = { product: "", class: "", startDate: "", docOverseas: "", cabAssessment: "", mdaSubmission: "", mdaProcess: "", completionDate: "", mdaApprovalNo: "", category: "new" as const, notes: "" };

export function SectionProductRegistration({ report, update }: SectionProps) {
  const rows = report.productRegistration?.rows ?? [];
  const commentary = report.productRegistration?.commentary ?? "";
  const set = (next: typeof rows) => update({ productRegistration: { rows: next, commentary } });
  const setCommentary = (html: string) => update({ productRegistration: { rows, commentary: html } });
  return (
    <SectionShell sectionKey="productRegistration" subtitle="Slide 11 — MDA pipeline tracker. Rows accumulate across months — edit or add as status changes." isMissing={!report.productRegistration || report.productRegistration.rows.length === 0}>
      <Table>
        <thead>
          <tr>
            <Th>Product</Th><Th>Class</Th><Th>Start</Th><Th>Doc Overseas</Th><Th>CAB</Th><Th>MDA Sub</Th><Th>MDA Proc</Th><Th>Completion</Th><Th>Approval No</Th><Th></Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const upd = (patch: Partial<typeof r>) => { const n = [...rows]; n[i] = { ...r, ...patch }; set(n); };
            return (
              <tr key={i}>
                {(["product","class","startDate","docOverseas","cabAssessment","mdaSubmission","mdaProcess","completionDate","mdaApprovalNo"] as const).map(k => (
                  <Td key={k}><TextCell value={r[k]} onChange={v => upd({ [k]: v } as Partial<typeof r>)} /></Td>
                ))}
                <Td><button onClick={() => set(rows.filter((_, j) => j !== i))} className="text-xs text-red-600">×</button></Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <button onClick={() => set([...rows, { ...EMPTY }])} className="mt-3 text-sm text-[var(--color-ink-800)] underline">+ Add row</button>

      <CommentEditor
        variant="rich"
        value={commentary}
        onSave={setCommentary}
        placeholder="Notes on the MDA pipeline — delays, next steps, approvals expected…"
      />
    </SectionShell>
  );
}
