#!/usr/bin/env python3
"""Certify Issue #41 after the administrator-controlled history rewrite.

This verifier is read-only. It must run against a brand-new bare/mirror clone
of the rewritten GitHub repository and compares the post-rewrite repository
with the pre-rewrite maintenance bundle. It never pushes, rewrites, deletes,
or changes repository/ruleset state.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

EXPECTED_REPOSITORY = "Vertex-Systems-Network/vsn-metafields"
EXPECTED_ISSUE = 41
TARGET_PREFIX = "..git"


class CertificationError(RuntimeError):
    pass


def git(
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
        raise CertificationError(
            proc.stderr.strip() or proc.stdout.strip() or "git command failed"
        )
    return proc


def github_repository(remote_url: str) -> str | None:
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


def verify_fresh_mirror_identity(repo_dir: Path) -> str:
    bare = git(repo_dir, "rev-parse", "--is-bare-repository").stdout.strip()
    if bare != "true":
        raise CertificationError(
            "post-rewrite certification must run from a fresh bare/mirror clone"
        )

    origin = git(repo_dir, "config", "--get", "remote.origin.url", check=False)
    if origin.returncode != 0 or not origin.stdout.strip():
        raise CertificationError("fresh mirror has no origin remote")

    repository = github_repository(origin.stdout)
    if repository is None or repository.lower() != EXPECTED_REPOSITORY.lower():
        raise CertificationError(
            "repository identity mismatch: expected "
            f"{EXPECTED_REPOSITORY}, found {repository!r}"
        )
    return repository


def load_bundle(path: Path) -> dict[str, object]:
    bundle = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(bundle, dict):
        raise CertificationError("maintenance bundle must be a JSON object")
    if bundle.get("schema_version") != 1:
        raise CertificationError("unsupported maintenance bundle schema_version")
    if bundle.get("repository") != EXPECTED_REPOSITORY:
        raise CertificationError("maintenance bundle repository mismatch")
    if bundle.get("issue") != EXPECTED_ISSUE:
        raise CertificationError("maintenance bundle issue mismatch")

    before_tree = bundle.get("main_before_tree_sha")
    if not isinstance(before_tree, str) or len(before_tree) != 40:
        raise CertificationError(
            "maintenance bundle main_before_tree_sha must be a 40-character SHA"
        )

    expected_heads = bundle.get("expected_post_rewrite_heads")
    expected_tags = bundle.get("expected_post_rewrite_tags")
    if expected_heads != ["main"]:
        raise CertificationError(
            "maintenance bundle must require main as the sole post-rewrite head"
        )
    if not isinstance(expected_tags, list) or not all(
        isinstance(tag, str) for tag in expected_tags
    ):
        raise CertificationError(
            "maintenance bundle expected_post_rewrite_tags must be a string list"
        )
    return bundle


def read_refs(repo_dir: Path, namespace: str) -> dict[str, str]:
    output = git(
        repo_dir,
        "for-each-ref",
        "--format=%(refname) %(objectname)",
        namespace,
    ).stdout.splitlines()
    prefix = namespace.rstrip("/") + "/"
    result: dict[str, str] = {}
    for line in output:
        ref_name, sep, sha = line.partition(" ")
        if sep and ref_name.startswith(prefix):
            result[ref_name.removeprefix(prefix)] = sha.strip()
    return result


def reachable_embedded_git_metadata(repo_dir: Path) -> list[str]:
    matches: list[str] = []
    for line in git(repo_dir, "rev-list", "--objects", "--all").stdout.splitlines():
        _, sep, path = line.partition(" ")
        if not sep:
            continue
        if path == TARGET_PREFIX or path.startswith(TARGET_PREFIX + "/"):
            matches.append(path)
    return sorted(set(matches))


def validate_fsck(repo_dir: Path) -> None:
    proc = git(repo_dir, "fsck", "--full", check=False)
    if proc.returncode != 0:
        raise CertificationError(
            "git fsck --full failed in post-rewrite mirror"
        )


def require_external_evidence_dir(path: Path, repo_dir: Path) -> None:
    public_repo_root = Path(__file__).resolve().parents[2]
    if path.is_relative_to(public_repo_root) or path.is_relative_to(repo_dir):
        raise CertificationError(
            "certification evidence must be stored outside both the public "
            "repository and fresh verification mirror"
        )


def certify(
    repo_dir: Path,
    bundle: dict[str, object],
) -> dict[str, object]:
    repository = verify_fresh_mirror_identity(repo_dir)
    heads = read_refs(repo_dir, "refs/heads")
    tags = read_refs(repo_dir, "refs/tags")

    expected_heads = set(bundle["expected_post_rewrite_heads"])
    expected_tags = set(bundle["expected_post_rewrite_tags"])
    if set(heads) != expected_heads:
        raise CertificationError(
            "post-rewrite head set mismatch; "
            f"unexpected={sorted(set(heads) - expected_heads)}, "
            f"missing={sorted(expected_heads - set(heads))}"
        )
    if set(tags) != expected_tags:
        raise CertificationError(
            "post-rewrite tag set mismatch; "
            f"unexpected={sorted(set(tags) - expected_tags)}, "
            f"missing={sorted(expected_tags - set(tags))}"
        )

    main_after_sha = heads["main"]
    main_after_tree_sha = git(
        repo_dir,
        "rev-parse",
        "refs/heads/main^{tree}",
    ).stdout.strip()
    if main_after_tree_sha != bundle["main_before_tree_sha"]:
        raise CertificationError(
            "main application tree changed across history rewrite; "
            f"before={bundle['main_before_tree_sha']}, after={main_after_tree_sha}"
        )

    contaminated = reachable_embedded_git_metadata(repo_dir)
    if contaminated:
        raise CertificationError(
            "rewritten history still exposes reachable ..git metadata; "
            f"sample={contaminated[:10]}"
        )

    validate_fsck(repo_dir)

    return {
        "schema_version": 1,
        "repository": repository,
        "issue": EXPECTED_ISSUE,
        "certified_at": datetime.now(timezone.utc).isoformat(),
        "main_before_sha": bundle.get("main_before_sha"),
        "main_after_sha": main_after_sha,
        "main_tree_sha": main_after_tree_sha,
        "tree_preserved": True,
        "reachable_embedded_git_metadata_paths": 0,
        "head_refs": dict(sorted(heads.items())),
        "tag_refs": dict(sorted(tags.items())),
        "git_fsck": "pass",
        "history_rewrite_certification": "pass",
        "remote_mutation_performed": False,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--repo-dir",
        required=True,
        help="Path to a brand-new bare/mirror clone of the rewritten repository",
    )
    parser.add_argument(
        "--bundle",
        required=True,
        help="Path to the pre-rewrite private maintenance-bundle.json",
    )
    parser.add_argument(
        "--evidence-dir",
        required=True,
        help="Private external directory for post-rewrite certification evidence",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_dir = Path(args.repo_dir).expanduser().resolve()
    bundle_path = Path(args.bundle).expanduser().resolve()
    evidence_dir = Path(args.evidence_dir).expanduser().resolve()

    if not repo_dir.is_dir():
        raise CertificationError(f"verification mirror does not exist: {repo_dir}")
    if not bundle_path.is_file():
        raise CertificationError(f"maintenance bundle does not exist: {bundle_path}")

    require_external_evidence_dir(evidence_dir, repo_dir)
    bundle = load_bundle(bundle_path)
    evidence = certify(repo_dir, bundle)

    evidence_dir.mkdir(parents=True, exist_ok=True)
    evidence_path = evidence_dir / "post-rewrite-certification.json"
    evidence_path.write_text(
        json.dumps(evidence, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    print(f"certification_evidence={evidence_path}")
    print(f"main_after_sha={evidence['main_after_sha']}")
    print(f"main_tree_sha={evidence['main_tree_sha']}")
    print("tree_preserved=true")
    print("reachable_embedded_git_metadata_paths=0")
    print("git_fsck=pass")
    print("remote_mutation_performed=false")
    print("history_rewrite_certification=pass")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (CertificationError, OSError, json.JSONDecodeError) as exc:
        print(f"error={exc}", file=sys.stderr)
        raise SystemExit(1)
