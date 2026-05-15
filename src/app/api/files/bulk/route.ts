import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/files/bulk
 *
 * Bulk action over multiple RawFile rows in one round-trip. Used by the
 * Files page "Recently deleted" table to purge or restore many rows at
 * once instead of one DELETE per row.
 *
 * Body:
 *   { ids: string[], action: "purge" | "restore" }
 *
 * - "purge"   → hard delete (DELETE FROM RawFile WHERE id IN (...))
 * - "restore" → clear deletedAt tombstone on every row
 *
 * Returns the count actually affected so the client can show a toast.
 * If any id doesn't exist Postgres just ignores it — we don't fail the
 * batch on stale ids.
 */
export async function POST(req: Request) {
  let body: { ids?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }
  const action = body.action;
  if (action !== "purge" && action !== "restore") {
    return NextResponse.json({ error: "action must be 'purge' or 'restore'" }, { status: 400 });
  }

  if (action === "purge") {
    const result = await prisma.rawFile.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ ok: true, action, affected: result.count });
  }

  // restore
  const result = await prisma.rawFile.updateMany({
    where: { id: { in: ids } },
    data: { deletedAt: null },
  });
  return NextResponse.json({ ok: true, action, affected: result.count });
}
