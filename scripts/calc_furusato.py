import argparse
import math
import warnings
from typing import Any

import yaml

SUPPORTED_TAX_YEARS = {2024, 2025, 2026}


def validate_tax_year(tax_year: int) -> int:
    try:
        year = int(tax_year)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"tax_year must be an integer: {tax_year!r}") from exc
    if year not in SUPPORTED_TAX_YEARS:
        supported = ", ".join(str(value) for value in sorted(SUPPORTED_TAX_YEARS))
        raise ValueError(
            f"Unsupported tax_year={year}. Supported years: {supported}. "
            "Do not reuse another year's tax table."
        )
    return year


def _number(value: Any, name: str, *, minimum: float | None = None) -> float:
    try:
        result = float(value or 0)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be numeric: {value!r}") from exc
    if not math.isfinite(result):
        raise ValueError(f"{name} must be finite")
    if minimum is not None and result < minimum:
        raise ValueError(f"{name} must be at least {minimum}")
    return result


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def salary_income_after_deduction(salary: float, tax_year: int) -> float:
    """給与収入から、税年度別の給与所得控除後の給与所得を返す。

    2024年は令和2年分から令和6年分の規則、2025年は最低保障額65万円、
    2026年は令和8年分の年末調整表と低所得帯の特例を適用する。
    """

    year = validate_tax_year(tax_year)
    salary = _number(salary, "salary_income", minimum=0)

    if year == 2024:
        if salary <= 1_625_000:
            deduction = max(550_000, salary * 0.4)
        elif salary <= 1_800_000:
            deduction = salary * 0.4 - 100_000
        elif salary <= 3_600_000:
            deduction = salary * 0.3 + 80_000
        elif salary <= 6_600_000:
            deduction = salary * 0.2 + 440_000
        elif salary <= 8_500_000:
            deduction = salary * 0.1 + 1_100_000
        else:
            deduction = 1_950_000
        return max(0.0, salary - deduction)

    if year == 2025:
        if salary <= 1_900_000:
            deduction = 650_000
        elif salary <= 3_600_000:
            deduction = salary * 0.3 + 80_000
        elif salary <= 6_600_000:
            deduction = salary * 0.2 + 440_000
        elif salary <= 8_500_000:
            deduction = salary * 0.1 + 1_100_000
        else:
            deduction = 1_950_000
        return max(0.0, salary - deduction)

    # 2026年: 国税庁の年末調整等のための給与所得控除後の金額表。
    # 660万円以下では、給与収入の4分の1を千円未満切捨てして計算する。
    if salary < 741_000:
        return 0.0
    if salary < 2_191_000:
        return salary - 740_000
    if salary < 2_193_000:
        return 1_451_000.0
    if salary < 2_196_000:
        return 1_453_000.0
    if salary < 2_200_000:
        return 1_456_000.0

    rounded_quarter = math.floor((salary / 4) / 1_000) * 1_000
    if salary <= 3_600_000:
        return max(0.0, rounded_quarter * 2.8 - 80_000)
    if salary <= 6_600_000:
        return max(0.0, rounded_quarter * 3.2 - 440_000)
    if salary <= 8_500_000:
        return max(0.0, salary * 0.9 - 1_100_000)
    return max(0.0, salary - 1_950_000)


def basic_deduction_income_tax(aggregate_income: float, tax_year: int) -> int:
    """税年度別の所得税基礎控除額を返す。"""

    year = validate_tax_year(tax_year)
    income = _number(aggregate_income, "aggregate_income", minimum=0)

    if year == 2024:
        if income <= 24_000_000:
            return 480_000
        if income <= 24_500_000:
            return 320_000
        if income <= 25_000_000:
            return 160_000
        return 0

    if year == 2025:
        if income <= 1_320_000:
            return 950_000
        if income <= 3_360_000:
            return 880_000
        if income <= 4_890_000:
            return 680_000
        if income <= 6_550_000:
            return 630_000
        if income <= 23_500_000:
            return 580_000
    else:  # 2026年
        if income <= 4_890_000:
            return 1_040_000
        if income <= 6_550_000:
            return 670_000
        if income <= 23_500_000:
            return 620_000

    # 合計所得金額2,350万円超の逓減部分は2025・2026年改正の対象外。
    if income <= 24_000_000:
        return 480_000
    if income <= 24_500_000:
        return 320_000
    if income <= 25_000_000:
        return 160_000
    return 0


