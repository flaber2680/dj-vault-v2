# Mobile Safari Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the DJ Vault home page responsive and fully visible on iPhone Safari by removing non-essential mobile animation work.

**Architecture:** Desktop effects remain unchanged. `FallingCube` and `ScrollEffects` detect a narrow or touch-first viewport before creating scroll work, while global CSS ensures initial server markup cannot hide content or paint costly layers on mobile.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS media queries, Node built-in test runner.

## Global Constraints

- Mobile guard: `(hover: none)` or `(pointer: coarse)`.
- Preserve desktop cube, reveal transitions, and header treatment.
- Do not add client-side dependencies.
- Keep the login link as a normal Next.js `Link` to `/login`.

**Implementation adjustment:** Review found that a 900px width guard would alter ordinary narrow desktop layouts. The implemented guard uses touch capabilities instead, and the server omits cube markup for Apple mobile user agents to avoid the image preload.

---

### Task 1: Lock in static mobile presentation

**Files:**
- Create: `tests/mobile-safari-stability.test.mjs`
- Modify: `components/ScrollEffects.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: existing `[data-reveal]` markup and `body` state classes.
- Produces: visible, unblurred mobile content without a mobile scroll listener for header state.

- [ ] **Step 1: Write the failing test**

```js
assert.match(scrollEffects, /\(max-width: 900px\)/);
assert.match(styles, /@media \(hover: none\), \(pointer: coarse\), \(max-width: 900px\)/);
assert.match(styles, /body\.is-scrolled \.header \{[^}]*?backdrop-filter: none;/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mobile-safari-stability.test.mjs`

Expected: FAIL because the current mobile rule ends at 768px and the effect does not check a 900px viewport.

- [ ] **Step 3: Write minimal implementation**

```ts
const usesStaticMobilePresentation =
  window.matchMedia("(max-width: 900px)").matches ||
  window.matchMedia("(hover: none)").matches ||
  window.matchMedia("(pointer: coarse)").matches;

if (prefersReducedMotion || usesStaticMobilePresentation) {
  return () => { /* clean up body classes and reveal classes */ };
}
```

```css
@media (hover: none), (pointer: coarse), (max-width: 900px) {
  body.is-scrolled .header { background: #000; box-shadow: none; backdrop-filter: none; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/mobile-safari-stability.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/mobile-safari-stability.test.mjs components/ScrollEffects.tsx app/globals.css
git commit -m "fix: keep mobile content visible"
```

### Task 2: Remove mobile cube scroll work

**Files:**
- Modify: `tests/mobile-safari-stability.test.mjs`
- Modify: `components/sections/FallingCube.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: existing `FallingCube` class names and desktop animation.
- Produces: no cube layout reads, animation frames, or painted cube at the mobile guard.

- [ ] **Step 1: Extend the failing test**

```js
assert.match(fallingCube, /const shouldDisableEffects =/);
assert.match(fallingCube, /if \(shouldDisableEffects\) \{\s*return;\s*\}/);
assert.match(styles, /\.falling-cube \{\s*display: none;/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/mobile-safari-stability.test.mjs`

Expected: FAIL because `FallingCube` currently attaches `scroll` and `resize` handlers for every device.

- [ ] **Step 3: Write minimal implementation**

```ts
const shouldDisableEffects =
  window.matchMedia("(max-width: 900px)").matches ||
  window.matchMedia("(hover: none)").matches ||
  window.matchMedia("(pointer: coarse)").matches ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (shouldDisableEffects) {
  return;
}
```

```css
@media (hover: none), (pointer: coarse), (max-width: 900px) {
  .falling-cube { display: none; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/mobile-safari-stability.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/mobile-safari-stability.test.mjs components/sections/FallingCube.tsx app/globals.css
git commit -m "fix: disable cube animation on mobile"
```

### Task 3: Verify the production build and mobile flow

**Files:** Verify only.

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: build and regression evidence before deployment.

- [ ] **Step 1: Run focused regression test**

Run: `node --test tests/mobile-safari-stability.test.mjs`

Expected: PASS.

- [ ] **Step 2: Run complete test suite**

Run: `node --test tests/*.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: exit code 0 and a completed Next.js production build.

- [ ] **Step 4: Check narrow mobile navigation**

Start local development, open the home page at 390px width, scroll, and activate `Войти`.

Expected: content stays visible during scroll and navigation reaches `/login`.
