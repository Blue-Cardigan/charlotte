import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "charlotte_admin_bypass";

export function getBypassCookieName(): string {
  return COOKIE_NAME;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createLocalBypassToken(email: string, secret: string): string {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 12;
  const payload = `${email.toLowerCase()}:${expiresAt}`;
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

export function verifyLocalBypassToken(token: string, secret: string): string | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 1) {
    return null;
  }
  const payload = token.slice(0, lastDot);
  const providedSignature = token.slice(lastDot + 1);
  if (!payload || !providedSignature) {
    return null;
  }

  const expectedSignature = sign(payload, secret);
  if (providedSignature.length !== expectedSignature.length) {
    return null;
  }
  const isValidSignature = timingSafeEqual(
    Buffer.from(providedSignature),
    Buffer.from(expectedSignature),
  );
  if (!isValidSignature) {
    return null;
  }

  const lastColon = payload.lastIndexOf(":");
  if (lastColon < 1) {
    return null;
  }
  const email = payload.slice(0, lastColon);
  const expiresAt = Number(payload.slice(lastColon + 1));
  if (!email || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return null;
  }
  return email.toLowerCase();
}

export function isLocalRequest(hostHeader?: string, originHeader?: string): boolean {
  const host = hostHeader ?? "";
  const origin = originHeader ?? "";
  return (
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1")
  );
}
