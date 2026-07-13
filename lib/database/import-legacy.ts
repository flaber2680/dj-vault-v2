import { readFileSync } from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type {
  ImportCounts,
  ImportReport,
  LegacyCollection,
  LegacyData,
  LegacyDownloadEvent,
  LegacyDownloadRecord,
  LegacyPasswordReset,
  LegacyPayment,
  LegacyPromoCode,
  LegacyReferral,
  LegacyReferralData,
  LegacyUser,
} from "./legacy-types.ts";

const importName = "legacy-json-v1";

const countQueries: Record<keyof ImportCounts, string> = {
  users: "SELECT count(*) AS count FROM users",
  userProviders: "SELECT count(*) AS count FROM user_providers",
  activatedPayments: "SELECT count(*) AS count FROM activated_payments",
  promoCodes: "SELECT count(*) AS count FROM promo_codes",
  referrals: "SELECT count(*) AS count FROM referrals",
  collections: "SELECT count(*) AS count FROM collections",
  downloadRecords: "SELECT count(*) AS count FROM download_records",
  downloadEvents: "SELECT count(*) AS count FROM download_events",
  passwordResets: "SELECT count(*) AS count FROM password_resets",
};

type UnknownRecord = Record<string, unknown>;

function fail(location: string, reason: string): never {
  throw new Error(`Invalid legacy data at ${location}: ${reason}`);
}

function objectAt(value: unknown, location: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(location, "expected an object");
  }

  return value as UnknownRecord;
}

function arrayAt(value: unknown, location: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(location, "expected an array");
  }

  return value;
}

function stringAt(
  record: UnknownRecord,
  key: string,
  location: string,
  optional = false,
): string | undefined {
  const value = record[key];

  if (value === undefined && optional) {
    return undefined;
  }

  if (typeof value !== "string" || (!optional && value.length === 0)) {
    fail(`${location}.${key}`, "expected a non-empty string");
  }

  return value as string;
}

function timestampAt(
  record: UnknownRecord,
  key: string,
  location: string,
  optional = false,
): string | undefined {
  const value = stringAt(record, key, location, optional);

  if (value !== undefined && Number.isNaN(Date.parse(value))) {
    fail(`${location}.${key}`, "expected a valid timestamp");
  }

  return value;
}

function numberAt(
  record: UnknownRecord,
  key: string,
  location: string,
  optional = false,
): number | undefined {
  const value = record[key];

  if (value === undefined && optional) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`${location}.${key}`, "expected a finite number");
  }

  return value as number;
}

function integerAt(
  record: UnknownRecord,
  key: string,
  location: string,
  optional = false,
): number | undefined {
  const value = numberAt(record, key, location, optional);

  if (value !== undefined && !Number.isInteger(value)) {
    fail(`${location}.${key}`, "expected an integer");
  }

  return value;
}

function booleanAt(
  record: UnknownRecord,
  key: string,
  location: string,
  optional = false,
): boolean | undefined {
  const value = record[key];

  if (value === undefined && optional) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    fail(`${location}.${key}`, "expected a boolean");
  }

  return value as boolean;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function parseUser(value: unknown, location: string): LegacyUser {
  const record = objectAt(value, location);
  const providers = arrayAt(record.providers, `${location}.providers`).map(
    (provider, index) => {
      if (typeof provider !== "string" || provider.length === 0) {
        fail(`${location}.providers[${index}]`, "expected a non-empty string");
      }
      return provider;
    },
  );
  const activatedPaymentIds = record.activatedPaymentIds === undefined
    ? undefined
    : arrayAt(record.activatedPaymentIds, `${location}.activatedPaymentIds`).map(
        (paymentId, index) => {
          if (typeof paymentId !== "string" || paymentId.length === 0) {
            fail(`${location}.activatedPaymentIds[${index}]`, "expected a non-empty string");
          }
          return paymentId;
        },
      );

  return {
    id: stringAt(record, "id", location)!,
    email: stringAt(record, "email", location)!,
    name: stringAt(record, "name", location)!,
    plan: stringAt(record, "plan", location, true),
    planExpiresAt: timestampAt(record, "planExpiresAt", location, true),
    activatedPaymentIds,
    providers,
    passwordHash: stringAt(record, "passwordHash", location, true),
    avatarUrl: stringAt(record, "avatarUrl", location, true),
    createdAt: timestampAt(record, "createdAt", location)!,
    updatedAt: timestampAt(record, "updatedAt", location)!,
  };
}

