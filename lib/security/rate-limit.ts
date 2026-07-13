import { getRuntimeDatabase } from "@/lib/database/client";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitRow = {
  count: number;
  expires_at: string;
};

type ConsumeRateLimitInput = {
  scope: string;
  subject: string;
  limit: number;
  windowMs: number;
  now?: number;
};

const expiredRowsPerRequest = 100;

function rateLimitKey(scope: string, subject: string) {
  return `rate-limit:v1:${scope}:${subject}`;
}

export function consumeRateLimit({
  scope,
  subject,
  limit,
  windowMs,
  now = Date.now(),
}: ConsumeRateLimitInput): RateLimitResult {
  if (!scope || !subject || !Number.isInteger(limit) || limit < 1) {
    throw new Error("INVALID_RATE_LIMIT");
  }

  if (!Number.isFinite(windowMs) || windowMs <= 0 || !Number.isFinite(now)) {
    throw new Error("INVALID_RATE_LIMIT");
  }

  const db = getRuntimeDatabase();
  const key = rateLimitKey(scope, subject);
  const nowIso = new Date(now).toISOString();
  const run = db.transaction(() => {
    db.prepare(`
      DELETE FROM rate_limits
      WHERE rowid IN (
        SELECT rowid
        FROM rate_limits
        WHERE expires_at <= ?
        LIMIT ?
      )
    `).run(nowIso, expiredRowsPerRequest);

    db.prepare(`
      DELETE FROM rate_limits
      WHERE key = ? AND expires_at <= ?
    `).run(key, nowIso);

    const existing = db.prepare(`
      SELECT count, expires_at
      FROM rate_limits
      WHERE key = ?
      ORDER BY window_start DESC
      LIMIT 1
    `).get(key) as RateLimitRow | undefined;

    if (!existing) {
      const expiresAt = new Date(now + windowMs).toISOString();
      db.prepare(`
        INSERT INTO rate_limits (key, window_start, count, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(key, nowIso, 1, expiresAt);

      return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((new Date(existing.expires_at).getTime() - now) / 1000),
        ),
      };
    }

    db.prepare(`
      UPDATE rate_limits
      SET count = count + 1
      WHERE key = ? AND expires_at = ?
    `).run(key, existing.expires_at);

    return {
      allowed: true,
      remaining: limit - existing.count - 1,
      retryAfterSeconds: 0,
    };
  });

  return run.immediate();
}
