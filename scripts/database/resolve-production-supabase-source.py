#!/usr/bin/env python3
"""Canonicalize the production Supabase source connection for GitHub Actions.

GitHub-hosted runners are IPv4-only for this workflow. The restored Supabase
project's direct database endpoint is IPv6 on the free tier, so migration reads
must use the Shared Pooler in session mode.

The existing SUPABASE_SOURCE_DATABASE_URL is treated only as a protected source
for the database password. Host, username, port, and database are rebuilt from
repository-certified project identity and region. The derived URL is masked
before being exported through GITHUB_ENV.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from urllib.parse import quote, unquote, urlparse, urlunparse

EXPECTED_PROJECT_REF = "kqwlohmfyobsdsdekjzl"
EXPECTED_REGION = "ap-southeast-2"
SESSION_POOLER_HOST = "aws-0-ap-southeast-2.pooler.supabase.com"
SESSION_POOLER_PORT = 5432
SESSION_DATABASE = "postgres"


def fail(message: str) -> None:
    raise SystemExit(message)


def extract_password(connection_url: str) -> str:
    parsed = urlparse(connection_url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        fail("SUPABASE_SOURCE_DATABASE_URL must be a PostgreSQL URL.")

    # Use the final @ as the authority delimiter so an accidentally unescaped @
    # inside the existing password can still be recovered and re-encoded.
    if "@" not in parsed.netloc:
        fail("SUPABASE_SOURCE_DATABASE_URL does not contain database credentials.")

    userinfo = parsed.netloc.rsplit("@", 1)[0]
    if ":" not in userinfo:
        fail("SUPABASE_SOURCE_DATABASE_URL does not contain a database password.")

    _, raw_password = userinfo.split(":", 1)
    password = unquote(raw_password)

    if not password:
        fail("Supabase source database password is empty.")
    if re.fullmatch(r"[\[<].*(?:PASSWORD|password).*[\]>]", password):
        fail("Supabase source database password is still a placeholder.")

    return password


def main() -> None:
    source_url = os.environ.get("SOURCE_DATABASE_URL", "")
    github_env = os.environ.get("GITHUB_ENV", "")
    project_ref = os.environ.get("EXPECTED_SUPABASE_PROJECT_REF", "")
    region = os.environ.get("EXPECTED_SUPABASE_REGION", "")

    if not source_url:
        fail("SOURCE_DATABASE_URL is required.")
    if not github_env:
        fail("GITHUB_ENV is required.")
    if project_ref != EXPECTED_PROJECT_REF:
        fail("Supabase source project ref does not match repository certification.")
    if region != EXPECTED_REGION:
        fail("Supabase source region does not match repository certification.")

    password = extract_password(source_url)
    encoded_password = quote(password, safe="")
    username = f"postgres.{EXPECTED_PROJECT_REF}"
    netloc = (
        f"{username}:{encoded_password}@"
        f"{SESSION_POOLER_HOST}:{SESSION_POOLER_PORT}"
    )
    canonical = urlunparse(
        (
            "postgresql",
            netloc,
            f"/{SESSION_DATABASE}",
            "",
            "sslmode=verify-full",
            "",
        )
    )

    print(f"::add-mask::{canonical}")
    with Path(github_env).open("a", encoding="utf-8") as handle:
        handle.write(f"SOURCE_DATABASE_URL={canonical}\n")

    print("production_supabase_source=canonical_session_pooler")
    print(f"production_supabase_project_ref={EXPECTED_PROJECT_REF}")
    print(f"production_supabase_region={EXPECTED_REGION}")
    print(f"production_supabase_pooler_port={SESSION_POOLER_PORT}")


if __name__ == "__main__":
    main()
