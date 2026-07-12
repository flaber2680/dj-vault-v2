import test from "node:test";
import assert from "node:assert/strict";

import {
  formatReferralPurchase,
  isPaidPlan,
  normalizePromoCode,
  summarizePromoCode,
} from "../lib/referrals/store.ts";

test("normalizes promo codes for consistent matching", () => {
  assert.equal(normalizePromoCode("  dj vault 10 "), "DJVAULT10");
});

test("counts only paid plans as referral conversions", () => {
  assert.equal(isPaidPlan("free"), false);
  assert.equal(isPaidPlan("club"), true);
  assert.equal(isPaidPlan("start"), true);
  assert.equal(isPaidPlan("pro"), true);
  assert.equal(isPaidPlan("premium"), true);
});

test("formats a new referral conversion as purchased time and amount", () => {
  assert.equal(
    formatReferralPurchase({
      convertedPackageId: "days-90",
      convertedDurationDays: 90,
      convertedAmount: 2700,
    }),
    "90 дней · 2700 ₽",
  );
});

test("formats legacy referral plans through package compatibility", () => {
  assert.equal(
    formatReferralPurchase({ convertedPlan: "premium" }),
    "180 дней · 4800 ₽",
  );
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
