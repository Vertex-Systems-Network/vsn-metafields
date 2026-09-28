#!/usr/bin/env python3
"""Execute the SHA-bound Issue #41 non-main ref retirement transaction.

Safety:
- only refs/heads/* listed in the frozen manifest are eligible;
- main is never deleted or updated;
- every frozen branch SHA must match live GitHub before any deletion;
- the executor branch is accepted only if its current head equals the head SHA
  of a merged pull request for that branch;
- open pull requests block execution;
- the exact confirmation phrase is required;
- after deletion, the live branch set must be exactly {"main"}.

This script does not change rulesets and does not rewrite main history.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

EXPECTED_REPOSITORY = "Vertex-Systems-Network/vsn-metafields"
EXPECTED_ISSUE = 41
DEFAULT_MANIFEST = (
    Path(__file__).resolve().parents[2]
    / "config"
    / "security"
    / "issue-41-ref-retirement-execution.json"
)


class RetirementError(RuntimeError):
    pass


class GitHubApi:
    def __init__(self, repository: str, token: str) -> None:
        self.repository = repository
        self.token = token

    def request(
        self,
        method: str,
        path: str,
        *,
        expect_json: bool = True,
    ) -> object | None:
        url = f"https://api.github.com/repos/{self.repository}/{path.lstrip('/')}"
        req = urllib.request.Request(
            url,
            method=method,
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {self.token}",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "vsn-metafields-issue-41-ref-retirement",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                body = response.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RetirementError(
                f"GitHub API {method} {path} failed with HTTP {exc.code}: {detail[:500]}"
            ) from exc
        except urllib.error.URLError as exc:
            raise RetirementError(
                f"GitHub API {method} {path} failed: {exc.reason}"
            ) from exc

        if not expect_json or not body:
            return None
        return json.loads(body.decode("utf-8"))

    def branch_heads(self) -> dict[str, str]:
        data = self.request("GET", "git/matching-refs/heads/")
        if not isinstance(data, list):
            raise RetirementError("unexpected branch ref response")
        result: dict[str, str] = {}
        for row in data:
            if not isinstance(row, dict):
                continue
            ref = row.get("ref")
            obj = row.get("object")
            if (
                isinstance(ref, str)
                and ref.startswith("refs/heads/")
                and isinstance(obj, dict)
                and isinstance(obj.get("sha"), str)
            ):
                result[ref.removeprefix("refs/heads/")] = str(obj["sha"])
        return result

    def open_pull_requests(self) -> list[dict[str, object]]:
        data = self.request("GET", "pulls?state=open&per_page=100")
        if not isinstance(data, list):
            raise RetirementError("unexpected pull request response")
        return [row for row in data if isinstance(row, dict)]

    def merged_pr_head_for_branch(self, branch: str) -> str:
        owner = self.repository.split("/", 1)[0]
        head = urllib.parse.quote(f"{owner}:{branch}", safe=":")
        data = self.request(
            "GET",
            f"pulls?state=closed&head={head}&per_page=20",
        )
        if not isinstance(data, list):
            raise RetirementError("unexpected merged pull request response")
        merged = [
            row
            for row in data
            if isinstance(row, dict)
            and row.get("merged_at")
            and isinstance(row.get("head"), dict)
            and isinstance(row["head"].get("sha"), str)
        ]
        if not merged:
            raise RetirementError(
                f"executor branch {branch!r} has no merged pull request evidence"
            )
        return str(merged[0]["head"]["sha"])

    def delete_branch(self, branch: str) -> None:
        encoded = urllib.parse.quote(branch, safe="/")
        self.request(
            "DELETE",
            f"git/refs/heads/{encoded}",
            expect_json=False,
        )


def load_manifest(path: Path) -> dict[str, object]:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise RetirementError("execution manifest must be a JSON object")
    if manifest.get("schema_version") != 1:
        raise RetirementError("unsupported execution manifest schema_version")
    if manifest.get("repository") != EXPECTED_REPOSITORY:
        raise RetirementError("execution manifest repository mismatch")
    if manifest.get("issue") != EXPECTED_ISSUE:
        raise RetirementError("execution manifest issue mismatch")

    main_sha = manifest.get("frozen_main_sha")
    tree_sha = manifest.get("frozen_main_tree_sha")
    if not isinstance(main_sha, str) or len(main_sha) != 40:
        raise RetirementError("frozen_main_sha must be a 40-character SHA")
    if not isinstance(tree_sha, str) or len(tree_sha) != 40:
        raise RetirementError("frozen_main_tree_sha must be a 40-character SHA")

    expected = manifest.get("expected_non_main_heads")
    if not isinstance(expected, dict) or not expected:
        raise RetirementError("expected_non_main_heads must be a non-empty object")
    if "main" in expected:
        raise RetirementError("main must never appear in expected_non_main_heads")
    if not all(
        isinstance(name, str)
        and name
        and isinstance(sha, str)
        and len(sha) == 40
        for name, sha in expected.items()
    ):
        raise RetirementError("execution manifest contains invalid branch SHA entries")

    executor = manifest.get("executor_branch")
    if not isinstance(executor, str) or not executor or executor == "main":
        raise RetirementError("executor_branch is invalid")
    if executor in expected:
        raise RetirementError(
            "executor_branch must not be self-pinned in expected_non_main_heads"
        )
    return manifest


def validate_live_state(
    manifest: dict[str, object],
    live_heads: dict[str, str],
    executor_pr_head_sha: str,
) -> list[str]:
    expected = manifest["expected_non_main_heads"]
    assert isinstance(expected, dict)
    executor = str(manifest["executor_branch"])

    if "main" not in live_heads:
        raise RetirementError("main branch is missing")
    if live_heads["main"] != manifest["frozen_main_sha"]:
        raise RetirementError(
            "main moved after freeze; stop retirement before any deletion "
            f"(live={live_heads['main']}, frozen={manifest['frozen_main_sha']})"
        )

    expected_names = set(expected) | {executor, "main"}
    actual_names = set(live_heads)
    if actual_names != expected_names:
        raise RetirementError(
            "live branch set drifted from frozen retirement manifest; "
            f"unexpected={sorted(actual_names - expected_names)}, "
            f"missing={sorted(expected_names - actual_names)}"
        )

    mismatches = {
        branch: {"expected": str(expected[branch]), "live": live_heads.get(branch)}
        for branch in expected
        if live_heads.get(branch) != expected[branch]
    }
    if mismatches:
        raise RetirementError(
            "one or more frozen branch SHAs changed: "
            + json.dumps(mismatches, sort_keys=True)
        )

    if live_heads[executor] != executor_pr_head_sha:
        raise RetirementError(
            "executor branch head does not equal merged PR head "
            f"(live={live_heads[executor]}, merged_pr_head={executor_pr_head_sha})"
        )

    # Delete deterministic frozen refs first and the executor branch last.
    return sorted(expected) + [executor]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--repository", default=os.environ.get("GITHUB_REPOSITORY", ""))
    parser.add_argument("--token", default=os.environ.get("GH_TOKEN", ""))
    parser.add_argument("--actor", default=os.environ.get("GITHUB_ACTOR", ""))
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--confirm", default="")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = load_manifest(Path(args.manifest).expanduser().resolve())

    if args.repository != EXPECTED_REPOSITORY:
        raise RetirementError(
            f"repository mismatch: expected {EXPECTED_REPOSITORY}, got {args.repository!r}"
        )
    if args.actor != manifest.get("allowed_actor"):
        raise RetirementError(
            f"actor {args.actor!r} is not authorized by the execution manifest"
        )
    if not args.token:
        raise RetirementError("GH_TOKEN is required")

    api = GitHubApi(args.repository, args.token)
    open_prs = api.open_pull_requests()
    if open_prs:
        numbers = sorted(
            int(row["number"])
            for row in open_prs
            if isinstance(row.get("number"), int)
        )
        raise RetirementError(f"open pull requests block retirement: {numbers}")

    live_before = api.branch_heads()
    executor = str(manifest["executor_branch"])
    executor_pr_head = api.merged_pr_head_for_branch(executor)
    retirement_order = validate_live_state(
        manifest,
        live_before,
        executor_pr_head,
    )

    print(f"repository={args.repository}")
    print(f"frozen_main_sha={manifest['frozen_main_sha']}")
    print(f"retire_ref_count={len(retirement_order)}")
    print("main_action=preserve")
    print("ruleset_action=none")

    if not args.execute:
        print("remote_mutation_performed=false")
        print("retirement_status=validated_dry_run")
        return 0

    if args.confirm != manifest.get("execute_confirmation"):
        raise RetirementError("exact execution confirmation phrase is required")

    for branch in retirement_order:
        if branch == "main":
            raise RetirementError("internal safety error: main entered retirement order")
        current = api.branch_heads().get(branch)
        expected_sha = (
            executor_pr_head
            if branch == executor
            else str(manifest["expected_non_main_heads"][branch])
        )
        if current != expected_sha:
            raise RetirementError(
                f"branch {branch!r} moved immediately before deletion; "
                f"live={current}, expected={expected_sha}"
            )
        api.delete_branch(branch)
        print(f"retired={branch}@{expected_sha}")

    live_after = api.branch_heads()
    if set(live_after) != {"main"}:
        raise RetirementError(
            "post-retirement branch set is not main-only: "
            + json.dumps(live_after, sort_keys=True)
        )
    if live_after["main"] != manifest["frozen_main_sha"]:
        raise RetirementError("main changed during non-main ref retirement")

    print("remaining_heads=main")
    print("remote_mutation_performed=true")
    print("retirement_status=complete")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RetirementError, OSError, json.JSONDecodeError) as exc:
        print(f"error={exc}", file=sys.stderr)
        raise SystemExit(1)
