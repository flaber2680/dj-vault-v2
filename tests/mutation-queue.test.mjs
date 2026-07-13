import test from "node:test";
import assert from "node:assert/strict";

import { createMutationQueue } from "../lib/storage/mutation-queue.ts";

test("serializes concurrent mutations in invocation order", async () => {
  const runMutation = createMutationQueue();
  const events = [];
  let releaseFirst = () => {};
  const firstCanFinish = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  const first = runMutation(async () => {
    events.push("first:start");
    await firstCanFinish;
    events.push("first:end");
  });
  const second = runMutation(async () => {
    events.push("second:start");
    events.push("second:end");
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ["first:start"]);

  releaseFirst();
  await Promise.all([first, second]);

  assert.deepEqual(events, [
    "first:start",
    "first:end",
    "second:start",
    "second:end",
  ]);
});

test("continues after a failed mutation", async () => {
  const runMutation = createMutationQueue();

  await assert.rejects(
    runMutation(async () => {
      throw new Error("WRITE_FAILED");
    }),
    /WRITE_FAILED/,
  );

  assert.equal(await runMutation(async () => "recovered"), "recovered");
});
