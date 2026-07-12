import test from "node:test";
import assert from "node:assert/strict";

import { formatTrackCount } from "../lib/content/track-count.ts";

test("adds the correct Russian track label to numeric counts", () => {
  assert.equal(formatTrackCount("1"), "1 трек");
  assert.equal(formatTrackCount("2"), "2 трека");
  assert.equal(formatTrackCount("5"), "5 треков");
  assert.equal(formatTrackCount("11"), "11 треков");
  assert.equal(formatTrackCount("21"), "21 трек");
  assert.equal(formatTrackCount("42"), "42 трека");
});

test("keeps an existing unit without duplication", () => {
  assert.equal(formatTrackCount("41 трек"), "41 трек");
  assert.equal(formatTrackCount("150+ позиций"), "150+ позиций");
});

test("formats approximate numeric counts as tracks", () => {
  assert.equal(formatTrackCount("150+"), "150+ треков");
});