function parsePayment(value: unknown, location: string): LegacyPayment {
  const record = objectAt(value, location);

  return {
    id: stringAt(record, "id", location)!,
    provider: stringAt(record, "provider", location)!,
    providerPaymentId: stringAt(record, "providerPaymentId", location, true),
    providerStatus: stringAt(record, "providerStatus", location, true),
    confirmationUrl: stringAt(record, "confirmationUrl", location, true),
    userId: stringAt(record, "userId", location)!,
    packageId: stringAt(record, "packageId", location, true),
    durationDays: integerAt(record, "durationDays", location, true),
    planId: stringAt(record, "planId", location, true),
    activationPlanId: stringAt(record, "activationPlanId", location, true),
    method: stringAt(record, "method", location)!,
    amount: numberAt(record, "amount", location)!,
    currency: stringAt(record, "currency", location)!,
    status: stringAt(record, "status", location)!,
    paidAt: timestampAt(record, "paidAt", location, true),
    error: stringAt(record, "error", location, true),
    createdAt: timestampAt(record, "createdAt", location)!,
    updatedAt: timestampAt(record, "updatedAt", location)!,
  };
}

function parsePromoCode(value: unknown, location: string): LegacyPromoCode {
  const record = objectAt(value, location);

  return {
    id: stringAt(record, "id", location)!,
    code: stringAt(record, "code", location)!,
    ownerUserId: stringAt(record, "ownerUserId", location)!,
    isActive: booleanAt(record, "isActive", location)!,
    createdAt: timestampAt(record, "createdAt", location)!,
    updatedAt: timestampAt(record, "updatedAt", location)!,
  };
}

function parseReferral(value: unknown, location: string): LegacyReferral {
  const record = objectAt(value, location);

  return {
    id: stringAt(record, "id", location)!,
    promoCodeId: stringAt(record, "promoCodeId", location)!,
    code: stringAt(record, "code", location)!,
    ownerUserId: stringAt(record, "ownerUserId", location)!,
    referredUserId: stringAt(record, "referredUserId", location)!,
    registeredAt: timestampAt(record, "registeredAt", location)!,
    convertedAt: timestampAt(record, "convertedAt", location, true),
    convertedPackageId: stringAt(record, "convertedPackageId", location, true),
    convertedDurationDays: integerAt(record, "convertedDurationDays", location, true),
    convertedAmount: numberAt(record, "convertedAmount", location, true),
    convertedPlan: stringAt(record, "convertedPlan", location, true),
    paymentId: stringAt(record, "paymentId", location, true),
  };
}

function parseReferralData(value: unknown): LegacyReferralData {
  const record = objectAt(value, "promo-codes.json");

  return {
    codes: arrayAt(record.codes ?? [], "promo-codes.json.codes").map((item, index) =>
      parsePromoCode(item, `promo-codes.json.codes[${index}]`),
    ),
    referrals: arrayAt(record.referrals ?? [], "promo-codes.json.referrals").map(
      (item, index) => parseReferral(item, `promo-codes.json.referrals[${index}]`),
    ),
  };
}

function parseCollection(value: unknown, location: string): LegacyCollection {
  const record = objectAt(value, location);
  const downloadLimit = record.downloadLimit;

  if (
    downloadLimit !== undefined &&
    !(
      (typeof downloadLimit === "number" && Number.isFinite(downloadLimit)) ||
      typeof downloadLimit === "string"
    )
  ) {
    fail(`${location}.downloadLimit`, "expected a string or finite number");
  }

  return {
    number: stringAt(record, "number", location)!,
    date: stringAt(record, "date", location)!,
    size: stringAt(record, "size", location, true),
    sizeBytes: integerAt(record, "sizeBytes", location, true),
    genres: stringAt(record, "genres", location)!,
    description: stringAt(record, "description", location, true),
    tracks: stringAt(record, "tracks", location)!,
    s3Key: stringAt(record, "s3Key", location, true),
    downloadUrl: stringAt(record, "downloadUrl", location, true),
    isActive: booleanAt(record, "isActive", location, true),
    downloadLimit: downloadLimit as string | number | undefined,
  };
}

