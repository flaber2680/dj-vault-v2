import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("keeps the home hero free from the removed strands effect", async () => {
  const [heroSource, styles, packageJson] = await Promise.all([
    readFile(new URL("../components/sections/Hero.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(heroSource, /HeroStrands|components\/effects/);
  assert.doesNotMatch(styles, /\.hero-strands/);
  assert.equal(JSON.parse(packageJson).dependencies.ogl, undefined);
});
