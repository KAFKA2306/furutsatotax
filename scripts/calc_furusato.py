import argparse
import math
import warnings
from typing import Any

import yaml

SUPPORTED_TAX_YEARS = {2024, 2025, 2026}
RECONSTRUCTION_SURTAX_FACTOR = 1.021
RESIDENT_BASIC_DEDUCTION_REFERENCE = 480_000

# ふるさと納税の住民税特例控除に使う割合（復興特別所得税を反映した割合）。
# 大阪市「税額控除額の種類と計算」令和8年度課税分以降の表と同じ区分。
SPECIAL_CREDIT_RATE_TABLE = (
    (1_950_000, 0.84895),
    (3_300_000, 0.79790),
    (6_950_000, 0.69580),
    (9_000_000, 0.66517),
    (18_000_000, 0.56307),
    (40_000_000, 0.49160),
    (math.inf, 0.44055),
)


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


def _rounded_quarter(salary: float) -> int:
    return math.floor((salary / 4) / 1_000) * 1_000


def salary_income_after_deduction(salary: float, tax_year: int) -> float:
    """給与収入から給与所得を返す。

    660万円未満は国税庁の給与所得控除後の給与等の金額の表に合わせ、
    令和7年分は1/4千円未満切捨てを反映する。令和6年分以前の低所得帯も
    最低控除55万円を固定し、旧実装の ``max(55万円, 収入×40%)`` 誤りを除く。
    """

    year = validate_tax_year(tax_year)
    salary = _number(salary, "salary_income", minimum=0)

    if year == 2024:
        if salary <= 550_999:
            return 0.0
        if salary <= 1_625_000:
            return salary - 550_000
        if salary <= 1_800_000:
            return salary - (salary * 0.40 - 100_000)
        if salary < 3_600_000:
            b = _rounded_quarter(salary)
            return max(0.0, b * 2.8 - 80_000)
        if salary < 6_600_000:
            b = _rounded_quarter(salary)
            return max(0.0, b * 3.2 - 440_000)
        if salary < 8_500_000:
            return max(0.0, salary * 0.9 - 1_100_000)
        return max(0.0, salary - 1_950_000)

    if year == 2025:
        if salary <= 650_999:
            return 0.0
        if salary < 1_900_000:
            return salary - 650_000
        if salary < 3_600_000:
            b = _rounded_quarter(salary)
            return max(0.0, b * 2.8 - 80_000)
        if salary < 6_600_000:
            b = _rounded_quarter(salary)
            return max(0.0, b * 3.2 - 440_000)
        if salary < 8_500_000:
            return max(0.0, salary * 0.9 - 1_100_000)
        return max(0.0, salary - 1_950_000)

    # 2026年: 国税庁の令和8年分年末調整表。
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

    b = _rounded_quarter(salary)
    if salary < 3_600_000:
        return max(0.0, b * 2.8 - 80_000)
    if salary < 6_600_000:
        return max(0.0, b * 3.2 - 440_000)
    if salary < 8_500_000:
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

    if income <= 24_000_000:
        return 480_000
    if income <= 24_500_000:
        return 320_000
    if income <= 25_000_000:
        return 160_000
    return 0


def basic_deduction_resident_tax(aggregate_income: float) -> int:
    income = _number(aggregate_income, "aggregate_income", minimum=0)
    if income <= 24_000_000:
        return 430_000
    if income <= 24_500_000:
        return 290_000
    if income <= 25_000_000:
        return 150_000
    return 0


def _configured_blue_deduction(data: dict[str, Any], business_profit: float) -> float:
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

    employer_monthly = _number(data.get("employer_dc_monthly", 0), "employer_dc_monthly", minimum=0)
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
    employee_monthly = max(0.0, min(employer_monthly, max(0.0, statutory_cap - employer_monthly)))
    return employee_monthly * months


