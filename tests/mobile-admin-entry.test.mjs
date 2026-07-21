import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("keeps the admin entry visible in the mobile header", async () => {
  const [header, styles] = await Promise.all([
    readFile(new URL("../components/layout/Header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(header, /className="header-admin-mobile" href="\/admin"/);
  assert.match(
    styles,
    /@media \(max-width: 900px\) \{[\s\S]*?\.header-admin-mobile \{[\s\S]*?display: inline-flex;/,
  );
});
