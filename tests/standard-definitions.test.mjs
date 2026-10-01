import assert from "node:assert/strict";
import test from "node:test";
import { getStandardTemplates, enableStandardTemplate } from "../app/standard-definitions.server.js";

const product = { id: "gid://shopify/StandardMetafieldDefinitionTemplate/1", name: "Subtitle", namespace: "descriptors", key: "subtitle", ownerTypes: ["PRODUCT"] };
const variant = { id: "gid://shopify/StandardMetafieldDefinitionTemplate/2", name: "Variant", namespace: "facts", key: "variant", ownerTypes: ["PRODUCTVARIANT"] };

test("catalog paginates and filters templates by selected resource", async () => {
  const cursors = [];
  const admin = { graphql: async (_, { variables }) => {
    cursors.push(variables.after);
    const second = Boolean(variables.after);
    return { json: async () => ({ data: { standardMetafieldDefinitionTemplates: {
      nodes: second ? [variant] : [product], pageInfo: { hasNextPage: !second, endCursor: second ? null : "page2" },
    } } }) };
  } };
  assert.deepEqual(await getStandardTemplates(admin, "PRODUCT"), [product]);
  assert.deepEqual(cursors, [null, "page2"]);
});

test("standard enable never mutates a template belonging to another owner", async () => {
  const admin = { graphql: () => { throw Error("Unexpected mutation"); } };
  assert.equal((await enableStandardTemplate(admin, [product], "COLLECTION", product.id)).status, 400);
});

test("standard enable requires confirmed Shopify definition and no user errors", async () => {
  const calls = [];
  const admin = { graphql: async (query, options) => {
    calls.push({ query, options });
    return { json: async () => ({ data: { standardMetafieldDefinitionEnable: {
      createdDefinition: { id: "gid://shopify/MetafieldDefinition/11", name: "Subtitle" }, userErrors: [],
    } } }) };
  } };
  assert.equal((await enableStandardTemplate(admin, [product], "PRODUCT", product.id)).ok, true);
  assert.equal(calls[0].options.variables.ownerType, "PRODUCT");
  assert.match(calls[0].query, /visibleToStorefrontApi:\s*true/);
  const denied = { graphql: async () => ({ json: async () => ({ data: { standardMetafieldDefinitionEnable: {
    userErrors: [{ message: "Permission denied" }],
  } } }) }) };
  assert.equal((await enableStandardTemplate(denied, [product], "PRODUCT", product.id)).ok, false);
});

test("catalog fails closed when cursor stops advancing", async () => {
  const admin = { graphql: async () => ({ json: async () => ({ data: { standardMetafieldDefinitionTemplates: {
    nodes: [product], pageInfo: { hasNextPage: true, endCursor: null },
  } } }) }) };
  await assert.rejects(getStandardTemplates(admin, "PRODUCT"), /pagination did not advance/);
});
