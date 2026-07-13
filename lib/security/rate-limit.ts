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

export type RateLimitBucket = {
  scope: string;
  subject: string;
  limit: number;
  windowMs: number;
};

type ConsumeRateLimitInput = RateLimitBucket & {
  now?: number;
};

type ConsumeRateLimitsInput = {
  limits: RateLimitBucket[];
  now?: number;
};

export type RateLimitsResult = {
  allowed: boolean;
  results: RateLimitResult[];
  retryAfterSeconds: number;
};

const expiredRowsPerRequest = 100;

function rateLimitKey(scope: string, subject: string) {
  return `rate-limit:v1:${scope}:${subject}`;
}

function validateBucket(bucket: RateLimitBucket) {
  if (
    !bucket.scope ||
    !bucket.subject ||
    !Number.isInteger(bucket.limit) ||
    bucket.limit < 1 ||
    !Number.isFinite(bucket.windowMs) ||
    bucket.windowMs <= 0
  ) {
    throw new Error("INVALID_RATE_LIMIT");
  }
}

export function consumeRateLimits({
  limits,
  now = Date.now(),
}: ConsumeRateLimitsInput): RateLimitsResult {
  if (limits.length < 1 || !Number.isFinite(now)) {
    throw new Error("INVALID_RATE_LIMIT");
  }

  limits.forEach(validateBucket);
  const buckets = limits.map((limit) => ({
    ...limit,
    key: rateLimitKey(limit.scope, limit.subject),
  }));
  if (new Set(buckets.map((bucket) => bucket.key)).size !== buckets.length) {
    throw new Error("DUPLICATE_RATE_LIMIT");
  }

  const db = getRuntimeDatabase();
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

    const deleteExpiredKey = db.prepare(`
      DELETE FROM rate_limits
      WHERE key = ? AND expires_at <= ?
    `);
    const getCurrent = db.prepare(`
      SELECT count, expires_at
      FROM rate_limits
      WHERE key = ?
      ORDER BY window_start DESC
      LIMIT 1
    `);

    const states = buckets.map((bucket) => {
      deleteExpiredKey.run(bucket.key, nowIso);
      const existing = getCurrent.get(bucket.key) as RateLimitRow | undefined;
      return { bucket, existing };
    });
    const blocked = states.map(({ bucket, existing }) => {
      if (!existing || existing.count < bucket.limit) {
        return null;
      }

      return Math.max(
        1,
        Math.ceil((new Date(existing.expires_at).getTime() - now) / 1000),
      );
    });
    const retryAfterSeconds = Math.max(0, ...blocked.filter((value) => value !== null));

    if (blocked.some((value) => value !== null)) {
      return {
        allowed: false,
        retryAfterSeconds,
        results: states.map(({ bucket, existing }, index) => ({
          allowed: blocked[index] === null,
          remaining:
            blocked[index] === null
              ? bucket.limit - (existing?.count ?? 0)
              : 0,
          retryAfterSeconds: blocked[index] ?? 0,
        })),
      };
    }

    const insert = db.prepare(`
      INSERT INTO rate_limits (key, window_start, count, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    const increment = db.prepare(`
      UPDATE rate_limits
      SET count = count + 1
      WHERE key = ? AND expires_at = ?
    `);

    const results = states.map(({ bucket, existing }) => {
      if (!existing) {
        insert.run(
          bucket.key,
          nowIso,
          1,
          new Date(now + bucket.windowMs).toISOString(),
        );
      } else {
        increment.run(bucket.key, existing.expires_at);
      }

      return {
        allowed: true,
        remaining: bucket.limit - (existing?.count ?? 0) - 1,
        retryAfterSeconds: 0,
      };
    });

    return {
      allowed: true,
      results,
      retryAfterSeconds: 0,
    };
  });

  return run.immediate();
}

export function consumeRateLimit({
  now,
  ...limit
}: ConsumeRateLimitInput): RateLimitResult {
  return consumeRateLimits({ limits: [limit], now }).results[0];
}
