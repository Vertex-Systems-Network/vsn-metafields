import test from "node:test";
import assert from "node:assert/strict";
import {
  merchantMetaobjectType,
  createMetaobjectDefinition,
  saveMetaobjectEntry,
  removeEmptyMetaobjectDefinition,
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
test("populated definition removal stops before any GraphQL mutation", async () => {
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
