import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  configureRuntimeDatabaseForTests,
  getRuntimeDatabase,
  resetRuntimeDatabaseForTests,
} from "../lib/database/client.ts";
import {
  loginWithEmail,
  registerWithEmail,
  requestPasswordResetAction,
  resetPasswordAction,
} from "../app/auth/actions.ts";
import { GET as getDownload } from "../app/api/download/[number]/route.ts";
import { POST as postYooKassaWebhook } from "../app/api/payments/yookassa/route.ts";
import { createUserWithEmail, verifyPassword } from "../lib/auth/store.ts";
import { createSessionToken, SESSION_COOKIE } from "../lib/auth/session.ts";
import { createPasswordReset } from "../lib/database/repositories/password-resets.ts";
import { NextRequest } from "next/server";
import {
  createEmailRateLimitSubject,
  getNetworkRateLimitSubject,
} from "../lib/security/client-key.ts";
import {
  consumeRateLimit,
  consumeRateLimits,
} from "../lib/security/rate-limit.ts";

const legacyFiles = {
  "collections.json": "[]\n",
  "downloads.json": "[]\n",
  "password-resets.json": "[]\n",
  "payments.json": "[]\n",
  "promo-codes.json": "{\n  \"codes\": [],\n  \"referrals\": []\n}\n",
  "users.json": "[]\n",
};

async function createRuntimeFixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dj-vault-rate-limit-"));
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

async function redirectLocation(action, formData) {
  try {
    await action(formData);
    assert.fail("expected redirect");
  } catch (error) {
    return error.digest ?? error.message;
  }
}

function authForm(values) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

async function inRequestScope(cookie, callback) {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
  const [{ workAsyncStorage }, { workUnitAsyncStorage }, { RequestCookies }] =
    await Promise.all([
      import("next/dist/server/app-render/work-async-storage.external"),
      import("next/dist/server/app-render/work-unit-async-storage.external"),
      import("next/dist/server/web/spec-extension/cookies"),
    ]);
  const cookies = new RequestCookies(new Headers({ cookie }));

  return workAsyncStorage.run(
    {
      route: "/api/download/[number]",
      forceStatic: false,
      dynamicShouldError: false,
    },
    () =>
      workUnitAsyncStorage.run(
        { type: "request", cookies, phase: "render" },
        callback,
      ),
  );
}

test("allows the exact fixed-window limit then rejects with remaining count and retry time", async (t) => {
  await createRuntimeFixture(t);
  const now = 1_000_000;
  const input = {
    scope: "login:ip",
    subject: "network-subject-a",
    limit: 2,
    windowMs: 15 * 60 * 1000,
    now,
  };

  assert.deepEqual(consumeRateLimit(input), {
    allowed: true,
    remaining: 1,
    retryAfterSeconds: 0,
  });
  assert.deepEqual(consumeRateLimit(input), {
    allowed: true,
    remaining: 0,
    retryAfterSeconds: 0,
  });
  assert.deepEqual(consumeRateLimit(input), {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: 15 * 60,
  });
});

test("keeps scopes and subjects independent", async (t) => {
  await createRuntimeFixture(t);
  const common = { limit: 1, now: 2_000_000, windowMs: 60_000 };

  assert.equal(
    consumeRateLimit({ ...common, scope: "login:ip", subject: "network-a" }).allowed,
    true,
  );
  assert.equal(
    consumeRateLimit({ ...common, scope: "login:ip", subject: "network-b" }).allowed,
    true,
  );
  assert.equal(
    consumeRateLimit({ ...common, scope: "register:ip", subject: "network-a" }).allowed,
    true,
  );
  assert.equal(
    consumeRateLimit({ ...common, scope: "login:ip", subject: "network-a" }).allowed,
    false,
  );
});

