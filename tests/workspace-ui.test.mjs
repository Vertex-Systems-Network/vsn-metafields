import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import React from "react";
import { renderToString } from "react-dom/server";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const cache = new Map();
async function renderRoute(name, fetchers = []) {
  if (!cache.has(name))
    cache.set(
      name,
      (
        await build({
          entryPoints: [resolve(`app/routes/${name}`)],
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
          ],
        })
      ).outputFiles[0].text,
    );
  const module = { exports: {} };
  let index = 0;
  const router = {
    useLocation: () => ({
      search: "?shop=example.myshopify.com&host=embedded",
      pathname: "/app",
    }),
    useFetcher: () => ({
      state: "idle",
      load: () => {},
      submit: () => {},
      ...fetchers[index++],
    }),
    Link: ({ to, children, ...props }) =>
      React.createElement(
        "a",
        { ...props, href: `${to.pathname}${to.search || ""}${to.hash || ""}` },
        children,
      ),
  };
  new Function("require", "module", "exports", cache.get(name))(
    (id) => (id === "react-router" ? router : require(id)),
    module,
    module.exports,
  );
  return renderToString(React.createElement(module.exports.default)).replace(
    /<!--.*?-->/g,
    "",
  );
}
test("Metaobjects first render does not dereference an absent entries response", async () => {
  assert.match(
    await renderRoute("app.metaobjects.jsx"),
    /Loading your definitions/,
  );
  assert.match(
    await renderRoute("app.metaobjects.jsx", [
      { data: { ok: true, definitions: [], types: [] } },
    ]),
    /Your first reusable content collection/,
  );
});
test("Metaobjects renders failed or malformed catalog responses without an application crash", async () => {
  assert.match(
    await renderRoute("app.metaobjects.jsx", [
      { data: { ok: false, error: "Plan required" } },
    ]),
    /Plan required/,
  );
  assert.match(
    await renderRoute("app.metaobjects.jsx", [
      { data: { ok: true, definitions: {}, types: {} } },
    ]),
    /Your first reusable content collection/,
  );
});
test("three plan cards show real limits and retain existing ACTIVE test Pro access", async () => {
  const html = await renderRoute("app.packages.jsx", [
    {
      data: {
        ok: true,
        subscriptions: [{ status: "ACTIVE", name: "pro-plan", test: true }],
      },
    },
  ]);
  for (const text of [
    "Starter",
    "Growth",
    "Pro",
    "$19",
    "$35",
    "$55",
    "100",
    "128",
    "25",
    "Current plan",
    "Test subscription",
  ])
    assert.ok(html.includes(text), text);
  assert.match(html, /shop=example/);
});
test("help center and import initial state render their real recovery and empty guidance", async () => {
  const guide = await renderRoute("app.guide.jsx");
  assert.match(guide, /Search guides and troubleshooting/);
  assert.match(guide, /Continue to Shopify plan approval/);
  assert.match(guide, /id="storefront"/);
  const html = await renderRoute("app.import.jsx", [
    { data: { ok: true, jobs: [] } },
  ]);
  assert.match(html, /No saved imports yet/);
});
