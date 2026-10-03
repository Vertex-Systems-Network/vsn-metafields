import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build, transformSync } from "esbuild";
import { createRequire } from "node:module";
import React from "react";
import process from "node:process";
import { createHmac } from "node:crypto";
import { resolve } from "node:path";
import {
  definitionKey,
  fieldTypeOption,
  filterDefinitions,
  mergeTemplatePage,
} from "../app/field-presentation.js";
import {
  getStandardTemplatePage,
  enableStandardTemplate,
} from "../app/standard-definitions.server.js";
import { hasActivePlan } from "../app/active-plan.server.js";
import * as capabilities from "../app/metafield-capabilities.js";
import { selectPosition } from "../app/select-position.js";
import {
  updateDefinition,
  createDefinition,
} from "../app/definitions.server.js";
import { createMetaobjectDefinition } from "../app/metaobjects.server.js";

const require = createRequire(import.meta.url);
const template = {
  id: "gid://shopify/StandardMetafieldDefinitionTemplate/1",
  name: "Subtitle",
  namespace: "descriptors",
  key: "subtitle",
  ownerTypes: ["PRODUCT"],
  type: { name: "single_line_text_field" },
};
function fieldsRoute(admin) {
  const code = transformSync(
    readFileSync(resolve("app/routes/app.api.fields.jsx"), "utf8"),
    { loader: "jsx", format: "cjs" },
  ).code;
  const deps = {
    "../shopify.server": { authenticate: { admin: async () => ({ admin }) } },
    "../active-plan.server": { hasActivePlan },
    "../metafield-capabilities.js": capabilities,
    "../definitions.server.js": {
      getDefinitions: () => {
        throw Error("Interactive catalog must not enumerate definitions");
      },
    },
    "../standard-definitions.server.js": {
      getStandardTemplatePage,
      enableStandardTemplate,
    },
    "../definition-removal.server.js": {},
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (id) => {
      assert.ok(id in deps, id);
      return deps[id];
    },
    module,
    module.exports,
  );
  return module.exports;
}
function catalogAdmin() {
  const calls = [];
  return {
    calls,
    graphql: async (query, { variables } = {}) => {
      calls.push({ query, variables });
      if (query.includes("MetafieldAccessSubscription"))
        return Response.json({
          data: {
            currentAppInstallation: {
              activeSubscriptions: [{ status: "ACTIVE" }],
            },
          },
        });
      if (query.includes("StandardMetafieldCatalog"))
        return Response.json({
          data: {
            standardMetafieldDefinitionTemplates: {
              nodes: [template],
              pageInfo: { hasNextPage: true, endCursor: "next-page" },
            },
          },
        });
      if (query.includes("EnableStandardMetafield"))
        return Response.json({
          data: {
            standardMetafieldDefinitionEnable: {
              createdDefinition: {
                id: "gid://shopify/MetafieldDefinition/9",
                name: "Subtitle",
                namespace: "descriptors",
                key: "subtitle",
                ownerType: "PRODUCT",
              },
              userErrors: [],
            },
          },
        });
      throw Error("Unexpected query");
    },
  };
}
test("actual catalog loader has a two-GraphQL-call budget and returns a continuation cursor", async () => {
  const admin = catalogAdmin();
  const response = await fieldsRoute(admin).loader({
    request: new Request(
      "https://staging.invalid/app/api/fields?ownerType=PRODUCT&catalog=standard&after=prior-page",
    ),
  });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(admin.calls.length, 2);
  assert.equal(admin.calls[1].variables.after, "prior-page");
  assert.equal(data.templates[0].catalogCursor, "prior-page");
  assert.equal(data.pageInfo.endCursor, "next-page");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
test("actual standard enable revalidates only the selected catalog page before mutation", async () => {
  const admin = catalogAdmin();
  const form = new FormData();
  for (const [key, value] of Object.entries({
    actionType: "enable-standard",
    ownerType: "PRODUCT",
    templateId: template.id,
    templateCursor: "selected-page",
    namespace: "tampered",
    key: "tampered",
  }))
    form.set(key, value);
  const response = await fieldsRoute(admin).action({
    request: new Request("https://staging.invalid/app/api/fields", {
      method: "POST",
      body: form,
    }),
  });
  assert.equal((await response.json()).success, true);
  assert.equal(admin.calls.length, 3);
  assert.equal(admin.calls[1].variables.after, "selected-page");
  assert.deepEqual(admin.calls[2].variables, {
    id: template.id,
    ownerType: "PRODUCT",
    storefront: "NONE",
  });
});
test("actual standard action refuses forged template IDs or different owners without mutation", async () => {
  for (const input of [
    {
      ownerType: "PRODUCT",
      templateId: "gid://shopify/StandardMetafieldDefinitionTemplate/99999",
    },
    { ownerType: "COLLECTION", templateId: template.id },
  ]) {
    const admin = catalogAdmin(),
      form = new FormData();
    for (const [key, value] of Object.entries({
      actionType: "enable-standard",
      ...input,
    }))
      form.set(key, value);
    const response = await fieldsRoute(admin).action({
      request: new Request("https://staging.invalid/app/api/fields", {
        method: "POST",
        body: form,
      }),
    });
    assert.equal(response.status, 400);
    assert.equal(admin.calls.length, 2);
    assert.ok(admin.calls.every(({ query }) => !query.includes("mutation")));
  }
});
test("signed staging acceptance exercises two bounded catalog pages inside one Worker invocation", async () => {
  const original = {
    url: process.env.SHOPIFY_APP_URL,
    secret: process.env.SHOPIFY_API_SECRET,
  };
  process.env.SHOPIFY_APP_URL =
    "https://vsn-metafields-staging.vertexsystemsnetwork.workers.dev";
  process.env.SHOPIFY_API_SECRET = "synthetic-contract-secret";
  try {
    const calls = [];
    const admin = {
      graphql: async (query, { variables } = {}) => {
        calls.push({ query, variables });
        if (query.includes("StagingAcceptance"))
          return Response.json({
            data: { currentAppInstallation: { activeSubscriptions: [] } },
          });
        return Response.json({
          data: {
            standardMetafieldDefinitionTemplates: {
              nodes: [template],
              pageInfo: {
                hasNextPage: true,
                endCursor: variables.after ? "page3" : "page2",
              },
            },
          },
        });
      },
    };
    const code = transformSync(
      readFileSync(
        resolve("app/routes/internal.staging-acceptance.jsx"),
        "utf8",
      ),
      { format: "cjs", loader: "jsx" },
    ).code;
    const deps = {
      "node:process": process,
      "../shopify.server": {
        sessionStorage: {
          findSessionsByShop: async () => [{ isOnline: false }],
        },
        unauthenticated: {
          admin: async () => ({ admin, session: { isOnline: false } }),
        },
      },
      "../standard-definitions.server.js": { getStandardTemplatePage },
    };
    const module = { exports: {} };
    new Function("require", "module", "exports", code)(
      (id) => deps[id],
      module,
      module.exports,
    );
    const shop = "staging-contract.myshopify.com",
      timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", process.env.SHOPIFY_API_SECRET)
      .update(`${timestamp}\n${shop}\n/internal/staging-acceptance`)
      .digest("hex");
    const request = new Request(
      `${process.env.SHOPIFY_APP_URL}/internal/staging-acceptance`,
      {
        headers: {
          "X-VSN-Shop": shop,
          "X-VSN-Timestamp": timestamp,
          "X-VSN-Signature": signature,
        },
      },
    );
    const response = await module.exports.loader({ request });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.standardCatalog, {
      ok: true,
      pagesRead: 2,
      firstPageMatches: 1,
      nextPageMatches: 1,
      hasMore: true,
    });
    assert.equal(calls.length, 3);
    assert.equal(calls[2].variables.after, "page2");
    calls.length = 0;
    const denied = await module.exports.loader({
      request: new Request(request.url, {
        headers: {
          "X-VSN-Shop": shop,
          "X-VSN-Timestamp": timestamp,
          "X-VSN-Signature": "0".repeat(64),
        },
      }),
    });
    assert.equal(denied.status, 401);
    assert.equal(calls.length, 0);
  } finally {
    if (original.url === undefined) delete process.env.SHOPIFY_APP_URL;
    else process.env.SHOPIFY_APP_URL = original.url;
    if (original.secret === undefined) delete process.env.SHOPIFY_API_SECRET;
    else process.env.SHOPIFY_API_SECRET = original.secret;
  }
});
test("key suggestions and grouped labels preserve Shopify identities and safe key limits", () => {
  assert.equal(definitionKey("Care instructions"), "care_instructions");
  assert.equal(definitionKey("Été / Summer – 2026"), "ete_summer_2026");
  assert.equal(definitionKey("A"), "a_field");
  assert.equal(definitionKey("x".repeat(100)).length, 64);
  assert.equal(definitionKey("!!!"), "");
  assert.deepEqual(fieldTypeOption({ name: "list.metaobject_reference" }), {
    value: "list.metaobject_reference",
    label: "Metaobject",
    group: "Reference",
    icon: "reference",
    badge: "List",
    keywords: "list.metaobject_reference",
  });
  const unknown = fieldTypeOption({
    name: "new_shopify_type",
    category: "Other",
  });
  assert.equal(unknown.value, "new_shopify_type");
});
test("combined filters and catalog continuation cannot mix owner pages or hide later loaded items", () => {
  const fields = [
    {
      name: "Care",
      namespace: "custom",
      key: "care",
      type: "single_line_text_field",
      storefront: "PUBLIC_READ",
    },
    {
      name: "Care",
      namespace: "private",
      key: "care",
      type: "number_integer",
      storefront: "NONE",
    },
  ];
  assert.deepEqual(
    filterDefinitions(fields, {
      search: " CUSTOM.CARE ",
      access: "PUBLIC_READ",
      type: "single_line_text_field",
    }),
    [fields[0]],
  );
  assert.equal(
    filterDefinitions(fields, {
      access: "NONE",
      type: "single_line_text_field",
    }).length,
    0,
  );
  const first = {
    ownerType: "PRODUCT",
    cursor: "",
    templates: [{ id: "one" }],
    pageInfo: { hasNextPage: true, endCursor: "page2" },
  };
  const second = {
    ownerType: "PRODUCT",
    cursor: "page2",
    templates: [{ id: "one" }, { id: "two" }],
    pageInfo: { hasNextPage: false },
  };
  const result = mergeTemplatePage(
    mergeTemplatePage({ ownerType: "", templates: [] }, first),
    second,
  );
  assert.deepEqual(result.templates, [{ id: "one" }, { id: "two" }]);
  assert.deepEqual(
    mergeTemplatePage(result, { ...first, ownerType: "COLLECTION" }).templates,
    first.templates,
  );
  assert.deepEqual(mergeTemplatePage(result, first).templates, first.templates);
});

// Execute real component handlers with deterministic hook storage. This is
// event/state regression evidence, not a browser, focus or visual certificate.
async function componentHarness(path, fetchers = [], exportName = "default") {
  const code = (
    await build({
      entryPoints: [resolve(path)],
      bundle: true,
      platform: "node",
      format: "cjs",
      jsx: "automatic",
      write: false,
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react-router",
        "prop-types",
        "../shopify.server",
        "@shopify/shopify-app-react-router/server",
      ],
    })
  ).outputFiles[0].text;
  const states = [],
    refs = [],
    effects = [],
    cleanups = [];
  let hook = 0,
    refIndex = 0,
    fetcherIndex = 0;
  const hooks = {
    ...React,
    useId: () => "test-select",
    useState: (initial) => {
      const i = hook++;
      if (!(i in states))
        states[i] = typeof initial === "function" ? initial() : initial;
      return [
        states[i],
        (value) => {
          states[i] = typeof value === "function" ? value(states[i]) : value;
        },
      ];
    },
    useRef: () => (refs[refIndex++] ||= { current: null }),
    useEffect: (fn) => effects.push(fn),
    useCallback: (fn) => fn,
    useContext: (context) => context._currentValue,
  };
  const router = {
    useLocation: () => ({
      search: "?shop=example.myshopify.com&host=embedded",
      pathname: "/app",
    }),
    useFetcher: () => ({
      state: "idle",
      load: () => {},
      submit: () => {},
      ...fetchers[fetcherIndex++],
    }),
    Link: "a",
    NavLink: "a",
    useNavigation: () => ({ state: "idle" }),
    useFetchers: () => [],
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (id) =>
      id === "react"
        ? hooks
        : id === "react-router"
          ? router
          : id === "../shopify.server"
            ? { authenticate: {} }
            : id === "@shopify/shopify-app-react-router/server"
              ? { boundary: {} }
              : require(id),
    module,
    module.exports,
  );
  return {
    refs,
    flushEffects: () => {
      for (const fn of effects.splice(0)) {
        const cleanup = fn();
        if (cleanup) cleanups.push(cleanup);
      }
    },
    cleanup: () => {
      for (const fn of cleanups.splice(0)) fn();
    },
    render: (props = {}) => {
      hook = 0;
      refIndex = 0;
      fetcherIndex = 0;
      return module.exports[exportName](props);
    },
  };
}
function allNodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(allNodes);
  return [tree, ...allNodes(tree.props?.children)];
}
function node(tree, predicate) {
  const result = allNodes(tree).find(predicate);
  assert.ok(result, "Expected component node");
  return result;
}
test("real definition form auto-generates a key, preserves manual overrides and resets after owner changes", async () => {
  const h = await componentHarness("app/routes/app._index.jsx", [
    { data: { ok: true, hasActivePlan: true } },
    {
      data: {
        ok: true,
        ownerType: "PRODUCT",
        scopes: [],
        fields: [],
        types: [{ name: "single_line_text_field" }],
      },
    },
  ]);
  let tree = h.render();
  const byLabel = (label) => node(tree, (item) => item.props?.label === label);
  byLabel("Name").props.onInput({
    currentTarget: { value: "Care instructions" },
  });
  tree = h.render();
  assert.equal(byLabel("Key").props.value, "care_instructions");
  byLabel("Key").props.onInput({ currentTarget: { value: "manual_key" } });
  tree = h.render();
  byLabel("Name").props.onInput({ currentTarget: { value: "New field name" } });
  tree = h.render();
  assert.equal(byLabel("Key").props.value, "manual_key");
  node(
    tree,
    (item) => item.props?.children === "Use key from name",
  ).props.onClick();
  tree = h.render();
  assert.equal(byLabel("Key").props.value, "new_field_name");
  byLabel("Metafield resource").props.onChange("COLLECTION");
  tree = h.render();
  assert.equal(byLabel("Key").props.value, "");
  byLabel("Name").props.onInput({
    currentTarget: { value: "Collection note" },
  });
  tree = h.render();
  assert.equal(byLabel("Key").props.value, "collection_note");
});
test("real searchable select filters groups, selects by keyboard and prevents disabled choices", async () => {
  const h = await componentHarness("app/components/SearchableSelect.jsx");
  const selections = [],
    props = {
      label: "Type",
      value: "text",
      onChange: (value) => selections.push(value),
      options: [
        {
          value: "text",
          label: "Single line text",
          group: "Text",
          icon: "text",
        },
        { value: "integer", label: "Integer", group: "Number", icon: "number" },
        { value: "old", label: "Old number", group: "Number", disabled: true },
      ],
    };
  let tree = h.render(props);
  node(
    tree,
    (item) => item.props?.className === "vsn-select-trigger",
  ).props.onClick();
  tree = h.render(props);
  node(tree, (item) => item.props?.role === "combobox").props.onChange({
    target: { value: "number" },
  });
  tree = h.render(props);
  assert.equal(
    allNodes(tree).filter((item) => item.props?.role === "option").length,
    2,
  );
  node(
    tree,
    (item) => item.props?.role === "option" && item.props["aria-disabled"],
  ).props.onClick();
  assert.equal(selections.length, 0);
  node(tree, (item) => item.props?.role === "combobox").props.onKeyDown({
    key: "Enter",
    preventDefault: () => {},
  });
  assert.deepEqual(selections, ["integer"]);
  tree = h.render(props);
  assert.equal(
    node(tree, (item) => item.props?.className === "vsn-select-trigger").props[
      "aria-expanded"
    ],
    false,
  );
});

