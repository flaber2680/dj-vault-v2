# Collection Card Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify demo and paid collection cards, restore pill genre tags, remove redundant global statistics, and simplify the home-page release list.

**Architecture:** Reuse the existing card markup and shared `demo-card-*` CSS primitives. Keep access and download branching unchanged; modify only presentation markup and responsive CSS.

**Tech Stack:** Next.js 16, React Server Components, TypeScript, CSS.

## Global Constraints

- Demo remains full width.
- Genre tags use fully rounded bordered pills.
- Month totals remain; standalone archive totals are removed.
- Home-page rows show number, date, track count, size, and a directional arrow without genres.
- No changes to authentication, payments, download limits, or stored collection data.

---

### Task 1: Unify Collection Cards

**Files:**
- Modify: `app/collections/page.tsx`
- Modify: `app/globals.css`

- [ ] Remove the standalone `collections-archive-summary` markup.
- [ ] Give demo and paid cards the same metadata, title, genre-pill, description, and action hierarchy.
- [ ] Title the full-width demo card `Демо-подборка` and remove its separate eyebrow.
- [ ] Remove the paid-only genre grid override and set shared genre tags to `border-radius: 999px`.
- [ ] Preserve responsive wrapping, lower-left actions, and all access-state branches.

### Task 2: Simplify Home Release Rows

**Files:**
- Modify: `components/sections/LibraryBlocks.tsx`
- Modify: `app/globals.css`

- [ ] Import and use `formatTrackCount` for release metadata.
- [ ] Replace genre text with track count and size.
- [ ] Add an accessible right-arrow affordance and compact the desktop/mobile row layout.

### Task 3: Verify End-to-End Presentation

**Files:**
- Verify: `app/collections/page.tsx`
- Verify: `components/sections/LibraryBlocks.tsx`
- Verify: `app/globals.css`

- [ ] Run `node --test tests\\*.test.mjs` and expect all tests to pass.
- [ ] Run `npm.cmd run lint` and expect exit code 0.
- [ ] Run `npm.cmd run build` and expect exit code 0.
- [ ] Inspect `/collections` and `/` at desktop and 390px mobile widths; confirm no overflow and no console errors.
- [ ] Run `git diff --check` and review the final scoped diff.
