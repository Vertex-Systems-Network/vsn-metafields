import test from "node:test";
import assert from "node:assert/strict";
import { build, transformSync } from "esbuild";
import { createRequire } from "node:module";
import React from "react";
import { renderToString } from "react-dom/server";
import { resolve } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { HELP_TOPICS } from "../app/help-content.js";
import { HELP_SCREENSHOTS, WORKSPACE_SCREENSHOTS, THEME_SCREENSHOTS } from "../app/help-screenshots.js";
import { THEME_HELP } from "../app/theme-help.js";
import { APP_NAME, appDisplayName } from "../app/product-config.js";
import { requestAppName } from "../app/product-identity.server.js";

const require = createRequire(import.meta.url);
const cache = new Map();
async function renderRoute(name, fetchers = [], exportName = "default", props = {}) {
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
    React.createElement(module.exports[exportName], props),
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
test("deployment identity overrides optimized build mode for app titles", () => {
  assert.equal(requestAppName({ cloudflare: { env: { APP_ENV: "staging", NODE_ENV: "production" } } }), `${APP_NAME} (Staging)`);
  assert.equal(requestAppName({ cloudflare: { env: { APP_ENV: "production", NODE_ENV: "development" } } }), APP_NAME);
  assert.equal(requestAppName({ cloudflare: { env: { APP_ENV: "local" } } }), `${APP_NAME} (Dev)`);
  assert.equal(appDisplayName("development"), `${APP_NAME} (Dev)`);
  assert.equal(appDisplayName(undefined), APP_NAME);
});
test("actual page loaders, metadata and health use trusted server identity, ignoring URL overrides", async () => {
  const { PRO_PLAN } = await import("../app/billing-config.js");
  const load = (file) => {
    const module = { exports: {} };
    const code = transformSync(readFileSync(resolve(file), "utf8"), { loader: "jsx", format: "cjs" }).code;
    const deps = {
      "react-router": {},
      "@shopify/shopify-app-react-router/server": {},
      "@shopify/shopify-app-react-router/react": {},
      "@shopify/app-bridge-react": {},
      "../shopify.server": { authenticate: { admin: async () => ({}) } },
      "../../shopify.server": { login: () => {} },
      "../db.server": {},
      "../components/Workspace": {},
      "../styles/workspace.css": {},
      "./styles.module.css": {},
      "../product-config": { APP_NAME, APP_VERSION: "test-version" },
      "../../product-config": { APP_NAME },
      "../product-identity.server": { requestAppName },
      "../../product-identity.server": { requestAppName },
      "../billing-config": { PRO_PLAN },
    };
    new Function("require", "module", "exports", code)((id) => { assert.ok(id in deps, id); return deps[id]; }, module, module.exports);
    return module.exports;
  };
  const app = load("app/routes/app.jsx"), landing = load("app/routes/_index/route.jsx"), health = load("app/routes/healthz.jsx");
  for (const APP_ENV of ["local", "staging", "production"]) {
    const context = { cloudflare: { env: { APP_ENV, NODE_ENV: "production", APP_COMMIT_SHA: "tested-sha", SHOPIFY_API_SECRET: "must-not-leak" } } };
    const request = new Request("https://example.invalid/?APP_ENV=production&title=attacker");
    for (const route of [app, landing]) {
      const data = await route.loader({ request, context });
      assert.equal(data.appName, appDisplayName(APP_ENV));
      assert.equal(route.meta({ data })[0].title, data.appName);
    }
    const response = await health.loader({ context });
    const data = await response.json();
    assert.equal(data.displayName, appDisplayName(APP_ENV));
    assert.equal(data.commitSha, "tested-sha");
    assert.equal(data.plan.amount, 55);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.ok(!JSON.stringify(data).includes("must-not-leak"));
  }
});
test("workspace server rendering uses the same environment title in its header and footer", async () => {
  for (const environment of ["local", "staging", "production"]) {
    const appName = appDisplayName(environment);
    const html = await renderRoute("../components/Workspace.jsx", [], "Workspace", { appName });
    assert.ok(html.includes(`aria-label="${appName} home"`));
    assert.equal((html.match(new RegExp(`<span>${appName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</span>`, "g")) || []).length, 2);
    if (environment === "production") assert.doesNotMatch(html, /\(Dev\)|\(Staging\)/);
  }
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
  assert.equal((guide.match(/src="\/help\/[a-z]+\.svg"/g) || []).length, 7);
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


test("actual Help screenshots cover every topic and block with valid dated JPEG assets", async () => {
  const html = await renderRoute("app.guide.jsx");
  const screenshots = [...WORKSPACE_SCREENSHOTS];
  for (const topic of HELP_TOPICS) {
    assert.ok(HELP_SCREENSHOTS[topic.id]?.length, topic.id);
    screenshots.push(...HELP_SCREENSHOTS[topic.id]);
  }
  for (const block of THEME_HELP) {
    assert.ok(THEME_SCREENSHOTS[block.id], block.id);
    screenshots.push(THEME_SCREENSHOTS[block.id]);
  }
  for (const screenshot of screenshots) {
    assert.match(html, new RegExp(screenshot.src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const bytes = readFileSync(resolve("public", screenshot.src.slice(1)));
    assert.equal(bytes.readUInt16BE(0), 0xffd8);
    assert.ok(screenshot.width > 0 && screenshot.height > 0);
    assert.equal(screenshot.version, "1.2.3");
    assert.ok(Number.isFinite(Date.parse(screenshot.capturedAt)));
  }
  assert.match(html, /Actual Staging app/);
  assert.match(html, /Concept diagram/);
  assert.doesNotMatch(await renderRoute("app.packages.jsx"), /✓ Public metaobject publishing/);
});


test("Metafields uses Stock Down Sort content width and top-level Shopify approval", async () => {
  const styles = readFileSync("app/styles/workspace.css", "utf8");
  const client = readFileSync("app/billing-client.js", "utf8");
  const packages = readFileSync("app/routes/app.packages.jsx", "utf8");

  assert.ok(styles.includes(".vsn-content main > s-page"));
  assert.ok(styles.includes("inline-size: calc(100% - 36px) !important;"));
  assert.equal(styles.includes("min(6vw, 96px) + 32px"), false);
  assert.ok(client.includes('open(confirmationUrl, "_top")'));
  assert.ok(packages.includes("openBillingApproval(response.confirmationUrl, window.open.bind(window))"));
  assert.equal(packages.includes("reserveBillingApproval"), false);
});
