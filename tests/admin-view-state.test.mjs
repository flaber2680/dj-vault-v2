import test from "node:test";
import assert from "node:assert/strict";

import { getAdminViewState } from "../lib/admin/view-state.ts";

const collections = [{ number: "demo" }, { number: "027" }];
const users = [{ id: "user-1" }, { id: "user-2" }];

test("defaults to the collections workspace", () => {
  assert.deepEqual(getAdminViewState({}, collections, users), {
    section: "collections",
    collection: undefined,
    isNewCollection: false,
    user: undefined,
  });
});

test("opens the new collection editor only in the collections workspace", () => {
  assert.equal(
    getAdminViewState(
      { section: "collections", collection: "new" },
      collections,
      users,
    ).isNewCollection,
    true,
  );
  assert.equal(
    getAdminViewState(
      { section: "downloads", collection: "new" },
      collections,
      users,
    ).isNewCollection,
    false,
  );
});

test("keeps a valid section and rejects an unknown section", () => {
  assert.equal(
    getAdminViewState({ section: "promo-codes" }, collections, users).section,
    "promo-codes",
  );
  assert.equal(
    getAdminViewState({ section: "billing" }, collections, users).section,
    "collections",
  );
});

test("opens only an existing collection in the collections workspace", () => {
  assert.equal(
    getAdminViewState(
      { section: "collections", collection: "027" },
      collections,
      users,
    ).collection?.number,
    "027",
  );
  assert.equal(
    getAdminViewState(
      { section: "users", collection: "027" },
      collections,
      users,
    ).collection,
    undefined,
  );
});

test("opens only an existing user in the users workspace", () => {
  assert.equal(
    getAdminViewState(
      { section: "users", user: "user-2" },
      collections,
      users,
    ).user?.id,
    "user-2",
  );
  assert.equal(
    getAdminViewState(
      { section: "users", user: "missing" },
      collections,
      users,
    ).user,
    undefined,
  );
});
