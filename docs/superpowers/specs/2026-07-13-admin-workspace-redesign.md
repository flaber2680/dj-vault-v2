# DJ Vault Admin Workspace Redesign

## Goal

Turn the existing long admin page into a compact operational workspace where each task has a dedicated screen and detailed editing happens in a right-side drawer.

## Information Architecture

- `/admin` opens Collections by default.
- The persistent navigation contains Collections, Users, Promo codes, and Downloads with record counts.
- Only the active section is rendered as the primary workspace.
- The URL stores the active section and drawer selection so navigation, refresh, and browser history remain predictable.

## Collections

- The main view is a compact searchable list of releases.
- `New collection` and each collection row open the editor drawer.
- The drawer contains the existing fields in a compact two-column form and becomes full-screen on mobile.
- Existing collection values are used as defaults when editing.

## Users

- The main view is a searchable table with identity, access, expiration, promo code summary, and download activity.
- Clicking a user opens a drawer with access controls, promo-code issuance, and per-archive download reset actions.
- Controls are removed from table rows to preserve scanability.

## Promo Codes

- Promo codes use a dense table-like list with owner, registrations, paid conversions, and conversion rate.
- Referral details remain visible beneath each code without decorative nested cards.

## Downloads

- Downloads remain a chronological operational log with archive, user, usage, and last activity.
- Search filters by archive number or user identity.

## Visual Direction

- Preserve the black-and-white DJ Vault identity.
- Use smaller operational headings, restrained borders, compact controls, and clear active navigation.
- Avoid marketing-scale spacing, oversized section titles, pills, and card-heavy composition.
- Desktop uses a fixed left rail and fluid content. Mobile uses a horizontal section bar and full-screen drawers.

## Behavior and Safety

- Existing admin authorization and server actions remain authoritative.
- Mutation redirects return to the relevant section and keep the affected drawer open where useful.
- No data model or business-rule changes are included.

## Verification

- Unit tests cover URL view-state normalization and collection selection.
- Existing domain tests remain green.
- ESLint and production build pass.
- Browser checks cover desktop and mobile layouts, drawer behavior, overflow, and readable controls.
