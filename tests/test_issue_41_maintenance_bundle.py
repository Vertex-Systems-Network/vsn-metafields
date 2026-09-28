from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts" / "security" / "build_issue_41_maintenance_bundle.py"
EXPECTED_REPOSITORY = "Vertex-Systems-Network/vsn-metafields"


def run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [*args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


class Issue41MaintenanceBundleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)
        self.policy = self.base / "policy.json"
        self.snapshot = self.base / "freeze.json"
        self.output = self.base / "bundle"

        policy = {
            "schema_version": 1,
            "repository": EXPECTED_REPOSITORY,
            "issue": 41,
            "allowed_tags": [],
            "preferred_post_retirement_heads": ["main"],
            "refs": [
                {
                    "branch": "main",
                    "disposition": "preserve",
                    "evidence": "default protected branch",
                },
                {
                    "branch": "merged",
                    "disposition": "retire",
                    "evidence": "merged work",
                },
                {
                    "branch": "candidate",
                    "disposition": "confirm_retire",
                    "evidence": "requires explicit confirmation",
                },
                {
                    "branch": "maintenance",
                    "disposition": "retire_after_merge",
                    "evidence": "temporary maintenance branch",
                },
            ],
        }
        self.policy.write_text(json.dumps(policy, indent=2) + "\n", encoding="utf-8")

        self.main_sha = "1" * 40
        self.main_tree_sha = "a" * 40
        snapshot = {
            "schema_version": 1,
            "repository": EXPECTED_REPOSITORY,
            "issue": 41,
            "main_sha": self.main_sha,
            "main_tree_sha": self.main_tree_sha,
            "heads": {
                "main": self.main_sha,
                "merged": "2" * 40,
                "candidate": "3" * 40,
                "maintenance": "4" * 40,
            },
            "tags": {},
            "policy_schema_version": 1,
        }
        self.snapshot.write_text(
            json.dumps(snapshot, indent=2) + "\n",
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def builder(self, *extra: str) -> subprocess.CompletedProcess[str]:
        return run(
            sys.executable,
            str(BUILDER),
            "--snapshot",
            str(self.snapshot),
            "--policy",
            str(self.policy),
            "--output-dir",
            str(self.output),
            *extra,
        )

    def test_missing_category_c_confirmation_blocks_bundle(self) -> None:
        proc = self.builder()
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("candidate", proc.stderr)
        self.assertFalse((self.output / "maintenance-bundle.json").exists())

    def test_bundle_is_sha_bound_and_non_executable(self) -> None:
        proc = self.builder("--confirm-retire", "candidate")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("remote_mutation_performed=false", proc.stdout)

        bundle_path = self.output / "maintenance-bundle.json"
        transaction_path = self.output / "ref-retirement-transaction.txt"
        rollback_path = self.output / "rollback-ref-map.txt"
        digest_path = self.output / "maintenance-bundle.sha256"

        for path in (bundle_path, transaction_path, rollback_path, digest_path):
            self.assertTrue(path.is_file(), path)

        bundle = json.loads(bundle_path.read_text(encoding="utf-8"))
        self.assertFalse(bundle["remote_mutation_performed"])
        self.assertEqual(bundle["main_before_sha"], self.main_sha)
        self.assertEqual(bundle["main_before_tree_sha"], self.main_tree_sha)
        self.assertEqual(bundle["confirmed_retire_branches"], ["candidate"])
        self.assertEqual(
            {row["branch"] for row in bundle["preserve_refs"]},
            {"main"},
        )
        self.assertEqual(
            {row["branch"] for row in bundle["retire_refs"]},
            {"merged", "candidate", "maintenance"},
        )

        transaction = transaction_path.read_text(encoding="utf-8")
        self.assertIn("RETIRE refs/heads/candidate EXPECTED_SHA " + "3" * 40, transaction)
        self.assertIn("PRESERVE refs/heads/main EXPECTED_SHA " + self.main_sha, transaction)
        self.assertIn("main_before_tree_sha=" + self.main_tree_sha, transaction)
        self.assertIn("intentionally non-executable", transaction)

        rollback = rollback_path.read_text(encoding="utf-8")
        self.assertIn("refs/heads/main " + self.main_sha, rollback)
        self.assertIn("refs/heads/candidate " + "3" * 40, rollback)

        expected_digest = hashlib.sha256(bundle_path.read_bytes()).hexdigest()
        self.assertEqual(
            digest_path.read_text(encoding="utf-8").split()[0],
            expected_digest,
        )

    def test_snapshot_branch_drift_is_rejected(self) -> None:
        payload = json.loads(self.snapshot.read_text(encoding="utf-8"))
        payload["heads"]["unexpected"] = "5" * 40
        self.snapshot.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

        proc = self.builder("--confirm-retire", "candidate")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("branch set does not match", proc.stderr)
        self.assertIn("unexpected", proc.stderr)

    def test_snapshot_main_sha_mismatch_is_rejected(self) -> None:
        payload = json.loads(self.snapshot.read_text(encoding="utf-8"))
        payload["main_sha"] = "9" * 40
        self.snapshot.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

        proc = self.builder("--confirm-retire", "candidate")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("main_sha", proc.stderr)

    def test_missing_main_tree_sha_is_rejected(self) -> None:
        payload = json.loads(self.snapshot.read_text(encoding="utf-8"))
        payload.pop("main_tree_sha")
        self.snapshot.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

        proc = self.builder("--confirm-retire", "candidate")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("main_tree_sha", proc.stderr)

    def test_unknown_confirmation_is_rejected(self) -> None:
        proc = self.builder(
            "--confirm-retire",
            "candidate",
            "--confirm-retire",
            "merged",
        )
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("non-confirm_retire", proc.stderr)

    def test_invalid_ruleset_id_is_rejected(self) -> None:
        proc = self.builder(
            "--confirm-retire",
            "candidate",
            "--ruleset-id",
            "0",
        )
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("ruleset-id", proc.stderr)


if __name__ == "__main__":
    unittest.main()
