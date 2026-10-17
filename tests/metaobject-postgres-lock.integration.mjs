// Integration acceptance against the real isolated PostgreSQL CI service.
// Never target staging/production: this test deliberately holds advisory locks.
import test from "node:test";
import assert from "node:assert/strict";
import { createPrismaClient } from "../app/db.server.js";
import { withMetaobjectEntryLock } from "../app/metaobject-entry-lock.server.js";

const dbUrl = process.env.DATABASE_URL || "";
const targetHost = dbUrl ? new URL(dbUrl).hostname : "";
if (!["localhost", "127.0.0.1"].includes(targetHost) ||
    process.env.NODE_ENV !== "test" ||
    (process.env.VSN_DB_TARGET || "neon") !== "neon")
  throw new Error("META-007 real-lock CI test requires local PostgreSQL and NODE_ENV=test.");

const SHOP = "meta007-ci.myshopify.com";
const ID = "gid://shopify/Metaobject/712345678";
const SECOND_ID = "gid://shopify/Metaobject/712345679";
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function trackedFactory(onTxStart = () => {}) {
  return async () => {
    // This creates a distinct PostgreSQL connection/pool per contender.
    const db = createPrismaClient();
    return {
      $transaction: async (callback, opts) => {
        onTxStart();
        return db.$transaction(callback, opts);
      },
      $disconnect: () => db.$disconnect(),
    };
  };
}

test("META-007 real Postgres: second same-entry transaction waits for first release", { timeout: 15000 }, async () => {
  const history = [];
  let releaseFirst;
  let firstEntered;
  let secondTransactionStarted;
  const holdFirst = new Promise(resolve => { releaseFirst = resolve; });
  const firstEnteredPromise = new Promise(resolve => { firstEntered = resolve; });
  const secondStartedPromise = new Promise(resolve => { secondTransactionStarted = resolve; });

  const first = withMetaobjectEntryLock(SHOP, ID, async () => {
    history.push("first-acquired");
    firstEntered();
    await holdFirst;
    history.push("first-released");
    return "first";
  }, { target: "neon", dbFactory: trackedFactory() });
  try {
    await firstEnteredPromise;
    const second = withMetaobjectEntryLock(SHOP, ID, async () => {
      history.push("second-acquired");
      return "second";
    }, {
      target: "neon",
      dbFactory: trackedFactory(() => secondTransactionStarted()),
    });
    await secondStartedPromise;
    await delay(180);
    assert.deepEqual(history, ["first-acquired"],
      "A second connection entered the critical section while the first held the lock.");
    releaseFirst();
    assert.equal(await first, "first");
    assert.equal(await second, "second");
    assert.deepEqual(history, [
      "first-acquired", "first-released", "second-acquired",
    ]);
  } finally {
    releaseFirst();
    await first.catch(() => {});
  }
});

test("META-007 real Postgres: independent entry is not blocked by another lock", { timeout: 15000 }, async () => {
  let release;
  let acquired;
  const hold = new Promise(resolve => { release = resolve; });
  const firstEntered = new Promise(resolve => { acquired = resolve; });
  const first = withMetaobjectEntryLock(SHOP, ID, async () => {
    acquired();
    await hold;
  }, { target: "neon", dbFactory: trackedFactory() });
  try {
    await firstEntered;
    const result = await Promise.race([
      withMetaobjectEntryLock(SHOP, SECOND_ID, async () => "unblocked",
        { target: "neon", dbFactory: trackedFactory() }),
      delay(4000).then(() => { throw new Error("Unrelated metaobject key was blocked."); }),
    ]);
    assert.equal(result, "unblocked");
  } finally {
    release();
    await first;
  }
});

test("META-007 real Postgres: rejected callback rolls back and releases entry lock", { timeout: 15000 }, async () => {
  await assert.rejects(
    withMetaobjectEntryLock(SHOP, ID, async () => {
      throw new Error("expected edit failure");
    }, { target: "neon", dbFactory: trackedFactory() }),
    /expected edit failure/,
  );
  const result = await withMetaobjectEntryLock(SHOP, ID, async () => "reacquired",
    { target: "neon", dbFactory: trackedFactory() });
  assert.equal(result, "reacquired");
});
