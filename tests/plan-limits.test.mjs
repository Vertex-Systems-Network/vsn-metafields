import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import {
  PLANS,
  PRO_PLAN,
  PLAN_BY_ID,
  planFromSubscriptions,
} from "../app/billing-config.js";
import {
  getPlanEntitlement,
  assertPlanCount,
  assertListValue,
} from "../app/plan-limits.server.js";
import {
  featureJson,
  featureError,
  boundedJson,
} from "../app/feature-request.server.js";
import { previewImport, runImportChunk } from "../app/bulk-values.server.js";
import { exportValueCsv } from "../app/bulk-csv.js";
import { createHash } from "node:crypto";

const adminFor = (subscriptions) => ({
  graphql: async () =>
    Response.json({
      data: { currentAppInstallation: { activeSubscriptions: subscriptions } },
    }),
});
const starter = PLAN_BY_ID["starter-plan"];
test("tiers strictly increase capacity while preserving the current Pro contract", () => {
  assert.deepEqual(PRO_PLAN, {
    id: "pro-plan",
    name: "pro-plan",
    amount: 55,
    currencyCode: "USD",
    interval: "EVERY_30_DAYS",
    trialDays: 5,
  });
  for (const key of Object.keys(PLANS[0].limits)) {
    assert.ok(PLANS[0].limits[key] < PLANS[1].limits[key]);
    assert.ok(PLANS[1].limits[key] < PLANS[2].limits[key]);
  }
  assert.deepEqual(PLANS[2].limits, {
    importRows: 100,
    listItems: 128,
    metaobjectFields: 25,
  });
});
test("entitlements use actual ACTIVE Shopify names; cancelled tiers cannot increase limits", async () => {
  for (const plan of PLANS)
    assert.equal(
      (
        await getPlanEntitlement(
          adminFor([{ name: plan.name, status: "ACTIVE", test: true }]),
        )
      ).id,
      plan.id,
    );
  assert.equal(
    planFromSubscriptions([
      { name: "pro-plan", status: "CANCELLED" },
      { name: starter.name, status: "ACTIVE" },
    ]).id,
    starter.id,
  );
  assert.equal(
    planFromSubscriptions([{ name: "older-provider-plan", status: "ACTIVE" }])
      .id,
    "pro-plan",
  );
  assert.equal(
    planFromSubscriptions([{ name: "pro-plan", status: "PENDING" }]),
    null,
  );
  await assert.rejects(getPlanEntitlement(adminFor([])), /active plan/);
  for (const payload of [
    { errors: [{ message: "no" }] },
    { data: {} },
    { data: { currentAppInstallation: { activeSubscriptions: {} } } },
  ]) {
    await assert.rejects(
      getPlanEntitlement({ graphql: async () => Response.json(payload) }),
      /Could not verify/,
    );
  }
});
test("limits accept the boundary and deny overflow with an actionable 403", () => {
  for (const plan of PLANS)
    for (const [key, count] of Object.entries(plan.limits)) {
      assert.doesNotThrow(() => assertPlanCount(plan, key, count, "items"));
      assert.throws(
        () => assertPlanCount(plan, key, count + 1, "items"),
        (error) => error.code === "plan_limit" && error.status === 403,
      );
    }
  assert.doesNotThrow(() => assertListValue(starter, "boolean", "false"));
  assert.doesNotThrow(() =>
    assertListValue(
      starter,
      "list.single_line_text_field",
      JSON.stringify(Array(16).fill("a")),
    ),
  );
  assert.throws(
    () =>
      assertListValue(
        starter,
        "list.single_line_text_field",
        JSON.stringify(Array(17).fill("a")),
      ),
    /16 items/,
  );
  assert.throws(
    () => assertListValue(starter, "list.single_line_text_field", "{}"),
    /JSON list/,
  );
});

