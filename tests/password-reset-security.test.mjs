import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  configureRuntimeDatabaseForTests,
  getRuntimeDatabase,
  resetRuntimeDatabaseForTests,
} from "../lib/database/client.ts";
import {
  createUserWithEmail,
  registerEmailUserWithReferral,
  verifyPassword,
} from "../lib/auth/store.ts";
import { resetPasswordByToken } from "../lib/auth/password-reset.ts";
import { createPasswordReset } from "../lib/database/repositories/password-resets.ts";
import { sendEmail } from "../lib/email/send.ts";
import { createSessionToken, resolveSessionUser } from "../lib/auth/session.ts";
import { requestPasswordResetAction } from "../app/auth/actions.ts";

const legacyFiles = {
  "collections.json": "[]\n",
  "downloads.json": "[]\n",
  "password-resets.json": "[]\n",
  "payments.json": "[]\n",
  "promo-codes.json": "{\n  \"codes\": [],\n  \"referrals\": []\n}\n",
  "users.json": "[]\n",
};

async function createRuntimeFixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dj-vault-reset-security-"));
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

  return directory;
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function createReset(user, token) {
  createPasswordReset({
    userId: user.id,
    email: user.email,
    tokenHash: tokenHash(token),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
}

test("registration and reset passwords require ten characters", async (t) => {
  await createRuntimeFixture(t);

  await assert.rejects(
    registerEmailUserWithReferral({
      email: "too-short@example.com",
      password: "123456789",
    }),
    /PASSWORD_TOO_SHORT/,
  );
  await assert.doesNotReject(
    registerEmailUserWithReferral({
      email: "long-enough@example.com",
      password: "0123456789",
    }),
  );
  await assert.rejects(resetPasswordByToken("unused", "123456789"), /PASSWORD_TOO_SHORT/);
});

test("one reset token changes a password and session version exactly once", async (t) => {
  await createRuntimeFixture(t);
  const user = await createUserWithEmail({
    email: "reset@example.com",
    password: "0123456789",
  });
  const token = "single-use-token";
  createReset(user, token);

  const results = await Promise.allSettled([
    resetPasswordByToken(token, "new-password"),
    resetPasswordByToken(token, "new-password"),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const row = getRuntimeDatabase()
    .prepare("SELECT password_hash, session_version FROM users WHERE id = ?")
    .get(user.id);
  assert.equal(await verifyPassword("new-password", row.password_hash), true);
  assert.equal(row.session_version, 1);
});

test("a password reset invalidates a previously issued session", async (t) => {
  await createRuntimeFixture(t);
  const user = await createUserWithEmail({
    email: "revoked@example.com",
    password: "0123456789",
  });
  const token = "revoke-session-token";
  const session = createSessionToken(user.id, 0, Date.now() + 60_000);
  createReset(user, token);

  assert.equal((await resolveSessionUser(session))?.id, user.id);
  await resetPasswordByToken(token, "new-password");
  assert.equal(await resolveSessionUser(session), null);
});

test("production SMTP errors create no plaintext outbox while development keeps one", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dj-vault-mail-security-"));
  const originalEnvironment = process.env.NODE_ENV;
  const originalDataDirectory = process.env.DATA_DIRECTORY;
  const originalSmtpHost = process.env.SMTP_HOST;
  const originalSmtpUser = process.env.SMTP_USER;
  const originalSmtpPass = process.env.SMTP_PASS;

  t.after(async () => {
    for (const [key, value] of Object.entries({
      NODE_ENV: originalEnvironment,
      DATA_DIRECTORY: originalDataDirectory,
      SMTP_HOST: originalSmtpHost,
      SMTP_USER: originalSmtpUser,
      SMTP_PASS: originalSmtpPass,
    })) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    await rm(directory, { force: true, recursive: true });
  });

  process.env.DATA_DIRECTORY = directory;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  process.env.NODE_ENV = "production";

  await assert.rejects(
    sendEmail({ to: "account@example.com", subject: "Reset", text: "token=private-token" }),
    /SMTP_NOT_CONFIGURED/,
  );
  await assert.rejects(access(path.join(directory, "mail-outbox.json")));

  process.env.NODE_ENV = "test";
  await assert.doesNotReject(
    sendEmail({ to: "account@example.com", subject: "Reset", text: "token=private-token" }),
  );
  assert.match(await readFile(path.join(directory, "mail-outbox.json"), "utf8"), /private-token/);
});

test("password reset requests redirect identically for existing and unknown accounts", async (t) => {
  const directory = await createRuntimeFixture(t);
  const originalDataDirectory = process.env.DATA_DIRECTORY;
  process.env.DATA_DIRECTORY = directory;
  t.after(() => {
    if (originalDataDirectory === undefined) {
      delete process.env.DATA_DIRECTORY;
    } else {
      process.env.DATA_DIRECTORY = originalDataDirectory;
    }
  });

  await createUserWithEmail({
    email: "known-account@example.com",
    password: "0123456789",
  });

  async function redirectLocation(email) {
    const formData = new FormData();
    formData.set("email", email);

    try {
      await requestPasswordResetAction(formData);
      assert.fail("expected redirect");
    } catch (error) {
      return error.digest ?? error.message;
    }
  }

  assert.equal(
    await redirectLocation("known-account@example.com"),
    await redirectLocation("unknown-account@example.com"),
  );
});
