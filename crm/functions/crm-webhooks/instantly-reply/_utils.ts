/**
 * Shared helpers for Edge Function (Deno) runtime
 */

// Declare Deno for type-checkers outside Deno env (silences "Cannot find name 'Deno'" in editors)
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
  const raw = await req.text(); // IMPORTANT: read raw first for HMAC verification
  let json: any;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("Invalid JSON");
  }
  return { raw, json };
}

const LOG_LEVEL = (typeof Deno !== "undefined" && (Deno as any)?.env?.get?.("LOG_LEVEL")) || "info";

export function logDebug(...args: unknown[]) {
  if (LOG_LEVEL === "debug") console.log(...args);
}
export function logInfo(...args: unknown[]) {
  if (LOG_LEVEL === "debug" || LOG_LEVEL === "info") console.log(...args);
}
export function logWarn(...args: unknown[]) {
  console.warn(...args);
}
export function logError(...args: unknown[]) {
  console.error(...args);
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
 * Note: Deno/Edge uses WebCrypto (async). Return Promise<boolean>.
 */
export async function verifyHmacSignature(raw: string, signatureHeader: string, secret: string): Promise<boolean> {
  try {
    // DEV bypass: if explicitly enabled, always accept
    const DEV_SIGNATURE_BYPASS =
      (typeof Deno !== "undefined" && typeof Deno.env?.get === "function" && Deno.env.get("DEV_SIGNATURE_BYPASS") === "true");
    if (DEV_SIGNATURE_BYPASS) {
      return true;
    }

    if (!secret) return false;
    if (!signatureHeader) return false;

    const algo = { name: "HMAC", hash: "SHA-256" } as const;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), algo, false, ["sign"]);
    const sig = await crypto.subtle.sign(algo, key, enc.encode(raw));
    const digestHex = bufferToHex(new Uint8Array(sig)).toLowerCase();
    const digestBase64 = btoa(String.fromCharCode(...new Uint8Array(sig)));

    // Accept formats:
    // 1) "sha256=<hex>"
    // 2) "<hex>"
    // 3) "sha256=<base64>"
    // 4) "<base64>"
    const val = signatureHeader.trim();
    const normalized = val.startsWith("sha256=") ? val.slice(7).trim() : val;
    const provided = normalized.toLowerCase();

    const hexMatch = constantTimeEqual(enc.encode(provided), enc.encode(digestHex));
    const b64Match = provided === digestBase64.toLowerCase();

    return hexMatch || b64Match;
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

/**
 * Constant-time comparison for ASCII strings represented as Uint8Array
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
