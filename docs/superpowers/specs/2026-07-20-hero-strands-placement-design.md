# Hero Strands Placement Design

## Goal

Move the existing home-page strands animation out of the full hero background and into a centered decorative strip above the "Закрытый клуб для DJ" label.

## Chosen Direction

- Render the existing `HeroStrands` component inside the hero content flow before the label.
- Give the strip a stable desktop frame: centered, 560px maximum width, and 112px height.
- Keep the two low-energy cold white and silver-blue strands unchanged.
- Remove the full-hero absolute background layer so no strand appears behind the description or buttons.
- Preserve the current mobile and reduced-motion plain fallback.

## Architecture

- `components/sections/Hero.tsx` moves the existing component from the section background into `.hero-content`.
- `app/globals.css` changes `.hero-strands` from absolute fill to a responsive block with explicit dimensions and spacing before `.hero-label`.
- `components/effects/HeroStrands.tsx` remains responsible only for WebGL lifecycle and performance safeguards.

## Verification

- Update the focused hero composition test to assert the new markup and dimensions.
- Run lint, TypeScript, production build, and the full serial test suite with the alias loader.
- Inspect desktop and mobile screenshots: desktop strands centered above the label; mobile without a canvas or overflow.
