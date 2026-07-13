# Admin Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long admin page with a sectioned operational workspace and URL-driven editing drawers.

**Architecture:** Keep the admin page server-rendered and derive the active section and drawer from validated query parameters. Extract focused presentation components while retaining existing server actions and data stores.

**Tech Stack:** Next.js 16 App Router, React 19 server components, TypeScript, CSS, Node test runner.

## Global Constraints

- Preserve existing authorization and business rules.
- Preserve the black-and-white DJ Vault visual language.
- `/admin` defaults to Collections.
- Drawers become full-screen on mobile.
- Do not modify the data model.

---

### Task 1: Admin View State

**Files:**
- Create: `lib/admin/view-state.ts`
- Test: `tests/admin-view-state.test.mjs`

**Interfaces:**
- Produces: `getAdminViewState(params, collections, users)` returning validated section and drawer selections.

- [ ] Write tests for default section, invalid parameters, collection selection, and user selection.
- [ ] Run `node --test tests/admin-view-state.test.mjs` and confirm missing-module failure.
- [ ] Implement the minimal parser and selectors.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Workspace Components

**Files:**
- Create: `app/admin/AdminNavigation.tsx`
- Create: `app/admin/AdminDrawer.tsx`
- Create: `app/admin/AdminCollections.tsx`
- Create: `app/admin/AdminUsers.tsx`
- Create: `app/admin/AdminPromoCodes.tsx`
- Create: `app/admin/AdminDownloads.tsx`
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: validated view state and existing collection, user, referral, and download data.
- Produces: the four section screens and reusable right drawer.

- [ ] Extract the sidebar and drawer shell.
- [ ] Build the compact collection list and collection editor drawer.
- [ ] Build the compact user table and user-management drawer.
- [ ] Build promo and download operational tables.
- [ ] Compose the active section in `page.tsx` and retain all status messages.

### Task 3: Mutation Navigation

**Files:**
- Modify: `app/admin/actions.ts`

**Interfaces:**
- Consumes: existing server actions and identifiers.
- Produces: redirects back to the relevant section and selected entity.

- [ ] Update collection redirects to Collections.
- [ ] Update access, promo-code, and reset redirects to Users with the affected user drawer open.
- [ ] Preserve revalidation behavior.

### Task 4: Operational Styling

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: fixed desktop rail, compact tables, right drawer, horizontal mobile navigation, and full-screen mobile drawers.

- [ ] Add workspace layout and active navigation styles.
- [ ] Add compact list, table, toolbar, and form styles.
- [ ] Add drawer overlay and responsive behavior.
- [ ] Remove dependency on the old long-page spacing for active admin UI.

### Task 5: Verification

**Files:**
- Modify only if verification exposes a defect.

- [ ] Run all tests with `node --test tests/*.test.mjs`.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run build`.
- [ ] Inspect desktop and mobile admin views in a browser.
- [ ] Confirm no horizontal overflow, clipped controls, overlapping text, or broken drawer navigation.
