import type { StoredAccessPlan } from "@/lib/access/subscription";
import type { LegacyPackageId } from "@/lib/content/plans";
import type { PaymentPackageId } from "@/lib/payments/packages";
import {
  createStoredPaymentRecord,
  findStoredPaymentRecordById,
  findStoredPaymentRecordByProviderId,
  updateStoredPaymentRecord,
  type PaymentMethodRecord,
  type PaymentPatch,
  type PaymentStatusRecord,
  type StoredPaymentRecord,
} from "../database/repositories/payments.ts";

export type PaymentMethod = PaymentMethodRecord;
export type PaymentStatus = PaymentStatusRecord;

export type StoredPayment = Omit<StoredPaymentRecord, "packageId" | "planId" | "activationPlanId"> & {
  packageId?: PaymentPackageId;
  planId?: LegacyPackageId;
  activationPlanId?: Exclude<StoredAccessPlan, "free">;
};

type CreatePaymentInput = {
  userId: string;
  packageId: PaymentPackageId;
  durationDays: number;
  method: PaymentMethod;
  amount: number;
};

export function isPaymentMethod(value: string): value is PaymentMethod {
  return value === "sbp" || value === "bank_card";
}

export async function createStoredPayment(input: CreatePaymentInput) {
  return createStoredPaymentRecord(input) as StoredPayment;
}

export async function findStoredPaymentById(id: string) {
  return findStoredPaymentRecordById(id) as StoredPayment | null;
}

export async function findStoredPaymentByProviderId(providerPaymentId: string) {
  return findStoredPaymentRecordByProviderId(providerPaymentId) as StoredPayment | null;
}

export async function updateStoredPayment(
  id: string,
  patch: Partial<
    Pick<
      StoredPayment,
      | "providerPaymentId"
      | "providerStatus"
      | "confirmationUrl"
      | "status"
      | "paidAt"
      | "error"
    >
  >,
) {
  return updateStoredPaymentRecord(id, patch as PaymentPatch) as StoredPayment;
}
