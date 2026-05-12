import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/files/{id}/restore
 *
 * Clears the soft-delete tombstone on a RawFile row. Idempotent — calling
 * it on a row that's already active is a no-op. Returns 200 in either
 * case so the client can fire-and-refresh without branching on status.
 */
export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.rawFile
    .update({ where: { id }, data: { deletedAt: null } })
    .catch(() => {});
  return NextResponse.json({ ok: true });
}
