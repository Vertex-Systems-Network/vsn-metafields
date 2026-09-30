import unittest

from scripts.validate_development_route import validate_route


class DevelopmentRouteTests(unittest.TestCase):
    def test_feature_to_development(self):
        validate_route("development", "feature/metafield-definitions")

    def test_release_to_main(self):
        validate_route("main", "development")

    def test_feature_cannot_skip_development(self):
        with self.assertRaisesRegex(ValueError, "Only development"):
            validate_route("main", "feature/metafield-definitions")

    def test_fork_named_development_cannot_release_to_main(self):
        with self.assertRaisesRegex(ValueError, "Only development"):
            validate_route("main", "development", "other/repo", "Vertex-Systems-Network/vsn-metafields")

    def test_main_cannot_be_feature_source(self):
        with self.assertRaisesRegex(ValueError, "separate source branch"):
            validate_route("development", "main")

    def test_unknown_base_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "Unsupported"):
            validate_route("staging", "feature/metafield-definitions")


if __name__ == "__main__":
    unittest.main()
