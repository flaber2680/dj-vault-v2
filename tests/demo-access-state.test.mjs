import assert from "node:assert/strict";
import test from "node:test";

import { getDemoAccessState } from "../lib/content/demo-access.ts";

test("hides demo for a paid club member", () => {
  assert.equal(
    getDemoAccessState({ hasPaidPlan: true, hasUser: true, hasArchive: true }),
    "hidden",
  );
});

test("reports an unavailable demo when the archive is missing", () => {
  assert.equal(
    getDemoAccessState({ hasPaidPlan: false, hasUser: false, hasArchive: false }),
    "unavailable",
  );
});

test("asks a guest to register when the demo archive exists", () => {
  assert.equal(
    getDemoAccessState({ hasPaidPlan: false, hasUser: false, hasArchive: true }),
    "register",
  );
});

test("allows a free user to download the demo archive", () => {
  assert.equal(
    getDemoAccessState({ hasPaidPlan: false, hasUser: true, hasArchive: true }),
    "download",
  );
});
