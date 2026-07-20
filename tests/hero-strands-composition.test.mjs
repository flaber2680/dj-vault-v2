import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("layers strands behind the existing home hero content", async () => {
  const [heroSource, styles] = await Promise.all([
    readFile(new URL("../components/sections/Hero.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(
    heroSource,
    /import \{ HeroStrands \} from "@\/components\/effects\/HeroStrands"/,
  );
  assert.match(
    heroSource,
    /<div className="hero-content">[\s\S]*?<HeroStrands \/>[\s\S]*?<div[\s\S]*?className="hero-label"/,
  );
  assert.match(
    styles,
    /\.hero-strands \{[\s\S]*?width: min\(560px, 100%\);[\s\S]*?height: 112px;[\s\S]*?margin: 0 auto 24px;/,
  );
  assert.doesNotMatch(
    styles,
    /\.hero-strands \{[^}]*position: absolute;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 900px\)[\s\S]*?\.hero-strands \{[\s\S]*?display: none;/,
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.hero-strands \{[\s\S]*?display: none;/,
  );
});
