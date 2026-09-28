#!/usr/bin/env python3
"""Validate Issue #4 Cloudflare staging invariants without deploying or mutating billing."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INVARIANTS = ROOT / "config" / "cloudflare" / "migration-invariants.json"
WRANGLER = ROOT / "wrangler.jsonc"
SHOPIFY = ROOT / "shopify.app.toml"
SHOPIFY_SERVER = ROOT / "app" / "shopify.server.js"
DB_SERVER = ROOT / "app" / "db.server.js"
PRISMA = ROOT / "prisma" / "schema.prisma"
PACKAGE = ROOT / "package.json"
MIGRATION_DOC = ROOT / "docs" / "cloudflare-migration-baseline.md"


class ValidationError(RuntimeError):
    pass


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_json(path: Path) -> dict[str, object]:
    value = json.loads(read(path))
    if not isinstance(value, dict):
        raise ValidationError(f"expected JSON object: {path}")
    return value


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def main() -> int:
    inv = load_json(INVARIANTS)
    wrangler = load_json(WRANGLER)
    shopify = read(SHOPIFY)
    shopify_server = read(SHOPIFY_SERVER)
    db_server = read(DB_SERVER)
    prisma = read(PRISMA)
    package = load_json(PACKAGE)
    migration_doc = read(MIGRATION_DOC)

    require(inv.get("schema_version") == 1, "unsupported migration invariant schema")
    require(inv.get("issue") == 4, "migration invariant must target Issue #4")
    require(inv.get("environment") == "staging", "Cloudflare baseline must be staging")
    require(
        inv.get("production_cutover_authorized") is False,
        "production cutover must remain unauthorized",
    )

    shopify_inv = inv.get("shopify")
    require(isinstance(shopify_inv, dict), "missing shopify invariant block")
    expected_client_id = str(shopify_inv["client_id"])
    expected_host = str(shopify_inv["production_host"])

    require(
        f'client_id = "{expected_client_id}"' in shopify,
        "Shopify client_id changed during staging preparation",
    )
    require(
        f'application_url = "{expected_host}"' in shopify,
        "production Shopify application_url must remain on Railway",
    )
    require(
        all(expected_host in line for line in re.findall(r'"https://[^"]+/auth[^"]*"', shopify)),
        "production Shopify redirect URLs must remain on Railway",
    )

    require(
        wrangler.get("name") == "vsn-metafields-staging",
        "Cloudflare Worker name must remain staging-only",
    )
    require(
        wrangler.get("main") == "build/server/index.js",
        "Wrangler main must target the React Router server build",
    )
    assets = wrangler.get("assets")
    require(
        isinstance(assets, dict) and assets.get("directory") == "build/client",
        "Wrangler assets must target build/client",
    )
    require("routes" not in wrangler and "route" not in wrangler, "production routes are forbidden")
    require("vars" not in wrangler, "committed Wrangler vars are forbidden; use Worker secrets")

    require(
        re.search(r'provider\s*=\s*"postgresql"', prisma) is not None,
        "first cutover must keep PostgreSQL",
    )
    require(
        re.search(r'engineType\s*=\s*"client"', prisma) is not None,
        "Prisma client must stay engine-less for Workers",
    )
    require("PrismaSessionStorage" in shopify_server, "Shopify session storage must remain Prisma")
    require("process.env.DATABASE_URL" in db_server, "database runtime must remain environment-driven")
    require('import { PrismaPg } from "@prisma/adapter-pg"' in db_server, "PrismaPg adapter is required")
    require("new PrismaPg({ connectionString })" in db_server, "PrismaPg must use DATABASE_URL")
    require("new PrismaClient({" in db_server and "adapter," in db_server, "Prisma Client must receive the adapter")
    require(".$connect(" not in db_server, "eager Prisma connection is forbidden in Worker runtime")

    dependencies = package.get("dependencies")
    dev_dependencies = package.get("devDependencies")
    require(isinstance(dependencies, dict), "package dependencies missing")
    require(isinstance(dev_dependencies, dict), "package devDependencies missing")
    require(dependencies.get("@prisma/client") == "6.19.3", "Prisma Client version drifted")
    require(dependencies.get("@prisma/adapter-pg") == "6.19.3", "Prisma pg adapter version drifted")
    require(dependencies.get("pg") == "8.23.0", "pg runtime version drifted")
    require(dependencies.get("prisma") == "6.19.3", "Prisma CLI version drifted")
    require(dev_dependencies.get("@types/pg") == "8.23.1", "pg type package version drifted")

    compatibility_flags = wrangler.get("compatibility_flags", [])
    require(
        isinstance(compatibility_flags, list) and "nodejs_compat" in compatibility_flags,
        "Cloudflare Node compatibility must be explicit",
    )

    require(
        "currentAppInstallation.activeSubscriptions" in migration_doc,
        "migration baseline must preserve Shopify subscription-read source",
    )
    require(
        "Railway remains available as rollback" in migration_doc,
        "Railway rollback invariant is missing",
    )

    forbidden_files = [WRANGLER, INVARIANTS]
    forbidden_tokens = (
        "SHOPIFY_API_SECRET=",
        "DATABASE_URL=",
        "DIRECT_URL=",
        "appSubscriptionCreate(",
        "appSubscriptionCancel(",
    )
    for path in forbidden_files:
        content = read(path)
        for token in forbidden_tokens:
            require(token not in content, f"forbidden staging artifact content in {path}: {token}")

    print("cloudflare_staging_contract=pass")
    print(f"shopify_client_id={expected_client_id}")
    print(f"production_host={expected_host}")
    print("production_cutover_authorized=false")
    print("billing_mutation_authorized=false")
    print("database_migration_authorized=false")
    print("prisma_worker_adapter=PrismaPg")
    print("prisma_engine_type=client")
    print("railway_rollback_required=true")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValidationError, OSError, json.JSONDecodeError, KeyError) as exc:
        print(f"error={exc}", file=sys.stderr)
        raise SystemExit(1)
