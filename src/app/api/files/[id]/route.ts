import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/files/{id}
 *
 * Removes a single RawFile audit-log row. Does NOT undo any slide data the
 * file may have produced — that lives in MonthReport's section JSON columns
 * and would need an explicit re-import or manual edit to revert. The Files
 * UI explains this in the confirmation dialog.
 */
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // .catch — if the row was already deleted in another tab, treat as a no-op
  // rather than 500ing on the user.
  await prisma.rawFile.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
