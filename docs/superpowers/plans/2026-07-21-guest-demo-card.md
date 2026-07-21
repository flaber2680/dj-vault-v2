# Guest Demo Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render demo collection data in the home-page guest CTA card.

**Architecture:** Keep `LibraryBlocks` as the server component responsible for page data. Reuse `getDemoCollection()` from the content module and leave `getCollections()` for paid archive previews.

**Tech Stack:** Next.js 16, React 19, Node source-level tests.

## Global Constraints

- No visual or access-control changes.
- Write and observe a failing regression test before editing production code.

---

### Task 1: Bind the guest CTA card to the demo collection

**Files:**
- Modify: `components/sections/LibraryBlocks.tsx`
- Create: `tests/home-guest-demo-card.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
assert.match(source, /getDemoCollection/);
assert.match(source, /const demoCollection = await getDemoCollection\(\)/);
assert.match(source, /demoCollection\.date/);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/home-guest-demo-card.test.mjs`

- [ ] **Step 3: Implement the minimal production change**

```ts
import { getCollections, getDemoCollection } from "@/lib/content/collections";

const demoCollection = await getDemoCollection();
```

Replace guest-card references to `latestCollection` and `latestGenres` with the demo record and genres parsed from it.

- [ ] **Step 4: Run the regression test and production build**

Run: `node tests/home-guest-demo-card.test.mjs; npm run build`

- [ ] **Step 5: Commit**

```bash
git add components/sections/LibraryBlocks.tsx tests/home-guest-demo-card.test.mjs docs/superpowers
git commit -m "fix: show demo collection in guest CTA"
```
