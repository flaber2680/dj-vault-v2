import { createHmac, timingSafeEqual } from "crypto";
import { getSessionSecret } from "@/lib/auth/secret";
import { findUserForSession } from "@/lib/auth/store";

export { getSessionSecret } from "@/lib/auth/secret";

export const SESSION_COOKIE = "djv_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export const sessionCookieOptions = {
  httpOnly: true,
  maxAge: SESSION_MAX_AGE,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export type SessionPayload = {
  userId: string;
  sessionVersion: number;
  expiresAt: number;
};

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSessionToken(
  userId: string,
  sessionVersion: number,
  expiresAt = Date.now() + SESSION_MAX_AGE * 1000,
) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      sessionVersion,
      expiresAt,
    } satisfies SessionPayload),
  ).toString("base64url");

  return `${payload}.${signPayload(payload)}`;
}

export function verifySessionToken(token?: string) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !safeEqual(signature, signPayload(payload))) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (
      !session.userId ||
      !Number.isInteger(session.sessionVersion) ||
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const sessionUser = await findUserForSession(userId);
  if (!sessionUser) {
    throw new Error("USER_NOT_FOUND");
  }
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  cookieStore.set(
    SESSION_COOKIE,
    createSessionToken(userId, sessionUser.sessionVersion),
    sessionCookieOptions,
  );
}

export async function clearSessionCookie() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE);
}

export async function resolveSessionUser(token?: string) {
  const session = verifySessionToken(token);
  if (!session) {
    return null;
  }

  const sessionUser = await findUserForSession(session.userId);
  if (!sessionUser || sessionUser.sessionVersion !== session.sessionVersion) {
    return null;
  }

  return sessionUser.user;
}

export async function getCurrentUser() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return resolveSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
}
