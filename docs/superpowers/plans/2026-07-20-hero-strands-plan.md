# Hero Strands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a restrained animated WebGL strands layer behind the home-page hero while retaining a fully usable plain hero fallback.

**Architecture:** Keep browser and WebGL concerns inside a new client component. A small pure configuration module determines whether animation is allowed, while `Hero.tsx` only composes the visual background and keeps its current server-rendered content above it.

**Tech Stack:** Next.js 16, React 19, TypeScript, OGL, Node test runner, Playwright.

## Global Constraints

- Add `ogl` as the only new runtime dependency.
- Render the effect only in the first home-page hero.
- Use two thin, low-speed cold white/silver-blue strands, capped at DPR 1.5.
- Do not enable glass or refraction rendering.
- Skip initialization for reduced motion, mobile viewports, and missing WebGL2 support.
- Pause when the hero is outside the viewport and release animation, observers, canvas, and context on unmount.
- Preserve existing hero links, reveal attributes, and readable foreground contrast.

---

### Task 1: Motion eligibility configuration

**Files:**
- Create: `components/effects/hero-strands-config.ts`
- Create: `tests/hero-strands-config.test.mjs`

**Interfaces:**
- Produces: `HERO_STRANDS`, `isHeroStrandsEnabled(input)`.
- Consumes: `HeroStrandsEnvironment` with `viewportWidth`, `prefersReducedMotion`, and `supportsWebgl2` booleans.

- [ ] **Step 1: Write the failing test**

```js
import { HERO_STRANDS, isHeroStrandsEnabled } from "../components/effects/hero-strands-config.ts";

assert.equal(isHeroStrandsEnabled({ viewportWidth: 1280, prefersReducedMotion: false, supportsWebgl2: true }), true);
assert.equal(isHeroStrandsEnabled({ viewportWidth: 600, prefersReducedMotion: false, supportsWebgl2: true }), false);
assert.equal(isHeroStrandsEnabled({ viewportWidth: 1280, prefersReducedMotion: true, supportsWebgl2: true }), false);
assert.equal(HERO_STRANDS.colors.length, 2);
assert.equal(HERO_STRANDS.dpr, 1.5);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-transform-types --test tests/hero-strands-config.test.mjs`

Expected: FAIL because the configuration module does not exist.

- [ ] **Step 3: Write the minimal configuration module**

```ts
export const HERO_STRANDS = {
  colors: ["#F5F7FA", "#9FB7C8"],
  dpr: 1.5,
  strandCount: 2,
  speed: 0.24,
  mobileBreakpoint: 900,
} as const;

export function isHeroStrandsEnabled(input: HeroStrandsEnvironment) {
  return input.viewportWidth > HERO_STRANDS.mobileBreakpoint
    && !input.prefersReducedMotion
    && input.supportsWebgl2;
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --experimental-transform-types --test tests/hero-strands-config.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/effects/hero-strands-config.ts tests/hero-strands-config.test.mjs
git commit -m "test: cover hero strands eligibility"
```

### Task 2: Client-only WebGL strands layer

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `components/effects/HeroStrands.tsx`
- Create: `tests/hero-strands-component.test.mjs`

**Interfaces:**
- Consumes: `HERO_STRANDS` and `isHeroStrandsEnabled` from `components/effects/hero-strands-config.ts`.
- Produces: `HeroStrands`, a client component rendering a decorative canvas inside `.hero-strands`.

- [ ] **Step 1: Write the failing composition test**

```js
const source = await readFile(new URL("../components/effects/HeroStrands.tsx", import.meta.url), "utf8");
assert.match(source, /"use client"/);
assert.match(source, /IntersectionObserver/);
assert.match(source, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
assert.match(source, /cancelAnimationFrame/);
assert.match(source, /WEBGL_lose_context/);
assert.match(source, /aria-hidden="true"/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/hero-strands-component.test.mjs`

Expected: FAIL because the client component does not exist.

- [ ] **Step 3: Install OGL and implement the layer**

