import assert from "node:assert/strict";
import test from "node:test";
import { removeDefinition } from "../app/definition-removal.server.js";

const fields = [{ id: "gid://shopify/MetafieldDefinition/1", key: "care" }];

test("deletes only the selected owner-scoped definition and retains values", async () => {
  let call;
  const admin = { graphql: async (query, options) => {
    call = { query, options };
    return { json: async () => ({ data: { metafieldDefinitionDelete: {
      deletedDefinitionId: fields[0].id, userErrors: [],
    } } }) };
  } };
  assert.deepEqual(await removeDefinition(admin, fields, fields[0]), { ok: true });
  assert.equal(call.options.variables.id, fields[0].id);
  assert.match(call.query, /deleteAllAssociatedMetafields:\s*false/);
});

test("wrong ID or key never calls Shopify deletion", async () => {
  const admin = { graphql: () => { throw Error("Unexpected mutation"); } };
  for (const selected of [{ id: "other", key: "care" }, { id: fields[0].id, key: "other" }]) {
    assert.equal((await removeDefinition(admin, fields, selected)).status, 404);
  }
});

test("Shopify errors and unexpected deleted ID do not report success", async () => {
  for (const payload of [
    { errors: [{ message: "Permission denied" }] },
    { data: { metafieldDefinitionDelete: { userErrors: [{ message: "In use" }] } } },
    { data: { metafieldDefinitionDelete: { deletedDefinitionId: "other", userErrors: [] } } },
  ]) {
    const admin = { graphql: async () => ({ json: async () => payload }) };
    assert.equal((await removeDefinition(admin, fields, fields[0])).ok, false);
  }
});
