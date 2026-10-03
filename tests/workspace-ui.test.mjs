import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import React from "react";
import { renderToString } from "react-dom/server";
import { resolve } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { HELP_TOPICS } from "../app/help-content.js";
import { THEME_HELP } from "../app/theme-help.js";

const require = createRequire(import.meta.url);
const cache = new Map();
async function renderRoute(name, fetchers = [], exportName = "default") {
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
    useNavigation: () => ({ state: "idle" }),
    useFetchers: () => [],
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
    NavLink: ({ to, children, className }) =>
      React.createElement(
        "a",
        {
          href: `${to.pathname}${to.search || ""}`,
          className: className({ isActive: to.pathname === "/app" }),
          "aria-current": to.pathname === "/app" ? "page" : undefined,
        },
        children,
      ),
  };
  new Function("require", "module", "exports", cache.get(name))(
    (id) => (id === "react-router" ? router : require(id)),
    module,
    module.exports,
  );
  return renderToString(
    React.createElement(module.exports[exportName]),
  ).replace(/<!--.*?-->/g, "");
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
test("beginner help explains each screen and labels conceptual diagrams honestly", async () => {
  const guide = await renderRoute("app.guide.jsx");
  assert.equal((guide.match(/<img /g) || []).length, 7);
  assert.match(guide, /Your first example: care instructions/);
  assert.match(guide, /Plain-language glossary/);
  assert.match(guide, /not a screenshot of the current app/);
  assert.match(guide, /ownerType,ownerId,namespace,key,type,value_json/);
  for (const topic of HELP_TOPICS) {
    assert.ok(topic.where && topic.preview.alt);
    assert.ok(topic.result && topic.sections.length && topic.mistakes.length);
    for (const section of topic.sections)
      for (const row of section.rows) {
        assert.equal(row.length, 3);
        assert.ok(row.every(Boolean));
      }
    assert.match(
      readFileSync(resolve(`public${topic.preview.src}`), "utf8"),
      /<title>.+illustrated walkthrough<\/title>/,
    );
  }
});
test("theme documentation covers every shipped block option and its actual default", () => {
  const directory = resolve("extensions/vsn-storefront/blocks");
  const files = readdirSync(directory).filter((name) =>
    name.endsWith(".liquid"),
  );
  assert.equal(THEME_HELP.length, files.length);
  for (const file of files) {
    const schema = JSON.parse(
      readFileSync(resolve(directory, file), "utf8").match(
        /{% schema %}([\s\S]*?){% endschema %}/,
      )[1],
    );
    const block = THEME_HELP.find(
      (item) => item.id === file.replace(".liquid", ""),
    );
    assert.equal(block.title, schema.name);
    assert.deepEqual(
      block.settings.map((item) => item.id),
      schema.settings.filter((item) => item.id).map((item) => item.id),
    );
    for (const setting of schema.settings.filter((item) => item.id)) {
      const help = block.settings.find((item) => item.id === setting.id);
      assert.equal(help.label, setting.label);
      assert.ok(help.description);
      if (Object.hasOwn(setting, "default"))
        assert.ok(help.details.includes(`Default: ${setting.default}`));
      for (const choice of setting.options || [])
        assert.ok(help.details.includes(choice.label));
    }
  }
});
test("workspace sidebar preserves embedded context and provides a collapsed mobile toggle", async () => {
  const html = await renderRoute(
    "../components/Workspace.jsx",
    [],
    "Workspace",
  );
  assert.match(html, /<aside class="vsn-sidebar">/);
  assert.match(html, /aria-expanded="false" aria-controls=/);
  assert.match(html, /aria-label="Workspace"/);
  assert.match(html, /aria-current="page"/);
  assert.equal((html.match(/class="vsn-nav-link/g) || []).length, 5);
  assert.equal((html.match(/shop=example.myshopify.com/g) || []).length, 8);
  assert.ok(html.indexOf("<aside") < html.indexOf('class="vsn-content"'));
  for (const route of [
    "app.metaobjects.jsx",
    "app.import.jsx",
    "app.packages.jsx",
    "app.guide.jsx",
  ])
    assert.match(await renderRoute(route), /<s-page inline-size="large"/);
});
test("permission status is separated into cards with specific page and file actions", async () => {
  const guide = await renderRoute("app.guide.jsx", [
    {
      data: {
        diagnostics: {
          apiVersion: "2026-07",
          environment: "staging",
          database: "reachable",
          hasActivePlan: true,
          importJobCount: 0,
          features: {
            values: { ready: true, missing: [] },
            metaobjects: { ready: true, missing: [] },
            pageReferences: { ready: false, missing: ["read_content"] },
            fileReferences: { ready: false, missing: ["read_files"] },
          },
        },
      },
    },
  ]);
  for (const text of [
    "Product &amp; collection values",
    "Pages &amp; articles",
    "Files &amp; media",
    "Enable page references",
    "Enable file references",
    "Technical connection details",
  ])
    assert.ok(guide.includes(text), text);
});
test("initial route fetches include visible skeletons and the Pro comparison discloses gated features", async () => {
  for (const name of [
    "app.metaobjects.jsx",
    "app.import.jsx",
    "app.packages.jsx",
    "app.guide.jsx",
  ])
    assert.match(await renderRoute(name), /vsn-skeleton/);
  const html = await renderRoute("app.packages.jsx");
  assert.match(html, /Recommended · Full content workflow/);
  assert.match(html, /Public metaobject publishing · Pro only/);
  assert.match(html, /Failed-import retry preparation · Pro only/);
});
