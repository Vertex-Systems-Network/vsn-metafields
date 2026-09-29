#!/usr/bin/env python3
"""Resolve a Neon direct connection URL from the pooled production DATABASE_URL.

The workflow may still supply DIRECT_URL explicitly. When it does, this script
validates that it belongs to the same certified Neon endpoint. When DIRECT_URL
is absent, the script derives it by removing the Neon "-pooler" hostname suffix.
Secret-bearing URLs are written only to GITHUB_ENV and masked in GitHub Actions.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse, urlunparse


def fail(message: str) -> None:
    raise SystemExit(message)


def endpoint_id(hostname: str) -> str:
    first = hostname.split(".", 1)[0]
    return first.removesuffix("-pooler")


def validate_neon_url(value: str, *, pooled: bool, expected_endpoint: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"postgres", "postgresql"}:
        fail("Neon database URL must use postgres:// or postgresql://.")
    host = (parsed.hostname or "").lower()
    if not host.endswith(".neon.tech"):
        fail("Neon database URL must use a neon.tech hostname.")
    if endpoint_id(host) != expected_endpoint:
        fail("Neon database URL does not match the repository-certified production endpoint.")
    has_pooler = "-pooler." in host
    if pooled and not has_pooler:
        fail("DATABASE_URL must use the pooled Neon endpoint.")
    if not pooled and has_pooler:
        fail("DIRECT_URL must use the direct Neon endpoint.")
    return host


def derive_direct_url(database_url: str, expected_endpoint: str) -> str:
    parsed = urlparse(database_url)
    pooled_host = validate_neon_url(
        database_url,
        pooled=True,
        expected_endpoint=expected_endpoint,
    )
    direct_host = pooled_host.replace("-pooler.", ".", 1)

    if parsed.port is not None:
        netloc = f"{parsed.username}:{parsed.password}@{direct_host}:{parsed.port}"
    else:
        netloc = f"{parsed.username}:{parsed.password}@{direct_host}"

    direct = urlunparse(
        (
            parsed.scheme,
            netloc,
            parsed.path,
            parsed.params,
            parsed.query,
            parsed.fragment,
        )
    )
    validate_neon_url(direct, pooled=False, expected_endpoint=expected_endpoint)
    return direct


def main() -> int:
    database_url = os.environ.get("DATABASE_URL", "")
    expected_endpoint = os.environ.get("EXPECTED_PRODUCTION_ENDPOINT_ID", "")
    direct_url = os.environ.get("DIRECT_URL", "")
    github_env = os.environ.get("GITHUB_ENV", "")

    if not database_url:
        fail("DATABASE_URL is required.")
    if re.fullmatch(r"ep-[a-z0-9-]+", expected_endpoint) is None:
        fail("EXPECTED_PRODUCTION_ENDPOINT_ID is missing or invalid.")
    if not github_env:
        fail("GITHUB_ENV is required when resolving production database URLs.")

    validate_neon_url(
        database_url,
        pooled=True,
        expected_endpoint=expected_endpoint,
    )

    if direct_url:
        validate_neon_url(
            direct_url,
            pooled=False,
            expected_endpoint=expected_endpoint,
        )
        resolved_direct = direct_url
        source = "explicit"
    else:
        resolved_direct = derive_direct_url(database_url, expected_endpoint)
        source = "derived_from_pooled"

    # Register the credential-bearing URL as masked before any later command can
    # accidentally echo it. Only safe identity metadata is printed below.
    print(f"::add-mask::{resolved_direct}")

    env_file = Path(github_env)
    with env_file.open("a", encoding="utf-8") as handle:
        handle.write(f"DIRECT_URL={resolved_direct}\n")
        handle.write(f"TARGET_DIRECT_URL={resolved_direct}\n")

    print(f"production_neon_direct_url_source={source}")
    print(f"production_neon_endpoint_id={expected_endpoint}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
