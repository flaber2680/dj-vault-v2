# Collection Cards Redesign

## Goal

Make the collections catalog denser and easier to scan while turning the demo collection into a clear registration entry point for guests.

## Approved Direction

- Use a full-width featured demo block for guests and registered Free users.
- Use a compact three-column archive grid on wide desktop, two columns on laptops, and one column on mobile.
- Keep Club users focused on paid releases by hiding the demo block for them.

## Demo States

- Guest: show `Зарегистрироваться и скачать демо`, linking to registration with a safe return path to the demo block.
- Registered Free: show `Скачать демо` when the S3 object is configured.
- Club: do not render the demo block.
- Missing S3 object: only then show that the demo is not yet available.

## Registration Return

- Registration and login accept an internal `next` path.
- External, protocol-relative, malformed, and authentication-loop paths are rejected.
- Validation errors preserve the safe return path.
- Successful registration or login returns the user to `/collections#demo-download`.

## Regular Collection Cards

- Reduce card height and internal heading size.
- Show release number and date first, then genres, then track count and archive size.
- Keep the primary action at the bottom of every card.
- Preserve download limits, Club gating, and existing genre overflow details.

## Verification

- Unit tests cover safe return-path validation.
- Existing tests, lint, and production build pass.
- Browser checks cover guest desktop/mobile layouts and authenticated Free/Club states.
