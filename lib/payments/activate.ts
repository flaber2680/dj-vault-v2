import { activatePaymentTransaction } from "@/lib/database/repositories/payments";
import { getPaymentPackage } from "@/lib/payments/packages";
import {
  findStoredPaymentById,
  findStoredPaymentByProviderId,
  updateStoredPayment,
  type StoredPayment,
} from "@/lib/payments/store";
import type { YooKassaPayment } from "@/lib/payments/yookassa";

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

  if (localPayment.status === "succeeded" && payment.status !== "succeeded") {
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

  const accessPackage = getPaymentPackage(
    localPayment.packageId ?? localPayment.planId,
  );
  if (!accessPackage) {
    const updatedPayment = await updateStoredPayment(localPayment.id, {
      providerPaymentId: payment.id,
      providerStatus: payment.status,
      status: "failed",
      error: "PACKAGE_NOT_FOUND",
    });
    return { payment: updatedPayment, activated: false, status: "failed" };
  }

  try {
    const result = activatePaymentTransaction({
      paymentId: localPayment.id,
      providerPaymentId: payment.id,
      providerStatus: payment.status,
      paidAt: new Date().toISOString(),
      packageId: accessPackage.id,
      durationDays: localPayment.durationDays ?? accessPackage.durationDays,
      convertReferral: !accessPackage.isSmoke,
    });

    return {
      payment: result.payment as StoredPayment,
      activated: result.activated,
      status: payment.status,
    };
  } catch (error) {
    const updatedPayment = await updateStoredPayment(localPayment.id, {
      providerPaymentId: payment.id,
      providerStatus: payment.status,
      status: "failed",
      error:
        error instanceof Error && error.message === "USER_NOT_FOUND"
          ? "USER_NOT_FOUND"
          : "ACCESS_ACTIVATION_FAILED",
    });
    return { payment: updatedPayment, activated: false, status: "failed" };
  }
}