test("paired limits increment every bucket only when all buckets allow", async (t) => {
  await createRuntimeFixture(t);
  const now = 2_500_000;
  const ipLimit = {
    scope: "login:ip",
    subject: "blocked-network",
    limit: 1,
    windowMs: 60_000,
  };
  const emailLimit = {
    scope: "login:email",
    subject: "victim-email",
    limit: 3,
    windowMs: 60_000,
  };

  assert.equal(consumeRateLimit({ ...ipLimit, now }).allowed, true);
  assert.equal(
    consumeRateLimits({ limits: [ipLimit, emailLimit], now }).allowed,
    false,
  );
  assert.deepEqual(consumeRateLimit({ ...emailLimit, now }), {
    allowed: true,
    remaining: 2,
    retryAfterSeconds: 0,
  });
});

test("resets at the exact expiry boundary", async (t) => {
  await createRuntimeFixture(t);
  const input = {
    scope: "password-reset:ip",
    subject: "network-subject-a",
    limit: 1,
    windowMs: 60_000,
    now: 3_000_000,
  };

  assert.equal(consumeRateLimit(input).allowed, true);
  assert.equal(consumeRateLimit(input).allowed, false);
  assert.deepEqual(
    consumeRateLimit({ ...input, now: input.now + input.windowMs }),
    { allowed: true, remaining: 0, retryAfterSeconds: 0 },
  );
});

test("removes expired rows opportunistically", async (t) => {
  await createRuntimeFixture(t);
  const db = getRuntimeDatabase();
  db.prepare(
    "INSERT INTO rate_limits (key, window_start, count, expires_at) VALUES (?, ?, ?, ?)",
  ).run("expired-key", new Date(1).toISOString(), 1, new Date(2).toISOString());

  consumeRateLimit({
    scope: "webhook:ip",
    subject: "network-subject-a",
    limit: 1,
    windowMs: 60_000,
    now: 4_000_000,
  });

  assert.equal(
    db.prepare("SELECT count(*) AS count FROM rate_limits WHERE key = ?").get("expired-key")
      .count,
    0,
  );
});

test("resets the current expired key even when bounded cleanup has other expired rows first", async (t) => {
  await createRuntimeFixture(t);
  const db = getRuntimeDatabase();
  const expiredAt = new Date(2).toISOString();
  const insert = db.prepare(
    "INSERT INTO rate_limits (key, window_start, count, expires_at) VALUES (?, ?, ?, ?)",
  );

  for (let index = 0; index < 100; index += 1) {
    insert.run(`expired-${index}`, new Date(1).toISOString(), 1, expiredAt);
  }
  insert.run(
    "rate-limit:v1:boundary:late-expired-subject",
    new Date(1).toISOString(),
    1,
    expiredAt,
  );

  assert.deepEqual(
    consumeRateLimit({
      scope: "boundary",
      subject: "late-expired-subject",
      limit: 1,
      windowMs: 60_000,
      now: 4_000_000,
    }),
    { allowed: true, remaining: 0, retryAfterSeconds: 0 },
  );
});

test("hashes normalized email and network subjects before persisting rate-limit rows", async (t) => {
  await createRuntimeFixture(t);
  const rawEmail = "Person@Example.com";
  const rawIp = "203.0.113.7";
  const emailSubject = createEmailRateLimitSubject(` ${rawEmail} `);
  const networkSubject = getNetworkRateLimitSubject(
    new Headers({ "x-forwarded-for": `invalid, ${rawIp}, 198.51.100.3` }),
  );

  assert.equal(emailSubject, createEmailRateLimitSubject(rawEmail.toLowerCase()));
  assert.equal(
    networkSubject,
    getNetworkRateLimitSubject(new Headers({ "x-real-ip": rawIp })),
  );
  assert.equal(
    getNetworkRateLimitSubject(new Headers({ "x-forwarded-for": "not-an-address" })),
    getNetworkRateLimitSubject(new Headers()),
  );

  consumeRateLimit({
    scope: "login:email",
    subject: emailSubject,
    limit: 1,
    windowMs: 60_000,
    now: 5_000_000,
  });
  consumeRateLimit({
    scope: "login:ip",
    subject: networkSubject,
    limit: 1,
    windowMs: 60_000,
    now: 5_000_000,
  });

  const keys = getRuntimeDatabase()
    .prepare("SELECT key FROM rate_limits ORDER BY key")
    .all()
    .map((row) => row.key)
    .join("\n");

  assert.equal(keys.includes(rawEmail), false);
  assert.equal(keys.includes(rawEmail.toLowerCase()), false);
  assert.equal(keys.includes(rawIp), false);
});

