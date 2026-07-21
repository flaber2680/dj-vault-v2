import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("renders hidden genres without touch interaction", async () => {
  const [page, control, styles] = await Promise.all([
    readFile(new URL("../app/collections/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/collections/GenreMore.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /import \{ GenreMore \} from "@\/components\/collections\/GenreMore";/);
  assert.equal((page.match(/<GenreMore/g) ?? []).length, 2);
  assert.doesNotMatch(control, /"use client"/);
  assert.doesNotMatch(control, /useState|onClick|aria-expanded/);
  assert.match(
    styles,
    /@media \(hover: none\) and \(pointer: coarse\) \{[\s\S]*?\.demo-card-more-control \{[\s\S]*?flex-basis: 100%;/,
  );
  assert.match(
    styles,
    /@media \(hover: none\) and \(pointer: coarse\) \{[\s\S]*?\.demo-card-more-popover \{[\s\S]*?position: static;[\s\S]*?opacity: 1;[\s\S]*?pointer-events: auto;/,
  );
});
