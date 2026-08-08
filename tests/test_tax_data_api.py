import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_tax_data_api import build


class TaxDataApiTest(unittest.TestCase):
    def test_2026_distribution_contract(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            manifest = build(out)
            payload = json.loads((out / "parameters.json").read_text(encoding="utf-8"))
            self.assertEqual(payload["tax_year"], 2026)
            self.assertEqual(len(payload["salary_income_rules"]), 9)
            self.assertEqual(len(payload["income_tax_brackets"]), 7)
            self.assertEqual(payload["headline"]["salary_income_deduction_minimum_yen"], 740000)
            self.assertEqual(payload["headline"]["basic_deduction_maximum_yen"], 1040000)
            self.assertEqual(manifest["record_counts"]["salary_income_rules"], 9)
            self.assertEqual(manifest["record_counts"]["income_tax_brackets"], 7)
            for name, meta in manifest["files"].items():
                path = out / name
                self.assertEqual(path.stat().st_size, meta["bytes"])

    def test_ranges_do_not_overlap(self):
        source = json.loads(Path("data/official/nta-tax-parameters-2026.json").read_text(encoding="utf-8"))
        rows = source["salary_income_rules"]
        for previous, current in zip(rows, rows[1:]):
            self.assertIsNotNone(previous["max_salary_yen"])
            self.assertEqual(previous["max_salary_yen"] + 1, current["min_salary_yen"])


if __name__ == "__main__":
    unittest.main()
