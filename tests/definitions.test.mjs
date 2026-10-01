import test from "node:test";
import assert from "node:assert/strict";
import {
  OWNER_TYPES,
  requireOwnerType,
  validateNamespace,
  storefrontAccess,
} from "../app/metafield-capabilities.js";
import {
  getDefinitions,
  getCapabilities,
  createDefinition,
  updateDefinition,
  parseValidations,
} from "../app/definitions.server.js";
const reply = (data) => ({ json: async () => ({ data }) });
const field = {
  id: "gid://shopify/MetafieldDefinition/1",
  name: "Care",
  namespace: "custom",
  key: "care",
  ownerType: "PRODUCT",
  type: { name: "single_line_text_field" },
  access: { storefront: "NONE" },
  pinnedPosition: null,
};
const typeInfo = {
  name: "list.product_reference",
  supportedValidations: [{ name: "list.max", type: "number_integer" }],
};
const input = {
  name: "Related",
  namespace: "custom",
  key: "related",
  type: typeInfo.name,
  validations: '[{"name":"list.max","value":"5"}]',
};
test("owner registry covers pinned inventory and rejects deprecated/unknown owners", () => {
  assert.equal(OWNER_TYPES.length, 26);
  assert.equal(new Set(OWNER_TYPES).size, 26);
  for (const owner of OWNER_TYPES.filter((x) => x !== "MEDIA_IMAGE"))
    assert.equal(requireOwnerType(owner), owner);
  assert.throws(() => requireOwnerType("MEDIA_IMAGE"));
  assert.throws(() => requireOwnerType("INVENTED"));
});
test("custom namespaces preserve identity and protected owners cannot become public", () => {
  assert.equal(validateNamespace("custom"), "custom");
  assert.equal(validateNamespace(), "vsn_metafields");
  for (const ns of [
    "app--123--private",
    "shopify",
    "$app",
    "a",
    "bad.namespace",
  ])
    assert.throws(() => validateNamespace(ns));
  assert.equal(storefrontAccess("PRODUCT", "PUBLIC_READ"), "PUBLIC_READ");
  assert.throws(() => storefrontAccess("CUSTOMER", "PUBLIC_READ"));
  assert.throws(() => storefrontAccess("PRODUCT", "WRITE"));
});
test("pagination returns all namespaces, keeps selected owner and marks app namespaces read-only", async () => {
  const calls = [];
  const admin = {
    graphql: async (_, { variables }) => {
      calls.push(variables);
      return reply({
        metafieldDefinitions: {
          nodes: [
            variables.after
              ? { ...field, id: "2", namespace: "app--123--protected" }
              : field,
          ],
          pageInfo: {
            hasNextPage: !variables.after,
            endCursor: variables.after ? null : "next",
          },
        },
      });
    },
  };
  const fields = await getDefinitions(admin, "PRODUCT");
  assert.equal(fields.length, 2);
  assert.equal(fields[0].editable, true);
  assert.equal(fields[1].editable, false);
  assert.deepEqual(calls, [
    { ownerType: "PRODUCT", after: null },
    { ownerType: "PRODUCT", after: "next" },
  ]);
});
test("scope discovery reports granted scopes without claiming mutation verification", async () => {
  const admin = {
    graphql: async (query) =>
      reply(
        query.includes("DefinitionCapabilities")
          ? {
              metafieldDefinitionTypes: [typeInfo],
              currentAppInstallation: {
                accessScopes: [{ handle: "read_products" }],
              },
            }
          : {
              metafieldDefinitions: {
                nodes: [],
                pageInfo: { hasNextPage: false },
              },
            },
      ),
  };
  const result = await getCapabilities(admin, "PRODUCT");
  assert.deepEqual(result.scopes, ["read_products"]);
  assert.equal(result.definitionRead, "verified");
  assert.equal(result.definitionWrite, "shopify_authorizes_each_mutation");
  assert.equal(result.types[0].name, typeInfo.name);
});
test("access denial and stalled cursors fail closed", async () => {
  await assert.rejects(
    getDefinitions(
      {
        graphql: async () => ({
          json: async () => ({ errors: [{ message: "Access denied" }] }),
        }),
      },
      "CUSTOMER",
    ),
    /Access denied/,
  );
  await assert.rejects(
    getDefinitions(
      {
        graphql: async () =>
          reply({
            metafieldDefinitions: {
              nodes: [],
              pageInfo: { hasNextPage: true, endCursor: null },
            },
          }),
      },
      "PRODUCT",
    ),
    /advance/,
  );
});
test("dynamic list/reference type creates with valid rules and private default", async () => {
  let definition;
  const admin = {
    graphql: async (_, { variables }) => {
      if (!variables.definition)
        return reply({ metafieldDefinitionTypes: [typeInfo] });
      definition = variables.definition;
      return reply({
        metafieldDefinitionCreate: {
          createdDefinition: {
            id: "1",
            namespace: definition.namespace,
            key: definition.key,
            ownerType: definition.ownerType,
          },
          userErrors: [],
        },
      });
    },
  };
  assert.equal((await createDefinition(admin, "PRODUCT", input)).ok, true);
  assert.equal(definition.type, "list.product_reference");
  assert.equal(definition.access.storefront, "NONE");
  assert.deepEqual(definition.validations, [{ name: "list.max", value: "5" }]);
});
test("unknown types/rules and duplicate validations are rejected before mutation", async () => {
  let mutations = 0;
  const admin = {
    graphql: async (_, { variables }) => {
      if (variables.definition) mutations++;
      return reply({ metafieldDefinitionTypes: [typeInfo] });
    },
  };
  await assert.rejects(
    createDefinition(admin, "PRODUCT", { ...input, type: "imaginary" }),
  );
  await assert.rejects(
    createDefinition(admin, "PRODUCT", {
      ...input,
      validations: '[{"name":"unsupported","value":"x"}]',
    }),
  );
  assert.equal(mutations, 0);
  assert.throws(() =>
    parseValidations(
      '[{"name":"list.max","value":"5"},{"name":"list.max","value":"6"}]',
      typeInfo,
    ),
  );
});
test("create does not report success for a mismatched Shopify identity", async () => {
  const admin = {
    graphql: async (_, { variables }) =>
      reply(
        variables.definition
          ? {
              metafieldDefinitionCreate: {
                createdDefinition: {
                  id: "1",
                  namespace: "another",
                  key: "related",
                  ownerType: "PRODUCT",
                },
              },
            }
          : { metafieldDefinitionTypes: [typeInfo] },
      ),
  };
  assert.equal((await createDefinition(admin, "PRODUCT", input)).ok, false);
});
test("metadata edit cannot rewrite type/namespace/key or cross definition identity", async () => {
  let definition;
  const admin = {
    graphql: async (_, options) => {
      definition = options.variables.definition;
      return reply({
        metafieldDefinitionUpdate: {
          updatedDefinition: { id: field.id },
          userErrors: [],
        },
      });
    },
  };
  assert.equal(
    (
      await updateDefinition(admin, "PRODUCT", [{ ...field, editable: true }], {
        id: field.id,
        key: "care",
        namespace: "custom",
        name: "New name",
        type: "json",
      })
    ).ok,
    true,
  );
  assert.equal(definition.type, undefined);
  assert.equal(definition.namespace, "custom");
  assert.equal(definition.key, "care");
  assert.equal(
    (
      await updateDefinition(admin, "PRODUCT", [{ ...field, editable: true }], {
        id: field.id,
        key: "care",
        namespace: "other",
        name: "Wrong",
      })
    ).ok,
    false,
  );
});
