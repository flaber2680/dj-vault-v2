import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("keeps legal containers shrinkable and wraps long legal content", async () => {
  const styles = await readSource("../app/globals.css");

  assert.match(styles, /\.legal-page\s*{[^}]*min-width:\s*0/s);
  assert.match(styles, /\.legal-document\s*{[^}]*min-width:\s*0/s);
  assert.match(styles, /\.legal-document\s+:is\([^)]+\)[\s\S]*?overflow-wrap:\s*anywhere/s);
});

test("does not hide horizontal overflow at the document level", async () => {
  const [styles, layout] = await Promise.all([
    readSource("../app/globals.css"),
    readSource("../app/layout.tsx"),
  ]);

  assert.doesNotMatch(styles, /body\s*{[^}]*overflow-x\s*:/s);
  assert.doesNotMatch(layout, /overflow-x-hidden/);
});
