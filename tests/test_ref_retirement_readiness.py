from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GUARD = ROOT / "scripts" / "security" / "verify_ref_retirement_readiness.py"
EXPECTED_REPOSITORY = "Vertex-Systems-Network/vsn-metafields"
EXPECTED_REMOTE = f"https://github.com/{EXPECTED_REPOSITORY}.git"


def run(*args: str, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [*args],
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )


class RefRetirementReadinessTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)
        self.source = self.base / "source"
        self.mirror = self.base / "mirror.git"
        self.policy = self.base / "policy.json"
        self.snapshot = self.base / "private-evidence" / "freeze.json"

        self.assertEqual(run("git", "init", str(self.source)).returncode, 0)
        self.assertEqual(
            run("git", "config", "user.email", "ci@example.invalid", cwd=self.source).returncode,
            0,
        )
        self.assertEqual(
            run("git", "config", "user.name", "CI", cwd=self.source).returncode,
            0,
        )

        (self.source / "README.md").write_text("one\n", encoding="utf-8")
        self.assertEqual(run("git", "add", ".", cwd=self.source).returncode, 0)
        self.assertEqual(
            run("git", "commit", "-m", "base", cwd=self.source).returncode,
            0,
        )
        self.assertEqual(run("git", "branch", "-M", "main", cwd=self.source).returncode, 0)
        base_sha = run("git", "rev-parse", "HEAD", cwd=self.source).stdout.strip()

        for name in ("merged", "candidate", "guard"):
            self.assertEqual(
                run("git", "branch", name, base_sha, cwd=self.source).returncode,
                0,
            )

        (self.source / "README.md").write_text("two\n", encoding="utf-8")
        self.assertEqual(run("git", "add", "README.md", cwd=self.source).returncode, 0)
        self.assertEqual(
            run("git", "commit", "-m", "advance main", cwd=self.source).returncode,
            0,
        )

        clone = run("git", "clone", "--mirror", str(self.source), str(self.mirror))
        self.assertEqual(clone.returncode, 0, clone.stderr)
        self.assertEqual(
            run("git", "remote", "set-url", "origin", EXPECTED_REMOTE, cwd=self.mirror).returncode,
            0,
        )

        policy = {
            "schema_version": 1,
            "repository": EXPECTED_REPOSITORY,
            "issue": 41,
            "allowed_tags": [],
            "preferred_post_retirement_heads": ["main"],
            "refs": [
                {"branch": "main", "disposition": "preserve", "evidence": "default"},
                {"branch": "merged", "disposition": "retire", "evidence": "merged"},
                {
                    "branch": "candidate",
                    "disposition": "confirm_retire",
                    "evidence": "explicit confirmation",
                },
                {
                    "branch": "guard",
                    "disposition": "retire_after_merge",
                    "evidence": "temporary maintenance branch",
                },
            ],
        }
        self.policy.write_text(json.dumps(policy, indent=2) + "\n", encoding="utf-8")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def guard(self, *extra: str) -> subprocess.CompletedProcess[str]:
        return run(
            sys.executable,
            str(GUARD),
            "--repo-dir",
            str(self.mirror),
            "--policy",
            str(self.policy),
            *extra,
        )

    def test_require_ready_blocks_unconfirmed_candidate(self) -> None:
        proc = self.guard("--require-ready")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("candidate", proc.stderr)
        self.assertIn("remote_mutation_performed=false", proc.stdout)

    def test_confirmed_candidate_can_write_sha_bound_snapshot(self) -> None:
        proc = self.guard(
            "--confirm-retire",
            "candidate",
            "--require-ready",
            "--write-snapshot",
            str(self.snapshot),
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("retirement_readiness=ready_for_admin_maintenance", proc.stdout)
        self.assertTrue(self.snapshot.is_file())

        payload = json.loads(self.snapshot.read_text(encoding="utf-8"))
        self.assertEqual(payload["repository"], EXPECTED_REPOSITORY)
        self.assertEqual(set(payload["heads"]), {"main", "merged", "candidate", "guard"})
        self.assertEqual(payload["tags"], {})

    def test_freeze_snapshot_detects_ref_movement(self) -> None:
        first = self.guard(
            "--confirm-retire",
            "candidate",
            "--write-snapshot",
            str(self.snapshot),
        )
        self.assertEqual(first.returncode, 0, first.stderr)

        main_sha = run("git", "rev-parse", "refs/heads/main", cwd=self.mirror).stdout.strip()
        self.assertEqual(
            run("git", "update-ref", "refs/heads/merged", main_sha, cwd=self.mirror).returncode,
            0,
        )

        proc = self.guard(
            "--confirm-retire",
            "candidate",
            "--verify-snapshot",
            str(self.snapshot),
        )
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("freeze snapshot mismatch", proc.stderr)

    def test_unexpected_branch_blocks_readiness(self) -> None:
        main_sha = run("git", "rev-parse", "refs/heads/main", cwd=self.mirror).stdout.strip()
        self.assertEqual(
            run("git", "update-ref", "refs/heads/unreviewed", main_sha, cwd=self.mirror).returncode,
            0,
        )
        proc = self.guard("--confirm-retire", "candidate")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("live branch set drifted", proc.stderr)
        self.assertIn("unreviewed", proc.stderr)

    def test_unknown_confirmation_is_rejected(self) -> None:
        proc = self.guard("--confirm-retire", "merged")
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("non-confirm_retire", proc.stderr)

    def test_working_clone_is_rejected(self) -> None:
        proc = run(
            sys.executable,
            str(GUARD),
            "--repo-dir",
            str(self.source),
            "--policy",
            str(self.policy),
        )
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("bare/mirror clone", proc.stderr)


if __name__ == "__main__":
    unittest.main()
