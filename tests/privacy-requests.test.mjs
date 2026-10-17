import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { transformSync } from "esbuild";
import { featureError } from "../app/feature-request.server.js";
import { isSyntheticShopMismatch, parseDataRequest, recordDataRequest, listDataRequests, completeDataRequest, purgeCompletedRequests, matchingJobIds, unreadableJobIds } from "../app/privacy-requests.server.js";
const folder = mkdtempSync(join(tmpdir(), "vsn-privacy-"));
let db;
before(async () => {
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "generate", "--schema", "prisma/local/schema.prisma"],
    { env: {...process.env, DATABASE_URL:`file:${folder}/test.db`}, stdio:"pipe" });
  const {PrismaClient} = createRequire(import.meta.url)(resolve("prisma/generated/sqlite-client/index.js"));
  db = new PrismaClient({datasources:{db:{url:`file:${folder}/test.db`}}});
  for (const name of readdirSync("prisma/local/migrations").filter(n=>!n.endsWith(".toml")).sort()) {
    for (const statement of readFileSync(`prisma/local/migrations/${name}/migration.sql`, "utf8")
      .split(";").map(s=>s.trim()).filter(Boolean)) await db.$executeRawUnsafe(statement);
  }
});
after(async () => { await db?.$disconnect(); rmSync(folder,{recursive:true,force:true}); });
const shop = "privacy-test.myshopify.com";
const payload = {shop_domain:shop,data_request:{id:42},customer:{id:null,email:"Person@Example.COM",phone:null},orders_requested:[]};
test("Shopify CLI placeholder mismatch is acknowledged only for signed test delivery", () => {
  const fixture = { ...payload, shop_domain: "{shop}.myshopify.com" };
  assert.equal(isSyntheticShopMismatch("shop.myshopify.com", fixture, "true"), true);
  assert.equal(isSyntheticShopMismatch("shop.myshopify.com", fixture, null), false);
  assert.equal(isSyntheticShopMismatch(shop, payload, "true"), false);
  assert.throws(() => parseDataRequest("shop.myshopify.com", fixture), /Shop mismatch/);
});
test("authenticated request idempotency and shop isolation", async () => {
  assert.throws(()=>parseDataRequest("other.myshopify.com",payload),/Shop mismatch/);
  await recordDataRequest(db,shop,payload);
  await recordDataRequest(db,shop,payload);
  assert.equal(await db.privacyRequest.count({where:{shop}}),1);
});
test("identifiers find legacy snapshots, while all jobs remain reviewable", async () => {
  await db.metafieldJob.create({data:{
    id:"legacy",shop,inputHash:"hash",rowsJson:JSON.stringify([{row:1,valid:false,error:"Person@example.com"}]),
    resultsJson:"[]",expiresAt:new Date(Date.now()+86400000),
  }});
  await db.metafieldJob.create({data:{
    id:"free-text",shop,inputHash:"hash",rowsJson:JSON.stringify([{row:1,valid:true,value:"Unknown personal text"}]),
    resultsJson:"[]",expiresAt:new Date(Date.now()+86400000),
  }});
  const { requests: [request] }=await listDataRequests(db,shop);
  assert.deepEqual(request.candidateJobIds,["legacy"]);
  assert.deepEqual(new Set(request.allJobIds),new Set(["legacy","free-text"]));
});
test("merchant confirmation clears contact data; completed record expires", async () => {
  const id = `${shop}:42`;
  await assert.rejects(()=>completeDataRequest(db,shop,id,"wrong"),/confirmation/);
  await completeDataRequest(db,shop,id,`FULFILLED:${id}`);
  const completed=await db.privacyRequest.findUnique({where:{id}});
  assert.equal(completed.status,"fulfilled");
  assert.equal(completed.customerEmail,null);
  assert.equal(completed.customerId,null);
  assert.equal(completed.ordersJson,"[]");
  await recordDataRequest(db,shop,payload);
  assert.equal((await db.privacyRequest.findUnique({where:{id}})).status,"fulfilled");
  assert.equal(await purgeCompletedRequests(db,new Date(Date.now()+31*86400000)),1);
});

test("completed history cannot hide an older pending privacy backlog", async () => {
  const createdAt = new Date("2026-10-01T00:00:00Z");
  await db.privacyRequest.createMany({ data: Array.from({ length: 55 }, (_, i) => ({
    id: `${shop}:${100 + i}`, shop, status: "pending", ordersJson: "[]", createdAt,
  })) });
  await db.privacyRequest.createMany({ data: Array.from({ length: 60 }, (_, i) => ({
    id: `${shop}:done-${i}`, shop, status: "fulfilled",
    ordersJson: "[]", createdAt: new Date("2026-10-12T00:00:00Z"),
    completedAt: new Date("2026-10-12T00:00:00Z"),
  })) });

  const first = await listDataRequests(db, shop);
  assert.equal(first.pendingCount, 55);
  assert.equal(first.completedCount, 60);
  assert.equal(first.requests.length, 50);
  assert.equal(first.requests[0].id, `${shop}:100`);

  await completeDataRequest(db, shop, first.requests[0].id, `FULFILLED:${first.requests[0].id}`);
  const next = await listDataRequests(db, shop);
  assert.equal(next.pendingCount, 54);
  assert.equal(next.completedCount, 61);
  assert.equal(next.requests[0].id, `${shop}:101`);
});

