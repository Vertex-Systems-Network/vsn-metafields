import test from "node:test";
import assert from "node:assert/strict";
import { probeGraphql, failedRunDisposableDefinition } from "../scripts/metafields/probe-client.mjs";

test("probe retries only fully rejected Shopify throttles with bounded wait", async () => {
  let calls = 0;
  const waits = [];
  const response = await probeGraphql(async () => Response.json(++calls === 1 ? {
    errors: [{ extensions: { code: "THROTTLED" } }],
    extensions: { cost: { requestedQueryCost: 100, throttleStatus: { currentlyAvailable: 0, restoreRate: 50 } } },
  } : { data: { saved: true } }), async (ms) => waits.push(ms));
  assert.deepEqual(await response.json(), { data: { saved: true } });
  assert.equal(calls, 2);
  assert.deepEqual(waits, [2000]);
});

test("probe never replays ambiguous/partial/error mutations and stops after four rejections", async () => {
  for (const payload of [{ data: { saved: true }, errors: [{ extensions: { code: "THROTTLED" } }] }, { errors: [{ message: "Denied" }] }]) {
    let calls = 0;
    await probeGraphql(async () => { calls++; return Response.json(payload); });
    assert.equal(calls, 1);
  }
  let transportCalls = 0;
  await assert.rejects(probeGraphql(async () => { transportCalls++; throw new Error("timeout"); }), /timeout/);
  assert.equal(transportCalls, 1);
  let throttles = 0;
  await probeGraphql(async () => { throttles++; return Response.json({ errors: [{ extensions: { code: "THROTTLED" } }] }); }, async () => {});
  assert.equal(throttles, 4);
});

test("failed-run recovery selects only disposable definitions inside the observed failure window", () => {
  const field = {namespace: "vsn_probe", name: "Disposable dimension", type: "dimension", key: `advanced_${Date.parse("2026-10-02T10:23:15Z")}_abcdef_11`};
  assert.equal(failedRunDisposableDefinition(field), true);
  for (const patch of [{namespace: "custom"}, {name: "Merchant dimension"}, {key: "advanced_1_abcdef_11"}, {key: `advanced_${Date.parse("2026-10-02T10:24:15Z")}_abcdef_11`}, {key: field.key + "_extra"}]) assert.equal(failedRunDisposableDefinition({...field, ...patch}), false);
});

test("reference cleanup requires disposable identity and confirms exact deleted definition", async () => {
  const {removeDisposableProbeDefinition} = await import("../scripts/metafields/advanced-probe.mjs");
  const nonce = "1790936595000_abcdef";
  const field = {id: "gid://shopify/MetafieldDefinition/12", namespace: "vsn_probe", key: `advanced_${nonce}_16`, name: "Disposable product_reference", type: "product_reference"};
  let calls = 0;
  const admin = {graphql: async (query, {variables}) => {
    calls++;
    assert.match(query, /deleteAllAssociatedMetafields: true/);
    assert.equal(variables.id, field.id);
    return Response.json({data: {metafieldDefinitionDelete: {deletedDefinitionId: field.id, userErrors: []}}});
  }};
  assert.equal((await removeDisposableProbeDefinition(admin, field, nonce)).ok, true);
  for (const patch of [{namespace: "custom"}, {name: "Merchant reference"}, {key: "merchant_reference"}]) {
    await assert.rejects(removeDisposableProbeDefinition(admin, {...field, ...patch}, nonce), /identity/);
  }
  assert.equal(calls, 1);
});

test("probe waits for empty count convergence without retrying deletion or accepting populated definitions", async () => {
  const { readEmptyProbeDefinition } = await import("../scripts/metafields/advanced-probe.mjs");
  const identity = { id: "gid://shopify/MetaobjectDefinition/12", type: "vsn_probe_1790936595000_abcdef" };
  let reads = 0, populated = false, countStuck = false;
  const waits = [];
  const admin = { graphql: async (query) => {
    if (query.includes("MetaobjectManager")) return Response.json({data: {metaobjectDefinitions: {
      nodes: [{...identity, metaobjectsCount: countStuck || ++reads === 1 ? 1 : 0}],
      pageInfo: {hasNextPage: false},
    }}});
    assert.match(query, /query MetaobjectEntries/);
    return Response.json({data: {metaobjects: {nodes: populated ? [{id:"entry"}] : [], pageInfo: {hasNextPage: false}}}});
  }};
  assert.equal((await readEmptyProbeDefinition(admin, identity, async (ms) => waits.push(ms))).metaobjectsCount, 0);
  assert.deepEqual(waits, [1000]);
  populated = true;
  await assert.rejects(readEmptyProbeDefinition(admin, identity, async () => {}), /still has entries/);
  populated = false; countStuck = true;
  await assert.rejects(readEmptyProbeDefinition(admin, identity, async () => {}), /did not converge/);
  await assert.rejects(readEmptyProbeDefinition(admin, {...identity, type:"merchant_faq"}), /Disposable/);
});
