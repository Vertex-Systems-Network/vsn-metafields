import { metaobjectEntryFingerprint, verifyMetaobjectEntryFingerprint } from "../app/metaobject-entry-fingerprint.js";
import test from "node:test";
import assert from "node:assert/strict";
import { entryValuesForSave } from "../app/metaobject-entry-values.js";
import {
  merchantMetaobjectType,
  createMetaobjectDefinition,
  saveMetaobjectEntry,
  removeMetaobjectEntry,
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
      [{ name: "single_line_text_field", supportedValidations: [] }],
    ),
  );
});

test("public access widening requires exact consent even when the reported entry count is zero", async () => {
  let mutations = 0;
  const privateDefinition = {
    ...definition,
    access: { storefront: "NONE" },
    metaobjectsCount: 0,
  };
  const admin = {
    graphql: async (query, { variables }) => {
      mutations++;
      assert.match(query, /UpdateMerchantMetaobjectDefinition/);
      assert.equal(variables.definition.access.storefront, "PUBLIC_READ");
      return Response.json({
        data: {
          metaobjectDefinitionUpdate: {
            metaobjectDefinition: { id: definition.id, type: definition.type },
            userErrors: [],
          },
        },
      });
    },
  };
  for (const count of [0, 1])
    await assert.rejects(
      updateMetaobjectDefinition(
        admin,
        { ...privateDefinition, metaobjectsCount: count },
        { name: "FAQ", storefront: "PUBLIC_READ" },
      ),
      /Confirm public/,
    );
  assert.equal(mutations, 0);
  await updateMetaobjectDefinition(admin, privateDefinition, {
    name: "FAQ",
    storefront: "PUBLIC_READ",
    confirmPublicAccess: `PUBLIC_ACCESS:${definition.id}:${definition.type}`,
  });
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
                fields: [
                  { key: "question", value: "Old question" },
                  { key: "answer", value: "Old answer" },
                ],
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
                handle: mutation.handle,
                fields: mutation.fields
                  ? [
                      { key: "question", value: "Old question" },
                      { key: "answer", value: "Old answer" },
                    ].map((field) => {
                      const changed = mutation.fields.find(
                        (item) => item.key === field.key,
                      );
                      return changed
                        ? { ...field, value: changed.value === "" ? null : changed.value }
                        : field;
                    })
                  : [
                      { key: "question", value: "Old question" },
                      { key: "answer", value: "Old answer" },
                    ],
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
    values: { question: "Q" },
  });
  assert.deepEqual(mutation.fields, [{ key: "question", value: "Q" }]);
  assert.equal(mutation.values, undefined);
  await saveMetaobjectEntry(admin, definition, {
    id,
    updatedAt: "new",
    handle: "renamed",
    values: {},
  });
  assert.equal(mutation.fields, undefined);
  assert.equal(mutation.values, undefined);
  await saveMetaobjectEntry(admin, definition, {
    id,
    updatedAt: "new",
    handle: "one",
    values: { question: "Q", answer: "" },
  });
  assert.deepEqual(mutation.fields, [
    { key: "question", value: "Q" },
    { key: "answer", value: "" },
  ]);
  assert.equal(mutation.values, undefined);
  await assert.rejects(
    saveMetaobjectEntry(
      admin,
      {
        ...definition,
        fieldDefinitions: [
          ...definition.fieldDefinitions,
          { key: "details", name: "Details", type: { name: "json" } },
        ],
      },
      {
        id,
        updatedAt: "new",
        handle: "one",
        values: { question: "Q", answer: "" },
      },
    ),
    /native editor/,
  );
  await assert.rejects(
    saveMetaobjectEntry(admin, definition, {
      id,
      updatedAt: "new",
      handle: "one",
      values: { question: "" },
    }),
    /required/,
  );
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
  const admin = {
    graphql: async (query, { variables }) => {
      calls.push(query);
      if (query.includes("MetaobjectDefinitionRemovalState")) {
        assert.equal(variables.id, definition.id);
        return Response.json({
          data: {
            metaobjectDefinition: {
              id: definition.id,
              type: definition.type,
              metaobjects: { nodes: [], pageInfo: { hasNextPage: false } },
            },
          },
        });
      }
      if (query.includes("MetaobjectEntries")) {
        assert.equal(variables.type, definition.type);
        return Response.json({
          data: {
            metaobjects: { nodes: [], pageInfo: { hasNextPage: false } },
          },
        });
      }
      assert.match(query, /mutation DeleteEmptyMetaobjectDefinition/);
      return Response.json({
        data: {
          metaobjectDefinitionDelete: {
            deletedId: definition.id,
            userErrors: [],
          },
        },
      });
    },
  };
  await removeEmptyMetaobjectDefinition(
    admin,
    { ...definition, metaobjectsCount: 1 },
    `DELETE_EMPTY_DEFINITION:${definition.id}:${definition.type}`,
  );
  assert.equal(calls.length, 3);
});
test("definition deletion blocks nonempty, mismatched and malformed collection evidence before mutation", async () => {
  for (const scenario of [
    "direct populated",
    "type populated",
    "wrong id",
    "wrong type",
    "missing connection",
    "missing page info",
    "has next page",
  ]) {
    let mutations = 0;
    const admin = {
      graphql: async (query) => {
        if (query.includes("mutation")) {
          mutations++;
          throw new Error("must not mutate");
        }
        if (query.includes("MetaobjectDefinitionRemovalState"))
          return Response.json({
            data: {
              metaobjectDefinition: {
                id:
                  scenario === "wrong id"
                    ? "gid://shopify/MetaobjectDefinition/999"
                    : definition.id,
                type:
                  scenario === "wrong type" ? "another_type" : definition.type,
                metaobjects:
                  scenario === "missing connection"
                    ? null
                    : {
                        nodes:
                          scenario === "direct populated"
                            ? [{ id: "entry" }]
                            : [],
                        pageInfo:
                          scenario === "missing page info"
                            ? null
                            : { hasNextPage: scenario === "has next page" },
                      },
              },
            },
          });
        assert.match(query, /query MetaobjectEntries/);
        return Response.json({
          data: {
            metaobjects: {
              nodes: [{ id: "entry" }],
              pageInfo: { hasNextPage: false },
            },
          },
        });
      },
    };
    await assert.rejects(
      removeEmptyMetaobjectDefinition(
        admin,
        definition,
        `DELETE_EMPTY_DEFINITION:${definition.id}:${definition.type}`,
      ),
    );
    assert.equal(mutations, 0, scenario);
  }
});
test("entry edit sends only changed fields and preserves intentional clears", () => {
  const entry = {
    fields: [
      { key: "title", value: "Original" },
      { key: "note", value: "Keep me" },
    ],
  };
  assert.deepEqual(
    entryValuesForSave(entry, {
      title: "Changed",
      note: "Keep me",
    }),
    { title: "Changed" },
  );
  assert.deepEqual(
    entryValuesForSave(entry, {
      title: "Original",
      note: "",
    }),
    { note: "" },
  );
  assert.deepEqual(
    entryValuesForSave(entry, {
      title: "Original",
      note: "Keep me",
    }),
    {},
  );
  assert.deepEqual(entryValuesForSave(null, { title: "New" }), {
    title: "New",
  });
});


