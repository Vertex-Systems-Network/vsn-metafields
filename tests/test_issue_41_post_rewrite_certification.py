from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CERTIFIER = ROOT / "scripts" / "security" / "certify_issue_41_post_rewrite.py"
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


class Issue41PostRewriteCertificationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)
        self.source = self.base / "source"
        self.mirror = self.base / "fresh-rewritten.git"
        self.bundle = self.base / "maintenance-bundle.json"
        self.evidence = self.base / "post-evidence"

        self.assertEqual(run("git", "init", str(self.source)).returncode, 0)
        self.assertEqual(
            run("git", "config", "user.email", "ci@example.invalid", cwd=self.source).returncode,
            0,
        )
        self.assertEqual(
            run("git", "config", "user.name", "CI", cwd=self.source).returncode,
            0,
        )
        (self.source / "README.md").write_text("clean app tree\n", encoding="utf-8")
        self.assertEqual(run("git", "add", ".", cwd=self.source).returncode, 0)
        self.assertEqual(
            run("git", "commit", "-m", "clean rewritten history", cwd=self.source).returncode,
            0,
        )
        self.assertEqual(run("git", "branch", "-M", "main", cwd=self.source).returncode, 0)

        clone = run("git", "clone", "--mirror", str(self.source), str(self.mirror))
        self.assertEqual(clone.returncode, 0, clone.stderr)
        self.assertEqual(
            run(
                "git",
                "remote",
                "set-url",
                "origin",
                EXPECTED_REMOTE,
                cwd=self.mirror,
            ).returncode,
            0,
        )

        self.main_sha = run(
            "git",
            "rev-parse",
            "refs/heads/main",
            cwd=self.mirror,
        ).stdout.strip()
        self.main_tree_sha = run(
            "git",
            "rev-parse",
            "refs/heads/main^{tree}",
            cwd=self.mirror,
        ).stdout.strip()
        self.write_bundle(self.main_tree_sha)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def write_bundle(self, tree_sha: str) -> None:
        payload = {
            "schema_version": 1,
            "repository": EXPECTED_REPOSITORY,
            "issue": 41,
            "mode": "read_only_execution_evidence",
            "main_before_sha": "9" * 40,
            "main_before_tree_sha": tree_sha,
            "expected_post_rewrite_heads": ["main"],
            "expected_post_rewrite_tags": [],
        }
        self.bundle.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    def certifier(
        self,
        repo_dir: Path | None = None,
        *extra: str,
    ) -> subprocess.CompletedProcess[str]:
        return run(
            sys.executable,
            str(CERTIFIER),
            "--repo-dir",
            str(repo_dir or self.mirror),
            "--bundle",
            str(self.bundle),
            "--evidence-dir",
            str(self.evidence),
            *extra,
        )

    def test_clean_main_only_mirror_is_certified(self) -> None:
        proc = self.certifier()
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("history_rewrite_certification=pass", proc.stdout)
        self.assertIn("tree_preserved=true", proc.stdout)
        self.assertIn("reachable_embedded_git_metadata_paths=0", proc.stdout)
        self.assertIn("git_fsck=pass", proc.stdout)
        self.assertIn("remote_mutation_performed=false", proc.stdout)

        evidence = json.loads(
            (self.evidence / "post-rewrite-certification.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(evidence["main_after_sha"], self.main_sha)
        self.assertEqual(evidence["main_tree_sha"], self.main_tree_sha)
        self.assertTrue(evidence["tree_preserved"])
        self.assertEqual(evidence["head_refs"], {"main": self.main_sha})
        self.assertEqual(evidence["tag_refs"], {})

    def test_application_tree_mismatch_is_rejected(self) -> None:
        self.write_bundle("0" * 40)
        proc = self.certifier()
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("application tree changed", proc.stderr)

    def test_extra_head_is_rejected(self) -> None:
        self.assertEqual(
            run(
                "git",
                "update-ref",
                "refs/heads/stale",
                self.main_sha,
                cwd=self.mirror,
            ).returncode,
            0,
        )
        proc = self.certifier()
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("head set mismatch", proc.stderr)
        self.assertIn("stale", proc.stderr)

    def test_reachable_dot_dot_git_history_is_rejected(self) -> None:
        dirty_source = self.base / "dirty-source"
        dirty_mirror = self.base / "dirty-mirror.git"
        self.assertEqual(run("git", "init", str(dirty_source)).returncode, 0)
        self.assertEqual(
            run("git", "config", "user.email", "ci@example.invalid", cwd=dirty_source).returncode,
            0,
        )
        self.assertEqual(
            run("git", "config", "user.name", "CI", cwd=dirty_source).returncode,
            0,
        )

        embedded = dirty_source / "..git"
        embedded.mkdir()
        (embedded / "config").write_text("historical metadata\n", encoding="utf-8")
        (dirty_source / "README.md").write_text("app\n", encoding="utf-8")
        self.assertEqual(run("git", "add", ".", cwd=dirty_source).returncode, 0)
        self.assertEqual(
            run("git", "commit", "-m", "historical metadata", cwd=dirty_source).returncode,
            0,
        )
        self.assertEqual(run("git", "branch", "-M", "main", cwd=dirty_source).returncode, 0)

        self.assertEqual(run("git", "rm", "-r", "..git", cwd=dirty_source).returncode, 0)
        self.assertEqual(
            run("git", "commit", "-m", "remove current metadata", cwd=dirty_source).returncode,
            0,
        )

        clone = run("git", "clone", "--mirror", str(dirty_source), str(dirty_mirror))
        self.assertEqual(clone.returncode, 0, clone.stderr)
        self.assertEqual(
            run(
                "git",
                "remote",
                "set-url",
                "origin",
                EXPECTED_REMOTE,
                cwd=dirty_mirror,
            ).returncode,
            0,
        )

        dirty_tree = run(
            "git",
            "rev-parse",
            "refs/heads/main^{tree}",
            cwd=dirty_mirror,
        ).stdout.strip()
        self.write_bundle(dirty_tree)

        proc = self.certifier(dirty_mirror)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("reachable ..git metadata", proc.stderr)

    def test_working_clone_is_rejected(self) -> None:
        proc = self.certifier(self.source)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("fresh bare/mirror clone", proc.stderr)

    def test_wrong_repository_identity_is_rejected(self) -> None:
        self.assertEqual(
            run(
                "git",
                "remote",
                "set-url",
                "origin",
                "https://github.com/example/wrong.git",
                cwd=self.mirror,
            ).returncode,
            0,
        )
        proc = self.certifier()
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("repository identity mismatch", proc.stderr)


if __name__ == "__main__":
    unittest.main()
