# Club Access and Admin Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace paid tiers with one Club access state, sell fixed day packages, add administrator access controls, preserve legacy data, and stack the admin collections editor above the list.

**Architecture:** Put access-state normalization and expiration arithmetic in a pure `lib/access/subscription.ts` domain module. Keep package definitions in `lib/content/plans.ts`, normalize legacy user records in `lib/auth/store.ts`, and let payments, referrals, pages, and admin actions consume those stable interfaces. Existing JSON files remain the persistence layer and legacy values stay readable.

**Tech Stack:** Next.js 16 App Router, React 19 server components/actions, TypeScript, JSON file stores, Node.js test runner, ESLint, CSS.

## Global Constraints

- Paid access has one public state: `club`; `start`, `pro`, and `premium` are legacy read-compatible values only.
- Packages remain 30 days / 1000 RUB, 90 days / 2700 RUB, and 180 days / 4800 RUB.
- Existing `planExpiresAt` values must never be shortened or reset during normalization.
- Referral conversion still occurs only after the first successful paid purchase.
- Admin day values must be whole numbers from 1 through 3650 when days are required or supplied.
- No recurring billing, arbitrary customer day selection, paid permission tiers, or reward payout workflow.
- Preserve the existing admin visual language; collections editor and list are full-width vertical sections.

---

### Task 1: Access Domain and Legacy User Normalization

**Files:**
- Create: `lib/access/subscription.ts`
- Create: `tests/subscription.test.mjs`
- Modify: `lib/auth/store.ts`

**Interfaces:**
- Produces: `AccessPlan = "free" | "club"`, `LegacyPaidPlan = "start" | "pro" | "premium"`, `normalizeAccessPlan(plan)`, `hasClubAccess(user, now?)`, `calculateExtendedExpiration(expiresAt, days, now?)`, and `calculateAdminAccessChange(input)`.
- Produces: `updateUserPlan(id: string, plan: AccessPlan, planExpiresAt?: string)` with legacy values normalized by `getPublicUser`, plus an idempotent persisted migration inside the user-store read boundary.

- [ ] **Step 1: Write failing pure-domain tests**

```js
test("normalizes every legacy paid tier to club", () => {
  for (const plan of ["start", "pro", "premium", "club"]) {
    assert.equal(normalizeAccessPlan(plan), "club");
  }
  assert.equal(normalizeAccessPlan("free"), "free");
});

test("extends active access from its expiration", () => {
  assert.equal(
    calculateExtendedExpiration("2026-08-01T00:00:00.000Z", 30, new Date("2026-07-12T00:00:00.000Z")),
    "2026-08-31T00:00:00.000Z",
  );
});

test("starts expired access from now", () => {
  assert.equal(
    calculateExtendedExpiration("2026-07-01T00:00:00.000Z", 30, new Date("2026-07-12T00:00:00.000Z")),
    "2026-08-11T00:00:00.000Z",
  );
});

test("requires days when free becomes club", () => {
  assert.throws(
    () => calculateAdminAccessChange({ currentPlan: "free", nextPlan: "club", days: 0 }),
    /ACCESS_DAYS_REQUIRED/,
  );
});

test("clears expiration when club becomes free", () => {
  assert.deepEqual(
    calculateAdminAccessChange({ currentPlan: "club", currentExpiresAt: "2026-08-01T00:00:00.000Z", nextPlan: "free", days: 0 }),
    { plan: "free", planExpiresAt: undefined },
  );
});

test("migrates legacy records without changing expiration dates", () => {
  assert.deepEqual(
    migrateLegacyAccessPlans([{ id: "u1", plan: "pro", planExpiresAt: "2026-09-01T00:00:00.000Z" }]),
    {
      changed: true,
      users: [{ id: "u1", plan: "club", planExpiresAt: "2026-09-01T00:00:00.000Z" }],
    },
  );
});
```

- [ ] **Step 2: Run the domain tests and verify RED**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/subscription.test.mjs`

Expected: FAIL because `lib/access/subscription.ts` does not exist.

- [ ] **Step 3: Implement the minimal access domain**

```ts
export type AccessPlan = "free" | "club";
export type LegacyPaidPlan = "start" | "pro" | "premium";
export type StoredAccessPlan = AccessPlan | LegacyPaidPlan;

