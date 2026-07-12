import { findUserById, updateUserPlan } from "@/lib/auth/store";
import { calculateExtendedExpiration } from "@/lib/access/subscription";
import { getAccessPackage } from "@/lib/content/plans";
import {
  findStoredPaymentById,
  findStoredPaymentByProviderId,
  updateStoredPayment,
  type StoredPayment,
} from "@/lib/payments/store";
import type { YooKassaPayment } from "@/lib/payments/yookassa";
import { recordPaidReferralConversion } from "@/lib/referrals/store";

type ActivationResult = {
  payment: StoredPayment | null;
  activated: boolean;
  status: string;
};

function providerAmountMatches(localPayment: StoredPayment, payment: YooKassaPayment) {
  const providerAmount = Number(payment.amount.value);

  return (
    payment.amount.currency === localPayment.currency &&
    Number.isFinite(providerAmount) &&
    providerAmount === localPayment.amount
  );
}

async function findLocalPayment(payment: YooKassaPayment) {
  const localPaymentId = payment.metadata?.localPaymentId;

  if (localPaymentId) {
    const localPayment = await findStoredPaymentById(localPaymentId);

    if (localPayment) {
      return localPayment;
    }
  }

  return findStoredPaymentByProviderId(payment.id);
}

export async function activateYooKassaPayment(
  payment: YooKassaPayment,
): Promise<ActivationResult> {
  const localPayment = await findLocalPayment(payment);

  if (!localPayment) {
    return { payment: null, activated: false, status: "not_found" };
  }

  if (localPayment.status === "succeeded") {
    return { payment: localPayment, activated: false, status: "already_succeeded" };
  }

  if (payment.status === "canceled") {
    const updatedPayment = await updateStoredPayment(localPayment.id, {
      providerPaymentId: payment.id,
      providerStatus: payment.status,
      status: "canceled",
    });

    return { payment: updatedPayment, activated: false, status: payment.status };
  }

  if (payment.status !== "succeeded" || !payment.paid) {
    const updatedPayment = await updateStoredPayment(localPayment.id, {
      providerPaymentId: payment.id,
      providerStatus: payment.status,
    });

    return { payment: updatedPayment, activated: false, status: payment.status };
  }

  if (!providerAmountMatches(localPayment, payment)) {
    const updatedPayment = await updateStoredPayment(localPayment.id, {
      providerPaymentId: payment.id,
      providerStatus: payment.status,
      status: "failed",
      error: "PAYMENT_AMOUNT_MISMATCH",
    });

    return { payment: updatedPayment, activated: false, status: "amount_mismatch" };
  }

  const user = await findUserById(localPayment.userId);
  const accessPackage = getAccessPackage(
    localPayment.packageId ?? localPayment.planId,
  );

  if (!user || !accessPackage) {
    const updatedPayment = await updateStoredPayment(localPayment.id, {
      providerPaymentId: payment.id,
      providerStatus: payment.status,
      status: "failed",
      error: !user ? "USER_NOT_FOUND" : "PACKAGE_NOT_FOUND",
    });

    return { payment: updatedPayment, activated: false, status: "failed" };
  }

  const durationDays = localPayment.durationDays ?? accessPackage.durationDays;
  const planExpiresAt = calculateExtendedExpiration(
    user.planExpiresAt,
    durationDays,
  );

  await updateUserPlan(user.id, "club", planExpiresAt);

  const updatedPayment = await updateStoredPayment(localPayment.id, {
    providerPaymentId: payment.id,
    providerStatus: payment.status,
    status: "succeeded",
    paidAt: new Date().toISOString(),
  });

  await recordPaidReferralConversion({
    paymentId: updatedPayment.id,
    packageId: accessPackage.id,
    durationDays,
    amount: localPayment.amount,
    userId: user.id,
  });

  return { payment: updatedPayment, activated: true, status: payment.status };
}
