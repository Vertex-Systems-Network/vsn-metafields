#!/usr/bin/env python3
"""Build bounded, masked production Supabase source candidates for GitHub Actions.

The protected SUPABASE_SOURCE_DATABASE_URL remains the credential source. This
resolver preserves its original route (with TLS normalized) and also derives
repository-certified Supabase routes for the audited project. The migration
script probes candidates read-only and accepts a source only after schema,
row-count, access-token coverage, and Session-ID fingerprint verification.

No password or full connection URL is printed.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from urllib.parse import quote, unquote, urlparse, urlunparse

EXPECTED_PROJECT_REF = "kqwlohmfyobsdsdekjzl"
EXPECTED_REGION = "ap-southeast-2"
SHARED_POOLER_HOST = "aws-0-ap-southeast-2.pooler.supabase.com"
DIRECT_HOST = f"db.{EXPECTED_PROJECT_REF}.supabase.co"
DATABASE = "postgres"


def fail(message: str) -> None:
    raise SystemExit(message)


def parse_secret(connection_url: str) -> tuple[str, str, str, int | None, str]:
    parsed = urlparse(connection_url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        fail("SUPABASE_SOURCE_DATABASE_URL must be a PostgreSQL URL.")
    if "@" not in parsed.netloc:
        fail("SUPABASE_SOURCE_DATABASE_URL does not contain database credentials.")

    userinfo, authority = parsed.netloc.rsplit("@", 1)
    if ":" not in userinfo:
        fail("SUPABASE_SOURCE_DATABASE_URL does not contain a database password.")

    raw_username, raw_password = userinfo.split(":", 1)
    username = unquote(raw_username)
    password = unquote(raw_password)
    if not username:
        fail("Supabase source database username is empty.")
    if not password:
        fail("Supabase source database password is empty.")
    if re.fullmatch(r"[\[<].*(?:PASSWORD|password).*[\]>]", password):
        fail("Supabase source database password is still a placeholder.")

    authority_url = urlparse(f"postgresql://placeholder:placeholder@{authority}")
    host = authority_url.hostname or ""
    port = authority_url.port
    database = parsed.path.lstrip("/") or DATABASE
    return username, password, host, port, database


def build_url(username: str, password: str, host: str, port: int, database: str) -> str:
    encoded_user = quote(username, safe="")
    encoded_password = quote(password, safe="")
    netloc = f"{encoded_user}:{encoded_password}@{host}:{port}"
    return urlunparse(
        (
            "postgresql",
            netloc,
            f"/{database}",
            "",
            "sslmode=require&uselibpqcompat=true",
            "",
        )
    )


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

    original_user, password, original_host, original_port, original_database = parse_secret(source_url)

    candidates = [
        (
            "original_normalized",
            build_url(
                original_user,
                password,
                original_host,
                original_port or 5432,
                original_database,
            ),
        ),
        (
            "dedicated_pooler",
            build_url("postgres", password, DIRECT_HOST, 6543, DATABASE),
        ),
        (
            "shared_transaction_pooler",
            build_url(
                f"postgres.{EXPECTED_PROJECT_REF}",
                password,
                SHARED_POOLER_HOST,
                6543,
                DATABASE,
            ),
        ),
        (
            "shared_session_pooler",
            build_url(
                f"postgres.{EXPECTED_PROJECT_REF}",
                password,
                SHARED_POOLER_HOST,
                5432,
                DATABASE,
            ),
        ),
        (
            "direct",
            build_url("postgres", password, DIRECT_HOST, 5432, DATABASE),
        ),
    ]

    seen: set[str] = set()
    unique_candidates: list[tuple[str, str]] = []
    for label, candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        unique_candidates.append((label, candidate))

    with Path(github_env).open("a", encoding="utf-8") as handle:
        for index, (label, candidate) in enumerate(unique_candidates, start=1):
            print(f"::add-mask::{candidate}")
            handle.write(f"SOURCE_DATABASE_URL_CANDIDATE_{index}={candidate}\n")
            handle.write(f"SOURCE_DATABASE_URL_CANDIDATE_{index}_LABEL={label}\n")
        handle.write(f"SOURCE_DATABASE_URL_CANDIDATE_COUNT={len(unique_candidates)}\n")

    original_class = (
        "shared_pooler"
        if original_host.endswith(".pooler.supabase.com")
        else "project_host"
        if original_host == DIRECT_HOST
        else "other_postgresql"
    )

    print("production_supabase_source=candidate_set")
    print(f"production_supabase_project_ref={EXPECTED_PROJECT_REF}")
    print(f"production_supabase_region={EXPECTED_REGION}")
    print(f"production_supabase_original_class={original_class}")
    print(f"production_supabase_original_port={original_port or 5432}")
    print(f"production_supabase_candidate_count={len(unique_candidates)}")
    print("production_supabase_tls=required_libpq_compatible")


if __name__ == "__main__":
    main()
