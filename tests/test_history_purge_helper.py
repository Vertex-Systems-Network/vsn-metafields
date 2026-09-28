from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "scripts" / "security" / "prepare_git_history_purge.py"
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


class HistoryPurgeHelperTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)
        self.source = self.base / "source"
        self.mirror = self.base / "mirror.git"
        self.evidence = self.base / "evidence"

        init = run("git", "init", str(self.source))
        self.assertEqual(init.returncode, 0, init.stderr)
        self.assertEqual(
            run("git", "config", "user.email", "ci@example.invalid", cwd=self.source).returncode,
            0,
        )
        self.assertEqual(
            run("git", "config", "user.name", "CI", cwd=self.source).returncode,
            0,
        )

        embedded = self.source / "..git"
        embedded.mkdir()
        (embedded / "config").write_text(
            "[core]\n\trepositoryformatversion = 0\n",
            encoding="utf-8",
        )
        (self.source / "README.md").write_text("# fixture\n", encoding="utf-8")

        self.assertEqual(run("git", "add", ".", cwd=self.source).returncode, 0)
        commit = run("git", "commit", "-m", "fixture", cwd=self.source)
        self.assertEqual(commit.returncode, 0, commit.stderr)
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
        main = run("git", "rev-parse", "refs/heads/main", cwd=self.mirror)
        self.assertEqual(main.returncode, 0, main.stderr)
        self.main_sha = main.stdout.strip()

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def helper(self, *extra: str) -> subprocess.CompletedProcess[str]:
        return run(
            sys.executable,
            str(HELPER),
            "--repo-dir",
            str(self.mirror),
            "--evidence-dir",
            str(self.evidence),
            *extra,
        )

    def test_preflight_detects_reachable_embedded_git_metadata(self) -> None:
        proc = self.helper("--expected-main", self.main_sha)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("mode=preflight_only", proc.stdout)
        self.assertIn("remote_push_performed=false", proc.stdout)
        self.assertIn(f"repository={EXPECTED_REPOSITORY}", proc.stdout)

        evidence = json.loads(
            (self.evidence / "pre-rewrite.json").read_text(encoding="utf-8")
        )
        self.assertTrue(evidence["is_bare"])
        self.assertEqual(evidence["repository"], EXPECTED_REPOSITORY)
        self.assertEqual(evidence["main_sha"], self.main_sha)
        self.assertGreater(evidence["reachable_embedded_git_metadata_objects"], 0)
        self.assertGreaterEqual(evidence["head_ref_count"], 1)
        self.assertEqual(evidence["tag_ref_count"], 0)
        self.assertIn("..git/config", evidence["sample_embedded_git_metadata_paths"])

    def test_rewrite_requires_exact_confirmation_phrase(self) -> None:
        proc = self.helper("--rewrite", "--expected-main", self.main_sha)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("PURGE_DOT_DOT_GIT_HISTORY", proc.stderr)
        self.assertFalse((self.evidence / "post-rewrite.json").exists())

    def test_rewrite_requires_expected_main(self) -> None:
        proc = self.helper(
            "--rewrite",
            "--confirm",
            "PURGE_DOT_DOT_GIT_HISTORY",
        )
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("--expected-main", proc.stderr)
        self.assertFalse((self.evidence / "post-rewrite.json").exists())

    def test_stale_expected_main_is_rejected(self) -> None:
        proc = self.helper("--expected-main", "0" * 40)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("stale or unexpected mirror", proc.stderr)

    def test_wrong_repository_identity_is_rejected(self) -> None:
        self.assertEqual(
            run(
                "git",
                "remote",
                "set-url",
                "origin",
                "https://github.com/example/not-vsn-metafields.git",
                cwd=self.mirror,
            ).returncode,
            0,
        )
        proc = self.helper()
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("repository identity mismatch", proc.stderr)

    def test_verified_identity_can_be_carried_after_origin_removal(self) -> None:
        self.assertEqual(
            run("git", "remote", "remove", "origin", cwd=self.mirror).returncode,
            0,
        )

        import importlib.util

        spec = importlib.util.spec_from_file_location("history_purge_helper", HELPER)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        summary = module.repository_summary(
            self.mirror,
            verified_repository=EXPECTED_REPOSITORY,
        )
        self.assertEqual(summary["repository"], EXPECTED_REPOSITORY)
        self.assertEqual(summary["main_sha"], self.main_sha)

    def test_non_bare_working_clone_is_rejected(self) -> None:
        proc = run(
            sys.executable,
            str(HELPER),
            "--repo-dir",
            str(self.source),
            "--evidence-dir",
            str(self.base / "worktree-evidence"),
        )
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("bare/mirror clone", proc.stderr)


if __name__ == "__main__":
    unittest.main()
