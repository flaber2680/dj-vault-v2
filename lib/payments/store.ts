import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type {
  LegacyPackageId,
} from "@/lib/content/plans";
import type { StoredAccessPlan } from "@/lib/access/subscription";
import type { PaymentPackageId } from "@/lib/payments/packages";
import { createMutationQueue } from "@/lib/storage/mutation-queue";

const dataDirectory = path.join(process.cwd(), ".data");
const paymentsFile = path.join(dataDirectory, "payments.json");

export type PaymentMethod = "sbp" | "bank_card";
export type PaymentStatus = "pending" | "succeeded" | "canceled" | "failed";

export type StoredPayment = {
  id: string;
  provider: "yookassa";
  providerPaymentId?: string;
  providerStatus?: string;
  confirmationUrl?: string;
  userId: string;
  packageId?: PaymentPackageId;
  durationDays?: number;
  planId?: LegacyPackageId;
  activationPlanId?: Exclude<StoredAccessPlan, "free">;
  method: PaymentMethod;
  amount: number;
  currency: "RUB";
  status: PaymentStatus;
  paidAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

type CreatePaymentInput = {
  userId: string;
  packageId: PaymentPackageId;
  durationDays: number;
  method: PaymentMethod;
  amount: number;
};

async function readPayments(): Promise<StoredPayment[]> {
  try {
    const raw = await readFile(paymentsFile, "utf8");
    return JSON.parse(raw) as StoredPayment[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writePayments(payments: StoredPayment[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(paymentsFile, JSON.stringify(payments, null, 2), "utf8");
}

const withPaymentsMutation = createMutationQueue();

export function isPaymentMethod(value: string): value is PaymentMethod {
  return value === "sbp" || value === "bank_card";
}

export async function createStoredPayment(input: CreatePaymentInput) {
  return withPaymentsMutation(async () => {
    const payments = await readPayments();
    const now = new Date().toISOString();
    const payment: StoredPayment = {
      id: randomUUID(),
      provider: "yookassa",
      userId: input.userId,
      packageId: input.packageId,
      durationDays: input.durationDays,
      method: input.method,
      amount: input.amount,
      currency: "RUB",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    payments.push(payment);
    await writePayments(payments);

    return payment;
  });
}

export async function findStoredPaymentById(id: string) {
  const payments = await readPayments();

  return payments.find((payment) => payment.id === id) ?? null;
}

export async function findStoredPaymentByProviderId(providerPaymentId: string) {
  const payments = await readPayments();

  return (
    payments.find((payment) => payment.providerPaymentId === providerPaymentId) ??
    null
  );
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
  return withPaymentsMutation(async () => {
    const payments = await readPayments();
    const payment = payments.find((item) => item.id === id);

    if (!payment) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    Object.assign(payment, patch, { updatedAt: new Date().toISOString() });
    await writePayments(payments);

    return payment;
  });
}
