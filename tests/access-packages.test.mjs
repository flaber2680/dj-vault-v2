import test from "node:test";
import assert from "node:assert/strict";

import {
  accessPackageList,
  getAccessPackage,
} from "../lib/content/plans.ts";

test("offers the three approved day packages", () => {
  assert.deepEqual(
    accessPackageList.map(({ id, durationDays, amount }) => ({
      id,
      durationDays,
      amount,
    })),
    [
      { id: "days-30", durationDays: 30, amount: 1000 },
      { id: "days-90", durationDays: 90, amount: 2700 },
      { id: "days-180", durationDays: 180, amount: 4800 },
    ],
  );
});

test("maps legacy product ids without changing duration", () => {
  assert.equal(getAccessPackage("start")?.id, "days-30");
  assert.equal(getAccessPackage("pro")?.id, "days-90");
  assert.equal(getAccessPackage("premium")?.id, "days-180");
});

test("rejects unknown package ids", () => {
  assert.equal(getAccessPackage("unknown"), null);
  assert.equal(getAccessPackage(undefined), null);
});
