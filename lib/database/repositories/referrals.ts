import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getRuntimeDatabase } from "../client.ts";

export type PromoCodeRecord = {
  id: string;
  code: string;
  ownerUserId: string;
  isActive: boolean;
  discountPercent: number;
  discountRegistrationLimit?: number;
  createdAt: string;
  updatedAt: string;
};

export type PromoReferralRecord = {
  id: string;
  promoCodeId: string;
  code: string;
  ownerUserId: string;
  referredUserId: string;
  registeredAt: string;
  discountPercent: number;
  discountReservedPaymentId?: string;
  discountReservedAt?: string;
  discountUsedAt?: string;
  convertedAt?: string;
  convertedPackageId?: string;
  convertedDurationDays?: number;
  convertedAmount?: number;
  convertedOriginalAmount?: number;
  convertedDiscountPercent?: number;
  convertedPlan?: "club" | "start" | "pro" | "premium";
  paymentId?: string;
};

export type PromoDiscountEligibilityRecord = {
  referralId: string;
  promoCodeId: string;
  code: string;
  percent: number;
};

type PromoCodeRow = {
  id: string;
  code: string;
  owner_user_id: string;
  is_active: number;
  discount_percent: number;
  discount_registration_limit: number | null;
  created_at: string;
  updated_at: string;
};

type ReferralRow = {
  id: string;
  promo_code_id: string;
  code: string;
  owner_user_id: string;
  referred_user_id: string;
  registered_at: string;
  discount_percent: number;
  discount_reserved_payment_id: string | null;
  discount_reserved_at: string | null;
  discount_used_at: string | null;
  converted_at: string | null;
  converted_package_id: string | null;
  converted_duration_days: number | null;
  converted_amount: number | null;
  converted_original_amount: number | null;
  converted_discount_percent: number | null;
  converted_plan: "club" | "start" | "pro" | "premium" | null;
  payment_id: string | null;
};

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function mapPromoCode(row: PromoCodeRow): PromoCodeRecord {
  return {
    id: row.id,
    code: row.code,
    ownerUserId: row.owner_user_id,
    isActive: Boolean(row.is_active),
    discountPercent: row.discount_percent,
    ...(row.discount_registration_limit !== null
      ? { discountRegistrationLimit: row.discount_registration_limit }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReferral(row: ReferralRow): PromoReferralRecord {
  return {
    id: row.id,
    promoCodeId: row.promo_code_id,
    code: row.code,
    ownerUserId: row.owner_user_id,
    referredUserId: row.referred_user_id,
    registeredAt: row.registered_at,
    discountPercent: row.discount_percent,
    ...(row.discount_reserved_payment_id ? { discountReservedPaymentId: row.discount_reserved_payment_id } : {}),
    ...(row.discount_reserved_at ? { discountReservedAt: row.discount_reserved_at } : {}),
    ...(row.discount_used_at ? { discountUsedAt: row.discount_used_at } : {}),
    ...(row.converted_at ? { convertedAt: row.converted_at } : {}),
    ...(row.converted_package_id ? { convertedPackageId: row.converted_package_id } : {}),
    ...(row.converted_duration_days !== null ? { convertedDurationDays: row.converted_duration_days } : {}),
    ...(row.converted_amount !== null ? { convertedAmount: row.converted_amount } : {}),
    ...(row.converted_original_amount !== null ? { convertedOriginalAmount: row.converted_original_amount } : {}),
    ...(row.converted_discount_percent !== null ? { convertedDiscountPercent: row.converted_discount_percent } : {}),
    ...(row.converted_plan ? { convertedPlan: row.converted_plan } : {}),
    ...(row.payment_id ? { paymentId: row.payment_id } : {}),
  };
}

function getPromoCodeRow(db: Database.Database, id: string): PromoCodeRow | undefined {
  return db.prepare("SELECT * FROM promo_codes WHERE id = ?").get(id) as PromoCodeRow | undefined;
}

function validatePromoTerms(discountPercent: number, discountRegistrationLimit?: number) {
  if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 90) {
    throw new Error("PROMO_CODE_INVALID_DISCOUNT");
  }
  if (discountRegistrationLimit !== undefined && (!Number.isInteger(discountRegistrationLimit) || discountRegistrationLimit < 1)) {
    throw new Error("PROMO_CODE_INVALID_LIMIT");
  }
}

export function getPromoCodeRecords(): PromoCodeRecord[] {
  return (getRuntimeDatabase().prepare("SELECT * FROM promo_codes ORDER BY created_at DESC").all() as PromoCodeRow[]).map(mapPromoCode);
}

export function getPromoReferralRecords(): PromoReferralRecord[] {
  return (getRuntimeDatabase().prepare("SELECT * FROM referrals ORDER BY registered_at DESC").all() as ReferralRow[]).map(mapReferral);
}

export function findActivePromoCodeRecord(code: string): PromoCodeRecord | null {
  const normalizedCode = normalizePromoCode(code);
  if (!normalizedCode) return null;
  const row = getRuntimeDatabase().prepare(`
    SELECT * FROM promo_codes WHERE normalized_code = ? AND is_active = 1
  `).get(normalizedCode) as PromoCodeRow | undefined;
  return row ? mapPromoCode(row) : null;
}

export function createPromoCodeRecord({
  code,
  ownerUserId,
  discountPercent = 20,
  discountRegistrationLimit,
}: {
  code: string;
  ownerUserId: string;
  discountPercent?: number;
  discountRegistrationLimit?: number;
}): PromoCodeRecord {
  const normalizedCode = normalizePromoCode(code);
  if (!normalizedCode) throw new Error("PROMO_CODE_REQUIRED");
  const isKitCode = normalizedCode === "KIT";
  const effectiveDiscountPercent = isKitCode ? 50 : discountPercent;
  const effectiveRegistrationLimit = isKitCode ? 16 : discountRegistrationLimit;
  validatePromoTerms(effectiveDiscountPercent, effectiveRegistrationLimit);

  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const now = new Date().toISOString();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO promo_codes (
        id, code, normalized_code, owner_user_id, is_active, discount_percent,
        discount_registration_limit, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, normalizedCode, normalizedCode, ownerUserId, 1, effectiveDiscountPercent, effectiveRegistrationLimit ?? null, now, now);
    return mapPromoCode(getPromoCodeRow(db, id)!);
  });

  try {
    return run.immediate();
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: promo_codes.normalized_code/i.test(error.message)) throw new Error("PROMO_CODE_EXISTS");
    throw error;
  }
}

