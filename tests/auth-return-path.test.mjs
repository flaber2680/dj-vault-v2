import test from "node:test";
import assert from "node:assert/strict";

import { normalizeAuthReturnPath } from "../lib/auth/return-path.ts";

test("keeps a local collections return path with query and hash", () => {
  assert.equal(
    normalizeAuthReturnPath("/collections?demo=ready#demo-download"),
    "/collections?demo=ready#demo-download",
  );
});

test("rejects external and protocol-relative destinations", () => {
  assert.equal(normalizeAuthReturnPath("https://evil.example"), undefined);
  assert.equal(normalizeAuthReturnPath("//evil.example/path"), undefined);
  assert.equal(normalizeAuthReturnPath("/\\evil.example/path"), undefined);
  assert.equal(normalizeAuthReturnPath("collections"), undefined);
});

test("rejects authentication loops and control characters", () => {
  assert.equal(normalizeAuthReturnPath("/login?next=/collections"), undefined);
  assert.equal(normalizeAuthReturnPath("/register"), undefined);
  assert.equal(normalizeAuthReturnPath("/collections\n/other"), undefined);
});