test("caps oversized forwarding input before parsing and falls back safely", () => {
  const unknownSubject = getNetworkRateLimitSubject(new Headers());
  const oversizedForwardingValue = `${"x".repeat(1024)},203.0.113.44`;

  assert.equal(
    getNetworkRateLimitSubject(
      new Headers({ "x-forwarded-for": oversizedForwardingValue }),
    ),
    unknownSubject,
  );
});

test("registration rate limiting blocks user creation with the rate-limited outcome", async (t) => {
  await createRuntimeFixture(t);

  for (let index = 0; index < 8; index += 1) {
    const formData = new FormData();
    formData.set("name", `Person ${index}`);
    formData.set("email", `person-${index}@example.com`);
    formData.set("password", "0123456789");
    await redirectLocation(registerWithEmail, formData);
  }

  const rejected = new FormData();
  rejected.set("name", "Blocked Person");
  rejected.set("email", "blocked@example.com");
  rejected.set("password", "0123456789");

  assert.match(await redirectLocation(registerWithEmail, rejected), /error=rate_limited/);
  assert.equal(
    getRuntimeDatabase().prepare("SELECT count(*) AS count FROM users").get().count,
    8,
  );
});

test("login email limiting rejects before a valid password can create a session", async (t) => {
  await createRuntimeFixture(t);
  await createUserWithEmail({
    email: "login-limit@example.com",
    password: "0123456789",
  });

  for (let index = 0; index < 8; index += 1) {
    await redirectLocation(
      loginWithEmail,
      authForm({ email: "login-limit@example.com", password: "wrong-password" }),
    );
  }

  assert.match(
    await redirectLocation(
      loginWithEmail,
      authForm({ email: "login-limit@example.com", password: "0123456789" }),
    ),
    /error=rate_limited/,
  );
});

test("login allows exactly ten attempts per IP when emails vary", async (t) => {
  await createRuntimeFixture(t);

  for (let index = 0; index < 10; index += 1) {
    assert.match(
      await redirectLocation(
        loginWithEmail,
        authForm({ email: `login-ip-${index}@example.com`, password: "wrong-password" }),
      ),
      /error=invalid_login/,
    );
  }

  assert.match(
    await redirectLocation(
      loginWithEmail,
      authForm({ email: "login-ip-rejected@example.com", password: "wrong-password" }),
    ),
    /error=rate_limited/,
  );
});

test("a blocked login IP cannot consume a victim email quota", async (t) => {
  await createRuntimeFixture(t);
  const networkSubject = getNetworkRateLimitSubject(new Headers());
  const victimSubject = createEmailRateLimitSubject("victim@example.com");

  for (let index = 0; index < 10; index += 1) {
    consumeRateLimit({
      scope: "login:ip",
      subject: networkSubject,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
  }

  await redirectLocation(
    loginWithEmail,
    authForm({ email: "victim@example.com", password: "wrong-password" }),
  );

  assert.deepEqual(
    consumeRateLimit({
      scope: "login:email",
      subject: victimSubject,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    }),
    { allowed: true, remaining: 7, retryAfterSeconds: 0 },
  );
});

test("password-reset email limiting returns a rate-limited outcome without creating another reset", async (t) => {
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
    email: "reset-request-limit@example.com",
    password: "0123456789",
  });

  for (let index = 0; index < 3; index += 1) {
    await redirectLocation(
      requestPasswordResetAction,
      authForm({ email: "reset-request-limit@example.com" }),
    );
  }

  assert.match(
    await redirectLocation(
      requestPasswordResetAction,
      authForm({ email: "reset-request-limit@example.com" }),
    ),
    /forgot-password\?error=rate_limited/,
  );
  const outbox = JSON.parse(await readFile(path.join(directory, "mail-outbox.json"), "utf8"));
  assert.equal(outbox.length, 3);
});

