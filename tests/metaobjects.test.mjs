import test from "node:test";
import assert from "node:assert/strict";
import {
  merchantMetaobjectType,
  createMetaobjectDefinition,
  saveMetaobjectEntry,
  removeEmptyMetaobjectDefinition,
  updateMetaobjectDefinition,
} from "../app/metaobjects.server.js";
const definition = {
  id: "gid://shopify/MetaobjectDefinition/1",
  type: "vsn_faq",
  fieldDefinitions: [
    {
      key: "question",
      name: "Question",
      type: { name: "single_line_text_field" },
      required: true,
    },
    {
      key: "answer",
      name: "Answer",
      type: { name: "multi_line_text_field" },
      required: false,
    },
  ],
  capabilities: { publishable: { enabled: true } },
  access: { storefront: "PUBLIC_READ" },
  metaobjectsCount: 0,
};
test("metaobject management denies app/Shopify-owned types and malformed definition fields", async () => {
  for (const type of [
    "$app:faq",
    "app--1--faq",
    "shopify--faq",
    "bad type",
    "A",
  ])
    assert.throws(() => merchantMetaobjectType(type));
  await assert.rejects(
    createMetaobjectDefinition(
      {},
      {
        name: "FAQ",
        type: "vsn_faq",
        fields: [{ key: "x", name: "X", type: "bad" }],
      },
      ["single_line_text_field"],
    ),
  );
});

test("public access widening requires exact consent even when the reported entry count is zero", async () => {
  let mutations = 0;
  const privateDefinition = {...definition, access:{storefront:"NONE"}, metaobjectsCount:0};
  const admin = {graphql: async (query, {variables}) => {
    mutations++;
    assert.match(query, /UpdateMerchantMetaobjectDefinition/);
    assert.equal(variables.definition.access.storefront, "PUBLIC_READ");
    return Response.json({data: {metaobjectDefinitionUpdate: {
      metaobjectDefinition: {id:definition.id, type:definition.type}, userErrors:[],
    }}});
  }};
  for (const count of [0,1]) await assert.rejects(updateMetaobjectDefinition(admin,
    {...privateDefinition,metaobjectsCount:count}, {name:"FAQ",storefront:"PUBLIC_READ"}), /Confirm public/);
  assert.equal(mutations, 0);
  await updateMetaobjectDefinition(admin, privateDefinition, {name:"FAQ",storefront:"PUBLIC_READ",
    confirmPublicAccess:`PUBLIC_ACCESS:${definition.id}:${definition.type}`});
  assert.equal(mutations, 1);
});
test("entry create validates required fields, exact publication consent and returned identity", async () => {
  let sent;
  const admin = {
    graphql: async (_, opts) => {
      sent = opts.variables.metaobject;
      return {
        json: async () => ({
          data: {
            metaobjectCreate: {
              metaobject: {
                id: "gid://shopify/Metaobject/1",
                type: "vsn_faq",
                handle: sent.handle,
                fields: sent.fields,
              },
              userErrors: [],
            },
          },
        }),
      };
    },
  };
  const input = {
    handle: "one",
    status: "DRAFT",
    values: { question: "Question", answer: "Answer" },
  };
  const result = await saveMetaobjectEntry(admin, definition, input);
  assert.equal(result.type, "vsn_faq");
  assert.equal(sent.capabilities.publishable.status, "DRAFT");
  await assert.rejects(
    saveMetaobjectEntry(admin, definition, { ...input, status: "ACTIVE" }),
    /Confirm public/,
  );
  await assert.rejects(
    saveMetaobjectEntry(admin, definition, {
      ...input,
      values: { answer: "A" },
    }),
    /required/,
  );
  await assert.rejects(
    saveMetaobjectEntry(admin, definition, {
      ...input,
      values: { secret: "A" },
    }),
    /match/,
  );
});
test("metadata entry edits preserve omitted fields and reject stale timestamps", async () => {
  let mutation;
  const id = "gid://shopify/Metaobject/1";
  const admin = {
    graphql: async (query, opts) => ({
      json: async () => {
        if (query.includes("SelectedMetaobject"))
          return {
            data: {
              metaobject: {
                id,
                type: "vsn_faq",
                updatedAt: "new",
                handle: "one",
              },
            },
          };
        mutation = opts.variables.metaobject;
        return {
          data: {
            metaobjectUpdate: {
              metaobject: {
                id,
                type: "vsn_faq",
                handle: "one",
                fields: mutation.fields,
              },
              userErrors: [],
            },
          },
        };
      },
    }),
  };
  await assert.rejects(
    saveMetaobjectEntry(admin, definition, {
      id,
      updatedAt: "old",
      handle: "one",
      values: { question: "Q" },
    }),
    /changed/,
  );
  await saveMetaobjectEntry(admin, definition, {
    id,
    updatedAt: "new",
    handle: "one",
    values: { question: "Q", answer: "" },
  });
  assert.deepEqual(mutation.fields, [{ key: "question", value: "Q" }]);
  assert.equal(mutation.values, undefined);
});
test("unconfirmed definition removal stops before any GraphQL read or mutation", async () => {
  let calls = 0;
  await assert.rejects(
    removeEmptyMetaobjectDefinition(
      {
        graphql: () => {
          calls++;
        },
      },
      { ...definition, metaobjectsCount: 1 },
      "DELETE_EMPTY_DEFINITION",
    ),
    /empty/,
  );
  assert.equal(calls, 0);
});