test("searchable select keyboard order follows displayed groups and keeps a selected later option visible", async () => {
  const h = await componentHarness("app/components/SearchableSelect.jsx");
  let selected;
  const props = {
    label: "Type",
    value: "text",
    onChange: (value) => {
      selected = value;
    },
    options: [
      { value: "text", label: "Text", group: "Text" },
      { value: "number", label: "Integer", group: "Number" },
      { value: "rich", label: "Rich text", group: "Text" },
    ],
  };
  let tree = h.render(props);
  node(
    tree,
    (item) => item.props?.className === "vsn-select-trigger",
  ).props.onClick();
  tree = h.render(props);
  node(tree, (item) => item.props?.role === "combobox").props.onKeyDown({
    key: "ArrowDown",
    preventDefault: () => {},
  });
  tree = h.render(props);
  node(tree, (item) => item.props?.role === "combobox").props.onKeyDown({
    key: "Enter",
    preventDefault: () => {},
  });
  assert.equal(selected, "rich");
  const later = {
    ...props,
    value: "250",
    options: Array.from({ length: 300 }, (_, i) => ({
      value: String(i),
      label: `Template ${i}`,
    })),
  };
  tree = h.render(later);
  node(
    tree,
    (item) => item.props?.className === "vsn-select-trigger",
  ).props.onClick();
  tree = h.render(later);
  assert.equal(
    allNodes(tree).filter((item) => item.props?.role === "option").length,
    200,
  );
  assert.equal(
    node(
      tree,
      (item) => item.props?.role === "option" && item.props["aria-selected"],
    ).props.children[1].props.children,
    "Template 250",
  );
});

