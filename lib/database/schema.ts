import type Database from "better-sqlite3";

type Migration = {
  name: string;
  sql: string;
};

const migrations: Migration[] = [
  {
    name: "001_initial_schema",
    sql: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        plan TEXT,
        plan_expires_at TEXT,
        password_hash TEXT,
        avatar_url TEXT,
        session_version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE user_providers (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_account_id TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (user_id, provider)
      );

      CREATE TABLE activated_payments (
        id TEXT PRIMARY KEY,
        provider TEXT,
        provider_payment_id TEXT UNIQUE,
        provider_status TEXT,
        confirmation_url TEXT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        package_id TEXT,
        duration_days INTEGER,
        plan_id TEXT,
        activation_plan_id TEXT,
        method TEXT,
        amount REAL,
        currency TEXT,
        status TEXT,
        paid_at TEXT,
        activated_at TEXT,
        error TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE promo_codes (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        normalized_code TEXT NOT NULL UNIQUE,
        owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        is_active INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE referrals (
        id TEXT PRIMARY KEY,
        promo_code_id TEXT NOT NULL REFERENCES promo_codes(id) ON DELETE RESTRICT,
        code TEXT NOT NULL,
        owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        referred_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
        registered_at TEXT NOT NULL,
        converted_at TEXT,
        converted_package_id TEXT,
        converted_duration_days INTEGER,
        converted_amount REAL,
        converted_plan TEXT,
        payment_id TEXT REFERENCES activated_payments(id) ON DELETE RESTRICT
      );

      CREATE TABLE collections (
        number TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        size TEXT NOT NULL,
        size_bytes INTEGER,
        genres TEXT NOT NULL,
        description TEXT NOT NULL,
        tracks TEXT NOT NULL,
        s3_key TEXT,
        legacy_download_url TEXT,
        is_active INTEGER NOT NULL,
        download_limit INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE download_records (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        archive_id TEXT NOT NULL,
        download_count INTEGER NOT NULL,
        downloaded_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (user_id, archive_id)
      );

      CREATE TABLE download_events (
        id INTEGER PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        archive_id TEXT NOT NULL,
        downloaded_at TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        user_agent TEXT NOT NULL
      );

      CREATE TABLE password_resets (
        id INTEGER PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE rate_limits (
        key TEXT NOT NULL,
        window_start TEXT NOT NULL,
        count INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        PRIMARY KEY (key, window_start)
      );

      CREATE TABLE data_imports (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        imported_at TEXT NOT NULL,
        source_directory TEXT
      );
    `,
  },
  {
    name: "002_rate_limits_expires_at_index",
    sql: `
      CREATE INDEX idx_rate_limits_expires_at
      ON rate_limits(expires_at);
    `,
  },
  {
    name: "003_promo_discounts",
    sql: `
      ALTER TABLE promo_codes ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 20;
      ALTER TABLE promo_codes ADD COLUMN discount_registration_limit INTEGER;
      ALTER TABLE referrals ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE referrals ADD COLUMN discount_reserved_payment_id TEXT;
      ALTER TABLE referrals ADD COLUMN discount_reserved_at TEXT;
      ALTER TABLE referrals ADD COLUMN discount_used_at TEXT;
      ALTER TABLE referrals ADD COLUMN converted_original_amount REAL;
      ALTER TABLE referrals ADD COLUMN converted_discount_percent INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE activated_payments ADD COLUMN original_amount REAL;
      ALTER TABLE activated_payments ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE activated_payments ADD COLUMN promo_code_id TEXT;
      UPDATE promo_codes
      SET discount_percent = 50, discount_registration_limit = 16
      WHERE normalized_code = 'KIT';
      CREATE INDEX idx_referrals_discount_reservation
      ON referrals(discount_reserved_payment_id);
    `,
  },
];

export function initializeDatabase(db: Database.Database): void {
  const applyMigrations = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      );
    `);

    const getMigration = db.prepare(
      "SELECT 1 FROM schema_migrations WHERE name = ?",
    );
    const recordMigration = db.prepare(
      "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
    );

    for (const migration of migrations) {
      if (getMigration.get(migration.name)) {
        continue;
      }

      db.exec(migration.sql);
      recordMigration.run(migration.name, new Date().toISOString());
    }
  });

  applyMigrations();
}
