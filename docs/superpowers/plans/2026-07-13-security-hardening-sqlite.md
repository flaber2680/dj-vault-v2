# DJ Vault Security Hardening and SQLite Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace race-prone JSON runtime storage with transactional SQLite and close the authentication, download, HTTP-hardening, metadata, and mobile-layout findings from the July 13 audit.

**Architecture:** Add a single SQLite infrastructure module and focused repositories while retaining the existing public store APIs. Import legacy JSON exactly once inside a transaction, use database constraints and immediate transactions for invariants, and migrate route behavior only after repository compatibility tests pass.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node test runner, `better-sqlite3`, SQLite WAL.

## Global Constraints

- Preserve existing production IDs, hashes, timestamps, plans, payment IDs, referrals, collections, and download history.
- Never modify or delete legacy JSON files.
- Production must fail closed when `AUTH_SECRET` is absent or shorter than 32 characters.
- No production reset link may be written to a plaintext outbox.
- All new behavior follows red-green-refactor and keeps the complete existing test suite passing.
- Unrelated untracked files remain untouched.

---

### Task 1: SQLite Foundation and Schema

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/database/config.ts`
- Create: `lib/database/client.ts`
- Create: `lib/database/schema.ts`
- Create: `tests/database-schema.test.mjs`

**Interfaces:**
- Produces: `getDataDirectory(): string`, `openDatabase(pathOverride?: string): Database`, `initializeDatabase(db): void`, `closeDatabaseForTests(): void`.
- Database startup enables `journal_mode=WAL`, `foreign_keys=ON`, and `busy_timeout=5000`.

- [ ] **Step 1: Install the SQLite dependency**

Run: `npm install better-sqlite3 && npm install -D @types/better-sqlite3`

Expected: lockfile records compatible versions and installation succeeds on the current Node runtime.

- [ ] **Step 2: Write the failing schema test**

Create a temporary database, call `initializeDatabase`, and assert that all tables and uniqueness indexes from the approved design exist, that foreign keys are enabled, and that running initialization twice leaves one migration record.

```js
test("initializes the complete schema idempotently", async () => {
  const db = openDatabase(tempDatabasePath());
  initializeDatabase(db);
  initializeDatabase(db);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
  assert.deepEqual(requiredTables.every((name) => tables.some((row) => row.name === name)), true);
  assert.equal(db.pragma("foreign_keys", { simple: true }), 1);
  assert.equal(db.prepare("SELECT count(*) count FROM schema_migrations").get().count, 1);
});
```

- [ ] **Step 3: Verify the test fails for the missing database modules**

Run: `node --test tests/database-schema.test.mjs`

Expected: FAIL because `lib/database/client.ts` does not exist.

- [ ] **Step 4: Implement configuration, connection lifecycle, and migration 001**

Use `DATA_DIRECTORY` when set, otherwise `path.join(process.cwd(), ".data")`. Create the directory before opening the database. Define the approved tables with foreign keys and unique constraints. Store migration `001_initial_schema` only after every statement succeeds inside a transaction.

- [ ] **Step 5: Verify schema behavior**

Run: `node --test tests/database-schema.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/database tests/database-schema.test.mjs
git commit -m "feat: add transactional SQLite foundation"
```

### Task 2: Repeatable Legacy JSON Import and Verification CLI

**Files:**
- Create: `lib/database/legacy-types.ts`
- Create: `lib/database/import-legacy.ts`
- Create: `scripts/verify-data-migration.mjs`
- Create: `tests/database-import.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `openDatabase`, initialized schema, existing JSON shapes from all store modules.
- Produces: `importLegacyData(db, dataDirectory): ImportReport` and script `npm run data:verify`.

- [ ] **Step 1: Write failing import tests**

Fixtures must include `users.json`, `payments.json`, `promo-codes.json`, `collections.json`, `downloads.json`, and `password-resets.json`. Assert exact IDs/timestamps/hash preservation, normalized email/code behavior, activated-payment expansion, event counts, and a single `legacy-json-v1` marker.

```js
test("imports every legacy store once without changing source files", async () => {
  const before = await snapshotJsonFixtures(directory);
  const first = importLegacyData(db, directory);
  const second = importLegacyData(db, directory);
  assert.equal(first.imported, true);
  assert.equal(second.imported, false);
  assert.deepEqual(await snapshotJsonFixtures(directory), before);
  assert.equal(count(db, "users"), 2);
  assert.equal(count(db, "download_events"), 2);
});
```

