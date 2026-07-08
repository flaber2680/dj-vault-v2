"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getPaidPlan } from "@/lib/content/plans";
import {
  createStoredPayment,
  isPaymentMethod,
  updateStoredPayment,
} from "@/lib/payments/store";
import {
  createYooKassaPayment,
  getAppUrl,
  YooKassaConfigError,
} from "@/lib/payments/yookassa";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function redirectWithCheckoutError(planId: string, error: string): never {
  redirect(`/checkout?plan=${planId}&error=${encodeURIComponent(error)}`);
}

export async function startCheckout(formData: FormData) {
  const user = await getCurrentUser();
  const plan = getPaidPlan(formValue(formData, "plan"));
  const method = formValue(formData, "method");

  if (!user) {
    redirect("/register");
  }

  if (!plan) {
    redirect("/pricing");
  }

  if (!isPaymentMethod(method)) {
    redirectWithCheckoutError(plan.id, "invalid_method");
  }

  const activationPlanId = user.plan !== "free" ? user.plan : plan.id;
  const storedPayment = await createStoredPayment({
    userId: user.id,
    planId: plan.id,
    activationPlanId,
    method,
    amount: plan.amount,
  });

  let confirmationUrl = "";
  let checkoutError = "";

  try {
    const yookassaPayment = await createYooKassaPayment({
      amount: plan.amount,
      description: `DJ Vault ${plan.name}`,
      method,
      returnUrl: `${getAppUrl()}/checkout/result?payment=${storedPayment.id}`,
      metadata: {
        localPaymentId: storedPayment.id,
        userId: user.id,
        planId: plan.id,
        activationPlanId,
      },
    });

    confirmationUrl = yookassaPayment.confirmation?.confirmation_url ?? "";

    if (!confirmationUrl) {
      await updateStoredPayment(storedPayment.id, {
        providerPaymentId: yookassaPayment.id,
        providerStatus: yookassaPayment.status,
        status: "failed",
        error: "CONFIRMATION_URL_MISSING",
      });

      checkoutError = "payment_link_missing";
    } else {
      await updateStoredPayment(storedPayment.id, {
        providerPaymentId: yookassaPayment.id,
        providerStatus: yookassaPayment.status,
        confirmationUrl,
      });
    }
  } catch (error) {
    await updateStoredPayment(storedPayment.id, {
      status: "failed",
      error:
        error instanceof YooKassaConfigError
          ? "YOOKASSA_CONFIG_MISSING"
          : "YOOKASSA_REQUEST_FAILED",
    });

    redirectWithCheckoutError(
      plan.id,
      error instanceof YooKassaConfigError
        ? "payments_not_configured"
        : "payment_request_failed",
    );
  }

  if (checkoutError) {
    redirectWithCheckoutError(plan.id, checkoutError);
  }

  redirect(confirmationUrl);
}