test("overlay geometry flips above, fits narrow screens and remains anchored below when space permits", () => {
  const below = selectPosition(
    { left: 50, width: 900, top: 300, bottom: 332 },
    1200,
    900,
  );
  assert.deepEqual(below, { left: 50, width: 460, maxHeight: 420, top: 338 });
  const above = selectPosition(
    { left: 100, width: 220, top: 750, bottom: 782 },
    1000,
    850,
  );
  assert.equal(above.bottom, 106);
  assert.equal(above.top, undefined);
  const narrow = selectPosition(
    { left: 280, width: 250, top: 200, bottom: 232 },
    320,
    640,
  );
  assert.equal(narrow.width, 250);
  assert.equal(narrow.left, 62);
  assert.ok(narrow.left + narrow.width <= 312);
  const full = selectPosition(
    { left: 10, width: 600, top: 110, bottom: 142 },
    320,
    350,
  );
  assert.equal(full.width, 304);
  assert.equal(full.left, 8);
  assert.equal(full.maxHeight, 194);
});

test("visible validation controls encode choices and preserve unrelated rules; malformed JSON stays repairable", async () => {
  const h = await componentHarness("app/components/ValidationEditor.jsx");
  let value = JSON.stringify([{ name: "max", value: "20" }]);
  const props = {
    type: "single_line_text_field",
    supported: [
      { name: "min" },
      { name: "max" },
      { name: "choices", type: "list.single_line_text_field" },
    ],
    onChange: (v) => {
      value = v;
    },
  };
  let tree = h.render({ ...props, value });
  const controls = allNodes(tree).filter(
    (n) => n.type === "input" || n.type === "textarea",
  );
  controls[0].props.onChange({ target: { value: "0" } });
  assert.deepEqual(JSON.parse(value), [
    { name: "max", value: "20" },
    { name: "min", value: "0" },
  ]);
  tree = h.render({ ...props, value });
  allNodes(tree)
    .filter((n) => n.type === "textarea")[0]
    .props.onChange({ target: { value: "Red\nBlue" } });
  assert.equal(
    JSON.parse(value).find((v) => v.name === "choices").value,
    '["Red","Blue"]',
  );
  tree = h.render({ ...props, value: "bad JSON" });
  assert.ok(node(tree, (n) => n.props?.role === "alert"));
  assert.equal(node(tree, (n) => n.type === "input").props.disabled, true);
  assert.equal(
    allNodes(tree)
      .filter((n) => n.type === "textarea")
      .at(-1).props.disabled,
    false,
  );
});