export function normalizeAccessPlan(plan?: StoredAccessPlan | null): AccessPlan {
  return !plan || plan === "free" ? "free" : "club";
}

export function calculateExtendedExpiration(expiresAt: string | undefined, days: number, now = new Date()) {
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error("ACCESS_DAYS_INVALID");
  const parsed = expiresAt ? Date.parse(expiresAt) : 0;
  const base = Number.isFinite(parsed) && parsed > now.getTime() ? parsed : now.getTime();
  return new Date(base + days * 86_400_000).toISOString();
}
```

Add `hasClubAccess` and `calculateAdminAccessChange` using the exact rules in the design. Change `StoredUser.plan` to `StoredAccessPlan`, `PublicUser.plan` to `AccessPlan`, normalize in `getPublicUser`, and persist only `AccessPlan` through `updateUserPlan`. Add a pure `migrateLegacyAccessPlans` helper; after parsing `users.json`, write the migrated array only when its `changed` flag is true. The migration changes only `plan` from a legacy paid value to `club`, preserves `planExpiresAt` byte-for-byte, and is a no-op on subsequent reads.

- [ ] **Step 4: Run the tests and type-aware lint**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/subscription.test.mjs`

Expected: all subscription tests PASS.

Run: `npm.cmd run lint`

Expected: exit code 0.

- [ ] **Step 5: Commit the access domain**

```bash
git add lib/access/subscription.ts lib/auth/store.ts tests/subscription.test.mjs
git commit -m "Add unified club access domain"
```

---

### Task 2: Day Package Catalog and Payment Activation

**Files:**
- Modify: `lib/content/plans.ts`
- Modify: `lib/payments/store.ts`
- Modify: `lib/payments/activate.ts`
- Modify: `app/checkout/actions.ts`
- Create: `tests/access-packages.test.mjs`

**Interfaces:**
- Consumes: `AccessPlan`, `calculateExtendedExpiration`, and `updateUserPlan` from Task 1.
- Produces: `AccessPackageId = "days-30" | "days-90" | "days-180"`, `AccessPackage`, `accessPackageList`, `getAccessPackage(id)`, and `getLegacyPackage(id)`.
- Produces: payment records with `packageId`, `durationDays`, and amount; legacy `planId` remains optional and readable.

- [ ] **Step 1: Write failing package tests**

```js
test("offers the three approved day packages", () => {
  assert.deepEqual(
    accessPackageList.map(({ id, durationDays, amount }) => ({ id, durationDays, amount })),
    [
      { id: "days-30", durationDays: 30, amount: 1000 },
      { id: "days-90", durationDays: 90, amount: 2700 },
      { id: "days-180", durationDays: 180, amount: 4800 },
    ],
  );
});

test("maps legacy product ids without changing duration", () => {
  assert.equal(getAccessPackage("start")?.id, "days-30");
  assert.equal(getAccessPackage("pro")?.id, "days-90");
  assert.equal(getAccessPackage("premium")?.id, "days-180");
});
```

- [ ] **Step 2: Run package tests and verify RED**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/access-packages.test.mjs`

Expected: FAIL because `accessPackageList` and `getAccessPackage` are not exported.

- [ ] **Step 3: Replace tier metadata with package metadata**

```ts
export type AccessPackageId = "days-30" | "days-90" | "days-180";

export type AccessPackage = {
  id: AccessPackageId;
  durationDays: number;
  amount: number;
  price: string;
  oldPrice?: string;
  badge: string;
};

