"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getCheckoutPackage } from "@/lib/payments/packages";
import {
  createStoredPayment,
  findPendingPromoDiscountPaymentForUser,
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

function redirectWithCheckoutError(packageId: string, error: string): never {
  redirect(`/checkout?package=${packageId}&error=${encodeURIComponent(error)}`);
}

export async function startCheckout(formData: FormData) {
  const user = await getCurrentUser();
  const method = formValue(formData, "method");

  if (!user) {
    redirect("/register");
  }

  const accessPackage = getCheckoutPackage(
    formValue(formData, "packageId") || formValue(formData, "plan"),
    user.email,
  );

  if (!accessPackage) {
    redirect("/pricing");
  }

  if (!isPaymentMethod(method)) {
    redirectWithCheckoutError(accessPackage.id, "invalid_method");
  }

  if (!accessPackage.isSmoke) {
    const pendingDiscountPayment = await findPendingPromoDiscountPaymentForUser(user.id);
    if (pendingDiscountPayment?.confirmationUrl) {
      redirect(pendingDiscountPayment.confirmationUrl);
    }
  }

  const storedPayment = await createStoredPayment({
    userId: user.id,
    packageId: accessPackage.id,
    durationDays: accessPackage.durationDays,
    method,
    amount: accessPackage.amount,
    applyPromoDiscount: !accessPackage.isSmoke,
  });

  let confirmationUrl = "";
  let checkoutError = "";

  try {
    const yookassaPayment = await createYooKassaPayment({
      amount: storedPayment.amount,
      description: `DJ Vault: доступ на ${accessPackage.durationDays} дней`,
      method,
      returnUrl: `${getAppUrl()}/checkout/result?payment=${storedPayment.id}`,
      metadata: {
        localPaymentId: storedPayment.id,
        userId: user.id,
        packageId: accessPackage.id,
        durationDays: String(accessPackage.durationDays),
        discountPercent: String(storedPayment.discountPercent),
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
      accessPackage.id,
      error instanceof YooKassaConfigError
        ? "payments_not_configured"
        : "payment_request_failed",
    );
  }

  if (checkoutError) {
    redirectWithCheckoutError(accessPackage.id, checkoutError);
  }

  redirect(confirmationUrl);
}
