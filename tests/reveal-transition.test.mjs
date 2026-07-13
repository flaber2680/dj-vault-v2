import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("keeps reveal transitions after the pending class is removed", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(
    styles,
    /\.reveal-ready \[data-reveal\] \{[\s\S]*?transition:[\s\S]*?opacity \.72s ease,[\s\S]*?transform \.72s cubic-bezier\(\.2, \.8, \.2, 1\),[\s\S]*?filter \.72s ease;[\s\S]*?transition-delay: var\(--reveal-delay, 0ms\);[\s\S]*?\}/,
  );
});
