import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  closeDatabaseForTests,
  openDatabase,
} from "../lib/database/client.ts";
import { importLegacyData } from "../lib/database/import-legacy.ts";
import { initializeDatabase } from "../lib/database/schema.ts";

const legacyFileNames = [
  "users.json",
  "payments.json",
  "promo-codes.json",
  "collections.json",
  "downloads.json",
  "password-resets.json",
];

const fixtureData = {
  "users.json": [
    {
      id: "user-owner",
      email: " Owner@Example.COM ",
      name: "Owner",
      plan: "premium",
      planExpiresAt: "2027-01-02T03:04:05.000Z",
      activatedPaymentIds: ["activation-only", "activation-only"],
      providers: ["email"],
      passwordHash: "password-hash-must-stay-secret",
      avatarUrl: "https://cdn.example/owner.png",
      createdAt: "2025-01-01T01:02:03.000Z",
      updatedAt: "2026-02-03T04:05:06.000Z",
    },
    {
      id: "user-referred",
      email: "referred@example.com",
      name: "Referred",
      plan: "club",
      activatedPaymentIds: ["payment-complete"],
      providers: ["email"],
      createdAt: "2026-03-01T01:00:00.000Z",
      updatedAt: "2026-03-01T01:00:00.000Z",
    },
  ],
  "payments.json": [
    {
      id: "payment-complete",
      provider: "yookassa",
      providerPaymentId: "provider-payment-42",
      providerStatus: "succeeded",
      confirmationUrl: "https://payments.example/confirmation-secret",
      userId: "user-referred",
      packageId: "days-90",
      durationDays: 90,
      planId: "pro",
      activationPlanId: "club",
      method: "bank_card",
      amount: 2700,
      currency: "RUB",
      status: "succeeded",
      paidAt: "2026-04-01T10:01:00.000Z",
      error: "provider-warning",
      createdAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-01T10:02:00.000Z",
    },
  ],
  "promo-codes.json": {
    codes: [
      {
        id: "promo-1",
        code: " vip 2026 ",
        ownerUserId: "user-owner",
        isActive: true,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      },
    ],
    referrals: [
      {
        id: "referral-1",
        promoCodeId: "promo-1",
        code: " vip 2026 ",
        ownerUserId: "user-owner",
        referredUserId: "user-referred",
        registeredAt: "2026-03-03T00:00:00.000Z",
        convertedAt: "2026-04-01T10:02:00.000Z",
        convertedPackageId: "days-90",
        convertedDurationDays: 90,
        convertedAmount: 2700,
        convertedPlan: "club",
        paymentId: "payment-complete",
      },
    ],
  },
  "collections.json": [
    {
      number: "027",
      date: "06 July 2026",
      size: "4.28 GB",
      sizeBytes: 4595615000,
      genres: "Afro House / Deep House",
      description: "Exact legacy description",
      tracks: "150 tracks",
      s3Key: "collections/027.zip",
      downloadUrl: "https://legacy.example/027.zip",
      isActive: true,
      downloadLimit: 3,
    },
  ],
  "downloads.json": [
    {
      userId: "user-owner",
      archiveId: "027",
      downloadCount: 2,
      downloadedAt: "2026-05-02T12:00:00.000Z",
      events: [
        {
          downloadedAt: "2026-05-01T12:00:00.000Z",
          ipAddress: "192.0.2.10",
          userAgent: "Legacy Browser 1",
        },
        {
          downloadedAt: "2026-05-02T12:00:00.000Z",
          ipAddress: "192.0.2.11",
          userAgent: "Legacy Browser 2",
        },
      ],
      updatedAt: "2026-05-02T12:00:00.000Z",
    },
  ],
  "password-resets.json": [
    {
      userId: "user-owner",
      email: " Owner@Example.COM ",
      tokenHash: "reset-hash-must-stay-secret",
      expiresAt: "2026-06-01T01:00:00.000Z",
      usedAt: "2026-05-31T01:00:00.000Z",
      createdAt: "2026-05-30T01:00:00.000Z",
    },
  ],
};

async function writeFixtures(directory, overrides = {}) {
  const data = { ...fixtureData, ...overrides };

  await Promise.all(
    legacyFileNames.map((fileName) =>
      writeFile(
        path.join(directory, fileName),
        `${JSON.stringify(data[fileName], null, 2)}\n`,
        "utf8",
      ),
    ),
  );
}

async function snapshotFixtures(directory) {
  return Object.fromEntries(
    await Promise.all(
      legacyFileNames.map(async (fileName) => [
        fileName,
        await readFile(path.join(directory, fileName)),
      ]),
    ),
  );
}

function count(db, table) {
  return db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count;
}

