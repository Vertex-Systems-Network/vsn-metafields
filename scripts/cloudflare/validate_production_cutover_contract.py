#!/usr/bin/env python3
"""Validate production cutover policy across prepared and authorized pre-release states."""

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
SUBSCRIPTION_AUDIT = ROOT / "scripts" / "cloudflare" / "audit-production-subscriptions.mjs"
OFFLINE_TOKEN_MIGRATION = ROOT / ".github" / "workflows" / "production-offline-token-migration.yml"
OFFLINE_TOKEN_MIGRATION_SCRIPT = ROOT / "scripts" / "database" / "migrate-production-offline-tokens.mjs"
ROLLBACK_WINDOW_CERTIFICATION = ROOT / ".github" / "workflows" / "production-rollback-window-certification.yml"
SESSION_READINESS_AUDIT = ROOT / "scripts" / "cloudflare" / "audit-production-session-readiness.mjs"
RUNTIME_HOTFIX = ROOT / ".github" / "workflows" / "cloudflare-production-runtime-hotfix.yml"
RUNTIME_HOTFIX = ROOT / ".github" / "workflows" / "cloudflare-production-runtime-hotfix.yml"


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
    subscription_audit = read(SUBSCRIPTION_AUDIT)
    offline_token_migration = read(OFFLINE_TOKEN_MIGRATION)
    offline_token_migration_script = read(OFFLINE_TOKEN_MIGRATION_SCRIPT)
    rollback_window_certification = read(ROLLBACK_WINDOW_CERTIFICATION)
    session_readiness_audit = read(SESSION_READINESS_AUDIT)
    runtime_hotfix = read(RUNTIME_HOTFIX)
    runtime_hotfix = read(RUNTIME_HOTFIX)

    require(policy.get("schema_version") == 1, "unsupported production cutover schema")
    require(policy.get("issue") == 4, "production cutover policy must target Issue #4")

    status = policy.get("status")
    release_authorized = policy.get("release_authorized")
    authorized_version = policy.get("authorized_version")
    authorized_source_ref = policy.get("authorized_source_ref")
    authorization_record = policy.get("authorization_record")
    candidate_policy = policy.get("candidate")

    require(
        status in {"prepared_not_authorized", "authorized_not_released", "released_post_cutover_verified"},
        "production cutover status drifted",
    )
    require(isinstance(candidate_policy, dict), "production cutover candidate evidence missing")

    if status == "prepared_not_authorized":
        require(release_authorized is False, "prepared cutover must remain unauthorized")
        require(authorized_version is None, "prepared cutover version must remain unset")
        require(authorized_source_ref is None, "prepared cutover source ref must remain unset")
        require(authorization_record is None, "prepared cutover authorization record must remain unset")
    elif status == "authorized_not_released":
        require(candidate_policy.get("released") is False, "authorized candidate must remain unreleased")
        require(release_authorized is True, "authorized cutover must set release_authorized=true")
        require(
            authorized_version == candidate_policy.get("version"),
            "authorized production version must equal the recorded candidate version",
        )
        require(
            authorized_source_ref == candidate_policy.get("source_ref"),
            "authorized production source ref must equal the recorded candidate source",
        )
        require(
            isinstance(authorization_record, str) and authorization_record.strip(),
            "authorized production cutover requires an audit authorization record",
        )
        require(
            re.fullmatch(r"cloudflare-production-cutover-[0-9a-f]{12}-[0-9]+", str(authorized_version))
            is not None,
            "authorized production version format is invalid",
        )
        require(
            isinstance(authorized_source_ref, str)
            and re.fullmatch(r"[0-9a-f]{40}", authorized_source_ref) is not None,
            "authorized production source ref is invalid",
        )
        require(
            str(authorized_version).split("-")[-2] == authorized_source_ref[:12],
            "authorized candidate version/source prefix mismatch",
        )
    else:
        release_policy = policy.get("release")
        require(candidate_policy.get("released") is True, "released policy must mark candidate released")
        require(release_authorized is False, "release authorization must be consumed after successful release")
        require(
            authorized_version == candidate_policy.get("version"),
            "released production version must equal the authorized candidate version",
        )
        require(
            authorized_source_ref == candidate_policy.get("source_ref"),
            "released production source must equal the authorized candidate source",
        )
        require(
            isinstance(authorization_record, str) and authorization_record.strip(),
            "released production cutover must retain its authorization record",
        )
        require(isinstance(release_policy, dict), "production release evidence missing")
        require(release_policy.get("workflow_run_id") == 36657352966, "production release run evidence drifted")
        require(release_policy.get("version") == authorized_version, "released version evidence drifted")
        require(release_policy.get("source_ref") == authorized_source_ref, "released source evidence drifted")
        require(
            release_policy.get("pre_subscription_snapshot_digest")
            == candidate_policy.get("subscription_snapshot_digest"),
            "pre-release subscription digest drifted",
        )
        require(
            release_policy.get("post_subscription_snapshot_digest")
            == candidate_policy.get("subscription_snapshot_digest"),
            "post-release subscription digest drifted",
        )
        require(
            release_policy.get("subscription_shop_count")
            == candidate_policy.get("subscription_shop_count"),
            "released subscription shop count drifted",
        )
        require(
            release_policy.get("active_subscription_count")
            == candidate_policy.get("active_subscription_count"),
            "released active subscription count drifted",
        )
        require(release_policy.get("pre_release_worker_health") is True, "pre-release Worker health evidence missing")
        require(release_policy.get("post_release_worker_health") is True, "post-release Worker health evidence missing")
        require(release_policy.get("subscriptions_preserved") is True, "subscription preservation evidence missing")
        require(release_policy.get("compliance_webhooks_enqueued") == 3, "compliance webhook evidence drifted")
        require(release_policy.get("railway_rollback_preserved") is True, "Railway rollback preservation evidence missing")

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

    if status == "released_post_cutover_verified":
        require(shopify.get("live_target") == "cloudflare", "released production live target must be Cloudflare")
        require(shopify.get("live_url") == cloudflare_url, "released production live URL must match Cloudflare target")
    else:
        require(shopify.get("live_target") in {None, "railway"}, "pre-release live target must remain Railway")


    auth = target.get("auth")
    require(isinstance(auth, dict), "target auth config missing")
    redirects = auth.get("redirect_urls")
    require(isinstance(redirects, list) and redirects, "target redirect URLs missing")
    require(all(str(value).startswith(cloudflare_url + "/") for value in redirects), "target redirects must stay on Cloudflare production URL")

    require(wrangler.get("name") == worker.get("name") == "vsn-metafields-production", "production Worker name drifted")
    require(wrangler.get("main") == "./workers/app.js", "production Worker entry drifted")
    require("routes" not in wrangler and "route" not in wrangler, "production Worker preparation must not bind production routes")
    require(worker.get("public_route_binding") is False, "public production route binding must remain disabled during preparation")

    require(worker.get("deployment_completed") is True, "production Worker deployment evidence is not certified")
    require(worker.get("acceptance_completed") is True, "production Worker acceptance evidence is not certified")
    require(
        worker.get("accepted_source_sha") == certified_source_sha,
        "accepted production Worker source must match the certified runtime source",
    )
    require(isinstance(worker.get("deployment_run_id"), int), "production Worker deployment run ID missing")
    require(isinstance(worker.get("acceptance_run_id"), int), "production Worker acceptance run ID missing")
    require(
        isinstance(worker.get("cloudflare_version_id"), str)
        and bool(worker.get("cloudflare_version_id")),
        "production Worker Cloudflare version evidence missing",
    )

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

    runtime_update = policy.get("runtime_update")
    if runtime_update is not None:
        require(isinstance(runtime_update, dict), "runtime update policy must be an object")
        require(runtime_update.get("status") in {"prepared", "accepted"}, "runtime update status drifted")
        require(
            runtime_update.get("reason") == "restore_existing_active_test_subscription_entitlement",
            "runtime hotfix reason drifted",
        )
        require(
            runtime_update.get("target_source_sha") == "e706ce3cdbcc8998f4686ee039e0e59aeaa6574b",
            "runtime hotfix target source drifted",
        )
        require(
            isinstance(runtime_update.get("current_source_sha"), str)
            and re.fullmatch(r"[0-9a-f]{40}", runtime_update.get("current_source_sha")) is not None,
            "runtime hotfix baseline source is invalid",
        )
        require(
            runtime_update.get("workflow") == "cloudflare-production-runtime-hotfix.yml",
            "runtime hotfix workflow drifted",
        )
        require(runtime_update.get("shopify_config_mutation_allowed") is False, "runtime hotfix must forbid Shopify config mutation")
        require(runtime_update.get("billing_mutation_allowed") is False, "runtime hotfix must forbid billing mutation")
        require(runtime_update.get("database_mutation_allowed") is False, "runtime hotfix must forbid database mutation")
        require(runtime_update.get("preserve_subscription_snapshot") is True, "runtime hotfix must preserve subscription snapshot")
        require(runtime_update.get("reset_rollback_window_after_success") is True, "runtime hotfix must reset rollback window after success")
        if runtime_update.get("status") == "prepared":
            require(runtime_update.get("deployment_run_id") is None, "prepared runtime hotfix must not have deployment evidence")
            require(runtime_update.get("accepted") is False, "prepared runtime hotfix must remain unaccepted")

    rollback_window = rollback_policy.get("window")
    require(isinstance(rollback_window, dict), "rollback window policy missing")
    require(rollback_window.get("status") == "active", "rollback window must remain active until certified closure")
    require(rollback_window.get("opened_at") == "2026-09-30T01:55:25Z", "rollback window open time drifted")
    require(rollback_window.get("minimum_hours") == 24, "rollback window minimum duration must remain 24 hours")
    require(rollback_window.get("earliest_close_at") == "2026-10-01T01:55:25Z", "rollback window earliest close time drifted")
    require(
        rollback_window.get("certification_workflow") == "production-rollback-window-certification.yml",
        "rollback window certification workflow drifted",
    )
    require(rollback_window.get("closure_authorized") is False, "rollback-window closure must remain unauthorized before certification")
    require(rollback_window.get("certification_run_id") is None, "rollback-window certification run must remain unset while active")
    require(rollback_window.get("certified_at") is None, "rollback-window certification time must remain unset while active")
    require(rollback_window.get("closed_at") is None, "rollback window must not be marked closed before certification")
    rollback_criteria = rollback_window.get("criteria")
    require(isinstance(rollback_criteria, dict), "rollback-window closure criteria missing")
    for criterion in (
        "cloudflare_health_and_source_sha",
        "billing_metadata_55_usd_5_day_trial",
        "subscription_snapshot_unchanged",
        "production_session_count_and_token_coverage",
        "expiring_offline_tokens_ready",
        "railway_runtime_reachable",
        "railway_rollback_source_preserved",
        "no_railway_retirement_before_certification",
        "no_supabase_cleanup_before_certification",
    ):
        require(rollback_criteria.get(criterion) is True, f"rollback-window criterion missing: {criterion}")


    runtime_update = policy.get("runtime_update")
    require(isinstance(runtime_update, dict), "production runtime hotfix request missing")
    require(runtime_update.get("status") == "prepared", "production runtime hotfix must remain prepared before deployment")
    require(
        runtime_update.get("reason") == "restore_existing_active_test_subscription_entitlement",
        "production runtime hotfix reason drifted",
    )
    require(
        runtime_update.get("target_source_sha") == "e706ce3cdbcc8998f4686ee039e0e59aeaa6574b",
        "production runtime hotfix target source drifted",
    )
    require(
        runtime_update.get("current_source_sha") == worker.get("accepted_source_sha"),
        "production runtime hotfix current source must match accepted runtime",
    )
    require(
        runtime_update.get("workflow") == "cloudflare-production-runtime-hotfix.yml",
        "production runtime hotfix workflow drifted",
    )
    require(runtime_update.get("shopify_config_mutation_allowed") is False, "runtime hotfix must forbid Shopify config mutation")
    require(runtime_update.get("billing_mutation_allowed") is False, "runtime hotfix must forbid billing mutation")
    require(runtime_update.get("database_mutation_allowed") is False, "runtime hotfix must forbid database mutation")
    require(runtime_update.get("preserve_subscription_snapshot") is True, "runtime hotfix must preserve subscription snapshot")
    require(runtime_update.get("reset_rollback_window_after_success") is True, "runtime hotfix must reset rollback window after success")
    require(runtime_update.get("deployment_run_id") is None, "runtime hotfix deployment evidence must remain unset before deployment")
    require(runtime_update.get("accepted") is False, "runtime hotfix must remain unaccepted before deployment")

    workflows = [deploy, acceptance, candidate, release, rollback, production_neon_provisioning, session_migration]
    for workflow in workflows:
        require("appSubscriptionCreate" not in workflow, "production migration workflow must not create billing subscriptions")
        require("appSubscriptionCancel" not in workflow, "production migration workflow must not cancel billing subscriptions")
        require("--allow-deletes" not in workflow, "Shopify config deletes are forbidden during migration")

    require("workflow_dispatch:" in runtime_hotfix and "push:" not in runtime_hotfix, "production runtime hotfix must remain manual-only")
    require("DEPLOY_PRODUCTION_RUNTIME_HOTFIX" in runtime_hotfix, "production runtime hotfix confirmation gate missing")
    require("source_sha:" in runtime_hotfix, "production runtime hotfix immutable source input missing")
    require("github.ref == 'refs/heads/main'" in runtime_hotfix, "production runtime hotfix must require protected main")
    require("ref: main" in runtime_hotfix, "production runtime hotfix control-plane checkout must pin main")
    require("environment: cloudflare-production" in runtime_hotfix, "production runtime hotfix environment missing")
    require("git merge-base --is-ancestor" in runtime_hotfix, "production runtime hotfix must prove protected-main ancestry")
    require("git checkout --detach" in runtime_hotfix, "production runtime hotfix must checkout the exact prepared source")
    require("audit-production-subscriptions.mjs" in runtime_hotfix, "production runtime hotfix must verify subscriptions")
    require("production_runtime_hotfix_pre_health=pass" in runtime_hotfix, "production runtime hotfix pre-health evidence missing")
    require("production_runtime_hotfix_post_health=pass" in runtime_hotfix, "production runtime hotfix post-health evidence missing")
    require("production_runtime_hotfix_subscriptions_preserved=pass" in runtime_hotfix, "production runtime hotfix subscription preservation evidence missing")
    require("production_runtime_hotfix_railway_rollback=pass" in runtime_hotfix, "production runtime hotfix Railway rollback evidence missing")
    require("production_shopify_config_mutation_performed=false" in runtime_hotfix, "production runtime hotfix must prove no Shopify config mutation")
    require("production_billing_mutation_performed=false" in runtime_hotfix, "production runtime hotfix must prove no billing mutation")
    require("production_database_mutation_performed=false" in runtime_hotfix, "production runtime hotfix must prove no database mutation")
    require("production_merchant_reinstall_required=false" in runtime_hotfix, "production runtime hotfix must prove no merchant reinstall")
    require("production_rollback_window_reset_required=true" in runtime_hotfix, "production runtime hotfix must require rollback-window reset")
    require("wrangler@4.141.0 deploy" in runtime_hotfix, "production runtime hotfix Worker deploy command missing")
    require("--config wrangler.production.jsonc" in runtime_hotfix, "production runtime hotfix Wrangler config missing")
    require("APP_COMMIT_SHA:$EXPECTED_SOURCE_SHA" in runtime_hotfix, "production runtime hotfix must publish runtime source SHA")
    require("@shopify/cli" not in runtime_hotfix, "production runtime hotfix must not invoke Shopify CLI")
    require("appSubscriptionCreate" not in runtime_hotfix, "production runtime hotfix must never create subscriptions")
    require("appSubscriptionCancel" not in runtime_hotfix, "production runtime hotfix must never cancel subscriptions")
    require("prisma migrate deploy" not in runtime_hotfix, "production runtime hotfix must never apply database migrations")

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
    require("SOURCE_DATABASE_URL_CANDIDATE_" in supabase_source_resolver, "Supabase source resolver must export exact Connect pooler candidates")
    require("SOURCE_DATABASE_URL_CANDIDATE_COUNT=" in supabase_source_resolver, "Supabase source resolver must export the bounded password-interpretation count")
    require("exact_supabase_connect_pooler_" in supabase_source_resolver, "Supabase source resolver must label exact Connect pooler interpretations")
    require('password_candidates = [("raw_literal", raw_password)]' in supabase_source_resolver, "Supabase source must try raw password semantics first")
    require("decoded_password = unquote(raw_password)" in supabase_source_resolver, "Supabase source may try percent-decoded password semantics as fallback")
    require("production_supabase_password_interpretations=" in supabase_source_resolver, "Supabase source must record non-secret password interpretation count")
    require(".pooler.supabase.com" in supabase_source_resolver, "Supabase source resolver must require a shared pooler hostname")
    require("ALLOWED_POOLER_PORTS = {5432, 6543}" in supabase_source_resolver, "Supabase source resolver must allow only documented pooler ports")
    require("aws-0-ap-southeast-2.pooler.supabase.com" not in supabase_source_resolver, "Supabase pooler cluster must never be derived from the region")
    require("::add-mask::" in supabase_source_resolver, "Supabase source URL must be masked")
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
    require('expected_username = f"postgres.{EXPECTED_PROJECT_REF}"' in supabase_source_resolver, "Supabase pooler username must bind the certified project ref")
    require(".pooler.supabase.com" in supabase_source_resolver, "Supabase source must use a Connect-dialog pooler host")
    require("ALLOWED_POOLER_PORTS = {5432, 6543}" in supabase_source_resolver, "Supabase pooler port contract drifted")
    require('remainder.rsplit("@", 1)' in supabase_source_resolver, "Supabase source parser must tolerate raw special characters in passwords")
    require('raw_userinfo.split(":", 1)' in supabase_source_resolver, "Supabase source parser must split username/password safely")
    require('quote(password, safe="")' in supabase_source_resolver, "Supabase source password must be safely re-encoded")
    require("::add-mask::" in supabase_source_resolver, "Supabase exact source URL must be masked")
    require("SOURCE_DATABASE_URL_CANDIDATE_" in supabase_source_resolver, "Supabase exact source URL candidates must be exported through GITHUB_ENV")

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
    cutover_contract_workflow = read(ROOT / ".github" / "workflows" / "production-cutover-contract.yml")
    require(
        "production_shopify_cutover_performed=" in cutover_contract_workflow,
        "cutover certification must explicitly report whether Shopify cutover occurred",
    )
    require(
        "released_post_cutover_verified" in cutover_contract_workflow,
        "cutover certification must understand the verified post-release lifecycle state",
    )
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

    require("currentAppInstallation" in subscription_audit, "subscription audit must query current app installation")
    require("activeSubscriptions" in subscription_audit, "subscription audit must read active subscriptions")
    require('"isOnline" = false' in subscription_audit, "subscription audit must use offline Shopify sessions")
    require("X-Shopify-Access-Token" in subscription_audit, "subscription audit must authenticate Admin API reads")
    require('createHash("sha256")' in subscription_audit, "subscription audit must produce a SHA-256 fingerprint")
    require("EXPECTED_SUBSCRIPTION_SNAPSHOT_DIGEST" in subscription_audit, "subscription audit must support exact snapshot verification")
    require("production_existing_subscriptions_preserved=pass" in subscription_audit, "subscription audit preservation evidence missing")
    require("production_subscription_credentials_logged=false" in subscription_audit, "subscription audit must prove credentials are not logged")
    require("appSubscriptionCreate" not in subscription_audit, "subscription audit must never create subscriptions")
    require("appSubscriptionCancel" not in subscription_audit, "subscription audit must never cancel subscriptions")
    require("console.log(row" not in subscription_audit, "subscription audit must not log Session rows")

    require("workflow_dispatch:" in offline_token_migration and "push:" not in offline_token_migration, "offline token migration must remain manual-only")
    require("MIGRATE_PRODUCTION_OFFLINE_TOKENS" in offline_token_migration, "offline token migration confirmation gate missing")
    require("github.ref == 'refs/heads/main'" in offline_token_migration, "offline token migration must require protected main")
    require("ref: main" in offline_token_migration, "offline token migration checkout must pin main")
    require("environment: cloudflare-production" in offline_token_migration, "offline token migration environment missing")
    require("SHOPIFY_API_SECRET" in offline_token_migration, "offline token migration requires production Shopify secret")
    require("DATABASE_URL" in offline_token_migration, "offline token migration requires production database URL")
    require("production_shopify_live_target=railway" in offline_token_migration, "offline token migration must prove Railway remains live")
    require("production_shopify_cutover_performed=false" in offline_token_migration, "offline token migration must prove no Shopify cutover")
    require("app release" not in offline_token_migration, "offline token migration must never release Shopify config")
    require("appSubscriptionCreate" not in offline_token_migration, "offline token migration must never create subscriptions")
    require("appSubscriptionCancel" not in offline_token_migration, "offline token migration must never cancel subscriptions")

    require("legacy_non_expiring_token_rejected" in offline_token_migration_script, "offline token migration must classify the Shopify legacy-token 403")
    require("token-exchange" in offline_token_migration_script, "offline token migration must use Shopify token exchange")
    require("offline-access-token" in offline_token_migration_script, "offline token migration must request offline access")
    require('expiring: "1"' in offline_token_migration_script, "offline token migration must request expiring offline tokens")
    require("refresh_token" in offline_token_migration_script, "offline token migration must persist refresh tokens")
    require("refresh_token_expires_in" in offline_token_migration_script, "offline token migration must persist refresh-token expiry")
    require("production_offline_token_migration=pass" in offline_token_migration_script, "offline token migration success evidence missing")
    require("production_billing_mutation_performed=false" in offline_token_migration_script, "offline token migration must prove no billing mutation")
    require("production_shopify_reinstall_required=false" in offline_token_migration_script, "offline token migration must prove no merchant reinstall")
    require("console.log(row" not in offline_token_migration_script, "offline token migration must not log Session rows")

    require("CREATE_PRODUCTION_CUTOVER_VERSION" in candidate, "production cutover candidate confirmation missing")
    require("github.ref == 'refs/heads/main'" in candidate, "production cutover candidate must require protected main")
    require("ref: main" in candidate, "production cutover candidate checkout must pin main")
    require("--config cloudflare-production" in candidate, "production Shopify candidate config missing")
    require("--no-release" in candidate, "production Shopify candidate must remain unreleased")
    require("app release" not in candidate, "candidate workflow must not release Shopify config")
    require('SOURCE_PREFIX="${GITHUB_SHA:0:12}"' in candidate, "candidate version must bind to source ref")
    require("candidate_source_ref=$GITHUB_SHA" in candidate, "candidate source ref evidence missing")
    require("accepted production Worker evidence" in candidate, "candidate must gate on accepted Worker evidence")
    require("audit-production-subscriptions.mjs" in candidate, "candidate must capture pre-cutover subscription state")
    require("candidate_subscription_digest=" in candidate, "candidate subscription digest evidence missing")
    require("candidate_subscription_shop_count=" in candidate, "candidate shop-count evidence missing")
    require("candidate_active_subscription_count=" in candidate, "candidate active-subscription count evidence missing")
    require("DATABASE_URL" in candidate, "candidate subscription audit requires production DATABASE_URL")

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
    require("subscription_snapshot_digest:" in release, "production release must bind the candidate subscription digest")
    require("subscription_shop_count:" in release, "production release must bind the candidate shop count")
    require("subscription_active_count:" in release, "production release must bind the candidate active subscription count")
    require("audit-production-subscriptions.mjs" in release, "production release must verify subscriptions before and after cutover")
    require("EXPECTED_SUBSCRIPTION_SNAPSHOT_DIGEST" in release, "production release snapshot digest binding missing")
    require("production_existing_subscriptions_preserved=pass" in release, "post-cutover subscription preservation evidence missing")
    require("vsn-metafields-production-release-smoke/1.0" in release, "release preflight health retry identity missing")
    require("vsn-metafields-production-post-release-smoke/1.0" in release, "post-release health retry identity missing")
    require("for attempt in range(1, 7)" in release, "production release health checks must be retried")
    require("DATABASE_URL" in release, "production release subscription verification requires production DATABASE_URL")

    require("workflow_dispatch:" in rollback_window_certification and "push:" not in rollback_window_certification, "rollback-window certification must remain manual-only")
    require("CERTIFY_ROLLBACK_WINDOW_CLOSURE" in rollback_window_certification, "rollback-window certification confirmation gate missing")
    require("github.ref == 'refs/heads/main'" in rollback_window_certification, "rollback-window certification must require protected main")
    require("ref: main" in rollback_window_certification, "rollback-window certification checkout must pin main")
    require("environment: cloudflare-production" in rollback_window_certification, "rollback-window certification environment missing")
    require("earliest_close_at" in rollback_window_certification, "rollback-window certification must enforce earliest close time")
    require("rollback_window_elapsed=pass" in rollback_window_certification, "rollback-window elapsed-time evidence missing")
    require("vsn-metafields-production.vertexsystemsnetwork.workers.dev/healthz" in rollback_window_certification, "rollback-window Cloudflare health check missing")
    require("vsn-metafields-production.up.railway.app/healthz" in rollback_window_certification, "rollback-window Railway health check missing")
    require("audit-production-subscriptions.mjs" in rollback_window_certification, "rollback-window subscription audit missing")
    require("audit-production-session-readiness.mjs" in rollback_window_certification, "rollback-window Session readiness audit missing")
    require("production_rollback_window_certification=pass" in rollback_window_certification, "rollback-window certification success evidence missing")
    require("production_railway_retirement_performed=false" in rollback_window_certification, "rollback-window certification must prove no Railway retirement")
    require("production_supabase_cleanup_performed=false" in rollback_window_certification, "rollback-window certification must prove no Supabase cleanup")
    require("npx --yes @shopify/cli" not in rollback_window_certification, "rollback-window certification must not invoke Shopify CLI mutations")
    require("app deploy" not in rollback_window_certification, "rollback-window certification must not deploy Shopify config")
    require("app release" not in rollback_window_certification, "rollback-window certification must never release Shopify config")
    require("app release" not in rollback_window_certification, "rollback-window certification must never release Shopify config")
    require("appSubscriptionCreate" not in rollback_window_certification, "rollback-window certification must never create subscriptions")
    require("appSubscriptionCancel" not in rollback_window_certification, "rollback-window certification must never cancel subscriptions")

    require("production_session_readiness=pass" in session_readiness_audit, "Session readiness audit success evidence missing")
    require("production_session_credentials_logged=false" in session_readiness_audit, "Session readiness audit must prove credentials are not logged")
    require('"isOnline" = false' in session_readiness_audit, "Session readiness audit must verify offline sessions")
    require('"refreshToken" IS NOT NULL' in session_readiness_audit, "Session readiness audit must verify refresh tokens")
    require('"refreshTokenExpires" IS NOT NULL' in session_readiness_audit, "Session readiness audit must verify refresh-token expiry")
    require("console.log(row" not in session_readiness_audit, "Session readiness audit must not log Session rows")

    require("workflow_dispatch:" in runtime_hotfix and "push:" not in runtime_hotfix, "runtime hotfix must remain manual-only")
    require("DEPLOY_PRODUCTION_RUNTIME_HOTFIX" in runtime_hotfix, "runtime hotfix confirmation gate missing")
    require("github.ref == 'refs/heads/main'" in runtime_hotfix, "runtime hotfix must require protected main")
    require("ref: main" in runtime_hotfix, "runtime hotfix control-plane checkout must pin main")
    require("environment: cloudflare-production" in runtime_hotfix, "runtime hotfix production environment missing")
    require("EXPECTED_SOURCE_SHA" in runtime_hotfix, "runtime hotfix exact source input missing")
    require("target_source_sha" in runtime_hotfix, "runtime hotfix must bind repository-prepared target source")
    require("git merge-base --is-ancestor" in runtime_hotfix, "runtime hotfix must require protected-main ancestry")
    require("git checkout --detach" in runtime_hotfix, "runtime hotfix must checkout exact immutable source")
    require("audit-production-subscriptions.mjs" in runtime_hotfix, "runtime hotfix must audit subscriptions")
    require("production_runtime_hotfix_pre_health=pass" in runtime_hotfix, "runtime hotfix pre-health evidence missing")
    require("production_runtime_hotfix_post_health=pass" in runtime_hotfix, "runtime hotfix post-health evidence missing")
    require("production_runtime_hotfix_subscriptions_preserved=pass" in runtime_hotfix, "runtime hotfix subscription preservation evidence missing")
    require("production_runtime_hotfix_railway_rollback=pass" in runtime_hotfix, "runtime hotfix Railway rollback evidence missing")
    require("production_shopify_config_mutation_performed=false" in runtime_hotfix, "runtime hotfix must prove no Shopify config mutation")
    require("production_billing_mutation_performed=false" in runtime_hotfix, "runtime hotfix must prove no billing mutation")
    require("production_database_mutation_performed=false" in runtime_hotfix, "runtime hotfix must prove no database mutation")
    require("production_merchant_reinstall_required=false" in runtime_hotfix, "runtime hotfix must prove no merchant reinstall")
    require("production_rollback_window_reset_required=true" in runtime_hotfix, "runtime hotfix must require rollback-window reset")
    require("wrangler@4.141.0 deploy" in runtime_hotfix, "runtime hotfix Worker deploy command missing")
    require("SHOPIFY_APP_URL:https://vsn-metafields-production.vertexsystemsnetwork.workers.dev" in runtime_hotfix, "runtime hotfix must stay on Cloudflare production URL")
    require("npx --yes @shopify/cli" not in runtime_hotfix, "runtime hotfix must never invoke Shopify CLI")
    require("appSubscriptionCreate" not in runtime_hotfix, "runtime hotfix must never create subscriptions")
    require("appSubscriptionCancel" not in runtime_hotfix, "runtime hotfix must never cancel subscriptions")
    require("prisma migrate deploy" not in runtime_hotfix, "runtime hotfix must never mutate production schema")
    require("--allow-deletes" not in runtime_hotfix, "runtime hotfix must never authorize Shopify config deletes")

    require("ROLLBACK_TO_RAILWAY" in rollback, "Railway rollback confirmation missing")
    require("github.ref == 'refs/heads/main'" in rollback, "Railway rollback must require protected main")
    require("ref: main" in rollback, "Railway rollback checkout must pin main")
    require(railway_url in rollback, "Railway rollback URL guard missing")
    require("app release" in rollback and "--allow-updates" in rollback, "Railway rollback release command missing")

    print(f"production_cutover_contract={status}")
    print(f"production_release_authorized={str(release_authorized).lower()}")
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
