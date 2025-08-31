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


def basic_deduction_income_tax(aggregate_income):
    """所得税の基礎控除（令和2年分以後）
    合計所得金額に応じて 48万/32万/16万/0 で段階的に縮小。
    """
    if aggregate_income <= 24_000_000:
        return 480_000
    elif aggregate_income <= 24_500_000:
        return 320_000
    elif aggregate_income <= 25_000_000:
        return 160_000
    else:
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


def calc_taxable_income_bases(d):
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
        basic_it = basic_deduction_income_tax(total_income)
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


def main(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    taxable_it, taxable_rt, total_income, basic_it, basic_rt = calc_taxable_income_bases(data)
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
    args = parser.parse_args()
    main(args.input)
