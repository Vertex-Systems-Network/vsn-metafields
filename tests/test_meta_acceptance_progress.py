"""Regression tests for evidence-driven META task progress percentages."""
import copy
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/check_meta_acceptance_progress.py"
spec = importlib.util.spec_from_file_location("meta_progress", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AcceptanceProgressTests(unittest.TestCase):
    def setUp(self):
        self.progress = module.read_json(module.PROGRESS)
        self.plan = module.read_json(module.PLAN)

    def test_validated_progress_and_readme_match(self):
        module.validate(self.progress, self.plan)
        readme = module.README.read_text(encoding="utf-8")
        self.assertIn(module.render(self.progress), readme)
        self.assertEqual(len(self.progress["units"]), 6)
        self.assertEqual(self.progress["overall_verified_complete"], 6)

    def test_percentages_derive_from_checklists_not_estimates(self):
        expected = {
            "META-007": 44, "META-009": 33, "META-006": 33,
            "META-010": 33, "META-011": 38, "META-012": 0,
        }
        actual = {
            unit["id"]: module.percent(module.verified_count(unit), len(unit["checks"]))
            for unit in self.progress["units"]
        }
        self.assertEqual(actual, expected)
        self.assertEqual(module.percent(6, 12), 50)

    def test_fake_verified_check_without_evidence_rejected(self):
        invalid = copy.deepcopy(self.progress)
        unit = invalid["units"][0]
        pending = next(c for c in unit["checks"] if not c["verified"])
        pending["verified"] = True
        pending["evidence"] = ["docs/evidence/non-existent-staging-acceptance.json"]
        with self.assertRaisesRegex(ValueError, "lacks repo evidence"):
            module.validate(invalid, self.plan)

    def test_completed_removed_and_pending_units_match_plan(self):
        invalid = copy.deepcopy(self.progress)
        invalid["units"].pop()
        with self.assertRaisesRegex(ValueError, "Every pending unit"):
            module.validate(invalid, self.plan)

    def test_not_started_work_never_reports_progress(self):
        invalid = copy.deepcopy(self.progress)
        unit = invalid["units"][-1]
        unit["checks"][0]["verified"] = True
        unit["checks"][0]["evidence"] = ["docs/evidence/metafields-metaobject-lifecycle-2026-10-17.json"]
        with self.assertRaisesRegex(ValueError, "not_started"):
            module.validate(invalid, self.plan)

    def test_pending_evidence_claim_rejected(self):
        invalid = copy.deepcopy(self.progress)
        unit = invalid["units"][0]
        pending = next(c for c in unit["checks"] if not c["verified"])
        pending["evidence"] = ["docs/evidence/metafields-meta007-staging-readback-2026-10-17.json"]
        with self.assertRaisesRegex(ValueError, "pending check must not claim"):
            module.validate(invalid, self.plan)


if __name__ == "__main__":
    unittest.main()
