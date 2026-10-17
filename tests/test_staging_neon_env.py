"""Regression tests for line-safe Cloudflare staging Neon URL environment."""
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

HELPER = Path(__file__).resolve().parents[1] / "scripts/cloudflare/pin-staging-neon-ssl.py"
spec = importlib.util.spec_from_file_location("pin_staging_neon_ssl", HELPER)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

STAGING = (
    "postgresql://qa:unused@"
    "ep-snowy-surf-b3gxl2wf-pooler.c-4.ap-southeast-1.aws.neon.tech"
    "/neondb?sslmode=require&application_name=meta007"
)
DIRECT = (
    "postgresql://qa:unused@"
    "ep-snowy-surf-b3gxl2wf.c-4.ap-southeast-1.aws.neon.tech"
    "/neondb?sslmode=prefer"
)


class TestStagingGitHubEnv(unittest.TestCase):
    def test_two_real_newlines_and_both_neon_urls_are_distinct(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / "github-env"
            helper.append_staging_env({
                "GITHUB_ENV": str(env_file),
                "DATABASE_URL": STAGING,
                "DIRECT_URL": DIRECT,
            })
            raw = env_file.read_text(encoding="utf-8")
            self.assertTrue(raw.endswith("\n"))
            self.assertEqual(raw.count("\n"), 2)
            self.assertNotIn("\\nDIRECT_URL=", raw)
            lines = raw.splitlines()
            self.assertEqual(len(lines), 2)
            self.assertTrue(lines[0].startswith("DATABASE_URL="))
            self.assertTrue(lines[1].startswith("DIRECT_URL="))
            self.assertNotIn("DIRECT_URL=", lines[0])
            parsed = dict(line.split("=", 1) for line in lines)
            self.assertIn("-pooler.", urlsplit(parsed["DATABASE_URL"]).hostname)
            self.assertNotIn("-pooler.", urlsplit(parsed["DIRECT_URL"]).hostname)
            for url in parsed.values():
                params = dict(parse_qsl(urlsplit(url).query))
                self.assertEqual(params["sslmode"], "verify-full")
            self.assertEqual(
                dict(parse_qsl(urlsplit(parsed["DATABASE_URL"]).query))[
                    "application_name"
                ], "meta007"
            )

    def test_repeated_pin_never_duplicates_sslmode(self):
        once = helper.pin_staging_ssl(STAGING)
        self.assertEqual(helper.pin_staging_ssl(once), once)
        self.assertEqual(
            [key for key, _ in parse_qsl(urlsplit(once).query)].count("sslmode"),
            1,
        )

    def test_bad_direct_url_fails_before_any_file_write(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / "github-env"
            env_file.write_text("PRESERVE=1\n", encoding="utf-8")
            with self.assertRaises(ValueError):
                helper.append_staging_env({
                    "GITHUB_ENV": str(env_file),
                    "DATABASE_URL": STAGING,
                    "DIRECT_URL": "postgresql://local:pass@localhost:5432/dev",
                })
            self.assertEqual(env_file.read_text(encoding="utf-8"), "PRESERVE=1\n")

    def test_newline_injection_and_missing_target_are_rejected(self):
        for value in (
            STAGING + "\nPRODUCTION=1",
            STAGING + "\rFOO=1",
            "",
            "file:///tmp/secret.db",
        ):
            with self.subTest(value=value[:20]):
                with self.assertRaises(ValueError):
                    helper.pin_staging_ssl(value)
        with self.assertRaises(ValueError):
            helper.append_staging_env({
                "DATABASE_URL": STAGING,
                "DIRECT_URL": DIRECT,
            })


    def test_staging_source_dispatch_sha_must_match_checked_out_development(self):
        source_helper = Path(__file__).resolve().parents[1] / (
            "scripts/cloudflare/verify-staging-source-sha.py"
        )
        spec = importlib.util.spec_from_file_location("verify_staging_sha", source_helper)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        sha = "a" * 40
        self.assertEqual(module.verify_source_sha(sha, sha, "refs/heads/development"), sha)
        with self.assertRaisesRegex(ValueError, "Development HEAD changed"):
            module.verify_source_sha("b" * 40, sha, "refs/heads/development")
        with self.assertRaisesRegex(ValueError, "development branch"):
            module.verify_source_sha(sha, sha, "refs/heads/main")
        for malformed in ("", "x" * 40, "a" * 39, sha + "\\nEXTRA=1"):
            with self.subTest(malformed=malformed[:10]):
                with self.assertRaisesRegex(ValueError, "Invalid"):
                    module.verify_source_sha(sha, malformed, "refs/heads/development")

    def test_staging_deploy_guard_runs_before_credentials_or_mutations(self):
        workflow = (
            Path(__file__).resolve().parents[1]
            / ".github/workflows/cloudflare-staging-deploy.yml"
        ).read_text(encoding="utf-8")
        guard = "python scripts/cloudflare/verify-staging-source-sha.py"
        self.assertEqual(workflow.count(guard), 1)
        self.assertLess(workflow.index(guard), workflow.index("Pin staging database SSL mode"))
        self.assertLess(workflow.index(guard), workflow.index("Apply staging database migrations"))
        self.assertLess(workflow.index(guard), workflow.index("Deploy isolated Cloudflare staging Worker"))
        self.assertIn("workflow_dispatch:", workflow)
        self.assertNotIn("  push:", workflow)


if __name__ == "__main__":
    unittest.main()
