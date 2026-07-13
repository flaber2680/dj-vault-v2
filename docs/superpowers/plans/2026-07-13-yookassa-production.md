# YooKassa Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable safe live YooKassa payments where each successful provider payment extends club access exactly once.

**Architecture:** Keep the existing redirect checkout and server-side provider verification. Add a pure access-grant function plus a serialized user-store mutation that writes the new expiration and activated payment ID atomically to `users.json`.

**Tech Stack:** Next.js 16, TypeScript, Node test runner, YooKassa HTTP API.

## Global Constraints

- Never commit or print YooKassa credentials.
- Do not send a 54-FZ receipt object for this self-employed merchant flow.
- Trust payment status and amount only after retrieving the payment from YooKassa.
- One provider payment ID can extend access only once.
- Preserve existing package durations, referral conversion behavior, and card/SBP checkout methods.

---

### Task 1: Idempotent Access Grant

**Files:**
- Create: `lib/payments/access-grant.ts`
- Create: `tests/payment-access-grant.test.mjs`
- Modify: `lib/auth/store.ts`

- [ ] Add failing tests for first activation, duplicate activation, and extending an active subscription.
- [ ] Implement `applyPaymentAccessGrant(record, paymentId, durationDays, now)` as a pure immutable transformation.
- [ ] Add optional `activatedPaymentIds` to stored users without exposing it through `PublicUser`.
- [ ] Add a serialized `applyPaidPaymentAccess` user-store mutation that writes expiration and payment ID together.
- [ ] Run the focused test file and confirm it passes.

### Task 2: Payment Activation and Webhook

**Files:**
- Modify: `lib/payments/activate.ts`
- Modify: `app/api/payments/yookassa/route.ts`
- Create: `tests/yookassa-webhook.test.mjs`

- [ ] Replace the separate user lookup/update with `applyPaidPaymentAccess`.
- [ ] Preserve amount, currency, package, and user validation.
- [ ] Treat a repeated access grant as already activated while still repairing a pending local payment status.
- [ ] Filter webhook events to `payment.succeeded` and `payment.canceled` before provider lookup.
- [ ] Add focused event-filter tests.

### Task 3: Configuration and Production Verification

**Files:**
- Modify: `.env.example`

- [ ] Document the webhook URL and supported events without adding secrets.
- [ ] Run `node --test tests\\*.test.mjs`.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `git diff --check` and review the scoped diff.
- [ ] Configure test credentials directly on the server, subscribe the webhook, and complete a test payment before replacing them with live credentials.

### Task 4: Admin-Only Live Smoke Payment

**Files:**
- Create: `lib/payments/packages.ts`
- Create: `tests/payment-packages.test.mjs`
- Modify: `lib/payments/store.ts`
- Modify: `lib/payments/activate.ts`
- Modify: `app/checkout/page.tsx`
- Modify: `app/checkout/actions.ts`
- Modify: `.env.example`

- [x] Add tests proving the public package list stays unchanged and the smoke package is gated by both admin identity and environment flag.
- [x] Define `smoke-100` as one day for 100 RUB outside the public package list.
- [x] Use the gated resolver in both checkout rendering and checkout submission.
- [x] Let activation resolve an existing smoke payment even after the flag is disabled.
- [x] Skip referral conversion for smoke payments.
- [ ] Enable the flag only for the live smoke test, then disable it and restart the app.
