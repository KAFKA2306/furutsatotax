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


def calc_taxable_income(d):
    salary = salary_income_after_deduction(d.get('salary_income', 0))
    side = d.get('side_income', 0) * (1 - d.get('expense_rate', 0))
    capital = d.get('capital_gains', 0)
    total_income = salary + side + capital
    deductions = (
        d.get('social_insurance', 0)
        + d.get('dc_matching', 0)
        + d.get('ideco', 0)
        + d.get('small_business', 0)
        + d.get('basic_deduction', 0)
    )
    taxable = max(0, total_income - deductions)
    return taxable, total_income


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


def furusato_limit(taxable):
    it = income_tax(taxable)
    rt = resident_tax(taxable)
    limit = (it + rt) * 0.2
    return math.floor(limit / 100) * 100


def main(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    taxable, total_income = calc_taxable_income(data)
    limit = furusato_limit(taxable)
    print(f'Total income: {total_income:.0f}')
    print(f'Taxable income: {taxable:.0f}')
    print(f'Approximate donation limit: {limit:.0f}円')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Calculate furusato tax donation limit')
    parser.add_argument('input', help='normalized YAML file')
    args = parser.parse_args()
    main(args.input)
