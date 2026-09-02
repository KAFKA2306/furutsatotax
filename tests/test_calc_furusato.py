import importlib.util
import pathlib
import tempfile
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

    def test_2024_minimum_deduction_is_fixed_550k(self) -> None:
        self.assertEqual(calc.salary_income_after_deduction(1_600_000, 2024), 1_050_000)

    def test_2025_table_rounding_below_6_6m(self) -> None:
        self.assertEqual(calc.salary_income_after_deduction(3_599_999, 2025), 2_437_200)
        self.assertEqual(calc.salary_income_after_deduction(6_599_999, 2025), 4_836_800)

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
                self.assertEqual(calc.basic_deduction_income_tax(income, 2025), deduction)

    def test_2026_income_tax_basic_deduction_bands(self) -> None:
        expected = {
            4_000_000: 1_040_000,
            5_000_000: 670_000,
            10_000_000: 620_000,
        }
        for income, deduction in expected.items():
            with self.subTest(income=income):
                self.assertEqual(calc.basic_deduction_income_tax(income, 2026), deduction)


class IncomeTaxBoundaryTests(unittest.TestCase):
    def test_bracket_boundaries_use_greater_than_or_equal(self) -> None:
        self.assertEqual(calc.income_tax_marginal_rate(1_950_000), 0.10)
        self.assertEqual(calc.income_tax_marginal_rate(3_300_000), 0.20)
        self.assertEqual(calc.income_tax_marginal_rate(6_950_000), 0.23)
        self.assertEqual(calc.income_tax(1_950_000), 97_500)
        self.assertEqual(calc.income_tax(3_300_000), 232_500)


class ResidentTaxFurusatoTests(unittest.TestCase):
    def test_special_rate_uses_resident_rule_not_income_tax_marginal_rate(self) -> None:
        basis = calc.furusato_special_rate_basis(
            6_600_000,
            2025,
            human_deduction_difference=50_000,
            income_tax_basic_deduction=580_000,
        )
        self.assertEqual(basis, 6_450_000)
        self.assertEqual(calc.furusato_special_credit_rate(basis), 0.6958)

    def test_special_rate_boundary(self) -> None:
        self.assertEqual(calc.furusato_special_credit_rate(6_950_000), 0.6958)
        self.assertEqual(calc.furusato_special_credit_rate(6_950_001), 0.66517)

    def test_adjustment_deduction_for_high_taxable_income(self) -> None:
        self.assertEqual(calc.resident_adjustment_deduction(6_600_000, 50_000), 2_500)

    def test_notice_mode_uses_pre_credit_income_levy_minus_adjustment(self) -> None:
        result = calc.furusato_limit_from_notice(
            tax_year=2025,
            resident_income_levy_before_tax_credits=400_000,
            resident_adjustment_deduction_amount=2_500,
            taxable_resident_general_income=6_600_000,
            human_deduction_difference=50_000,
            income_tax_basic_deduction=580_000,
        )
        self.assertEqual(result["adjusted_resident_income_levy"], 397_500)
        self.assertEqual(result["special_credit_rate_basis"], 6_450_000)
        self.assertEqual(result["special_credit_rate"], 0.6958)
        self.assertEqual(result["theoretical_limit_yen"], 116_256)
        self.assertEqual(result["safe_limit_1000_yen"], 116_000)

    def test_total_income_30_percent_cap_is_enforced(self) -> None:
        result = calc.furusato_limit_from_notice(
            tax_year=2025,
            resident_income_levy_before_tax_credits=2_000_000,
            resident_adjustment_deduction_amount=0,
            taxable_resident_general_income=10_000_000,
            human_deduction_difference=50_000,
            income_tax_basic_deduction=580_000,
            total_income=500_000,
        )
        self.assertEqual(result["theoretical_limit_yen"], 150_000)


class SafetyTests(unittest.TestCase):
    def test_unsupported_tax_year_fails_closed(self) -> None:
        with self.assertRaises(ValueError):
            calc.validate_tax_year(2027)

    def test_separately_taxed_capital_gain_is_not_silently_aggregated(self) -> None:
        with self.assertRaises(ValueError):
            calc.calc_taxable_income_bases(
                {"salary_income": 5_000_000, "capital_gains": 100_000},
                2025,
            )

    def test_separately_taxed_income_forces_notice_mode(self) -> None:
        with self.assertRaises(ValueError):
            calc.calc_taxable_income_bases(
                {"salary_income": 5_000_000, "separately_taxed_income": 100_000},
                2025,
            )

    def test_business_loss_is_not_silently_clamped_to_zero(self) -> None:
        with self.assertRaises(ValueError):
            calc.calc_taxable_income_bases(
                {"business_revenue": 100_000, "business_expenses": 200_000},
                2025,
            )

    def test_expense_rate_outside_zero_to_one_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            calc.calc_taxable_income_bases(
                {"side_income": 100_000, "expense_rate": 1.2},
                2025,
            )

    def test_income_tax_uses_thousand_yen_tax_base(self) -> None:
        self.assertEqual(calc.income_tax(1_234_999), calc.income_tax(1_234_000))

    def test_employer_dc_without_actual_matching_contribution_fails(self) -> None:
        with self.assertRaisesRegex(ValueError, "dc_matching is required"):
            calc.calc_taxable_income_bases(
                {"salary_income": 5_000_000, "employer_dc_monthly": 10_000},
                2026,
            )

    def test_actual_dc_matching_contribution_is_used_as_given(self) -> None:
        self.assertEqual(
            calc._dc_matching_deduction(
                {"employer_dc_monthly": 10_000, "dc_matching": 120_000}
            ),
            120_000,
        )

    def test_notice_mode_requires_human_deduction_difference(self) -> None:
        with self.assertRaisesRegex(ValueError, "human_deduction_difference is required"):
            calc._notice_mode(
                {
                    "resident_income_levy_before_tax_credits": 400_000,
                    "resident_taxable_general_income": 6_600_000,
                    "basic_deduction_income": 620_000,
                },
                2026,
            )

    def test_cli_estimate_mode_requires_human_deduction_difference(self) -> None:
        with tempfile.NamedTemporaryFile("w", suffix=".yml", encoding="utf-8") as handle:
            handle.write("tax_year: 2026\nsalary_income: 5000000\n")
            handle.flush()
            with self.assertRaisesRegex(ValueError, "human_deduction_difference is required"):
                calc.main(handle.name, 2026)


if __name__ == "__main__":
    unittest.main()
