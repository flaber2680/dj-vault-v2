import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCollectionArchive,
  formatArchiveTrackTotal,
  formatReleaseCount,
} from "../lib/content/collection-archive.ts";

const collections = [
  { number: "004", date: "25.06.26", tracks: "65 треков" },
  { number: "003", date: "18 июня 2026", tracks: "45 треков" },
  { number: "005", date: "02.07.2026", tracks: "150+ позиций" },
];

test("groups releases by month and orders newest month first", () => {
  const archive = buildCollectionArchive(collections);

  assert.deepEqual(
    archive.groups.map((group) => ({
      key: group.key,
      label: group.label,
      numbers: group.collections.map((collection) => collection.number),
    })),
    [
      { key: "2026-07", label: "Июль 2026", numbers: ["005"] },
      { key: "2026-06", label: "Июнь 2026", numbers: ["004", "003"] },
    ],
  );
});

test("calculates archive and month track totals", () => {
  const archive = buildCollectionArchive(collections);

  assert.equal(archive.totalTracks, 260);
  assert.equal(archive.isApproximate, true);
  assert.equal(archive.releaseCount, 3);
  assert.deepEqual(
    archive.groups.map((group) => ({
      totalTracks: group.totalTracks,
      isApproximate: group.isApproximate,
      releaseCount: group.releaseCount,
    })),
    [
      { totalTracks: 150, isApproximate: true, releaseCount: 1 },
      { totalTracks: 110, isApproximate: false, releaseCount: 2 },
    ],
  );
});

test("formats exact and approximate archive labels", () => {
  assert.equal(formatArchiveTrackTotal(110, false), "110 треков");
  assert.equal(formatArchiveTrackTotal(260, true), "≈ 260 треков");
  assert.equal(formatReleaseCount(1), "1 выпуск");
  assert.equal(formatReleaseCount(2), "2 выпуска");
  assert.equal(formatReleaseCount(5), "5 выпусков");
});
