import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  normalizeAccessPlan,
  type AccessPlan,
  type StoredAccessPlan,
} from "../../access/subscription.ts";
import { applyPaymentAccessGrant } from "../../payments/access-grant.ts";
import { getRuntimeDatabase } from "../client.ts";

export type StoredUserRecord = {
  id: string;
  email: string;
  name: string;
  plan?: StoredAccessPlan;
  planExpiresAt?: string;
  activatedPaymentIds?: string[];
  providers: Array<"email">;
  passwordHash?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicUserRecord = {
  id: string;
  email: string;
  name: string;
  plan: AccessPlan;
  planExpiresAt?: string;
  providers: Array<"email">;
  avatarUrl?: string;
  createdAt: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  plan: StoredAccessPlan | null;
  plan_expires_at: string | null;
  password_hash: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type RegistrationInput = {
  email: string;
  name?: string;
  passwordHash: string;
  promoCode?: string;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function isConstraintError(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/i.test(error.message);
}

function getProviders(db: Database.Database, userId: string): Array<"email"> {
  const rows = db
    .prepare("SELECT provider FROM user_providers WHERE user_id = ? ORDER BY provider")
    .all(userId) as Array<{ provider: string }>;

  return rows.map((row) => row.provider as "email");
}

function getActivatedPaymentIds(db: Database.Database, userId: string, excludeId?: string): string[] {
  const rows = db
    .prepare(`
      SELECT COALESCE(provider_payment_id, id) AS payment_id
      FROM activated_payments
      WHERE user_id = ?
        AND (activated_at IS NOT NULL OR status = 'succeeded' OR status IS NULL)
        AND (? IS NULL OR id <> ?)
      ORDER BY created_at, id
    `)
    .all(userId, excludeId ?? null, excludeId ?? null) as Array<{ payment_id: string }>;

  return rows.map((row) => row.payment_id as string);
}

function toStoredUser(db: Database.Database, row: UserRow): StoredUserRecord {
  const activatedPaymentIds = getActivatedPaymentIds(db, row.id);

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    plan: row.plan ?? undefined,
    planExpiresAt: row.plan_expires_at ?? undefined,
    ...(activatedPaymentIds.length ? { activatedPaymentIds } : {}),
    providers: getProviders(db, row.id),
    passwordHash: row.password_hash ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getPublicUser(user: StoredUserRecord): PublicUserRecord {
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

function getUserRowById(db: Database.Database, id: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

function getUserRowByEmail(db: Database.Database, email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

function insertUser(db: Database.Database, input: RegistrationInput, now: string): string {
  const normalizedEmail = normalizeEmail(input.email);
  const id = randomUUID();
  const name = input.name?.trim() || normalizedEmail.split("@")[0];

  db.prepare(`
    INSERT INTO users (
      id, email, name, plan, password_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, normalizedEmail, name, "free", input.passwordHash, now, now);
  db.prepare(`
    INSERT INTO user_providers (user_id, provider, created_at) VALUES (?, ?, ?)
  `).run(id, "email", now);

  return id;
}

export function findStoredUserById(id: string): StoredUserRecord | null {
  const db = getRuntimeDatabase();
  const row = getUserRowById(db, id);

  return row ? toStoredUser(db, row) : null;
}

export function findStoredUserByEmail(email: string): StoredUserRecord | null {
  const db = getRuntimeDatabase();
  const row = getUserRowByEmail(db, normalizeEmail(email));

  return row ? toStoredUser(db, row) : null;
}

export function getStoredUsers(): StoredUserRecord[] {
  const db = getRuntimeDatabase();
  const rows = db
    .prepare("SELECT * FROM users ORDER BY created_at DESC")
    .all() as UserRow[];

  return rows.map((row) => toStoredUser(db, row));
}

export function createEmailUser(input: Omit<RegistrationInput, "promoCode">): PublicUserRecord {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const normalizedEmail = normalizeEmail(input.email);

    if (getUserRowByEmail(db, normalizedEmail)) {
      throw new Error("USER_EXISTS");
    }

    const id = insertUser(db, input, new Date().toISOString());
    return getPublicUser(toStoredUser(db, getUserRowById(db, id)!));
  });

  try {
    return run.immediate();
  } catch (error) {
    if (isConstraintError(error)) {
      throw new Error("USER_EXISTS");
    }
    throw error;
  }
}

export function registerEmailUserWithReferral(input: RegistrationInput): PublicUserRecord {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const normalizedEmail = normalizeEmail(input.email);

    if (getUserRowByEmail(db, normalizedEmail)) {
      throw new Error("USER_EXISTS");
    }

    let promo: { id: string; code: string; owner_user_id: string } | undefined;
    if (input.promoCode) {
      const normalizedCode = normalizePromoCode(input.promoCode);
      promo = db.prepare(`
        SELECT id, code, owner_user_id
        FROM promo_codes
        WHERE normalized_code = ? AND is_active = 1
      `).get(normalizedCode) as typeof promo;

      if (!promo) {
        throw new Error("PROMO_CODE_NOT_FOUND");
      }
    }

    const now = new Date().toISOString();
    const id = insertUser(db, input, now);

    if (promo) {
      db.prepare(`
        INSERT INTO referrals (
          id, promo_code_id, code, owner_user_id, referred_user_id, registered_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), promo.id, promo.code, promo.owner_user_id, id, now);
    }

    return getPublicUser(toStoredUser(db, getUserRowById(db, id)!));
  });

  try {
    return run.immediate();
  } catch (error) {
    if (isConstraintError(error)) {
      throw new Error("USER_EXISTS");
    }
    throw error;
  }
}

export function updateStoredUserPlan(
  id: string,
  plan: AccessPlan,
  planExpiresAt?: string,
): PublicUserRecord {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    if (!getUserRowById(db, id)) {
      throw new Error("USER_NOT_FOUND");
    }

    db.prepare(`
      UPDATE users SET plan = ?, plan_expires_at = ?, updated_at = ? WHERE id = ?
    `).run(plan, plan === "free" ? null : planExpiresAt ?? null, new Date().toISOString(), id);
    return getPublicUser(toStoredUser(db, getUserRowById(db, id)!));
  });

  return run.immediate();
}

export function updateStoredUserPassword(id: string, passwordHash: string): PublicUserRecord {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const user = getUserRowById(db, id);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
      passwordHash,
      now,
      id,
    );
    db.prepare(`
      INSERT OR IGNORE INTO user_providers (user_id, provider, created_at) VALUES (?, ?, ?)
    `).run(id, "email", now);

    return getPublicUser(toStoredUser(db, getUserRowById(db, id)!));
  });

  return run.immediate();
}

export function applyStoredPaidPaymentAccess(
  id: string,
  paymentId: string,
  durationDays: number,
  now = new Date(),
): { user: PublicUserRecord; activated: boolean } {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const row = getUserRowById(db, id);
    if (!row) {
      throw new Error("USER_NOT_FOUND");
    }

    const user = toStoredUser(db, row);
    const result = applyPaymentAccessGrant(user, paymentId, durationDays, now);
    if (!result.activated) {
      return { user: getPublicUser(result.record), activated: false };
    }

    db.prepare(`
      INSERT INTO activated_payments (
        id, provider_payment_id, user_id, status, activated_at
      ) VALUES (?, ?, ?, ?, ?)
    `).run(paymentId, paymentId, id, "succeeded", now.toISOString());
    db.prepare(`
      UPDATE users SET plan = ?, plan_expires_at = ?, updated_at = ? WHERE id = ?
    `).run("club", result.record.planExpiresAt ?? null, now.toISOString(), id);

    return {
      user: getPublicUser(toStoredUser(db, getUserRowById(db, id)!)),
      activated: true,
    };
  });

  return run.immediate();
}
