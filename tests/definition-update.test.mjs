import assert from "node:assert/strict";
import test from "node:test";
import { renameDefinition } from "../app/definition-update.server.js";

const fields = [{ id: "gid://shopify/MetafieldDefinition/1", key: "care", namespace: "vsn_metafields" }];

test("rename keeps namespace/key/owner identity and changes only the name", async () => {
  let input;
  const admin = { graphql: async (_, { variables }) => {
    input = variables.definition;
    return { json: async () => ({ data: { metafieldDefinitionUpdate: {
      updatedDefinition: { id: fields[0].id, name: "Care guide" }, userErrors: [],
    } } }) };
  } };
  assert.equal((await renameDefinition(admin, fields, "PRODUCT", { ...fields[0], name: " Care guide " })).ok, true);
  assert.deepEqual(input, { namespace: "vsn_metafields", key: "care", ownerType: "PRODUCT", name: "Care guide" });
});

test("wrong identity, empty name and Shopify errors cannot succeed", async () => {
  const admin = { graphql: () => { throw Error("Unexpected mutation"); } };
  assert.equal((await renameDefinition(admin, fields, "PRODUCT", { id: "other", key: "care", name: "Good" })).status, 404);
  assert.equal((await renameDefinition(admin, fields, "PRODUCT", { ...fields[0], name: " " })).status, 400);
  const denied = { graphql: async () => ({ json: async () => ({ data: { metafieldDefinitionUpdate: {
    userErrors: [{ message: "Permission denied" }],
  } } }) }) };
  assert.equal((await renameDefinition(denied, fields, "PRODUCT", { ...fields[0], name: "Good" })).ok, false);
});
