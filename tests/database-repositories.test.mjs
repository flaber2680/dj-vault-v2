import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Worker } from "node:worker_threads";

import {
  configureRuntimeDatabaseForTests,
  getRuntimeDatabase,
  resetRuntimeDatabaseForTests,
} from "../lib/database/client.ts";
import {
  createUserWithEmail,
  findUserByEmail,
  getUsers,
  registerEmailUserWithReferral,
} from "../lib/auth/store.ts";
import * as authStore from "../lib/auth/store.ts";
import {
  createStoredPayment,
  findStoredPaymentById,
  findStoredPaymentByProviderId,
  updateStoredPayment,
} from "../lib/payments/store.ts";
import { activateYooKassaPayment } from "../lib/payments/activate.ts";
import {
  createPromoCodeForUser,
  getPromoCodeDashboard,
  getReferralRecords,
} from "../lib/referrals/store.ts";
import {
  getCollections,
  getDemoCollection,
  saveCollection,
} from "../lib/content/collections.ts";
import {
  getDownloadRecord,
  getDownloadRecords,
  registerDownloadAttempt,
  resetDownloadLimit,
} from "../lib/downloads/store.ts";
import {
  consumePasswordReset,
  createPasswordReset,
} from "../lib/database/repositories/password-resets.ts";

const legacyFiles = {
  "collections.json": "[]\n",
  "downloads.json": "[]\n",
  "password-resets.json": "[]\n",
  "payments.json": "[]\n",
  "promo-codes.json": "{\n  \"codes\": [],\n  \"referrals\": []\n}\n",
  "users.json": "[]\n",
};

async function snapshotLegacyFiles(directory) {
  return Object.fromEntries(
    await Promise.all(
      Object.keys(legacyFiles).map(async (fileName) => [
        fileName,
        await readFile(path.join(directory, fileName)),
      ]),
    ),
  );
}

async function createRuntimeFixture(t, overrides = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dj-vault-runtime-"));
  const databasePath = path.join(directory, "runtime.sqlite");

  await Promise.all(
    Object.entries({ ...legacyFiles, ...overrides }).map(([fileName, contents]) =>
      writeFile(path.join(directory, fileName), contents, "utf8"),
    ),
  );

  configureRuntimeDatabaseForTests({ dataDirectory: directory, databasePath });
  t.after(async () => {
    resetRuntimeDatabaseForTests();
    await rm(directory, { force: true, recursive: true });
  });

  return { directory, databasePath, before: await snapshotLegacyFiles(directory) };
}

function runDownloadWorker({ dataDirectory, databasePath, input, startGate }) {
  const worker = new Worker(new URL("./download-attempt-worker.mjs", import.meta.url), {
    execArgv: ["--import", new URL("./register-alias-loader.mjs", import.meta.url).href],
    workerData: { dataDirectory, databasePath, input, startGate },
  });

  return {
    ready: new Promise((resolve, reject) => {
      worker.once("error", reject);
      worker.once("message", resolve);
    }),
    result: new Promise((resolve, reject) => {
      worker.on("error", reject);
      worker.on("message", (message) => {
        if (message.result) resolve(message.result);
        if (message.error) reject(new Error(message.error));
      });
    }),
  };
}

async function createOwnerWithPromo(code = "VAULT2026") {
  const owner = await createUserWithEmail({
    email: "owner@example.com",
    name: "Owner",
    password: "owner-password",
  });
  const promo = await createPromoCodeForUser({ code, ownerUserId: owner.id });

  return { owner, promo };
}

