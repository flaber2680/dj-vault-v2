import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  closeDatabaseForTests,
  openDatabase,
} from "../lib/database/client.ts";
import { initializeDatabase } from "../lib/database/schema.ts";

const requiredTables = [
  "users",
  "user_providers",
  "activated_payments",
  "promo_codes",
  "referrals",
  "collections",
  "download_records",
  "download_events",
  "password_resets",
  "rate_limits",
  "schema_migrations",
  "data_imports",
];

const requiredUniqueIndexes = [
  ["users", ["email"]],
  ["user_providers", ["user_id", "provider"]],
  ["activated_payments", ["provider_payment_id"]],
  ["promo_codes", ["normalized_code"]],
  ["referrals", ["referred_user_id"]],
  ["download_records", ["user_id", "archive_id"]],
  ["password_resets", ["token_hash"]],
  ["schema_migrations", ["name"]],
  ["data_imports", ["name"]],
];

function hasUniqueIndex(db, table, expectedColumns) {
  const indexes = db.prepare(`PRAGMA index_list(${table})`).all();

  return indexes.some((index) => {
    if (index.unique !== 1) {
      return false;
    }

    const columns = db
      .prepare(`PRAGMA index_info(${index.name})`)
      .all()
      .map((column) => column.name);

    return (
      columns.length === expectedColumns.length &&
      columns.every((column, index) => column === expectedColumns[index])
    );
  });
}

test("initializes the complete schema idempotently", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dj-vault-schema-"));
  const databasePath = path.join(directory, "dj-vault.sqlite");
  const db = openDatabase(databasePath);

  t.after(async () => {
    closeDatabaseForTests();
    await rm(directory, { force: true, recursive: true });
  });

  initializeDatabase(db);
  initializeDatabase(db);

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name);

  assert.deepEqual(tables.filter((name) => requiredTables.includes(name)).sort(), requiredTables.sort());
  assert.equal(db.pragma("journal_mode", { simple: true }), "wal");
  assert.equal(db.pragma("foreign_keys", { simple: true }), 1);
  assert.equal(db.pragma("busy_timeout", { simple: true }), 5000);

  for (const [table, columns] of requiredUniqueIndexes) {
    assert.equal(hasUniqueIndex(db, table, columns), true, `${table} needs a unique index on ${columns.join(", ")}`);
  }

  assert.deepEqual(
    db.prepare("SELECT name FROM schema_migrations ORDER BY id").all(),
    [
      { name: "001_initial_schema" },
      { name: "002_rate_limits_expires_at_index" },
      { name: "003_promo_discounts" },
    ],
  );

  const expiryIndex = db
    .prepare("PRAGMA index_list(rate_limits)")
    .all()
    .find((index) => index.name === "idx_rate_limits_expires_at");
  assert.ok(expiryIndex);
  assert.deepEqual(
    db.prepare(`PRAGMA index_info(${expiryIndex.name})`).all().map((column) => column.name),
    ["expires_at"],
  );

  const expiryPlan = db
    .prepare(`
      EXPLAIN QUERY PLAN
      SELECT rowid FROM rate_limits WHERE expires_at <= ? LIMIT ?
    `)
    .all("2026-07-14T00:00:00.000Z", 100)
    .map((step) => step.detail)
    .join("\n");
  assert.match(
    expiryPlan,
    /USING COVERING INDEX idx_rate_limits_expires_at/,
  );
});

test("adds the expiry index to an existing migration-001 database without rebuilding its table", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dj-vault-schema-upgrade-"));
  const databasePath = path.join(directory, "dj-vault.sqlite");
  const db = openDatabase(databasePath);

  t.after(async () => {
    closeDatabaseForTests();
    await rm(directory, { force: true, recursive: true });
  });

  db.exec(`
    CREATE TABLE schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE rate_limits (
      key TEXT NOT NULL,
      window_start TEXT NOT NULL,
      count INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      PRIMARY KEY (key, window_start)
    );
    INSERT INTO schema_migrations (name, applied_at)
    VALUES ('001_initial_schema', '2026-07-13T00:00:00.000Z');
    INSERT INTO schema_migrations (name, applied_at)
    VALUES ('003_promo_discounts', '2026-07-23T00:00:00.000Z');
    INSERT INTO rate_limits (key, window_start, count, expires_at)
    VALUES ('preserved', '2026-07-14T00:00:00.000Z', 4, '2026-07-14T01:00:00.000Z');
  `);

  initializeDatabase(db);

  assert.deepEqual(
    db.prepare("SELECT key, count FROM rate_limits").get(),
    { key: "preserved", count: 4 },
  );
  assert.deepEqual(
    db.prepare("SELECT name FROM schema_migrations ORDER BY name").all(),
    [
      { name: "001_initial_schema" },
      { name: "002_rate_limits_expires_at_index" },
      { name: "003_promo_discounts" },
    ],
  );
  assert.equal(
    db
      .prepare("PRAGMA index_list(rate_limits)")
      .all()
      .some((index) => index.name === "idx_rate_limits_expires_at"),
    true,
  );
});

