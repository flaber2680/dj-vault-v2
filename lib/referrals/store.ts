import type { PublicUser } from "@/lib/auth/store";
import type { StoredAccessPlan } from "@/lib/access/subscription";
import type { AccessPackageId } from "@/lib/content/plans";
import {
  createPromoCodeRecord,
  findActivePromoCodeRecord,
  getPromoCodeRecords,
  getPromoReferralRecords,
  normalizePromoCode as normalizeStoredPromoCode,
  recordPaidReferralConversionRecord,
  recordPromoRegistrationRecord,
  type PromoCodeRecord,
  type PromoReferralRecord,
} from "../database/repositories/referrals.ts";

export type PromoCode = PromoCodeRecord;
export type PromoReferral = Omit<
  PromoReferralRecord,
  "convertedPackageId"
> & {
  convertedPackageId?: AccessPackageId;
};

export type PromoCodeDashboardItem = {
  code: PromoCode;
  owner: PublicUser | null;
  referrals: Array<PromoReferral & { user: PublicUser | null }>;
  registeredCount: number;
  paidCount: number;
};

export function normalizePromoCode(code: string) {
  return normalizeStoredPromoCode(code);
}

export function isPaidPlan(
  plan?: StoredAccessPlan | null,
): plan is Exclude<StoredAccessPlan, "free"> {
  return plan === "club" || plan === "start" || plan === "pro" || plan === "premium";
}

export function formatReferralPurchase(
  referral: Pick<
    PromoReferral,
    | "convertedPackageId"
    | "convertedDurationDays"
    | "convertedAmount"
    | "convertedPlan"
  >,
) {
  const legacyPurchases = {
    start: { durationDays: 30, amount: 1000 },
    pro: { durationDays: 90, amount: 2700 },
    premium: { durationDays: 180, amount: 4800 },
  } as const;
  const legacyPurchase = referral.convertedPlan
    ? legacyPurchases[
        referral.convertedPlan as keyof typeof legacyPurchases
      ]
    : undefined;
  const durationDays =
    referral.convertedDurationDays ?? legacyPurchase?.durationDays;
  const amount = referral.convertedAmount ?? legacyPurchase?.amount;

  if (!durationDays || !amount) {
    return "Оплачен";
  }

  return `${durationDays} дней · ${amount} ₽`;
}

export function summarizePromoCode(item: PromoCodeDashboardItem) {
  return {
    code: item.code.code,
    ownerName: item.owner?.name ?? "Пользователь не найден",
    registeredCount: item.registeredCount,
    paidCount: item.paidCount,
  };
}

export async function getPromoCodes() {
  return getPromoCodeRecords() as PromoCode[];
}

export async function getReferralRecords() {
  return getPromoReferralRecords() as PromoReferral[];
}

export async function findActivePromoCode(code: string) {
  return findActivePromoCodeRecord(code) as PromoCode | null;
}

export async function createPromoCodeForUser({
  code,
  ownerUserId,
}: {
  code: string;
  ownerUserId: string;
}) {
  return createPromoCodeRecord({ code, ownerUserId }) as PromoCode;
}

export async function recordPromoRegistration({
  promoCode,
  referredUserId,
}: {
  promoCode: string;
  referredUserId: string;
}) {
  return recordPromoRegistrationRecord({ promoCode, referredUserId }) as PromoReferral | null;
}

export async function recordPaidReferralConversion({
  paymentId,
  packageId,
  durationDays,
  amount,
  userId,
}: {
  paymentId: string;
  packageId: AccessPackageId;
  durationDays: number;
  amount: number;
  userId: string;
}) {
  return recordPaidReferralConversionRecord({
    paymentId,
    packageId,
    durationDays,
    amount,
    userId,
  }) as PromoReferral | null;
}

export async function getPromoCodeDashboard(users: PublicUser[]) {
  const userMap = new Map(users.map((user) => [user.id, user]));
  const referrals = getPromoReferralRecords() as PromoReferral[];

  return getPromoCodeRecords()
    .map((code) => {
      const codeReferrals = referrals
        .filter((referral) => referral.promoCodeId === code.id)
        .map((referral) => ({
          ...referral,
          user: userMap.get(referral.referredUserId) ?? null,
        }))
        .sort((left, right) => right.registeredAt.localeCompare(left.registeredAt));

      return {
        code,
        owner: userMap.get(code.ownerUserId) ?? null,
        referrals: codeReferrals,
        registeredCount: codeReferrals.length,
        paidCount: codeReferrals.filter((referral) => referral.convertedAt).length,
      } satisfies PromoCodeDashboardItem;
    })
    .sort((left, right) => right.code.createdAt.localeCompare(left.code.createdAt));
}
