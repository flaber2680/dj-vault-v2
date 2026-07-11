import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { PublicUser, TariffPlan } from "@/lib/auth/store";

const dataDirectory = path.join(process.cwd(), ".data");
const referralsFile = path.join(dataDirectory, "promo-codes.json");

export type PromoCode = {
  id: string;
  code: string;
  ownerUserId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PromoReferral = {
  id: string;
  promoCodeId: string;
  code: string;
  ownerUserId: string;
  referredUserId: string;
  registeredAt: string;
  convertedAt?: string;
  convertedPlan?: Exclude<TariffPlan, "free">;
  paymentId?: string;
};

type ReferralData = {
  codes: PromoCode[];
  referrals: PromoReferral[];
};

export type PromoCodeDashboardItem = {
  code: PromoCode;
  owner: PublicUser | null;
  referrals: Array<PromoReferral & { user: PublicUser | null }>;
  registeredCount: number;
  paidCount: number;
};

async function readReferralData(): Promise<ReferralData> {
  try {
    const raw = await readFile(referralsFile, "utf8");
    const data = JSON.parse(raw) as Partial<ReferralData>;

    return {
      codes: data.codes ?? [],
      referrals: data.referrals ?? [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { codes: [], referrals: [] };
    }

    throw error;
  }
}

async function writeReferralData(data: ReferralData) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(referralsFile, JSON.stringify(data, null, 2), "utf8");
}

export function normalizePromoCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function isPaidPlan(plan?: TariffPlan | null): plan is Exclude<TariffPlan, "free"> {
  return plan === "start" || plan === "pro" || plan === "premium";
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
  const data = await readReferralData();

  return data.codes.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getReferralRecords() {
  const data = await readReferralData();

  return data.referrals.sort((left, right) =>
    right.registeredAt.localeCompare(left.registeredAt),
  );
}

export async function findActivePromoCode(code: string) {
  const normalizedCode = normalizePromoCode(code);

  if (!normalizedCode) {
    return null;
  }

  const data = await readReferralData();

  return (
    data.codes.find((item) => item.code === normalizedCode && item.isActive) ??
    null
  );
}

export async function createPromoCodeForUser({
  code,
  ownerUserId,
}: {
  code: string;
  ownerUserId: string;
}) {
  const normalizedCode = normalizePromoCode(code);

  if (!normalizedCode) {
    throw new Error("PROMO_CODE_REQUIRED");
  }

  const data = await readReferralData();
  const existingCode = data.codes.find((item) => item.code === normalizedCode);

  if (existingCode) {
    throw new Error("PROMO_CODE_EXISTS");
  }

  const now = new Date().toISOString();
  const promoCode: PromoCode = {
    id: randomUUID(),
    code: normalizedCode,
    ownerUserId,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  data.codes.push(promoCode);
  await writeReferralData(data);

  return promoCode;
}

export async function recordPromoRegistration({
  promoCode,
  referredUserId,
}: {
  promoCode: string;
  referredUserId: string;
}) {
  const normalizedCode = normalizePromoCode(promoCode);

  if (!normalizedCode) {
    return null;
  }

  const data = await readReferralData();
  const code = data.codes.find(
    (item) => item.code === normalizedCode && item.isActive,
  );

  if (!code) {
    throw new Error("PROMO_CODE_NOT_FOUND");
  }

  if (code.ownerUserId === referredUserId) {
    throw new Error("PROMO_CODE_SELF_REFERRAL");
  }

  const existingReferral = data.referrals.find(
    (item) => item.referredUserId === referredUserId,
  );

  if (existingReferral) {
    return existingReferral;
  }

  const referral: PromoReferral = {
    id: randomUUID(),
    promoCodeId: code.id,
    code: code.code,
    ownerUserId: code.ownerUserId,
    referredUserId,
    registeredAt: new Date().toISOString(),
  };

  data.referrals.push(referral);
  await writeReferralData(data);

  return referral;
}

export async function recordPaidReferralConversion({
  paymentId,
  plan,
  userId,
}: {
  paymentId: string;
  plan: Exclude<TariffPlan, "free">;
  userId: string;
}) {
  const data = await readReferralData();
  const referral = data.referrals.find((item) => item.referredUserId === userId);

  if (!referral || referral.convertedAt) {
    return referral ?? null;
  }

  referral.convertedAt = new Date().toISOString();
  referral.convertedPlan = plan;
  referral.paymentId = paymentId;

  await writeReferralData(data);

  return referral;
}

export async function getPromoCodeDashboard(users: PublicUser[]) {
  const data = await readReferralData();
  const userMap = new Map(users.map((user) => [user.id, user]));

  return data.codes
    .map((code) => {
      const referrals = data.referrals
        .filter((referral) => referral.promoCodeId === code.id)
        .map((referral) => ({
          ...referral,
          user: userMap.get(referral.referredUserId) ?? null,
        }))
        .sort((left, right) => right.registeredAt.localeCompare(left.registeredAt));

      return {
        code,
        owner: userMap.get(code.ownerUserId) ?? null,
        referrals,
        registeredCount: referrals.length,
        paidCount: referrals.filter((referral) => referral.convertedAt).length,
      } satisfies PromoCodeDashboardItem;
    })
    .sort((left, right) => right.code.createdAt.localeCompare(left.code.createdAt));
}
