import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { parseImportCsv, exportValueCsv } from "../app/bulk-csv.js";
import {
  previewImport,
  runImportChunk,
  retryImport,
  readJob,
} from "../app/bulk-values.server.js";
const folder = mkdtempSync(join(tmpdir(), "vsn-bulk-tests-"));
let db;
before(async () => {
  execFileSync(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      "generate",
      "--schema",
      "prisma/local/schema.prisma",
    ],
    {
      env: { ...process.env, DATABASE_URL: `file:${folder}/test.db` },
      stdio: "pipe",
    },
  );
  const { PrismaClient } = createRequire(import.meta.url)(
    resolve("prisma/generated/sqlite-client/index.js"),
  );
  db = new PrismaClient({
    datasources: { db: { url: `file:${folder}/test.db` } },
  });
  for (const name of readdirSync("prisma/local/migrations")
    .filter((n) => !n.endsWith(".toml"))
    .sort()) {
    if (name === "20261002092000_metafield_jobs")
      await db.session.create({
        data: {
          id: "existing",
          shop: "keep.myshopify.com",
          state: "preserved",
          accessToken: "test-placeholder",
        },
      });
    const sql = readFileSync(
      `prisma/local/migrations/${name}/migration.sql`,
      "utf8",
    );
    for (const statement of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.$executeRawUnsafe(statement);
  }
});
after(async () => {
  await db?.$disconnect();
  rmSync(folder, { recursive: true, force: true });
});
const shop = "bulk-test.myshopify.com";
const row = (id, value = "after") => ({
  ownerType: "PRODUCT",
  ownerId: `gid://shopify/Product/${id}`,
  namespace: "vsn_test",
  key: "care",
  type: "single_line_text_field",
  value,
});
function api() {
  const state = new Map();
  let writes = 0,
    fail = false;
  return {
    state,
    get writes() {
      return writes;
    },
    set fail(v) {
      fail = v;
    },
    graphql: async (query, { variables } = {}) => ({
      json: async () => {
        if (query.includes("DefinitionManager"))
          return {
            data: {
              metafieldDefinitions: {
                nodes: [
                  {
                    id: "gid://shopify/MetafieldDefinition/1",
                    name: "Care",
                    namespace: "vsn_test",
                    key: "care",
                    ownerType: "PRODUCT",
                    type: { name: "single_line_text_field" },
                    validations: [],
                  },
                ],
                pageInfo: { hasNextPage: false },
              },
            },
          };
        if (query.includes("TypedResourceValue"))
          return {
            data: {
              node: {
                id: variables.id,
                __typename: "Product",
                metafield: state.get(variables.id) || null,
              },
            },
          };
        if (query.includes("SetVsnValue")) {
          const item = variables.metafields[0],
            current = state.get(item.ownerId);
          if (fail) {
            fail = false;
            throw new Error("temporary failure");
          }
          if ((current?.compareDigest ?? null) !== item.compareDigest)
            return {
              data: {
                metafieldsSet: {
                  userErrors: [
                    { message: "Conflict", code: "INVALID_COMPARE_DIGEST" },
                  ],
                },
              },
            };
          const saved = {
            ...item,
            id: "gid://shopify/Metafield/1",
            owner: { id: item.ownerId },
            compareDigest: `digest-${++writes}`,
          };
          state.set(item.ownerId, saved);
          return {
            data: { metafieldsSet: { metafields: [saved], userErrors: [] } },
          };
        }
        throw new Error("Unexpected query");
      },
    }),
  };
}
const apply = (job) => ({
  id: job.id,
  revision: job.revision,
  confirm: `APPLY:${job.id}:${job.inputHash}`,
});
test("CSV preserves quoted commas/newlines and spreadsheet formula strings as data", () => {
  const source = exportValueCsv([row(1, '=IMPORTXML("a","b")\nline, two')]);
  assert.equal(
    parseImportCsv(source)[0].value,
    '=IMPORTXML("a","b")\nline, two',
  );
  assert.throws(() => parseImportCsv(source + '"unfinished'), /quote/);
  assert.throws(
    () =>
      parseImportCsv(
        exportValueCsv(Array.from({ length: 101 }, (_, i) => row(i))),
      ),
    /100/,
  );
});
test("additive SQLite ledger migration preserves pre-existing session data", async () => {
  assert.equal(
    (await db.session.findUnique({ where: { id: "existing" } })).state,
    "preserved",
  );
});
test("mixed preview skips invalid duplicates and is isolated from other shops", async () => {
  const admin = api(),
    job = await previewImport(
      admin,
      db,
      shop,
      exportValueCsv([row(1), row(1)]),
    );
  assert.equal(job.rows[0].valid, true);
  assert.equal(job.rows[1].valid, false);
  assert.deepEqual(Object.keys(job.rows[1]).sort(), ["error", "row", "valid"]);
  assert.equal(admin.writes, 0);
  await assert.rejects(readJob(db, "other.myshopify.com", job.id), /not found/);
  const done = await runImportChunk(admin, db, shop, apply(job));
  assert.deepEqual(
    done.results.map((r) => r.status),
    ["saved", "invalid"],
  );
});
test("bounded chunks resume after reopening the database-backed job; stale revision and unconfirmed apply fail", async () => {
  const admin = api(),
    preview = await previewImport(
      admin,
      db,
      shop,
      exportValueCsv(Array.from({ length: 11 }, (_, i) => row(100 + i))),
    );
  await assert.rejects(
    runImportChunk(admin, db, shop, { ...apply(preview), confirm: "YES" }),
    /confirm/,
  );
  const first = await runImportChunk(admin, db, shop, apply(preview));
  assert.equal(first.cursor, 10);
  assert.equal(first.status, "paused");
  await assert.rejects(
    runImportChunk(admin, db, shop, apply(preview)),
    /confirm/,
  );
  const resumed = await runImportChunk(admin, db, shop, apply(first));
  assert.equal(resumed.status, "complete");
  assert.equal(admin.writes, 11);
});
test("post-preview concurrent changes remain conflicts and same-value resume makes no extra write", async () => {
  const admin = api(),
    preview = await previewImport(
      admin,
      db,
      shop,
      exportValueCsv([row(201), row(202)]),
    );
  admin.state.set(row(201).ownerId, {
    value: "another editor",
    type: "single_line_text_field",
    compareDigest: "changed",
  });
  admin.state.set(row(202).ownerId, {
    value: "after",
    type: "single_line_text_field",
    compareDigest: "reconciled",
  });
  const done = await runImportChunk(admin, db, shop, apply(preview));
  assert.deepEqual(
    done.results.map((r) => r.status),
    ["conflict", "unchanged"],
  );
  assert.equal(admin.writes, 0);
});
test("atomic Shopify digest races remain conflicts and cannot enter failed-row retry", async () => {
  for (const code of ["STALE_OBJECT", "INVALID_COMPARE_DIGEST"]) {
    const admin = api();
    const preview = await previewImport(admin, db, shop, exportValueCsv([row(250)]));
    const original = admin.graphql;
    admin.graphql = async (query, options) => {
      if (query.includes("SetVsnValue")) {
        admin.state.set(row(250).ownerId, {
          value: "another editor", type: "single_line_text_field",
          compareDigest: "changed-after-precheck",
        });
        return { json: async () => ({ data: { metafieldsSet: {
          userErrors: [{ message: "Value changed", code }],
        } } }) };
      }
      return original(query, options);
    };
    const done = await runImportChunk(admin, db, shop, apply(preview));
    assert.equal(done.results[0].status, "conflict");
    assert.equal(done.results[0].code, code);
    assert.equal(admin.writes, 0);
    assert.equal(admin.state.get(row(250).ownerId).value, "another editor");
    await assert.rejects(retryImport(db, shop, {
      id: done.id, revision: done.revision,
      confirm: `RETRY:${done.id}:${done.inputHash}`,
    }), /failed rows/i);
  }
});
test("failed rows can retry while successful rows remain untouched", async () => {
  const admin = api(),
    preview = await previewImport(
      admin,
      db,
      shop,
      exportValueCsv([row(301), row(302)]),
    );
  admin.fail = true;
  const first = await runImportChunk(admin, db, shop, apply(preview));
  assert.deepEqual(
    first.results.map((r) => r.status),
    ["failed", "saved"],
  );
  const retry = await retryImport(db, shop, {
    id: first.id,
    revision: first.revision,
    confirm: `RETRY:${first.id}:${first.inputHash}`,
  });
  const final = await runImportChunk(admin, db, shop, apply(retry));
  assert.deepEqual(
    final.results.map((r) => r.status),
    ["saved", "saved"],
  );
  assert.equal(admin.writes, 2);
});
test("a lost ledger persistence after Shopify write reconciles safely on resume", async () => {
  const admin = api(),
    preview = await previewImport(admin, db, shop, exportValueCsv([row(401)]));
  let thrown = false;
  const failing = {
    metafieldJob: {
      ...db.metafieldJob,
      findFirst: (...args) => db.metafieldJob.findFirst(...args),
      updateMany: async (args) => {
        if (!thrown && args.data.resultsJson) {
          thrown = true;
          throw new Error("lost connection");
        }
        return db.metafieldJob.updateMany(args);
      },
    },
  };
  await assert.rejects(
    runImportChunk(admin, failing, shop, apply(preview)),
    /lost connection/,
  );
  const stored = await readJob(db, shop, preview.id);
  const final = await runImportChunk(admin, db, shop, {
    id: stored.id,
    revision: stored.revision,
    confirm: `APPLY:${stored.id}:${stored.inputHash}`,
  });
  assert.equal(final.results[0].status, "unchanged");
  assert.equal(admin.writes, 1);
});