def calc_taxable_income_bases(
    data: dict[str, Any], tax_year: int
) -> tuple[float, float, float, float, float]:
    """簡易モード用の課税所得を計算する。

    申告分離課税、住宅ローン、配偶者・扶養などを自動推定しない。
    必要な控除差は income_tax_only_deductions / resident_tax_only_deductions で
    明示入力する。申告分離課税がある場合は通知書モードを使う。
    """

    year = validate_tax_year(tax_year)
    if not isinstance(data, dict):
        raise ValueError("Input YAML must contain a mapping/object at the top level")

    if _number(data.get("separately_taxed_income", 0), "separately_taxed_income", minimum=0):
        raise ValueError(
            "Separately taxed income changes resident-tax mechanics. "
            "Use notice mode with resident_income_levy_before_tax_credits instead."
        )

    salary = salary_income_after_deduction(data.get("salary_income", 0), year)

    expense_rate = _number(data.get("expense_rate", 0), "expense_rate", minimum=0)
    if expense_rate > 1:
        raise ValueError("expense_rate must be between 0 and 1")
    side_income = _number(data.get("side_income", 0), "side_income", minimum=0)
    side = side_income * (1 - expense_rate)

    capital = _number(data.get("capital_gains", 0), "capital_gains", minimum=0)
    if capital and not _as_bool(data.get("treat_capital_gains_as_aggregate_income", False)):
        raise ValueError(
            "capital_gains is not aggregate income by default. "
            "Set treat_capital_gains_as_aggregate_income=true only when legally correct; "
            "for listed-stock gains use notice mode."
        )

    business_revenue = _number(data.get("business_revenue", 0), "business_revenue", minimum=0)
    business_expenses = _number(data.get("business_expenses", 0), "business_expenses", minimum=0)
    if business_expenses > business_revenue:
        raise ValueError(
            "Business losses are not modeled in estimate mode. Use actual taxable bases/notice mode."
        )
    business_profit_before_deduction = business_revenue - business_expenses
    blue_deduction = _configured_blue_deduction(data, business_profit_before_deduction)
    business = business_profit_before_deduction - blue_deduction

    total_income = salary + side + business + capital
    common_deductions = (
        _number(data.get("social_insurance", 0), "social_insurance", minimum=0)
        + _dc_matching_deduction(data)
        + _number(data.get("ideco", 0), "ideco", minimum=0)
        + _number(data.get("small_business", 0), "small_business", minimum=0)
        + _number(data.get("other_common_deductions", 0), "other_common_deductions", minimum=0)
    )

    basic_income_tax = data.get("basic_deduction_income")
    basic_resident_tax = data.get("basic_deduction_resident")
    if basic_income_tax is None:
        basic_income_tax = basic_deduction_income_tax(total_income, year)
    else:
        basic_income_tax = _number(basic_income_tax, "basic_deduction_income", minimum=0)
    if basic_resident_tax is None:
        basic_resident_tax = basic_deduction_resident_tax(total_income)
    else:
        basic_resident_tax = _number(basic_resident_tax, "basic_deduction_resident", minimum=0)

    income_only = _number(
        data.get("income_tax_only_deductions", 0),
        "income_tax_only_deductions",
        minimum=0,
    )
    resident_only = _number(
        data.get("resident_tax_only_deductions", 0),
        "resident_tax_only_deductions",
        minimum=0,
    )

    taxable_income_tax = max(0.0, total_income - common_deductions - basic_income_tax - income_only)
    taxable_resident_tax = max(0.0, total_income - common_deductions - basic_resident_tax - resident_only)
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
        (1_000, 0.05, 0),
        (1_950_000, 0.10, 97_500),
        (3_300_000, 0.20, 427_500),
        (6_950_000, 0.23, 636_000),
        (9_000_000, 0.33, 1_536_000),
        (18_000_000, 0.40, 2_796_000),
        (40_000_000, 0.45, 4_796_000),
    ]
    for threshold, rate, deduction in reversed(brackets):
        if taxable_base >= threshold:
            return taxable_base * rate - deduction
    return 0.0


def income_tax_marginal_rate(taxable: float) -> float:
    taxable_base = _taxable_thousand_yen(taxable)
    if taxable_base >= 40_000_000:
        return 0.45
    if taxable_base >= 18_000_000:
        return 0.40
    if taxable_base >= 9_000_000:
        return 0.33
    if taxable_base >= 6_950_000:
        return 0.23
    if taxable_base >= 3_300_000:
        return 0.20
    if taxable_base >= 1_950_000:
        return 0.10
    if taxable_base >= 1_000:
        return 0.05
    return 0.0


def resident_tax(taxable: float) -> float:
    return _number(taxable, "taxable_resident_income", minimum=0) * 0.10


def resident_adjustment_deduction(
    taxable_resident_income: float,
    human_deduction_difference: float,
) -> float:
    """市民税・府民税の調整控除合計を概算する（合計5%）。"""

    taxable = _number(taxable_resident_income, "taxable_resident_income", minimum=0)
    diff = _number(human_deduction_difference, "human_deduction_difference", minimum=0)
    if diff == 0:
        return 0.0
    if taxable <= 2_000_000:
        return min(diff, taxable) * 0.05
    base = max(diff - (taxable - 2_000_000), 50_000)
    return base * 0.05