async function createTestDatabase(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dj-vault-import-"));
  const databasePath = path.join(directory, "dj-vault.sqlite");
  const db = openDatabase(databasePath);

  initializeDatabase(db);
  t.after(async () => {
    closeDatabaseForTests();
    await rm(directory, { force: true, recursive: true });
  });

  return { databasePath, db, directory };
}

test("imports every legacy store once without changing source files", async (t) => {
  const { db, directory } = await createTestDatabase(t);
  await writeFixtures(directory);
  const before = await snapshotFixtures(directory);

  const first = importLegacyData(db, directory);
  const afterFirst = await snapshotFixtures(directory);
  const second = importLegacyData(db, directory);

  assert.equal(first.imported, true);
  assert.deepEqual(first.counts, {
    users: 2,
    userProviders: 2,
    activatedPayments: 2,
    promoCodes: 1,
    referrals: 1,
    collections: 1,
    downloadRecords: 1,
    downloadEvents: 2,
    passwordResets: 1,
  });
  assert.deepEqual(second, { imported: false, counts: first.counts });
  assert.deepEqual(afterFirst, before);
  assert.deepEqual(await snapshotFixtures(directory), before);

  assert.deepEqual(
    db.prepare("SELECT * FROM users WHERE id = ?").get("user-owner"),
    {
      id: "user-owner",
      email: "owner@example.com",
      name: "Owner",
      plan: "premium",
      plan_expires_at: "2027-01-02T03:04:05.000Z",
      password_hash: "password-hash-must-stay-secret",
      avatar_url: "https://cdn.example/owner.png",
      session_version: 0,
      created_at: "2025-01-01T01:02:03.000Z",
      updated_at: "2026-02-03T04:05:06.000Z",
    },
  );
  assert.deepEqual(
    db.prepare("SELECT user_id, provider, created_at FROM user_providers ORDER BY user_id").all(),
    [
      {
        user_id: "user-owner",
        provider: "email",
        created_at: "2025-01-01T01:02:03.000Z",
      },
      {
        user_id: "user-referred",
        provider: "email",
        created_at: "2026-03-01T01:00:00.000Z",
      },
    ],
  );
  assert.deepEqual(
    db.prepare("SELECT * FROM activated_payments ORDER BY id").all(),
    [
      {
        id: "activation-only",
        provider: null,
        provider_payment_id: "activation-only",
        provider_status: null,
        confirmation_url: null,
        user_id: "user-owner",
        package_id: null,
        duration_days: null,
        plan_id: null,
        activation_plan_id: null,
        method: null,
        amount: null,
        original_amount: null,
        discount_percent: 0,
        promo_code_id: null,
        currency: null,
        status: null,
        paid_at: null,
        activated_at: null,
        error: null,
        created_at: null,
        updated_at: null,
      },
      {
        id: "payment-complete",
        provider: "yookassa",
        provider_payment_id: "provider-payment-42",
        provider_status: "succeeded",
        confirmation_url: "https://payments.example/confirmation-secret",
        user_id: "user-referred",
        package_id: "days-90",
        duration_days: 90,
        plan_id: "pro",
        activation_plan_id: "club",
        method: "bank_card",
        amount: 2700,
        original_amount: null,
        discount_percent: 0,
        promo_code_id: null,
        currency: "RUB",
        status: "succeeded",
        paid_at: "2026-04-01T10:01:00.000Z",
        activated_at: null,
        error: "provider-warning",
        created_at: "2026-04-01T10:00:00.000Z",
        updated_at: "2026-04-01T10:02:00.000Z",
      },
    ],
  );
  assert.deepEqual(
    db.prepare("SELECT * FROM promo_codes").get(),
    {
      id: "promo-1",
      code: " vip 2026 ",
      normalized_code: "VIP2026",
      owner_user_id: "user-owner",
      is_active: 1,
      discount_percent: 20,
      discount_registration_limit: null,
      created_at: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-03-02T00:00:00.000Z",
    },
  );
  assert.deepEqual(
    db.prepare("SELECT * FROM referrals").get(),
    {
      id: "referral-1",
      promo_code_id: "promo-1",
      code: " vip 2026 ",
      owner_user_id: "user-owner",
      referred_user_id: "user-referred",
      registered_at: "2026-03-03T00:00:00.000Z",
      discount_percent: 0,
      discount_reserved_payment_id: null,
      discount_reserved_at: null,
      discount_used_at: null,
      converted_at: "2026-04-01T10:02:00.000Z",
      converted_package_id: "days-90",
      converted_duration_days: 90,
      converted_amount: 2700,
      converted_original_amount: null,
      converted_discount_percent: 0,
      converted_plan: "club",
      payment_id: "payment-complete",
    },
  );

  const collection = db.prepare("SELECT * FROM collections").get();
  assert.deepEqual(
    { ...collection, created_at: "stable", updated_at: "stable" },
    {
      number: "027",
      date: "06 July 2026",
      size: "4.28 GB",
      size_bytes: 4595615000,
      genres: "Afro House / Deep House",
      description: "Exact legacy description",
      tracks: "150 tracks",
      s3_key: "collections/027.zip",
      legacy_download_url: "https://legacy.example/027.zip",
      is_active: 1,
      download_limit: 3,
      created_at: "stable",
      updated_at: "stable",
    },
  );
  assert.equal(collection.created_at, collection.updated_at);
  assert.equal(Number.isNaN(Date.parse(collection.created_at)), false);

  assert.deepEqual(
    db.prepare("SELECT * FROM download_records").get(),
    {
      user_id: "user-owner",
      archive_id: "027",
      download_count: 2,
      downloaded_at: "2026-05-02T12:00:00.000Z",
      created_at: "2026-05-02T12:00:00.000Z",
      updated_at: "2026-05-02T12:00:00.000Z",
    },
  );
  assert.deepEqual(
    db.prepare("SELECT user_id, archive_id, downloaded_at, ip_address, user_agent FROM download_events ORDER BY id").all(),
    [
      {
        user_id: "user-owner",
        archive_id: "027",
        downloaded_at: "2026-05-01T12:00:00.000Z",
        ip_address: "192.0.2.10",
        user_agent: "Legacy Browser 1",
      },
      {
        user_id: "user-owner",
        archive_id: "027",
        downloaded_at: "2026-05-02T12:00:00.000Z",
        ip_address: "192.0.2.11",
        user_agent: "Legacy Browser 2",
      },
    ],
  );
  assert.deepEqual(
    db.prepare("SELECT user_id, email, token_hash, expires_at, used_at, created_at FROM password_resets").get(),
    {
      user_id: "user-owner",
      email: "owner@example.com",
      token_hash: "reset-hash-must-stay-secret",
      expires_at: "2026-06-01T01:00:00.000Z",
      used_at: "2026-05-31T01:00:00.000Z",
      created_at: "2026-05-30T01:00:00.000Z",
    },
  );
  assert.equal(count(db, "data_imports"), 1);
  assert.equal(
    db.prepare("SELECT name FROM data_imports").get().name,
    "legacy-json-v1",
  );
});

