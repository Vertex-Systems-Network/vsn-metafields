#!/usr/bin/env python3
"""Validate the prepared production cutover contract without authorizing release."""

from __future__ import annotations

import json
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POLICY = ROOT / "config" / "cloudflare" / "production-cutover.json"
WRANGLER = ROOT / "wrangler.production.jsonc"
SHOPIFY_CURRENT = ROOT / "shopify.app.toml"
SHOPIFY_TARGET = ROOT / "shopify.app.cloudflare-production.toml"
STAGING_DEPLOY = ROOT / ".github" / "workflows" / "cloudflare-staging-deploy.yml"
DEPLOY = ROOT / ".github" / "workflows" / "cloudflare-production-deploy.yml"
ACCEPTANCE = ROOT / ".github" / "workflows" / "cloudflare-production-acceptance.yml"
CANDIDATE = ROOT / ".github" / "workflows" / "shopify-production-cutover-version.yml"
RELEASE = ROOT / ".github" / "workflows" / "shopify-production-cutover-release.yml"
ROLLBACK = ROOT / ".github" / "workflows" / "shopify-production-rollback-railway.yml"
PRODUCTION_NEON_PROVISIONING = ROOT / ".github" / "workflows" / "production-neon-provisioning.yml"
SESSION_MIGRATION = ROOT / ".github" / "workflows" / "production-session-migration.yml"
SESSION_MIGRATION_SCRIPT = ROOT / "scripts" / "database" / "migrate-production-sessions.mjs"
NEON_URL_RESOLVER = ROOT / "scripts" / "database" / "resolve-production-neon-urls.py"
SUPABASE_SOURCE_RESOLVER = ROOT / "scripts" / "database" / "resolve-production-supabase-source.py"


class ValidationError(RuntimeError):
    pass


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_json(path: Path) -> dict[str, object]:
    value = json.loads(read(path))
    if not isinstance(value, dict):
        raise ValidationError(f"expected JSON object: {path}")
    return value


