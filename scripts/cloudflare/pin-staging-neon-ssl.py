"""Pin Neon staging SSL mode and write valid GitHub Actions environment lines.

GitHub's GITHUB_ENV is a line-based file: each assignment MUST end in an
actual newline, not the literal backslash-n sequence. Never log database URLs.
"""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

NAMES = ("DATABASE_URL", "DIRECT_URL")


def pin_staging_ssl(url: str) -> str:
    if not url or any(char in url for char in "\r\n\x00"):
        raise ValueError("A single-line staging PostgreSQL URL is required.")
    parts = urlsplit(url)
    if parts.scheme not in ("postgres", "postgresql") or not (
        parts.hostname or ""
    ).endswith(".neon.tech"):
        raise ValueError("The staging URL must point to Neon PostgreSQL.")
    params = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if key.lower() != "sslmode"
    ]
    params.append(("sslmode", "verify-full"))
    return urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(params), parts.fragment)
    )


def append_staging_env(environ: dict[str, str]) -> None:
    output = environ.get("GITHUB_ENV")
    if not output:
        raise ValueError("GITHUB_ENV path is required.")

    # Calculate and validate both values before changing the environment file.
    values = [(name, pin_staging_ssl(environ.get(name, ""))) for name in NAMES]
    with Path(output).open("a", encoding="utf-8", newline="\n") as handle:
        for name, value in values:
            handle.write(f"{name}={value}\n")


if __name__ == "__main__":
    append_staging_env(os.environ)
    print("staging_neon_ssl_mode_pinned=true")