Add a second test where duplicate normalized emails map to different IDs; assert the import throws and all target tables remain empty.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/database-import.test.mjs`

Expected: FAIL because the importer is missing.

- [ ] **Step 3: Implement parsers and a single immediate import transaction**

Read absent files as empty datasets, validate all objects before inserts, map legacy `activatedPaymentIds` to `activated_payments`, and compare expected/actual row counts before writing `data_imports`. Reject conflicting identities or ownership rather than using `INSERT OR IGNORE`.

- [ ] **Step 4: Add a secret-safe verification command**

`npm run data:verify` prints per-entity JSON/SQLite counts, marker status, and conflicts. It must never print password hashes, reset hashes/links, cookies, or provider credentials and exits nonzero on mismatch.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/database-import.test.mjs && npm run data:verify -- --help`

Expected: tests PASS and CLI documents `--data-directory` and `--database`.

- [ ] **Step 6: Commit**

```bash
git add lib/database scripts/verify-data-migration.mjs tests/database-import.test.mjs package.json
git commit -m "feat: import legacy data into SQLite safely"
```

### Task 3: Transactional Repositories

**Files:**
- Create: `lib/database/repositories/users.ts`
- Create: `lib/database/repositories/payments.ts`
- Create: `lib/database/repositories/referrals.ts`
- Create: `lib/database/repositories/collections.ts`
- Create: `lib/database/repositories/downloads.ts`
- Create: `lib/database/repositories/password-resets.ts`
- Modify: `lib/auth/store.ts`
- Modify: `lib/payments/store.ts`
- Modify: `lib/referrals/store.ts`
- Modify: `lib/content/collections.ts`
- Modify: `lib/downloads/store.ts`
- Modify: `lib/auth/password-reset.ts`
- Create: `tests/database-repositories.test.mjs`

**Interfaces:**
- Keeps current exported store function signatures unless a later task explicitly changes them.
- Produces: `registerEmailUserWithReferral`, `activatePaymentTransaction`, `consumePasswordReset`, and transactional download registration.

- [ ] **Step 1: Write failing concurrency and compatibility tests**

Assert that two normalized-email registrations yield one user, duplicate payment activation extends access once, two final download attempts against one remaining slot allow exactly one, and one reset token can be consumed exactly once.

```js
test("allows only one concurrent final download", async () => {
  const results = await Promise.allSettled([
    registerDownloadAttempt(input),
    registerDownloadAttempt(input),
  ]);
  assert.equal(results.filter((item) => item.value?.allowed).length, 1);
  assert.equal(getDownloadRecord(userId, archiveId).downloadCount, limit);
});
```

- [ ] **Step 2: Verify RED against JSON stores**

Run: `node --test tests/database-repositories.test.mjs`

Expected: FAIL on duplicate/lost-update assertions.

- [ ] **Step 3: Implement repositories and compatibility adapters**

Use prepared statements and `db.transaction(...).immediate()` for every read-modify-write invariant. Map rows back to existing `PublicUser`, payment, referral-dashboard, collection, and download-record shapes so pages keep their behavior.

- [ ] **Step 4: Make registration plus promo attribution atomic**

Replace the separate `createUserWithEmail` then `recordPromoRegistration` sequence with `registerEmailUserWithReferral`. Invalid/disabled promo codes and duplicate emails leave no partial user or referral.

- [ ] **Step 5: Make payment plus referral conversion atomic**

Provider payment ID uniqueness, access extension, payment status, and referral conversion commit together. A retry returns the existing result without adding days again.

- [ ] **Step 6: Verify repository and legacy domain tests**

