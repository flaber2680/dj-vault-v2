import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("implements a client-only strands layer with accessible motion fallbacks", async () => {
  const source = await readFile(
    new URL("../components/effects/HeroStrands.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /"use client"/);
  assert.match(source, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(source, /getContext\("webgl2"\)/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /cancelAnimationFrame/);
  assert.match(source, /WEBGL_lose_context/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(
    source,
    /catch \{[\s\S]*?failedRenderer\?\.gl\.getExtension\("WEBGL_lose_context"\)\?\.loseContext\(\);/,
  );
});
