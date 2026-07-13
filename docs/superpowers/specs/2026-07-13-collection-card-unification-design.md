# Unified Collection Cards

## Goal

Make demo and paid collection cards feel like one interface while keeping the demo card full width. Reduce duplicated archive information and make the latest-release list on the home page easier to scan.

## Collections Page

- Use the same content hierarchy for demo and paid cards: metadata, title, genre tags, optional description, action.
- Keep the demo card full width and title it `Демо-подборка`.
- Remove the separate `Бесплатный выпуск` label from the demo card.
- Restore compact bordered genre tags on every card and give them a pill shape with a fully rounded border radius.
- Keep card actions aligned at the lower left.
- Remove the standalone overall archive-statistics row.
- Keep track and release totals in each month header.

## Home Page Release List

- Keep the existing compact row layout.
- Remove the long genre text from each row.
- Show release number, date, track count, and file size.
- Add a restrained directional arrow at the right edge to clarify that the row opens the collection.
- Reduce vertical padding so the list scans quickly without duplicating collection cards.

## Responsive Behavior

- Genre pills wrap naturally without horizontal overflow.
- Demo remains full width at every breakpoint.
- Release rows stack their metadata cleanly on narrow screens while preserving a clear link target.

## Scope

This is a presentation-only change. Authentication, demo availability, subscription checks, download limits, collection grouping, and stored content remain unchanged.

## Verification

- Check guest and paid collection states on desktop and mobile.
- Confirm demo and paid cards share the same hierarchy and pill styling.
- Confirm the overall statistics row is absent and month totals remain.
- Confirm release rows have no genre dump or horizontal overflow.
- Run tests, lint, and production build.
