import test from "node:test";
import assert from "node:assert/strict";

import { applyPaymentAccessGrant } from "../lib/payments/access-grant.ts";

const now = new Date("2026-07-13T12:00:00.000Z");

test("grants paid access and records the provider payment id", () => {
  const result = applyPaymentAccessGrant(
    { plan: "free" },
    "payment-1",
    30,
    now,
  );

  assert.equal(result.activated, true);
  assert.deepEqual(result.record, {
    plan: "club",
    planExpiresAt: "2026-08-12T12:00:00.000Z",
    activatedPaymentIds: ["payment-1"],
  });
});

test("does not grant access twice for the same provider payment id", () => {
  const record = {
    plan: "club",
    planExpiresAt: "2026-08-12T12:00:00.000Z",
    activatedPaymentIds: ["payment-1"],
  };
  const result = applyPaymentAccessGrant(record, "payment-1", 30, now);

  assert.equal(result.activated, false);
  assert.deepEqual(result.record, record);
  assert.notEqual(result.record, record);
});

test("extends active access for a different payment id", () => {
  const result = applyPaymentAccessGrant(
    {
      plan: "club",
      planExpiresAt: "2026-08-12T12:00:00.000Z",
      activatedPaymentIds: ["payment-1"],
    },
    "payment-2",
    90,
    now,
  );

  assert.equal(result.activated, true);
  assert.equal(result.record.planExpiresAt, "2026-11-10T12:00:00.000Z");
  assert.deepEqual(result.record.activatedPaymentIds, ["payment-1", "payment-2"]);
});
