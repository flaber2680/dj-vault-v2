import { existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import { getDataDirectory } from "../lib/database/config.ts";
import {
  getDatabaseImportCounts,
  getExpectedImportCounts,
  getImportedPaymentIds,
  readLegacyData,
} from "../lib/database/import-legacy.ts";

const help = `Usage: npm run data:verify -- [options]

Compare legacy JSON data with an imported SQLite database.

Options:
  --data-directory <path>  Directory containing legacy JSON files
  --database <path>        SQLite database path
  --help                    Show this help
`;

function parseArguments(arguments_) {
  const options = {};

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    if (argument !== "--data-directory" && argument !== "--database") {
      throw new Error("Unknown command option");
    }

    const value = arguments_[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Command option requires a path");
    }
    const key = argument === "--database" ? "database" : "dataDirectory";
    if (options[key]) {
      throw new Error("Command option may only be provided once");
    }
    options[key] = value;
    index += 1;
  }

  return options;
}

function sorted(values) {
  return [...values].sort();
}

function sameValues(actual, expected) {
  const left = sorted(actual);
  const right = sorted(expected);

  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function columnValues(db, query, column = "id") {
  return db.prepare(query).all().map((row) => String(row[column]));
}

function eventValue(userId, archiveId, downloadedAt, ipAddress, userAgent) {
  return JSON.stringify([userId, archiveId, downloadedAt, ipAddress, userAgent]);
}

function identityChecks(db, data) {
  const expectedPaymentIds = getImportedPaymentIds(data);

  return [
    ["users", columnValues(db, "SELECT id FROM users"), data.users.map((user) => user.id)],
    [
      "userProviders",
      columnValues(
        db,
        "SELECT user_id || char(0) || provider AS id FROM user_providers",
      ),
      data.users.flatMap((user) =>
        user.providers.map((provider) => `${user.id}\0${provider}`),
      ),
    ],
    ["activatedPayments", columnValues(db, "SELECT id FROM activated_payments"), expectedPaymentIds],
    [
      "promoCodes",
      columnValues(db, "SELECT id FROM promo_codes"),
      data.referralData.codes.map((code) => code.id),
    ],
    [
      "referrals",
      columnValues(db, "SELECT id FROM referrals"),
      data.referralData.referrals.map((referral) => referral.id),
    ],
    [
      "collections",
      columnValues(db, "SELECT number AS id FROM collections"),
      data.collections.map((collection) => collection.number),
    ],
    [
      "downloadRecords",
      columnValues(
        db,
        "SELECT user_id || char(0) || archive_id AS id FROM download_records",
      ),
      data.downloads.map((record) => `${record.userId}\0${record.archiveId}`),
    ],
    [
      "downloadEvents",
      db.prepare(`
        SELECT user_id, archive_id, downloaded_at, ip_address, user_agent
        FROM download_events
      `).all().map((row) =>
        eventValue(
          row.user_id,
          row.archive_id,
          row.downloaded_at,
          row.ip_address,
          row.user_agent,
        ),
      ),
      data.downloads.flatMap((record) =>
        record.events.map((event) =>
          eventValue(
            record.userId,
            record.archiveId,
            event.downloadedAt,
            event.ipAddress,
            event.userAgent,
          ),
        ),
      ),
    ],
    [
      "passwordResets",
      columnValues(db, "SELECT token_hash AS id FROM password_resets"),
      data.passwordResets.map((reset) => reset.tokenHash),
    ],
  ];
}

function run() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`Verification failed: ${error.message}`);
    console.error(help.trimEnd());
    return 2;
  }

  if (options.help) {
    console.log(help.trimEnd());
    return 0;
  }

  const dataDirectory = path.resolve(options.dataDirectory ?? getDataDirectory());
  const databasePath = path.resolve(
    options.database ?? path.join(dataDirectory, "dj-vault.sqlite"),
  );
  if (!existsSync(databasePath)) {
    console.error("Verification failed: database file does not exist");
    console.log("conflicts: 1");
    return 1;
  }

  let db;
  try {
    const data = readLegacyData(dataDirectory);
    const expected = getExpectedImportCounts(data);
    db = new Database(databasePath, { readonly: true, fileMustExist: true });
    const actual = getDatabaseImportCounts(db);
    const markerPresent = Boolean(
      db.prepare("SELECT 1 FROM data_imports WHERE name = ?").get("legacy-json-v1"),
    );
    let conflicts = markerPresent ? 0 : 1;

    console.log(`marker legacy-json-v1: ${markerPresent ? "present" : "missing"}`);
    for (const key of Object.keys(expected)) {
      const matches = expected[key] === actual[key];
      if (!matches) {
        conflicts += 1;
      }
      console.log(
        `${key} json=${expected[key]} sqlite=${actual[key]} ${matches ? "OK" : "MISMATCH"}`,
      );
    }

    for (const [key, sqliteIds, jsonIds] of identityChecks(db, data)) {
      if (expected[key] === actual[key] && !sameValues(sqliteIds, jsonIds)) {
        conflicts += 1;
      }
    }

    console.log(`conflicts: ${conflicts === 0 ? "none" : conflicts}`);
    return conflicts === 0 ? 0 : 1;
  } catch (error) {
    console.error(`Verification failed: ${error.message}`);
    console.log("conflicts: 1");
    return 1;
  } finally {
    db?.close();
  }
}

process.exitCode = run();
