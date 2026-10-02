import test from "node:test";
import assert from "node:assert/strict";
import { featureDiagnostics } from "../app/diagnostics.server.js";
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