test("actual definition edit loads stored rules and sends them without changing immutable identity", async () => {
  const field = {
    id: "gid://shopify/MetafieldDefinition/3",
    name: "Care",
    namespace: "custom",
    key: "care",
    type: "single_line_text_field",
    editable: true,
    validations: [{ name: "max", value: "20" }],
  };
  let sent;
  const h = await componentHarness("app/routes/app._index.jsx", [
    { data: { ok: true, hasActivePlan: true } },
    {
      data: {
        ok: true,
        ownerType: "PRODUCT",
        scopes: [],
        fields: [field],
        types: [{ name: field.type, supportedValidations: [{ name: "max" }] }],
      },
    },
    {},
    {
      submit: (form) => {
        sent = Object.fromEntries(form.entries());
      },
    },
  ]);
  let tree = h.render();
  node(tree, (n) => n.props?.children === "Edit").props.onClick();
  tree = h.render();
  const editor = node(tree, (n) => n.type?.name === "ValidationEditor");
  assert.equal(editor.props.value, JSON.stringify(field.validations));
  editor.props.onChange('[{"name":"max","value":"30"}]');
  tree = h.render();
  node(tree, (n) => n.props?.children === "Save definition").props.onClick();
  assert.equal(sent.actionType, "update");
  assert.equal(sent.validations, '[{"name":"max","value":"30"}]');
  assert.equal(sent.key, "care");
  assert.equal(sent.namespace, "custom");
});