def basic_deduction_resident_tax(aggregate_income: float) -> int:
    """本ツールの住民税概算に使う基礎控除額を返す。"""

    income = _number(aggregate_income, "aggregate_income", minimum=0)
    if income <= 24_000_000:
        return 430_000
    if income <= 24_500_000:
        return 290_000
    if income <= 25_000_000:
        return 150_000
    return 0


def _configured_blue_deduction(
    data: dict[str, Any], business_profit: float
) -> float:
    if "blue_deduction" in data:
        specified = data["blue_deduction"]
    elif "blue_deduction_amount" in data:
        specified = data["blue_deduction_amount"]
    else:
        specified = None

    if specified is None:
        method = str(data.get("bookkeeping_method", "none")).lower()
        if method in {"double", "複式", "複式簿記"}:
            specified = 650_000 if _as_bool(data.get("use_etax", False)) else 550_000
        elif method in {"simple", "簡易", "簡易簿記"}:
            specified = 100_000
        else:
            specified = 0

    amount = _number(specified, "blue_deduction", minimum=0)
    return min(business_profit, amount)


def _dc_matching_deduction(data: dict[str, Any]) -> float:
    if data.get("dc_matching") is not None:
        return _number(data["dc_matching"], "dc_matching", minimum=0)

    employer_monthly = _number(
        data.get("employer_dc_monthly", 0),
        "employer_dc_monthly",
        minimum=0,
    )
    if employer_monthly == 0:
        return 0.0

    warnings.warn(
        "dc_matching was estimated from generic statutory caps. "
        "Confirm the actual plan rules and contribution statement.",
        RuntimeWarning,
        stacklevel=2,
    )
    months = int(_number(data.get("dc_months", 12), "dc_months", minimum=1))
    months = min(12, months)
    statutory_cap = 27_500 if _as_bool(data.get("has_db", False)) else 55_000
    employee_monthly = max(
        0.0,
        min(employer_monthly, max(0.0, statutory_cap - employer_monthly)),
    )
    return employee_monthly * months


def calc_taxable_income_bases(
    data: dict[str, Any], tax_year: int
) -> tuple[float, float, float, float, float]:
    year = validate_tax_year(tax_year)
    if not isinstance(data, dict):
        raise ValueError("Input YAML must contain a mapping/object at the top level")

    salary = salary_income_after_deduction(data.get("salary_income", 0), year)

    expense_rate = _number(data.get("expense_rate", 0), "expense_rate", minimum=0)
    if expense_rate > 1:
        raise ValueError("expense_rate must be between 0 and 1")
    side_income = _number(data.get("side_income", 0), "side_income", minimum=0)
    side = side_income * (1 - expense_rate)

    capital = _number(data.get("capital_gains", 0), "capital_gains", minimum=0)
    if capital and not _as_bool(
        data.get("treat_capital_gains_as_aggregate_income", False)
    ):
        raise ValueError(
            "capital_gains is not included automatically because listed-stock gains "
            "and other gains may be separately taxed. Set "
            "treat_capital_gains_as_aggregate_income=true only when the amount "
            "belongs in aggregate income."
        )

    business_revenue = _number(
        data.get("business_revenue", 0), "business_revenue", minimum=0
    )
    business_expenses = _number(
        data.get("business_expenses", 0), "business_expenses", minimum=0
    )
    business_profit_before_deduction = max(
        0.0, business_revenue - business_expenses
    )
    blue_deduction = _configured_blue_deduction(
        data, business_profit_before_deduction
    )
    business = business_profit_before_deduction - blue_deduction

    total_income = salary + side + business + capital
    other_deductions = (
        _number(data.get("social_insurance", 0), "social_insurance", minimum=0)
        + _dc_matching_deduction(data)
        + _number(data.get("ideco", 0), "ideco", minimum=0)
        + _number(data.get("small_business", 0), "small_business", minimum=0)
    )

    basic_override = data.get("basic_deduction")
    basic_income_tax = data.get("basic_deduction_income", basic_override)
    basic_resident_tax = data.get("basic_deduction_resident", basic_override)

    if basic_income_tax is None:
        basic_income_tax = basic_deduction_income_tax(total_income, year)
    else:
        basic_income_tax = _number(
            basic_income_tax, "basic_deduction_income", minimum=0
        )

    if basic_resident_tax is None:
        basic_resident_tax = basic_deduction_resident_tax(total_income)
    else:
        basic_resident_tax = _number(
            basic_resident_tax, "basic_deduction_resident", minimum=0
        )

    taxable_income_tax = max(
        0.0, total_income - other_deductions - basic_income_tax
    )
    taxable_resident_tax = max(
        0.0, total_income - other_deductions - basic_resident_tax
    )
    return (
        taxable_income_tax,
        taxable_resident_tax,
        total_income,
        float(basic_income_tax),
        float(basic_resident_tax),
    )