export function recordPromoRegistrationRecord({ promoCode, referredUserId }: { promoCode: string; referredUserId: string }): PromoReferralRecord | null {
  const normalizedCode = normalizePromoCode(promoCode);
  if (!normalizedCode) return null;
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const code = db.prepare(`SELECT * FROM promo_codes WHERE normalized_code = ? AND is_active = 1`).get(normalizedCode) as PromoCodeRow | undefined;
    if (!code) throw new Error("PROMO_CODE_NOT_FOUND");
    if (code.owner_user_id === referredUserId) throw new Error("PROMO_CODE_SELF_REFERRAL");
    const existing = db.prepare("SELECT * FROM referrals WHERE referred_user_id = ?").get(referredUserId) as ReferralRow | undefined;
    if (existing) return mapReferral(existing);
    if (code.discount_registration_limit !== null) {
      const registrations = db.prepare("SELECT count(*) AS count FROM referrals WHERE promo_code_id = ?").get(code.id) as { count: number };
      if (registrations.count >= code.discount_registration_limit) throw new Error("PROMO_CODE_REGISTRATION_LIMIT_REACHED");
    }
    const now = new Date().toISOString();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO referrals (
        id, promo_code_id, code, owner_user_id, referred_user_id, registered_at, discount_percent
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, code.id, code.code, code.owner_user_id, referredUserId, now, code.discount_percent);
    return mapReferral(db.prepare("SELECT * FROM referrals WHERE id = ?").get(id) as ReferralRow);
  });
  return run.immediate();
}

export function findPromoDiscountEligibilityRecord(userId: string): PromoDiscountEligibilityRecord | null {
  const row = getRuntimeDatabase().prepare(`
    SELECT id AS referral_id, promo_code_id, code, discount_percent
    FROM referrals
    WHERE referred_user_id = ?
      AND discount_percent > 0
      AND discount_used_at IS NULL
      AND discount_reserved_payment_id IS NULL
    LIMIT 1
  `).get(userId) as { referral_id: string; promo_code_id: string; code: string; discount_percent: number } | undefined;
  return row ? { referralId: row.referral_id, promoCodeId: row.promo_code_id, code: row.code, percent: row.discount_percent } : null;
}

export function recordPaidReferralConversionRecord({ paymentId, packageId, durationDays, amount, originalAmount, discountPercent, userId }: {
  paymentId: string; packageId: string; durationDays: number; amount: number; originalAmount: number; discountPercent: number; userId: string;
}): PromoReferralRecord | null {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const referral = db.prepare("SELECT * FROM referrals WHERE referred_user_id = ?").get(userId) as ReferralRow | undefined;
    if (!referral || referral.converted_at) return referral ? mapReferral(referral) : null;
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE referrals
      SET converted_at = ?, converted_package_id = ?, converted_duration_days = ?, converted_amount = ?,
          converted_original_amount = ?, converted_discount_percent = ?, payment_id = ?
      WHERE id = ?
    `).run(now, packageId, durationDays, amount, originalAmount, discountPercent, paymentId, referral.id);
    return mapReferral(db.prepare("SELECT * FROM referrals WHERE id = ?").get(referral.id) as ReferralRow);
  });
  return run.immediate();
}