```bash
npm install ogl
```

Implement `HeroStrands.tsx` with OGL `Renderer`, `Program`, `Mesh`, `Triangle`, and `Color`. Check WebGL2 support before creating the renderer, use the two configured colors, start an animation loop only while observed, and clean up every browser resource in the effect cleanup.

- [ ] **Step 4: Run focused tests to verify them passing**

Run: `node --experimental-transform-types --test tests/hero-strands-config.test.mjs && node --test tests/hero-strands-component.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json components/effects/HeroStrands.tsx tests/hero-strands-component.test.mjs
git commit -m "feat: add restrained hero strands effect"
```

### Task 3: Compose and style the hero background

**Files:**
- Modify: `components/sections/Hero.tsx`
- Modify: `app/globals.css`
- Create: `tests/hero-strands-composition.test.mjs`

**Interfaces:**
- Consumes: `HeroStrands` from `components/effects/HeroStrands.tsx`.
- Produces: a `.hero` that contains the effect and a foreground `.hero-container` above it.

- [ ] **Step 1: Write the failing composition and style test**

```js
assert.match(heroSource, /import \{ HeroStrands \} from "@\/components\/effects\/HeroStrands"/);
assert.match(heroSource, /<section className="hero">[\s\S]*?<HeroStrands \/>[\s\S]*?<div className="hero-container">/);
assert.match(css, /\.hero-strands \{[\s\S]*?position: absolute;[\s\S]*?pointer-events: none;/);
assert.match(css, /\.hero-container \{[\s\S]*?position: relative;[\s\S]*?z-index: 1;/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/hero-strands-composition.test.mjs`

Expected: FAIL because the hero has no strands layer or foreground stacking rule.

- [ ] **Step 3: Compose and style the background**

```tsx
<section className="hero">
  <HeroStrands />
  <div className="hero-container">...</div>
</section>
```

```css
.hero-strands { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.hero-container { position: relative; z-index: 1; }
```

Hide the layer in mobile and reduced-motion media queries while retaining the current black hero background.

- [ ] **Step 4: Run the focused composition test**

Run: `node --test tests/hero-strands-composition.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/sections/Hero.tsx app/globals.css tests/hero-strands-composition.test.mjs
git commit -m "feat: layer strands behind home hero"
```

### Task 4: Verify behavior and visual boundaries

**Files:**
- Verify: `app/page.tsx`
- Verify: `components/sections/Hero.tsx`
- Verify: `components/effects/HeroStrands.tsx`
- Verify: `app/globals.css`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a production-ready home hero with a plain fallback in unsupported contexts.

- [ ] **Step 1: Run static verification**

```bash
npm run lint
npx tsc --noEmit
npm run build
node --import ./tests/register-alias-loader.mjs --experimental-transform-types --test --test-concurrency=1 tests/*.test.mjs
```

Expected: each command exits with status 0.

- [ ] **Step 2: Run the local site and take desktop and mobile screenshots**

```bash
npm run dev -- --port 3002
```

Capture `http://localhost:3002/` at 1440x900 and 390x844. Confirm the desktop strands are visible only behind the hero and no canvas appears on mobile.

- [ ] **Step 3: Verify interaction and overflow**

Use the home-page registration and collections links in the desktop browser session. Assert `document.documentElement.scrollWidth <= window.innerWidth` at desktop and mobile widths.

- [ ] **Step 4: Commit verification-ready changes if any inspection adjustment was needed**

```bash
git add app/globals.css components/effects/HeroStrands.tsx
git commit -m "fix: tune hero strands presentation"
```

## Self-Review

- Spec coverage: Tasks 1-3 implement every architecture, visual, performance, and accessibility constraint. Task 4 covers requested automated and visual verification.
- Placeholder scan: no TODO/TBD items are present; each task names concrete files, checks, and commands.
- Type consistency: `HeroStrandsEnvironment`, `HERO_STRANDS`, `isHeroStrandsEnabled`, and `HeroStrands` are defined before consumers use them.
