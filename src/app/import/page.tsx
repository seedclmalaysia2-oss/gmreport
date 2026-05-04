import { redirect } from "next/navigation";

/**
 * /import is now a thin alias for /files — they used to be two separate
 * pages (one for uploading, one for listing). Users found it confusing
 * (looked like a "duplicate process of uploading") so we merged the upload
 * form INTO /files. We keep /import responding so existing links + the
 * import-from-section deep-links from the editor (e.g. ?section=salesByECP)
 * keep working — we just preserve query params and bounce to /files.
 */
export default async function ImportRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach(x => qs.append(k, x));
    else qs.set(k, v);
  }
  const tail = qs.toString();
  redirect(`/files${tail ? `?${tail}` : ""}`);
}
