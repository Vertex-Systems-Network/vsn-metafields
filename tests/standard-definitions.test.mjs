import assert from "node:assert/strict";
import test from "node:test";
import {
  getStandardTemplates,
  getStandardTemplatePage,
  enableStandardTemplate,
} from "../app/standard-definitions.server.js";

const product = {
  id: "gid://shopify/StandardMetafieldDefinitionTemplate/1",
  name: "Subtitle",
  namespace: "descriptors",
  key: "subtitle",
  ownerTypes: ["PRODUCT"],
};
const variant = {
  id: "gid://shopify/StandardMetafieldDefinitionTemplate/2",
  name: "Variant",
  namespace: "facts",
  key: "variant",
  ownerTypes: ["PRODUCTVARIANT"],
};

test("catalog paginates and filters templates by selected resource", async () => {
  const cursors = [];
  const admin = {
    graphql: async (_, { variables }) => {
      cursors.push(variables.after);
      const second = Boolean(variables.after);
      return {
        json: async () => ({
          data: {
            standardMetafieldDefinitionTemplates: {
              nodes: second ? [variant] : [product],
              pageInfo: {
                hasNextPage: !second,
                endCursor: second ? null : "page2",
              },
            },
          },
        }),
      };
    },
  };
  assert.deepEqual(await getStandardTemplates(admin, "PRODUCT"), [product]);
  assert.deepEqual(cursors, [null, "page2"]);
});

test("standard enable never mutates a template belonging to another owner", async () => {
  const admin = {
    graphql: () => {
      throw Error("Unexpected mutation");
    },
  };
  assert.equal(
    (await enableStandardTemplate(admin, [product], "COLLECTION", product.id))
      .status,
    400,
  );
});

test("standard enable requires confirmed Shopify definition and no user errors", async () => {
  const calls = [];
  const admin = {
    graphql: async (query, options) => {
      calls.push({ query, options });
      return {
        json: async () => ({
          data: {
            standardMetafieldDefinitionEnable: {
              createdDefinition: {
                id: "gid://shopify/MetafieldDefinition/11",
                name: "Subtitle",
                namespace: "descriptors",
                key: "subtitle",
                ownerType: "PRODUCT",
              },
              userErrors: [],
            },
          },
        }),
      };
    },
  };
  assert.equal(
    (await enableStandardTemplate(admin, [product], "PRODUCT", product.id)).ok,
    true,
  );
  assert.equal(calls[0].options.variables.ownerType, "PRODUCT");
  assert.equal(calls[0].options.variables.storefront, "NONE");
  assert.match(calls[0].query, /access: \{ storefront: \$storefront \}/);
  const denied = {
    graphql: async () => ({
      json: async () => ({
        data: {
          standardMetafieldDefinitionEnable: {
            userErrors: [{ message: "Permission denied" }],
          },
        },
      }),
    }),
  };
  assert.equal(
    (await enableStandardTemplate(denied, [product], "PRODUCT", product.id)).ok,
    false,
  );
});

test("catalog fails closed when cursor stops advancing", async () => {
  const admin = {
    graphql: async () => ({
      json: async () => ({
        data: {
          standardMetafieldDefinitionTemplates: {
            nodes: [product],
            pageInfo: { hasNextPage: true, endCursor: null },
          },
        },
      }),
    }),
  };
  await assert.rejects(
    getStandardTemplates(admin, "PRODUCT"),
    /pagination did not advance/,
  );
});

test("interactive catalog fetches exactly one page even when 86 further pages remain", async () => {
  const calls = [];
  const admin = {
    graphql: async (query, { variables }) => {
      calls.push({ query, variables });
      return Response.json({
        data: {
          standardMetafieldDefinitionTemplates: {
            nodes: [product, variant],
            pageInfo: { hasNextPage: true, endCursor: "page-2" },
          },
        },
      });
    },
  };
  const page = await getStandardTemplatePage(admin, "PRODUCT");
  assert.equal(calls.length, 1);
  assert.match(calls[0].query, /first: 250/);
  assert.deepEqual(page.templates, [{ ...product, catalogCursor: "" }]);
  assert.deepEqual(page.pageInfo, { hasNextPage: true, endCursor: "page-2" });
  const next = await getStandardTemplatePage(admin, "PRODUCT", "page-1");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].variables.after, "page-1");
  assert.equal(next.templates[0].catalogCursor, "page-1");
});

test("interactive catalog rejects invalid cursors and malformed or denied responses", async () => {
  const noCall = {
    graphql: () => {
      throw Error("Unexpected GraphQL request");
    },
  };
  await assert.rejects(
    getStandardTemplatePage(noCall, "PRODUCT", "x".repeat(2049)),
    /Invalid/,
  );
  await assert.rejects(
    getStandardTemplatePage(noCall, "MEDIA_IMAGE"),
    /deprecated/,
  );
  for (const payload of [
    { data: {} },
    {
      data: {
        standardMetafieldDefinitionTemplates: { nodes: {}, pageInfo: {} },
      },
    },
    { errors: [{ message: "Access denied" }] },
  ])
    await assert.rejects(
      getStandardTemplatePage(
        { graphql: async () => Response.json(payload) },
        "PRODUCT",
      ),
    );
});
