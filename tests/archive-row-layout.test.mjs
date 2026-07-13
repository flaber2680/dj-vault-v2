import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("groups archive metadata beside the row arrow in card order", async () => {
  const source = await readFile(
    new URL("../components/sections/LibraryBlocks.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /<span>Выпуск #\{archive\.number\}<\/span>[\s\S]*?<span className="archive-row-meta">[\s\S]*?formatTrackCount\(archive\.tracks\)[\s\S]*?archive\.size[\s\S]*?archive\.date[\s\S]*?<\/span>[\s\S]*?<span className="archive-row-arrow"/,
  );
});
