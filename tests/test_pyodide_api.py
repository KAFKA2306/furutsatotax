import importlib.util
import json
import pathlib
import sys
import unittest


ROOT = pathlib.Path(__file__).parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))
SPEC = importlib.util.spec_from_file_location("pyodide_api", SCRIPTS / "pyodide_api.py")
assert SPEC and SPEC.loader
api = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(api)


class PyodideApiTests(unittest.TestCase):
    def test_notice_mode_matches_canonical_fixture(self) -> None:
        result = api.calculate(
            {
                "mode": "notice",
                "tax_year": 2025,
                "resident_income_levy_before_tax_credits": 400_000,
                "resident_adjustment_deduction": 2_500,
                "resident_taxable_general_income": 6_600_000,
                "human_deduction_difference": 50_000,
                "basic_deduction_income": 580_000,
            }
        )
        self.assertEqual(result["mode"], "notice")
        self.assertEqual(result["adjusted_resident_income_levy"], 397_500)
        self.assertEqual(result["special_credit_rate_basis"], 6_450_000)
        self.assertEqual(result["special_credit_rate"], 0.6958)
        self.assertEqual(result["safe_limit_1000_yen"], 116_000)

    def test_json_bridge_is_deterministic_and_json_safe(self) -> None:
        payload = {
            "mode": "notice",
            "tax_year": 2025,
            "resident_income_levy_before_tax_credits": 400_000,
            "resident_adjustment_deduction": 2_500,
            "resident_taxable_general_income": 6_600_000,
            "human_deduction_difference": 50_000,
            "basic_deduction_income": 580_000,
        }
        first = api.calculate_json(json.dumps(payload))
        second = api.calculate_json(json.dumps(payload))
        self.assertEqual(first, second)
        self.assertEqual(json.loads(first)["safe_limit_1000_yen"], 116_000)

    def test_unsupported_year_fails_closed(self) -> None:
        with self.assertRaises(ValueError):
            api.calculate({"mode": "estimate", "tax_year": 2027})

    def test_unknown_mode_fails_closed(self) -> None:
        with self.assertRaises(ValueError):
            api.calculate({"mode": "magic", "tax_year": 2025})


if __name__ == "__main__":
    unittest.main()