const legacyPackageIds = { start: "days-30", pro: "days-90", premium: "days-180" } as const;
```

Implement the approved catalog and make `getAccessPackage` accept both new and legacy ids. Remove `activationPlanId` from new payment creation, store package duration at purchase time, activate users as `club`, and use the stored duration for expiration arithmetic. Keep optional legacy fields in `StoredPayment` so existing JSON parses without migration.

- [ ] **Step 4: Update checkout creation metadata**

Use `packageId`, `durationDays`, and `userId` in local payment and YooKassa metadata. Set the provider description to `DJ Vault: доступ на N дней`. Never derive the user's access state from the selected product id.

- [ ] **Step 5: Run package, referral, and subscription tests**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/access-packages.test.mjs tests/subscription.test.mjs tests/referrals.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit package and payment changes**

```bash
git add lib/content/plans.ts lib/payments/store.ts lib/payments/activate.ts app/checkout/actions.ts tests/access-packages.test.mjs
git commit -m "Replace paid tiers with access packages"
```

---

### Task 3: Referral Purchase Details and Compatibility

**Files:**
- Modify: `lib/referrals/store.ts`
- Modify: `tests/referrals.test.mjs`

**Interfaces:**
- Consumes: `AccessPackageId` and `getAccessPackage` from Task 2.
- Produces: `recordPaidReferralConversion({ paymentId, packageId, durationDays, amount, userId })` and `formatReferralPurchase(referral)`.
- Keeps: optional legacy `convertedPlan` for old records.

- [ ] **Step 1: Add failing referral compatibility tests**

```js
test("formats a new referral conversion as purchased time and amount", () => {
  assert.equal(
    formatReferralPurchase({ convertedPackageId: "days-90", convertedDurationDays: 90, convertedAmount: 2700 }),
    "90 дней · 2700 ₽",
  );
});

test("formats legacy referral plans through package compatibility", () => {
  assert.equal(formatReferralPurchase({ convertedPlan: "premium" }), "180 дней · 4800 ₽");
});

test("recognizes club and legacy values as paid access", () => {
  for (const plan of ["club", "start", "pro", "premium"]) assert.equal(isPaidPlan(plan), true);
  assert.equal(isPaidPlan("free"), false);
});
```

- [ ] **Step 2: Run referral tests and verify RED**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/referrals.test.mjs`

Expected: FAIL because `formatReferralPurchase` and new conversion fields do not exist.

- [ ] **Step 3: Store and format purchase details**

Add `convertedPackageId?`, `convertedDurationDays?`, and `convertedAmount?` to `PromoReferral`. New conversions write these fields once; old `convertedPlan` remains untouched and is used only as a display fallback. Update payment activation to pass the purchased package details.

- [ ] **Step 4: Run referral and payment-domain tests**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/referrals.test.mjs tests/access-packages.test.mjs tests/subscription.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit referral compatibility**

```bash
git add lib/referrals/store.ts lib/payments/activate.ts tests/referrals.test.mjs
git commit -m "Track referral access package purchases"
```

---

### Task 4: Customer-Facing Club and Package Copy

**Files:**
- Modify: `app/pricing/page.tsx`
- Modify: `app/checkout/page.tsx`
- Modify: `app/account/page.tsx`
- Modify: `app/collections/page.tsx`
- Modify: `app/api/download/[number]/route.ts`

**Interfaces:**
- Consumes: `accessPackageList`, `getAccessPackage`, `hasClubAccess`, and normalized `PublicUser.plan`.
- Produces: no new cross-module interface.

- [ ] **Step 1: Replace tier-oriented rendering with package rendering**

Pricing cards use `30 дней`, `90 дней`, and `180 дней` as primary names; shared benefits appear identically on every card. Checkout reads `package` (and accepts legacy `plan` links temporarily), submits `packageId`, and says that purchased days are added to the current remainder.

- [ ] **Step 2: Update account and access gates**

Account labels show `FREE` or `CLUB`; paid access shows days remaining and expiration. Collections and download routes call `hasClubAccess(user)` so an expired Club record does not grant closed downloads.

- [ ] **Step 3: Run lint and production build**

Run: `npm.cmd run lint`

Expected: exit code 0.

Run: `npm.cmd run build`

Expected: Next.js production build exits with code 0.

- [ ] **Step 4: Commit customer-facing updates**

```bash
git add app/pricing/page.tsx app/checkout/page.tsx app/account/page.tsx app/collections/page.tsx app/api/download/[number]/route.ts
git commit -m "Present purchases as club access packages"
```

