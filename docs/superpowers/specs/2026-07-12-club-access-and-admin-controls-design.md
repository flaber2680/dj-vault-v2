# DJ Vault Club Access and Admin Controls

## Goal

Replace the misleading Start, Pro, and Premium access tiers with one paid Club access level. Customers buy time packages, while administrators can grant or extend access manually. Reflow the collections area in the admin page into a single vertical layout.

## Product Model

Users have one of two access states:

- `free`: no access to closed collections and no expiration date.
- `club`: access to all paid content until `planExpiresAt`.

The store sells three time packages with the existing prices:

- 30 days for 1000 RUB.
- 90 days for 2700 RUB.
- 180 days for 4800 RUB.

All packages unlock exactly the same content. A package bought during an active subscription extends the existing expiration date. If access has expired, the package starts from the payment activation time.

## Compatibility and Migration

Existing `start`, `pro`, and `premium` user values are legacy paid states. Reads normalize them to Club without changing `planExpiresAt`. A persisted-data migration updates legacy users to `club`; it must be idempotent and preserve expiration dates.

Payment records retain the selected package identifier and duration so historical purchases and referral conversions can identify what was bought. Legacy payment and referral records remain readable. No paid expiration date may be shortened or reset during migration.

## Payment Flow

Pricing and checkout present packages by duration rather than tier names. On successful payment:

1. Resolve the purchased package.
2. Use the later of the current expiration date and activation time as the extension base.
3. Add the package duration.
4. Store the user as `club` with the new expiration date.
5. Record the purchased duration and amount for referral reporting.

Access checks use the Club state and a non-expired `planExpiresAt`. Legacy paid states are treated as Club until migrated.

## Admin Controls

Each user row contains one compact access form with:

- access selector: Free or Club;
- integer field for days to add;
- apply button;
- current expiration date and calculated days remaining.

Rules:

- Free to Club requires a positive number of days and starts from the action time.
- Active Club plus positive days extends the current expiration date.
- Expired Club plus positive days starts from the action time.
- Club to Club with zero or blank days leaves the expiration unchanged.
- Any user changed to Free has `planExpiresAt` cleared.
- Free to Free ignores a blank days field and keeps the user Free.
- Negative, fractional, non-numeric, and excessively large values are rejected.

The action requires the existing administrator authorization check, revalidates account and admin pages, and redirects to a clear success or error message near the users section.

## Referral Reporting

A referral still converts only after the referred user completes a successful paid purchase. New conversion records show the purchased package as duration and amount, for example `90 days / 2700 RUB`. Legacy conversion values remain displayable through compatibility labels.

## Admin Collections Layout

The collections section uses a vertical flow at every viewport size:

1. The collection editor occupies the full available width.
2. The complete collections list appears below it at full width.

The existing visual language, controls, spacing scale, and responsive behavior remain unchanged apart from the layout. The list must not split beside the editor on wide screens and must not introduce horizontal overflow on mobile.

## Validation and Errors

Domain helpers validate access changes independently of the server action. Invalid operations return stable error codes that the admin page maps to Russian messages. The user store update is atomic at the current JSON-file abstraction level and never changes unrelated user fields.

## Testing

Automated tests cover:

- legacy paid-state normalization;
- extension from an active expiration date;
- extension from now for expired access;
- Free to Club validation;
- clearing the expiration when changing to Free;
- invalid day values;
- payment package lookup and duration;
- referral labels for new packages and legacy records.

Verification includes the targeted tests, the complete test suite, lint, production build, and browser checks of the admin users and collections sections at desktop and mobile widths.

## Out of Scope

- Recurring billing or automatic renewal.
- Arbitrary customer-selected day counts.
- Multiple paid permission levels.
- Administrator reward payouts for promo-code owners.
