import { NextResponse } from "next/server";
import { getMonthReportById, upsertMonthReport } from "@/lib/month-report";
import { parseMonthId } from "@/lib/utils";
import { prisma } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getMonthReportById(id);
  if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(report);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { year, month } = parseMonthId(id);
  const body = await req.json();
  const report = await upsertMonthReport({ ...body, year, month });
  return NextResponse.json(report);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.monthReport.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
