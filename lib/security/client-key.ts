import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getSessionSecret } from "@/lib/auth/session";

type HeaderSource = Pick<Headers, "get">;

const networkHeaderLimit = 1024;
const rateLimitKeyLabel = "dj-vault/rate-limit-hmac-key/v1";

function getRateLimitHmacKey() {
  return createHmac("sha256", getSessionSecret())
    .update(rateLimitKeyLabel)
    .digest();
}

function hashRateLimitSubject(kind: "email" | "network", value: string) {
  return `hmac:${kind}:${createHmac("sha256", getRateLimitHmacKey())
    .update(`${kind}\0${value}`)
    .digest("hex")}`;
}

function firstValidIp(value?: string | null) {
  if (!value) {
    return null;
  }

  for (const candidate of value.slice(0, networkHeaderLimit).split(",")) {
    const ip = candidate.trim();
    if (isIP(ip)) {
      return ip;
    }
  }

  return null;
}

export function createEmailRateLimitSubject(email: string) {
  return hashRateLimitSubject("email", email.trim().toLowerCase());
}

export function getNetworkRateLimitSubject(headers: HeaderSource) {
  const ip =
    firstValidIp(headers.get("x-forwarded-for")) ??
    firstValidIp(headers.get("x-real-ip")) ??
    "unknown";

  return hashRateLimitSubject("network", ip);
}

export async function getServerActionNetworkRateLimitSubject() {
  try {
    const { headers } = await import("next/headers");
    return getNetworkRateLimitSubject(await headers());
  } catch {
    return getNetworkRateLimitSubject(new Headers());
  }
}