def _taxable_thousand_yen(taxable: float) -> int:
    taxable = _number(taxable, "taxable_income", minimum=0)
    return math.floor(taxable / 1_000) * 1_000


def income_tax(taxable: float) -> float:
    taxable_base = _taxable_thousand_yen(taxable)
    brackets = [
        (0, 0.05, 0),
        (1_950_000, 0.10, 97_500),
        (3_300_000, 0.20, 427_500),
        (6_950_000, 0.23, 636_000),
        (9_000_000, 0.33, 1_536_000),
        (18_000_000, 0.40, 2_796_000),
        (40_000_000, 0.45, 4_796_000),
    ]
    for threshold, rate, deduction in reversed(brackets):
        if taxable_base > threshold:
            return taxable_base * rate - deduction
    return 0.0


def income_tax_marginal_rate(taxable: float) -> float:
    taxable_base = _taxable_thousand_yen(taxable)
    if taxable_base > 40_000_000:
        return 0.45
    if taxable_base > 18_000_000:
        return 0.40
    if taxable_base > 9_000_000:
        return 0.33
    if taxable_base > 6_950_000:
        return 0.23
    if taxable_base > 3_300_000:
        return 0.20
    if taxable_base > 1_950_000:
        return 0.10
    if taxable_base > 0:
        return 0.05
    return 0.0


def resident_tax(taxable: float) -> float:
    return _number(taxable, "taxable_resident_income", minimum=0) * 0.10


def furusato_limit(
    taxable_income_tax: float, taxable_resident_tax: float
) -> tuple[int, float, float]:
    estimated_income_tax = income_tax(taxable_income_tax)
    estimated_resident_tax = resident_tax(taxable_resident_tax)
    marginal_rate = income_tax_marginal_rate(taxable_income_tax)
    denominator = 0.90 - marginal_rate * 1.021
    if denominator <= 0:
        raise ValueError("Invalid furusato-tax denominator")
    approximation = estimated_resident_tax * 0.20 / denominator + 2_000
    limit = math.floor(approximation / 100) * 100
    return limit, estimated_income_tax, estimated_resident_tax


def main(path: str, tax_year: int) -> None:
    with open(path, "r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)

    if not isinstance(data, dict):
        raise ValueError("Input YAML must contain a mapping/object at the top level")

    if data.get("tax_year") is not None:
        tax_year = validate_tax_year(data["tax_year"])
    else:
        tax_year = validate_tax_year(tax_year)

    (
        taxable_income_tax,
        taxable_resident_tax,
        total_income,
        basic_income_tax,
        basic_resident_tax,
    ) = calc_taxable_income_bases(data, tax_year)
    limit, income_tax_amount, resident_tax_amount = furusato_limit(
        taxable_income_tax, taxable_resident_tax
    )

    print(f"Tax year: {tax_year}")
    print(f"Total income (aggregate): {total_income:.0f}")
    print(f"Basic deduction (income tax): {basic_income_tax:.0f}")
    print(f"Basic deduction (resident tax): {basic_resident_tax:.0f}")
    print(f"Taxable income (income tax): {taxable_income_tax:.0f}")
    print(f"Taxable income (resident tax): {taxable_resident_tax:.0f}")
    print(
        "Estimated income tax before reconstruction surtax: "
        f"{income_tax_amount:.0f}円"
    )
    print(f"Estimated resident tax (income portion): {resident_tax_amount:.0f}円")
    print(f"Approximate donation limit: {limit:.0f}円")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Calculate an approximate furusato donation limit"
    )
    parser.add_argument(
        "input",
        help="Normalized YAML file (or raw data processed by normalize_data.py)",
    )
    parser.add_argument(
        "--tax-year",
        type=int,
        default=2026,
        choices=sorted(SUPPORTED_TAX_YEARS),
        help="Tax year. Rules are implemented separately for 2024, 2025 and 2026.",
    )
    arguments = parser.parse_args()
    main(arguments.input, arguments.tax_year)
