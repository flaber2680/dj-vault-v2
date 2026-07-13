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

  assert.equal(
    db.prepare("SELECT count(*) AS count FROM schema_migrations").get().count,
    1,
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
