# Hero Strands Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place the home hero strands in a centered decorative strip directly above the hero label.

**Architecture:** Keep `HeroStrands` responsible for its existing WebGL lifecycle. Change only the hero composition and scoped CSS so the component becomes an in-flow, fixed-format visual element rather than an absolute full-hero background.

**Tech Stack:** Next.js, React, TypeScript, OGL, Node test runner, Playwright.

## Global Constraints

- Preserve the current two cold white/silver-blue strands and all WebGL safeguards.
- Use a centered 560px maximum-width, 112px-height desktop strip above the label.
- Do not display a canvas on mobile or with reduced motion.
- Preserve all existing hero copy, links, and reveal behavior.

---

### Task 1: Lock the new hero structure with a failing test

**Files:**
- Modify: `tests/hero-strands-composition.test.mjs`
- Modify: `components/sections/Hero.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `HeroStrands` from `components/effects/HeroStrands.tsx`.
- Produces: an in-flow `.hero-strands` immediately before `.hero-label`.

- [ ] **Step 1: Write the failing test**

```js
assert.match(heroSource, /<div className="hero-content">[\s\S]*?<HeroStrands \/>[\s\S]*?<div[\s\S]*?className="hero-label"/);
assert.match(styles, /\.hero-strands \{[\s\S]*?width: min\(560px, 100%\);[\s\S]*?height: 112px;[\s\S]*?margin: 0 auto 24px;/);
assert.doesNotMatch(styles, /\.hero-strands \{[\s\S]*?position: absolute;/);
```

- [ ] **Step 2: Run it to verify the expected failure**

Run: `node --test tests/hero-strands-composition.test.mjs`

Expected: FAIL because `HeroStrands` is currently a full-section absolute layer.

- [ ] **Step 3: Move the component and change only scoped styles**

```tsx
<div className="hero-content">
  <HeroStrands />
  <div className="hero-label">...</div>
</div>
```

```css
.hero-strands {
  width: min(560px, 100%);
  height: 112px;
  margin: 0 auto 24px;
}
```

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/hero-strands-composition.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/sections/Hero.tsx app/globals.css tests/hero-strands-composition.test.mjs
git commit -m "feat: center hero strands above label"
```

### Task 2: Verify the new visual hierarchy

**Files:**
- Verify: `components/sections/Hero.tsx`
- Verify: `app/globals.css`
- Verify: `components/effects/HeroStrands.tsx`

**Interfaces:**
- Consumes: the updated in-flow strands placement.
- Produces: desktop centered strip and unchanged mobile fallback.

- [ ] **Step 1: Run project verification**

```bash
npm run lint
npx tsc --noEmit
npm run build
node --import ./tests/register-alias-loader.mjs --experimental-transform-types --test --test-concurrency=1 tests/*.test.mjs
```

Expected: every command exits with code 0.

- [ ] **Step 2: Inspect the local page**

```bash
npm run dev -- --port 3002
```

Capture the home page at 1440x900 and 390x844. Desktop must show the strands centered above the label; mobile must show no canvas and no horizontal overflow.

## Self-Review

- Spec coverage: the plan moves the effect, creates a stable centered frame, and retains all fallbacks.
- Placeholder scan: every step names exact source files, assertions, and commands.
- Type consistency: no public component API changes are required.
