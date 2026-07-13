# Collection Cards Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved featured-demo and compact-archive catalog with a safe post-registration return flow.

**Architecture:** Keep access decisions server-rendered in the collections page. Add a small pure redirect validator shared by registration and login, then reshape the existing collection markup and CSS without changing storage or download authorization.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS, Node test runner.

## Global Constraints

- Demo download remains available only to authenticated users.
- Club access and download limits remain unchanged.
- Guests return only to validated internal paths.
- Desktop supports three archive columns; mobile uses one.

---

### Task 1: Safe Authentication Return Path

**Files:**
- Create: `lib/auth/return-path.ts`
- Test: `tests/auth-return-path.test.mjs`
- Modify: `app/auth/actions.ts`
- Modify: `app/register/page.tsx`
- Modify: `app/login/page.tsx`
- Modify: `components/auth/AuthCard.tsx`

- [ ] Test accepted and rejected return paths.
- [ ] Implement the return-path validator.
- [ ] Preserve `next` through auth forms and validation errors.
- [ ] Redirect successful authentication to the validated path.

### Task 2: Featured Demo State

**Files:**
- Modify: `app/collections/page.tsx`

- [ ] Render registration CTA for guests.
- [ ] Render the existing download action for registered Free users.
- [ ] Keep missing-S3 and Club behavior explicit.

### Task 3: Compact Archive Grid

**Files:**
- Modify: `app/collections/page.tsx`
- Modify: `app/globals.css`

- [ ] Add featured-demo semantics and supporting copy.
- [ ] Reorder archive-card information by priority.
- [ ] Add three/two/one-column responsive rules.
- [ ] Keep controls aligned at the bottom without fixed empty height.

### Task 4: Verification

**Files:**
- Modify only if verification exposes a defect.

- [ ] Run all Node tests.
- [ ] Run ESLint and production build.
- [ ] Verify guest desktop and mobile screenshots.
- [ ] Verify Free and Club rendering and horizontal overflow.
