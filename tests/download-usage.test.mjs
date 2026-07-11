import test from "node:test";
import assert from "node:assert/strict";

import { getDownloadUsageSummary } from "../lib/downloads/usage.ts";

test("summarizes download usage with remaining count", () => {
  assert.deepEqual(
    getDownloadUsageSummary({ downloadCount: 1 }, 2),
    {
      used: 1,
      limit: 2,
      remaining: 1,
      label: "1 / 2 / 1",
    },
  );
});

test("treats a missing record as no downloads used", () => {
  assert.deepEqual(getDownloadUsageSummary(null, 2), {
    used: 0,
    limit: 2,
    remaining: 2,
    label: "0 / 2 / 2",
  });
});

test("never reports a negative remaining count", () => {
  assert.deepEqual(
    getDownloadUsageSummary({ downloadCount: 5 }, 2),
    {
      used: 5,
      limit: 2,
      remaining: 0,
      label: "5 / 2 / 0",
    },
  );
});
