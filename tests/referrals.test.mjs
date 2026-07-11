import test from "node:test";
import assert from "node:assert/strict";

import {
  isPaidPlan,
  normalizePromoCode,
  summarizePromoCode,
} from "../lib/referrals/store.ts";

test("normalizes promo codes for consistent matching", () => {
  assert.equal(normalizePromoCode("  dj vault 10 "), "DJVAULT10");
});

test("counts only paid plans as referral conversions", () => {
  assert.equal(isPaidPlan("free"), false);
  assert.equal(isPaidPlan("start"), true);
  assert.equal(isPaidPlan("pro"), true);
  assert.equal(isPaidPlan("premium"), true);
});

test("summarizes promo code dashboard counts", () => {
  assert.deepEqual(
    summarizePromoCode({
      code: {
        id: "code-1",
        code: "NIKITA",
        ownerUserId: "owner-1",
        isActive: true,
        createdAt: "2026-07-11T00:00:00.000Z",
        updatedAt: "2026-07-11T00:00:00.000Z",
      },
      owner: {
        id: "owner-1",
        email: "owner@example.com",
        name: "Никита",
        plan: "free",
        providers: ["email"],
        createdAt: "2026-07-11T00:00:00.000Z",
      },
      referrals: [],
      registeredCount: 4,
      paidCount: 2,
    }),
    {
      code: "NIKITA",
      ownerName: "Никита",
      registeredCount: 4,
      paidCount: 2,
    },
  );
});
