import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Use Node runtime — we deal with binary Buffers, which are awkward in Edge.
export const runtime = "nodejs";

function mimeFor(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "xls")  return "application/vnd.ms-excel";
  return "application/octet-stream";
}

/**
 * GET /api/files/{id}?disposition=inline|attachment
 *
 * Streams the stored RawFile bytes back to the browser. The default
 * disposition is `attachment` (forces download); the Files UI sets
 * `?disposition=inline` for the View button so PDFs open in the browser
 * tab instead of being downloaded.
 *
 * Falls back to 410 Gone for legacy rows that were inserted before we
 * started storing bytes — the UI hides the actions in that case anyway.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await prisma.rawFile.findUnique({
    where: { id },
    select: { originalName: true, bytes: true },
  });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!row.bytes) {
    return NextResponse.json(
      { error: "file content not stored — re-upload to enable download" },
      { status: 410 },
    );
  }

  const url = new URL(req.url);
  const disposition = url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  // Encode the filename so non-ASCII (e.g. Mar26 reports w/ accented chars)
  // doesn't break the Content-Disposition header.
  const safeName = row.originalName.replace(/[\r\n"]/g, "_");
  const encodedName = encodeURIComponent(row.originalName);

  // Prisma's Bytes type comes back as a Uint8Array in serverless — wrapping
  // in Buffer is a zero-copy operation that gives us a stable response body.
  const body = Buffer.from(row.bytes);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": mimeFor(row.originalName),
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

/**
 * DELETE /api/files/{id}                  -> soft delete (moves to trash)
 * DELETE /api/files/{id}?purge=1          -> hard delete (permanent)
 *
 * Soft delete: sets RawFile.deletedAt = now(). The row is still in the
 * database, just hidden from the active list and surfaced under the
 * "Recently deleted" section of the Files page so it can be restored.
 *
 * Hard delete is used for two cases:
 *   - The user clicks "Delete forever" on a row that's already in trash
 *   - The Update flow replaces an audit row with a freshly-imported one
 *     (no point keeping the old version around in the trash)
 *
 * Neither flavour rolls back the slide numbers the file produced. The UI
 * makes that explicit in its confirmations.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const purge = new URL(req.url).searchParams.get("purge") === "1";

  if (purge) {
    await prisma.rawFile.delete({ where: { id } }).catch(() => {});
  } else {
    await prisma.rawFile
      .update({ where: { id }, data: { deletedAt: new Date() } })
      .catch(() => {});
  }
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/files/{id}/restore
 *
 * Clears the deletedAt tombstone so the file reappears in the active
 * list. We expose this as a POST under the same /api/files/{id} route
 * (next route segment) — see /restore/route.ts for the actual handler.
 * Keeping the wrapper here just to consolidate documentation in one spot.
 */
