import test from "node:test";
import assert from "node:assert/strict";

import {
  HERO_STRANDS,
  isHeroStrandsEnabled,
} from "../components/effects/hero-strands-config.ts";

test("enables hero strands only on motion-capable desktop browsers", () => {
  assert.equal(
    isHeroStrandsEnabled({
      viewportWidth: 1280,
      prefersReducedMotion: false,
      supportsWebgl2: true,
    }),
    true,
  );
});

test("keeps the existing plain hero for mobile, reduced motion, and no WebGL2", () => {
  const desktop = {
    viewportWidth: 1280,
    prefersReducedMotion: false,
    supportsWebgl2: true,
  };

  assert.equal(isHeroStrandsEnabled({ ...desktop, viewportWidth: 900 }), false);
  assert.equal(isHeroStrandsEnabled({ ...desktop, prefersReducedMotion: true }), false);
  assert.equal(isHeroStrandsEnabled({ ...desktop, supportsWebgl2: false }), false);
});

test("keeps the restrained two-color hero strands profile", () => {
  assert.deepEqual(HERO_STRANDS.colors, ["#F5F7FA", "#9FB7C8"]);
  assert.equal(HERO_STRANDS.dpr, 1.5);
  assert.equal(HERO_STRANDS.strandCount, 2);
  assert.equal(HERO_STRANDS.speed, 0.24);
});
