import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as downloadRoute from "../app/api/download/[number]/route.ts";
import { createUserWithEmail } from "../lib/auth/store.ts";
import { createSessionToken, SESSION_COOKIE } from "../lib/auth/session.ts";
import {
  configureRuntimeDatabaseForTests,
  getRuntimeDatabase,
  resetRuntimeDatabaseForTests,
} from "../lib/database/client.ts";
import {
  getDownloadRecord,
  registerDownloadAttempt,
} from "../lib/downloads/store.ts";
import { consumeRateLimit } from "../lib/security/rate-limit.ts";
import { NextRequest } from "next/server";

const legacyFiles = {
  "collections.json": `${JSON.stringify([
    {
      number: "demo",
      date: "8 July 2026",
      size: "300 MB",
      genres: "House",
      tracks: "10 tracks",
      s3Key: "archives/demo.zip",
      isActive: true,
      downloadLimit: 2,
    },
    {
      number: "027",
      date: "8 July 2026",
      size: "4 GB",
      genres: "House",
      tracks: "100 tracks",
      s3Key: "archives/027.zip",
      isActive: true,
      downloadLimit: 2,
    },
  ])}\n`,
  "downloads.json": "[]\n",
  "password-resets.json": "[]\n",
  "payments.json": "[]\n",
  "promo-codes.json": "{\n  \"codes\": [], \"referrals\": []\n}\n",
  "users.json": "[]\n",
};

async function createRuntimeFixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dj-vault-download-route-"));
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

function configureS3(t) {
  const values = {
    S3_ENDPOINT: "https://storage.example.test",
    S3_REGION: "ru-1",
    S3_BUCKET: "dj-vault",
    S3_ACCESS_KEY: "test-access-key",
    S3_SECRET_KEY: "test-secret-key",
  };
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );

  Object.assign(process.env, values);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

function mockS3Metadata(t, status = 200) {
  const calls = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (_input, init) => {
    calls.push(init?.method ?? "GET");
    return new Response(status === 200 ? "" : "missing", {
      status,
      statusText: status === 200 ? "OK" : "Not Found",
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  return calls;
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

async function invokeDownload({ method, number, user }) {
  const handler = downloadRoute[method];
  assert.equal(typeof handler, "function", `${method} handler must exist`);
  const cookie = user
    ? `${SESSION_COOKIE}=${createSessionToken(user.id, 0)}`
    : "";

  return inRequestScope(cookie, () =>
    handler(
      new NextRequest(
        `https://djvault.ru/api/download/${number}?format=json`,
        { method, headers: { "user-agent": "Download route test" } },
      ),
      { params: Promise.resolve({ number }) },
    ),
  );
}

async function createUser(email) {
  return createUserWithEmail({ email, password: "download-route-password" });
}

function grantClubAccess(user) {
  getRuntimeDatabase()
    .prepare("UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?")
    .run("club", "2026-12-31T00:00:00.000Z", user.id);
}

test("GET returns 405 and leaves the download count unchanged", async (t) => {
  await createRuntimeFixture(t);
  configureS3(t);
  const s3Calls = mockS3Metadata(t);
  const user = await createUser("get-download@example.com");
  grantClubAccess(user);
  await registerDownloadAttempt({
    archiveId: "027",
    ipAddress: "192.0.2.10",
    limit: 2,
    userAgent: "Download route test",
    userId: user.id,
  });

  const response = await invokeDownload({ method: "GET", number: "027", user });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "POST");
  assert.equal((await getDownloadRecord(user.id, "027"))?.downloadCount, 1);
  assert.deepEqual(s3Calls, []);
});

test("authorized POST validates metadata then increments exactly once", async (t) => {
  await createRuntimeFixture(t);
  configureS3(t);
  const s3Calls = mockS3Metadata(t);
  const user = await createUser("post-download@example.com");
  grantClubAccess(user);

  const response = await invokeDownload({ method: "POST", number: "027", user });

  assert.equal(response.status, 200);
  assert.deepEqual(s3Calls, ["HEAD"]);
  const result = await response.json();
  assert.match(result.downloadUrl, /^https:\/\/dj-vault\.storage\.example\.test\//);
  assert.equal(result.remaining, 1);
  assert.equal((await getDownloadRecord(user.id, "027"))?.downloadCount, 1);
});

test("S3 metadata failure returns storage error before business accounting", async (t) => {
  await createRuntimeFixture(t);
  configureS3(t);
  const s3Calls = mockS3Metadata(t, 404);
  const user = await createUser("metadata-failure@example.com");
  grantClubAccess(user);

  const response = await invokeDownload({ method: "POST", number: "027", user });

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "storage" });
  assert.deepEqual(s3Calls, ["HEAD"]);
  assert.equal(await getDownloadRecord(user.id, "027"), null);
});

test("an exhausted business limit returns 429 without another increment", async (t) => {
  await createRuntimeFixture(t);
  configureS3(t);
  const s3Calls = mockS3Metadata(t);
  const user = await createUser("business-limit@example.com");
  grantClubAccess(user);

  for (let index = 0; index < 2; index += 1) {
    await registerDownloadAttempt({
      archiveId: "027",
      ipAddress: "192.0.2.11",
      limit: 2,
      userAgent: "Download route test",
      userId: user.id,
    });
  }

  const response = await invokeDownload({ method: "POST", number: "027", user });

  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { error: "limit", remaining: 0 });
  assert.deepEqual(s3Calls, ["HEAD"]);
  assert.equal((await getDownloadRecord(user.id, "027"))?.downloadCount, 2);
});

test("guest, free, club, and demo access rules remain unchanged", async (t) => {
  await createRuntimeFixture(t);
  configureS3(t);
  const s3Calls = mockS3Metadata(t);
  const freeUser = await createUser("free-demo@example.com");
  const clubUser = await createUser("club-collection@example.com");
  grantClubAccess(clubUser);

  const guest = await invokeDownload({ method: "POST", number: "demo", user: null });
  assert.equal(guest.status, 307);
  assert.match(guest.headers.get("location") ?? "", /\/login$/);

  const freeCollection = await invokeDownload({
    method: "POST",
    number: "027",
    user: freeUser,
  });
  assert.equal(freeCollection.status, 307);
  assert.match(freeCollection.headers.get("location") ?? "", /\/pricing$/);

  const freeDemo = await invokeDownload({ method: "POST", number: "demo", user: freeUser });
  assert.equal(freeDemo.status, 200);
  assert.equal((await getDownloadRecord(freeUser.id, "demo"))?.downloadCount, 1);

  const clubCollection = await invokeDownload({
    method: "POST",
    number: "027",
    user: clubUser,
  });
  assert.equal(clubCollection.status, 200);
  assert.equal((await getDownloadRecord(clubUser.id, "027"))?.downloadCount, 1);
  assert.deepEqual(s3Calls, ["HEAD", "HEAD"]);
});

test("rate limiting rejects before S3 metadata or accounting and keeps Retry-After", async (t) => {
  await createRuntimeFixture(t);
  configureS3(t);
  const s3Calls = mockS3Metadata(t);
  const user = await createUser("rate-limited-download@example.com");

  for (let index = 0; index < 30; index += 1) {
    consumeRateLimit({
      scope: "download:user",
      subject: user.id,
      limit: 30,
      windowMs: 60 * 1000,
    });
  }

  const response = await invokeDownload({ method: "POST", number: "demo", user });

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.deepEqual(await response.json(), { error: "rate_limit" });
  assert.deepEqual(s3Calls, []);
  assert.equal(await getDownloadRecord(user.id, "demo"), null);
});
