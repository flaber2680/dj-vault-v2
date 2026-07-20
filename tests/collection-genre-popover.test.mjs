import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("renders the hidden-genre popover as an opaque layer above nearby tags", async () => {
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
    /\.demo-card-more-popover \{[^}]*?box-shadow: 0 0 0 12px #000;/,
  );
});
