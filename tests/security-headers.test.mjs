import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readNextConfig() {
  return readFile(new URL("../next.config.ts", import.meta.url), "utf8");
}

test("disables the framework signature and declares the approved response headers", async () => {
  const source = await readNextConfig();

  assert.match(source, /poweredByHeader:\s*false/);
  assert.match(source, /Content-Security-Policy/);
  assert.match(source, /X-Content-Type-Options/);
  assert.match(source, /Referrer-Policy/);
  assert.match(source, /X-Frame-Options/);
  assert.match(source, /Permissions-Policy/);
});

test("uses a restrictive CSP without wildcard sources or framing", async () => {
  const source = await readNextConfig();
  const policyStart = source.indexOf("const contentSecurityPolicy");
  const policyEnd = source.indexOf("].join", policyStart);
  const policySource = source.slice(policyStart, policyEnd);

  assert.match(source, /default-src 'self'/);
  assert.match(source, /frame-ancestors 'none'/);
  assert.match(source, /frame-src 'self'/);
  assert.match(source, /form-action 'self' https:\/\/yookassa\.ru/);
  assert.doesNotMatch(policySource, /\*/);
  assert.doesNotMatch(source, /https?:\/\/\*|\*\.yookassa|\*\.storage/);
});

test("emits HSTS only for production and denies unused browser capabilities", async () => {
  const source = await readNextConfig();

  assert.match(
    source,
    /process\.env\.NODE_ENV === "production"[\s\S]*?Strict-Transport-Security/,
  );
  assert.match(source, /max-age=31536000; includeSubDomains/);
  assert.match(source, /camera=\(\)/);
  assert.match(source, /microphone=\(\)/);
  assert.match(source, /geolocation=\(\)/);
  assert.match(source, /payment=\(\)/);
  assert.match(source, /usb=\(\)/);
  assert.match(source, /interest-cohort=\(\)/);
});
