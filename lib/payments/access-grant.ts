import { calculateExtendedExpiration } from "../access/subscription.ts";
import type { StoredAccessPlan } from "../access/subscription.ts";

export type PaymentAccessRecord = {
  plan?: StoredAccessPlan;
  planExpiresAt?: string;
  activatedPaymentIds?: string[];
};

type PaymentAccessGrantResult<T extends PaymentAccessRecord> = {
  record: T;
  activated: boolean;
};

export function applyPaymentAccessGrant<T extends PaymentAccessRecord>(
  record: T,
  paymentId: string,
  durationDays: number,
  now = new Date(),
): PaymentAccessGrantResult<T> {
  const activatedPaymentIds = record.activatedPaymentIds ?? [];

  if (activatedPaymentIds.includes(paymentId)) {
    return {
      record: { ...record, activatedPaymentIds: [...activatedPaymentIds] },
      activated: false,
    };
  }

  return {
    record: {
      ...record,
      plan: "club",
      planExpiresAt: calculateExtendedExpiration(
        record.planExpiresAt,
        durationDays,
        now,
      ),
      activatedPaymentIds: [...activatedPaymentIds, paymentId],
    },
    activated: true,
  };
}
