# Promo Discounts Implementation Plan

**Goal:** Add one-time referral discounts: configurable admin codes default to 20%, and `KIT` gives 50% to the first 16 registrations only.

**Approach:** Store discount terms on the promo code and snapshot them on each referral at registration. Reserve an unused referral discount atomically when a checkout payment is created, consume it only after a verified YooKassa success, and release the reservation for canceled or failed payments. Server-side payment amounts remain authoritative.

## Steps

1. Add a SQLite migration for promo terms, referral discount state, and original payment amount; extend referral registration so capped codes reject later registrations atomically.
2. Extend payment creation and activation so discounts are calculated, reserved, released, and consumed in database transactions.
3. Show eligible discounted prices for signed-in users on home, pricing, and checkout; retain standard prices for guests and the smoke payment.
4. Let admins set a promo discount and optional registration cap; show discount terms and discounted conversions in the referral dashboard.
5. Add focused repository and UI tests, run the suite and production build, then commit the implementation.
