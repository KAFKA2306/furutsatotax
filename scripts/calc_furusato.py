import argparse
import math
import yaml


def salary_income_after_deduction(salary):
    if salary <= 1_625_000:
        return max(0, salary - 550_000)
    elif salary <= 1_800_000:
        return salary * 0.6 - 100_000
    elif salary <= 3_600_000:
        return salary * 0.7 - 180_000
    elif salary <= 6_600_000:
        return salary * 0.8 - 540_000
    elif salary <= 8_500_000:
        return salary * 0.9 - 1_200_000
    else:
        return salary - 1_950_000


def basic_deduction_income_tax(aggregate_income: int, tax_year: int) -> int:
    """所得税の基礎控除の自動計算。
    - 2024年分以前: 48万/32万/16万/0（閾値: 2400万/2450万/2500万）
    - 2025〜2026年分: 95万/88万/68万/63万/58万（閾値: 132万/336万/489万/655万/2350万）
                        2350万超は従前どおり 48万/32万/16万/0（2400/2450/2500万）
    - 2027年分以後: 95万（〜132万）/58万（132万超〜2350万）/従前どおり（2350万超）
    参照: 国税庁「令和7年度税制改正による所得税の基礎控除の見直し等について」
    """
    if tax_year >= 2025:
        # 2025-2026 detailed bands, 2027+ flatten mid bands to 58万
        if aggregate_income <= 1_320_000:
            return 950_000
        if tax_year <= 2026:
            # R7〜R8: 88/68/63/58
            if aggregate_income <= 3_360_000:
                return 880_000
            if aggregate_income <= 4_890_000:
                return 680_000
            if aggregate_income <= 6_550_000:
                return 630_000
        # R9以後 or R7〜R8の 655万超〜2350万以下: 58万
        if aggregate_income <= 23_500_000:
            return 580_000
        # 2350万超は従前どおりの段階的縮小（48/32/16/0）
        if aggregate_income <= 24_000_000:
            return 480_000
        if aggregate_income <= 24_500_000:
            return 320_000
        if aggregate_income <= 25_000_000:
            return 160_000
        return 0

    # 〜2024年分（従前）
    if aggregate_income <= 24_000_000:
        return 480_000
    if aggregate_income <= 24_500_000:
        return 320_000
    if aggregate_income <= 25_000_000:
        return 160_000
    return 0


def basic_deduction_resident_tax(aggregate_income):
    """個人住民税の基礎控除（令和2年度以後）
    合計所得金額に応じて 43万/29万/15万/0 で段階的に縮小。
    """
    if aggregate_income <= 24_000_000:
        return 430_000
    elif aggregate_income <= 24_500_000:
        return 290_000
    elif aggregate_income <= 25_000_000:
        return 150_000
    else:
        return 0


def calc_taxable_income_bases(d, tax_year: int):
    # 合計所得金額（給与所得控除後の給与 + 副業(経費差引後) + その他）
    salary = salary_income_after_deduction(d.get('salary_income', 0))
    side = d.get('side_income', 0) * (1 - d.get('expense_rate', 0))
    capital = d.get('capital_gains', 0)
    total_income = salary + side + capital

    # 所得控除（基礎控除以外）
    other_deductions = (
        d.get('social_insurance', 0)
        + d.get('dc_matching', 0)
        + d.get('ideco', 0)
        + d.get('small_business', 0)
    )

    # 基礎控除: 明示指定があれば優先。なければ自動計算。
    # 互換性のため 'basic_deduction' が与えられたら両税目に同一額を適用。
    basic_override = d.get('basic_deduction')
    basic_it = d.get('basic_deduction_income', basic_override)
    basic_rt = d.get('basic_deduction_resident', basic_override)
    if basic_it is None:
        basic_it = basic_deduction_income_tax(total_income, tax_year)
    if basic_rt is None:
        basic_rt = basic_deduction_resident_tax(total_income)

    taxable_it = max(0, total_income - other_deductions - basic_it)
    taxable_rt = max(0, total_income - other_deductions - basic_rt)
    return taxable_it, taxable_rt, total_income, basic_it, basic_rt


def income_tax(taxable):
    brackets = [
        (0, 0.05, 0),
        (1_950_000, 0.1, 97_500),
        (3_300_000, 0.2, 427_500),
        (6_950_000, 0.23, 636_000),
        (9_000_000, 0.33, 1_536_000),
        (18_000_000, 0.4, 2_796_000),
        (40_000_000, 0.45, 4_796_000),
    ]
    for thresh, rate, deduction in reversed(brackets):
        if taxable > thresh:
            return taxable * rate - deduction
    return 0


def resident_tax(taxable):
    return taxable * 0.1


def furusato_limit(taxable_it, taxable_rt):
    it = income_tax(taxable_it)
    rt = resident_tax(taxable_rt)
    limit = (it + rt) * 0.2
    return math.floor(limit / 100) * 100, it, rt


def main(path, tax_year: int):
    with open(path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    # YAML内に tax_year があれば優先
    if isinstance(data, dict) and 'tax_year' in data and data['tax_year']:
        try:
            tax_year = int(data['tax_year'])
        except Exception:
            pass
    taxable_it, taxable_rt, total_income, basic_it, basic_rt = calc_taxable_income_bases(data, tax_year)
    limit, it_amount, rt_amount = furusato_limit(taxable_it, taxable_rt)
    print(f'Total income (aggregate): {total_income:.0f}')
    print(f'Basic deduction (income tax): {basic_it:.0f}')
    print(f'Basic deduction (resident tax): {basic_rt:.0f}')
    print(f'Taxable income (income tax): {taxable_it:.0f}')
    print(f'Taxable income (resident tax): {taxable_rt:.0f}')
    print(f'Estimated income tax: {it_amount:.0f}円')
    print(f'Estimated resident tax (income portion): {rt_amount:.0f}円')
    print(f'Approximate donation limit: {limit:.0f}円')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Calculate furusato donation limit (with basic deduction auto)')
    parser.add_argument('input', help='normalized YAML file (or raw via normalize_data.py)')
    parser.add_argument('--tax-year', type=int, default=2025, help='tax year (e.g., 2025=R7, 2026=R8, 2027=R9)')
    args = parser.parse_args()
    main(args.input, args.tax_year)
