import crypto from "crypto";

function base64UrlEncode(input: Buffer | string) {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLen);
  return Buffer.from(padded, "base64");
}

function timingSafeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export type ClientLeadTokenPayload = {
  lead_id: string;
  exp: number; // unix seconds
};

export function signClientLeadToken(payload: ClientLeadTokenPayload, secret: string) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64");
  const sigUrl = sig.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${body}.${sigUrl}`;
}

export function verifyClientLeadToken(token: string, secret: string): ClientLeadTokenPayload | null {
  const raw = String(token ?? "");
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (!timingSafeEqual(sig, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(body).toString("utf-8")) as ClientLeadTokenPayload;
    if (!payload?.lead_id || !payload?.exp) return null;
    if (typeof payload.lead_id !== "string") return null;
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}
