// Manual guarded staging-deploy acceptance ONLY. Creates and removes one QA entry.
// Never run against Production. Never prints Shopify tokens or DB credentials.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { graph } from "../../app/definitions.server.js";
import {
  listMetaobjectDefinitions,
  readMetaobjectEntry,
  saveMetaobjectEntry,
  removeMetaobjectEntry,
} from "../../app/metaobjects.server.js";
import { withMetaobjectEntryLock } from "../../app/metaobject-entry-lock.server.js";
import { metaobjectEntryFingerprint } from "../../app/metaobject-entry-fingerprint.js";

const SHOP = "staging-oath3rth.myshopify.com";
const TYPE = "vsn_qa_20261004";
const APP = "https://vsn-metafields-staging.vertexsystemsnetwork.workers.dev";
const ENDPOINT = "ep-snowy-surf-b3gxl2wf";
const {
  DATABASE_URL, SHOPIFY_APP_URL, STAGING_SHOP, SHOPIFY_API_KEY,
  STAGING_NEON_ENDPOINT_ID,
} = process.env;
const hostname = DATABASE_URL ? new URL(DATABASE_URL).hostname : "";
if (
  STAGING_SHOP !== SHOP ||
  SHOPIFY_APP_URL !== APP ||
  STAGING_NEON_ENDPOINT_ID !== ENDPOINT ||
  !hostname.startsWith(ENDPOINT + "-pooler.") ||
  !hostname.endsWith(".neon.tech") ||
  !SHOPIFY_API_KEY
) throw new Error("META-007 race probe requires isolated Staging identity.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});
const nonce = randomBytes(5).toString("hex");
const handle = "meta007-race-" + nonce;
let createdId = null;
let success = false;
let cleanupConfirmed = false;
const pendingWriters = [];
let firstMutationReached;
let releaseFirstMutation;
const firstMutationGate = new Promise(resolve => { releaseFirstMutation = resolve; });
const firstMutationEntered = new Promise(resolve => { firstMutationReached = resolve; });

try {
  const session = await prisma.session.findFirst({
    where: { shop: SHOP, isOnline: false },
    select: { accessToken: true },
  });
  if (!session?.accessToken) throw new Error("Staging offline Shopify session missing.");

  const graphql = async (query, { variables } = {}) => {
    const response = await fetch("https://" + SHOP + "/admin/api/2026-07/graphql.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error("Shopify staging GraphQL HTTP " + response.status);
    return response;
  };
  const admin = { graphql };
  const identity = await graph(admin,
    "#graphql\nquery Meta007Identity { currentAppInstallation { app { apiKey } } }");
  assert.equal(identity.currentAppInstallation?.app?.apiKey, SHOPIFY_API_KEY,
    "Wrong staging app identity; no QA data changes allowed.");

  const definition = (await listMetaobjectDefinitions(admin)).find(d => d.type === TYPE);
  assert.ok(definition?.editable && definition.access?.storefront === "NONE",
    "Expected private merchant-owned QA definition missing");
  const f = definition.fieldDefinitions || [];
  assert.equal(f.length, 2);
  assert.ok(f.some(x => x.key === "title" && x.required === true &&
    x.type.name === "single_line_text_field"));
  assert.ok(f.some(x => x.key === "optional_qa_note" && x.required !== true &&
    x.type.name === "single_line_text_field"));

  const created = await graph(admin, `#graphql
    mutation Meta007ProbeCreate($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject:$metaobject) {
        metaobject { id type handle } userErrors { message }
      }
    }`, { metaobject: {
      type: TYPE, handle,
      fields: [
        { key: "title", value: "META007 original " + nonce },
        { key: "optional_qa_note", value: "Preserve sibling " + nonce },
      ],
      capabilities: { publishable: { status: "DRAFT" } },
    },
  });
  assert.deepEqual(created.metaobjectCreate?.userErrors || [], []);
  createdId = created.metaobjectCreate?.metaobject?.id;
  assert.match(createdId || "", /^gid:\/\/shopify\/Metaobject\/[0-9]+$/);
  assert.equal(created.metaobjectCreate.metaobject.handle, handle);

  const initial = await readMetaobjectEntry(admin, createdId, TYPE);
  const originalDigest = await metaobjectEntryFingerprint(initial);
  const originalOptional = initial.fields.find(x => x.key === "optional_qa_note")?.value;
  assert.equal(originalOptional, "Preserve sibling " + nonce);

  // First writer stays in mutation while second transaction attempts same lock.
  const firstAdmin = {
    graphql: async (query, options) => {
      if (query.includes("mutation UpdateMerchantMetaobject")) {
        firstMutationReached();
        await firstMutationGate;
      }
      return graphql(query, options);
    },
  };
  const first = withMetaobjectEntryLock(SHOP, createdId, () =>
    saveMetaobjectEntry(firstAdmin, definition, {
      id: createdId, handle, updatedAt: initial.updatedAt,
      expectedDigest: originalDigest,
      values: { title: "META007 first writer " + nonce },
      status: "DRAFT",
    }));
  pendingWriters.push(first);
  let timeoutId;
  try {
    await Promise.race([
      firstMutationEntered,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() =>
          reject(new Error("First locked mutation did not start")), 15000);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
  const second = withMetaobjectEntryLock(SHOP, createdId, () =>
    saveMetaobjectEntry(admin, definition, {
      id: createdId, handle, updatedAt: initial.updatedAt,
      expectedDigest: originalDigest,
      values: { title: "META007 stale second writer " + nonce },
      status: "DRAFT",
    }));
  pendingWriters.push(second);
  // Queue a stale deletion while the first save is still holding the
  // cross-Worker PostgreSQL lock. A racing delete must not remove that save.
  const racingDelete = withMetaobjectEntryLock(SHOP, createdId, () =>
    removeMetaobjectEntry(admin, definition, {
      id: createdId, updatedAt: initial.updatedAt,
      expectedDigest: originalDigest,
      confirm: "DELETE_ENTRY:" + createdId + ":" + handle,
    }));
  pendingWriters.push(racingDelete);
  // The queued save and delete both begin while the first Shopify mutation
  // is paused. The separate staging transaction probe is not a browser test.
  await new Promise(resolve => setTimeout(resolve, 180));
  releaseFirstMutation();
  const settled = await Promise.allSettled([first, second, racingDelete]);
  assert.equal(settled[0].status, "fulfilled",
    "First writer did not complete: " + settled[0]?.reason?.message);
  assert.equal(settled[1].status, "rejected");
  assert.match(settled[1].reason?.message || "", /Entry changed.*Reload/);
  assert.equal(settled[2].status, "rejected",
    "Overlapping stale delete must never remove the first writer.");
  assert.match(settled[2].reason?.message || "", /Entry changed.*Reload|Reload and confirm/);

  const updated = await readMetaobjectEntry(admin, createdId, TYPE);
  assert.equal(updated.fields.find(x => x.key === "title")?.value,
    "META007 first writer " + nonce);
  assert.equal(updated.fields.find(x => x.key === "optional_qa_note")?.value,
    originalOptional);

  await assert.rejects(
    withMetaobjectEntryLock(SHOP, createdId, () =>
      removeMetaobjectEntry(admin, definition, {
        id: createdId, updatedAt: initial.updatedAt,
        expectedDigest: originalDigest,
        confirm: "DELETE_ENTRY:" + createdId + ":" + handle,
      })),
    /Entry changed.*Reload/,
  );

  const updatedDigest = await metaobjectEntryFingerprint(updated);
  await withMetaobjectEntryLock(SHOP, createdId, () =>
    saveMetaobjectEntry(admin, definition, {
      id: createdId, handle, updatedAt: updated.updatedAt,
      expectedDigest: updatedDigest,
      values: { optional_qa_note: "" },
      status: "DRAFT",
    }));
  const cleared = await readMetaobjectEntry(admin, createdId, TYPE);
  assert.equal(cleared.fields.find(x => x.key === "optional_qa_note")?.value, null);
  assert.equal(cleared.fields.find(x => x.key === "title")?.value,
    "META007 first writer " + nonce);

  const freshDigest = await metaobjectEntryFingerprint(cleared);
  await withMetaobjectEntryLock(SHOP, createdId, () =>
    removeMetaobjectEntry(admin, definition, {
      id: createdId, updatedAt: cleared.updatedAt,
      expectedDigest: freshDigest,
      confirm: "DELETE_ENTRY:" + createdId + ":" + handle,
    }));
  // Deletion is already confirmed by metaobjectDelete. Do not attempt a
  // second delete if the subsequent readback fails or is delayed.
  const removedId = createdId;
  createdId = null;
  assert.equal((await graph(admin,
    "#graphql\nquery Meta007Gone($id: ID!) { metaobject(id:$id) { id } }",
    { id: removedId })).metaobject, null);
  cleanupConfirmed = true;
  success = true;
  console.log(JSON.stringify({
    work_unit: "META-007", environment: "isolated-staging",
    result: "PASS",
    checks: [
      "staging_shop_and_app_identity", "dedicated_neon_endpoint",
      "separate_postgres_transaction_lock_contenders",
      "first_write_persisted", "stale_second_writer_rejected",
      "overlapping_stale_delete_rejected", "stale_delete_rejected",
      "omitted_sibling_preserved",
      "optional_clear_readback", "disposable_QA_cleanup",
    ],
    qualification: "This validates distinct Neon transactions with direct Shopify staging APIs; not Cloudflare cross-instance browser E2E.",
  }));
} finally {
  releaseFirstMutation?.();
  try {
    // Let any in-flight mutation/lock release before deleting the QA entry.
    await Promise.allSettled(pendingWriters);
    if (createdId) {
    // Exception cleanup is restricted to the exact disposable ID minted above.
    // Keep original error visible if Shopify cleanup itself also fails.
    try {
      const session = await prisma.session.findFirst({
        where: { shop: SHOP, isOnline: false },
        select: { accessToken: true },
      });
      if (!session?.accessToken) throw new Error("Staging session missing");
      const response = await fetch("https://" + SHOP + "/admin/api/2026-07/graphql.json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
        body: JSON.stringify({
          query: "mutation Meta007ProbeCleanup($id:ID!){ metaobjectDelete(id:$id) { deletedId userErrors { message } } }",
          variables: { id: createdId },
        }),
        signal: AbortSignal.timeout(30000),
      });
      const json = await response.json();
      if (!response.ok || json.errors?.length ||
          json.data?.metaobjectDelete?.deletedId !== createdId ||
          json.data.metaobjectDelete.userErrors?.length)
        throw new Error("Unconfirmed disposable QA cleanup");
      cleanupConfirmed = true;
    } catch {
      console.error("META-007 disposable QA entry cleanup failed for " + createdId + "; review exact staging entry.");
      throw new Error("META-007 cleanup failed after probe; manual staging review required.");
    }
    }
    if (!success && cleanupConfirmed)
      console.error("META-007 acceptance failed but disposable QA entry cleanup was confirmed.");
  } finally {
    await prisma.$disconnect();
  }
}
