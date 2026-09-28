#!/usr/bin/env python3
"""Build a read-only, SHA-bound Issue #41 administrator maintenance bundle.

The bundle converts a previously frozen private ref snapshot plus the committed
retirement policy into deterministic execution evidence. This tool NEVER
changes GitHub refs, rulesets, repository history, or the maintenance mirror.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

EXPECTED_REPOSITORY = "Vertex-Systems-Network/vsn-metafields"
EXPECTED_ISSUE = 41
DEFAULT_RULESET_ID = 24085428
DEFAULT_POLICY = (
    Path(__file__).resolve().parents[2]
    / "config"
    / "security"
    / "issue-41-ref-retirement-policy.json"
)


class BundleError(RuntimeError):
    pass


def load_json(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise BundleError(f"expected JSON object: {path}")
    return payload


def canonical_bytes(payload: dict[str, object]) -> bytes:
    return (
        json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        + "\n"
    ).encode("utf-8")


def sha256_payload(payload: dict[str, object]) -> str:
    return hashlib.sha256(canonical_bytes(payload)).hexdigest()


def load_policy(path: Path) -> dict[str, object]:
    policy = load_json(path)
    if policy.get("schema_version") != 1:
        raise BundleError("unsupported retirement policy schema_version")
    if policy.get("repository") != EXPECTED_REPOSITORY:
        raise BundleError("retirement policy repository mismatch")
    if policy.get("issue") != EXPECTED_ISSUE:
        raise BundleError("retirement policy issue mismatch")

    rows = policy.get("refs")
    if not isinstance(rows, list) or not rows:
        raise BundleError("retirement policy refs must be a non-empty list")

    seen: set[str] = set()
    preserved: list[str] = []
    for row in rows:
        if not isinstance(row, dict):
            raise BundleError("retirement policy row must be an object")
        branch = row.get("branch")
        disposition = row.get("disposition")
        evidence = row.get("evidence")
        if not isinstance(branch, str) or not branch:
            raise BundleError("retirement policy contains invalid branch")
        if branch in seen:
            raise BundleError(f"duplicate policy branch: {branch}")
        seen.add(branch)
        if disposition not in {
            "preserve",
            "retire",
            "confirm_retire",
            "retire_after_merge",
        }:
            raise BundleError(f"unsupported disposition for {branch}: {disposition}")
        if not isinstance(evidence, str) or not evidence:
            raise BundleError(f"missing retirement evidence for {branch}")
        if disposition == "preserve":
            preserved.append(branch)

    if preserved != ["main"]:
        raise BundleError("retirement policy must preserve exactly main")
    return policy


def load_snapshot(path: Path, policy: dict[str, object]) -> dict[str, object]:
    snapshot = load_json(path)
    if snapshot.get("schema_version") != 1:
        raise BundleError("unsupported freeze snapshot schema_version")
    if snapshot.get("repository") != EXPECTED_REPOSITORY:
        raise BundleError("freeze snapshot repository mismatch")
    if snapshot.get("issue") != EXPECTED_ISSUE:
        raise BundleError("freeze snapshot issue mismatch")

    heads = snapshot.get("heads")
    tags = snapshot.get("tags")
    if not isinstance(heads, dict) or not heads:
        raise BundleError("freeze snapshot heads must be a non-empty object")
    if not isinstance(tags, dict):
        raise BundleError("freeze snapshot tags must be an object")
    if not all(
        isinstance(name, str) and isinstance(sha, str) and len(sha) == 40
        for name, sha in heads.items()
    ):
        raise BundleError("freeze snapshot contains invalid branch SHA entries")
    if not all(
        isinstance(name, str) and isinstance(sha, str) and len(sha) == 40
        for name, sha in tags.items()
    ):
        raise BundleError("freeze snapshot contains invalid tag SHA entries")

    policy_names = {
        str(row["branch"])
        for row in policy["refs"]
        if isinstance(row, dict)
    }
    if set(heads) != policy_names:
        raise BundleError(
            "freeze snapshot branch set does not match retirement policy; "
            f"unexpected={sorted(set(heads) - policy_names)}, "
            f"missing={sorted(policy_names - set(heads))}"
        )

    allowed_tags = policy.get("allowed_tags", [])
    if not isinstance(allowed_tags, list) or not all(
        isinstance(tag, str) for tag in allowed_tags
    ):
        raise BundleError("retirement policy allowed_tags must be a string list")
    if set(tags) != set(allowed_tags):
        raise BundleError(
            "freeze snapshot tag set does not match retirement policy; "
            f"unexpected={sorted(set(tags) - set(allowed_tags))}, "
            f"missing={sorted(set(allowed_tags) - set(tags))}"
        )

    main_sha = heads.get("main")
    if snapshot.get("main_sha") != main_sha:
        raise BundleError("freeze snapshot main_sha does not match heads.main")

    main_tree_sha = snapshot.get("main_tree_sha")
    if not isinstance(main_tree_sha, str) or len(main_tree_sha) != 40:
        raise BundleError("freeze snapshot main_tree_sha must be a 40-character SHA")
    return snapshot


def required_confirmations(policy: dict[str, object]) -> set[str]:
    return {
        str(row["branch"])
        for row in policy["refs"]
        if isinstance(row, dict) and row.get("disposition") == "confirm_retire"
    }


def require_confirmations(
    policy: dict[str, object],
    supplied_confirmations: list[str],
) -> list[str]:
    required = required_confirmations(policy)
    supplied = set(supplied_confirmations)
    unknown = supplied - required
    if unknown:
        raise BundleError(
            "confirmation supplied for non-confirm_retire branch: "
            + ", ".join(sorted(unknown))
        )
    pending = required - supplied
    if pending:
        raise BundleError(
            "maintenance bundle requires explicit retirement confirmation for: "
            + ", ".join(sorted(pending))
        )
    return sorted(supplied)


def build_bundle(
    policy: dict[str, object],
    snapshot: dict[str, object],
    confirmed: list[str],
    *,
    ruleset_id: int,
) -> dict[str, object]:
    heads = snapshot["heads"]
    assert isinstance(heads, dict)

    retire: list[dict[str, object]] = []
    preserve: list[dict[str, object]] = []
    for row in policy["refs"]:
        assert isinstance(row, dict)
        branch = str(row["branch"])
        entry = {
            "branch": branch,
            "expected_sha": str(heads[branch]),
            "disposition": str(row["disposition"]),
            "evidence": str(row["evidence"]),
        }
        if row["disposition"] == "preserve":
            preserve.append(entry)
        else:
            retire.append(entry)

    snapshot_digest = sha256_payload(snapshot)
    policy_digest = sha256_payload(policy)
    return {
        "schema_version": 1,
        "repository": EXPECTED_REPOSITORY,
        "issue": EXPECTED_ISSUE,
        "mode": "read_only_execution_evidence",
        "snapshot_sha256": snapshot_digest,
        "policy_sha256": policy_digest,
        "ruleset_id": ruleset_id,
        "main_before_sha": str(heads["main"]),
        "main_before_tree_sha": str(snapshot["main_tree_sha"]),
        "expected_post_rewrite_heads": ["main"],
        "expected_post_rewrite_tags": sorted(str(tag) for tag in snapshot["tags"]),
        "preserve_refs": preserve,
        "retire_refs": retire,
        "confirmed_retire_branches": confirmed,
        "required_preconditions": [
            "repository write freeze is active",
            "private rollback mirror and freeze snapshot are available",
            "live refs still match the freeze snapshot exactly",
            "all Category-C retirement candidates are explicitly confirmed",
            "ruleset maintenance is performed by an authorized repository administrator",
        ],
        "required_postconditions": [
            "only approved preserved refs remain before local history rewrite",
            "non_fast_forward protection is restored immediately after remote rewrite",
            "fresh clone has zero reachable ..git paths",
            "git fsck --full passes",
            "App Validation and AI Native Quality Gates pass",
        ],
        "remote_mutation_performed": False,
    }


def render_transaction(bundle: dict[str, object]) -> str:
    retire = bundle["retire_refs"]
    assert isinstance(retire, list)
    lines = [
        "# Issue #41 SHA-bound ref retirement transaction",
        f"repository={bundle['repository']}",
        f"ruleset_id={bundle['ruleset_id']}",
        f"main_before_sha={bundle['main_before_sha']}",
        f"main_before_tree_sha={bundle['main_before_tree_sha']}",
        f"snapshot_sha256={bundle['snapshot_sha256']}",
        f"policy_sha256={bundle['policy_sha256']}",
        "",
        "# Each retirement MUST be rejected if the live branch SHA differs.",
    ]
    for row in retire:
        assert isinstance(row, dict)
        lines.append(
            f"RETIRE refs/heads/{row['branch']} EXPECTED_SHA {row['expected_sha']}"
        )
    lines.extend(
        [
            "",
            f"PRESERVE refs/heads/main EXPECTED_SHA {bundle['main_before_sha']}",
            "",
            "# This file is evidence only. It is intentionally non-executable.",
        ]
    )
    return "\n".join(lines) + "\n"


def render_rollback(bundle: dict[str, object], snapshot: dict[str, object]) -> str:
    heads = snapshot["heads"]
    tags = snapshot["tags"]
    assert isinstance(heads, dict)
    assert isinstance(tags, dict)

    lines = [
        "# Issue #41 pre-maintenance rollback ref map",
        f"repository={bundle['repository']}",
        f"snapshot_sha256={bundle['snapshot_sha256']}",
        "# Restoring these refs republishes pre-purge history; use only for recovery.",
    ]
    for name, sha in sorted(heads.items()):
        lines.append(f"refs/heads/{name} {sha}")
    for name, sha in sorted(tags.items()):
        lines.append(f"refs/tags/{name} {sha}")
    return "\n".join(lines) + "\n"


def require_external_output_dir(path: Path) -> None:
    public_repo_root = Path(__file__).resolve().parents[2]
    if path.is_relative_to(public_repo_root):
        raise BundleError("maintenance bundle output must be outside the public repository")


def write_bundle(
    output_dir: Path,
    bundle: dict[str, object],
    snapshot: dict[str, object],
) -> None:
    require_external_output_dir(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    bundle_path = output_dir / "maintenance-bundle.json"
    transaction_path = output_dir / "ref-retirement-transaction.txt"
    rollback_path = output_dir / "rollback-ref-map.txt"
    digest_path = output_dir / "maintenance-bundle.sha256"

    bundle_bytes = json.dumps(bundle, indent=2, sort_keys=True).encode("utf-8") + b"\n"
    bundle_path.write_bytes(bundle_bytes)
    transaction_path.write_text(render_transaction(bundle), encoding="utf-8")
    rollback_path.write_text(render_rollback(bundle, snapshot), encoding="utf-8")
    digest_path.write_text(
        hashlib.sha256(bundle_bytes).hexdigest() + "  maintenance-bundle.json\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--policy", default=str(DEFAULT_POLICY))
    parser.add_argument("--output-dir", required=True)
    parser.add_argument(
        "--confirm-retire",
        action="append",
        default=[],
        help="Repeat for each confirm_retire branch explicitly approved for retirement.",
    )
    parser.add_argument("--ruleset-id", type=int, default=DEFAULT_RULESET_ID)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    policy = load_policy(Path(args.policy).expanduser().resolve())
    snapshot = load_snapshot(Path(args.snapshot).expanduser().resolve(), policy)
    confirmed = require_confirmations(policy, args.confirm_retire)
    if args.ruleset_id <= 0:
        raise BundleError("--ruleset-id must be positive")

    bundle = build_bundle(
        policy,
        snapshot,
        confirmed,
        ruleset_id=args.ruleset_id,
    )
    output_dir = Path(args.output_dir).expanduser().resolve()
    write_bundle(output_dir, bundle, snapshot)

    print(f"bundle_dir={output_dir}")
    print(f"main_before_sha={bundle['main_before_sha']}")
    print(f"retire_ref_count={len(bundle['retire_refs'])}")
    print("preserve_ref_count=1")
    print(f"snapshot_sha256={bundle['snapshot_sha256']}")
    print("remote_mutation_performed=false")
    print("maintenance_bundle_status=ready_for_administrator_review")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (BundleError, OSError, json.JSONDecodeError) as exc:
        print(f"error={exc}", file=sys.stderr)
        raise SystemExit(1)
