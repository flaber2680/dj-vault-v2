# YooKassa Production Integration

## Goal

Enable live YooKassa card and SBP payments for DJ Vault while ensuring that one successful provider payment can extend access only once.

## Payment Flow

1. An authenticated user chooses an access package and payment method.
2. DJ Vault creates a local pending payment with a server-generated ID.
3. The server creates a YooKassa payment using Basic authentication, an idempotence key, automatic capture, redirect confirmation, and local identifiers in metadata.
4. YooKassa redirects the user to `/checkout/result`; independently, YooKassa sends status notifications to `/api/payments/yookassa`.
5. Both entry points retrieve the payment directly from YooKassa before processing it.
6. DJ Vault verifies the provider status, paid flag, amount, currency, and matching local payment.
7. A successful payment extends the user's club access and records the provider payment ID in the same user-file write. Reprocessing the same ID returns an already-activated result without extending access again.
8. The local payment is marked succeeded and a referral conversion is recorded idempotently.

## Self-Employed Receipts

The merchant is registered as self-employed. DJ Vault does not send a 54-FZ `receipt` object to YooKassa. Income and customer receipts are handled through the Russian `Мой налог` workflow outside this integration.

## Webhook

- Public URL: `https://djvault.ru/api/payments/yookassa`.
- Process only `payment.succeeded` and `payment.canceled` notifications.
- Ignore malformed or unrelated events with a successful no-op response.
- Never trust payment fields from the notification body; retrieve the full object from YooKassa by ID.
- Return HTTP 500 only when a valid supported notification cannot be processed, allowing YooKassa to retry.

## Configuration

- `YOOKASSA_SHOP_ID`: live shop identifier.
- `YOOKASSA_SECRET_KEY`: live secret key; it must be entered directly on the server and never committed or sent in chat.
- `NEXT_PUBLIC_APP_URL=https://djvault.ru`.
- YooKassa notifications subscribe to `payment.succeeded` and `payment.canceled`.

## Live Smoke Package

- A non-public package `smoke-100` grants one day for 100 RUB.
- It never appears in public pricing or package lists.
- Checkout accepts it only when `PAYMENT_SMOKE_TEST_ENABLED=true` and the authenticated user matches `ADMIN_EMAIL`.
- Payment activation always recognizes an already-created smoke payment even after the feature flag is disabled.
- Smoke payments do not create referral conversions.
- After the successful end-to-end check, disable the environment flag and restart the app.

## Data Compatibility

Add an optional `activatedPaymentIds` array to stored users. Existing user records remain valid and require no eager migration. Public user/session data does not expose this field.

## Verification

- Unit tests prove first activation, repeated activation, and concurrent duplicate activation behavior.
- Existing tests, lint, and production build pass.
- A test-mode payment verifies redirect, webhook, one-time day extension, and payment status.
- Live keys are enabled only after the test-mode flow succeeds.
