from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "security" / "execute_issue_41_ref_retirement.py"


def load_module():
    spec = importlib.util.spec_from_file_location("issue41_retire", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Issue41RefRetirementExecutorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = load_module()
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)
        self.manifest_path = self.base / "manifest.json"
        self.manifest = {
            "schema_version": 1,
            "repository": "Vertex-Systems-Network/vsn-metafields",
            "issue": 41,
            "allowed_actor": "wpessential",
            "execute_confirmation": "RETIRE_ISSUE_41_OBSOLETE_REFS",
            "pre_executor_main_sha": "1" * 40,
            "pre_executor_main_tree_sha": "2" * 40,
            "executor_branch": "phase-00/ref-retirement-executor",
            "expected_non_main_heads": {
                "merged": "3" * 40,
                "candidate": "4" * 40,
            },
        }
        self.manifest_path.write_text(
            json.dumps(self.manifest, indent=2) + "\n",
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_manifest_rejects_main_in_retirement_set(self) -> None:
        payload = dict(self.manifest)
        payload["expected_non_main_heads"] = {
            **self.manifest["expected_non_main_heads"],
            "main": "5" * 40,
        }
        self.manifest_path.write_text(
            json.dumps(payload, indent=2) + "\n",
            encoding="utf-8",
        )
        with self.assertRaisesRegex(self.module.RetirementError, "main must never"):
            self.module.load_manifest(self.manifest_path)

    def test_exact_live_state_returns_executor_last(self) -> None:
        manifest = self.module.load_manifest(self.manifest_path)
        expected_main = "a" * 40
        executor_sha = "b" * 40
        live = {
            "main": expected_main,
            "merged": "3" * 40,
            "candidate": "4" * 40,
            "phase-00/ref-retirement-executor": executor_sha,
        }
        order = self.module.validate_live_state(
            manifest,
            live,
            executor_sha,
            expected_main,
        )
        self.assertEqual(
            order,
            ["candidate", "merged", "phase-00/ref-retirement-executor"],
        )
        self.assertNotIn("main", order)

    def test_main_movement_blocks_before_deletion(self) -> None:
        manifest = self.module.load_manifest(self.manifest_path)
        live = {
            "main": "c" * 40,
            "merged": "3" * 40,
            "candidate": "4" * 40,
            "phase-00/ref-retirement-executor": "b" * 40,
        }
        with self.assertRaisesRegex(
            self.module.RetirementError,
            "main moved after execution freeze",
        ):
            self.module.validate_live_state(
                manifest,
                live,
                "b" * 40,
                "a" * 40,
            )

    def test_unexpected_branch_blocks_transaction(self) -> None:
        manifest = self.module.load_manifest(self.manifest_path)
        live = {
            "main": "a" * 40,
            "merged": "3" * 40,
            "candidate": "4" * 40,
            "phase-00/ref-retirement-executor": "b" * 40,
            "unreviewed": "d" * 40,
        }
        with self.assertRaisesRegex(self.module.RetirementError, "branch set drifted"):
            self.module.validate_live_state(
                manifest,
                live,
                "b" * 40,
                "a" * 40,
            )

    def test_frozen_branch_sha_movement_blocks_transaction(self) -> None:
        manifest = self.module.load_manifest(self.manifest_path)
        live = {
            "main": "a" * 40,
            "merged": "e" * 40,
            "candidate": "4" * 40,
            "phase-00/ref-retirement-executor": "b" * 40,
        }
        with self.assertRaisesRegex(self.module.RetirementError, "frozen branch SHAs changed"):
            self.module.validate_live_state(
                manifest,
                live,
                "b" * 40,
                "a" * 40,
            )

    def test_executor_branch_must_equal_merged_pr_head(self) -> None:
        manifest = self.module.load_manifest(self.manifest_path)
        live = {
            "main": "a" * 40,
            "merged": "3" * 40,
            "candidate": "4" * 40,
            "phase-00/ref-retirement-executor": "b" * 40,
        }
        with self.assertRaisesRegex(self.module.RetirementError, "merged PR head"):
            self.module.validate_live_state(
                manifest,
                live,
                "f" * 40,
                "a" * 40,
            )


if __name__ == "__main__":
    unittest.main()
