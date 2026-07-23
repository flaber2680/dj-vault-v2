# Promo Discounts Design

## Goal

Allow referral promo codes to grant a one-time checkout discount while keeping
payment amounts server-controlled and auditable.

## Rules

- Promo codes issued through the admin panel are configurable with a discount
  percent and an optional registration limit.
- A regular new promo code defaults to a 20% one-time discount with no
  registration limit.
- The `KIT` campaign is configured as a 50% one-time discount with a limit of
  16 registrations.
- The first 16 successful registrations with `KIT` receive discount
  eligibility. Later registrations using `KIT` are rejected and do not create
  an account or referral record.
- A referral without discount eligibility still belongs to the promo code for
  analytics, where the code has no registration limit.
- A discount applies to one successful payment only, regardless of package or
  payment method. Later purchases use the normal price.

## Data Model

`promo_codes` gains `discount_percent` and `discount_registration_limit`.
Existing codes migrate to a 20% unlimited discount.

`referrals` gains the assigned discount percent plus reservation and usage
fields. Discount eligibility is assigned atomically during registration, so a
registration cap cannot be exceeded by concurrent requests.

`activated_payments` records the original amount, discount percent, discounted
amount, and promo code used. This preserves historical payment facts even when
a promo code is later edited.

## Checkout And Payment Flow

1. The pricing and checkout pages resolve the logged-in user's unused promo
   eligibility on the server.
2. Eligible users see the original price, the discount, and the discounted
   total. Guests and users without eligibility see normal prices.
3. Checkout creates the local payment and reserves the discount in one database
   transaction. YooKassa receives only the discounted total.
4. A canceled or failed payment releases its reservation. A successful payment
   atomically grants access and marks the referral discount as used.
5. A duplicate successful payment cannot consume the same discount twice.

## Admin And Analytics

The promo-code form in the user drawer exposes a discount percentage and an
optional registration limit. The referral dashboard shows the purchased package,
original amount, discount, and actual paid amount.

## Scope Boundaries

- No coupon entry is added at checkout; promos are accepted only during
  registration.
- No discount applies to a user who is not registered through a promo code.
- Server-side calculation is authoritative; displayed prices are informational.
