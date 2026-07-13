import { ADMIN_EMAIL } from "../auth/admin.ts";
import {
  getAccessPackage,
  type AccessPackage,
  type AccessPackageId,
} from "../content/plans.ts";

export type PaymentSmokePackageId = "smoke-100";
export type PaymentPackageId = AccessPackageId | PaymentSmokePackageId;

export type PaymentPackage =
  | (AccessPackage & { isSmoke: false })
  | {
      id: PaymentSmokePackageId;
      durationDays: 1;
      amount: 100;
      price: "100 ₽";
      badge: "Проверка оплаты";
      isSmoke: true;
    };

type CheckoutPackageOptions = {
  smokeEnabled?: boolean;
};

const smokePackage: PaymentPackage = {
  id: "smoke-100",
  durationDays: 1,
  amount: 100,
  price: "100 ₽",
  badge: "Проверка оплаты",
  isSmoke: true,
};

export function getPaymentPackage(id?: string | null): PaymentPackage | null {
  if (id === smokePackage.id) {
    return smokePackage;
  }

  const accessPackage = getAccessPackage(id);

  return accessPackage ? { ...accessPackage, isSmoke: false } : null;
}

export function getCheckoutPackage(
  id: string | null | undefined,
  userEmail: string,
  options: CheckoutPackageOptions = {},
): PaymentPackage | null {
  const paymentPackage = getPaymentPackage(id);

  if (!paymentPackage?.isSmoke) {
    return paymentPackage;
  }

  const smokeEnabled =
    options.smokeEnabled ?? process.env.PAYMENT_SMOKE_TEST_ENABLED === "true";
  const isAdmin = userEmail.trim().toLowerCase() === ADMIN_EMAIL;

  return smokeEnabled && isAdmin ? paymentPackage : null;
}