test("privacy review includes every retained job when legacy or concurrent writes exceed 20", async () => {
  const ids = Array.from({ length: 21 }, (_, i) => `retained-${i}`);
  await db.metafieldJob.createMany({ data: ids.map((id, i) => ({
    id, shop, inputHash: "hash",
    rowsJson: JSON.stringify([{ row: 1, valid: true, value: i === 20 ? "person@example.com" : "other" }]),
    resultsJson: "[]", expiresAt: new Date(Date.now() + 86400000),
  })) });
  await db.privacyRequest.update({
    where: { id: `${shop}:101` }, data: { customerEmail: "person@example.com" },
  });

  const { requests } = await listDataRequests(db, shop);
  const request = requests.find((item) => item.id === `${shop}:101`);
  assert.ok(request);
  for (const id of ids) assert.ok(request.allJobIds.includes(id), id);
  assert.ok(request.candidateJobIds.includes("retained-20"));
});

test("fulfillment conflict returns a page-level error and releases the database", async () => {
  const code = transformSync(readFileSync(resolve("app/routes/app.privacy.jsx"), "utf8"), {
    loader: "jsx", format: "cjs",
  }).code;
  let disconnected = 0;
  let failure = new RangeError("Request was already fulfilled or not found.");
  const dependencies = {
    react: { useState: () => {} },
    "react/jsx-runtime": {},
    "react-router": {},
    "../shopify.server": { authenticate: { admin: async () => ({ session: { shop } }) } },
    "../db.server": { createPrismaClient: () => ({ $disconnect: async () => { disconnected++; } }) },
    "../privacy-requests.server": {
      listDataRequests: async () => ({}),
      completeDataRequest: async () => { if (failure) throw failure; },
    },
    "../components/Workspace": {},
    "../components/ActionButton": {},
    "../feature-request.server": { featureError },
  };
  const route = { exports: {} };
  new Function("require", "module", "exports", code)((id) => {
    assert.ok(id in dependencies, id);
    return dependencies[id];
  }, route, route.exports);
  const request = () => new Request("https://example.invalid/app/privacy", {
    method: "POST", body: new URLSearchParams({ id: `${shop}:42`, confirm: `FULFILLED:${shop}:42` }),
  });

  const response = await route.exports.action({ request: request() });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false, error: "Request was already fulfilled or not found.",
  });
  assert.equal(disconnected, 1);

  failure = null;
  assert.deepEqual(await route.exports.action({ request: request() }), { ok: true });
  assert.equal(disconnected, 2);

  failure = new Error("Database unavailable");
  await assert.rejects(() => route.exports.action({ request: request() }), /Database unavailable/);
  assert.equal(disconnected, 3);
});

test("META-011 malformed retained job snapshots remain visible and flagged in privacy review", async () => {
  const isolated = "privacy-corrupt-test.myshopify.com";
  await recordDataRequest(db, isolated, {
    shop_domain: isolated,
    data_request: { id: 9001 },
    customer: { id: null, email: "owner@example.com", phone: null },
    orders_requested: [],
  });
  await db.metafieldJob.createMany({ data: [
    {
      id: "corrupt-json", shop: isolated, inputHash: "hash",
      rowsJson: "{unclosed", resultsJson: "[]",
      expiresAt: new Date(Date.now() + 86400000),
    },
    {
      id: "corrupt-shape", shop: isolated, inputHash: "hash",
      rowsJson: "null", resultsJson: "[]",
      expiresAt: new Date(Date.now() + 86400000),
    },
    {
      id: "corrupt-row", shop: isolated, inputHash: "hash",
      rowsJson: "[null]", resultsJson: "[]",
      expiresAt: new Date(Date.now() + 86400000),
    },
    {
      id: "valid-match", shop: isolated, inputHash: "hash",
      rowsJson: JSON.stringify([{ row: 1, value: "owner@example.com" }]),
      resultsJson: "[]",
      expiresAt: new Date(Date.now() + 86400000),
    },
    {
      id: "valid-unmatched", shop: isolated, inputHash: "hash",
      rowsJson: JSON.stringify([{ row: 1, value: "nothing here" }]),
      resultsJson: "[]",
      expiresAt: new Date(Date.now() + 86400000),
    },
  ] });
  const result = await listDataRequests(db, isolated);
  assert.equal(result.pendingCount, 1);
  assert.equal(result.requests.length, 1);
  const request = result.requests[0];
  assert.deepEqual(request.candidateJobIds, ["valid-match"]);
  assert.deepEqual(request.unreadableJobIds, [
    "corrupt-json", "corrupt-shape", "corrupt-row",
  ]);
  assert.deepEqual(new Set(request.allJobIds), new Set([
    "corrupt-json", "corrupt-shape", "corrupt-row",
    "valid-match", "valid-unmatched",
  ]));
  assert.deepEqual(unreadableJobIds([
    { id: "bad", rowsJson: "{}", resultsJson: "[]" },
  ]), ["bad"]);
  assert.deepEqual(matchingJobIds({
    customerId: null, ordersJson: "[]",
    customerEmail: "owner@example.com", customerPhone: null,
  }, [{ id: "bad", rowsJson: "{", resultsJson: "[]" }]), []);
});

test("META-011 privacy screen distinguishes corrupt manual-review jobs from identifier matches", () => {
  const page = readFileSync(resolve("app/routes/app.privacy.jsx"), "utf8");
  assert.match(page, /unreadableJobIds/);
  assert.match(page, /unreadable snapshot — manual recovery required/);
  assert.match(page, /an unreadable snapshot is not proof/i);
});