test("definition validation update is checked against server-owned types and can explicitly clear rules", async () => {
  const field = {
    id: "gid://shopify/MetafieldDefinition/3",
    key: "care",
    namespace: "custom",
    type: "single_line_text_field",
    editable: true,
  };
  const mutations = [];
  const admin = {
    graphql: async (query, { variables } = {}) => {
      if (query.includes("UpdateDefinitionValidationTypes"))
        return Response.json({
          data: {
            metafieldDefinitionTypes: [
              { name: field.type, supportedValidations: [{ name: "max" }] },
            ],
          },
        });
      mutations.push(variables.definition);
      return Response.json({
        data: {
          metafieldDefinitionUpdate: {
            updatedDefinition: { id: field.id },
            userErrors: [],
          },
        },
      });
    },
  };
  const input = {
    id: field.id,
    key: field.key,
    namespace: field.namespace,
    name: "Care",
    type: "number_integer",
  };
  await assert.rejects(
    updateDefinition(admin, "PRODUCT", [field], {
      ...input,
      validations: '[{"name":"forged","value":"1"}]',
    }),
    /supported/,
  );
  assert.equal(mutations.length, 0);
  assert.equal(
    (
      await updateDefinition(admin, "PRODUCT", [field], {
        ...input,
        validations: '[{"name":"max","value":"30"}]',
      })
    ).ok,
    true,
  );
  assert.deepEqual(mutations[0].validations, [{ name: "max", value: "30" }]);
  assert.equal(mutations[0].type, undefined);
  await updateDefinition(admin, "PRODUCT", [field], {
    ...input,
    validations: "[]",
  });
  assert.deepEqual(mutations[1].validations, []);
});

