import test from "node:test";
import assert from "node:assert/strict";

import { ADMIN_EMAIL } from "../lib/auth/admin.ts";
import { accessPackageList } from "../lib/content/plans.ts";
import {
  getCheckoutPackage,
  getPaymentPackage,
} from "../lib/payments/packages.ts";

test("keeps the smoke package out of public pricing", () => {
  assert.equal(accessPackageList.length, 3);
  assert.equal(accessPackageList.some((item) => item.id === "smoke-100"), false);
});

test("allows the smoke package only for the admin with the flag enabled", () => {
  assert.equal(
    getCheckoutPackage("smoke-100", ADMIN_EMAIL, { smokeEnabled: false }),
    null,
  );
  assert.equal(
    getCheckoutPackage("smoke-100", "user@example.com", {
      smokeEnabled: true,
    }),
    null,
  );

  const smokePackage = getCheckoutPackage("smoke-100", ADMIN_EMAIL, {
    smokeEnabled: true,
  });

  assert.deepEqual(
    smokePackage && {
      id: smokePackage.id,
      durationDays: smokePackage.durationDays,
      amount: smokePackage.amount,
      isSmoke: smokePackage.isSmoke,
    },
    { id: "smoke-100", durationDays: 1, amount: 100, isSmoke: true },
  );
});

test("keeps an existing smoke payment resolvable after checkout is disabled", () => {
  const smokePackage = getPaymentPackage("smoke-100");

  assert.equal(smokePackage?.id, "smoke-100");
  assert.equal(smokePackage?.isSmoke, true);
});

test("resolves regular and legacy packages for checkout", () => {
  assert.equal(
    getCheckoutPackage("days-30", "user@example.com")?.id,
    "days-30",
  );
  assert.equal(getPaymentPackage("start")?.id, "days-30");
});
