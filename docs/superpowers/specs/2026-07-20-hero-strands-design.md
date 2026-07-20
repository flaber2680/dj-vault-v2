# Hero Strands Design

## Goal

Add the React Bits `Strands` WebGL effect only to the first hero block of the home page. It should add motion and depth while preserving DJ Vault's restrained black-and-white visual language.

## Visual Direction

- Use thin, low-energy strands behind the hero content.
- Use a cold white and muted silver-blue palette, not the rainbow palette from the source example.
- Keep the effect dark and translucent enough that the label, headline, description, and buttons remain the visual focus.
- Do not enable the optional glass/refraction pass.

## Architecture

- Add `ogl` as the only new runtime dependency.
- Create a client-only `Strands` component under `components/effects`.
- Render it inside `components/sections/Hero.tsx` as a positioned background layer.
- Keep the existing hero content above the canvas and preserve all links and reveal behavior.
- Add scoped styles in `app/globals.css` for the effect layer and canvas sizing.

## Performance And Accessibility

- Cap device pixel ratio at 1.5 and use two strands with a low animation speed.
- Pause rendering when the hero is outside the viewport.
- Skip WebGL initialization when reduced motion is requested or the viewport is mobile-sized.
- Fail silently to the existing plain hero background if WebGL is unavailable.
- Release animation frames, listeners, canvas, and the WebGL context on unmount.

## Verification

- Add focused tests for the hero composition and motion fallback hooks.
- Run lint, TypeScript, production build, and the full test suite.
- Inspect local desktop and mobile screenshots to confirm the canvas is visible only in the hero, text is readable, and no horizontal overflow appears.
