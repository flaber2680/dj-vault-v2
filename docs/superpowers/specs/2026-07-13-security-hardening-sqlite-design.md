# DJ Vault Security Hardening and SQLite Migration

## Goal

Remove the security and reliability issues found in the July 13 audit without losing existing production users, access periods, payments, referrals, collections, password-reset records, or download history.

## Scope

This change covers:

- SQLite as the authoritative runtime store for mutable application data.
- One-time, repeatable import from the existing `.data/*.json` files.
- Transactional user registration, payment activation, referral conversion, password reset, and download-limit accounting.
- Session invalidation after password changes.
- Rate limits for authentication, password-reset, payment webhook, and download endpoints.
- A mandatory production session secret and hardened HTTP response headers.
- POST-based download accounting.
- Page metadata and mobile overflow fixes for legal pages.

The visual design, tariff rules, YooKassa checkout contract, S3 object layout, and administrator identity rules do not change.

## Storage Architecture

Use SQLite through `better-sqlite3`. The database lives at `DATA_DIRECTORY/dj-vault.sqlite`, defaulting to `.data/dj-vault.sqlite`. Production must point `DATA_DIRECTORY` at a persistent directory outside build artifacts.

The application opens one database connection per Node.js process, enables WAL mode, foreign keys, and a busy timeout, and applies numbered schema migrations before serving repository operations.

Tables:

- `users`: identity, password hash, plan, expiration, session version, timestamps.
- `user_providers`: one row per authentication provider.
- `activated_payments`: unique provider payment ID, user, package, amount, currency, activation timestamp.
- `promo_codes`: normalized unique code, owner, active state, timestamps.
- `referrals`: referred user, promo code, registration and conversion details; one referral per referred user.
- `collections`: all editable collection fields and timestamps.
- `download_records`: unique user/archive aggregate and current count.
- `download_events`: append-only download audit records.
- `password_resets`: hashed unique token, user, expiration, used timestamp.
- `rate_limits`: key, window start, count, expiration.
- `schema_migrations` and `data_imports`: schema and legacy-import bookkeeping.

Repository modules keep their existing public functions where practical so pages and actions do not need broad rewrites. JSON parsing moves into a dedicated importer and is no longer used by normal requests.

## Legacy Import

At startup, after schema migration, the importer checks `data_imports` for a versioned import marker. If absent, it reads every known legacy JSON file inside the configured data directory in a single SQLite transaction.

Import rules:

- Preserve IDs, timestamps, password hashes, plan expiration dates, activated payment IDs, and download events exactly.
- Normalize promo codes and emails using the same rules as current stores.
- Resolve repeated provider/payment IDs and duplicate referrals deterministically; abort on conflicting user identities instead of silently dropping data.
- Validate row counts and critical identifiers before committing.
- Write the import marker only in the same successful transaction.
- Never rename, truncate, or delete JSON files. They remain rollback evidence and must be backed up before server deployment.
- Re-running startup after success performs no second import.

A standalone verification command reports JSON counts, SQLite counts, conflicts, and import status without printing passwords, reset tokens, or provider secrets.

## Transaction Boundaries

The following operations are single immediate transactions:

- Email registration plus optional promo registration.
- Paid access activation plus payment uniqueness check and referral conversion.
- Password update plus session-version increment plus reset-token consumption.
- Download-limit check, aggregate increment, and event insertion.
- Admin plan changes and download-limit resets.

Unique constraints enforce email, payment ID, promo code, referral user, reset-token hash, and user/archive download record invariants. Code handles constraint failures as domain errors rather than overwriting records.

## Sessions and Passwords

Production startup fails with a clear error when `AUTH_SECRET` is absent or shorter than 32 characters. The development fallback is allowed only when `NODE_ENV !== "production"`.

Session payloads contain `userId`, `sessionVersion`, and `expiresAt`. Every authenticated request compares the signed version to the current user row. Password resets increment `sessionVersion`, invalidating all older cookies. Login creates a cookie with the latest version.

New passwords require at least 10 characters. Existing password hashes remain valid and do not force a reset. Error responses continue to avoid account enumeration.

## Rate Limiting

Use a SQLite-backed fixed-window limiter so limits work across requests and survive restarts:

- Login: 10 attempts per IP and 8 per normalized email per 15 minutes.
- Registration: 8 attempts per IP per hour.
- Password-reset request: 5 per IP and 3 per normalized email per hour.
- Password-reset submission: 10 per IP per hour.
- YooKassa webhook: 120 requests per IP per minute.
- Download creation: 30 requests per user per minute in addition to each collection's business download limit.

Expired limiter rows are removed opportunistically. Rejections use a generic user-facing state and include `Retry-After` where an HTTP response is available.

## Download Flow

Collection cards submit a POST request to the download endpoint. The endpoint authenticates the user, validates collection access, verifies S3 metadata, applies rate and business limits transactionally, then returns or redirects to the signed S3 URL.

GET no longer consumes a download. Metadata failure returns a storage error and does not increment counters. The client IP is used only for audit/rate limiting and is read from proxy headers under the deployment assumption that nginx overwrites those headers.

## HTTP Hardening and Metadata

Next.js responses add:

- `Content-Security-Policy` compatible with Next.js, YooKassa redirects, and current assets.
- `Strict-Transport-Security` in production.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`.
- A restrictive `Permissions-Policy`.

Disable the `X-Powered-By` header. Nginx deployment instructions disable server tokens and preserve HTTPS redirect behavior.

Root metadata defines a Russian title template, description, metadata base, robots defaults, and per-page titles for public pages. Authentication, account, checkout, and admin pages are marked `noindex`.

## Responsive Legal Pages

Legal headings and paragraphs receive `overflow-wrap: anywhere` and `min-width: 0` where needed. The fix must remove horizontal document overflow at 375 CSS pixels without hiding content or globally clipping the page.

## Error Handling and Rollback

Database initialization errors fail startup before requests are accepted. Transactions roll back completely on any domain or I/O error. Logs identify the operation and record IDs but never include password hashes, reset links, cookies, YooKassa credentials, or S3 credentials.

Deployment sequence:

1. Stop application writes briefly.
2. Back up `.data` and the current release.
3. Install dependencies and build.
4. Run migration and verification explicitly.
5. Start the application and perform smoke tests.
6. Keep JSON backup and previous release available for rollback.

Rollback returns to the previous release and original JSON directory. No old JSON file is modified by the new release.

## Verification

Automated tests must prove:

- Legacy import is repeatable and preserves all supported record types.
- Conflicting legacy identities abort the import.
- Concurrent registration cannot duplicate an email.
- A payment ID grants access only once.
- Concurrent downloads cannot exceed the collection limit.
- A reset token is consumed once and invalidates previous sessions.
- All rate-limit boundaries and expiry behavior.
- Production refuses an invalid session secret.
- GET cannot consume a download and S3 metadata failure does not consume one.
- Required security headers and metadata are present.
- Existing tariff, referral, payment, demo, and collection tests still pass.

Final validation includes ESLint, all Node tests, production build, dependency audit, HTTP header inspection, and browser checks at 1440x900 and 375x812 for guest, FREE, CLUB, and admin paths.

