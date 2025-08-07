/**
 * Shared helpers for Edge Function (Deno) runtime (calcom-booking)
 */

// Declare Deno for type-checkers outside Deno env
declare const Deno: {
  env: { get: (k: string) => string | undefined };
};

export function getEnvOrThrow(key: string): string {
  const v = Deno?.env?.get?.(key);
  if (!v || v.length === 0) {
    throw new Error(`Missing env: ${key}`);
  }
  return v;
}

export async function parseJson(req: Request): Promise<{ raw: string; json: any }> {
  const raw = await req.text();
  let json: any;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("Invalid JSON");
  }
  return { raw, json };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

/**
 * Verify HMAC-SHA256 signature from header: "sha256=HEX"
 */
export async function verifyHmacSignature(raw: string, signatureHeader: string, secret: string): Promise<boolean> {
  try {
    if (!secret) return false;
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

    const providedHex = signatureHeader.substring("sha256=".length).trim().toLowerCase();
    const algo = { name: "HMAC", hash: "SHA-256" } as const;

    const enc = new TextEncoder();
    const keyData = enc.encode(secret);
    const key = await crypto.subtle.importKey("raw", keyData, algo, false, ["sign"]);
    const sig = await crypto.subtle.sign(algo, key, enc.encode(raw));
    const digestHex = bufferToHex(new Uint8Array(sig));

    return constantTimeEqual(enc.encode(providedHex), enc.encode(digestHex));
  } catch {
    return false;
  }
}

export function getIdempotencyKey(headers: Headers, fallback?: string | null): string | null {
  return headers.get("Idempotency-Key") || (fallback ?? null);
}

function bufferToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
