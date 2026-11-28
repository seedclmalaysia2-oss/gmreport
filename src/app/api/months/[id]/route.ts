import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getMonthReportById, softDeleteMonthReport, upsertMonthReport } from "@/lib/month-report";
import { parseMonthId } from "@/lib/utils";

import { guardDept } from "@/lib/auth";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardDept();
  if (denied) return denied;

  const { id } = await params;
  const report = await getMonthReportById(id);
  if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(report);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardDept();
  if (denied) return denied;

  const { id } = await params;
  const { year, month } = parseMonthId(id);
  const body = await req.json();
  const report = await upsertMonthReport({ ...body, year, month });
  return NextResponse.json(report);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardDept();
  if (denied) return denied;

  const { id } = await params;
  // Soft-delete — see /api/months (plural) for the reasoning. The month
  // reappears in "Recently deleted months" until Restored or Purged.
  await softDeleteMonthReport(id);
  revalidatePath("/");
  revalidatePath("/files");
  revalidatePath("/export");
  return NextResponse.json({ ok: true });
}
