import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("keeps the mobile hidden-genre popover inside the collection card", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(
    styles,
    /@media \(hover: none\) and \(pointer: coarse\) \{[\s\S]*?\.demo-card-more-popover \{[\s\S]*?left: 0;[\s\S]*?right: 0;[\s\S]*?width: auto;/,
  );
  assert.match(
    styles,
    /@media \(hover: none\) and \(pointer: coarse\) \{[\s\S]*?\.demo-card-tip-strip:has\(\.demo-card-more:focus\) \{[\s\S]*?padding-bottom:/,
  );
});