test("matches a legacy activation provider ID to its existing payment", async (t) => {
  const { db, directory } = await createTestDatabase(t);
  const users = structuredClone(fixtureData["users.json"]);
  users[1].activatedPaymentIds.push("provider-payment-42");
  await writeFixtures(directory, { "users.json": users });

  const report = importLegacyData(db, directory);

  assert.equal(report.counts.activatedPayments, 2);
  assert.equal(count(db, "activated_payments"), 2);
  assert.equal(
    db.prepare("SELECT count(*) AS count FROM activated_payments WHERE id = ?")
      .get("provider-payment-42").count,
    0,
  );
});

test("conflicting normalized emails roll back the complete import", async (t) => {
  const { db, directory } = await createTestDatabase(t);
  await writeFixtures(directory, {
    "users.json": [
      fixtureData["users.json"][0],
      {
        ...fixtureData["users.json"][1],
        email: "owner@example.com",
      },
    ],
  });

  assert.throws(
    () => importLegacyData(db, directory),
    /conflicting normalized email/i,
  );

  for (const table of [
    "users",
    "user_providers",
    "activated_payments",
    "promo_codes",
    "referrals",
    "collections",
    "download_records",
    "download_events",
    "password_resets",
    "data_imports",
  ]) {
    assert.equal(count(db, table), 0, `${table} should be empty after rollback`);
  }
});

test("cross-user referral payment attribution aborts the import", async (t) => {
  const { db, directory } = await createTestDatabase(t);
  await writeFixtures(directory, {
    "promo-codes.json": {
      ...fixtureData["promo-codes.json"],
      referrals: [
        {
          ...fixtureData["promo-codes.json"].referrals[0],
          paymentId: "activation-only",
        },
      ],
    },
  });

  assert.throws(
    () => importLegacyData(db, directory),
    /referral payment ownership/i,
  );
  for (const table of [
    "users",
    "user_providers",
    "activated_payments",
    "promo_codes",
    "referrals",
    "collections",
    "download_records",
    "download_events",
    "password_resets",
    "data_imports",
  ]) {
    assert.equal(count(db, table), 0, `${table} should be empty after rollback`);
  }
});

test("self-referral aborts the import", async (t) => {
  const { db, directory } = await createTestDatabase(t);
  await writeFixtures(directory, {
    "promo-codes.json": {
      ...fixtureData["promo-codes.json"],
      referrals: [
        {
          ...fixtureData["promo-codes.json"].referrals[0],
          referredUserId: "user-owner",
          paymentId: "activation-only",
        },
      ],
    },
  });

  assert.throws(() => importLegacyData(db, directory), /self-referral/i);
  for (const table of [
    "users",
    "user_providers",
    "activated_payments",
    "promo_codes",
    "referrals",
    "collections",
    "download_records",
    "download_events",
    "password_resets",
    "data_imports",
  ]) {
    assert.equal(count(db, table), 0, `${table} should be empty after rollback`);
  }
});

