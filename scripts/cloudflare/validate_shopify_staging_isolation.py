#!/usr/bin/env python3
"""Fail closed if Shopify production and Cloudflare staging configs lose isolation."""
from pathlib import Path
import tomllib

ROOT = Path(__file__).resolve().parents[2]
PROD = ROOT / "shopify.app.toml"
STAGING = ROOT / "shopify.app.cloudflare-staging.toml"

RAILWAY = "https://vsn-metafields-production.up.railway.app"
CLOUDFLARE = "https://vsn-metafields-staging.vertexsystemsnetwork.workers.dev"

def load(path):
    with path.open("rb") as f:
        return tomllib.load(f)

prod = load(PROD)
staging = load(STAGING)

assert prod["application_url"] == RAILWAY, "production Shopify URL changed"
assert staging["application_url"] == CLOUDFLARE, "staging Shopify URL changed"
assert CLOUDFLARE not in PROD.read_text(encoding="utf-8"), "staging URL leaked into production config"
assert RAILWAY not in STAGING.read_text(encoding="utf-8"), "production URL leaked into staging config"
assert prod["client_id"] == staging["client_id"], "staging must target the same app identity for controlled validation"
assert prod["access_scopes"]["scopes"] == staging["access_scopes"]["scopes"], "scope drift between production and staging"
assert staging["build"]["automatically_update_urls_on_dev"] is False, "staging config must not auto-update Shopify URLs"

for url in staging["auth"]["redirect_urls"]:
    assert url.startswith(CLOUDFLARE + "/"), f"non-staging redirect URL: {url}"

for url in prod["auth"]["redirect_urls"]:
    assert url.startswith(RAILWAY + "/"), f"non-production redirect URL: {url}"

print("Shopify production/staging isolation contract: PASS")
