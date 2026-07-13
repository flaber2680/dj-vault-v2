import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("gives the release number and date distinct visual hooks", async () => {
  const source = await readFile(
    new URL("../app/collections/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /<time className="collection-release-date">\{collection\.date\}<\/time>/,
  );
  assert.match(
    source,
    /<time className="collection-release-date">\{demoCollection\.date\}<\/time>/,
  );
  assert.match(
    source,
    /<h2 className="collection-release-title">[\s\S]*?<span>Подборка<\/span>[\s\S]*?<strong>#\{collection\.number\}<\/strong>[\s\S]*?<\/h2>/,
  );
});

test("uses the compact mobile collection card spacing", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(
    styles,
    /@media \(max-width: 600px\)[\s\S]*?\.collection-release-card \{[\s\S]*?padding: 16px;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 600px\)[\s\S]*?\.collection-release-card \.demo-card-action \{[\s\S]*?padding-top: 20px;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 600px\)[\s\S]*?\.collection-demo-featured \{[\s\S]*?padding: 16px;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 600px\)[\s\S]*?\.collection-demo-featured \.demo-card-action \{[\s\S]*?padding-top: 20px;/,
  );
});
