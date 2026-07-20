import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicPages = [
  "../app/page.tsx",
  "../app/collections/page.tsx",
  "../app/pricing/page.tsx",
  "../app/offer/page.tsx",
  "../app/privacy/page.tsx",
  "../app/refund/page.tsx",
  "../app/rights/page.tsx",
  "../app/terms/page.tsx",
];

const privatePages = [
  "../app/admin/page.tsx",
  "../app/account/page.tsx",
  "../app/checkout/page.tsx",
  "../app/checkout/result/page.tsx",
  "../app/login/page.tsx",
  "../app/register/page.tsx",
  "../app/forgot-password/page.tsx",
  "../app/reset-password/page.tsx",
];

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("defines the Russian DJ Vault metadata defaults at the application root", async () => {
  const source = await readSource("../app/layout.tsx");

  assert.match(source, /title:\s*{\s*default:\s*"DJ Vault",\s*template:\s*"%s \| DJ Vault"/s);
  assert.match(source, /description:\s*"[^"]*[А-Яа-яЁё][^"]*"/u);
  assert.match(source, /metadataBase:\s*new URL\(process\.env\.NEXT_PUBLIC_APP_URL/);
  assert.match(source, /robots:\s*{\s*index:\s*true,\s*follow:\s*true,?\s*}/s);
});

test("gives every public route a distinct nonempty title", async () => {
  const titles = await Promise.all(
    publicPages.map(async (page) => {
      const source = await readSource(page);
      const match = source.match(/title:\s*"([^"]+)"/);

      assert.ok(match, `${page} must export a title`);
      return match[1];
    }),
  );

  assert.equal(new Set(titles).size, titles.length);
});

test("marks account, checkout, admin, and authentication routes noindex and nofollow", async () => {
  for (const page of privatePages) {
    const source = await readSource(page);

    assert.match(
      source,
      /robots:\s*{\s*index:\s*false,\s*follow:\s*false\s*}/s,
      `${page} must be noindex, nofollow`,
    );
  }
});
