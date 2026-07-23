import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { applyPaymentAccessGrant } from "../../payments/access-grant.ts";
import { getRuntimeDatabase } from "../client.ts";
import {
  getPublicUser,
  type PublicUserRecord,
  type StoredUserRecord,
} from "./users.ts";

export type PaymentMethodRecord = "sbp" | "bank_card";
export type PaymentStatusRecord = "pending" | "succeeded" | "canceled" | "failed";

export type StoredPaymentRecord = {
  id: string;
  provider: "yookassa";
  providerPaymentId?: string;
  providerStatus?: string;
  confirmationUrl?: string;
  userId: string;
  packageId?: string;
  durationDays?: number;
  planId?: string;
  activationPlanId?: "club" | "start" | "pro" | "premium";
  method: PaymentMethodRecord;
  amount: number;
  originalAmount: number;
  discountPercent: number;
  promoCodeId?: string;
  currency: "RUB";
  status: PaymentStatusRecord;
  paidAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type PaymentRow = {
  id: string;
  provider: string | null;
  provider_payment_id: string | null;
  provider_status: string | null;
  confirmation_url: string | null;
  user_id: string;
  package_id: string | null;
  duration_days: number | null;
  plan_id: string | null;
  activation_plan_id: "club" | "start" | "pro" | "premium" | null;
  method: PaymentMethodRecord | null;
  amount: number | null;
  original_amount: number | null;
  discount_percent: number | null;
  promo_code_id: string | null;
  currency: "RUB" | null;
  status: PaymentStatusRecord | null;
  paid_at: string | null;
  activated_at: string | null;
  error: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  plan: "free" | "club" | "start" | "pro" | "premium" | null;
  plan_expires_at: string | null;
  password_hash: string | null;
  session_version: number;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateStoredPaymentInput = {
  userId: string;
  packageId: string;
  durationDays: number;
  method: PaymentMethodRecord;
  amount: number;
  applyPromoDiscount?: boolean;
};

export type PaymentPatch = Partial<
  Pick<
    StoredPaymentRecord,
    | "providerPaymentId"
    | "providerStatus"
    | "confirmationUrl"
    | "status"
    | "paidAt"
    | "error"
  >
>;

export type PaymentActivationInput = {
  paymentId: string;
  providerPaymentId: string;
  providerStatus: string;
  paidAt: string;
  packageId: string;
  durationDays: number;
  convertReferral: boolean;
};

function mapPayment(row: PaymentRow): StoredPaymentRecord {
  return {
    id: row.id,
    provider: (row.provider ?? "yookassa") as "yookassa",
    providerPaymentId: row.provider_payment_id ?? undefined,
    providerStatus: row.provider_status ?? undefined,
    confirmationUrl: row.confirmation_url ?? undefined,
    userId: row.user_id,
    packageId: row.package_id ?? undefined,
    durationDays: row.duration_days ?? undefined,
    planId: row.plan_id ?? undefined,
    activationPlanId: row.activation_plan_id ?? undefined,
    method: (row.method ?? "bank_card") as PaymentMethodRecord,
    amount: row.amount ?? 0,
    originalAmount: row.original_amount ?? row.amount ?? 0,
    discountPercent: row.discount_percent ?? 0,
    promoCodeId: row.promo_code_id ?? undefined,
    currency: (row.currency ?? "RUB") as "RUB",
    status: (row.status ?? "pending") as PaymentStatusRecord,
    paidAt: row.paid_at ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function getPaymentRow(db: Database.Database, id: string): PaymentRow | undefined {
  return db.prepare("SELECT * FROM activated_payments WHERE id = ? AND provider IS NOT NULL").get(id) as PaymentRow | undefined;
}

function getPaymentByProviderId(db: Database.Database, providerPaymentId: string): PaymentRow | undefined {
  return db
    .prepare("SELECT * FROM activated_payments WHERE provider_payment_id = ? AND provider IS NOT NULL")
    .get(providerPaymentId) as PaymentRow | undefined;
}

function getProviders(db: Database.Database, userId: string): Array<"email"> {
  const rows = db
    .prepare("SELECT provider FROM user_providers WHERE user_id = ? ORDER BY provider")
    .all(userId) as Array<{ provider: string }>;

  return rows.map((row) => row.provider as "email");
}

function getActivatedPaymentIds(
  db: Database.Database,
  userId: string,
  excludePaymentId: string,
): string[] {
  const rows = db
    .prepare(`
      SELECT id AS payment_id
      FROM activated_payments
      WHERE user_id = ?
        AND id <> ?
        AND (activated_at IS NOT NULL OR status = 'succeeded' OR status IS NULL)
      ORDER BY created_at, id
    `)
    .all(userId, excludePaymentId) as Array<{ payment_id: string }>;

  return rows.map((row) => row.payment_id);
}

function toStoredUser(
  db: Database.Database,
  row: UserRow,
  excludePaymentId: string,
): StoredUserRecord {
  const activatedPaymentIds = getActivatedPaymentIds(db, row.id, excludePaymentId);

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    plan: row.plan ?? undefined,
    planExpiresAt: row.plan_expires_at ?? undefined,
    ...(activatedPaymentIds.length ? { activatedPaymentIds } : {}),
    providers: getProviders(db, row.id),
    passwordHash: row.password_hash ?? undefined,
    sessionVersion: row.session_version,
    avatarUrl: row.avatar_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createStoredPaymentRecord(input: CreateStoredPaymentInput): StoredPaymentRecord {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const now = new Date().toISOString();
    const id = randomUUID();
    const discount = input.applyPromoDiscount === false ? undefined : db.prepare(`
      SELECT r.id AS referral_id, r.promo_code_id, r.discount_percent
      FROM referrals r
      WHERE r.referred_user_id = ?
        AND r.discount_percent > 0
        AND r.discount_used_at IS NULL
        AND r.discount_reserved_payment_id IS NULL
      LIMIT 1
    `).get(input.userId) as {
      referral_id: string;
      promo_code_id: string;
      discount_percent: number;
    } | undefined;
    const discountPercent = discount?.discount_percent ?? 0;
    const amount = Math.round(input.amount * (100 - discountPercent)) / 100;

    db.prepare(`
      INSERT INTO activated_payments (
        id, provider, user_id, package_id, duration_days, method, amount,
        original_amount, discount_percent, promo_code_id, currency, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      "yookassa",
      input.userId,
      input.packageId,
      input.durationDays,
      input.method,
      amount,
      input.amount,
      discountPercent,
      discount?.promo_code_id ?? null,
      "RUB",
      "pending",
      now,
      now,
    );

    if (discount) {
      const reservation = db.prepare(`
        UPDATE referrals
        SET discount_reserved_payment_id = ?, discount_reserved_at = ?
        WHERE id = ? AND discount_used_at IS NULL AND discount_reserved_payment_id IS NULL
      `).run(id, now, discount.referral_id);
      if (reservation.changes !== 1) {
        throw new Error("PROMO_DISCOUNT_RESERVATION_FAILED");
      }
    }

    return mapPayment(getPaymentRow(db, id)!);
  });

  return run.immediate();
}

export function findStoredPaymentRecordById(id: string): StoredPaymentRecord | null {
  const row = getPaymentRow(getRuntimeDatabase(), id);
  return row ? mapPayment(row) : null;
}

export function findStoredPaymentRecordByProviderId(
  providerPaymentId: string,
): StoredPaymentRecord | null {
  const row = getPaymentByProviderId(getRuntimeDatabase(), providerPaymentId);
  return row ? mapPayment(row) : null;
}

export function updateStoredPaymentRecord(id: string, patch: PaymentPatch): StoredPaymentRecord {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const current = getPaymentRow(db, id);
    if (!current) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    db.prepare(`
      UPDATE activated_payments
      SET provider_payment_id = ?, provider_status = ?, confirmation_url = ?, status = ?,
          paid_at = ?, error = ?, updated_at = ?
      WHERE id = ?
    `).run(
      patch.providerPaymentId ?? current.provider_payment_id,
      patch.providerStatus ?? current.provider_status,
      patch.confirmationUrl ?? current.confirmation_url,
      patch.status ?? current.status,
      patch.paidAt ?? current.paid_at,
      patch.error ?? current.error,
      new Date().toISOString(),
      id,
    );

    if (patch.status === "canceled" || patch.status === "failed") {
      db.prepare(`
        UPDATE referrals
        SET discount_reserved_payment_id = NULL, discount_reserved_at = NULL
        WHERE discount_reserved_payment_id = ? AND discount_used_at IS NULL
      `).run(id);
    }

    return mapPayment(getPaymentRow(db, id)!);
  });

  try {
    return run.immediate();
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: activated_payments.provider_payment_id/i.test(error.message)) {
      throw new Error("PAYMENT_PROVIDER_ID_EXISTS");
    }
    throw error;
  }
}

export function failStoredPaymentActivation(
  id: string,
  providerStatus: string,
  error: string,
): StoredPaymentRecord {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const current = getPaymentRow(db, id);
    if (!current) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    db.prepare(`
      UPDATE activated_payments
      SET provider_status = ?,
          status = CASE WHEN status = 'succeeded' THEN status ELSE 'failed' END,
          error = ?, updated_at = ?
      WHERE id = ?
    `).run(providerStatus, error, new Date().toISOString(), id);
    db.prepare(`
      UPDATE referrals
      SET discount_reserved_payment_id = NULL, discount_reserved_at = NULL
      WHERE discount_reserved_payment_id = ? AND discount_used_at IS NULL
    `).run(id);

    return mapPayment(getPaymentRow(db, id)!);
  });

  return run.immediate();
}

export function activatePaymentTransaction(input: PaymentActivationInput): {
  payment: StoredPaymentRecord;
  user: PublicUserRecord;
  activated: boolean;
} {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const payment = getPaymentRow(db, input.paymentId);
    if (!payment) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    const matchingProviderPayment = getPaymentByProviderId(db, input.providerPaymentId);
    if (matchingProviderPayment && matchingProviderPayment.id !== payment.id) {
      throw new Error("PAYMENT_PROVIDER_ID_EXISTS");
    }
    if (payment.provider_payment_id && payment.provider_payment_id !== input.providerPaymentId) {
      throw new Error("PAYMENT_PROVIDER_ID_MISMATCH");
    }

    const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(payment.user_id) as UserRow | undefined;
    if (!userRow) {
      throw new Error("USER_NOT_FOUND");
    }

    if (payment.activated_at || payment.status === "succeeded") {
      return {
        payment: mapPayment(payment),
        user: getPublicUser(toStoredUser(db, userRow, payment.id)),
        activated: false,
      };
    }

    const now = new Date();
    const user = toStoredUser(db, userRow, payment.id);
    const grant = applyPaymentAccessGrant(
      user,
      input.providerPaymentId,
      input.durationDays,
      now,
    );

    db.prepare(`
      UPDATE users SET plan = ?, plan_expires_at = ?, updated_at = ? WHERE id = ?
    `).run("club", grant.record.planExpiresAt ?? null, now.toISOString(), user.id);
    db.prepare(`
      UPDATE activated_payments
      SET provider_payment_id = ?, provider_status = ?, status = ?, paid_at = ?,
          activated_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.providerPaymentId,
      input.providerStatus,
      "succeeded",
      input.paidAt,
      now.toISOString(),
      now.toISOString(),
      payment.id,
    );

    if (input.convertReferral) {
      db.prepare(`
        UPDATE referrals
        SET converted_at = ?, converted_package_id = ?, converted_duration_days = ?,
            converted_amount = ?, converted_original_amount = ?, converted_discount_percent = ?,
            payment_id = ?
        WHERE referred_user_id = ? AND converted_at IS NULL
      `).run(
        now.toISOString(),
        input.packageId,
        input.durationDays,
        payment.amount,
        payment.original_amount ?? payment.amount,
        payment.discount_percent ?? 0,
        payment.id,
        user.id,
      );

      if ((payment.discount_percent ?? 0) > 0) {
        db.prepare(`
          UPDATE referrals
          SET discount_used_at = ?, discount_reserved_payment_id = NULL, discount_reserved_at = NULL
          WHERE discount_reserved_payment_id = ? AND discount_used_at IS NULL
        `).run(now.toISOString(), payment.id);
      }
    }

    const activatedPayment = getPaymentRow(db, payment.id)!;
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as UserRow;

    return {
      payment: mapPayment(activatedPayment),
      user: getPublicUser(toStoredUser(db, updatedUser, payment.id)),
      activated: grant.activated,
    };
  });

  try {
    return run.immediate();
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: activated_payments.provider_payment_id/i.test(error.message)) {
      throw new Error("PAYMENT_PROVIDER_ID_EXISTS");
    }
    throw error;
  }
}