test("metafield and metaobject creation reject duplicate/unsupported validation rules before mutation", async () => {
  const type = {
    name: "single_line_text_field",
    supportedValidations: [{ name: "max" }],
  };
  let writes = 0;
  const admin = {
    graphql: async (query) => {
      if (query.includes("mutation")) writes++;
      return Response.json({ data: { metafieldDefinitionTypes: [type] } });
    },
  };
  for (const rules of [
    [{ name: "bad", value: "x" }],
    [
      { name: "max", value: "1" },
      { name: "max", value: "2" },
    ],
  ]) {
    await assert.rejects(
      createDefinition(admin, "PRODUCT", {
        name: "Care",
        namespace: "custom",
        key: "care",
        type: type.name,
        validations: JSON.stringify(rules),
      }),
    );
    await assert.rejects(
      createMetaobjectDefinition(
        admin,
        {
          name: "FAQ",
          type: "merchant_faq",
          fields: [
            {
              key: "answer",
              name: "Answer",
              type: type.name,
              validations: rules,
            },
          ],
        },
        [type],
      ),
    );
  }
  assert.equal(writes, 0);
  let actual;
  const okAdmin = {
    graphql: async (_, opts) => {
      actual = opts.variables.definition;
      return Response.json({
        data: {
          metaobjectDefinitionCreate: {
            metaobjectDefinition: {
              id: "gid://shopify/MetaobjectDefinition/3",
              type: "merchant_faq",
            },
            userErrors: [],
          },
        },
      });
    },
  };
  await createMetaobjectDefinition(
    okAdmin,
    {
      name: "FAQ",
      type: "merchant_faq",
      fields: [
        {
          key: "answer",
          name: "Answer",
          type: type.name,
          validations: [{ name: "max", value: "30" }],
        },
      ],
    },
    [type],
  );
  assert.deepEqual(actual.fieldDefinitions[0].validations, [
    { name: "max", value: "30" },
  ]);
});