def load_toml(path: Path) -> dict[str, object]:
    with path.open("rb") as handle:
        value = tomllib.load(handle)
    if not isinstance(value, dict):
        raise ValidationError(f"expected TOML object: {path}")
    return value


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def main() -> int:
    policy = load_json(POLICY)
    wrangler = load_json(WRANGLER)
    current = load_toml(SHOPIFY_CURRENT)
    target = load_toml(SHOPIFY_TARGET)
    staging_deploy = read(STAGING_DEPLOY)
    deploy = read(DEPLOY)
    acceptance = read(ACCEPTANCE)
    candidate = read(CANDIDATE)
    release = read(RELEASE)
    rollback = read(ROLLBACK)
    production_neon_provisioning = read(PRODUCTION_NEON_PROVISIONING)
    session_migration = read(SESSION_MIGRATION)
    session_migration_script = read(SESSION_MIGRATION_SCRIPT)
    neon_url_resolver = read(NEON_URL_RESOLVER)
    supabase_source_resolver = read(SUPABASE_SOURCE_RESOLVER)

    require(policy.get("schema_version") == 1, "unsupported production cutover schema")
    require(policy.get("issue") == 4, "production cutover policy must target Issue #4")
    require(policy.get("status") == "prepared_not_authorized", "production cutover status drifted")
    require(policy.get("release_authorized") is False, "production release must remain unauthorized during preparation")
    require(policy.get("authorized_version") is None, "authorized production version must remain unset during preparation")
    require(policy.get("authorized_source_ref") is None, "authorized production source ref must remain unset during preparation")
    require(policy.get("authorization_record") is None, "production authorization record must remain unset during preparation")

    worker = policy.get("production_worker")
    shopify = policy.get("shopify")
    billing = policy.get("billing")
    database = policy.get("database")
    rollback_policy = policy.get("rollback")
    require(isinstance(worker, dict), "production worker policy missing")
    require(isinstance(shopify, dict), "production Shopify policy missing")
    require(isinstance(billing, dict), "production billing policy missing")
    require(isinstance(database, dict), "production database policy missing")
    require(isinstance(rollback_policy, dict), "rollback policy missing")

    client_id = str(shopify["client_id"])
    railway_url = str(shopify["current_railway_url"])
    cloudflare_url = str(shopify["target_cloudflare_url"])
    certified_source_sha = worker.get("certified_source_sha")
    require(
        isinstance(certified_source_sha, str)
        and re.fullmatch(r"[0-9a-f]{40}", certified_source_sha) is not None,
        "production Worker certified source SHA missing or invalid",
    )

    require(current.get("client_id") == client_id, "current production Shopify client_id drifted")
    require(target.get("client_id") == client_id, "Cloudflare production config must preserve Shopify client_id")
    require(current.get("application_url") == railway_url, "Railway must remain current production URL during preparation")
    require(target.get("application_url") == cloudflare_url, "Cloudflare production target URL drifted")
    require(shopify.get("preserve_app_identity") is True, "Shopify app identity must be preserved")
    require(shopify.get("merchant_reinstall_allowed") is False, "merchant reinstall must remain forbidden")

    auth = target.get("auth")
    require(isinstance(auth, dict), "target auth config missing")
    redirects = auth.get("redirect_urls")
    require(isinstance(redirects, list) and redirects, "target redirect URLs missing")
    require(all(str(value).startswith(cloudflare_url + "/") for value in redirects), "target redirects must stay on Cloudflare production URL")

    require(wrangler.get("name") == worker.get("name") == "vsn-metafields-production", "production Worker name drifted")
    require(wrangler.get("main") == "./workers/app.js", "production Worker entry drifted")
    require("routes" not in wrangler and "route" not in wrangler, "production Worker preparation must not bind production routes")
    require(worker.get("public_route_binding") is False, "public production route binding must remain disabled during preparation")

    require(billing.get("mutate_during_cutover") is False, "billing mutations must remain forbidden during cutover")
    require(billing.get("status_source") == "currentAppInstallation.activeSubscriptions", "subscription status source drifted")
    require(database.get("provider") == "neon_postgresql", "production database target must be Neon PostgreSQL")
    require(database.get("source_provider") == "supabase_postgresql", "production session migration source must remain Supabase PostgreSQL")
    require(database.get("migrate_during_cutover") is False, "production cutover must not apply schema migrations")
    require(database.get("require_migration_status_clean") is True, "production migration status preflight is required")
    require(database.get("session_migration_required") is True, "production session migration must remain required")
    require(isinstance(database.get("session_migration_completed"), bool), "production session migration completion state missing")
    require(database.get("expected_source_session_count") == 4, "audited production source Session count drifted")
    require(database.get("migration_workflow") == "production-session-migration.yml", "production session migration workflow drifted")
    require(database.get("runtime_connection") == "pooled", "production Neon runtime must use pooled connection")
    require(database.get("migration_connection") == "direct", "production Neon migrations must use direct connection")
    require(database.get("staging_project_current_name") == "vsn-metafields", "current staging Neon project name drifted")
    require(database.get("staging_project_canonical_name") == "vsn-metafields-staging", "canonical staging Neon project name drifted")
    require(database.get("staging_project_rename_pending") is True, "staging Neon rename state must remain explicit until renamed")
    require(database.get("staging_endpoint_id") == "ep-snowy-surf-b3gxl2wf", "certified staging Neon endpoint drifted")
    require(database.get("production_project_name") == "vsn-metafields-production", "production Neon project name drifted")
    require(database.get("production_project_id") == "nameless-breeze-35836648", "production Neon project ID drifted")
    require(database.get("provisioning_workflow") == "production-neon-provisioning.yml", "production Neon provisioning workflow drifted")
    require(isinstance(database.get("production_schema_provisioned"), bool), "production Neon schema provisioning state missing")
    require(database.get("require_empty_session_store_before_migration") is True, "production Neon must require empty Session store before migration")
    provisioned = database.get("production_project_provisioned")
    production_endpoint_id = database.get("production_endpoint_id")
    require(isinstance(provisioned, bool), "production Neon provisioning state missing")
    if provisioned:
        require(
            isinstance(production_endpoint_id, str)
            and re.fullmatch(r"ep-[a-z0-9-]+", production_endpoint_id) is not None,
            "certified production Neon endpoint ID missing or invalid",
        )
        require(
            production_endpoint_id != database.get("staging_endpoint_id"),
            "production Neon endpoint must differ from staging",
        )
        require(
            production_endpoint_id == "ep-flat-mouse-b5z1wu54",
            "production Neon endpoint certification drifted",
        )
    else:
        require(production_endpoint_id is None, "unprovisioned production Neon endpoint must remain unset")
    require(database.get("require_distinct_neon_projects") is True, "staging and production Neon projects must remain distinct")
    require(rollback_policy.get("keep_railway_available") is True, "Railway rollback must remain available")

    workflows = [deploy, acceptance, candidate, release, rollback, production_neon_provisioning, session_migration]
    for workflow in workflows:
        require("appSubscriptionCreate" not in workflow, "production migration workflow must not create billing subscriptions")
        require("appSubscriptionCancel" not in workflow, "production migration workflow must not cancel billing subscriptions")
        require("--allow-deletes" not in workflow, "Shopify config deletes are forbidden during migration")

    require("STAGING_NEON_ENDPOINT_ID: ep-snowy-surf-b3gxl2wf" in staging_deploy, "staging deploy must pin the certified Neon endpoint")
    require("staging_neon_identity=pass" in staging_deploy, "staging Neon identity evidence missing")
    require("pooled_id != expected or direct_id != expected" in staging_deploy, "staging deploy must reject non-staging Neon endpoints")

    require("resolve-production-neon-urls.py" in production_neon_provisioning, "production Neon provisioning must resolve the direct URL safely")
    require("for name in DATABASE_URL" in production_neon_provisioning, "production Neon provisioning must require pooled DATABASE_URL")
    require("for name in DATABASE_URL DIRECT_URL" not in production_neon_provisioning, "production Neon provisioning must not require duplicate DIRECT_URL secret")
    require("workflow_dispatch:" in production_neon_provisioning and "push:" not in production_neon_provisioning, "production Neon provisioning must remain manual-only")
    require("PROVISION_ISOLATED_NEON_PRODUCTION" in production_neon_provisioning, "production Neon provisioning confirmation gate missing")
    require("github.ref == 'refs/heads/main'" in production_neon_provisioning, "production Neon provisioning must require protected main")
    require("ref: main" in production_neon_provisioning, "production Neon provisioning checkout must pin main")
    require("environment: cloudflare-production" in production_neon_provisioning, "production Neon provisioning environment missing")
    require("EXPECTED_PRODUCTION_ENDPOINT_ID" in production_neon_provisioning, "production Neon provisioning endpoint input missing")
    require("production_project_provisioned" in production_neon_provisioning, "production Neon provisioning must require repository-certified project state")
    require("production_endpoint_id" in production_neon_provisioning, "production Neon provisioning must require repository-certified endpoint")
    require("Requested production endpoint does not match repository policy." in production_neon_provisioning, "production Neon provisioning must reject uncertified endpoint input")
    require("STAGING_NEON_ENDPOINT_ID: ep-snowy-surf-b3gxl2wf" in production_neon_provisioning, "production Neon provisioning must know staging endpoint")
    require("PRODUCTION_NEON_PROJECT_NAME: vsn-metafields-production" in production_neon_provisioning, "production Neon provisioning project name missing")
    require("Production Neon endpoint must differ from staging" in production_neon_provisioning, "production Neon provisioning must reject staging endpoint")
    require("npx prisma migrate deploy" in production_neon_provisioning, "production Neon provisioning must apply Prisma schema")
    require("production_neon_schema=pass" in production_neon_provisioning, "production Neon schema verification evidence missing")
    require("production_session_rows_before_migration=0" in production_neon_provisioning, "production Neon must prove empty Session store before migration")
    require("production_shopify_cutover_performed=false" in production_neon_provisioning, "production Neon provisioning must prove no Shopify cutover")
    require("production_billing_mutation_performed=false" in production_neon_provisioning, "production Neon provisioning must prove no billing mutation")

    require("resolve-production-supabase-source.py" in session_migration, "production session migration must canonicalize the Supabase source")
    supabase_source_resolver = read(ROOT / "scripts" / "database" / "resolve-production-supabase-source.py")
    require("sslmode=require&uselibpqcompat=true" in supabase_source_resolver, "Supabase source must keep TLS required with libpq-compatible semantics")
    require("sslmode=disable" not in supabase_source_resolver, "Supabase source must never disable TLS")
    require("SOURCE_DATABASE_URL_CANDIDATE_" in supabase_source_resolver, "Supabase source resolver must export bounded route candidates")
    require("dedicated_pooler" in supabase_source_resolver, "Supabase source resolver must include the project-host pooler candidate")
    require("shared_transaction_pooler" in supabase_source_resolver, "Supabase source resolver must include shared transaction pooler")
    require("shared_session_pooler" in supabase_source_resolver, "Supabase source resolver must include shared session pooler")
    require("::add-mask::" in supabase_source_resolver, "Supabase route candidates must be masked")
    require("EXPECTED_SUPABASE_REGION: ap-southeast-2" in session_migration, "production session migration must pin the certified Supabase region")
    require("resolve-production-neon-urls.py" in session_migration, "production session migration must resolve the direct URL safely")
    require("SUPABASE_SOURCE_DATABASE_URL DATABASE_URL" in session_migration, "production session migration must require source plus pooled target")
    require("SUPABASE_SOURCE_DATABASE_URL DATABASE_URL DIRECT_URL" not in session_migration, "production session migration must not require duplicate DIRECT_URL secret")
    require("workflow_dispatch:" in session_migration and "push:" not in session_migration, "production session migration must remain manual-only")
    require("MIGRATE_SUPABASE_SESSIONS_TO_NEON" in session_migration, "production session migration confirmation gate missing")
    require("github.ref == 'refs/heads/main'" in session_migration, "production session migration must require protected main")
    require("ref: main" in session_migration, "production session migration checkout must pin main")
    require("environment: cloudflare-production" in session_migration, "production session migration environment missing")
    require("SUPABASE_SOURCE_DATABASE_URL" in session_migration, "Supabase source secret binding missing")
    require("TARGET_DIRECT_URL" in session_migration, "Neon direct target binding missing")
    require("EXPECTED_SOURCE_SESSION_COUNT" in session_migration, "audited source Session count binding missing")
    require("EXPECTED_SUPABASE_PROJECT_REF: kqwlohmfyobsdsdekjzl" in session_migration, "certified Supabase source project ref missing")
    require("EXPECTED_SOURCE_ID_DIGEST: cd2b7f872a359ea49cce397a1879c1cc4053d359b15674caa09d036d2fdb2e46" in session_migration, "audited Supabase Session identity fingerprint missing")
    require("production_session_credentials_logged=false" in session_migration, "migration workflow must record no credential logging")
    require("production_shopify_cutover_performed=false" in session_migration, "migration must prove no Shopify cutover occurred")
    require("production_billing_mutation_performed=false" in session_migration, "migration must prove no billing mutation occurred")
    require("STAGING_NEON_ENDPOINT_ID: ep-snowy-surf-b3gxl2wf" in session_migration, "production migration must know the staging Neon endpoint")
    require("PRODUCTION_NEON_PROJECT_NAME: vsn-metafields-production" in session_migration, "production migration must pin the production Neon project name")
    require("production_project_provisioned" in session_migration, "session_migration must require certified production Neon provisioning")
    require("production_schema_provisioned" in session_migration, "session migration must require certified production Neon schema provisioning")
    require("production_endpoint_id" in session_migration, "session_migration must require the certified production Neon endpoint ID")
    require("pooled_id != production_id" in session_migration, "session_migration must require URLs to match the certified production Neon endpoint")
    require("pooled_id == staging_id" in session_migration, "production migration must reject the staging Neon endpoint")
    require("production_neon_identity=certified_and_distinct" in session_migration, "production migration Neon isolation evidence missing")
    require("supabase" in session_migration_script.lower(), "session migration script must identify Supabase source")
    require("EXPECTED_SUPABASE_PROJECT_REF" in session_migration_script, "session migration script must verify Supabase project identity")
    require('["postgres:", "postgresql:"].includes(source.protocol)' in session_migration_script, "session migration script must require a PostgreSQL source URL")
    require("Source database must use a Supabase-managed direct or shared-pooler endpoint" not in session_migration_script, "source validation must not depend on brittle provider hostname formatting")
    require("EXPECTED_SOURCE_ID_DIGEST" in session_migration_script, "session migration script must verify audited source Session identity")
    require("sourceTokenCount" in session_migration_script, "session migration script must verify source access-token coverage")
    require("sourceIdDigest" in session_migration_script, "session migration script must verify source Session fingerprint")
    require("connectAuditedSource" in session_migration_script, "session migration must audit source candidates before target writes")
    require("SOURCE_DATABASE_URL_CANDIDATE_COUNT" in session_migration_script, "session migration must consume bounded source candidates")
    require("status=audited" in session_migration_script, "session migration must record audited source route")
    require("No certified Supabase source connection candidate passed the audited Session checks" in session_migration_script, "session migration must fail closed if no candidate passes")
    require("await main()" in session_migration_script, "session migration entrypoint must await completion")
    require("main().catch" not in session_migration_script, "session migration must not allow unresolved async completion")
    require("connectionTimeoutMillis: 10000" in session_migration_script, "session migration must bound database connection waits")
    require("query_timeout: 10000" in session_migration_script, "session migration must bound database queries")
    require("status=attempting" in session_migration_script, "source candidate attempt evidence missing")
    require("status=connected" in session_migration_script, "source candidate connection evidence missing")
    require("status=audited" in session_migration_script, "source candidate audit evidence missing")
    require("production_session_target_connection=connected" in session_migration_script, "target connection success evidence missing")
    require('EXPECTED_PROJECT_REF = "kqwlohmfyobsdsdekjzl"' in supabase_source_resolver, "Supabase source resolver project ref drifted")
    require('EXPECTED_REGION = "ap-southeast-2"' in supabase_source_resolver, "Supabase source resolver region drifted")
    require('SHARED_POOLER_HOST = "aws-0-ap-southeast-2.pooler.supabase.com"' in supabase_source_resolver, "Supabase shared pooler host drifted")
    require('DIRECT_HOST = f"db.{EXPECTED_PROJECT_REF}.supabase.co"' in supabase_source_resolver, "Supabase project host drifted")
    require("dedicated_pooler" in supabase_source_resolver, "Supabase dedicated/project-host pooler candidate missing")
    require("shared_transaction_pooler" in supabase_source_resolver, "Supabase shared transaction pooler candidate missing")
    require("shared_session_pooler" in supabase_source_resolver, "Supabase shared session pooler candidate missing")
    require("original_normalized" in supabase_source_resolver, "Supabase normalized original candidate missing")
    require('quote(password, safe="")' in supabase_source_resolver, "Supabase source password must be safely re-encoded")
    require("::add-mask::" in supabase_source_resolver, "Supabase source candidates must be masked")
    require("SOURCE_DATABASE_URL_CANDIDATE_" in supabase_source_resolver, "Supabase source candidates must be exported through GITHUB_ENV")

    require("DATABASE_URL" in neon_url_resolver, "Neon URL resolver must consume pooled DATABASE_URL")
    require("DIRECT_URL" in neon_url_resolver, "Neon URL resolver must export DIRECT_URL")
    require("TARGET_DIRECT_URL" in neon_url_resolver, "Neon URL resolver must export migration target URL")
    require("-pooler" in neon_url_resolver, "Neon URL resolver must derive direct hostname from pooled endpoint")
    require("::add-mask::" in neon_url_resolver, "Neon URL resolver must mask the derived credential URL")
    require("EXPECTED_PRODUCTION_ENDPOINT_ID" in neon_url_resolver, "Neon URL resolver must verify certified endpoint identity")
    require("neon" in session_migration_script.lower(), "session migration script must identify Neon target")
    require("begin" in session_migration_script and "commit" in session_migration_script and "rollback" in session_migration_script, "session migration must be transactional")
    require("aggregateDigest" in session_migration_script, "session migration must verify complete row integrity")
    require("accessToken" in session_migration_script, "session migration must preserve Shopify access tokens")
    require("console.log(row" not in session_migration_script, "session migration must not log session rows")

    require("resolve-production-neon-urls.py" in deploy, "production Worker deploy must resolve the direct URL safely")
    require("CLOUDFLARE_API_TOKEN DATABASE_URL SHOPIFY_API_SECRET" in deploy, "production Worker deploy must require pooled DB and platform credentials")
    require("CLOUDFLARE_API_TOKEN DATABASE_URL DIRECT_URL SHOPIFY_API_SECRET" not in deploy, "production Worker deploy must not require duplicate DIRECT_URL secret")
    require("workflow_dispatch:" in deploy and "push:" not in deploy, "production Worker deploy must remain manual-only")
    require("production_schema_provisioned" in deploy, "production Worker deploy must gate on certified production Neon schema provisioning")
    require("session_migration_completed" in deploy, "production Worker deploy must gate on certified session migration")
    require("production_neon_session_migration=certified" in deploy, "production Worker deploy migration evidence missing")
    require("STAGING_NEON_ENDPOINT_ID: ep-snowy-surf-b3gxl2wf" in deploy, "production deploy must know the staging Neon endpoint")
    require("PRODUCTION_NEON_PROJECT_NAME: vsn-metafields-production" in deploy, "production deploy must pin the production Neon project name")
    require("production_project_provisioned" in deploy, "deploy must require certified production Neon provisioning")
    require("production_endpoint_id" in deploy, "deploy must require the certified production Neon endpoint ID")
    require("pooled_id != production_id" in deploy, "deploy must require URLs to match the certified production Neon endpoint")
    require("pooled_id == staging_id" in deploy, "production deploy must reject the staging Neon endpoint")
    require("production_neon_identity=certified_and_distinct" in deploy, "production deploy Neon isolation evidence missing")
    require("production_shopify_cutover_performed=false" in read(ROOT / ".github" / "workflows" / "production-cutover-contract.yml"), "cutover certification must explicitly prove no Shopify cutover occurred")
    require("DEPLOY_PRODUCTION_WORKER_ONLY" in deploy, "production Worker deploy confirmation gate missing")
    require("source_sha:" in deploy, "production Worker deploy immutable source input missing")
    require("EXPECTED_SOURCE_SHA" in deploy, "production Worker deploy expected source binding missing")
    require("git rev-parse HEAD" in deploy, "production Worker deploy must verify checked-out source SHA")
    require("fetch-depth: 0" in deploy, "production Worker deploy must fetch protected-main ancestry")
    require('policy["production_worker"]["certified_source_sha"]' in deploy, "production Worker deploy must read repository-certified source SHA")
    require("git merge-base --is-ancestor" in deploy, "production Worker deploy must prove certified source belongs to protected main")
    require('git checkout --detach "$EXPECTED_SOURCE_SHA"' in deploy, "production Worker deploy must checkout the exact certified source")
    require("APP_COMMIT_SHA:$EXPECTED_SOURCE_SHA" in deploy, "production Worker deploy must publish source SHA to runtime")
    require('payload.get("commitSha") != expected_source_sha' in deploy, "production Worker deploy must verify runtime source SHA")
    require("github.ref == 'refs/heads/main'" in deploy, "production Worker deploy must require protected main")
    require("ref: main" in deploy, "production Worker deploy checkout must pin main")
    require("environment: cloudflare-production" in deploy, "production deploy environment missing")
    require("prisma migrate status" in deploy, "production migration status preflight missing")
    require("prisma migrate deploy" not in deploy, "production deploy must not apply database migrations")
    require("--config wrangler.production.jsonc" in deploy, "production Wrangler config missing from deploy")
    require(cloudflare_url in deploy, "production deploy must pin expected Cloudflare URL")

    require("resolve-production-neon-urls.py" in acceptance, "production acceptance must resolve the direct URL safely")
    require("for name in DATABASE_URL" in acceptance, "production acceptance must require pooled DATABASE_URL")
    require("for name in DATABASE_URL DIRECT_URL" not in acceptance, "production acceptance must not require duplicate DIRECT_URL secret")
    require("workflow_dispatch:" in acceptance and "push:" not in acceptance, "production acceptance must remain manual-only")
    require("VERIFY_PRODUCTION_WORKER_ONLY" in acceptance, "production acceptance confirmation gate missing")
    require("source_sha:" in acceptance, "production acceptance immutable source input missing")
    require("EXPECTED_SOURCE_SHA" in acceptance, "production acceptance expected source binding missing")
    require('policy["production_worker"]["certified_source_sha"]' in acceptance, "production acceptance must read repository-certified source SHA")
    require('payload.get("commitSha") != expected_source_sha' in acceptance, "production acceptance must verify runtime source SHA")
    require("github.ref == 'refs/heads/main'" in acceptance, "production acceptance must require protected main")
    require("ref: main" in acceptance, "production acceptance checkout must pin main")
    require("environment: cloudflare-production" in acceptance, "production acceptance environment missing")
    require("prisma migrate status" in acceptance, "production acceptance migration-status check missing")
    require("prisma migrate deploy" not in acceptance, "production acceptance must not apply database migrations")
    require("prisma.session.count()" in acceptance, "production acceptance must perform a read-only Session table probe")
    require("production_session_table_read=pass" in acceptance, "production Session table evidence missing")
    require("production_worker_health=pass" in acceptance, "production Worker health evidence missing")
    require("production_billing_metadata=pass" in acceptance, "production billing metadata evidence missing")
    require("production_shopify_live_target=railway" in acceptance, "production acceptance must prove Railway remains live")
    require("production_release_authorized=false" in acceptance, "production acceptance must prove release remains unauthorized")
    require("production_shopify_cutover_performed=false" in acceptance, "production acceptance must prove no Shopify cutover occurred")
    require("production_billing_mutation_performed=false" in acceptance, "production acceptance must prove no billing mutation occurred")
    require("production_schema_provisioned" in acceptance, "production acceptance must require certified production Neon schema provisioning")
    require("session_migration_completed" in acceptance, "production acceptance must require certified Session migration")
    require("STAGING_NEON_ENDPOINT_ID: ep-snowy-surf-b3gxl2wf" in acceptance, "production acceptance must know the staging Neon endpoint")
    require("PRODUCTION_NEON_PROJECT_NAME: vsn-metafields-production" in acceptance, "production acceptance must pin the production Neon project name")
    require("production_project_provisioned" in acceptance, "acceptance must require certified production Neon provisioning")
    require("production_endpoint_id" in acceptance, "acceptance must require the certified production Neon endpoint ID")
    require("pooled_id != production_id" in acceptance, "acceptance must require URLs to match the certified production Neon endpoint")
    require("pooled_id == staging_id" in acceptance, "production acceptance must reject the staging Neon endpoint")
    require("production_neon_identity=certified_and_distinct" in acceptance, "production acceptance Neon isolation evidence missing")
    require("wrangler" not in acceptance, "production acceptance must never deploy the Worker")
    require("app release" not in acceptance, "production acceptance must never release Shopify config")
    require(cloudflare_url in acceptance, "production acceptance must pin expected Cloudflare URL")
    require(railway_url in acceptance, "production acceptance must pin Railway live URL")

    require("CREATE_PRODUCTION_CUTOVER_VERSION" in candidate, "production cutover candidate confirmation missing")
    require("github.ref == 'refs/heads/main'" in candidate, "production cutover candidate must require protected main")
    require("ref: main" in candidate, "production cutover candidate checkout must pin main")
    require("--config cloudflare-production" in candidate, "production Shopify candidate config missing")
    require("--no-release" in candidate, "production Shopify candidate must remain unreleased")
    require("app release" not in candidate, "candidate workflow must not release Shopify config")
    require('SOURCE_PREFIX="${GITHUB_SHA:0:12}"' in candidate, "candidate version must bind to source ref")
    require("candidate_source_ref=$GITHUB_SHA" in candidate, "candidate source ref evidence missing")

    require("RELEASE_PRODUCTION_CUTOVER" in release, "production release confirmation missing")
    require("github.ref == 'refs/heads/main'" in release, "production release must require protected main")
    require("ref: main" in release, "production release checkout must pin main")
    require("release_authorized" in release, "production release must enforce policy authorization")
    require("authorized_version" in release, "production release must pin the exact authorized version")
    require("authorized_source_ref" in release, "production release must pin the candidate source ref")
    require("authorization_record" in release, "production release must require an audit authorization record")
    require("cloudflare-production-cutover-([0-9a-f]{12})-([0-9]+)" in release, "production release version format guard missing")
    require("app release" in release and "--allow-updates" in release, "production release command missing")
    require(cloudflare_url in release, "production release must verify Cloudflare production health")

    require("ROLLBACK_TO_RAILWAY" in rollback, "Railway rollback confirmation missing")
    require("github.ref == 'refs/heads/main'" in rollback, "Railway rollback must require protected main")
    require("ref: main" in rollback, "Railway rollback checkout must pin main")
    require(railway_url in rollback, "Railway rollback URL guard missing")
    require("app release" in rollback and "--allow-updates" in rollback, "Railway rollback release command missing")

    print("production_cutover_contract=prepared")
    print("production_release_authorized=false")
    print(f"production_shopify_client_id={client_id}")
    print(f"production_current_url={railway_url}")
    print(f"production_target_url={cloudflare_url}")
    print("production_billing_mutation_authorized=false")
    print("production_database_migration_authorized=false")
    print("railway_rollback_required=true")
    print("production_package_certifiable_without_deploy=true")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValidationError, OSError, json.JSONDecodeError, KeyError, tomllib.TOMLDecodeError) as exc:
        print(f"error={exc}", file=sys.stderr)
        raise SystemExit(1)
