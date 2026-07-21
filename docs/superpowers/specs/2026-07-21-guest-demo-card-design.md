# Guest Demo Card Design

## Goal

Show the real demo collection in the guest-only "Попробуйте DJ Vault бесплатно" section on the home page.

## Design

`LibraryBlocks` will load the demo collection through the existing `getDemoCollection()` content API. The guest card will use that record's date, size, number, and genres instead of `collections[0]`, which deliberately contains only paid collections.

## Scope

- Preserve the card layout and guest-only visibility.
- Do not change collection, access, or download rules.
- Add a source-level regression test that asserts the guest card is backed by `getDemoCollection()`.
