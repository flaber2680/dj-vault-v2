import { getRuntimeDatabase } from "../client.ts";

export type PasswordResetRecord = {
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
};

type PasswordResetRow = {
  user_id: string;
  email: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

function mapPasswordReset(row: PasswordResetRow): PasswordResetRecord {
  return {
    userId: row.user_id,
    email: row.email,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at ?? undefined,
    createdAt: row.created_at,
  };
}

export function createPasswordReset({
  userId,
  email,
  tokenHash,
  expiresAt,
}: {
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
}): PasswordResetRecord {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const now = new Date().toISOString();
    db.prepare("DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL").run(userId);
    db.prepare(`
      INSERT INTO password_resets (user_id, email, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, email, tokenHash, expiresAt, now);

    return mapPasswordReset(db.prepare(`
      SELECT * FROM password_resets WHERE token_hash = ?
    `).get(tokenHash) as PasswordResetRow);
  });

  return run.immediate();
}

export function consumePasswordReset({
  tokenHash,
  passwordHash,
  now = new Date(),
}: {
  tokenHash: string;
  passwordHash: string;
  now?: Date;
}): void {
  const db = getRuntimeDatabase();
  const run = db.transaction(() => {
    const usedAt = now.toISOString();
    const reset = db.prepare(`
      UPDATE password_resets
      SET used_at = ?
      WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
    `).run(usedAt, tokenHash, usedAt);

    if (reset.changes !== 1) {
      throw new Error("RESET_TOKEN_INVALID");
    }

    const record = db.prepare(`
      SELECT user_id FROM password_resets WHERE token_hash = ?
    `).get(tokenHash) as { user_id: string };
    const user = db.prepare("SELECT 1 FROM users WHERE id = ?").get(record.user_id);
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
      passwordHash,
      usedAt,
      record.user_id,
    );
    db.prepare(`
      INSERT OR IGNORE INTO user_providers (user_id, provider, created_at) VALUES (?, ?, ?)
    `).run(record.user_id, "email", usedAt);
  });

  run.immediate();
}