---

### Task 5: Administrator Access Management

**Files:**
- Modify: `app/admin/actions.ts`
- Modify: `app/admin/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/subscription.test.mjs`

**Interfaces:**
- Consumes: `calculateAdminAccessChange`, `findUserById`, and `updateUserPlan`.
- Produces: `updateUserAccessAction(formData: FormData)`.

- [ ] **Step 1: Add failing edge-case tests**

```js
test("rejects days on free without changing to club", () => {
  assert.throws(
    () => calculateAdminAccessChange({ currentPlan: "free", nextPlan: "free", days: 10 }),
    /ACCESS_DAYS_NOT_ALLOWED/,
  );
});

for (const days of [-1, 1.5, 3651]) {
  test(`rejects invalid admin days ${days}`, () => {
    assert.throws(
      () => calculateAdminAccessChange({ currentPlan: "club", nextPlan: "club", days }),
      /ACCESS_DAYS_INVALID/,
    );
  });
}
```

- [ ] **Step 2: Run subscription tests and verify RED**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/subscription.test.mjs`

Expected: at least one new validation test FAILS.

- [ ] **Step 3: Complete validation and implement the server action**

The action authenticates with `getCurrentUser` and `isAdminUser`, reads `userId`, `accessPlan`, and `days`, loads the target user, calculates the change, updates the user, revalidates `/admin`, `/account`, `/collections`, and redirects to `#users` with `access_updated` or a stable `access_error` code.

- [ ] **Step 4: Add the compact form to each user row**

Add Free/Club `<select>`, integer days input (`min=0`, `max=3650`, `step=1`), and Apply button. Show the normalized access state, expiration date, and days remaining. Map `required`, `invalid`, `not_allowed`, and `not_found` errors to concise Russian messages.

- [ ] **Step 5: Add restrained responsive styles**

Use existing borders, colors, type, and spacing. Keep the form within the user row at desktop widths and allow its fields to wrap without horizontal overflow on narrow screens. Do not add cards, gradients, shadows, or decorative labels.

- [ ] **Step 6: Run focused tests, lint, and build**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/subscription.test.mjs tests/access-packages.test.mjs tests/referrals.test.mjs tests/download-usage.test.mjs`

Expected: all tests PASS.

Run: `npm.cmd run lint`

Expected: exit code 0.

Run: `npm.cmd run build`

Expected: exit code 0.

- [ ] **Step 7: Commit admin access controls**

```bash
git add app/admin/actions.ts app/admin/page.tsx app/globals.css tests/subscription.test.mjs
git commit -m "Add admin club access controls"
```

---

### Task 6: Full-Width Collections Layout and End-to-End Verification

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: existing `saveCollectionAction` and collection list data.
- Produces: no new cross-module interface.

- [ ] **Step 1: Stack the collections blocks**

Change `.admin-collections-grid` to one column at all breakpoints. Keep the editor first and the list second. Let collection rows use the full list width while preserving their current content order.

- [ ] **Step 2: Start the development server**

Run: `npm.cmd run dev`

Expected: Next.js reports a local URL and remains running for browser checks.

- [ ] **Step 3: Verify desktop admin behavior**

At 1440x900, confirm the editor is full-width above the full-width list, user search still works, every user access form fits its row, and success/error anchors land at the users section.

- [ ] **Step 4: Verify mobile admin behavior**

At 390x844, confirm editor, collection list, user access controls, promo-code controls, and download controls have no overlap or horizontal page overflow. Confirm access form labels and buttons remain readable.

- [ ] **Step 5: Run final automated verification**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/*.test.mjs`

Expected: all tests PASS with zero failures.

Run: `npm.cmd run lint`

Expected: exit code 0.

Run: `npm.cmd run build`

Expected: exit code 0 and all application routes compile.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 6: Review the final diff and commit**

Verify that only scoped source, test, and plan files changed; leave `0001-Redesign-admin-dashboard.patch` and `CODEX_WORK_HANDOFF.md` untouched.

```bash
git add app/admin/page.tsx app/globals.css
git commit -m "Stack admin collections vertically"
```
