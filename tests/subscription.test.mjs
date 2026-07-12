import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateAdminAccessChange,
  calculateExtendedExpiration,
  hasClubAccess,
  migrateLegacyAccessPlans,
  normalizeAccessPlan,
} from "../lib/access/subscription.ts";

test("normalizes every legacy paid tier to club", () => {
  for (const plan of ["start", "pro", "premium", "club"]) {
    assert.equal(normalizeAccessPlan(plan), "club");
  }

  assert.equal(normalizeAccessPlan("free"), "free");
  assert.equal(normalizeAccessPlan(undefined), "free");
});

test("extends active access from its expiration", () => {
  assert.equal(
    calculateExtendedExpiration(
      "2026-08-01T00:00:00.000Z",
      30,
      new Date("2026-07-12T00:00:00.000Z"),
    ),
    "2026-08-31T00:00:00.000Z",
  );
});

test("starts expired access from now", () => {
  assert.equal(
    calculateExtendedExpiration(
      "2026-07-01T00:00:00.000Z",
      30,
      new Date("2026-07-12T00:00:00.000Z"),
    ),
    "2026-08-11T00:00:00.000Z",
  );
});

test("requires days when free becomes club", () => {
  assert.throws(
    () =>
      calculateAdminAccessChange({
        currentPlan: "free",
        nextPlan: "club",
        days: 0,
      }),
    /ACCESS_DAYS_REQUIRED/,
  );
});

test("clears expiration when club becomes free", () => {
  assert.deepEqual(
    calculateAdminAccessChange({
      currentPlan: "club",
      currentExpiresAt: "2026-08-01T00:00:00.000Z",
      nextPlan: "free",
      days: 0,
    }),
    { plan: "free", planExpiresAt: undefined },
  );
});

test("keeps club expiration when no days are added", () => {
  assert.deepEqual(
    calculateAdminAccessChange({
      currentPlan: "club",
      currentExpiresAt: "2026-08-01T00:00:00.000Z",
      nextPlan: "club",
      days: 0,
    }),
    { plan: "club", planExpiresAt: "2026-08-01T00:00:00.000Z" },
  );
});

test("rejects days on free without changing to club", () => {
  assert.throws(
    () =>
      calculateAdminAccessChange({
        currentPlan: "free",
        nextPlan: "free",
        days: 10,
      }),
    /ACCESS_DAYS_NOT_ALLOWED/,
  );
});

for (const days of [-1, 1.5, 3651, Number.NaN]) {
  test(`rejects invalid admin days ${days}`, () => {
    assert.throws(
      () =>
        calculateAdminAccessChange({
          currentPlan: "club",
          nextPlan: "club",
          days,
        }),
      /ACCESS_DAYS_INVALID/,
    );
  });
}

test("checks both club state and expiration", () => {
  const now = new Date("2026-07-12T00:00:00.000Z");

  assert.equal(
    hasClubAccess(
      { plan: "club", planExpiresAt: "2026-07-13T00:00:00.000Z" },
      now,
    ),
    true,
  );
  assert.equal(
    hasClubAccess(
      { plan: "club", planExpiresAt: "2026-07-11T00:00:00.000Z" },
      now,
    ),
    false,
  );
  assert.equal(
    hasClubAccess(
      { plan: "free", planExpiresAt: "2026-07-13T00:00:00.000Z" },
      now,
    ),
    false,
  );
});

test("migrates legacy records without changing expiration dates", () => {
  const input = [
    {
      id: "u1",
      plan: "pro",
      planExpiresAt: "2026-09-01T00:00:00.000Z",
    },
    { id: "u2", plan: "free" },
  ];
  const migration = migrateLegacyAccessPlans(input);

  assert.deepEqual(migration, {
    changed: true,
    users: [
      {
        id: "u1",
        plan: "club",
        planExpiresAt: "2026-09-01T00:00:00.000Z",
      },
      { id: "u2", plan: "free" },
    ],
  });
  assert.deepEqual(migrateLegacyAccessPlans(migration.users), {
    changed: false,
    users: migration.users,
  });
});
