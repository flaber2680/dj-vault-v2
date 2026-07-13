# Collection Archive Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group paid collections by month with archive statistics and stable, access-aware card actions.

**Architecture:** Add a pure `collection-archive` helper that parses collection dates and track counts, then returns archive and monthly summaries. The collections server page consumes that structure while CSS owns card geometry and responsive alignment.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node test runner, CSS Grid/Flexbox.

## Global Constraints

- Demo is excluded from archive and monthly totals.
- Approximate track values display approximate totals.
- Guest and Free locked actions link to `/pricing`.
- Existing Club download and limit behavior must remain unchanged.
- No new runtime dependency.

---

### Task 1: Archive grouping and totals

**Files:**
- Create: `lib/content/collection-archive.ts`
- Create: `tests/collection-archive.test.mjs`

**Interfaces:**
- Produces: `buildCollectionArchive(collections)` returning `{ totalTracks, isApproximate, releaseCount, groups }`.
- Each group contains `key`, `label`, `totalTracks`, `isApproximate`, `releaseCount`, and `collections`.

- [ ] Write tests for numeric/Russian dates, month ordering, totals, and `150+` approximation.
- [ ] Run `node --test tests/collection-archive.test.mjs` and confirm missing-module failure.
- [ ] Implement the minimal parser and grouping helper.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Collections page structure

**Files:**
- Modify: `app/collections/page.tsx`

**Interfaces:**
- Consumes: `buildCollectionArchive(collections)` from Task 1.

- [ ] Render one archive summary and one full-width header per month.
- [ ] Render each group’s cards directly after its header.
- [ ] Replace paid-card top label with metadata only.
- [ ] Replace locked action copy with lock icon plus `Открыть доступ` and remove the explanatory line.
- [ ] Preserve Club download components and download messages.

### Task 3: Card and section layout

**Files:**
- Modify: `app/globals.css`

- [ ] Make release cards flex containers and let `.demo-card-copy` fill available height.
- [ ] Anchor `.demo-card-action` with `margin-top: auto` and stable spacing.
- [ ] Add full-width archive/month header styles consistent with the black-and-white editorial UI.
- [ ] Add responsive wrapping for summary metadata and locked buttons.

### Task 4: Verification

**Files:**
- Verify: `tests/*.test.mjs`
- Verify: `app/collections/page.tsx`
- Verify: `app/globals.css`

- [ ] Run `node --test tests/*.test.mjs` and expect zero failures.
- [ ] Run `npm.cmd run lint` and expect zero errors.
- [ ] Run `npm.cmd run build` and expect a successful production build.
- [ ] Use Playwright at desktop and mobile widths; confirm no horizontal overflow and bottom-aligned actions.
- [ ] Run `git diff --check` and review only intended files.