test("concurrent normalized-email registrations create one user and one duplicate failure", async (t) => {
  await createRuntimeFixture(t);

  const results = await Promise.allSettled([
    registerEmailUserWithReferral({
      email: "  DJ@Example.COM ",
      name: "DJ",
      password: "password-one",
    }),
    registerEmailUserWithReferral({
      email: "dj@example.com",
      name: "DJ Two",
      password: "password-two",
    }),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(
    results.find((result) => result.status === "rejected")?.reason.message,
    "USER_EXISTS",
  );
  assert.equal((await getUsers()).length, 1);
  assert.equal((await findUserByEmail("DJ@EXAMPLE.COM"))?.email, "dj@example.com");
});

test("registration commits a valid promo referral atomically and leaves no partial rows for rejected inputs", async (t) => {
  await createRuntimeFixture(t);
  const { owner, promo } = await createOwnerWithPromo();

  const referred = await registerEmailUserWithReferral({
    email: "referred@example.com",
    name: "Referred",
    password: "referred-password",
    promoCode: " vault 2026 ",
  });

  const referrals = await getReferralRecords();
  assert.equal(referrals.length, 1);
  assert.match(referrals[0].id, /^[0-9a-f-]{36}$/i);
  assert.equal(referrals[0].promoCodeId, promo.id);
  assert.equal(referrals[0].code, "VAULT2026");
  assert.equal(referrals[0].ownerUserId, owner.id);
  assert.equal(referrals[0].referredUserId, referred.id);
  assert.equal(Number.isNaN(Date.parse(referrals[0].registeredAt)), false);
  assert.equal("convertedAt" in referrals[0], false);

  const db = getRuntimeDatabase();
  db.prepare("UPDATE promo_codes SET is_active = 0 WHERE id = ?").run(promo.id);

  await assert.rejects(
    registerEmailUserWithReferral({
      email: "disabled@example.com",
      password: "disabled-password",
      promoCode: promo.code,
    }),
    /PROMO_CODE_NOT_FOUND/,
  );
  await assert.rejects(
    registerEmailUserWithReferral({
      email: "referred@example.com",
      password: "other-password",
      promoCode: promo.code,
    }),
    /USER_EXISTS/,
  );

  assert.equal(await findUserByEmail("disabled@example.com"), null);
  assert.equal((await getReferralRecords()).length, 1);
  assert.equal((await getUsers()).length, 2);
});

test("reprocessing a provider payment grants access and converts the referral once", async (t) => {
  await createRuntimeFixture(t);
  await createOwnerWithPromo("PAYMENT");
  const referred = await registerEmailUserWithReferral({
    email: "buyer@example.com",
    password: "buyer-password",
    promoCode: "payment",
  });
  const stored = await createStoredPayment({
    userId: referred.id,
    packageId: "days-30",
    durationDays: 30,
    method: "bank_card",
    amount: 1000,
  });
  const providerPayment = {
    id: "provider-payment-1",
    status: "succeeded",
    paid: true,
    amount: { value: "1000", currency: "RUB" },
    metadata: { localPaymentId: stored.id },
  };

  const activations = await Promise.all([
    activateYooKassaPayment(providerPayment),
    activateYooKassaPayment(providerPayment),
  ]);

  assert.equal(activations.filter((result) => result.activated).length, 1);
  assert.equal(activations.filter((result) => !result.activated).length, 1);
  assert.equal((await findStoredPaymentById(stored.id))?.status, "succeeded");
  assert.equal((await findUserByEmail("buyer@example.com"))?.plan, "club");

  const referrals = await getReferralRecords();
  assert.equal(referrals.length, 1);
  assert.equal(referrals[0].paymentId, stored.id);
  assert.equal(referrals[0].convertedPackageId, "days-30");
  assert.equal(
    getRuntimeDatabase()
      .prepare("SELECT count(*) AS count FROM activated_payments WHERE activated_at IS NOT NULL")
      .get().count,
    1,
  );
});

test("a legacy succeeded payment never extends imported access a second time", async (t) => {
  await createRuntimeFixture(t);
  const user = await createUserWithEmail({
    email: "legacy-paid@example.com",
    password: "legacy-password",
  });
  const db = getRuntimeDatabase();
  const expiresAt = "2027-01-01T00:00:00.000Z";
  db.prepare("UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?").run(
    "club",
    expiresAt,
    user.id,
  );
  db.prepare(`
    INSERT INTO activated_payments (
      id, provider, provider_payment_id, provider_status, user_id, package_id,
      duration_days, method, amount, currency, status, paid_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "legacy-paid-payment",
    "yookassa",
    "legacy-provider-payment",
    "succeeded",
    user.id,
    "days-30",
    30,
    "bank_card",
    1000,
    "RUB",
    "succeeded",
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:00:00.000Z",
  );

  const result = await activateYooKassaPayment({
    id: "legacy-provider-payment",
    status: "succeeded",
    paid: true,
    amount: { value: "1000", currency: "RUB" },
    metadata: { localPaymentId: "legacy-paid-payment" },
  });

  assert.equal(result.activated, false);
  assert.equal((await findUserByEmail(user.email))?.planExpiresAt, expiresAt);
  assert.equal(
    db.prepare("SELECT activated_at FROM activated_payments WHERE id = ?")
      .get("legacy-paid-payment").activated_at,
    null,
  );
});

test("rejected provider IDs remain unclaimed for mismatched and already-owned payments", async (t) => {
  await createRuntimeFixture(t);
  const user = await createUserWithEmail({
    email: "provider-identity@example.com",
    password: "provider-identity-password",
  });
  const mismatched = await createStoredPayment({
    userId: user.id,
    packageId: "days-30",
    durationDays: 30,
    method: "bank_card",
    amount: 1000,
  });
  await updateStoredPayment(mismatched.id, {
    providerPaymentId: "provider-original",
    providerStatus: "pending",
  });
  const mismatchedBefore = await findStoredPaymentById(mismatched.id);

  const mismatchResult = await activateYooKassaPayment({
    id: "provider-free",
    status: "succeeded",
    paid: true,
    amount: { value: "1000", currency: "RUB" },
    metadata: { localPaymentId: mismatched.id },
  });

  assert.equal(mismatchResult.status, "failed");
  assert.deepEqual(await findStoredPaymentById(mismatched.id), mismatchedBefore);
  assert.equal(await findStoredPaymentByProviderId("provider-free"), null);

  const owner = await createStoredPayment({
    userId: user.id,
    packageId: "days-30",
    durationDays: 30,
    method: "bank_card",
    amount: 1000,
  });
  await updateStoredPayment(owner.id, { providerPaymentId: "provider-owned" });
  const contender = await createStoredPayment({
    userId: user.id,
    packageId: "days-30",
    durationDays: 30,
    method: "bank_card",
    amount: 1000,
  });
  const contenderBefore = await findStoredPaymentById(contender.id);

  const ownedResult = await activateYooKassaPayment({
    id: "provider-owned",
    status: "succeeded",
    paid: true,
    amount: { value: "1000", currency: "RUB" },
    metadata: { localPaymentId: contender.id },
  });

  assert.equal(ownedResult.status, "failed");
  assert.deepEqual(await findStoredPaymentById(contender.id), contenderBefore);
  assert.equal((await findStoredPaymentByProviderId("provider-owned"))?.id, owner.id);
});

test("legacy activation IDs stay in user history without becoming pending payments", async (t) => {
  await createRuntimeFixture(t, {
    "users.json": `${JSON.stringify([{
      id: "legacy-activation-user",
      email: "legacy-activation@example.com",
      name: "Legacy Activation",
      plan: "club",
      activatedPaymentIds: ["activation-history-id"],
      providers: ["email"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }], null, 2)}\n`,
  });

  const user = await findUserByEmail("legacy-activation@example.com");
  const storedUser = getRuntimeDatabase()
    .prepare("SELECT provider_payment_id FROM activated_payments WHERE id = ?")
    .get("activation-history-id");

  assert.deepEqual(user.activatedPaymentIds, ["activation-history-id"]);
  assert.equal(storedUser.provider_payment_id, "activation-history-id");
  assert.equal(await findStoredPaymentById("activation-history-id"), null);
  assert.equal(await findStoredPaymentByProviderId("activation-history-id"), null);
});

test("admin add-days operations compose inside repository transactions", async (t) => {
  await createRuntimeFixture(t);
  const user = await createUserWithEmail({
    email: "admin-extension@example.com",
    password: "admin-extension-password",
  });
  const now = new Date("2026-07-13T00:00:00.000Z");

  assert.equal(typeof authStore.applyAdminAccessChange, "function");
  await Promise.all([
    authStore.applyAdminAccessChange(user.id, "club", 10, now),
    authStore.applyAdminAccessChange(user.id, "club", 20, now),
  ]);

  assert.equal(
    (await findUserByEmail(user.email)).planExpiresAt,
    "2026-08-12T00:00:00.000Z",
  );
});

test("two SQLite connections contesting the final download slot allow exactly one", async (t) => {
  const { directory, databasePath } = await createRuntimeFixture(t);
  const user = await createUserWithEmail({
    email: "downloads@example.com",
    password: "download-password",
  });
  const input = {
    archiveId: "027",
    ipAddress: "192.0.2.1",
    limit: 2,
    userAgent: "Repository test",
    userId: user.id,
  };

  assert.equal((await registerDownloadAttempt(input)).allowed, true);
  resetRuntimeDatabaseForTests();
  const startGate = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const workers = [1, 2].map(() => runDownloadWorker({
    dataDirectory: directory,
    databasePath,
    input,
    startGate,
  }));
  await Promise.all(workers.map((worker) => worker.ready));
  Atomics.store(new Int32Array(startGate), 0, 1);
  Atomics.notify(new Int32Array(startGate), 0, 2);
  const results = await Promise.all(workers.map((worker) => worker.result));
  configureRuntimeDatabaseForTests({ dataDirectory: directory, databasePath });

  assert.equal(results.filter((result) => result.allowed).length, 1);
  assert.equal((await getDownloadRecord(user.id, input.archiveId))?.downloadCount, 2);
});

test("download records preserve deterministic SQLite insertion order", async (t) => {
  await createRuntimeFixture(t);
  const user = await createUserWithEmail({
    email: "download-order@example.com",
    password: "download-order-password",
  });

  for (const archiveId of ["010", "002", "007"]) {
    await registerDownloadAttempt({
      archiveId,
      ipAddress: "192.0.2.8",
      limit: 2,
      userAgent: "Order test",
      userId: user.id,
    });
  }

  getRuntimeDatabase().pragma("reverse_unordered_selects = ON");
  assert.deepEqual((await getDownloadRecords()).map((record) => record.archiveId), ["010", "002", "007"]);
});

test("resetting a download limit removes its aggregate and event history together", async (t) => {
  await createRuntimeFixture(t);
  const user = await createUserWithEmail({
    email: "reset-download@example.com",
    password: "reset-download-password",
  });
  await registerDownloadAttempt({
    archiveId: "027",
    ipAddress: "192.0.2.7",
    limit: 2,
    userAgent: "Reset test",
    userId: user.id,
  });

  await resetDownloadLimit(user.id, "027");

  assert.equal(await getDownloadRecord(user.id, "027"), null);
  assert.equal(
    getRuntimeDatabase()
      .prepare("SELECT count(*) AS count FROM download_events WHERE user_id = ? AND archive_id = ?")
      .get(user.id, "027").count,
    0,
  );
});

test("password reset consumption changes a password hash once", async (t) => {
  await createRuntimeFixture(t);
  const user = await createUserWithEmail({
    email: "reset@example.com",
    password: "reset-password",
  });
  const tokenHash = "token-hash-1";
  createPasswordReset({
    email: user.email,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    tokenHash,
    userId: user.id,
  });

  consumePasswordReset({ passwordHash: "new-password-hash", tokenHash });
  assert.equal(
    getRuntimeDatabase()
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(user.id).password_hash,
    "new-password-hash",
  );
  assert.throws(
    () => consumePasswordReset({ passwordHash: "second-password-hash", tokenHash }),
    /RESET_TOKEN_INVALID/,
  );
  assert.equal(
    getRuntimeDatabase()
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(user.id).password_hash,
    "new-password-hash",
  );
});

test("legacy non-HTTP collection download URLs remain effective runtime S3 keys", async (t) => {
  const legacyCollections = [
    {
      number: "027",
      date: "6 July 2026",
      size: "4 GB",
      genres: "House",
      description: "Imported archive",
      tracks: "100 tracks",
      downloadUrl: "archives/027.zip",
      isActive: true,
      downloadLimit: 2,
    },
    {
      number: "demo",
      date: "6 July 2026",
      size: "300 MB",
      genres: "House",
      description: "Imported demo",
      tracks: "10 tracks",
      downloadUrl: "archives/demo.zip",
      isActive: true,
      downloadLimit: 2,
    },
  ];
  await createRuntimeFixture(t, {
    "collections.json": `${JSON.stringify(legacyCollections, null, 2)}\n`,
  });

  assert.equal((await getCollections())[0].s3Key, "archives/027.zip");
  assert.equal((await getDemoCollection()).s3Key, "archives/demo.zip");
});

test("public store shapes preserve sorting, dashboard data, and download history", async (t) => {
  await createRuntimeFixture(t);
  const first = await createUserWithEmail({
    email: "first@example.com",
    name: "First",
    password: "first-password",
  });
  const second = await createUserWithEmail({
    email: "second@example.com",
    name: "Second",
    password: "second-password",
  });
  const db = getRuntimeDatabase();
  db.prepare("UPDATE users SET created_at = ? WHERE id = ?").run(
    "2026-01-01T00:00:00.000Z",
    first.id,
  );
  db.prepare("UPDATE users SET created_at = ? WHERE id = ?").run(
    "2026-02-01T00:00:00.000Z",
    second.id,
  );

  const promo = await createPromoCodeForUser({ code: "DASHBOARD", ownerUserId: first.id });
  const referred = await registerEmailUserWithReferral({
    email: "dashboard@example.com",
    password: "dashboard-password",
    promoCode: promo.code,
  });
  const download = await registerDownloadAttempt({
    archiveId: "003",
    ipAddress: "192.0.2.2",
    limit: 2,
    userAgent: "Compatibility test",
    userId: referred.id,
  });
  await saveCollection({
    number: "#002",
    date: "2 July 2026",
    genres: "House",
    tracks: "20 tracks",
    downloadLimit: "3",
    downloadUrl: "https://legacy.example/002.zip",
  });
  await saveCollection({
    number: "003",
    date: "3 July 2026",
    genres: "Techno",
    tracks: "30 tracks",
  });
  await saveCollection({
    number: "002",
    date: "2 July 2026",
    genres: "House",
    description: "Updated collection",
    tracks: "21 tracks",
    downloadLimit: "4",
  });
  const payment = await createStoredPayment({
    userId: referred.id,
    packageId: "days-30",
    durationDays: 30,
    method: "sbp",
    amount: 1000,
  });
  const updatedPayment = await updateStoredPayment(payment.id, {
    confirmationUrl: "https://payments.example/confirmation",
    providerPaymentId: "provider-compatibility",
    providerStatus: "pending",
  });

  const users = await getUsers();
  assert.ok(
    users.findIndex((user) => user.id === second.id) <
      users.findIndex((user) => user.id === first.id),
  );
  assert.equal("passwordHash" in users[0], false);
  assert.deepEqual((await getCollections()).map((collection) => collection.number), ["003", "002"]);
  assert.equal((await getCollections())[1].description, "Updated collection");
  assert.equal((await getCollections())[1].downloadLimit, 4);
  assert.equal(
    db.prepare("SELECT legacy_download_url FROM collections WHERE number = ?")
      .get("002").legacy_download_url,
    "https://legacy.example/002.zip",
  );
  assert.equal((await getDemoCollection()).number, "demo");
  const dashboard = await getPromoCodeDashboard(users);
  assert.equal(dashboard.length, 1);
  assert.equal(dashboard[0].code.id, promo.id);
  assert.equal(dashboard[0].owner?.id, first.id);
  assert.equal(dashboard[0].registeredCount, 1);
  assert.equal(dashboard[0].paidCount, 0);
  assert.equal(dashboard[0].referrals.length, 1);
  assert.equal(dashboard[0].referrals[0].promoCodeId, promo.id);
  assert.equal(dashboard[0].referrals[0].referredUserId, referred.id);
  assert.equal(dashboard[0].referrals[0].user?.id, referred.id);
  assert.equal(download.record.events.length, 1);
  assert.equal(download.record.events[0].ipAddress, "192.0.2.2");
  assert.equal(updatedPayment.id, payment.id);
  assert.equal(updatedPayment.confirmationUrl, "https://payments.example/confirmation");
  assert.equal(updatedPayment.providerPaymentId, "provider-compatibility");
  assert.equal(updatedPayment.providerStatus, "pending");
  assert.equal(updatedPayment.status, "pending");
  assert.equal(Number.isNaN(Date.parse(updatedPayment.updatedAt)), false);
});

test("runtime mutations leave legacy JSON source bytes unchanged", async (t) => {
  const { directory, before } = await createRuntimeFixture(t);
  const user = await createUserWithEmail({
    email: "unchanged@example.com",
    password: "unchanged-password",
  });
  const promo = await createPromoCodeForUser({
    code: "UNCHANGED",
    ownerUserId: user.id,
  });
  const referred = await registerEmailUserWithReferral({
    email: "unchanged-referred@example.com",
    password: "unchanged-referred-password",
    promoCode: promo.code,
  });
  const payment = await createStoredPayment({
    userId: referred.id,
    packageId: "days-30",
    durationDays: 30,
    method: "sbp",
    amount: 1000,
  });
  await updateStoredPayment(payment.id, {
    providerPaymentId: "unchanged-provider-payment",
    providerStatus: "pending",
  });
  createPasswordReset({
    userId: user.id,
    email: user.email,
    tokenHash: "unchanged-reset-token",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  await registerDownloadAttempt({
    archiveId: "009",
    ipAddress: "192.0.2.9",
    limit: 2,
    userAgent: "Source bytes test",
    userId: user.id,
  });

  assert.deepEqual(await snapshotLegacyFiles(directory), before);
});
