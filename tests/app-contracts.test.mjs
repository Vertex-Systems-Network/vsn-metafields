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
  assert.match(diagnostic, /PRODUCTION_SHOP/);
  assert.match(diagnostic, /shop === PRODUCTION_SHOP/);
  assert.match(diagnostic, /myshopify\\.com/);
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
  assert.match(diagnostic, /errorMessages/);
  assert.match(diagnostic, /x-request-id/);
  assert.match(diagnostic, /message\.slice\(0, 240\)/);
  assert.doesNotMatch(diagnostic, /directBody\s*[,}]/);
  assert.doesNotMatch(diagnostic, /accessToken:\s*session\.accessToken/);
  assert.match(diagnostic, /admin_graphql_response_error/);
  assert.match(diagnostic, /activeSubscriptions/);
  assert.doesNotMatch(diagnostic, /appSubscriptionCreate/);
  assert.doesNotMatch(diagnostic, /appSubscriptionCancel/);
  assert.doesNotMatch(diagnostic, /DATABASE_URL/);

  assert.match(workflow, /staging_offline_session=pass/);
  assert.match(workflow, /staging_admin_graphql=pass/);
  assert.match(workflow, /staging_subscription_read=pass/);
  assert.match(workflow, /resolve-staging-shop\.mjs/);
  assert.match(workflow, /steps\.staging-shop\.outputs\.shop/);
  assert.match(workflow, /STAGING_SHOP/);
  assert.match(workflow, /staging_acceptance_http_error=/);
  assert.match(workflow, /"directProbe": diagnostic\.get\("directProbe"\)/);
  assert.match(workflow, /urllib\.error\.HTTPError/);
});

