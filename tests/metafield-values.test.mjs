import assert from "node:assert/strict";
import test from "node:test";
import { validateValueInput, mutateValue, readResourceValue } from "../app/metafield-values.server.js";

const definition = { namespace: "vsn_metafields", key: "care", type: "single_line_text_field" };
const productId = "gid://shopify/Product/123";

test("value validation ties owner GID, definition namespace and supported type together", () => {
  assert.equal(validateValueInput("PRODUCT", productId, definition, "Care instructions"), "Care instructions");
  assert.throws(() => validateValueInput("COLLECTION", productId, definition, "Care"), /Resource/);
  assert.throws(() => validateValueInput("PRODUCT", productId, { ...definition, namespace: "app--123--private" }, "Care"), /definition/);
  assert.equal(validateValueInput("PRODUCT", productId, { ...definition, type: "json" }, "{}"), "{}");
});

test("typed values reject malformed integer, boolean, calendar date and unsafe URL", () => {
  for (const [type, value] of [
    ["number_integer", "1.2"], ["boolean", "yes"], ["date", "2026-02-30"], ["url", "javascript:alert(1)"],
  ]) {
    assert.throws(() => validateValueInput("PRODUCT", productId, { ...definition, type }, value), RangeError);
  }
  assert.equal(validateValueInput("PRODUCT", productId, { ...definition, type: "boolean" }, "false"), "false");
});

test("product, variant and collection values enforce owner identity during read and write", async () => {
  for (const [ownerType, shopifyType] of [
    ["PRODUCT", "Product"],
    ["PRODUCTVARIANT", "ProductVariant"],
    ["COLLECTION", "Collection"],
  ]) {
    const ownerId = `gid://shopify/${shopifyType}/123`;
    const value = validateValueInput(ownerType, ownerId, definition, "Care");
    assert.equal(value, "Care");
    const admin = { graphql: async (_, { variables }) => ({ json: async () => ({
      data: variables.id
        ? { node: { __typename: shopifyType, id: ownerId, metafield: { value } } }
        : { metafieldsSet: { metafields: [{
          id: "gid://shopify/Metafield/1", owner: { id: ownerId },
          namespace: definition.namespace, key: definition.key,
          type: definition.type, value,
        }], userErrors: [] } },
    }) }) };
    assert.equal((await readResourceValue(admin, ownerType, ownerId, definition.namespace, definition.key)).value, value);
    assert.equal((await mutateValue(admin, { action: "set", ownerId, definition, value })).ok, true);
    const wrongOwnerId = `gid://shopify/${shopifyType === "Product" ? "Collection" : "Product"}/456`;
    assert.throws(() => validateValueInput(ownerType, wrongOwnerId, definition, value), /Resource/);
    await assert.rejects(() => readResourceValue(admin, ownerType, wrongOwnerId, definition.namespace, definition.key), /Resource/);
  }
});

test("set sends only selected identity and type, and rejects Shopify errors", async () => {
  let input;
  const admin = { graphql: async (_, options) => {
    input = options.variables.metafields[0];
    return { json: async () => ({ data: { metafieldsSet: { metafields: [{ ...input, owner:{id:input.ownerId}, id: "gid://shopify/Metafield/1" }], userErrors: [] } } }) };
  } };
  assert.equal((await mutateValue(admin, { action: "set", ownerId: productId, definition, value: "Care" })).ok, true);
  assert.deepEqual(input, { ownerId: productId, namespace: "vsn_metafields", key: "care", type: "single_line_text_field", value: "Care" });
  const denied = { graphql: async () => ({ json: async () => ({ data: { metafieldsSet: { userErrors: [{ message: "Denied" }] } } }) }) };
  assert.equal((await mutateValue(denied, { action: "set", ownerId: productId, definition, value: "Care" })).ok, false);
});

test("delete confirms exactly the selected owner/namespace/key", async () => {
  const admin = { graphql: async (_, options) => ({ json: async () => ({ data: { metafieldsDelete: {
    deletedMetafields: [options.variables.metafields[0]], userErrors: [],
  } } }) }) };
  assert.equal((await mutateValue(admin, { action: "delete", ownerId: productId, definition })).ok, true);
  const mismatch = { graphql: async () => ({ json: async () => ({ data: { metafieldsDelete: {
    deletedMetafields: [{ ownerId: "another", namespace: "vsn_metafields", key: "care" }], userErrors: [],
  } } }) }) };
  assert.equal((await mutateValue(mismatch, { action: "delete", ownerId: productId, definition })).ok, false);
});
