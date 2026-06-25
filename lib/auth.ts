import { createHmac, timingSafeEqual } from "crypto";
import type { AuthRole, AuthTokenPayload } from "./auth-types";

const ADMIN_TOKEN_TTL_MS = 100 * 365 * 24 * 60 * 60 * 1000;

function getTokenSecret(): string {
  const secret =
    process.env.AUTH_TOKEN_SECRET?.trim() || process.env.ADMIN_PASSWORD?.trim();
  if (!secret) {
    throw new Error("ADMIN_PASSWORD is not configured");
  }
  return secret;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payloadStr: string): string {
  return createHmac("sha256", getTokenSecret()).update(payloadStr).digest("base64url");
}

export function createAdminAuthToken(): string {
  const now = Date.now();
  const payload: AuthTokenPayload = {
    role: "admin",
    iat: now,
    exp: now + ADMIN_TOKEN_TTL_MS,
  };
  const payloadStr = base64UrlEncode(JSON.stringify(payload));
  return `${payloadStr}.${signPayload(payloadStr)}`;
}

export function createGuestAuthToken(guestId: string, expiresAt: string | null): string {
  const now = Date.now();
  const exp = expiresAt ? new Date(expiresAt).getTime() : now + ADMIN_TOKEN_TTL_MS;
  const payload: AuthTokenPayload = {
    role: "guest",
    iat: now,
    exp,
    guestId,
  };
  const payloadStr = base64UrlEncode(JSON.stringify(payload));
  return `${payloadStr}.${signPayload(payloadStr)}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const [payloadStr, signature] = token.split(".");
    if (!payloadStr || !signature) return null;

    const expected = signPayload(payloadStr);
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadStr)) as AuthTokenPayload;
    if (!payload.role || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getAdminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD?.trim();
  return password || null;
}

export function isAdminPassword(input: string): boolean {
  const adminPassword = getAdminPassword();
  if (!adminPassword) return false;

  const a = Buffer.from(input.trim());
  const b = Buffer.from(adminPassword);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export function requireAdminFromRequest(request: Request): AuthTokenPayload | null {
  const token = extractBearerToken(request);
  if (!token) return null;
  const payload = verifyAuthToken(token);
  if (!payload || payload.role !== "admin") return null;
  return payload;
}
