import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rateLimitedCopy =
  "Слишком много попыток. Подождите немного и попробуйте снова.";

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("auth pages expose the same identity-neutral localized rate-limited state", async () => {
  const pages = await Promise.all(
    [
      "app/login/page.tsx",
      "app/register/page.tsx",
      "app/forgot-password/page.tsx",
      "app/reset-password/page.tsx",
    ].map(source),
  );

  for (const page of pages) {
    assert.match(page, /rate_limited:/);
    assert.equal(page.includes(rateLimitedCopy), true);
  }

  assert.match(pages[2], /error\?: string/);
  assert.match(pages[2], /className="auth-error"/);
});

test("throttled auth actions redirect only to the dedicated rate-limited state", async () => {
  const actions = await source("app/auth/actions.ts");

  assert.match(
    actions,
    /redirectWithError\("\/register", "rate_limited", returnTo\)/,
  );
  assert.match(
    actions,
    /redirectWithError\("\/login", "rate_limited", returnTo\)/,
  );
  assert.match(actions, /redirect\("\/forgot-password\?error=rate_limited"\)/);
  assert.match(actions, /redirectToPasswordReset\("rate_limited", token\)/);
});
