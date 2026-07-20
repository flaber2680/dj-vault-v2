import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import {
  applyStoredAdminAccessChange,
  applyStoredPaidPaymentAccess,
  createEmailUser,
  findStoredUserByEmail,
  findStoredUserById,
  getPublicUser as toPublicUser,
  getStoredUsers,
  normalizeEmail as normalizeStoredEmail,
  registerEmailUserWithReferral as registerStoredEmailUserWithReferral,
  updateStoredUserPassword,
  updateStoredUserPlan,
} from "../database/repositories/users.ts";
import {
  type AccessPlan,
  type StoredAccessPlan,
} from "../access/subscription.ts";

const scryptAsync = promisify(scrypt);

export type AuthProvider = "email";
export type TariffPlan = AccessPlan;

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  plan?: StoredAccessPlan;
  planExpiresAt?: string;
  activatedPaymentIds?: string[];
  providers: AuthProvider[];
  passwordHash?: string;
  sessionVersion: number;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  plan: TariffPlan;
  planExpiresAt?: string;
  providers: AuthProvider[];
  avatarUrl?: string;
  createdAt: string;
};

export const MINIMUM_PASSWORD_LENGTH = 10;

export function assertPasswordPolicy(password: string): void {
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw new Error("PASSWORD_TOO_SHORT");
  }
}

export function normalizeEmail(email: string) {
  return normalizeStoredEmail(email);
}

export function getPublicUser(user: StoredUser): PublicUser {
  return toPublicUser(user);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;

  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash?: string) {
  if (!storedHash) {
    return false;
  }

  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedBuffer = Buffer.from(hash, "hex");

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, derivedKey);
}

export async function findUserById(id: string) {
  const user = findStoredUserById(id);
  return user ? getPublicUser(user) : null;
}

export async function findUserForSession(id: string) {
  const user = findStoredUserById(id);

  return user
    ? { sessionVersion: user.sessionVersion, user: getPublicUser(user) }
    : null;
}

export async function getUsers() {
  return getStoredUsers().map(getPublicUser);
}

export async function findUserByEmail(email: string) {
  return findStoredUserByEmail(email) as StoredUser | null;
}

export async function updateUserPlan(
  id: string,
  plan: TariffPlan,
  planExpiresAt?: string,
) {
  return updateStoredUserPlan(id, plan, planExpiresAt) as PublicUser;
}

export async function applyAdminAccessChange(
  id: string,
  nextPlan: TariffPlan,
  days: number,
  now = new Date(),
) {
  return applyStoredAdminAccessChange(id, nextPlan, days, now) as PublicUser;
}

export async function applyPaidPaymentAccess(
  id: string,
  paymentId: string,
  durationDays: number,
  now = new Date(),
) {
  return applyStoredPaidPaymentAccess(id, paymentId, durationDays, now) as {
    user: PublicUser;
    activated: boolean;
  };
}

export async function updateUserPassword(id: string, password: string) {
  return updateStoredUserPassword(id, await hashPassword(password)) as PublicUser;
}

export async function createUserWithEmail({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name?: string;
}) {
  return createEmailUser({
    email,
    name,
    passwordHash: await hashPassword(password),
  }) as PublicUser;
}

export async function registerEmailUserWithReferral({
  email,
  password,
  name,
  promoCode,
}: {
  email: string;
  password: string;
  name?: string;
  promoCode?: string;
}) {
  assertPasswordPolicy(password);
  return registerStoredEmailUserWithReferral({
    email,
    name,
    passwordHash: await hashPassword(password),
    promoCode,
  }) as PublicUser;
}
