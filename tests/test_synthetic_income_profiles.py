import json
import unittest
from pathlib import Path


CATALOG_PATH = Path(__file__).resolve().parents[1] / "web" / "data" / "synthetic-income-profiles.json"
EXPECTED_POPULATION = 51_365_699
EXPECTED_BUCKETS = 14


class SyntheticIncomeProfilesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))

    def test_catalog_is_explicitly_synthetic(self):
        self.assertIs(self.catalog["synthetic"], True)
        self.assertIn("特定個人に由来しない", self.catalog["privacy_note"])
        self.assertTrue(all(bucket["synthetic"] is True for bucket in self.catalog["income_buckets"]))
        self.assertTrue(all(variant["synthetic"] is True for variant in self.catalog["variants"]))

    def test_source_is_nta_2024_table_3(self):
        source = self.catalog["source"]
        self.assertEqual(source["survey_year"], 2024)
        self.assertEqual(source["population"], EXPECTED_POPULATION)
        self.assertEqual(source["scope"], "1年を通じて勤務した給与所得者・男女計")
        self.assertTrue(source["landing_url"].startswith("https://www.nta.go.jp/"))
        self.assertEqual(
            source["table_url"],
            "https://www.nta.go.jp/publication/statistics/kokuzeicho/minkan2024/pdf/R06_03.pdf",
        )

    def test_all_official_income_buckets_are_covered(self):
        buckets = self.catalog["income_buckets"]
        self.assertEqual(len(buckets), EXPECTED_BUCKETS)
        self.assertEqual(sum(bucket["population"] for bucket in buckets), EXPECTED_POPULATION)
        self.assertAlmostEqual(sum(bucket["share_pct"] for bucket in buckets), 100.0, places=3)
        self.assertEqual([bucket["id"] for bucket in buckets], [f"B{i:02d}" for i in range(1, 15)])

    def test_example_salary_stays_inside_bucket(self):
        for bucket in self.catalog["income_buckets"]:
            salary = bucket["example_salary_yen"]
            lower = bucket["lower_exclusive_yen"]
            upper = bucket["upper_inclusive_yen"]
            if lower is not None:
                self.assertGreater(salary, lower, bucket["id"])
            if upper is not None:
                self.assertLessEqual(salary, upper, bucket["id"])

    def test_variants_are_independent_of_population_frequency(self):
        variants = self.catalog["variants"]
        self.assertGreaterEqual(len(variants), 5)
        for variant in variants:
            self.assertNotIn("share_pct", variant)
            self.assertNotIn("population", variant)


if __name__ == "__main__":
    unittest.main()
