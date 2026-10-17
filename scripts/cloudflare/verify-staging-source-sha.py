#!/usr/bin/env python3
"""Pin manual staging deployment to the dispatched development commit.

Runs before staging secrets, database migrations, builds, or Worker deployment.
It never contacts Production and never prints GitHub/Shopify/DB secrets.
"""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path


def verify_source_sha(checked_out: str, dispatched: str, ref: str) -> str:
    if ref != "refs/heads/development":
        raise ValueError("Staging dispatch must target the development branch.")
    if not re.fullmatch(r"[0-9a-f]{40}", dispatched or ""):
        raise ValueError("Invalid dispatch commit SHA.")
    if not re.fullmatch(r"[0-9a-f]{40}", checked_out or ""):
        raise ValueError("Invalid checked-out commit SHA.")
    if checked_out != dispatched:
        raise ValueError(
            "Development HEAD changed after staging dispatch; "
            "rerun the guarded workflow against the new commit."
        )
    return checked_out


def main() -> None:
    checked_out = subprocess.check_output(
        ["git", "rev-parse", "--verify", "HEAD"], text=True
    ).strip()
    sha = verify_source_sha(
        checked_out,
        os.environ.get("GITHUB_SHA", ""),
        os.environ.get("GITHUB_REF", ""),
    )
    env_file = os.environ.get("GITHUB_ENV", "")
    if not env_file:
        raise ValueError("Missing GitHub Actions environment file.")
    with Path(env_file).open("a", encoding="utf-8") as handle:
        handle.write(f"APP_COMMIT_SHA={sha}\n")
    print(f"staging_source_sha_verified={sha}")


if __name__ == "__main__":
    main()
