import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("uses a static presentation for narrow and touch-first viewports", async () => {
  const [hero, scrollEffects, fallingCube, styles] = await Promise.all([
    readFile(new URL("../components/sections/Hero.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ScrollEffects.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../components/sections/FallingCube.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(hero, /const isMobileUserAgent =/);
  assert.match(hero, /iPhone\|iPad\|iPod/);
  assert.match(hero, /!isMobileUserAgent \? <FallingCube \/> : null/);
  assert.match(scrollEffects, /\(max-width: 900px\)/);
  assert.match(scrollEffects, /usesStaticMobilePresentation/);
  assert.match(
    scrollEffects,
    /if \(usesStaticMobilePresentation\) \{[\s\S]*?\}\s*\n\s*body\.classList\.add\("reveal-ready"\)/,
  );
  assert.match(fallingCube, /const shouldDisableEffects =/);
  assert.match(fallingCube, /if \(shouldDisableEffects\) \{\s*return;\s*\}/);
  assert.match(
    styles,
    /@media \(hover: none\), \(pointer: coarse\), \(max-width: 900px\)/,
  );
  assert.match(
    styles,
    /body\.is-scrolled \.header \{[^}]*?backdrop-filter: none;/,
  );
  assert.match(styles, /\.falling-cube \{\s*display: none;/);
});