function parseDownloadEvent(value: unknown, location: string): LegacyDownloadEvent {
  const record = objectAt(value, location);

  return {
    downloadedAt: timestampAt(record, "downloadedAt", location)!,
    ipAddress: stringAt(record, "ipAddress", location)!,
    userAgent: stringAt(record, "userAgent", location)!,
  };
}

function parseDownloadRecord(value: unknown, location: string): LegacyDownloadRecord {
  const record = objectAt(value, location);

  return {
    userId: stringAt(record, "userId", location)!,
    archiveId: stringAt(record, "archiveId", location)!,
    downloadCount: integerAt(record, "downloadCount", location)!,
    downloadedAt: timestampAt(record, "downloadedAt", location, true),
    events: arrayAt(record.events, `${location}.events`).map((event, index) =>
      parseDownloadEvent(event, `${location}.events[${index}]`),
    ),
    updatedAt: timestampAt(record, "updatedAt", location)!,
  };
}

function parsePasswordReset(value: unknown, location: string): LegacyPasswordReset {
  const record = objectAt(value, location);

  return {
    userId: stringAt(record, "userId", location)!,
    email: stringAt(record, "email", location)!,
    tokenHash: stringAt(record, "tokenHash", location)!,
    expiresAt: timestampAt(record, "expiresAt", location)!,
    usedAt: timestampAt(record, "usedAt", location, true),
    createdAt: timestampAt(record, "createdAt", location)!,
  };
}