test("public health contract exposes only deployment-safe plan metadata", () => {
  const health = read("app/routes/healthz.jsx");
  const workflow = read(".github/workflows/cloudflare-staging-deploy.yml");

  assert.match(health, /PRO_PLAN/);
  assert.match(health, /service:\s*"vsn-metafields"/);
  assert.match(health, /APP_COMMIT_SHA/);
  assert.match(health, /commitSha/);
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
  assert.match(workflow, /Staging deploy must use the dedicated staging Shopify app identity, not production/);
  assert.match(workflow, /PROD_CLIENT_ID/);
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
  assert.doesNotMatch(
    status,
    /subscriptions\.filter\(\(subscription\) => !subscription\.test\)/
  );
  assert.match(status, /subscriptions:\s*activeSubscriptions/);
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

test("active Shopify test subscriptions remain valid app entitlements in production", () => {
  const status = read("app/routes/app.api.status.jsx");
  const packages = read("app/routes/app.packages.jsx");

  assert.match(status, /activeSubscriptions\.some\(/);
  assert.match(status, /subscription\.status === "ACTIVE"/);
  assert.match(status, /subscriptions:\s*activeSubscriptions/);
  assert.doesNotMatch(
    status,
    /isProductionBilling\(\)[\s\S]{0,160}filter\(\(subscription\) => !subscription\.test\)/
  );

  // New production charges remain real; only existing active test/demo charges
  // are accepted as entitlement evidence.
  assert.match(status, /test:\s*!isProductionBilling\(\)/);
  assert.match(packages, /subscription\?\.status === "ACTIVE"/);
  assert.match(packages, /Active Test Plan/);
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

test("production cutover certification performs build and Worker dry-run without executing release", () => {
  const workflow = read(".github/workflows/production-cutover-contract.yml");

  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /wrangler@4\.141\.0 deploy/);
  assert.match(workflow, /--config wrangler\.production\.jsonc/);
  assert.match(workflow, /--dry-run/);
  assert.match(workflow, /production_worker_dry_run=pass/);
  assert.match(workflow, /production_release_authorized=/);
  assert.match(workflow, /production_release_state=/);
  assert.match(workflow, /released_post_cutover_verified/);
  assert.match(workflow, /production_shopify_cutover_performed=/);
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
  const acceptance = read(".github/workflows/cloudflare-production-acceptance.yml");
  const candidate = read(".github/workflows/shopify-production-cutover-version.yml");
  const release = read(".github/workflows/shopify-production-cutover-release.yml");
  const rollback = read(".github/workflows/cloudflare-production-version-rollback.yml");
  const subscriptionAudit = read("scripts/cloudflare/audit-production-subscriptions.mjs");

  assert.match(current, /client_id = "f5266ba8dba403005deb695fedad053a"/);
  assert.ok(current.includes('application_url = "https://vsn-metafields-production.up.railway.app"'));
  assert.match(target, /client_id = "f5266ba8dba403005deb695fedad053a"/);
  assert.ok(target.includes('application_url = "https://vsn-metafields-production.vertexsystemsnetwork.workers.dev"'));

  assert.equal(wrangler.name, "vsn-metafields-production");
  assert.equal(wrangler.main, "./workers/app.js");
  assert.equal(Object.hasOwn(wrangler, "routes"), false);

  assert.equal(policy.status, "released_post_cutover_verified");
  assert.equal(policy.release_authorized, false);
  assert.equal(
    policy.production_worker.certified_source_sha,
    "e706ce3cdbcc8998f4686ee039e0e59aeaa6574b"
  );
  assert.equal(
    policy.authorized_version,
    "cloudflare-production-cutover-8d201357d738-4"
  );
  assert.equal(
    policy.authorized_source_ref,
    "8d201357d738bb715dd4e53fc09d841685126aef"
  );
  assert.equal(policy.authorization_record, "github-issue-4-comment-5902461299");
  assert.equal(policy.candidate.version, policy.authorized_version);
  assert.equal(policy.candidate.source_ref, policy.authorized_source_ref);
  assert.equal(
    policy.candidate.subscription_snapshot_digest,
    "af26a6fe5b407c4ca07f05a65c6c332cad54649739961013705d0f56ebd81c76"
  );
  assert.equal(policy.candidate.subscription_shop_count, 2);
  assert.equal(policy.candidate.active_subscription_count, 2);
  assert.equal(policy.candidate.released, true);
  assert.equal(policy.shopify.live_target, "cloudflare");
  assert.equal(
    policy.shopify.live_url,
    "https://vsn-metafields-production.vertexsystemsnetwork.workers.dev"
  );
  assert.equal(policy.release.workflow_run_id, 36657352966);
  assert.equal(policy.release.version, policy.authorized_version);
  assert.equal(policy.release.source_ref, policy.authorized_source_ref);
  assert.equal(
    policy.release.pre_subscription_snapshot_digest,
    policy.candidate.subscription_snapshot_digest
  );
  assert.equal(
    policy.release.post_subscription_snapshot_digest,
    policy.candidate.subscription_snapshot_digest
  );
  assert.equal(policy.release.subscription_shop_count, 2);
  assert.equal(policy.release.active_subscription_count, 2);
  assert.equal(policy.release.pre_release_worker_health, true);
  assert.equal(policy.release.post_release_worker_health, true);
  assert.equal(policy.release.subscriptions_preserved, true);
  assert.equal(policy.release.compliance_webhooks_enqueued, 3);
  assert.equal(policy.release.railway_rollback_preserved, true);
  assert.equal(policy.shopify.preserve_app_identity, true);
  assert.equal(policy.shopify.merchant_reinstall_allowed, false);
  assert.equal(policy.billing.mutate_during_cutover, false);
  assert.equal(policy.database.provider, "neon_postgresql");
  assert.equal(policy.database.source_provider, "supabase_postgresql");
  assert.equal(policy.database.migrate_during_cutover, false);
  assert.equal(policy.database.session_migration_required, true);
  assert.equal(policy.database.session_migration_completed, true);
  assert.equal(policy.database.expected_source_session_count, 4);
  assert.equal(policy.database.session_migration_method, "direct_connector_transaction");
  assert.equal(policy.database.session_migration_source_session_count, 4);
  assert.equal(policy.database.session_migration_target_session_count, 4);
  assert.equal(policy.database.session_migration_access_token_count, 4);
  assert.equal(policy.database.session_migration_source_id_sha256, "cd2b7f872a359ea49cce397a1879c1cc4053d359b15674caa09d036d2fdb2e46");
  assert.equal(policy.database.session_migration_id_md5, "27e17f3195d48e3050d62c86c3dd17f2");
  assert.equal(policy.database.session_migration_full_row_verified, true);
  assert.equal(policy.database.runtime_connection, "pooled");
  assert.equal(policy.database.migration_connection, "direct");
  assert.equal(policy.database.staging_project_current_name, "vsn-metafields");
  assert.equal(policy.database.staging_project_canonical_name, "vsn-metafields-staging");
  assert.equal(policy.database.staging_project_rename_pending, true);
  assert.equal(policy.database.staging_endpoint_id, "ep-snowy-surf-b3gxl2wf");
  assert.equal(policy.database.production_project_name, "vsn-metafields-production");
  assert.equal(policy.database.production_project_id, "nameless-breeze-35836648");
  assert.equal(policy.database.production_project_provisioned, true);
  assert.equal(policy.database.production_endpoint_id, "ep-flat-mouse-b5z1wu54");
  assert.equal(policy.database.provisioning_workflow, "production-neon-provisioning.yml");
  assert.equal(policy.database.production_schema_provisioned, true);
  assert.equal(policy.database.production_schema_provisioning_run_id, 36635943764);
  assert.equal(policy.database.production_schema_session_count, 0);
  assert.equal(policy.database.production_schema_completed_migrations, 1);
  assert.equal(policy.database.require_empty_session_store_before_migration, true);
  assert.equal(policy.database.require_distinct_neon_projects, true);
  assert.equal(policy.rollback.keep_railway_available, false);
  assert.equal(policy.rollback.strategy, "cloudflare_worker_version");
  assert.equal(
    policy.rollback.prepared_workflow,
    "cloudflare-production-version-rollback.yml"
  );
  assert.equal(
    policy.rollback.cloudflare_rollback_version_id,
    "8a0d51eb-74d4-4041-8216-89aef63e1a52"
  );
  assert.equal(
    policy.rollback.cloudflare_rollback_source_sha,
    "c184b25628fc5c59a1110c6fe9ec49e11ce31b05"
  );
  assert.equal(policy.rollback.railway_endpoint_status, "unreachable_http_404");
  assert.equal(policy.production_worker.deployment_completed, true);
  assert.equal(policy.production_worker.acceptance_completed, true);
  assert.equal(
    policy.production_worker.accepted_source_sha,
    policy.production_worker.certified_source_sha
  );

  assert.match(validator, /authorized_not_released/);
  assert.match(validator, /released_post_cutover_verified/);
  assert.match(validator, /production_release_authorized=/);
  assert.match(deploy, /DEPLOY_PRODUCTION_WORKER_ONLY/);
  assert.match(deploy, /source_sha:/);
  assert.match(deploy, /EXPECTED_SOURCE_SHA/);
  assert.match(deploy, /git rev-parse HEAD/);
  assert.match(deploy, /fetch-depth: 0/);
  assert.match(deploy, /production_worker/);
  assert.match(deploy, /certified_source_sha/);
  assert.match(deploy, /git merge-base --is-ancestor/);
  assert.match(deploy, /git checkout --detach "\$EXPECTED_SOURCE_SHA"/);
  assert.match(deploy, /APP_COMMIT_SHA:\$EXPECTED_SOURCE_SHA/);
  assert.match(deploy, /payload\.get\("commitSha"\) != expected_source_sha/);
  assert.match(deploy, /environment: cloudflare-production/);
  assert.match(deploy, /CLOUDFLARE_ACCOUNT_ID: f63cf3af0868a5c8a0b26ebee5dd039f/);
  assert.match(deploy, /SHOPIFY_API_KEY: f5266ba8dba403005deb695fedad053a/);
  assert.match(deploy, /SHOPIFY_APP_URL: https:\/\/vsn-metafields-production\.vertexsystemsnetwork\.workers\.dev/);
  assert.match(deploy, /SCOPES: read_products,write_metaobject_definitions,write_metaobjects,write_products,read_orders/);
  assert.match(deploy, /resolve-production-neon-urls\.py/);
  assert.match(deploy, /for name in CLOUDFLARE_API_TOKEN DATABASE_URL SHOPIFY_API_SECRET/);
  assert.doesNotMatch(deploy, /for name in CLOUDFLARE_API_TOKEN DATABASE_URL DIRECT_URL SHOPIFY_API_SECRET/);
  assert.doesNotMatch(deploy, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.doesNotMatch(deploy, /secrets\.SHOPIFY_API_KEY/);
  assert.doesNotMatch(deploy, /secrets\.SHOPIFY_APP_URL/);
  assert.doesNotMatch(deploy, /secrets\.SCOPES/);
  assert.match(deploy, /prisma migrate status/);
  assert.doesNotMatch(deploy, /prisma migrate deploy/);
  assert.match(deploy, /--config wrangler\.production\.jsonc/);
  assert.match(deploy, /production_shopify_cutover_performed=false/);
  assert.match(deploy, /vsn-metafields-production-smoke\/1\.0/);
  assert.match(deploy, /for attempt in range\(1, 7\)/);
  assert.match(acceptance, /vsn-metafields-production-smoke\/1\.0/);
  assert.match(acceptance, /for attempt in range\(1, 7\)/);

  assert.match(candidate, /CREATE_PRODUCTION_CUTOVER_VERSION/);
  assert.match(candidate, /--config cloudflare-production/);
  assert.match(candidate, /--no-release/);
  assert.match(candidate, /SOURCE_PREFIX="\$\{GITHUB_SHA:0:12\}"/);
  assert.match(candidate, /candidate_source_ref=\$GITHUB_SHA/);
  assert.match(candidate, /Require accepted production Worker evidence/);
  assert.match(candidate, /audit-production-subscriptions\.mjs/);
  assert.match(candidate, /candidate_subscription_digest=/);
  assert.match(candidate, /candidate_subscription_shop_count=/);
  assert.match(candidate, /candidate_active_subscription_count=/);
  assert.match(candidate, /DATABASE_URL/);
  assert.doesNotMatch(candidate, /app release/);

  assert.match(release, /RELEASE_PRODUCTION_CUTOVER/);
  assert.match(release, /release_authorized/);
  assert.match(release, /authorized_version/);
  assert.match(release, /authorized_source_ref/);
  assert.match(release, /authorization_record/);
  assert.match(release, /cloudflare-production-cutover-/);
  assert.match(release, /--allow-updates/);
  assert.match(release, /subscription_snapshot_digest:/);
  assert.match(release, /subscription_shop_count:/);
  assert.match(release, /subscription_active_count:/);
  assert.match(release, /audit-production-subscriptions\.mjs/);
  assert.match(release, /EXPECTED_SUBSCRIPTION_SNAPSHOT_DIGEST/);
  assert.match(release, /authorized_not_released/);
  assert.match(release, /candidate\.get\("subscription_snapshot_digest"\)/);
  assert.match(release, /candidate\.get\("subscription_shop_count"\)/);
  assert.match(release, /candidate\.get\("active_subscription_count"\)/);
  assert.match(release, /production_existing_subscriptions_preserved=pass/);
  assert.match(release, /vsn-metafields-production-release-smoke\/1\.0/);
  assert.match(release, /vsn-metafields-production-post-release-smoke\/1\.0/);
  assert.match(release, /for attempt in range\(1, 7\)/);
  assert.doesNotMatch(release, /--allow-deletes/);

  assert.match(subscriptionAudit, /currentAppInstallation/);
  assert.match(subscriptionAudit, /activeSubscriptions/);
  assert.match(subscriptionAudit, /"isOnline" = false/);
  assert.match(subscriptionAudit, /X-Shopify-Access-Token/);
  assert.match(subscriptionAudit, /createHash\("sha256"\)/);
  assert.match(subscriptionAudit, /EXPECTED_SUBSCRIPTION_SNAPSHOT_DIGEST/);
  assert.match(subscriptionAudit, /production_existing_subscriptions_preserved=pass/);
  assert.match(subscriptionAudit, /production_subscription_credentials_logged=false/);
  assert.doesNotMatch(subscriptionAudit, /appSubscriptionCreate|appSubscriptionCancel/);

  assert.match(rollback, /ROLLBACK_CLOUDFLARE_PRODUCTION_VERSION/);
  assert.match(rollback, /REQUESTED_ROLLBACK_VERSION_ID/);
  assert.match(rollback, /wrangler@4\.141\.0 rollback/);
  assert.match(rollback, /production_cloudflare_version_rollback=pass/);
  assert.match(rollback, /production_shopify_config_mutation_performed=false/);
  assert.match(rollback, /production_billing_mutation_performed=false/);
  assert.match(rollback, /production_database_mutation_performed=false/);

  for (const workflow of [deploy, candidate, release, rollback]) {
    assert.doesNotMatch(workflow, /appSubscriptionCreate/);
    assert.doesNotMatch(workflow, /appSubscriptionCancel/);
  }
});

test("production Neon pooled URL safely derives the direct URL", () => {
  const resolver = read("scripts/database/resolve-production-neon-urls.py");

  assert.match(resolver, /DATABASE_URL/);
  assert.match(resolver, /DIRECT_URL/);
  assert.match(resolver, /TARGET_DIRECT_URL/);
  assert.match(resolver, /EXPECTED_PRODUCTION_ENDPOINT_ID/);
  assert.match(resolver, /removesuffix\("-pooler"\)/);
  assert.match(resolver, /replace\("-pooler\.", "\.", 1\)/);
  assert.match(resolver, /::add-mask::/);
  assert.match(resolver, /GITHUB_ENV/);
  assert.match(resolver, /Production|Neon|production_neon_endpoint_id/);
});

test("production Neon provisioning is manual, isolated, and schema-only", () => {
  const workflow = read(".github/workflows/production-neon-provisioning.yml");

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\npush:/);
  assert.match(workflow, /PROVISION_ISOLATED_NEON_PRODUCTION/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /environment: cloudflare-production/);
  assert.match(workflow, /resolve-production-neon-urls\.py/);
  assert.match(workflow, /for name in DATABASE_URL/);
  assert.doesNotMatch(workflow, /for name in DATABASE_URL DIRECT_URL/);
  assert.match(workflow, /EXPECTED_PRODUCTION_ENDPOINT_ID/);
  assert.match(workflow, /production_project_provisioned/);
  assert.match(workflow, /production_endpoint_id/);
  assert.match(workflow, /Requested production endpoint does not match repository policy/);
  assert.match(workflow, /STAGING_NEON_ENDPOINT_ID: ep-snowy-surf-b3gxl2wf/);
  assert.match(workflow, /PRODUCTION_NEON_PROJECT_NAME: vsn-metafields-production/);
  assert.match(workflow, /Production Neon endpoint must differ from staging/);
  assert.match(workflow, /Production DATABASE_URL must use the pooled Neon endpoint/);
  assert.match(workflow, /Production DIRECT_URL must use the direct Neon endpoint/);
  assert.match(workflow, /production_neon_preexisting_sessions=0/);
  assert.match(workflow, /npx prisma migrate deploy/);
  assert.match(workflow, /npx prisma migrate status/);
  assert.match(workflow, /production_neon_schema=pass/);
  assert.match(workflow, /production_session_rows_before_migration=0/);
  assert.match(workflow, /production_shopify_cutover_performed=false/);
  assert.match(workflow, /production_billing_mutation_performed=false/);
  assert.doesNotMatch(workflow, /appSubscriptionCreate|appSubscriptionCancel|shopify app release/);
});

test("Neon staging and production identities stay isolated", () => {
  const staging = read(".github/workflows/cloudflare-staging-deploy.yml");
  const migration = read(".github/workflows/production-session-migration.yml");
  const deploy = read(".github/workflows/cloudflare-production-deploy.yml");
  const acceptance = read(".github/workflows/cloudflare-production-acceptance.yml");

  assert.match(staging, /STAGING_NEON_ENDPOINT_ID: ep-snowy-surf-b3gxl2wf/);
  assert.match(staging, /staging_neon_identity=pass/);
  assert.match(staging, /pooled_id != expected or direct_id != expected/);
  assert.match(staging, /Staging DATABASE_URL must use the pooled Neon endpoint/);
  assert.match(staging, /Staging DIRECT_URL must use the direct Neon endpoint/);

  for (const workflow of [migration, deploy, acceptance]) {
    assert.match(workflow, /STAGING_NEON_ENDPOINT_ID: ep-snowy-surf-b3gxl2wf/);
    assert.match(workflow, /PRODUCTION_NEON_PROJECT_NAME: vsn-metafields-production/);
    assert.match(workflow, /production_project_provisioned/);
    assert.match(workflow, /production_endpoint_id/);
    assert.match(workflow, /pooled_id == staging_id/);
    assert.match(workflow, /pooled_id != production_id/);
    assert.match(workflow, /production_neon_identity=certified_and_distinct/);
    assert.match(workflow, /Production DATABASE_URL must use the pooled Neon endpoint/);
    assert.match(workflow, /Production DIRECT_URL must use the direct Neon endpoint/);
  }
});

test("production Supabase source requires the exact Connect-dialog pooler URL", () => {
  const workflow = read(".github/workflows/production-session-migration.yml");
  const resolver = read("scripts/database/resolve-production-supabase-source.py");

  assert.match(workflow, /EXPECTED_SUPABASE_PROJECT_REF: kqwlohmfyobsdsdekjzl/);
  assert.match(workflow, /EXPECTED_SUPABASE_REGION: ap-southeast-2/);
  assert.match(resolver, /EXPECTED_PROJECT_REF = "kqwlohmfyobsdsdekjzl"/);
  assert.match(resolver, /host\.endsWith|host\.endswith/);
  assert.match(resolver, /\.pooler\.supabase\.com/);
  assert.match(resolver, /aws-\\d\+-\[a-z0-9-\]\+\\\.pooler\\\.supabase\\\.com/);
  assert.match(resolver, /expected_username = f"postgres\.\{EXPECTED_PROJECT_REF\}"/);
  assert.match(resolver, /ALLOWED_POOLER_PORTS = \{5432, 6543\}/);
  assert.match(resolver, /sslmode=require&uselibpqcompat=true/);
  assert.match(resolver, /remainder\.rsplit\("@", 1\)/);
  assert.match(resolver, /raw_userinfo\.split\(":", 1\)/);
  assert.match(resolver, /password_candidates = \[\("raw_literal", raw_password\)\]/);
  assert.match(resolver, /decoded_password = unquote\(raw_password\)/);
  assert.match(resolver, /percent_decoded/);
  assert.match(resolver, /quote\(password, safe=""\)/);
  assert.match(resolver, /SOURCE_DATABASE_URL_CANDIDATE_/);
  assert.match(resolver, /SOURCE_DATABASE_URL_CANDIDATE_COUNT=/);
  assert.match(resolver, /exact_supabase_connect_pooler_/);
  assert.match(resolver, /production_supabase_password_interpretations=/);
  assert.match(resolver, /::add-mask::/);
  assert.doesNotMatch(resolver, /aws-0-ap-southeast-2\.pooler\.supabase\.com/);
  assert.doesNotMatch(resolver, /sslmode=disable/);
  assert.doesNotMatch(resolver, /print\(.*password/i);
});

test("production session migration is guarded, transactional, and preserves secret session fields", () => {
  const workflow = read(".github/workflows/production-session-migration.yml");
  const script = read("scripts/database/migrate-production-sessions.mjs");
  const deploy = read(".github/workflows/cloudflare-production-deploy.yml");

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\npush:/);
  assert.match(workflow, /MIGRATE_SUPABASE_SESSIONS_TO_NEON/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /environment: cloudflare-production/);
  assert.match(workflow, /SUPABASE_SOURCE_DATABASE_URL/);
  assert.match(workflow, /resolve-production-neon-urls\.py/);
  assert.match(workflow, /TARGET_DIRECT_URL/);
  assert.doesNotMatch(workflow, /SUPABASE_SOURCE_DATABASE_URL DATABASE_URL DIRECT_URL/);
  assert.match(workflow, /EXPECTED_SOURCE_SESSION_COUNT/);
  assert.match(workflow, /EXPECTED_SUPABASE_PROJECT_REF: kqwlohmfyobsdsdekjzl/);
  assert.match(workflow, /EXPECTED_SOURCE_ID_DIGEST: cd2b7f872a359ea49cce397a1879c1cc4053d359b15674caa09d036d2fdb2e46/);
  assert.match(workflow, /production_schema_provisioned/);
  assert.match(workflow, /production_session_credentials_logged=false/);
  assert.match(workflow, /production_shopify_cutover_performed=false/);
  assert.match(workflow, /production_billing_mutation_performed=false/);
  assert.doesNotMatch(workflow, /appSubscriptionCreate|appSubscriptionCancel|shopify app release/);

  assert.match(script, /EXPECTED_SUPABASE_PROJECT_REF/);
  assert.match(script, /\["postgres:", "postgresql:"\]\.includes\(source\.protocol\)/);
  assert.doesNotMatch(script, /Source database must use a Supabase-managed direct or shared-pooler endpoint/);
  assert.match(script, /EXPECTED_SOURCE_ID_DIGEST/);
  assert.match(script, /sourceTokenCount/);
  assert.match(script, /sourceIdDigest/);
  assert.ok(script.includes("neon\\.tech"));
  assert.match(script, /TARGET_DIRECT_URL must use the direct Neon endpoint/);
  assert.match(script, /begin/);
  assert.match(script, /commit/);
  assert.match(script, /rollback/);
  assert.match(script, /on conflict \("id"\) do update/);
  assert.match(script, /aggregateDigest/);
  assert.match(script, /production_session_source_identity=audited/);
  assert.match(script, /production_session_source_route=/);
  assert.match(script, /await main\(\)/);
  assert.doesNotMatch(script, /main\(\)\.catch/);
  assert.match(script, /connectionTimeoutMillis: 10000/);
  assert.match(script, /query_timeout: 10000/);
  assert.match(script, /connectAuditedSource/);
  assert.match(script, /sourceCandidates/);
  assert.match(script, /SOURCE_DATABASE_URL_CANDIDATE_COUNT/);
  assert.match(script, /status=attempting/);
  assert.match(script, /status=connected/);
  assert.match(script, /status=audited/);
  assert.match(script, /status=rejected/);
  assert.match(script, /No certified Supabase source connection candidate passed the audited Session checks/);
  assert.match(script, /production_session_target_connection=attempting/);
  assert.match(script, /production_session_target_connection=connected/);
  assert.match(script, /accessToken/);
  assert.match(script, /refreshToken/);
  assert.doesNotMatch(script, /console\.log\(row/);

  assert.match(deploy, /production_schema_provisioned/);
  assert.match(deploy, /session_migration_completed/);
  assert.match(deploy, /production_neon_session_migration=certified/);
});

test("production offline-token migration is explicit, guarded, and billing-safe", () => {
  const workflow = read(".github/workflows/production-offline-token-migration.yml");
  const script = read("scripts/database/migrate-production-offline-tokens.mjs");

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\npush:/);
  assert.match(workflow, /MIGRATE_PRODUCTION_OFFLINE_TOKENS/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /environment: cloudflare-production/);
  assert.match(workflow, /SHOPIFY_API_SECRET/);
  assert.match(workflow, /DATABASE_URL/);
  assert.match(workflow, /production_shopify_live_target=railway/);
  assert.match(workflow, /production_shopify_cutover_performed=false/);
  assert.doesNotMatch(workflow, /app release|appSubscriptionCreate|appSubscriptionCancel/);

  assert.match(script, /legacy_non_expiring_token_rejected/);
  assert.match(script, /urn:ietf:params:oauth:grant-type:token-exchange/);
  assert.match(script, /urn:shopify:params:oauth:token-type:offline-access-token/);
  assert.match(script, /expiring:\s*"1"/);
  assert.match(script, /refresh_token/);
  assert.match(script, /refresh_token_expires_in/);
  assert.match(script, /production_offline_token_migration=pass/);
  assert.match(script, /production_billing_mutation_performed=false/);
  assert.match(script, /production_shopify_reinstall_required=false/);
  assert.doesNotMatch(script, /console\.log\(row/);
  assert.doesNotMatch(script, /appSubscriptionCreate|appSubscriptionCancel/);
});

test("production Worker acceptance gate is independent, read-only, and keeps Railway live", () => {
  const acceptance = read(".github/workflows/cloudflare-production-acceptance.yml");
  const contract = read(".github/workflows/production-cutover-contract.yml");
  const validator = read("scripts/cloudflare/validate_production_cutover_contract.py");

  assert.match(acceptance, /workflow_dispatch:/);
  assert.doesNotMatch(acceptance, /\npush:/);
  assert.match(acceptance, /VERIFY_PRODUCTION_WORKER_ONLY/);
  assert.match(acceptance, /source_sha:/);
  assert.match(acceptance, /EXPECTED_SOURCE_SHA/);
  assert.match(acceptance, /certified_source_sha/);
  assert.match(acceptance, /payload\.get\("commitSha"\) != expected_source_sha/);
  assert.match(acceptance, /production_worker_source_sha=/);
  assert.match(acceptance, /github\.ref == 'refs\/heads\/main'/);
  assert.match(acceptance, /ref: main/);
  assert.match(acceptance, /environment: cloudflare-production/);
  assert.match(acceptance, /resolve-production-neon-urls\.py/);
  assert.match(acceptance, /for name in DATABASE_URL/);
  assert.doesNotMatch(acceptance, /for name in DATABASE_URL DIRECT_URL/);
  assert.match(acceptance, /prisma migrate status/);
  assert.doesNotMatch(acceptance, /prisma migrate deploy/);
  assert.match(acceptance, /prisma\.session\.count\(\)/);
  assert.match(acceptance, /production_session_table_read=pass/);
  assert.match(acceptance, /production_worker_health=pass/);
  assert.match(acceptance, /production_billing_metadata=pass/);
  assert.match(acceptance, /production_shopify_live_target=railway/);
  assert.match(acceptance, /production_release_authorized=false/);
  assert.match(acceptance, /production_shopify_cutover_performed=false/);
  assert.match(acceptance, /production_billing_mutation_performed=false/);
  assert.match(acceptance, /production_schema_provisioned/);
  assert.match(acceptance, /session_migration_completed/);
  assert.doesNotMatch(acceptance, /wrangler@|wrangler\s+deploy/);
  assert.doesNotMatch(acceptance, /app release/);
  assert.doesNotMatch(acceptance, /appSubscriptionCreate/);
  assert.doesNotMatch(acceptance, /appSubscriptionCancel/);

  const acceptancePathMatches =
    contract.match(/\.github\/workflows\/cloudflare-production-acceptance\.yml/g) || [];
  assert.equal(acceptancePathMatches.length, 2);

  assert.match(validator, /ACCEPTANCE/);
  assert.match(validator, /production acceptance must remain manual-only/);
  assert.match(validator, /production acceptance must never deploy the Worker/);
  assert.match(validator, /production acceptance must never release Shopify config/);
});

test("all production mutation workflows require protected main dispatch and checkout", () => {
  const workflows = [
    read(".github/workflows/cloudflare-production-deploy.yml"),
    read(".github/workflows/production-neon-provisioning.yml"),
    read(".github/workflows/production-session-migration.yml"),
    read(".github/workflows/shopify-production-cutover-version.yml"),
    read(".github/workflows/shopify-production-cutover-release.yml"),
    read(".github/workflows/cloudflare-production-version-rollback.yml"),
  ];

  for (const workflow of workflows) {
    assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
    assert.match(workflow, /ref: main/);
    assert.match(workflow, /workflow_dispatch:/);
    assert.doesNotMatch(workflow, /\npush:/);
  }
});


test("destructive global session-clear route stays absent", () => {
  assert.equal(exists("app/routes/clear-sessions.jsx"), false);
});


test("staging session reset is isolated from the production shop", () => {
  const reset = read("scripts/cloudflare/reset-staging-sessions.mjs");
  const workflow = read(".github/workflows/cloudflare-staging-session-reset.yml");

  assert.match(reset, /PRODUCTION_SHOP = "vertex-systems-network\.myshopify\.com"/);
  assert.match(reset, /shop !== PRODUCTION_SHOP/);
  assert.match(reset, /stagingShops\.length !== 1/);
  assert.match(reset, /deleteMany\(\{/);
  assert.match(reset, /where: \{ shop \}/);
  assert.match(reset, /productionShopTouched: false/);

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /RESET_STAGING_SESSIONS_ONLY/);
  assert.match(workflow, /environment: cloudflare-staging/);
  assert.match(workflow, /ref: development/);
  assert.doesNotMatch(workflow, /\npush:/);
  assert.doesNotMatch(workflow, /cloudflare-production/);
});


test("expiring offline Shopify tokens are enabled for public Admin API access", () => {
  const shopify = read("app/shopify.server.js");
  const schema = read("prisma/schema.prisma");

  assert.match(shopify, /future:\s*\{[\s\S]*expiringOfflineAccessTokens:\s*true/);
  assert.match(schema, /refreshToken\s+String\?/);
  assert.match(schema, /refreshTokenExpires\s+DateTime\?/);
});


test("production cutover preflight watches runtime-critical release paths", () => {
  const workflow = read(".github/workflows/production-cutover-contract.yml");

  assert.match(workflow, /app\/shopify\.server\.js/);
  assert.match(workflow, /app\/billing-config\.js/);
  assert.match(workflow, /app\/routes\/healthz\.jsx/);
  assert.match(workflow, /app\/db\.server\.js/);
  assert.match(workflow, /app\/prisma-session-storage\.server\.js/);
  assert.match(workflow, /prisma\/schema\.prisma/);
  assert.match(workflow, /prisma\/migrations\/\*\*/);
  assert.match(workflow, /package\.json/);
  assert.match(workflow, /package-lock\.json/);
  assert.match(workflow, /workers\/\*\*/);
  assert.match(workflow, /production-neon-provisioning\.yml/);
  assert.match(workflow, /production-session-migration\.yml/);
  assert.match(workflow, /migrate-production-sessions\.mjs/);
  assert.match(workflow, /resolve-production-neon-urls\.py/);
  assert.match(workflow, /refresh-production-offline-tokens\.mjs/);
});


test("production rollback window closure is time-gated and evidence-based", () => {
  const policy = JSON.parse(read("config/cloudflare/production-cutover.json"));
  const workflow = read(".github/workflows/production-rollback-window-certification.yml");
  const sessionAudit = read("scripts/cloudflare/audit-production-session-readiness.mjs");
  const rollback = policy.rollback;
  const window = rollback.window;

  assert.equal(policy.status, "released_post_cutover_verified");
  assert.equal(rollback.keep_railway_available, false);
  assert.equal(rollback.strategy, "cloudflare_worker_version");
  assert.equal(
    rollback.prepared_workflow,
    "cloudflare-production-version-rollback.yml"
  );
  assert.equal(
    rollback.cloudflare_rollback_version_id,
    "8a0d51eb-74d4-4041-8216-89aef63e1a52"
  );
  assert.equal(window.status, "closed");
  assert.equal(window.opened_at, "2026-09-30T08:31:09Z");
  assert.equal(window.minimum_hours, 24);
  assert.equal(window.earliest_close_at, "2026-10-01T08:31:09Z");
  assert.equal(
    window.certification_workflow,
    "production-rollback-window-certification.yml"
  );
  assert.equal(window.closure_authorized, true);
  assert.equal(window.certification_run_id, 36926166869);
  assert.ok(Date.parse(window.certified_at) >= Date.parse(window.earliest_close_at));
  assert.ok(Date.parse(window.closed_at) >= Date.parse(window.certified_at));
  assert.equal(window.cloudflare_rollback_version_cleanup_performed, false);
  assert.equal(window.supabase_cleanup_performed, false);
  assert.equal(window.reset_at, "2026-09-30T08:31:09Z");
  assert.equal(window.reset_run_id, 36690095989);
  assert.equal(window.reset_reason, "production_runtime_entitlement_hotfix_accepted");
  for (const value of Object.values(window.criteria)) {
    assert.equal(value, true);
  }

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\npush:/);
  assert.match(workflow, /CERTIFY_ROLLBACK_WINDOW_CLOSURE/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /environment: cloudflare-production/);
  assert.match(workflow, /earliest_close_at/);
  assert.match(workflow, /rollback_window_elapsed=pass/);
  assert.match(
    workflow,
    /vsn-metafields-production\.vertexsystemsnetwork\.workers\.dev\/healthz/
  );
  assert.match(workflow, /wrangler@4\.141\.0 versions view/);
  assert.match(workflow, /ROLLBACK_VERSION_ID/);
  assert.match(workflow, /audit-production-subscriptions\.mjs/);
  assert.match(workflow, /SHOPIFY_API_SECRET: \$\{\{ secrets\.SHOPIFY_API_SECRET \}\}/);
  assert.match(workflow, /Refresh expiring production offline Shopify credentials/);
  assert.ok(
    workflow.indexOf("refresh-production-offline-tokens.mjs") <
      workflow.indexOf("audit-production-subscriptions.mjs"),
    "Offline tokens must be refreshed and verified before subscription audit."
  );
  assert.match(workflow, /audit-production-session-readiness\.mjs/);
  assert.match(workflow, /production_rollback_window_certification=pass/);
  assert.match(workflow, /production_rollback_window_closure_eligible=true/);
  assert.match(
    workflow,
    /production_cloudflare_rollback_version_cleanup_performed=false/
  );
  assert.match(workflow, /production_supabase_cleanup_performed=false/);
  assert.doesNotMatch(
    workflow,
    /app release|appSubscriptionCreate|appSubscriptionCancel/
  );

  assert.match(sessionAudit, /production_session_readiness=pass/);
  assert.match(sessionAudit, /production_session_credentials_logged=false/);
  assert.match(sessionAudit, /"isOnline" = false/);
  assert.match(sessionAudit, /"refreshToken" IS NOT NULL/);
  assert.match(sessionAudit, /"refreshTokenExpires" IS NOT NULL/);
  assert.doesNotMatch(sessionAudit, /console\.log\(row/);
});


test("production runtime entitlement hotfix is exact-source and subscription-safe", () => {
  const policy = JSON.parse(read("config/cloudflare/production-cutover.json"));
  const hotfix = read(".github/workflows/cloudflare-production-runtime-hotfix.yml");
  const refresh = read("scripts/database/refresh-production-offline-tokens.mjs");
  const rollbackWindow = read(".github/workflows/production-rollback-window-certification.yml");

  assert.equal(policy.runtime_update.status, "accepted");
  assert.equal(
    policy.runtime_update.reason,
    "restore_existing_active_test_subscription_entitlement"
  );
  assert.equal(
    policy.runtime_update.target_source_sha,
    "e706ce3cdbcc8998f4686ee039e0e59aeaa6574b"
  );
  assert.equal(policy.runtime_update.shopify_config_mutation_allowed, false);
  assert.equal(policy.runtime_update.billing_mutation_allowed, false);
  assert.equal(policy.runtime_update.database_mutation_allowed, false);
  assert.equal(policy.runtime_update.session_credential_refresh_allowed, true);
  assert.deepEqual(policy.runtime_update.session_credential_refresh_fields, [
    "accessToken",
    "expires",
    "refreshToken",
    "refreshTokenExpires",
    "scope",
  ]);
  assert.equal(policy.runtime_update.preserve_subscription_snapshot, true);
  assert.equal(policy.runtime_update.reset_rollback_window_after_success, true);
  assert.equal(policy.runtime_update.previous_source_sha, "c184b25628fc5c59a1110c6fe9ec49e11ce31b05");
  assert.equal(policy.runtime_update.current_source_sha, "e706ce3cdbcc8998f4686ee039e0e59aeaa6574b");
  assert.equal(policy.runtime_update.deployment_run_id, 36688847964);
  assert.equal(
    policy.runtime_update.deployment_cloudflare_version_id,
    "f25977a9-b02e-492c-9e01-6d3de120c5a8"
  );
  assert.equal(policy.runtime_update.acceptance_run_id, 36690095989);
  assert.equal(policy.runtime_update.accepted, true);
  assert.equal(policy.runtime_update.accepted_at, "2026-09-30T08:31:09Z");
  assert.equal(
    policy.runtime_update.acceptance_subscription_snapshot_digest,
    "af26a6fe5b407c4ca07f05a65c6c332cad54649739961013705d0f56ebd81c76"
  );
  assert.equal(policy.runtime_update.acceptance_subscription_shop_count, 2);
  assert.equal(policy.runtime_update.acceptance_active_subscription_count, 2);
  assert.equal(policy.runtime_update.acceptance_worker_health, true);
  assert.equal(policy.runtime_update.acceptance_billing_metadata, true);
  assert.equal(policy.runtime_update.acceptance_cloudflare_rollback_available, true);
  assert.equal(policy.runtime_update.session_credential_refresh_run_id, 36688847964);
  assert.equal(policy.runtime_update.session_credential_refresh_performed, true);
  assert.equal(
    policy.production_worker.certified_source_sha,
    "e706ce3cdbcc8998f4686ee039e0e59aeaa6574b"
  );
  assert.equal(policy.production_worker.deployment_run_id, 36688847964);
  assert.equal(
    policy.production_worker.cloudflare_version_id,
    "f25977a9-b02e-492c-9e01-6d3de120c5a8"
  );
  assert.equal(policy.production_worker.acceptance_run_id, 36690095989);
  assert.equal(
    policy.production_worker.accepted_source_sha,
    "e706ce3cdbcc8998f4686ee039e0e59aeaa6574b"
  );

  assert.match(hotfix, /workflow_dispatch:/);
  assert.doesNotMatch(hotfix, /\npush:/);
  assert.match(hotfix, /DEPLOY_PRODUCTION_RUNTIME_HOTFIX/);
  assert.match(hotfix, /github\.ref == 'refs\/heads\/main'/);
  assert.match(hotfix, /ref: main/);
  assert.match(hotfix, /environment: cloudflare-production/);
  assert.match(hotfix, /EXPECTED_SOURCE_SHA/);
  assert.match(hotfix, /target_source_sha/);
  assert.match(hotfix, /git merge-base --is-ancestor/);
  assert.match(hotfix, /git checkout --detach/);
  assert.match(hotfix, /audit-production-subscriptions\.mjs/);
  assert.match(hotfix, /production_runtime_hotfix_pre_health=pass/);
  assert.match(hotfix, /HOTFIX_ALREADY_LIVE/);
  assert.match(hotfix, /production_runtime_hotfix_resume_state=/);
  assert.match(hotfix, /if: env\.HOTFIX_ALREADY_LIVE != 'true'/);
  assert.match(hotfix, /production_runtime_hotfix_already_live=\$HOTFIX_ALREADY_LIVE/);
  assert.match(hotfix, /production_runtime_hotfix_post_health=pass/);
  assert.match(hotfix, /production_runtime_hotfix_subscriptions_preserved=pass/);
  assert.match(hotfix, /production_runtime_hotfix_cloudflare_rollback=pass/);
  assert.match(hotfix, /production_shopify_config_mutation_performed=false/);
  assert.match(hotfix, /production_billing_mutation_performed=false/);
  assert.match(hotfix, /refresh-production-offline-tokens\.mjs/);
  assert.match(hotfix, /production_session_credential_refresh_authorized=true/);
  assert.match(hotfix, /production_subscription_mutation_performed=false/);
  assert.match(hotfix, /production_schema_or_business_data_mutation_performed=false/);
  assert.match(hotfix, /production_session_credential_refresh_performed=\$SESSION_CREDENTIAL_REFRESH_PERFORMED/);
  assert.match(hotfix, /production_merchant_reinstall_required=false/);
  assert.match(hotfix, /production_rollback_window_reset_required=true/);
  assert.match(hotfix, /wrangler@4\.141\.0 deploy/);
  assert.match(
    hotfix,
    /SHOPIFY_APP_URL:\s*https:\/\/vsn-metafields-production\.vertexsystemsnetwork\.workers\.dev/
  );
  assert.doesNotMatch(hotfix, /npx --yes @shopify\/cli/);
  assert.doesNotMatch(hotfix, /appSubscriptionCreate|appSubscriptionCancel/);
  assert.doesNotMatch(hotfix, /prisma migrate deploy/);
  assert.doesNotMatch(hotfix, /--allow-deletes/);

  assert.match(refresh, /grant_type:\s*"refresh_token"/);
  assert.match(refresh, /refresh_token:\s*refreshToken/);
  assert.match(refresh, /"refreshToken" = \$3/);
  assert.match(refresh, /"refreshTokenExpires" = \$4/);
  assert.match(refresh, /AND "refreshToken" = \$7/);
  assert.match(refresh, /production_offline_token_refresh=pass/);
  assert.match(refresh, /production_subscription_mutation_performed=false/);
  assert.match(refresh, /production_schema_mutation_performed=false/);
  assert.doesNotMatch(refresh, /console\.log\(row/);

  assert.match(
    rollbackWindow,
    /Rollback-window closure is blocked while a production runtime hotfix is pending acceptance/
  );
});
