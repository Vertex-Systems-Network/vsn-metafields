#!/usr/bin/env python3
"""Read-only audit for accidental embedded Git metadata in reachable history.

This script never prints file contents or secret values. It reports only
path/ref metadata needed to verify Issue #41 remediation.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from collections import defaultdict


TARGET_PREFIX = "..git"


def git(*args: str) -> str:
    proc = subprocess.run(
        ["git", *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"git {' '.join(args)} failed")
    return proc.stdout


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--require-clean",
        action="store_true",
        help="exit non-zero if reachable history still contains ..git paths",
    )
    args = parser.parse_args()

    objects = git("rev-list", "--objects", "--all").splitlines()
    contaminated: list[tuple[str, str]] = []

    for line in objects:
        sha, sep, path = line.partition(" ")
        if not sep:
            continue
        if path == TARGET_PREFIX or path.startswith(TARGET_PREFIX + "/"):
            contaminated.append((sha, path))

    refs = git(
        "for-each-ref",
        "--format=%(refname) %(objectname)",
        "refs/heads",
        "refs/tags",
    ).splitlines()

    by_top_level: dict[str, int] = defaultdict(int)
    for _, path in contaminated:
        parts = path.split("/", 2)
        key = "/".join(parts[:2]) if len(parts) > 1 else path
        by_top_level[key] += 1

    print(f"reachable_embedded_git_metadata_paths={len(contaminated)}")
    print(f"active_head_tag_refs={len(refs)}")

    if contaminated:
        unique_paths = sorted({path for _, path in contaminated})
        print(f"unique_embedded_git_metadata_paths={len(unique_paths)}")
        print("sample_paths:")
        for path in unique_paths[:25]:
            print(f"- {path}")
        if len(unique_paths) > 25:
            print(f"- ... {len(unique_paths) - 25} more paths omitted")
    else:
        print("history_status=clean")

    if args.require_clean and contaminated:
        print(
            "history_status=contaminated; purge required before Issue #41 can close",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