def furusato_special_rate_basis(
    taxable_resident_general_income: float,
    tax_year: int,
    human_deduction_difference: float,
    income_tax_basic_deduction: float,
) -> float:
    """住民税特例控除率の判定基礎を返す。

    2025年分所得→令和8年度住民税から、所得税基礎控除引上げ分
    ``max(所得税基礎控除-48万円, 0)`` も差し引く。
    """

    year = validate_tax_year(tax_year)
    taxable = _number(
        taxable_resident_general_income,
        "taxable_resident_general_income",
        minimum=0,
    )
    human_diff = _number(
        human_deduction_difference,
        "human_deduction_difference",
        minimum=0,
    )
    income_basic = _number(
        income_tax_basic_deduction,
        "income_tax_basic_deduction",
        minimum=0,
    )
    base = taxable - human_diff
    if year >= 2025:
        base -= max(income_basic - RESIDENT_BASIC_DEDUCTION_REFERENCE, 0)
    return max(0.0, base)


def furusato_special_credit_rate(rate_basis: float) -> float:
    basis = _number(rate_basis, "special_credit_rate_basis", minimum=0)
    for ceiling, rate in SPECIAL_CREDIT_RATE_TABLE:
        if basis <= ceiling:
            return rate
    raise AssertionError("unreachable")


def furusato_limit_from_notice(
    *,
    tax_year: int,
    resident_income_levy_before_tax_credits: float,
    resident_adjustment_deduction_amount: float,
    taxable_resident_general_income: float,
    human_deduction_difference: float,
    income_tax_basic_deduction: float,
    total_income: float | None = None,
    special_credit_rate_override: float | None = None,
) -> dict[str, float | int]:
    """住民税通知書の実額を使って上限を計算する正準ルート。"""

    year = validate_tax_year(tax_year)
    before = _number(
        resident_income_levy_before_tax_credits,
        "resident_income_levy_before_tax_credits",
        minimum=0,
    )
    adjustment = _number(
        resident_adjustment_deduction_amount,
        "resident_adjustment_deduction_amount",
        minimum=0,
    )
    if adjustment > before:
        raise ValueError("resident_adjustment_deduction_amount cannot exceed income levy")
    adjusted_levy = before - adjustment

    rate_basis = furusato_special_rate_basis(
        taxable_resident_general_income,
        year,
        human_deduction_difference,
        income_tax_basic_deduction,
    )
    if special_credit_rate_override is None:
        special_rate = furusato_special_credit_rate(rate_basis)
    else:
        special_rate = _number(
            special_credit_rate_override,
            "special_credit_rate_override",
            minimum=0,
        )
        if not 0 < special_rate < 1:
            raise ValueError("special_credit_rate_override must be between 0 and 1")

    special_credit_cap = adjusted_levy * 0.20
    theoretical_limit = special_credit_cap / special_rate + 2_000

    if total_income is not None:
        income = _number(total_income, "total_income", minimum=0)
        # 住民税基本控除の寄附金上限（総所得金額等の30%）も満たす必要がある。
        theoretical_limit = min(theoretical_limit, income * 0.30)

    return {
        "tax_year": year,
        "adjusted_resident_income_levy": adjusted_levy,
        "special_credit_cap": special_credit_cap,
        "special_credit_rate_basis": rate_basis,
        "special_credit_rate": special_rate,
        "theoretical_limit_yen": math.floor(theoretical_limit),
        "safe_limit_1000_yen": math.floor(theoretical_limit / 1_000) * 1_000,
    }


def furusato_limit(
    taxable_income_tax: float,
    taxable_resident_tax: float,
    *,
    tax_year: int = 2025,
    human_deduction_difference: float = 50_000,
    income_tax_basic_deduction: float | None = None,
    total_income: float | None = None,
) -> tuple[int, float, float]:
    """簡易モードの互換API。

    旧実装の ``住民税課税所得×10%`` をそのまま20%上限の母数にはせず、
    調整控除を差し引き、特例控除率も所得税限界税率ではなく住民税の公式表で判定する。
    """

    year = validate_tax_year(tax_year)
    taxable_it = _number(taxable_income_tax, "taxable_income_tax", minimum=0)
    taxable_rt = _number(taxable_resident_tax, "taxable_resident_tax", minimum=0)
    estimated_income_tax = income_tax(taxable_it)
    resident_before_credits = resident_tax(taxable_rt)
    adjustment = resident_adjustment_deduction(
        taxable_rt,
        human_deduction_difference,
    )
    if income_tax_basic_deduction is None:
        # 総所得がない互換APIでは、課税所得から厳密な基礎控除帯を復元できない。
        # 2025/2026の一般的な中高所得帯を既定とし、CLI本体では実額を渡す。
        income_tax_basic_deduction = 480_000 if year == 2024 else (580_000 if year == 2025 else 620_000)

    result = furusato_limit_from_notice(
        tax_year=year,
        resident_income_levy_before_tax_credits=resident_before_credits,
        resident_adjustment_deduction_amount=adjustment,
        taxable_resident_general_income=taxable_rt,
        human_deduction_difference=human_deduction_difference,
        income_tax_basic_deduction=income_tax_basic_deduction,
        total_income=total_income,
    )
    return (
        int(result["safe_limit_1000_yen"]),
        estimated_income_tax,
        resident_before_credits,
    )


