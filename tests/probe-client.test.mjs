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
