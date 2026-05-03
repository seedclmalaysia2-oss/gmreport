import { NextResponse } from "next/server";
import { getMonthReportById, listMonthReports } from "@/lib/month-report";
import { generatePptx } from "@/lib/pptx";
import type { Template } from "@/lib/pptx";
import { titleFor } from "@/lib/pptx/shared";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { months: ids, template, paletteId } = (await req.json()) as {
    months: string[]; template: Template; paletteId?: string;
  };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 2) {
    return NextResponse.json({ error: "months must be 1 or 2 IDs" }, { status: 400 });
  }
  const months = [];
  for (const id of ids) {
    const m = await getMonthReportById(id);
    if (!m) return NextResponse.json({ error: `month ${id} not found` }, { status: 404 });
    months.push(m);
  }
  months.sort((a, b) => a.year - b.year || a.month - b.month);
  const context = await listMonthReports();

  const buf = await generatePptx({ months, template: template ?? "classic", context, paletteId });
  const paletteTag = paletteId && paletteId !== "midnight" ? `_${paletteId}` : "";
  const fname = `Malaysia_Review_${slugify(titleFor(months))}_${template ?? "classic"}${paletteTag}.pptx`;
  return new Response(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
