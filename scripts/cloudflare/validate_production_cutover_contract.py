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
DEPLOY = ROOT / ".github" / "workflows" / "cloudflare-production-deploy.yml"
ACCEPTANCE = ROOT / ".github" / "workflows" / "cloudflare-production-acceptance.yml"
CANDIDATE = ROOT / ".github" / "workflows" / "shopify-production-cutover-version.yml"
RELEASE = ROOT / ".github" / "workflows" / "shopify-production-cutover-release.yml"
ROLLBACK = ROOT / ".github" / "workflows" / "shopify-production-rollback-railway.yml"


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
    deploy = read(DEPLOY)
    acceptance = read(ACCEPTANCE)
    candidate = read(CANDIDATE)
    release = read(RELEASE)
    rollback = read(ROLLBACK)

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
    require(database.get("provider") == "postgresql", "first production cutover must retain PostgreSQL")
    require(database.get("migrate_during_cutover") is False, "production cutover must not apply schema migrations")
    require(database.get("require_migration_status_clean") is True, "production migration status preflight is required")
    require(rollback_policy.get("keep_railway_available") is True, "Railway rollback must remain available")

    workflows = [deploy, acceptance, candidate, release, rollback]
    for workflow in workflows:
        require("appSubscriptionCreate" not in workflow, "production migration workflow must not create billing subscriptions")
        require("appSubscriptionCancel" not in workflow, "production migration workflow must not cancel billing subscriptions")
        require("--allow-deletes" not in workflow, "Shopify config deletes are forbidden during migration")

    require("workflow_dispatch:" in deploy and "push:" not in deploy, "production Worker deploy must remain manual-only")
    require("production_shopify_cutover_performed=false" in read(ROOT / ".github" / "workflows" / "production-cutover-contract.yml"), "cutover certification must explicitly prove no Shopify cutover occurred")
    require("DEPLOY_PRODUCTION_WORKER_ONLY" in deploy, "production Worker deploy confirmation gate missing")
    require("environment: cloudflare-production" in deploy, "production deploy environment missing")
    require("prisma migrate status" in deploy, "production migration status preflight missing")
    require("prisma migrate deploy" not in deploy, "production deploy must not apply database migrations")
    require("--config wrangler.production.jsonc" in deploy, "production Wrangler config missing from deploy")
    require(cloudflare_url in deploy, "production deploy must pin expected Cloudflare URL")

    require("workflow_dispatch:" in acceptance and "push:" not in acceptance, "production acceptance must remain manual-only")
    require("VERIFY_PRODUCTION_WORKER_ONLY" in acceptance, "production acceptance confirmation gate missing")
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
    require("wrangler" not in acceptance, "production acceptance must never deploy the Worker")
    require("app release" not in acceptance, "production acceptance must never release Shopify config")
    require(cloudflare_url in acceptance, "production acceptance must pin expected Cloudflare URL")
    require(railway_url in acceptance, "production acceptance must pin Railway live URL")

    require("CREATE_PRODUCTION_CUTOVER_VERSION" in candidate, "production cutover candidate confirmation missing")
    require("--config cloudflare-production" in candidate, "production Shopify candidate config missing")
    require("--no-release" in candidate, "production Shopify candidate must remain unreleased")
    require("app release" not in candidate, "candidate workflow must not release Shopify config")
    require('SOURCE_PREFIX="${GITHUB_SHA:0:12}"' in candidate, "candidate version must bind to source ref")
    require("candidate_source_ref=$GITHUB_SHA" in candidate, "candidate source ref evidence missing")

    require("RELEASE_PRODUCTION_CUTOVER" in release, "production release confirmation missing")
    require("release_authorized" in release, "production release must enforce policy authorization")
    require("authorized_version" in release, "production release must pin the exact authorized version")
    require("authorized_source_ref" in release, "production release must pin the candidate source ref")
    require("authorization_record" in release, "production release must require an audit authorization record")
    require("cloudflare-production-cutover-([0-9a-f]{12})-([0-9]+)" in release, "production release version format guard missing")
    require("app release" in release and "--allow-updates" in release, "production release command missing")
    require(cloudflare_url in release, "production release must verify Cloudflare production health")

    require("ROLLBACK_TO_RAILWAY" in rollback, "Railway rollback confirmation missing")
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
