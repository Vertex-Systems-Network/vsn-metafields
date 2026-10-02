import test from "node:test";
import assert from "node:assert/strict";
import { featureDiagnostics } from "../app/diagnostics.server.js";
import { requestReferencePermission } from "../app/permission-client.js";
test("diagnostics separate granted permissions from paid entitlement and optional scope gaps", async () => {
  const admin = {
    graphql: async () => ({
      json: async () => ({
        data: {
          currentAppInstallation: {
            accessScopes: [
              { handle: "write_products" },
              { handle: "write_metaobjects" },
              { handle: "write_metaobject_definitions" },
            ],
          },
          shop: { primaryDomain: { url: "https://example.com" } },
        },
      }),
    }),
  };
  const result = await featureDiagnostics(admin, false, {
    database: "reachable",
    environment: "staging",
  });
  assert.deepEqual(result.features.values.missing, []);
  assert.deepEqual(result.features.metaobjects.missing, []);
  assert.equal(result.features.metaobjects.ready, false);
  assert.deepEqual(result.features.fileReferences.missing, ["read_files"]);
  assert.equal(result.steps.find((s) => s.id === "theme").done, false);
  assert.doesNotMatch(
    JSON.stringify(result),
    /accessToken|DATABASE_URL|secret/i,
  );
});

test("optional reference requests ask only for the selected configured read scope", async () => {
  const requested = [];
  const shopify = {
    scopes: {
      query: async () => ({
        granted: ["write_products"],
        optional: ["read_content", "read_files"],
      }),
      request: async (scopes) => {
        requested.push(scopes);
        return { result: "granted-all" };
      },
    },
  };
  assert.equal(
    await requestReferencePermission(shopify, "pageReferences"),
    "granted",
  );
  assert.equal(
    await requestReferencePermission(shopify, "fileReferences"),
    "granted",
  );
  assert.deepEqual(requested, [["read_content"], ["read_files"]]);
});
test("declined, unconfigured, unsupported and already-granted scopes never become false readiness", async () => {
  let calls = 0;
  const shopify = {
    scopes: {
      query: async () => ({
        granted: ["read_content"],
        optional: ["read_files"],
      }),
      request: async () => {
        calls++;
        return { result: "declined-all" };
      },
    },
  };
  assert.equal(
    await requestReferencePermission(shopify, "pageReferences"),
    "already-granted",
  );
  assert.equal(calls, 0);
  assert.equal(
    await requestReferencePermission(shopify, "fileReferences"),
    "declined",
  );
  assert.equal(calls, 1);
  await assert.rejects(
    requestReferencePermission(shopify, "customers"),
    /supported reference/,
  );
  await assert.rejects(
    requestReferencePermission({}, "fileReferences"),
    /inside Shopify Admin/,
  );
  shopify.scopes.query = async () => ({ granted: [], optional: [] });
  await assert.rejects(
    requestReferencePermission(shopify, "fileReferences"),
    /not available/,
  );
  assert.equal(calls, 1);
});
test("verified granted page and file scopes make their pickers ready under an ACTIVE plan", async () => {
  const admin = {
    graphql: async () =>
      Response.json({
        data: {
          currentAppInstallation: {
            accessScopes: [
              { handle: "read_content" },
              { handle: "read_files" },
            ],
          },
          shop: {},
        },
      }),
  };
  const result = await featureDiagnostics(admin, true);
  assert.equal(result.features.pageReferences.ready, true);
  assert.equal(result.features.fileReferences.ready, true);
});
