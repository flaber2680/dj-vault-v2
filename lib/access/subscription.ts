export type AccessPlan = "free" | "club";
export type LegacyPaidPlan = "start" | "pro" | "premium";
export type StoredAccessPlan = AccessPlan | LegacyPaidPlan;

const dayInMs = 24 * 60 * 60 * 1000;
const maxAdminDays = 3650;

type AccessRecord = {
  plan?: StoredAccessPlan | null;
  planExpiresAt?: string;
};

type AdminAccessChangeInput = {
  currentPlan: StoredAccessPlan;
  currentExpiresAt?: string;
  nextPlan: AccessPlan;
  days: number;
  now?: Date;
};

export function normalizeAccessPlan(
  plan?: StoredAccessPlan | null,
): AccessPlan {
  return !plan || plan === "free" ? "free" : "club";
}

export function hasClubAccess(record: AccessRecord, now = new Date()) {
  if (normalizeAccessPlan(record.plan) !== "club" || !record.planExpiresAt) {
    return false;
  }

  const expirationTime = Date.parse(record.planExpiresAt);

  return Number.isFinite(expirationTime) && expirationTime > now.getTime();
}

function validateDays(days: number) {
  if (!Number.isInteger(days) || days < 0 || days > maxAdminDays) {
    throw new Error("ACCESS_DAYS_INVALID");
  }
}

export function calculateExtendedExpiration(
  expiresAt: string | undefined,
  days: number,
  now = new Date(),
) {
  if (!Number.isInteger(days) || days < 1 || days > maxAdminDays) {
    throw new Error("ACCESS_DAYS_INVALID");
  }

  const parsedExpiration = expiresAt ? Date.parse(expiresAt) : 0;
  const startsAt =
    Number.isFinite(parsedExpiration) && parsedExpiration > now.getTime()
      ? parsedExpiration
      : now.getTime();

  return new Date(startsAt + days * dayInMs).toISOString();
}

export function calculateAdminAccessChange({
  currentPlan,
  currentExpiresAt,
  nextPlan,
  days,
  now = new Date(),
}: AdminAccessChangeInput): {
  plan: AccessPlan;
  planExpiresAt?: string;
} {
  validateDays(days);

  const normalizedCurrentPlan = normalizeAccessPlan(currentPlan);

  if (nextPlan === "free") {
    if (days > 0) {
      throw new Error("ACCESS_DAYS_NOT_ALLOWED");
    }

    return { plan: "free", planExpiresAt: undefined };
  }

  if (normalizedCurrentPlan === "free" && days === 0) {
    throw new Error("ACCESS_DAYS_REQUIRED");
  }

  if (days === 0) {
    return { plan: "club", planExpiresAt: currentExpiresAt };
  }

  return {
    plan: "club",
    planExpiresAt: calculateExtendedExpiration(currentExpiresAt, days, now),
  };
}

export function migrateLegacyAccessPlans<
  T extends { plan?: StoredAccessPlan | null },
>(users: T[]) {
  let changed = false;
  const migratedUsers = users.map((user) => {
    if (
      user.plan !== "start" &&
      user.plan !== "pro" &&
      user.plan !== "premium"
    ) {
      return user;
    }

    changed = true;
    return { ...user, plan: "club" as const };
  });

  return {
    changed,
    users: changed ? migratedUsers : users,
  };
}