test("password-reset request allows exactly five attempts per IP when emails vary", async (t) => {
  await createRuntimeFixture(t);

  for (let index = 0; index < 5; index += 1) {
    assert.match(
      await redirectLocation(
        requestPasswordResetAction,
        authForm({ email: `reset-ip-${index}@example.com` }),
      ),
      /forgot-password\?sent=1/,
    );
  }

  assert.match(
    await redirectLocation(
      requestPasswordResetAction,
      authForm({ email: "reset-ip-rejected@example.com" }),
    ),
    /forgot-password\?error=rate_limited/,
  );
});

test("password-reset submission limiting leaves a valid reset token unused", async (t) => {
  await createRuntimeFixture(t);
  const user = await createUserWithEmail({
    email: "reset-submit-limit@example.com",
    password: "0123456789",
  });

  for (let index = 0; index < 10; index += 1) {
    await redirectLocation(
      resetPasswordAction,
      authForm({ token: `invalid-token-${index}`, password: "new-password" }),
    );
  }

  const validToken = "valid-reset-token";
  createPasswordReset({
    userId: user.id,
    email: user.email,
    tokenHash: createHash("sha256").update(validToken).digest("hex"),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });

  assert.match(
    await redirectLocation(
      resetPasswordAction,
      authForm({ token: validToken, password: "new-password" }),
    ),
    /error=rate_limited/,
  );
  const row = getRuntimeDatabase()
    .prepare("SELECT password_hash, used_at FROM password_resets JOIN users ON users.id = password_resets.user_id WHERE token_hash = ?")
    .get(createHash("sha256").update(validToken).digest("hex"));
  assert.equal(await verifyPassword("new-password", row.password_hash), false);
  assert.equal(row.used_at, null);
});

test("YooKassa webhook keeps normal acknowledgements and returns a generic retry response at its limit", async (t) => {
  await createRuntimeFixture(t);

  function webhookRequest() {
    return new Request("https://djvault.ru/api/payments/yookassa", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.99",
      },
      body: JSON.stringify({ event: "refund.succeeded", object: { id: "ignored" } }),
    });
  }

  const first = await postYooKassaWebhook(webhookRequest());
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { ok: true });

  for (let index = 1; index < 120; index += 1) {
    assert.equal((await postYooKassaWebhook(webhookRequest())).status, 200);
  }

  const rejected = await postYooKassaWebhook(webhookRequest());
  assert.equal(rejected.status, 429);
  assert.equal(rejected.headers.get("Retry-After"), "60");
  assert.deepEqual(await rejected.json(), { error: "rate_limit" });
});

test("download creation returns a generic retry response before its existing S3 behavior", async (t) => {
  await createRuntimeFixture(t);
  const user = await createUserWithEmail({
    email: "download-limit@example.com",
    password: "0123456789",
  });

  for (let index = 0; index < 30; index += 1) {
    consumeRateLimit({
      scope: "download:user",
      subject: user.id,
      limit: 30,
      windowMs: 60_000,
    });
  }

  const response = await inRequestScope(
    `${SESSION_COOKIE}=${createSessionToken(user.id, 0)}`,
    () =>
      getDownload(
        new NextRequest("https://djvault.ru/api/download/demo?format=json"),
        { params: Promise.resolve({ number: "demo" }) },
      ),
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.deepEqual(await response.json(), { error: "rate_limit" });
});
