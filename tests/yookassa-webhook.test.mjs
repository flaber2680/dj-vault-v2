import test from "node:test";
import assert from "node:assert/strict";

import { getYooKassaWebhookPaymentId } from "../lib/payments/webhook.ts";

test("accepts succeeded and canceled payment notifications", () => {
  assert.equal(
    getYooKassaWebhookPaymentId({
      event: "payment.succeeded",
      object: { id: "payment-1" },
    }),
    "payment-1",
  );
  assert.equal(
    getYooKassaWebhookPaymentId({
      event: "payment.canceled",
      object: { id: "payment-2" },
    }),
    "payment-2",
  );
});

test("ignores unsupported events", () => {
  assert.equal(
    getYooKassaWebhookPaymentId({
      event: "refund.succeeded",
      object: { id: "refund-1" },
    }),
    null,
  );
});

test("ignores malformed payloads", () => {
  assert.equal(getYooKassaWebhookPaymentId(null), null);
  assert.equal(getYooKassaWebhookPaymentId({}), null);
  assert.equal(
    getYooKassaWebhookPaymentId({ event: "payment.succeeded", object: {} }),
    null,
  );
});