test("preserves a legacy activation without inventing payment facts", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dj-vault-schema-"));
  const databasePath = path.join(directory, "dj-vault.sqlite");
  const db = openDatabase(databasePath);

  t.after(async () => {
    closeDatabaseForTests();
    await rm(directory, { force: true, recursive: true });
  });

  initializeDatabase(db);
  db.prepare(`
    INSERT INTO users (id, email, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    "legacy-user",
    "legacy@example.com",
    "Legacy User",
    "2026-07-13T00:00:00.000Z",
    "2026-07-13T00:00:00.000Z",
  );

  db.prepare(`
    INSERT INTO activated_payments (id, provider_payment_id, user_id)
    VALUES (?, ?, ?)
  `).run("legacy-payment", "legacy-payment", "legacy-user");

  assert.deepEqual(
    db.prepare(`
      SELECT
        id,
        provider_payment_id,
        user_id,
        provider,
        amount,
        currency,
        status,
        created_at,
        updated_at
      FROM activated_payments
    `).get(),
    {
      id: "legacy-payment",
      provider_payment_id: "legacy-payment",
      user_id: "legacy-user",
      provider: null,
      amount: null,
      currency: null,
      status: null,
      created_at: null,
      updated_at: null,
    },
  );
});

test("round-trips every current payment field", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dj-vault-schema-"));
  const databasePath = path.join(directory, "dj-vault.sqlite");
  const db = openDatabase(databasePath);

  t.after(async () => {
    closeDatabaseForTests();
    await rm(directory, { force: true, recursive: true });
  });

  initializeDatabase(db);
  db.prepare(`
    INSERT INTO users (id, email, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    "current-user",
    "current@example.com",
    "Current User",
    "2026-07-13T08:00:00.000Z",
    "2026-07-13T08:00:00.000Z",
  );

  const payment = {
    id: "payment-id",
    provider: "yookassa",
    provider_payment_id: "provider-payment-id",
    provider_status: "succeeded",
    confirmation_url: "https://yookassa.example/confirmation",
    user_id: "current-user",
    package_id: "days-90",
    duration_days: 90,
    plan_id: "pro",
    activation_plan_id: "club",
    method: "bank_card",
    amount: 2700,
    original_amount: 2700,
    discount_percent: 0,
    promo_code_id: null,
    currency: "RUB",
    status: "succeeded",
    paid_at: "2026-07-13T08:01:00.000Z",
    activated_at: "2026-07-13T08:02:00.000Z",
    error: "recovered-provider-warning",
    created_at: "2026-07-13T08:00:00.000Z",
    updated_at: "2026-07-13T08:02:00.000Z",
  };

  db.prepare(`
    INSERT INTO activated_payments (
      id,
      provider,
      provider_payment_id,
      provider_status,
      confirmation_url,
      user_id,
      package_id,
      duration_days,
      plan_id,
      activation_plan_id,
      method,
      amount,
      original_amount,
      discount_percent,
      promo_code_id,
      currency,
      status,
      paid_at,
      activated_at,
      error,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @provider,
      @provider_payment_id,
      @provider_status,
      @confirmation_url,
      @user_id,
      @package_id,
      @duration_days,
      @plan_id,
      @activation_plan_id,
      @method,
      @amount,
      @original_amount,
      @discount_percent,
      @promo_code_id,
      @currency,
      @status,
      @paid_at,
      @activated_at,
      @error,
      @created_at,
      @updated_at
    )
  `).run(payment);

  assert.deepEqual(
    db.prepare("SELECT * FROM activated_payments WHERE id = ?").get(payment.id),
    payment,
  );
});
