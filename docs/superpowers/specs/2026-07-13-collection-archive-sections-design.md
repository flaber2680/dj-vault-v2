# Collection Archive Sections Design

## Goal

Make the paid collection archive easier to scan by grouping releases by month, showing useful track totals, and giving every card a stable bottom action area.

## Archive Structure

- The demo remains a separate featured block and is excluded from archive totals.
- A compact archive summary shows total tracks and total releases.
- Paid collections are grouped by month and year, newest group first.
- Each month header shows the month/year, track total, and release count.
- Exact numeric track counts are summed exactly. Values containing `+` make the corresponding total approximate and display with `≈`.
- Supported stored dates include numeric dates such as `25.06.26` and Russian text dates such as `25 июня 2026`.

## Collection Cards

- Remove `DJ Vault / Drop #...` from paid cards.
- Put track count, archive size, and date together in the top metadata row.
- Keep title, genres, and optional description in the content area.
- Anchor the action area to the bottom-left of cards with equal-height rows.
- Guest and Free users see a lock icon and `Открыть доступ`, linking to `/pricing`.
- Club users retain `Скачать подборку` and its download-limit hint.
- Remove `Доступно участникам клуба DJ Vault.` from locked cards.

## Responsive Behavior

- Month headers span the full archive width.
- Release cards remain 3 columns on wide screens, 2 on laptops, and 1 on mobile.
- Metadata wraps without overlapping and the bottom action remains attached to the card edge.

## Verification

- Unit-test date parsing, monthly grouping, exact/approximate totals, and Russian labels.
- Run all tests, ESLint, and production build.
- Verify guest and Club-shaped card layouts at desktop and mobile widths with Playwright.
