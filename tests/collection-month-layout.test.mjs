import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("does not draw a divider below the collection month heading", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  const monthHeadingRule = styles.match(/\.collection-month-head \{([\s\S]*?)\}/);

  assert.ok(monthHeadingRule);
  assert.doesNotMatch(monthHeadingRule[1], /border-bottom/);
  assert.match(monthHeadingRule[1], /padding-block: 14px/);
});
