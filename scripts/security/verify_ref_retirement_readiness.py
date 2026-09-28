#!/usr/bin/env python3
"""Read-only Issue #41 ref-retirement readiness guard.

This tool never deletes branches, changes rulesets, pushes, or force-pushes.
It validates the maintenance mirror against the committed retirement policy,
captures an external SHA-bound freeze snapshot, and can later prove that no
branch/tag moved after the freeze.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

EXPECTED_REPOSITORY = "Vertex-Systems-Network/vsn-metafields"
ALLOWED_DISPOSITIONS = {"preserve", "retire", "confirm_retire", "retire_after_merge"}
DEFAULT_POLICY = (
    Path(__file__).resolve().parents[2]
    / "config"
    / "security"
    / "issue-41-ref-retirement-policy.json"
)


class GuardError(RuntimeError):
    pass


def git(repo_dir: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(
        ["git", "-C", str(repo_dir), *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and proc.returncode != 0:
        raise GuardError(proc.stderr.strip() or proc.stdout.strip() or "git command failed")
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


def verify_mirror_identity(repo_dir: Path) -> str:
    bare = git(repo_dir, "rev-parse", "--is-bare-repository").stdout.strip()
    if bare != "true":
        raise GuardError("ref retirement readiness must run from a bare/mirror clone")

    origin = git(repo_dir, "config", "--get", "remote.origin.url", check=False)
    if origin.returncode != 0 or not origin.stdout.strip():
        raise GuardError("mirror has no origin remote; repository identity is unverified")

    repository = github_repository(origin.stdout)
    if repository is None or repository.lower() != EXPECTED_REPOSITORY.lower():
        raise GuardError(
            f"repository identity mismatch: expected {EXPECTED_REPOSITORY}, found {repository!r}"
        )
    return repository


def read_refs(repo_dir: Path, namespace: str) -> dict[str, str]:
    proc = git(
        repo_dir,
        "for-each-ref",
        "--format=%(refname) %(objectname)",
        namespace,
    )
    prefix = namespace.rstrip("/") + "/"
    result: dict[str, str] = {}
    for line in proc.stdout.splitlines():
        ref_name, sep, sha = line.partition(" ")
        if not sep or not ref_name.startswith(prefix):
            continue
        result[ref_name.removeprefix(prefix)] = sha.strip()
    return result


def load_policy(path: Path) -> dict[str, object]:
    policy = json.loads(path.read_text(encoding="utf-8"))
    if policy.get("schema_version") != 1:
        raise GuardError("unsupported retirement policy schema_version")
    if policy.get("repository") != EXPECTED_REPOSITORY:
        raise GuardError("retirement policy repository identity mismatch")

    rows = policy.get("refs")
    if not isinstance(rows, list) or not rows:
        raise GuardError("retirement policy refs must be a non-empty list")

    names: set[str] = set()
    preserve: list[str] = []
    for row in rows:
        if not isinstance(row, dict):
            raise GuardError("retirement policy ref row must be an object")
        name = row.get("branch")
        disposition = row.get("disposition")
        if not isinstance(name, str) or not name:
            raise GuardError("retirement policy branch name is invalid")
        if name in names:
            raise GuardError(f"duplicate branch in retirement policy: {name}")
        names.add(name)
        if disposition not in ALLOWED_DISPOSITIONS:
            raise GuardError(f"invalid disposition for {name}: {disposition}")
        if disposition == "preserve":
            preserve.append(name)

    if preserve != ["main"]:
        raise GuardError("retirement policy must preserve exactly the main branch")
    return policy


def policy_branch_map(policy: dict[str, object]) -> dict[str, dict[str, object]]:
    return {
        str(row["branch"]): row
        for row in policy["refs"]
        if isinstance(row, dict)
    }


def validate_live_ref_set(
    policy: dict[str, object],
    heads: dict[str, str],
    tags: dict[str, str],
) -> None:
    expected_heads = set(policy_branch_map(policy))
    actual_heads = set(heads)
    if actual_heads != expected_heads:
        raise GuardError(
            "live branch set drifted from retirement policy; "
            f"unexpected={sorted(actual_heads - expected_heads)}, "
            f"missing={sorted(expected_heads - actual_heads)}"
        )

    allowed_tags = policy.get("allowed_tags", [])
    if not isinstance(allowed_tags, list) or not all(isinstance(x, str) for x in allowed_tags):
        raise GuardError("allowed_tags must be a string list")
    if set(tags) != set(allowed_tags):
        raise GuardError(
            "live tag set drifted from retirement policy; "
            f"unexpected={sorted(set(tags) - set(allowed_tags))}, "
            f"missing={sorted(set(allowed_tags) - set(tags))}"
        )


def required_confirmations(policy: dict[str, object]) -> set[str]:
    return {
        str(row["branch"])
        for row in policy["refs"]
        if isinstance(row, dict) and row.get("disposition") == "confirm_retire"
    }


def snapshot_payload(
    repository: str,
    policy: dict[str, object],
    heads: dict[str, str],
    tags: dict[str, str],
) -> dict[str, object]:
    return {
        "schema_version": 1,
        "repository": repository,
        "issue": 41,
        "main_sha": heads["main"],
        "heads": dict(sorted(heads.items())),
        "tags": dict(sorted(tags.items())),
        "policy_schema_version": policy["schema_version"],
    }


def write_snapshot(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def verify_snapshot(path: Path, current: dict[str, object]) -> None:
    frozen = json.loads(path.read_text(encoding="utf-8"))
    for key in ("schema_version", "repository", "issue", "main_sha", "heads", "tags"):
        if frozen.get(key) != current.get(key):
            raise GuardError(f"freeze snapshot mismatch for {key}; stop maintenance")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-dir", required=True)
    parser.add_argument("--policy", default=str(DEFAULT_POLICY))
    parser.add_argument(
        "--confirm-retire",
        action="append",
        default=[],
        help="Repeat for each confirm_retire branch explicitly approved for retirement.",
    )
    parser.add_argument(
        "--write-snapshot",
        default="",
        help="Write private external SHA-bound freeze evidence to this path.",
    )
    parser.add_argument(
        "--verify-snapshot",
        default="",
        help="Verify current refs are byte-for-byte equivalent to a prior freeze snapshot.",
    )
    parser.add_argument(
        "--require-ready",
        action="store_true",
        help="Fail unless all confirm_retire branches were explicitly acknowledged.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_dir = Path(args.repo_dir).expanduser().resolve()
    policy_path = Path(args.policy).expanduser().resolve()

    if not repo_dir.is_dir():
        raise GuardError(f"repo directory does not exist: {repo_dir}")
    if not policy_path.is_file():
        raise GuardError(f"policy file does not exist: {policy_path}")

    repository = verify_mirror_identity(repo_dir)
    policy = load_policy(policy_path)
    heads = read_refs(repo_dir, "refs/heads")
    tags = read_refs(repo_dir, "refs/tags")
    validate_live_ref_set(policy, heads, tags)

    required = required_confirmations(policy)
    supplied = set(args.confirm_retire)
    unknown = supplied - required
    if unknown:
        raise GuardError(f"confirmation supplied for non-confirm_retire branches: {sorted(unknown)}")
    pending = sorted(required - supplied)

    current = snapshot_payload(repository, policy, heads, tags)
    if args.verify_snapshot:
        verify_snapshot(Path(args.verify_snapshot).expanduser().resolve(), current)
        print("freeze_snapshot=verified")

    if args.write_snapshot:
        snapshot_path = Path(args.write_snapshot).expanduser().resolve()
        if snapshot_path.is_relative_to(Path.cwd().resolve()):
            # A path inside the repository/working directory is too easy to publish.
            raise GuardError("freeze snapshot must be stored outside the current working directory")
        write_snapshot(snapshot_path, current)
        print(f"freeze_snapshot_written={snapshot_path}")

    print(f"repository={repository}")
    print(f"main_sha={heads['main']}")
    print(f"live_head_count={len(heads)}")
    print(f"live_tag_count={len(tags)}")
    print(f"pending_confirm_retire={','.join(pending) if pending else 'none'}")
    print("remote_mutation_performed=false")

    if args.require_ready and pending:
        raise GuardError(
            "retirement readiness blocked by explicit confirmation requirements: "
            + ", ".join(pending)
        )

    if pending:
        print("retirement_readiness=pending_confirmation")
    else:
        print("retirement_readiness=ready_for_admin_maintenance")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (GuardError, OSError, json.JSONDecodeError) as exc:
        print(f"error={exc}", file=sys.stderr)
        raise SystemExit(1)
