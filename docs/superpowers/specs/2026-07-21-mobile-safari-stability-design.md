# Mobile Safari stability

## Goal

Make the site responsive and reliable on iPhone Safari without changing the desktop visual direction.

## Decision

At a viewport width of 900px or below, and for coarse-pointer devices, the site uses a static presentation:

- the falling cube is not painted and does not attach scroll or resize work;
- reveal animations never put content in a hidden or blurred state;
- the header does not use its scroll-driven translucent blur treatment.

Desktop retains the existing cube and reveal effects.

## Rationale

The current hero cube is a fixed, large image that measures layout and writes transform properties in an animation frame on every scroll. Together with reveal blur effects and a backdrop-filter header, this is expensive and can be unstable in mobile Safari. The mobile experience does not depend on these decorative effects, so the safest solution is to remove their runtime cost there.

## Behaviour

- A visitor on an iPhone can load, scroll, and use navigation without content being hidden by reveal state.
- The login link remains a normal link to `/login`; no interaction logic is added to it.
- Users with reduced motion receive the same safe static behaviour.

## Verification

- Add source-level regression tests covering the mobile guards for the cube, reveal effects, and header blur.
- Run the focused regression test suite, the full test suite, and a production build.
- Exercise the home page and `/login` in a narrow mobile viewport.
