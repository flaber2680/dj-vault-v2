import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../components/sections/LibraryBlocks.tsx", import.meta.url),
  "utf8",
);

assert.match(
  source,
  /import \{ getCollections, getDemoCollection \} from "@\/lib\/content\/collections";/,
  "The home page must load the demo collection for the guest CTA.",
);
assert.match(
  source,
  /const demoCollection = await getDemoCollection\(\);/,
  "The guest CTA must request the demo collection.",
);
assert.match(
  source,
  /demoCollection\.date/,
  "The guest CTA must render the demo collection metadata.",
);

console.log("home guest demo card: OK");