Run: `node --test tests/database-repositories.test.mjs tests/payment-access-grant.test.mjs tests/referrals.test.mjs tests/subscription.test.mjs tests/download-usage.test.mjs`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add lib tests/database-repositories.test.mjs app/auth/actions.ts lib/payments/activate.ts
git commit -m "feat: move mutable stores to SQLite transactions"
```

### Task 4: Session Revocation and Password Hardening

**Files:**
- Modify: `lib/auth/session.ts`
- Modify: `lib/auth/store.ts`
- Modify: `lib/auth/password-reset.ts`
- Modify: `app/auth/actions.ts`
- Modify: `lib/email/send.ts`
- Modify: `.env.example`
- Create: `tests/session-security.test.mjs`
- Create: `tests/password-reset-security.test.mjs`

**Interfaces:**
- Produces: `getSessionSecret(environment, configuredSecret)`, signed payload `{ userId, sessionVersion, expiresAt }`, and atomic reset consumption.

- [ ] **Step 1: Write failing secret and revocation tests**

Assert production rejects missing/short secrets, development can use a clearly scoped fallback, a session becomes invalid after `sessionVersion` increments, and a valid current version resolves the user.

- [ ] **Step 2: Write failing reset/outbox tests**

Assert passwords shorter than 10 characters are rejected, simultaneous reset submissions produce one success, password reset increments session version, and SMTP failure in production does not create `mail-outbox.json`.

- [ ] **Step 3: Verify RED**

Run: `node --test tests/session-security.test.mjs tests/password-reset-security.test.mjs`

Expected: FAIL on known fallback, old session acceptance, six-character password, and production outbox behavior.

- [ ] **Step 4: Implement fail-closed secrets and versioned sessions**

Read `AUTH_SECRET` lazily but validate before signing/verifying. Fetch `sessionVersion` with the user and require an exact match. Login signs the current version; reset increments it in the same transaction that consumes the token.

- [ ] **Step 5: Implement password and outbox policy**

Require 10 characters for new registrations and resets. In production, propagate SMTP failure as an internal operation error after returning the generic reset UX; only development/test may append to the local outbox.

- [ ] **Step 6: Verify GREEN and auth regressions**

Run: `node --test tests/session-security.test.mjs tests/password-reset-security.test.mjs tests/auth-return-path.test.mjs`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/auth lib/email app/auth/actions.ts .env.example tests/session-security.test.mjs tests/password-reset-security.test.mjs
git commit -m "fix: harden sessions and password recovery"
```

### Task 5: Persistent Rate Limits

**Files:**
- Create: `lib/security/rate-limit.ts`
- Create: `lib/security/client-key.ts`
- Modify: `app/auth/actions.ts`
- Modify: `app/api/payments/yookassa/route.ts`
- Modify: `app/api/download/[number]/route.ts`
- Create: `tests/rate-limit.test.mjs`

**Interfaces:**
- Produces: `consumeRateLimit({ scope, subject, limit, windowMs, now? }): { allowed, remaining, retryAfterSeconds }`.

- [ ] **Step 1: Write failing boundary tests**

Test first request, exact limit, first rejection, independent scopes/subjects, expiry reset, and opportunistic removal of expired rows.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/rate-limit.test.mjs`

Expected: FAIL because limiter module is absent.

- [ ] **Step 3: Implement transactional fixed-window limiter**

Use one immediate transaction to read/reset/increment. Hash normalized email and network subjects with an application-derived HMAC before storing them so the limiter table does not become a plaintext identity log.

- [ ] **Step 4: Integrate all approved limits**

Apply the exact limits from the design to login, registration, reset request/submission, webhook, and download creation. HTTP routes return `429` with `Retry-After`; Server Actions redirect to generic localized rate-limit states.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/rate-limit.test.mjs tests/yookassa-webhook.test.mjs`

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/security app/auth/actions.ts app/api tests/rate-limit.test.mjs
git commit -m "feat: add persistent abuse rate limits"
```

### Task 6: Safe POST Download Flow

**Files:**
- Modify: `app/api/download/[number]/route.ts`
- Modify: `app/collections/page.tsx`
- Modify: `components/collections/CollectionDownloadAction.tsx`
- Create: `tests/download-route-security.test.mjs`
- Modify: `tests/collection-card-layout.test.mjs`

**Interfaces:**
- `POST /api/download/:number` performs authorization, S3 metadata validation, transactional counting, and redirect/JSON response.
- `GET /api/download/:number` returns `405` with `Allow: POST` and never mutates state.

- [ ] **Step 1: Write failing route-contract tests**

Assert GET cannot consume a download, POST can, metadata failure returns storage error before counting, exhausted limits return 429, and guest/FREE/CLUB/demo access rules remain unchanged.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/download-route-security.test.mjs`

Expected: FAIL because GET currently mutates and metadata failure continues.

- [ ] **Step 3: Implement POST-only mutation**

Move the handler body to POST, stop on failed metadata, and register the attempt only after metadata succeeds. Preserve HTML redirect and `format=json` response modes.

- [ ] **Step 4: Update collection controls**

Use a real form/button command for download creation. Preserve the current button styling, lock state, remaining-count display, and keyboard behavior.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/download-route-security.test.mjs tests/collection-card-layout.test.mjs tests/demo-access-state.test.mjs`

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/download app/collections tests/download-route-security.test.mjs tests/collection-card-layout.test.mjs
git commit -m "fix: make download accounting POST-only"
```

