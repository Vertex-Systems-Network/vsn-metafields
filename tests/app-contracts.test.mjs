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

test("App Validation tracks React Router runtime config changes", () => {
  const workflow = read(".github/workflows/app-validation.yml");

  const matches = workflow.match(/- "react-router\.config\.js"/g) || [];
  assert.equal(matches.length, 2);
});

test("local React Router actions allow only the current Shopify tunnel origin", () => {
  const config = read("react-router.config.js");

  assert.match(config, /process\.env\.SHOPIFY_APP_URL/);
  assert.match(config, /process\.env\.HOST/);
  assert.match(config, /endsWith\("\.trycloudflare\.com"\)/);
  assert.match(config, /allowedActionOrigins:\s*localTunnelHost \? \[localTunnelHost\] : \[\]/);
  assert.doesNotMatch(config, /\*\.trycloudflare\.com/);
  assert.doesNotMatch(config, /vertexsystemsnetwork\.workers\.dev/);
  assert.doesNotMatch(config, /up\.railway\.app/);
});

test("embedded app navigation follows Shopify React Router NavMenu pattern", () => {
  const app = read("app/routes/app.jsx");
  const index = read("app/routes/app._index.jsx");

  assert.match(app, /import \{ Link, Outlet, useLoaderData, useRouteError \} from "react-router"/);
  assert.match(app, /import \{ NavMenu \} from "@shopify\/app-bridge-react"/);
  assert.match(app, /<NavMenu>/);
  assert.match(app, /<Link to="\/app" rel="home">Options<\/Link>/);
  assert.match(app, /<Link to="\/app\/packages">Packages<\/Link>/);

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

test("staging acceptance probe is signed, staging-only, and read-only", () => {
  const diagnostic = read("app/routes/internal.staging-acceptance.jsx");
  const workflow = read(".github/workflows/cloudflare-staging-deploy.yml");

  assert.match(diagnostic, /EXPECTED_STAGING_APP_URL/);
  assert.match(diagnostic, /vertex-systems-network\.myshopify\.com/);
  assert.match(diagnostic, /SIGNATURE_MAX_AGE_SECONDS = 300/);
  assert.match(diagnostic, /crypto\.subtle\.verify/);
  assert.match(diagnostic, /sessionStorage\.findSessionsByShop\(shop\)/);
  assert.match(diagnostic, /unauthenticated\.admin\(shop\)/);
  assert.match(diagnostic, /currentAppInstallation/);
  assert.match(diagnostic, /session_store_read_failed/);
  assert.match(diagnostic, /no_stored_sessions/);
  assert.match(diagnostic, /offline_session_unavailable/);
  assert.match(diagnostic, /admin_graphql_request_failed/);
  assert.match(diagnostic, /sdk_graphql_failed_direct_probe_passed/);
  assert.match(diagnostic, /X-Shopify-Access-Token/);
  assert.match(diagnostic, /directProbe/);
  assert.doesNotMatch(diagnostic, /accessToken:\s*session\.accessToken/);
  assert.match(diagnostic, /admin_graphql_response_error/);
  assert.match(diagnostic, /activeSubscriptions/);
  assert.doesNotMatch(diagnostic, /appSubscriptionCreate/);
  assert.doesNotMatch(diagnostic, /appSubscriptionCancel/);
  assert.doesNotMatch(diagnostic, /DATABASE_URL/);

  assert.match(workflow, /staging_offline_session=pass/);
  assert.match(workflow, /staging_admin_graphql=pass/);
  assert.match(workflow, /staging_subscription_read=pass/);
  assert.match(workflow, /staging_acceptance_http_error=/);
  assert.match(workflow, /"directProbe": diagnostic\.get\("directProbe"\)/);
  assert.match(workflow, /urllib\.error\.HTTPError/);
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

test("Cloudflare staging deploy is manual and always checks out development", () => {
  const workflow = read(".github/workflows/cloudflare-staging-deploy.yml");

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\npush:/);
  assert.match(workflow, /DEPLOY_DEVELOPMENT_TO_STAGING/);
  assert.match(workflow, /ref: development/);
  assert.match(workflow, /environment: cloudflare-staging/);
  assert.match(workflow, /APP_ENV:staging/);
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

test("packages page avoids duplicate server auth and loads billing status client-side", () => {
  const packages = read("app/routes/app.packages.jsx");

  assert.match(packages, /import \{ useFetcher, useLocation \} from "react-router"/);
  assert.doesNotMatch(packages, /export const loader/);
  assert.doesNotMatch(packages, /authenticate\.admin\(request\)/);
  assert.doesNotMatch(packages, /useLoaderData/);
  assert.match(packages, /statusFetcher\.state === "idle" && !statusFetcher\.data/);
  assert.match(packages, /statusFetcher\.load\(\`\/app\/api\/status\$\{location\.search\}\`\)/);
  assert.match(packages, /subscriptions\.find\(\(sub\) => sub\.status === "ACTIVE"\)/);
  assert.match(packages, /actionFetcher\.submit/);
});

test("billing mutations require authenticated POST requests and guard active plans", () => {
  const status = read("app/routes/app.api.status.jsx");
  const packages = read("app/routes/app.packages.jsx");

  assert.match(status, /authenticate\.admin\(request\)/);
  assert.match(status, /method !== "POST"/);
  assert.match(status, /actionType !== "create" && actionType !== "cancel"/);
  assert.match(status, /\[vsn-status-action\]/);
  assert.match(status, /\[vsn-status-action-auth-failed\]/);
  assert.match(status, /process\.env\.APP_ENV === "production"/);
  assert.match(status, /process\.env\.NODE_ENV === "production"/);
  assert.doesNotMatch(packages, /process\.env\.APP_ENV/);
  assert.doesNotMatch(packages, /process\.env\.NODE_ENV/);
  assert.match(status, /subscriptions\.filter\(\(subscription\) => !subscription\.test\)/);
  assert.match(status, /subscription\.id === id && subscription\.status === "ACTIVE"/);
  assert.match(status, /duplicateActivePlan/);
  assert.match(status, /subscription\.status === "ACTIVE"/);
  assert.match(status, /appSubscriptionCancel\(id: \$id, prorate: true\)/);
  assert.match(status, /mutation CreateSubscription\(/);
  assert.match(status, /\$test:\s*Boolean!/);
  assert.match(status, /test:\s*\$test/);
  assert.match(status, /test:\s*!isProductionBilling\(\)/);
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

test("development pushes run validation but never deployment workflows", () => {
  const appValidation = read(".github/workflows/app-validation.yml");
  const readiness = read(".github/workflows/cloudflare-staging-readiness.yml");
  const quality = read(".github/workflows/repository-quality.yml");
  const audit = read(".github/workflows/dependency-audit.yml");
  const stagingDeploy = read(".github/workflows/cloudflare-staging-deploy.yml");
  const productionDeploy = read(".github/workflows/cloudflare-production-deploy.yml");

  for (const workflow of [appValidation, readiness, quality, audit]) {
    assert.match(workflow, /push:[\s\S]*- main[\s\S]*- development/);
  }

  assert.doesNotMatch(stagingDeploy, /\npush:/);
  assert.doesNotMatch(productionDeploy, /\npush:/);
});

test("development flow keeps local and staging changes away from live production", () => {
  const flow = JSON.parse(read("config/development-flow.json"));
  const staging = read(".github/workflows/cloudflare-staging-deploy.yml");
  const production = read(".github/workflows/cloudflare-production-deploy.yml");

  assert.equal(flow.development_branch, "development");
  assert.equal(flow.release_branch, "main");
  assert.equal(flow.staging.source_branch, "development");
  assert.equal(flow.staging.auto_deploy_runtime_changes, false);
  assert.equal(flow.staging.deploy_mode, "manual_dispatch_from_development");
  assert.equal(flow.live.source_branch, "main");
  assert.equal(flow.live.auto_deploy, false);
  assert.equal(flow.live.deploy_mode, "manual_dispatch");
  assert.equal(flow.live.shopify_cutover_mode, "explicit_authorization_only");

  assert.match(staging, /workflow_dispatch:/);
  assert.match(staging, /ref: development/);
  assert.doesNotMatch(staging, /\npush:/);

  assert.match(production, /workflow_dispatch:/);
  assert.doesNotMatch(production, /\npush:/);
  assert.doesNotMatch(production, /github\.event_name == 'push'/);
});

test("production cutover certification performs build and Worker dry-run without authorizing release", () => {
  const workflow = read(".github/workflows/production-cutover-contract.yml");

  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /wrangler@4\.141\.0 deploy/);
  assert.match(workflow, /--config wrangler\.production\.jsonc/);
  assert.match(workflow, /--dry-run/);
  assert.match(workflow, /production_worker_dry_run=pass/);
  assert.match(workflow, /production_release_authorized=false/);
  assert.match(workflow, /production_shopify_cutover_performed=false/);
  assert.doesNotMatch(workflow, /shopify app release/);
  assert.doesNotMatch(workflow, /prisma migrate deploy/);
});

test("production cutover package preserves Shopify identity, billing, database, and Railway rollback", () => {
  const current = read("shopify.app.toml");
  const target = read("shopify.app.cloudflare-production.toml");
  const wrangler = JSON.parse(read("wrangler.production.jsonc"));
  const policy = JSON.parse(read("config/cloudflare/production-cutover.json"));
  const validator = read("scripts/cloudflare/validate_production_cutover_contract.py");
  const deploy = read(".github/workflows/cloudflare-production-deploy.yml");
  const candidate = read(".github/workflows/shopify-production-cutover-version.yml");
  const release = read(".github/workflows/shopify-production-cutover-release.yml");
  const rollback = read(".github/workflows/shopify-production-rollback-railway.yml");

  assert.match(current, /client_id = "f5266ba8dba403005deb695fedad053a"/);
  assert.ok(current.includes('application_url = "https://vsn-metafields-production.up.railway.app"'));
  assert.match(target, /client_id = "f5266ba8dba403005deb695fedad053a"/);
  assert.ok(target.includes('application_url = "https://vsn-metafields-production.vertexsystemsnetwork.workers.dev"'));

  assert.equal(wrangler.name, "vsn-metafields-production");
  assert.equal(wrangler.main, "./workers/app.js");
  assert.equal(Object.hasOwn(wrangler, "routes"), false);

  assert.equal(policy.release_authorized, false);
  assert.equal(policy.authorized_version, null);
  assert.equal(policy.authorized_source_ref, null);
  assert.equal(policy.authorization_record, null);
  assert.equal(policy.shopify.preserve_app_identity, true);
  assert.equal(policy.shopify.merchant_reinstall_allowed, false);
  assert.equal(policy.billing.mutate_during_cutover, false);
  assert.equal(policy.database.migrate_during_cutover, false);
  assert.equal(policy.rollback.keep_railway_available, true);

  assert.match(validator, /production_release_authorized=false/);
  assert.match(deploy, /DEPLOY_PRODUCTION_WORKER_ONLY/);
  assert.match(deploy, /environment: cloudflare-production/);
  assert.match(deploy, /CLOUDFLARE_ACCOUNT_ID: f63cf3af0868a5c8a0b26ebee5dd039f/);
  assert.match(deploy, /SHOPIFY_API_KEY: f5266ba8dba403005deb695fedad053a/);
  assert.match(deploy, /SHOPIFY_APP_URL: https:\/\/vsn-metafields-production\.vertexsystemsnetwork\.workers\.dev/);
  assert.match(deploy, /SCOPES: read_products,write_metaobject_definitions,write_metaobjects,write_products,read_orders/);
  assert.match(deploy, /for name in CLOUDFLARE_API_TOKEN DATABASE_URL DIRECT_URL SHOPIFY_API_SECRET/);
  assert.doesNotMatch(deploy, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.doesNotMatch(deploy, /secrets\.SHOPIFY_API_KEY/);
  assert.doesNotMatch(deploy, /secrets\.SHOPIFY_APP_URL/);
  assert.doesNotMatch(deploy, /secrets\.SCOPES/);
  assert.match(deploy, /prisma migrate status/);
  assert.doesNotMatch(deploy, /prisma migrate deploy/);
  assert.match(deploy, /--config wrangler\.production\.jsonc/);
  assert.match(deploy, /production_shopify_cutover_performed=false/);

  assert.match(candidate, /CREATE_PRODUCTION_CUTOVER_VERSION/);
  assert.match(candidate, /--config cloudflare-production/);
  assert.match(candidate, /--no-release/);
  assert.match(candidate, /SOURCE_PREFIX="\$\{GITHUB_SHA:0:12\}"/);
  assert.match(candidate, /candidate_source_ref=\$GITHUB_SHA/);
  assert.doesNotMatch(candidate, /app release/);

  assert.match(release, /RELEASE_PRODUCTION_CUTOVER/);
  assert.match(release, /release_authorized/);
  assert.match(release, /authorized_version/);
  assert.match(release, /authorized_source_ref/);
  assert.match(release, /authorization_record/);
  assert.match(release, /cloudflare-production-cutover-/);
  assert.match(release, /--allow-updates/);
  assert.doesNotMatch(release, /--allow-deletes/);

  assert.match(rollback, /ROLLBACK_TO_RAILWAY/);
  assert.match(rollback, /railway-rollback-/);
  assert.match(rollback, /--allow-updates/);
  assert.doesNotMatch(rollback, /--allow-deletes/);

  for (const workflow of [deploy, candidate, release, rollback]) {
    assert.doesNotMatch(workflow, /appSubscriptionCreate/);
    assert.doesNotMatch(workflow, /appSubscriptionCancel/);
  }
});

test("destructive global session-clear route stays absent", () => {
  assert.equal(exists("app/routes/clear-sessions.jsx"), false);
});