def _notice_mode(data: dict[str, Any], tax_year: int) -> dict[str, float | int] | None:
    before = data.get("resident_income_levy_before_tax_credits")
    taxable = data.get("resident_taxable_general_income")
    if before is None and taxable is None:
        return None
    if before is None or taxable is None:
        raise ValueError(
            "Notice mode requires both resident_income_levy_before_tax_credits "
            "and resident_taxable_general_income"
        )

    human_diff = _number(
        data.get("human_deduction_difference", 50_000),
        "human_deduction_difference",
        minimum=0,
    )
    income_basic = data.get("basic_deduction_income")
    if income_basic is None:
        aggregate = data.get("total_income")
        if aggregate is None:
            raise ValueError(
                "Notice mode requires basic_deduction_income or total_income to determine it"
            )
        income_basic = basic_deduction_income_tax(aggregate, tax_year)

    adjustment = data.get("resident_adjustment_deduction")
    if adjustment is None:
        adjustment = resident_adjustment_deduction(taxable, human_diff)

    override = data.get("special_credit_rate_override")
    return furusato_limit_from_notice(
        tax_year=tax_year,
        resident_income_levy_before_tax_credits=before,
        resident_adjustment_deduction_amount=adjustment,
        taxable_resident_general_income=taxable,
        human_deduction_difference=human_diff,
        income_tax_basic_deduction=income_basic,
        total_income=data.get("total_income"),
        special_credit_rate_override=override,
    )


def main(path: str, tax_year: int) -> None:
    with open(path, "r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise ValueError("Input YAML must contain a mapping/object at the top level")

    year = validate_tax_year(data.get("tax_year", tax_year))
    notice_result = _notice_mode(data, year)
    if notice_result is not None:
        print(f"Tax year: {year}")
        print("Mode: resident-tax notice (preferred)")
        print(f"Adjusted resident income levy: {notice_result['adjusted_resident_income_levy']:.0f}円")
        print(f"Special-credit rate basis: {notice_result['special_credit_rate_basis']:.0f}円")
        print(f"Special-credit rate: {notice_result['special_credit_rate'] * 100:.3f}%")
        print(f"Special-credit 20% cap: {notice_result['special_credit_cap']:.0f}円")
        print(f"Theoretical donation limit: {notice_result['theoretical_limit_yen']:.0f}円")
        print(f"Safe limit (1,000-yen floor): {notice_result['safe_limit_1000_yen']:.0f}円")
        return

    (
        taxable_income_tax,
        taxable_resident_tax,
        total_income,
        basic_income_tax,
        basic_resident_tax,
    ) = calc_taxable_income_bases(data, year)

    human_diff = _number(
        data.get("human_deduction_difference", 50_000),
        "human_deduction_difference",
        minimum=0,
    )
    limit, income_tax_amount, resident_tax_amount = furusato_limit(
        taxable_income_tax,
        taxable_resident_tax,
        tax_year=year,
        human_deduction_difference=human_diff,
        income_tax_basic_deduction=basic_income_tax,
        total_income=total_income,
    )

    print(f"Tax year: {year}")
    print("Mode: estimate (use notice mode when available)")
    print(f"Total income (aggregate): {total_income:.0f}")
    print(f"Basic deduction (income tax): {basic_income_tax:.0f}")
    print(f"Basic deduction (resident tax): {basic_resident_tax:.0f}")
    print(f"Taxable income (income tax): {taxable_income_tax:.0f}")
    print(f"Taxable income (resident tax): {taxable_resident_tax:.0f}")
    print(f"Estimated income tax before reconstruction surtax: {income_tax_amount:.0f}円")
    print(f"Estimated resident income levy before credits: {resident_tax_amount:.0f}円")
    print(f"Safe approximate donation limit: {limit:.0f}円")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Calculate a furusato donation limit; resident-tax notice mode is preferred"
    )
    parser.add_argument("input", help="YAML input")
    parser.add_argument(
        "--tax-year",
        type=int,
        default=2025,
        choices=sorted(SUPPORTED_TAX_YEARS),
        help="Income tax year. 2025 corresponds to resident-tax year 2026.",
    )
    arguments = parser.parse_args()
    main(arguments.input, arguments.tax_year)