function readJson(dataDirectory: string, fileName: string, emptyValue: unknown): unknown {
  try {
    return JSON.parse(readFileSync(path.join(dataDirectory, fileName), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyValue;
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid legacy JSON in ${fileName}`);
    }
    throw error;
  }
}

function uniqueBy(values: string[], description: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`Conflicting legacy ${description}`);
  }
}

function validateRelationships(data: LegacyData): void {
  const usersById = new Map(data.users.map((user) => [user.id, user]));
  uniqueBy(data.users.map((user) => user.id), "user IDs");
  const normalizedEmails = data.users.map((user) => normalizeEmail(user.email));
  if (new Set(normalizedEmails).size !== normalizedEmails.length) {
    throw new Error("Conflicting normalized email in legacy data");
  }

  for (const user of data.users) {
    uniqueBy(user.providers, `provider memberships for user ${user.id}`);
    if (!normalizeEmail(user.email)) {
      throw new Error("Invalid legacy data at users.json.email: normalized email is empty");
    }
  }

  uniqueBy(data.payments.map((payment) => payment.id), "payment IDs");
  uniqueBy(
    data.payments
      .map((payment) => payment.providerPaymentId)
      .filter((value): value is string => value !== undefined),
    "provider payment IDs",
  );
  for (const payment of data.payments) {
    if (!usersById.has(payment.userId)) {
      throw new Error(`Conflicting legacy payment ownership for ${payment.id}`);
    }
  }

  const activationOwners = new Map<string, string>();
  for (const user of data.users) {
    for (const paymentId of new Set(user.activatedPaymentIds ?? [])) {
      const owner = activationOwners.get(paymentId);
      if (owner && owner !== user.id) {
        throw new Error(`Conflicting legacy activated payment ownership for ${paymentId}`);
      }
      activationOwners.set(paymentId, user.id);
    }
  }
  for (const payment of data.payments) {
    const activationOwner = activationOwners.get(payment.id);
    if (activationOwner && activationOwner !== payment.userId) {
      throw new Error(`Conflicting legacy payment ownership for ${payment.id}`);
    }
  }

  const paymentOwners = new Map(
    data.payments.map((payment) => [payment.id, payment.userId]),
  );
  for (const [paymentId, userId] of activationOwners) {
    paymentOwners.set(paymentId, userId);
  }
  const effectiveProviderIds = [
    ...data.payments.map((payment) => payment.providerPaymentId).filter(Boolean),
    ...[...activationOwners.keys()].filter(
      (paymentId) => !data.payments.some((payment) => payment.id === paymentId),
    ),
  ] as string[];
  uniqueBy(effectiveProviderIds, "provider payment IDs");

  uniqueBy(data.referralData.codes.map((code) => code.id), "promo code IDs");
  uniqueBy(
    data.referralData.codes.map((code) => normalizePromoCode(code.code)),
    "normalized promo codes",
  );
  const codesById = new Map(data.referralData.codes.map((code) => [code.id, code]));
  for (const code of data.referralData.codes) {
    if (!usersById.has(code.ownerUserId) || !normalizePromoCode(code.code)) {
      throw new Error(`Conflicting legacy promo code ownership for ${code.id}`);
    }
  }

  uniqueBy(data.referralData.referrals.map((referral) => referral.id), "referral IDs");
  uniqueBy(
    data.referralData.referrals.map((referral) => referral.referredUserId),
    "referred user IDs",
  );
  for (const referral of data.referralData.referrals) {
    const code = codesById.get(referral.promoCodeId);
    if (referral.ownerUserId === referral.referredUserId) {
      throw new Error(`Conflicting legacy self-referral for ${referral.id}`);
    }
    if (
      referral.paymentId !== undefined &&
      paymentOwners.get(referral.paymentId) !== referral.referredUserId
    ) {
      throw new Error(`Conflicting legacy referral payment ownership for ${referral.id}`);
    }
    if (
      !code ||
      !usersById.has(referral.referredUserId) ||
      referral.ownerUserId !== code.ownerUserId ||
      normalizePromoCode(referral.code) !== normalizePromoCode(code.code)
    ) {
      throw new Error(`Conflicting legacy referral ownership for ${referral.id}`);
    }
  }

  uniqueBy(data.collections.map((collection) => collection.number), "collection numbers");
  for (const collection of data.collections) {
    const downloadLimit = Number(collection.downloadLimit ?? 2);
    if (!Number.isFinite(downloadLimit) || downloadLimit <= 0) {
      throw new Error(`Invalid legacy data at collection ${collection.number}: invalid download limit`);
    }
  }
  uniqueBy(
    data.downloads.map((record) => `${record.userId}\0${record.archiveId}`),
    "download record identities",
  );
  for (const record of data.downloads) {
    if (!usersById.has(record.userId) || record.downloadCount < 0) {
      throw new Error(`Conflicting legacy download ownership for ${record.userId}`);
    }
  }

  uniqueBy(data.passwordResets.map((reset) => reset.tokenHash), "password reset hashes");
  for (const reset of data.passwordResets) {
    const user = usersById.get(reset.userId);
    if (!user || normalizeEmail(reset.email) !== normalizeEmail(user.email)) {
      throw new Error(`Conflicting legacy password reset ownership for ${reset.userId}`);
    }
  }
}

export function readLegacyData(dataDirectory: string): LegacyData {
  const users = arrayAt(readJson(dataDirectory, "users.json", []), "users.json").map(
    (item, index) => parseUser(item, `users.json[${index}]`),
  );
  const payments = arrayAt(
    readJson(dataDirectory, "payments.json", []),
    "payments.json",
  ).map((item, index) => parsePayment(item, `payments.json[${index}]`));
  const collections = arrayAt(
    readJson(dataDirectory, "collections.json", []),
    "collections.json",
  ).map((item, index) => parseCollection(item, `collections.json[${index}]`));
  const downloads = arrayAt(
    readJson(dataDirectory, "downloads.json", []),
    "downloads.json",
  ).map((item, index) => parseDownloadRecord(item, `downloads.json[${index}]`));
  const passwordResets = arrayAt(
    readJson(dataDirectory, "password-resets.json", []),
    "password-resets.json",
  ).map((item, index) => parsePasswordReset(item, `password-resets.json[${index}]`));
  const data = {
    users,
    payments,
    referralData: parseReferralData(
      readJson(dataDirectory, "promo-codes.json", { codes: [], referrals: [] }),
    ),
    collections,
    downloads,
    passwordResets,
  };

  validateRelationships(data);
  return data;
}

export function getExpectedImportCounts(data: LegacyData): ImportCounts {
  return {
    users: data.users.length,
    userProviders: data.users.reduce((total, user) => total + user.providers.length, 0),
    activatedPayments: new Set([
      ...data.payments.map((payment) => payment.id),
      ...data.users.flatMap((user) => user.activatedPaymentIds ?? []),
    ]).size,
    promoCodes: data.referralData.codes.length,
    referrals: data.referralData.referrals.length,
    collections: data.collections.length,
    downloadRecords: data.downloads.length,
    downloadEvents: data.downloads.reduce((total, record) => total + record.events.length, 0),
    passwordResets: data.passwordResets.length,
  };
}

export function getDatabaseImportCounts(db: Database.Database): ImportCounts {
  return Object.fromEntries(
    Object.entries(countQueries).map(([key, query]) => [
      key,
      (db.prepare(query).get() as { count: number }).count,
    ]),
  ) as ImportCounts;
}

function assertCounts(actual: ImportCounts, expected: ImportCounts): void {
  for (const key of Object.keys(expected) as Array<keyof ImportCounts>) {
    if (actual[key] !== expected[key]) {
      throw new Error(`Legacy import count mismatch for ${key}`);
    }
  }
}

function assertIds(
  db: Database.Database,
  query: string,
  expected: string[],
  description: string,
): void {
  const actual = (db.prepare(query).all() as Array<{ id: string }>).map((row) => row.id).sort();
  const sortedExpected = [...expected].sort();

  if (actual.length !== sortedExpected.length || actual.some((id, index) => id !== sortedExpected[index])) {
    throw new Error(`Legacy import critical ID mismatch for ${description}`);
  }
}

function insertLegacyData(
  db: Database.Database,
  data: LegacyData,
  importTimestamp: string,
): void {
  const insertUser = db.prepare(`
    INSERT INTO users (
      id, email, name, plan, plan_expires_at, password_hash, avatar_url, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertProvider = db.prepare(`
    INSERT INTO user_providers (user_id, provider, created_at) VALUES (?, ?, ?)
  `);
  for (const user of data.users) {
    insertUser.run(
      user.id,
      normalizeEmail(user.email),
      user.name,
      user.plan ?? null,
      user.planExpiresAt ?? null,
      user.passwordHash ?? null,
      user.avatarUrl ?? null,
      user.createdAt,
      user.updatedAt,
    );
    for (const provider of user.providers) {
      insertProvider.run(user.id, provider, user.createdAt);
    }
  }

  const insertPayment = db.prepare(`
    INSERT INTO activated_payments (
      id, provider, provider_payment_id, provider_status, confirmation_url, user_id,
      package_id, duration_days, plan_id, activation_plan_id, method, amount, currency,
      status, paid_at, activated_at, error, created_at, updated_at
    ) VALUES (
      @id, @provider, @providerPaymentId, @providerStatus, @confirmationUrl, @userId,
      @packageId, @durationDays, @planId, @activationPlanId, @method, @amount, @currency,
      @status, @paidAt, NULL, @error, @createdAt, @updatedAt
    )
  `);
  const paymentsById = new Map(data.payments.map((payment) => [payment.id, payment]));
  for (const payment of data.payments) {
    insertPayment.run({
      ...payment,
      providerPaymentId: payment.providerPaymentId ?? null,
      providerStatus: payment.providerStatus ?? null,
      confirmationUrl: payment.confirmationUrl ?? null,
      packageId: payment.packageId ?? null,
      durationDays: payment.durationDays ?? null,
      planId: payment.planId ?? null,
      activationPlanId: payment.activationPlanId ?? null,
      paidAt: payment.paidAt ?? null,
      error: payment.error ?? null,
    });
  }
  const insertLegacyActivation = db.prepare(`
    INSERT INTO activated_payments (id, provider_payment_id, user_id) VALUES (?, ?, ?)
  `);
  for (const user of data.users) {
    for (const paymentId of new Set(user.activatedPaymentIds ?? [])) {
      if (!paymentsById.has(paymentId)) {
        insertLegacyActivation.run(paymentId, paymentId, user.id);
      }
    }
  }

  const insertPromoCode = db.prepare(`
    INSERT INTO promo_codes (
      id, code, normalized_code, owner_user_id, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const code of data.referralData.codes) {
    insertPromoCode.run(
      code.id,
      code.code,
      normalizePromoCode(code.code),
      code.ownerUserId,
      Number(code.isActive),
      code.createdAt,
      code.updatedAt,
    );
  }

  const insertReferral = db.prepare(`
    INSERT INTO referrals (
      id, promo_code_id, code, owner_user_id, referred_user_id, registered_at,
      converted_at, converted_package_id, converted_duration_days, converted_amount,
      converted_plan, payment_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const referral of data.referralData.referrals) {
    insertReferral.run(
      referral.id,
      referral.promoCodeId,
      referral.code,
      referral.ownerUserId,
      referral.referredUserId,
      referral.registeredAt,
      referral.convertedAt ?? null,
      referral.convertedPackageId ?? null,
      referral.convertedDurationDays ?? null,
      referral.convertedAmount ?? null,
      referral.convertedPlan ?? null,
      referral.paymentId ?? null,
    );
  }

  const insertCollection = db.prepare(`
    INSERT INTO collections (
      number, date, size, size_bytes, genres, description, tracks, s3_key,
      legacy_download_url, is_active, download_limit, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const collection of data.collections) {
    const downloadLimit = Number(collection.downloadLimit ?? 2);
    insertCollection.run(
      collection.number,
      collection.date,
      collection.size ?? "",
      collection.sizeBytes ?? null,
      collection.genres,
      collection.description ?? "",
      collection.tracks,
      collection.s3Key ?? null,
      collection.downloadUrl ?? null,
      Number(collection.isActive ?? true),
      downloadLimit,
      importTimestamp,
      importTimestamp,
    );
  }

  const insertDownloadRecord = db.prepare(`
    INSERT INTO download_records (
      user_id, archive_id, download_count, downloaded_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertDownloadEvent = db.prepare(`
    INSERT INTO download_events (
      user_id, archive_id, downloaded_at, ip_address, user_agent
    ) VALUES (?, ?, ?, ?, ?)
  `);
  for (const record of data.downloads) {
    insertDownloadRecord.run(
      record.userId,
      record.archiveId,
      record.downloadCount,
      record.downloadedAt ?? null,
      record.updatedAt,
      record.updatedAt,
    );
    for (const event of record.events) {
      insertDownloadEvent.run(
        record.userId,
        record.archiveId,
        event.downloadedAt,
        event.ipAddress,
        event.userAgent,
      );
    }
  }

  const insertReset = db.prepare(`
    INSERT INTO password_resets (
      user_id, email, token_hash, expires_at, used_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const reset of data.passwordResets) {
    insertReset.run(
      reset.userId,
      normalizeEmail(reset.email),
      reset.tokenHash,
      reset.expiresAt,
      reset.usedAt ?? null,
      reset.createdAt,
    );
  }
}

export function importLegacyData(
  db: Database.Database,
  dataDirectory: string,
): ImportReport {
  const marker = db.prepare("SELECT 1 FROM data_imports WHERE name = ?").get(importName);
  if (marker) {
    return { imported: false, counts: getDatabaseImportCounts(db) };
  }

  const data = readLegacyData(dataDirectory);
  const expectedCounts = getExpectedImportCounts(data);
  const importTimestamp = new Date().toISOString();

  const runImport = db.transaction((): ImportReport => {
    if (db.prepare("SELECT 1 FROM data_imports WHERE name = ?").get(importName)) {
      return { imported: false, counts: getDatabaseImportCounts(db) };
    }

    insertLegacyData(db, data, importTimestamp);
    const actualCounts = getDatabaseImportCounts(db);
    assertCounts(actualCounts, expectedCounts);
    assertIds(db, "SELECT id FROM users", data.users.map((user) => user.id), "users");
    assertIds(
      db,
      "SELECT id FROM activated_payments",
      [...new Set([
        ...data.payments.map((payment) => payment.id),
        ...data.users.flatMap((user) => user.activatedPaymentIds ?? []),
      ])],
      "activated payments",
    );
    assertIds(
      db,
      "SELECT id FROM promo_codes",
      data.referralData.codes.map((code) => code.id),
      "promo codes",
    );
    assertIds(
      db,
      "SELECT id FROM referrals",
      data.referralData.referrals.map((referral) => referral.id),
      "referrals",
    );
    assertIds(
      db,
      "SELECT number AS id FROM collections",
      data.collections.map((collection) => collection.number),
      "collections",
    );

    db.prepare(`
      INSERT INTO data_imports (name, imported_at, source_directory) VALUES (?, ?, ?)
    `).run(importName, importTimestamp, path.resolve(dataDirectory));

    return { imported: true, counts: actualCounts };
  });

  return runImport.immediate();
}