### Task 7: HTTP Headers, Metadata, and Mobile Legal Layout

**Files:**
- Modify: `next.config.ts`
- Modify: `app/layout.tsx`
- Modify: public and private `page.tsx` metadata exports or add nested `layout.tsx` files
- Modify: `app/globals.css`
- Create: `tests/security-headers.test.mjs`
- Create: `tests/page-metadata.test.mjs`
- Create: `tests/legal-mobile-layout.test.mjs`

**Interfaces:**
- Produces a single header policy helper/config, root metadata template, private-route `noindex`, and overflow-safe legal content.

- [ ] **Step 1: Write failing static contract tests**

Assert all approved headers exist, `poweredByHeader` is false, public pages have distinct titles, private/auth pages are `noindex`, and legal CSS contains wrapping without body-level clipping as the fix.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/security-headers.test.mjs tests/page-metadata.test.mjs tests/legal-mobile-layout.test.mjs`

Expected: FAIL because headers/metadata/wrapping are absent.

- [ ] **Step 3: Implement headers conservatively**

Add CSP for same-origin scripts/styles/images/fonts/connections and YooKassa navigation requirements. Add HSTS only in production, frame protection, nosniff, referrer policy, permissions policy, and disable framework fingerprinting.

- [ ] **Step 4: Implement metadata and indexing rules**

Add a `DJ Vault` title template and Russian description. Give collections, pricing, and legal pages descriptive titles; mark admin, account, checkout, login, registration, and reset flows `noindex, nofollow`.

- [ ] **Step 5: Fix legal overflow at 375px**

Apply `min-width: 0` and `overflow-wrap: anywhere` to legal headings, paragraphs, and requisites. Do not add global clipping.

- [ ] **Step 6: Verify GREEN**

Run: `node --test tests/security-headers.test.mjs tests/page-metadata.test.mjs tests/legal-mobile-layout.test.mjs`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add next.config.ts app tests/security-headers.test.mjs tests/page-metadata.test.mjs tests/legal-mobile-layout.test.mjs
git commit -m "fix: harden responses and page metadata"
```

### Task 8: Full Verification and Deployment Runbook

**Files:**
- Modify: `.env.example`
- Create: `docs/deployment/sqlite-migration.md`
- Modify tests only if verification exposes an actual uncovered regression; do not weaken assertions.

**Interfaces:**
- Produces exact backup, migration, verification, deployment, smoke-test, and rollback commands for `/var/www/dj-vault-v2` and PM2 process `dj-vault`.

- [ ] **Step 1: Document production environment requirements**

Require a persistent `DATA_DIRECTORY`, 32+ character `AUTH_SECRET`, existing YooKassa/S3/SMTP variables, and nginx proxy-header overwrite. Document `server_tokens off` and security-header ownership to avoid duplicate conflicting policies.

- [ ] **Step 2: Document backup and migration commands**

Include timestamped backup of `.data`, application stop, dependency install, build, explicit migration/verification, PM2 restart with `--update-env`, smoke checks, and previous-release rollback. Commands must be Linux-shell commands intended to run after SSH login, not pasted into local PowerShell as a quoted remote chain.

- [ ] **Step 3: Run complete automated verification**

Run:

```bash
node --test tests/*.test.mjs
npm run lint
npm run build
npm audit --omit=dev
git diff --check
```

Expected: all tests, lint, and build pass; no high/critical dependency vulnerabilities; diff check is clean. Any remaining moderate advisory is documented with package path and mitigation.

- [ ] **Step 4: Run local browser verification**

At 1440x900 and 375x812 verify guest, FREE, CLUB, and admin paths; download POST behavior; no console errors; one H1; nonempty titles; legal pages have `scrollWidth === clientWidth`; admin navigation remains operable.

- [ ] **Step 5: Inspect local production headers**

Use `curl -I` against the production-mode local server and assert every approved header, no `X-Powered-By`, correct robots metadata, and no caching of authenticated pages.

- [ ] **Step 6: Commit runbook and final verification adjustments**

```bash
git add .env.example docs/deployment tests
git commit -m "docs: add safe SQLite deployment runbook"
```

- [ ] **Step 7: Prepare deployment, but do not modify production until approved**

Push the verified commits, present the backup/migration commands, and obtain explicit deployment approval because migration changes the authoritative production data store.
