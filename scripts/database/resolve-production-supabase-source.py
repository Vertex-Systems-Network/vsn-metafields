#!/usr/bin/env python3
"""Validate and normalize the exact Supabase pooler URL supplied by the user.

The shared pooler host contains a project-specific cluster index (for example
aws-1-...), so it must be copied from Supabase's Connect dialog. It must not be
derived from the region.

This resolver validates only non-secret identity properties, normalizes TLS to
libpq-compatible sslmode=require semantics, masks the resulting URL, and
exports a single audited source candidate for the migration script.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from urllib.parse import quote, unquote, urlparse, urlunparse

EXPECTED_PROJECT_REF = "kqwlohmfyobsdsdekjzl"
EXPECTED_REGION = "ap-southeast-2"
EXPECTED_DATABASE = "postgres"
ALLOWED_POOLER_PORTS = {5432, 6543}


def fail(message: str) -> None:
    raise SystemExit(message)


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

    parsed = urlparse(source_url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        fail("SUPABASE_SOURCE_DATABASE_URL must be a PostgreSQL URL.")

    host = (parsed.hostname or "").lower()
    port = parsed.port or 5432
    username = unquote(parsed.username or "")
    password = unquote(parsed.password or "")
    database = parsed.path.lstrip("/") or EXPECTED_DATABASE

    if not host.endswith(".pooler.supabase.com"):
        fail(
            "SUPABASE_SOURCE_DATABASE_URL must be copied from Supabase Connect "
            "(Session pooler or Transaction pooler); do not use a derived, "
            "Railway-internal, or direct IPv6 hostname."
        )

    # The cluster prefix is project-specific and intentionally not derived.
    if not re.fullmatch(r"aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com", host):
        fail("Supabase pooler hostname format is not recognized.")

    expected_username = f"postgres.{EXPECTED_PROJECT_REF}"
    if username != expected_username:
        fail("Supabase pooler username must include the certified project ref.")

    if port not in ALLOWED_POOLER_PORTS:
        fail("Supabase pooler port must be 5432 (session) or 6543 (transaction).")

    if database != EXPECTED_DATABASE:
        fail("Supabase source database must be postgres.")

    if not password:
        fail("Supabase source database password is empty.")
    if re.fullmatch(r"[\[<].*(?:PASSWORD|password).*[\]>]", password):
        fail("Supabase source database password is still a placeholder.")

    encoded_user = quote(username, safe="")
    encoded_password = quote(password, safe="")
    normalized = urlunparse(
        (
            "postgresql",
            f"{encoded_user}:{encoded_password}@{host}:{port}",
            f"/{database}",
            "",
            "sslmode=require&uselibpqcompat=true",
            "",
        )
    )

    print(f"::add-mask::{normalized}")
    with Path(github_env).open("a", encoding="utf-8") as handle:
        handle.write(f"SOURCE_DATABASE_URL_CANDIDATE_1={normalized}\n")
        handle.write("SOURCE_DATABASE_URL_CANDIDATE_1_LABEL=exact_supabase_connect_pooler\n")
        handle.write("SOURCE_DATABASE_URL_CANDIDATE_COUNT=1\n")

    mode = "session" if port == 5432 else "transaction"
    print("production_supabase_source=exact_connect_pooler")
    print(f"production_supabase_project_ref={EXPECTED_PROJECT_REF}")
    print(f"production_supabase_region={EXPECTED_REGION}")
    print(f"production_supabase_pooler_port={port}")
    print(f"production_supabase_pooler_mode={mode}")
    print("production_supabase_cluster_host=connect_dialog_exact")
    print("production_supabase_tls=required_libpq_compatible")


if __name__ == "__main__":
    main()