function serverRoute(file, deps) {
  const code = transformSync(
    readFileSync(new URL(`../app/routes/${file}`, import.meta.url), "utf8"),
    { format: "cjs", loader: "jsx" },
  ).code;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (id) => {
      if (!(id in deps)) throw new Error(`Unmocked dependency: ${id}`);
      return deps[id];
    },
    module,
    module.exports,
  );
  return module.exports;
}
const jsonRequest = (body) =>
  new Request("https://staging.invalid/app/api/metaobjects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const helpers = { featureJson, featureError, boundedJson };
const limits = { getPlanEntitlement, assertPlanCount, assertListValue };
test("actual metaobject route rejects over-limit definitions before any Shopify mutation", async () => {
  let writes = 0;
  const route = serverRoute("app.api.metaobjects.jsx", {
    "../shopify.server": {
      authenticate: {
        admin: async () => ({
          admin: adminFor([{ name: starter.name, status: "ACTIVE" }]),
        }),
      },
    },
    "../active-plan.server": {},
    "../plan-limits.server": limits,
    "../definitions.server": {
      graph: async () => ({
        metafieldDefinitionTypes: [{ name: "single_line_text_field" }],
      }),
    },
    "../metaobjects.server": {
      createMetaobjectDefinition: async () => {
        writes++;
        return { id: "saved" };
      },
    },
    "../feature-request.server": helpers,
  });
  const denied = await route.action({
    request: jsonRequest({
      action: "createDefinition",
      fields: Array(4).fill({}),
    }),
  });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "plan_limit");
  assert.equal(writes, 0);
  assert.equal(
    (
      await route.action({
        request: jsonRequest({
          action: "createDefinition",
          fields: Array(3).fill({}),
        }),
      })
    ).status,
    200,
  );
  assert.equal(writes, 1);
});
test("metadata editing and removal of existing larger definitions are preserved after downgrade", async () => {
  let edits = 0;
  const definition = {
    id: "gid://shopify/MetaobjectDefinition/1",
    type: "guide",
    editable: true,
    fieldDefinitions: Array(25).fill({
      key: "title",
      type: { name: "single_line_text_field" },
    }),
  };
  const route = serverRoute("app.api.metaobjects.jsx", {
    "../shopify.server": {
      authenticate: {
        admin: async () => ({
          admin: adminFor([{ name: starter.name, status: "ACTIVE" }]),
        }),
      },
    },
    "../active-plan.server": {},
    "../plan-limits.server": limits,
    "../definitions.server": {},
    "../metaobjects.server": {
      listMetaobjectDefinitions: async () => [definition],
      updateMetaobjectDefinition: async () => {
        edits++;
      },
      removeEmptyMetaobjectDefinition: async () => {
        edits++;
      },
    },
    "../feature-request.server": helpers,
  });
  for (const action of ["updateDefinition", "deleteDefinition"]) {
    assert.equal(
      (
        await route.action({
          request: jsonRequest({
            action,
            definitionId: definition.id,
            type: definition.type,
          }),
        })
      ).status,
      200,
    );
  }
  assert.equal(edits, 2);
});
test("actual value-save route denies an oversized list without writing or verifying references", async () => {
  let writes = 0;
  const definition = { type: "list.single_line_text_field" };
  const route = serverRoute("app.api.values.jsx", {
    "../shopify.server": {
      authenticate: {
        admin: async () => ({
          admin: adminFor([{ name: starter.name, status: "ACTIVE" }]),
        }),
      },
    },
    "../active-plan.server": {},
    "../plan-limits.server": limits,
    "../definitions.server": {},
    "../value-types": {},
    "../metafield-values.server": {
      findValueDefinition: async () => definition,
      readResourceValue: async () => null,
      validateValueInput: (_, __, ___, value) => value,
      verifyReferences: async () => {
        writes++;
      },
      mutateValue: async () => {
        writes++;
      },
    },
  });
  const body = new FormData();
  for (const [key, value] of Object.entries({
    actionType: "set",
    ownerType: "PRODUCT",
    ownerId: "gid://shopify/Product/1",
    namespace: "custom",
    key: "details",
    compareDigest: "",
    value: JSON.stringify(Array(17).fill("x")),
  }))
    body.set(key, value);
  const response = await route.action({
    request: new Request("https://staging.invalid/app/api/values", {
      method: "POST",
      body,
    }),
  });
  assert.equal(response.status, 403);
  assert.equal(writes, 0);
});
test("oversized preview and post-downgrade apply stop before DB claims or Shopify writes", async () => {
  const rows = Array.from({ length: 11 }, (_, i) => ({
    ownerType: "PRODUCT",
    ownerId: `gid://shopify/Product/${i + 1}`,
    namespace: "custom",
    key: "care",
    type: "single_line_text_field",
    value: "x",
    valid: true,
  }));
  await assert.rejects(
    previewImport({}, {}, "s.myshopify.com", exportValueCsv(rows), starter),
    /10 rows/,
  );
  const rowsJson = JSON.stringify(rows);
  const job = {
    id: "job",
    rowsJson,
    inputHash: createHash("sha256").update(rowsJson).digest("hex"),
  };
  const db = { metafieldJob: { findFirst: async () => job } };
  await assert.rejects(
    runImportChunk({}, db, "s.myshopify.com", { id: "job" }, starter),
    /10 rows/,
  );
});
