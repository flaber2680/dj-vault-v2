import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { promisify } from "util";
import {
  migrateLegacyAccessPlans,
  normalizeAccessPlan,
  type AccessPlan,
  type StoredAccessPlan,
} from "@/lib/access/subscription";
import { applyPaymentAccessGrant } from "@/lib/payments/access-grant";
import { createMutationQueue } from "@/lib/storage/mutation-queue";

const scryptAsync = promisify(scrypt);
const dataDirectory = path.join(process.cwd(), ".data");
const usersFile = path.join(dataDirectory, "users.json");

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

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: normalizeAccessPlan(user.plan),
    planExpiresAt: user.planExpiresAt,
    providers: user.providers,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

async function readUsers(): Promise<StoredUser[]> {
  try {
    const raw = await readFile(usersFile, "utf8");
    const storedUsers = JSON.parse(raw) as StoredUser[];
    const migration = migrateLegacyAccessPlans(storedUsers);

    if (migration.changed) {
      await writeUsers(migration.users);
    }

    return migration.users;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeUsers(users: StoredUser[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(usersFile, JSON.stringify(users, null, 2), "utf8");
}

const withUsersMutation = createMutationQueue();

async function hashPassword(password: string) {
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
  const users = await readUsers();
  const user = users.find((item) => item.id === id);

  return user ? getPublicUser(user) : null;
}

export async function getUsers() {
  const users = await readUsers();

  return users
    .map(getPublicUser)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function findUserByEmail(email: string) {
  const users = await readUsers();
  const normalizedEmail = normalizeEmail(email);

  return users.find((user) => user.email === normalizedEmail) ?? null;
}

export async function updateUserPlan(
  id: string,
  plan: TariffPlan,
  planExpiresAt?: string,
) {
  const users = await readUsers();
  const user = users.find((item) => item.id === id);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  user.plan = plan;
  user.planExpiresAt = plan === "free" ? undefined : planExpiresAt;
  user.updatedAt = new Date().toISOString();

  await writeUsers(users);

  return getPublicUser(user);
}

export async function applyPaidPaymentAccess(
  id: string,
  paymentId: string,
  durationDays: number,
  now = new Date(),
) {
  return withUsersMutation(async () => {
    const users = await readUsers();
    const user = users.find((item) => item.id === id);

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const result = applyPaymentAccessGrant(
      user,
      paymentId,
      durationDays,
      now,
    );

    if (result.activated) {
      Object.assign(user, result.record, { updatedAt: now.toISOString() });
      await writeUsers(users);
    }

    return {
      user: getPublicUser(result.record as StoredUser),
      activated: result.activated,
    };
  });
}

export async function updateUserPassword(id: string, password: string) {
  const users = await readUsers();
  const user = users.find((item) => item.id === id);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  user.passwordHash = await hashPassword(password);
  user.providers = Array.from(new Set([...user.providers, "email"]));
  user.updatedAt = new Date().toISOString();

  await writeUsers(users);

  return getPublicUser(user);
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
  const users = await readUsers();
  const normalizedEmail = normalizeEmail(email);
  const existingUser = users.find((user) => user.email === normalizedEmail);

  if (existingUser) {
    throw new Error("USER_EXISTS");
  }

  const now = new Date().toISOString();
  const user: StoredUser = {
    id: randomUUID(),
    email: normalizedEmail,
    name: name?.trim() || normalizedEmail.split("@")[0],
    plan: "free",
    providers: ["email"],
    passwordHash: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };

  users.push(user);
  await writeUsers(users);

  return getPublicUser(user);
}
