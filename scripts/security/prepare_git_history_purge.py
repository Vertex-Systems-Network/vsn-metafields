#!/usr/bin/env python3
"""Prepare and validate the Issue #41 Git history purge in a local mirror.

Safety properties:
- default mode is read-only preflight;
- the mirror must resolve to Vertex-Systems-Network/vsn-metafields;
- evidence is written outside Git history as normal filesystem files;
- local history rewrite requires an exact confirmation phrase and expected main SHA;
- this tool NEVER pushes or force-pushes any remote ref;
- no file contents, remote credentials, or secret values are printed.

Recommended usage:

  git clone --mirror https://github.com/Vertex-Systems-Network/vsn-metafields.git vsn-metafields-purge.git
  python /path/to/prepare_git_history_purge.py \
      --repo-dir vsn-metafields-purge.git \
      --evidence-dir vsn-metafields-purge-evidence \
      --expected-main <CURRENT_GITHUB_MAIN_SHA>

After repository-admin freeze/ruleset preparation:

  python /path/to/prepare_git_history_purge.py \
      --repo-dir vsn-metafields-purge.git \
      --evidence-dir vsn-metafields-purge-evidence \
      --expected-main <CURRENT_GITHUB_MAIN_SHA> \
      --rewrite \
      --confirm PURGE_DOT_DOT_GIT_HISTORY
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

TARGET_PREFIX = "..git"
CONFIRMATION = "PURGE_DOT_DOT_GIT_HISTORY"
EXPECTED_REPOSITORY = "Vertex-Systems-Network/vsn-metafields"


class GitCommandError(RuntimeError):
    pass


def run(
    repo_dir: Path,
    *args: str,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(
        ["git", "-C", str(repo_dir), *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and proc.returncode != 0:
        message = proc.stderr.strip() or proc.stdout.strip()
        raise GitCommandError(message or f"git {' '.join(args)} failed")
    return proc


def require_git() -> None:
    if shutil.which("git") is None:
        raise RuntimeError("git is not available on PATH")


def require_git_filter_repo() -> None:
    proc = subprocess.run(
        ["git", "filter-repo", "--version"],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            "git-filter-repo is required for --rewrite but is not available"
        )


def github_repository_from_remote(remote_url: str) -> str | None:
    value = remote_url.strip()
    if value.startswith("git@github.com:"):
        path = value.removeprefix("git@github.com:")
    else:
        parsed = urlparse(value)
        if parsed.hostname != "github.com":
            return None
        path = parsed.path.lstrip("/")

    path = path.rstrip("/")
    if path.endswith(".git"):
        path = path[:-4]

    parts = path.split("/")
    if len(parts) != 2 or not all(parts):
        return None
    return f"{parts[0]}/{parts[1]}"


def verify_repository_identity(repo_dir: Path) -> str:
    proc = run(repo_dir, "config", "--get", "remote.origin.url", check=False)
    if proc.returncode != 0 or not proc.stdout.strip():
        raise RuntimeError(
            "mirror has no origin remote; refuse Issue #41 preparation on an "
            "unidentified repository"
        )

    repository = github_repository_from_remote(proc.stdout)
    if repository is None:
        raise RuntimeError(
            "origin is not a recognizable github.com repository; refuse Issue #41 "
            "preparation"
        )
    if repository.lower() != EXPECTED_REPOSITORY.lower():
        raise RuntimeError(
            "repository identity mismatch: expected "
            f"{EXPECTED_REPOSITORY}, found {repository}"
        )
    return repository


def reachable_git_metadata(repo_dir: Path) -> list[tuple[str, str]]:
    output = run(repo_dir, "rev-list", "--objects", "--all").stdout.splitlines()
    matches: list[tuple[str, str]] = []
    for line in output:
        sha, sep, path = line.partition(" ")
        if not sep:
            continue
        if path == TARGET_PREFIX or path.startswith(TARGET_PREFIX + "/"):
            matches.append((sha, path))
    return matches


def refs(repo_dir: Path) -> list[dict[str, str]]:
    output = run(
        repo_dir,
        "for-each-ref",
        "--format=%(refname) %(objectname)",
        "refs/heads",
        "refs/tags",
    ).stdout.splitlines()
    result: list[dict[str, str]] = []
    for line in output:
        ref_name, _, sha = line.partition(" ")
        if ref_name and sha:
            result.append({"ref": ref_name, "sha": sha})
    return result


def repository_summary(
    repo_dir: Path,
    *,
    verified_repository: str | None = None,
) -> dict[str, object]:
    is_bare = run(repo_dir, "rev-parse", "--is-bare-repository").stdout.strip()
    if is_bare != "true":
        raise RuntimeError(
            "Issue #41 purge must run from a bare/mirror clone, not a working clone"
        )

    repository = verify_repository_identity(repo_dir)
    symbolic_head = run(
        repo_dir,
        "symbolic-ref",
        "-q",
        "HEAD",
        check=False,
    ).stdout.strip()
    head_sha = run(repo_dir, "rev-parse", "HEAD").stdout.strip()
    main_proc = run(repo_dir, "rev-parse", "refs/heads/main", check=False)
    if main_proc.returncode != 0 or not main_proc.stdout.strip():
        raise RuntimeError("mirror does not contain refs/heads/main")
    main_sha = main_proc.stdout.strip()

    ref_rows = refs(repo_dir)
    contaminated = reachable_git_metadata(repo_dir)
    unique_paths = sorted({path for _, path in contaminated})

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repo_dir": str(repo_dir.resolve()),
        "repository": repository,
        "is_bare": True,
        "symbolic_head": symbolic_head or None,
        "head_sha": head_sha,
        "main_sha": main_sha,
        "head_ref_count": sum(row["ref"].startswith("refs/heads/") for row in ref_rows),
        "tag_ref_count": sum(row["ref"].startswith("refs/tags/") for row in ref_rows),
        "refs": ref_rows,
        "reachable_embedded_git_metadata_objects": len(contaminated),
        "unique_embedded_git_metadata_paths": len(unique_paths),
        "sample_embedded_git_metadata_paths": unique_paths[:50],
    }


def require_expected_main(summary: dict[str, object], expected_main: str) -> None:
    if not expected_main:
        raise RuntimeError(
            "--rewrite requires --expected-main with the current GitHub main SHA "
            "captured at the maintenance freeze"
        )

    actual = str(summary["main_sha"])
    if actual != expected_main:
        raise RuntimeError(
            "stale or unexpected mirror: refs/heads/main does not match "
            f"--expected-main (mirror={actual}, expected={expected_main})"
        )


def write_evidence(
    evidence_dir: Path,
    name: str,
    summary: dict[str, object],
) -> Path:
    evidence_dir.mkdir(parents=True, exist_ok=True)
    target = evidence_dir / name
    target.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    ref_target = evidence_dir / name.replace(".json", "-refs.txt")
    ref_target.write_text(
        "".join(
            f'{row["ref"]} {row["sha"]}\n'
            for row in summary.get("refs", [])
            if isinstance(row, dict)
        ),
        encoding="utf-8",
    )
    return target


def validate_fsck(repo_dir: Path) -> None:
    proc = run(repo_dir, "fsck", "--full", check=False)
    if proc.returncode != 0:
        raise RuntimeError(
            "git fsck --full failed after rewrite; do not push rewritten refs"
        )


def rewrite_local_mirror(repo_dir: Path) -> None:
    proc = subprocess.run(
        [
            "git",
            "-C",
            str(repo_dir),
            "filter-repo",
            "--sensitive-data-removal",
            "--invert-paths",
            "--path",
            TARGET_PREFIX,
            "--force",
        ],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            proc.stderr.strip()
            or proc.stdout.strip()
            or "git filter-repo failed"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--repo-dir",
        required=True,
        help="Path to the fresh bare/mirror clone to audit or rewrite",
    )
    parser.add_argument(
        "--evidence-dir",
        required=True,
        help="Filesystem directory for pre/post evidence; do not place it in the public repo",
    )
    parser.add_argument(
        "--expected-main",
        default="",
        help=(
            "Current GitHub main SHA captured at freeze time. Optional for read-only "
            "preflight; mandatory for --rewrite."
        ),
    )
    parser.add_argument(
        "--rewrite",
        action="store_true",
        help="Rewrite the LOCAL MIRROR only. This tool never pushes.",
    )
    parser.add_argument(
        "--confirm",
        default="",
        help=f"Required with --rewrite: {CONFIRMATION}",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_dir = Path(args.repo_dir).expanduser().resolve()
    evidence_dir = Path(args.evidence_dir).expanduser().resolve()

    require_git()
    if not repo_dir.is_dir():
        raise RuntimeError(f"repo directory does not exist: {repo_dir}")

    before = repository_summary(repo_dir)
    if args.expected_main:
        require_expected_main(before, args.expected_main)
    before_path = write_evidence(evidence_dir, "pre-rewrite.json", before)

    print(f"preflight_evidence={before_path}")
    print(f"repository={before['repository']}")
    print(f"main_sha={before['main_sha']}")
    print(f"head_ref_count={before['head_ref_count']}")
    print(f"tag_ref_count={before['tag_ref_count']}")
    print(
        "reachable_embedded_git_metadata_objects="
        f"{before['reachable_embedded_git_metadata_objects']}"
    )

    if not args.rewrite:
        print("mode=preflight_only")
        print("remote_push_performed=false")
        return 0

    if args.confirm != CONFIRMATION:
        raise RuntimeError(
            "--rewrite requires the exact confirmation phrase "
            f"{CONFIRMATION}"
        )
    require_expected_main(before, args.expected_main)

    if int(before["reachable_embedded_git_metadata_objects"]) == 0:
        print("history_status=already_clean")
        print("remote_push_performed=false")
        return 0

    require_git_filter_repo()
    rewrite_local_mirror(repo_dir)

    after = repository_summary(
        repo_dir,
        verified_repository=str(before["repository"]),
    )
    validate_fsck(repo_dir)
    after_path = write_evidence(evidence_dir, "post-rewrite.json", after)

    if int(after["reachable_embedded_git_metadata_objects"]) != 0:
        raise RuntimeError(
            "rewritten mirror still contains reachable ..git history; do not push"
        )

    print(f"post_rewrite_evidence={after_path}")
    print("history_status=clean_local_mirror")
    print("git_fsck=pass")
    print("remote_push_performed=false")
    print(
        "next_step=review rewritten refs, secret-scan the mirror, then use the "
        "Issue #41 admin maintenance procedure to update GitHub"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, GitCommandError) as exc:
        print(f"error={exc}", file=sys.stderr)
        raise SystemExit(1)
