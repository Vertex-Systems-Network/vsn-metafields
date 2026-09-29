import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

test("Shopify auth, session storage, and API versions stay aligned", () => {
  const shopify = read("app/shopify.server.js");
  const codegen = read(".graphqlrc.js");
  const toml = read("shopify.app.toml");

  assert.match(shopify, /authPathPrefix:\s*"\/auth"/);
  assert.match(shopify, /new RequestScopedPrismaSessionStorage\(\)/);
  const sessionStorage = read("app/prisma-session-storage.server.js");
  assert.match(sessionStorage, /new PrismaSessionStorage\(prisma, storageOptions\)/);
  assert.match(sessionStorage, /createPrismaClient\(\)/);
  assert.match(sessionStorage, /await prisma\.\$disconnect\(\)/);
  assert.match(shopify, /useOnlineTokens:\s*true/);
  assert.match(shopify, /apiVersion:\s*ApiVersion\.July26/);
  assert.match(shopify, /export const authenticate = shopify\.authenticate/);
  assert.match(codegen, /apiVersion:\s*ApiVersion\.July26/);
  assert.match(toml, /api_version\s*=\s*"2026-07"/);
});

test("Prisma runtime stays Worker-compatible without changing session storage", () => {
  const db = read("app/db.server.js");
  const schema = read("prisma/schema.prisma");
  const shopify = read("app/shopify.server.js");
  const wrangler = JSON.parse(read("wrangler.jsonc"));
  const pkg = JSON.parse(read("package.json"));

  assert.match(schema, /engineType\s*=\s*"client"/);
  assert.match(schema, /provider\s*=\s*"postgresql"/);
  assert.match(db, /@prisma\/adapter-pg/);
  assert.match(db, /export function createPrismaClient\(\)/);
  assert.match(db, /new PrismaPg\(\{ connectionString \}\)/);
  assert.match(db, /new PrismaClient\(\{[\s\S]*adapter,/);
  assert.doesNotMatch(db, /\.\$connect\(/);
  assert.doesNotMatch(db, /global\.__vsnPrisma/);
  assert.doesNotMatch(db, /export default/);
  assert.match(shopify, /new RequestScopedPrismaSessionStorage\(\)/);

  assert.equal(pkg.dependencies["@prisma/client"], "6.19.3");
  assert.equal(pkg.dependencies["@prisma/adapter-pg"], "6.19.3");
  assert.equal(pkg.dependencies.pg, "8.23.0");
  assert.equal(pkg.dependencies.prisma, "6.19.3");
  assert.equal(pkg.devDependencies["@types/pg"], "8.23.1");
  assert.ok(wrangler.compatibility_flags.includes("nodejs_compat"));
});

test("embedded app navigation stays inside Shopify and preserves auth context", () => {
  const app = read("app/routes/app.jsx");
  const index = read("app/routes/app._index.jsx");

  assert.match(app, /useLocation/);
  assert.match(app, /href={\`\/app\$\{location\.search\}\`}/);
  assert.match(app, /href={\`\/app\/packages\$\{location\.search\}\`}/);

  assert.match(index, /import \{ Link, useFetcher, useLocation \} from "react-router"/);
  assert.match(index, /pathname:\s*"\/app\/packages"/);
  assert.match(index, /search:\s*location\.search/);
  assert.doesNotMatch(index, /target="_top"/);
});

test("Shopify staging config uses a dedicated app identity and declares required webhooks", () => {
  const staging = read("shopify.app.cloudflare-staging.toml");
  const workflow = read(".github/workflows/shopify-staging-version.yml");

  assert.match(staging, /client_id = "__SHOPIFY_STAGING_CLIENT_ID__"/);
  assert.match(staging, /topics = \[ "app\/uninstalled" \]/);
  assert.match(staging, /topics = \[ "app\/scopes_update" \]/);
  assert.match(staging, /compliance_topics = \[ "customers\/data_request" \]/);
  assert.match(staging, /compliance_topics = \[ "customers\/redact" \]/);
  assert.match(staging, /compliance_topics = \[ "shop\/redact" \]/);

  assert.match(workflow, /SHOPIFY_APP_AUTOMATION_TOKEN/);
  assert.match(workflow, /--config cloudflare-staging/);
  assert.match(workflow, /--no-release/);
  assert.doesNotMatch(workflow, /--client-id/);
  assert.match(workflow, /Refusing to create a staging version with the production Shopify client ID/);

  const releaseWorkflow = read(".github/workflows/shopify-staging-release.yml");
  assert.match(releaseWorkflow, /TARGET_VERSION: "staging-webhooks-2"/);
  assert.match(releaseWorkflow, /RELEASE_STAGING_WEBHOOKS_2/);
  assert.match(releaseWorkflow, /config\/shopify\/staging-release-request\.json/);
  assert.match(releaseWorkflow, /github\.event_name == 'push'/);
  assert.match(releaseWorkflow, /app versions list/);
  assert.match(releaseWorkflow, /app release/);
  assert.match(releaseWorkflow, /--allow-updates/);
  assert.doesNotMatch(releaseWorkflow, /--allow-deletes/);
  assert.doesNotMatch(releaseWorkflow, /--client-id/);
  assert.match(releaseWorkflow, /Refusing to release staging version with the production Shopify client ID/);
  assert.match(releaseWorkflow, /vsn-metafields-staging\.vertexsystemsnetwork\.workers\.dev/);
  assert.match(releaseWorkflow, /customers\/data_request/);
  assert.match(releaseWorkflow, /customers\/redact/);
  assert.match(releaseWorkflow, /shop\/redact/);
  assert.doesNotMatch(releaseWorkflow, /trigger_webhook "app\/uninstalled"/);
  assert.doesNotMatch(releaseWorkflow, /trigger_webhook "app\/scopes_update"/);
});

test("public health contract exposes only deployment-safe plan metadata", () => {
  const health = read("app/routes/healthz.jsx");
  const workflow = read(".github/workflows/cloudflare-staging-deploy.yml");

  assert.match(health, /PRO_PLAN/);
  assert.match(health, /service:\s*"vsn-metafields"/);
  assert.match(health, /amount:\s*PRO_PLAN\.amount/);
  assert.match(health, /trialDays:\s*PRO_PLAN\.trialDays/);
  assert.match(health, /Cache-Control/);
  assert.doesNotMatch(health, /DATABASE_URL|SHOPIFY_API_SECRET|session|accessToken/);

  assert.match(workflow, /\/healthz/);
  assert.match(workflow, /"amount": 55/);
  assert.match(workflow, /"trialDays": 5/);
  assert.match(workflow, /staging_runtime_health=pass/);
});

test("Cloudflare staging deploy stays isolated and auto-deploys only runtime changes", () => {
  const workflow = read(".github/workflows/cloudflare-staging-deploy.yml");

  assert.match(workflow, /push:/);
  assert.match(workflow, /branches:\s*\n\s*- main/);
  assert.match(workflow, /- "app\/\*\*"/);
  assert.match(workflow, /github\.event_name == 'push'/);
  assert.match(workflow, /environment: cloudflare-staging/);
  assert.match(workflow, /Staging deploy must not use the Railway production Shopify URL/);
  assert.doesNotMatch(workflow, /environment:\s*production/);
});

test("Cloudflare Worker entry delegates to the React Router server build", () => {
  const wrangler = JSON.parse(read("wrangler.jsonc"));
  const worker = read("workers/app.js");

  assert.equal(wrangler.main, "./workers/app.js");
  assert.match(worker, /createRequestHandler/);
  assert.match(worker, /\.\.\/build\/server\/index\.js/);
  assert.match(worker, /export default/);
  assert.match(worker, /async fetch\(request, env, ctx\)/);
  assert.match(worker, /cloudflare:\s*\{\s*env,\s*ctx\s*\}/);
});

test("SSR entry stays Web-Streams compatible for Workers and Node 22", () => {
  const entry = read("app/entry.server.jsx");

  assert.match(entry, /renderToReadableStream/);
  assert.match(entry, /react-dom\/server\.browser/);
  assert.doesNotMatch(entry, /renderToPipeableStream/);
  assert.doesNotMatch(entry, /PassThrough/);
  assert.doesNotMatch(entry, /@react-router\/node/);
  assert.match(entry, /new Response\(body,/);
});

test("configured webhooks authenticate and uninstall cleanup is shop-scoped", () => {
  const toml = read("shopify.app.toml");
  const routes = [
    ["app/uninstalled", "/webhooks/app/uninstalled", "app/routes/webhooks.app.uninstalled.jsx"],
    ["app/scopes_update", "/webhooks/app/scopes_update", "app/routes/webhooks.app.scopes_update.jsx"],
    ["customers/data_request", "/webhooks/customers/data_request", "app/routes/webhooks.customers.data_request.jsx"],
    ["customers/redact", "/webhooks/customers/redact", "app/routes/webhooks.customers.redact.jsx"],
    ["shop/redact", "/webhooks/shop/redact", "app/routes/webhooks.shop.redact.jsx"],
  ];

  for (const [topic, uri, file] of routes) {
    assert.ok(toml.includes(topic), `missing webhook topic ${topic}`);
    assert.ok(toml.includes(`uri = "${uri}"`), `missing webhook URI ${uri}`);
    const source = read(file);
    assert.match(source, /authenticate\.webhook\(request\)/);
  }

  const uninstall = read("app/routes/webhooks.app.uninstalled.jsx");
  assert.match(
    uninstall,
    /deleteMany\(\{\s*where:\s*\{\s*shop\s*\}\s*\}\)/
  );
  assert.doesNotMatch(uninstall, /deleteMany\(\s*\{\s*\}\s*\)/);
});

test("Pro billing configuration stays centralized at 5 trial days and $55 across API and UI", () => {
  const billing = read("app/billing-config.js");
  const status = read("app/routes/app.api.status.jsx");
  const packages = read("app/routes/app.packages.jsx");

  assert.match(billing, /amount:\s*55/);
  assert.match(billing, /trialDays:\s*5/);
  assert.match(status, /PRO_PLAN/);
  assert.match(status, /trialDays:\s*selectedPlan\.trialDays/);
  assert.match(status, /amount:\s*selectedPlan\.amount/);
  assert.match(packages, /PRO_PLAN\.trialDays/);
  assert.match(packages, /PRO_PLAN\.amount/);
  assert.doesNotMatch(packages, /\$35\s*\/\s*month/);
  assert.doesNotMatch(packages, /15-day free trial/);
});

test("billing mutations require authenticated POST requests and guard active plans", () => {
  const status = read("app/routes/app.api.status.jsx");

  assert.match(status, /authenticate\.admin\(request\)/);
  assert.match(status, /request\.method\.toUpperCase\(\) !== "POST"/);
  assert.match(status, /subscriptions\.filter\(\(subscription\) => !subscription\.test\)/);
  assert.match(status, /subscription\.id === id && subscription\.status === "ACTIVE"/);
  assert.match(status, /duplicateActivePlan/);
  assert.match(status, /subscription\.status === "ACTIVE"/);
  assert.match(status, /appSubscriptionCancel\(id: \$id, prorate: true\)/);
  assert.match(status, /mutation CreateSubscription\(/);
  assert.match(status, /test:\s*false/);
  assert.match(status, /variables:\s*\{\s*id\s*\}/);
  assert.doesNotMatch(status, /appSubscriptionCancel\([^\n]*\$\{/);
});

test("metafield mutations stay namespace-scoped and destructive reset keeps values", () => {
  const fields = read("app/routes/app.api.fields.jsx");
  const pinFields = read("app/routes/app.api.pin-fields.jsx");

  assert.match(fields, /const NAMESPACE = "vsn_metafields"/);
  assert.match(fields, /const RESET_CONFIRMATION = "RESET_VSN_METAFIELDS"/);
  assert.match(fields, /formData\.get\("confirm"\) !== RESET_CONFIRMATION/);
  assert.match(fields, /deleteAllAssociatedMetafields:\s*false/);
  assert.match(fields, /ALLOWED_TYPES\.has\(type\)/);
  assert.match(fields, /ownerType:\s*"PRODUCT"/);
  assert.match(fields, /metafieldDefinitions\(first: 100, after: \$after, ownerType: PRODUCT\)/);
  assert.match(fields, /request\.method\.toUpperCase\(\) !== "POST"/);

  assert.match(pinFields, /const NAMESPACE = "vsn_metafields"/);
  assert.match(pinFields, /field\.namespace === NAMESPACE/);
  assert.match(pinFields, /request\.method\.toUpperCase\(\) !== "POST"/);
  assert.match(pinFields, /metafieldDefinitionUpdate/);
});

test("destructive global session-clear route stays absent", () => {
  assert.equal(exists("app/routes/clear-sessions.jsx"), false);
});
