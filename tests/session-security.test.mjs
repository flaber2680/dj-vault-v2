import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  configureRuntimeDatabaseForTests,
  getRuntimeDatabase,
  resetRuntimeDatabaseForTests,
} from "../lib/database/client.ts";
import { createUserWithEmail } from "../lib/auth/store.ts";
import {
  createSessionToken,
  getSessionSecret,
  resolveSessionUser,
  verifySessionToken,
} from "../lib/auth/session.ts";

const legacyFiles = {
  "collections.json": "[]\n",
  "downloads.json": "[]\n",
  "password-resets.json": "[]\n",
  "payments.json": "[]\n",
  "promo-codes.json": "{\n  \"codes\": [],\n  \"referrals\": []\n}\n",
  "users.json": "[]\n",
};

async function createRuntimeFixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dj-vault-session-security-"));
  const databasePath = path.join(directory, "runtime.sqlite");

  await Promise.all(
    Object.entries(legacyFiles).map(([fileName, contents]) =>
      writeFile(path.join(directory, fileName), contents, "utf8"),
    ),
  );

  configureRuntimeDatabaseForTests({ dataDirectory: directory, databasePath });
  t.after(async () => {
    resetRuntimeDatabaseForTests();
    await rm(directory, { force: true, recursive: true });
  });
}

test("production requires an AUTH_SECRET of at least 32 characters while development has a local fallback", () => {
  assert.throws(
    () => getSessionSecret("production", undefined),
    /AUTH_SECRET must be at least 32 characters in production/,
  );
  assert.throws(
    () => getSessionSecret("production", "too-short"),
    /AUTH_SECRET must be at least 32 characters in production/,
  );
  assert.equal(getSessionSecret("development", undefined).length >= 32, true);
});

test("a current session version resolves and a newer version revokes the token", async (t) => {
  await createRuntimeFixture(t);
  const user = await createUserWithEmail({
    email: "session@example.com",
    password: "0123456789",
  });
  const expiresAt = Date.now() + 60_000;
  const token = createSessionToken(user.id, 0, expiresAt);

  assert.deepEqual(verifySessionToken(token), {
    userId: user.id,
    sessionVersion: 0,
    expiresAt,
  });
  assert.equal((await resolveSessionUser(token))?.id, user.id);

  getRuntimeDatabase()
    .prepare("UPDATE users SET session_version = session_version + 1 WHERE id = ?")
    .run(user.id);

  assert.equal(await resolveSessionUser(token), null);
});

test("session signatures and expiry remain enforced", async (t) => {
  await createRuntimeFixture(t);
  const user = await createUserWithEmail({
    email: "session-checks@example.com",
    password: "0123456789",
  });
  const token = createSessionToken(user.id, 0, Date.now() + 60_000);
  const expired = createSessionToken(user.id, 0, Date.now() - 1);

  assert.equal(verifySessionToken(`${token}x`), null);
  assert.equal(verifySessionToken(expired), null);
});
