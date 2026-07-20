import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("keeps the active collection card above its neighboring cards", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(
    styles,
    /\.demo-card-more \{[^}]*?position: relative;[^}]*?z-index: 2;/,
  );
  assert.match(
    styles,
    /\.demo-card-more-popover \{[^}]*?z-index: 10;[^}]*?background: #000;/,
  );
  assert.match(
    styles,
    /\.collection-release-card \{[^}]*?position: relative;[^}]*?z-index: 0;/,
  );
  assert.match(
    styles,
    /\.collection-release-card:hover,\s*\.collection-release-card:focus-within \{[^}]*?z-index: 1;/,
  );
  assert.doesNotMatch(styles, /\.demo-card-more-popover \{[^}]*?box-shadow:/);
});
