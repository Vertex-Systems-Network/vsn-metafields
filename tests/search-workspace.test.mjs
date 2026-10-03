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
async function componentHarness(path, fetchers = []) {
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
        "react/jsx-runtime",
        "react-router",
        "prop-types",
        "../shopify.server",
        "@shopify/shopify-app-react-router/server",
      ],
    })
  ).outputFiles[0].text;
  const states = [],
    refs = [];
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
    useEffect: () => {},
    useCallback: (fn) => fn,
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
    render: (props = {}) => {
      hook = 0;
      refIndex = 0;
      fetcherIndex = 0;
      return module.exports.default(props);
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
