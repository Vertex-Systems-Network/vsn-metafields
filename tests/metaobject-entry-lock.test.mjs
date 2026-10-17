import test from "node:test";
import assert from "node:assert/strict";
import { withMetaobjectEntryLock } from "../app/metaobject-entry-lock.server.js";
import { saveMetaobjectEntry } from "../app/metaobjects.server.js";

const SHOP = "staging-oath3rth.myshopify.com";
const ENTRY = "gid://shopify/Metaobject/1007";
const definition = {
  type: "vsn_faq",
  access: { storefront: "NONE" },
  capabilities: { publishable: { enabled: true } },
  fieldDefinitions: [
    { key: "question", name: "Question", required: true, type: { name: "single_line_text_field" } },
    { key: "answer", name: "Answer", required: false, type: { name: "multi_line_text_field" } },
  ],
};

test("META-007 local SQLite queue serializes same-entry edits and releases on failure", async () => {
  const events = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const first = withMetaobjectEntryLock(SHOP, ENTRY, async () => {
    events.push("first-start");
    await gate;
    events.push("first-end");
    throw new Error("first edit failed");
  }, { target: "local-sqlite" });
  const second = withMetaobjectEntryLock(SHOP, ENTRY, async () => {
    events.push("second-start");
    return "second-ok";
  }, { target: "local-sqlite" });
  await Promise.resolve();
  assert.deepEqual(events, ["first-start"]);
  release();
  await assert.rejects(first, /first edit failed/);
  assert.equal(await second, "second-ok");
  assert.deepEqual(events, ["first-start", "first-end", "second-start"]);
});

test("META-007 shared Neon advisory lock prevents same-version concurrent app updates", async () => {
  let lockTail = Promise.resolve();
  let mutations = 0;
  let currentVersion = "v1";
  let currentValue = "Old question";
  let transactions = 0;
  let disconnected = 0;
  const dbFactory = async () => {
    let release;
    return {
      async $transaction(callback, opts) {
        transactions++;
        assert.deepEqual(opts, { maxWait: 10000, timeout: 30000 });
        try {
          return await callback({
            async $queryRaw(parts, shop, id) {
              assert.match(parts.join(""), /pg_advisory_xact_lock\(hashtext\(/);
              assert.equal(shop, SHOP);
              assert.equal(id, ENTRY);
              const previous = lockTail;
              lockTail = new Promise((resolve) => { release = resolve; });
              await previous; // Simulate PostgreSQL transaction lock arbitration.
              return [{ held: "" }];
            },
          });
        } finally {
          release?.();
        }
      },
      async $disconnect() { disconnected++; },
    };
  };
  const admin = {
    graphql: async (query, { variables } = {}) => {
      if (query.includes("SelectedMetaobject")) {
        return Response.json({
          data: { metaobject: {
            id: ENTRY,
            type: definition.type,
            updatedAt: currentVersion,
            handle: "qa",
            fields: [
              { key: "question", value: currentValue },
              { key: "answer", value: "Keep me" },
            ],
          } },
        });
      }
      assert.match(query, /UpdateMerchantMetaobject/);
      mutations++;
      currentValue = variables.metaobject.fields[0].value;
      currentVersion = "v2";
      return Response.json({ data: {
        metaobjectUpdate: { metaobject: {
          id: ENTRY, type: definition.type, handle: "qa",
          fields: [
            { key: "question", value: currentValue },
            { key: "answer", value: "Keep me" },
          ],
        }, userErrors: [] },
      } });
    },
  };
  const makeEdit = (title) => withMetaobjectEntryLock(
    SHOP, ENTRY,
    () => saveMetaobjectEntry(admin, definition, {
      id: ENTRY, handle: "qa", updatedAt: "v1",
      values: { question: title },
    }),
    { target: "neon", dbFactory },
  );
  const settled = await Promise.allSettled([makeEdit("First"), makeEdit("Conflicting second")]);
  assert.equal(settled[0].status, "fulfilled");
  assert.equal(settled[1].status, "rejected");
  assert.match(settled[1].reason.message, /changed.*Reload/i);
  assert.equal(mutations, 1);
  assert.equal(currentValue, "First");
  assert.equal(transactions, 2);
  assert.equal(disconnected, 2);
});

test("META-007 invalid key, DB lock failure and unsupported target fail closed", async () => {
  let mutations = 0;
  const mutate = () => { mutations++; };
  await assert.rejects(
    withMetaobjectEntryLock("invalid.com", ENTRY, mutate, { target: "local-sqlite" }),
    /Invalid shop/,
  );
  await assert.rejects(
    withMetaobjectEntryLock(SHOP, "wrong-entry", mutate, { target: "local-sqlite" }),
    /Invalid shop/,
  );
  await assert.rejects(
    withMetaobjectEntryLock(SHOP, ENTRY, mutate, { target: "unknown" }),
    /Unsupported database target/,
  );
  let disconnected = 0;
  await assert.rejects(
    withMetaobjectEntryLock(SHOP, ENTRY, mutate, {
      target: "neon",
      dbFactory: async () => ({
        $transaction: async (fn) => fn({
          $queryRaw: async () => { throw new Error("Lock unavailable"); },
        }),
        $disconnect: async () => { disconnected++; },
      }),
    }),
    /Lock unavailable/,
  );
  assert.equal(mutations, 0);
  assert.equal(disconnected, 1);
});