test("empty deletion verifies both actual collections despite a stale reported count", async () => {
  const calls = [];
  const admin = {graphql: async (query, {variables}) => {
    calls.push(query);
    if (query.includes("MetaobjectDefinitionRemovalState")) {
      assert.equal(variables.id, definition.id);
      return Response.json({data: {metaobjectDefinition: {
        id: definition.id, type: definition.type,
        metaobjects: {nodes: [], pageInfo: {hasNextPage: false}},
      }}});
    }
    if (query.includes("MetaobjectEntries")) {
      assert.equal(variables.type, definition.type);
      return Response.json({data: {metaobjects: {nodes: [], pageInfo: {hasNextPage: false}}}});
    }
    assert.match(query, /mutation DeleteEmptyMetaobjectDefinition/);
    return Response.json({data: {metaobjectDefinitionDelete: {deletedId: definition.id, userErrors: []}}});
  }};
  await removeEmptyMetaobjectDefinition(admin, {...definition, metaobjectsCount: 1},
    `DELETE_EMPTY_DEFINITION:${definition.id}:${definition.type}`);
  assert.equal(calls.length, 3);
});
test("definition deletion blocks nonempty, mismatched and malformed collection evidence before mutation", async () => {
  for (const scenario of ["direct populated", "type populated", "wrong id", "wrong type", "missing connection", "missing page info", "has next page"]) {
    let mutations = 0;
    const admin = {graphql: async (query) => {
      if (query.includes("mutation")) {mutations++; throw new Error("must not mutate");}
      if (query.includes("MetaobjectDefinitionRemovalState")) return Response.json({data: {metaobjectDefinition: {
        id: scenario === "wrong id" ? "gid://shopify/MetaobjectDefinition/999" : definition.id,
        type: scenario === "wrong type" ? "another_type" : definition.type,
        metaobjects: scenario === "missing connection" ? null : {
          nodes: scenario === "direct populated" ? [{id:"entry"}] : [],
          pageInfo: scenario === "missing page info" ? null : {hasNextPage: scenario === "has next page"},
        },
      }}});
      assert.match(query, /query MetaobjectEntries/);
      return Response.json({data: {metaobjects: {nodes: [{id:"entry"}], pageInfo: {hasNextPage: false}}}});
    }};
    await assert.rejects(removeEmptyMetaobjectDefinition(admin, definition,
      `DELETE_EMPTY_DEFINITION:${definition.id}:${definition.type}`));
    assert.equal(mutations, 0, scenario);
  }
});
