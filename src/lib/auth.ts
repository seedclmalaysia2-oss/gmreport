// Edge-compatible password-gate helpers (Web Crypto only — no node:crypto).
export const AUTH_COOKIE = "gm_dash_auth";

function secret(): string {
  return process.env.AUTH_COOKIE_SECRET || "dev-only-fallback";
}

async function hmacHex(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function signToken(payload: string): Promise<string> {
  return `${payload}.${await hmacHex(payload)}`;
}

export async function verifyToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const idx = token.lastIndexOf(".");
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = await hmacHex(payload);
  // Constant-time-ish compare
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