test("META-007: raw edited-field payload patches one key and preserves omitted sibling after Shopify readback", async () => {
  const id = "gid://shopify/Metaobject/1007";
  const savedState = {
    id,
    type: "vsn_faq",
    handle: "qa-guide",
    updatedAt: "version-1",
    fields: [
      { key: "question", value: "Original title" },
      { key: "answer", value: "Keep the optional note" },
    ],
  };
  const sent = [];
  const admin = {
    graphql: async (query, { variables } = {}) => {
      if (query.includes("SelectedMetaobject"))
        return Response.json({ data: { metaobject: { ...savedState, fields: [...savedState.fields] } } });
      assert.match(query, /UpdateMerchantMetaobject/);
      const input = variables.metaobject;
      sent.push(structuredClone(input));
      assert.equal(input.values, undefined, "Never replace all values for omitted field patches");
      if (input.fields)
        for (const field of input.fields) {
          const current = savedState.fields.find((f) => f.key === field.key);
          if (current) current.value = field.value;
        }
      savedState.handle = input.handle;
      savedState.updatedAt = "version-2";
      return Response.json({
        data: {
          metaobjectUpdate: {
            metaobject: {
              id,
              type: savedState.type,
              handle: savedState.handle,
              fields: savedState.fields,
            },
            userErrors: [],
          },
        },
      });
    },
  };
  const initial = structuredClone(savedState);
  const raw = entryValuesForSave(initial, {
    question: "Updated title",
    answer: "Keep the optional note",
  });
  assert.deepEqual(raw, { question: "Updated title" });
  await saveMetaobjectEntry(admin, definition, {
    id,
    updatedAt: initial.updatedAt,
    handle: initial.handle,
    values: raw,
    status: "DRAFT",
  });
  assert.deepEqual(sent[0].fields, [
    { key: "question", value: "Updated title" },
  ]);
  const readback = await (await admin.graphql("SelectedMetaobject")).json();
  assert.equal(readback.data.metaobject.fields.find((f) => f.key === "answer").value, "Keep the optional note");

  // A handle-only edit sends no field list or wholesale replacement object.
  await saveMetaobjectEntry(admin, definition, {
    id,
    updatedAt: savedState.updatedAt,
    handle: "qa-guide-new",
    values: {},
    status: "DRAFT",
  });
  assert.equal(sent[1].fields, undefined);
  assert.equal(sent[1].values, undefined);
  assert.equal(savedState.fields.find((f) => f.key === "answer").value, "Keep the optional note");
});

