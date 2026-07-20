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

test("keeps the download action as a POST form with the existing iframe and accessible states", async () => {
  const source = await readFile(
    new URL("../components/collections/CollectionDownloadAction.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /<form[\s\S]*?method="post"[\s\S]*?onSubmit=\{handleSubmit\}/,
  );
  assert.match(
    source,
    /fetch\([\s\S]*?\?format=json[\s\S]*?method: "POST"/,
  );
  assert.match(source, /document\.createElement\("iframe"\)/);
  assert.match(source, /aria-label=\{formatDownloadsLeft\(remaining, limit\)\}/);
  assert.match(source, /className="button-outline collection-download-button"/);
});

test("shows a localized nonempty error when download creation is rate limited", async () => {
  const source = await readFile(
    new URL("../components/collections/CollectionDownloadAction.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /error\?: "limit" \| "not_configured" \| "rate_limit" \| "storage"/,
  );
  assert.match(
    source,
    /rate_limit: "Слишком много попыток\. Попробуйте позже\."/,
  );
  assert.match(
    source,
    /if \(!response\.ok \|\| !result\.downloadUrl\)[\s\S]*?setError\([\s\S]*?result\.error \? errorMessages\[result\.error\]/,
  );
  assert.match(source, /\{error \? <p className="collection-download-message">\{error\}<\/p> : null\}/);
});