test("desktop collapse and mobile disclosure are independent and navigation closes the mobile menu", async () => {
  const h = await componentHarness(
    "app/components/Workspace.jsx",
    [],
    "Workspace",
  );
  let tree = h.render();
  const button = (name) =>
    allNodes(tree).find(
      (n) => n.type === "button" && n.props.className === name,
    );
  button("vsn-sidebar-collapse").props.onClick();
  tree = h.render();
  assert.match(tree.props.className, /is-collapsed/);
  assert.equal(
    button("vsn-sidebar-collapse").props["aria-label"],
    "Expand navigation",
  );
  assert.equal(button("vsn-sidebar-collapse").props["aria-expanded"], false);
  button("vsn-sidebar-toggle").props.onClick();
  tree = h.render();
  assert.equal(button("vsn-sidebar-toggle").props["aria-expanded"], true);
  assert.match(tree.props.className, /is-collapsed/);
  const item = allNodes(tree).find((n) => n.props?.label === "Metaobjects");
  item.props.onNavigate();
  tree = h.render();
  assert.equal(button("vsn-sidebar-toggle").props["aria-expanded"], false);
  assert.match(tree.props.className, /is-collapsed/);
  button("vsn-sidebar-collapse").props.onClick();
  tree = h.render();
  assert.doesNotMatch(tree.props.className, /is-collapsed/);
});

test("collapsed navigation tooltip opens for hover/focus, is hoverable, dismisses with Escape and stays off on mobile", async () => {
  const oldWindow = globalThis.window,
    oldDocument = globalThis.document;
  const listeners = new Map();
  let desktop = true;
  globalThis.window = {
    innerHeight: 800,
    matchMedia: () => ({ matches: desktop }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  globalThis.document = {
    body: { nodeType: 1 },
    activeElement: null,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const h = await componentHarness("app/components/SidebarItem.jsx");
  const props = {
    to: { pathname: "/app/guide" },
    label: "Help center",
    icon: "help",
    collapsed: true,
    onNavigate: () => {},
  };
  try {
    let tree = h.render(props);
    h.refs[0].current = {
      getBoundingClientRect: () => ({ right: 62, top: 280, height: 44 }),
    };
    tree.props.children[0].props.onMouseEnter();
    tree = h.render(props);
    h.flushEffects();
    tree = h.render(props);
    const tooltip = tree.props.children[1].children;
    assert.equal(tooltip.props.role, "tooltip");
    assert.equal(tooltip.props.children, "Help center");
    assert.equal(
      tree.props.children[0].props["aria-describedby"],
      tooltip.props.id,
    );
    tree.props.children[0].props.onMouseLeave();
    tooltip.props.onMouseEnter();
    await new Promise((resolve) => setTimeout(resolve, 180));
    tree = h.render(props);
    assert.ok(tree.props.children[1]);
    listeners.get("keydown")({ key: "Escape" });
    tree = h.render(props);
    assert.equal(tree.props.children[1], false);
    desktop = false;
    tree.props.children[0].props.onFocus();
    tree = h.render(props);
    assert.equal(tree.props.children[1], false);
    desktop = true;
    tree.props.children[0].props.onFocus();
    tree = h.render(props);
    h.flushEffects();
    tree = h.render(props);
    assert.ok(tree.props.children[1]);
  } finally {
    h.cleanup();
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
});