test("META-007: a stale second editor is rejected before Shopify mutation and preserves first writer", async () => {
  const id = "gid://shopify/Metaobject/1008";
  let updatedAt = "version-1";
  let question = "Original title";
  let mutations = 0;
  const admin = {
    graphql: async (query, { variables } = {}) => {
      if (query.includes("SelectedMetaobject"))
        return Response.json({
          data: { metaobject: { id, type: "vsn_faq", handle: "qa-guide", updatedAt, fields: [
            { key: "question", value: question },
            { key: "answer", value: "Untouched" },
          ] } },
        });
      assert.match(query, /UpdateMerchantMetaobject/);
      mutations++;
      question = variables.metaobject.fields[0].value;
      updatedAt = "version-2";
      return Response.json({
        data: { metaobjectUpdate: { metaobject: { id, type: "vsn_faq", handle: "qa-guide", fields: [
          { key: "question", value: question },
          { key: "answer", value: "Untouched" },
        ] }, userErrors: [] } },
      });
    },
  };
  const first = { id, updatedAt: "version-1", handle: "qa-guide", values: { question: "First writer" } };
  await saveMetaobjectEntry(admin, definition, first);
  await assert.rejects(
    saveMetaobjectEntry(admin, definition, { ...first, values: { question: "Stale second writer" } }),
    /Entry changed\. Reload before editing\./,
  );
  assert.equal(mutations, 1);
  assert.equal(question, "First writer");
  assert.equal(updatedAt, "version-2");
  // This is stale-preflight coverage, NOT atomic write concurrency: Shopify
  // metaobjectUpdate has no expected-updatedAt/compare-digest argument.
});


test("META-007 fingerprint is order-independent, tracks nulls and handle, and prevents same-second stale edits", async () => {
  const id = "gid://shopify/Metaobject/101";
  const at = "2026-10-17T08:40:00Z";
  let current = {
    id,
    type: "vsn_faq",
    handle: "qa",
    updatedAt: at,
    capabilities: { publishable: { status: "DRAFT" } },
    fields: [
      { key: "question", type: "single_line_text_field", value: "Before" },
      { key: "answer", type: "multi_line_text_field", value: null },
    ],
  };
  const firstDigest = await metaobjectEntryFingerprint(current);
  const reorderedDigest = await metaobjectEntryFingerprint({
    ...current,
    fields: [...current.fields].reverse(),
  });
  assert.equal(firstDigest, reorderedDigest);
  assert.notEqual(firstDigest, await metaobjectEntryFingerprint({
    ...current, handle: "renamed",
  }));
  assert.notEqual(firstDigest, await metaobjectEntryFingerprint({
    ...current,
    fields: current.fields.map((f) =>
      f.key === "answer" ? { ...f, value: "" } : f),
  }));

  let writes = 0;
  const admin = {
    graphql: async (query, { variables } = {}) => {
      if (query.includes("SelectedMetaobject"))
        return Response.json({ data: { metaobject: current } });
      assert.match(query, /UpdateMerchantMetaobject/);
      writes++;
      const patch = variables.metaobject.fields[0];
      current = {
        ...current,
        // Deliberately leave updatedAt unchanged: Shopify second precision.
        fields: current.fields.map((f) =>
          f.key === patch.key ? { ...f, value: patch.value } : f),
      };
      return Response.json({ data: { metaobjectUpdate: {
        metaobject: {
          id, type: current.type, handle: current.handle,
          fields: current.fields.map(({ key, value }) => ({ key, value })),
        },
        userErrors: [],
      } } });
    },
  };
  await saveMetaobjectEntry(admin, definition, {
    id, handle: "qa", status: "DRAFT",
    updatedAt: at, expectedDigest: firstDigest,
    values: { question: "First writer" },
  });
  assert.equal(current.updatedAt, at);
  assert.equal(writes, 1);
  await assert.rejects(
    saveMetaobjectEntry(admin, definition, {
      id, handle: "qa", status: "DRAFT",
      updatedAt: at, expectedDigest: firstDigest,
      values: { question: "Stale same-second writer" },
    }),
    /changed.*Reload/,
  );
  assert.equal(writes, 1);
  assert.equal(current.fields[0].value, "First writer");
  await assert.rejects(
    removeMetaobjectEntry(admin, definition, {
      id, updatedAt: at,
      expectedDigest: firstDigest,
      confirm: "DELETE_ENTRY:" + id + ":qa",
    }),
    /changed.*Reload/,
  );
});

test("META-007 missing or invalid snapshot fails closed", async () => {
  const original = {
    id: "gid://shopify/Metaobject/101",
    type: "vsn_faq",
    handle: "qa",
    fields: [{ key: "question", type: "single_line_text_field", value: "OK" }],
  };
  await assert.rejects(
    verifyMetaobjectEntryFingerprint(original, "bad"),
    /Reload/,
  );
});
