import importlib.util
import pathlib
import unittest


MODULE_PATH = pathlib.Path(__file__).parents[1] / "scripts" / "calc_furusato.py"
SPEC = importlib.util.spec_from_file_location("calc_furusato", MODULE_PATH)
assert SPEC and SPEC.loader
calc = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(calc)


class SalaryIncomeTests(unittest.TestCase):
    def test_one_million_salary_changes_by_tax_year(self) -> None:
        self.assertEqual(calc.salary_income_after_deduction(1_000_000, 2024), 450_000)
        self.assertEqual(calc.salary_income_after_deduction(1_000_000, 2025), 350_000)
        self.assertEqual(calc.salary_income_after_deduction(1_000_000, 2026), 260_000)

    def test_2026_special_low_income_bands(self) -> None:
        self.assertEqual(calc.salary_income_after_deduction(740_999, 2026), 0)
        self.assertEqual(calc.salary_income_after_deduction(741_000, 2026), 1_000)
        self.assertEqual(calc.salary_income_after_deduction(2_191_000, 2026), 1_451_000)
        self.assertEqual(calc.salary_income_after_deduction(2_193_000, 2026), 1_453_000)
        self.assertEqual(calc.salary_income_after_deduction(2_196_000, 2026), 1_456_000)


class BasicDeductionTests(unittest.TestCase):
    def test_2025_income_tax_basic_deduction_bands(self) -> None:
        expected = {
            1_000_000: 950_000,
            2_000_000: 880_000,
            4_000_000: 680_000,
            5_000_000: 630_000,
            10_000_000: 580_000,
        }
        for income, deduction in expected.items():
            with self.subTest(income=income):
                self.assertEqual(
                    calc.basic_deduction_income_tax(income, 2025), deduction
                )

    def test_2026_income_tax_basic_deduction_bands(self) -> None:
        expected = {
            4_000_000: 1_040_000,
            5_000_000: 670_000,
            10_000_000: 620_000,
        }
        for income, deduction in expected.items():
            with self.subTest(income=income):
                self.assertEqual(
                    calc.basic_deduction_income_tax(income, 2026), deduction
                )


class SafetyTests(unittest.TestCase):
    def test_unsupported_tax_year_fails_closed(self) -> None:
        with self.assertRaises(ValueError):
            calc.validate_tax_year(2027)

    def test_separately_taxed_capital_gain_is_not_silently_aggregated(self) -> None:
        with self.assertRaises(ValueError):
            calc.calc_taxable_income_bases(
                {"salary_income": 5_000_000, "capital_gains": 100_000},
                2026,
            )

    def test_expense_rate_outside_zero_to_one_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            calc.calc_taxable_income_bases(
                {"side_income": 100_000, "expense_rate": 1.2},
                2026,
            )

    def test_income_tax_uses_thousand_yen_tax_base(self) -> None:
        self.assertEqual(calc.income_tax(1_234_999), calc.income_tax(1_234_000))


if __name__ == "__main__":
    unittest.main()
