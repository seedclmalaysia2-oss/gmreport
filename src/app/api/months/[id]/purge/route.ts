import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { guardDept } from "@/lib/auth";
import { purgeMonthReport } from "@/lib/month-report";

/**
 * DELETE /api/months/{id}/purge
 *
 * Hard-delete a month row (and every RawFile under it, via onDelete: Cascade
 * in the Prisma schema). Only called from the "Delete forever" button on a
 * row in the Recently-deleted-months section of the home page, after an
 * explicit second confirmation. There is no undo past this point.
 */
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardDept();
  if (denied) return denied;

  const { id } = await params;
  await purgeMonthReport(id);
  revalidatePath("/");
  revalidatePath("/files");
  revalidatePath("/export");
  return NextResponse.json({ ok: true });
}