test("treats absent legacy files as empty datasets", async (t) => {
  const { db, directory } = await createTestDatabase(t);

  assert.deepEqual(importLegacyData(db, directory), {
    imported: true,
    counts: {
      users: 0,
      userProviders: 0,
      activatedPayments: 0,
      promoCodes: 0,
      referrals: 0,
      collections: 0,
      downloadRecords: 0,
      downloadEvents: 0,
      passwordResets: 0,
    },
  });
  assert.equal(count(db, "data_imports"), 1);
});

test("rolls back rows inserted before a database conflict", async (t) => {
  const { db, directory } = await createTestDatabase(t);
  await writeFixtures(directory);
  db.prepare(`
    INSERT INTO collections (
      number, date, size, genres, description, tracks, is_active,
      download_limit, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "027",
    "existing",
    "existing",
    "existing",
    "existing",
    "existing",
    1,
    1,
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:00:00.000Z",
  );

  assert.throws(() => importLegacyData(db, directory), /UNIQUE constraint failed/);
  assert.equal(count(db, "users"), 0);
  assert.equal(count(db, "activated_payments"), 0);
  assert.equal(count(db, "promo_codes"), 0);
  assert.equal(count(db, "collections"), 1);
  assert.equal(count(db, "data_imports"), 0);
  assert.equal(
    db.prepare("SELECT date FROM collections WHERE number = ?").get("027").date,
    "existing",
  );
});

test("verification CLI documents explicit paths", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-data-migration.mjs", "--help"],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--data-directory/);
  assert.match(result.stdout, /--database/);
  assert.match(result.stdout, /--help/);
});

test("verification CLI is secret-safe and exits nonzero on mismatch", async (t) => {
  const { databasePath, db, directory } = await createTestDatabase(t);
  await writeFixtures(directory);
  importLegacyData(db, directory);
  closeDatabaseForTests();

  const argumentsForCli = [
    "scripts/verify-data-migration.mjs",
    "--data-directory",
    directory,
    "--database",
    databasePath,
  ];
  const matching = spawnSync(process.execPath, argumentsForCli, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const matchingOutput = `${matching.stdout}\n${matching.stderr}`;

  assert.equal(matching.status, 0, matchingOutput);
  assert.match(matching.stdout, /marker\s+legacy-json-v1:\s+present/i);
  assert.match(matching.stdout, /users\s+json=2\s+sqlite=2\s+OK/i);
  assert.match(matching.stdout, /conflicts:\s+none/i);
  for (const secret of [
    "password-hash-must-stay-secret",
    "reset-hash-must-stay-secret",
    "confirmation-secret",
    "192.0.2.10",
  ]) {
    assert.equal(matchingOutput.includes(secret), false);
  }

  const reopened = openDatabase(databasePath);
  reopened.prepare("DELETE FROM password_resets").run();
  closeDatabaseForTests();

  const mismatch = spawnSync(process.execPath, argumentsForCli, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const mismatchOutput = `${mismatch.stdout}\n${mismatch.stderr}`;

  assert.notEqual(mismatch.status, 0, mismatchOutput);
  assert.match(mismatch.stdout, /passwordResets\s+json=1\s+sqlite=0\s+MISMATCH/i);
  assert.match(mismatch.stdout, /conflicts:\s+1/i);
  assert.equal(mismatchOutput.includes("reset-hash-must-stay-secret"), false);
});

test("verification CLI detects altered download events without exposing them", async (t) => {
  const { databasePath, db, directory } = await createTestDatabase(t);
  await writeFixtures(directory);
  importLegacyData(db, directory);
  db.prepare("UPDATE download_events SET user_agent = ? WHERE id = 1").run(
    "tampered-personal-event-value",
  );
  closeDatabaseForTests();

  const result = spawnSync(
    process.execPath,
    [
      "scripts/verify-data-migration.mjs",
      "--data-directory",
      directory,
      "--database",
      databasePath,
    ],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  const output = `${result.stdout}\n${result.stderr}`;

  assert.notEqual(result.status, 0, output);
  assert.match(result.stdout, /downloadEvents\s+json=2\s+sqlite=2\s+OK/i);
  assert.match(result.stdout, /conflicts:\s+1/i);
  assert.equal(output.includes("tampered-personal-event-value"), false);
  assert.equal(output.includes("192.0.2.10"), false);
  assert.equal(output.includes("Legacy Browser 1"), false);
});
