import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardDept } from "@/lib/auth";
import { restoreMonthReport } from "@/lib/month-report";

/**
 * POST /api/months/{id}/restore
 *
 * Clear the soft-delete tombstone on a MonthReport row. Idempotent — calling
 * it on a row that's already active is a no-op. Mirrors the RawFile restore
 * route so the Recently-deleted sections on home and /files share the same
 * shape of fire-and-refresh client call.
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardDept();
  if (denied) return denied;

  const { id } = await params;
  await restoreMonthReport(id);
  revalidatePath("/");
  revalidatePath("/files");
  revalidatePath("/export");
  return NextResponse.json({ ok: true });
}
