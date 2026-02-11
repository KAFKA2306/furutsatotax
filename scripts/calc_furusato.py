import argparse
import math
import yaml
def salary_income_after_deduction(salary):
    """給与所得控除後の給与（現行: 令和2年分以降）。
    控除: 下限55万、上限195万。
      〜162.5万: max(55万, 40%)
      162.5万超〜180万: 40% − 10万
      180万超〜360万: 30% + 8万
      360万超〜660万: 20% + 44万
      660万超〜850万: 10% + 110万
      850万超: 195万
    """
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
    return max(0, salary - deduction)
def basic_deduction_income_tax(aggregate_income: int, tax_year: int) -> int:
    """所得税の基礎控除（現行: 令和2年分以降）
    48万（〜2400万）/32万（〜2450万）/16万（〜2500万）/0。
    """
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
    salary = salary_income_after_deduction(d.get('salary_income', 0))
    side = d.get('side_income', 0) * (1 - d.get('expense_rate', 0))
    capital = d.get('capital_gains', 0)
    biz_rev = d.get('business_revenue', 0)
    biz_exp = d.get('business_expenses', 0)
    biz_profit_pre = max(0, biz_rev - biz_exp)
    blue_spec = d.get('blue_deduction') or d.get('blue_deduction_amount')
    if blue_spec is None:
        method = str(d.get('bookkeeping_method', 'none')).lower()
        etax_raw = d.get('use_etax', False)
        etax = False
        if isinstance(etax_raw, bool):
            etax = etax_raw
        else:
            etax = str(etax_raw).strip().lower() in ('1', 'true', 'yes', 'y', 'on')
        if method in ('double', '複式', '複式簿記'):
            blue_spec = 650_000 if etax else 550_000
        elif method in ('simple', '簡易', '簡易簿記'):
            blue_spec = 100_000
        else:
            blue_spec = 0
    else:
        try:
            blue_spec = int(blue_spec)
        except Exception:
            blue_spec = 0
    blue_applied = min(biz_profit_pre, max(0, blue_spec))
    business = biz_profit_pre - blue_applied
    total_income = salary + side + business + capital
    dc_matching_value = d.get('dc_matching')
    if dc_matching_value is None:
        emp_monthly = float(d.get('employer_dc_monthly', 0) or 0)
        has_db = d.get('has_db', False)
        if not isinstance(has_db, bool):
            has_db = str(has_db).strip().lower() in ('1', 'true', 'yes', 'y', 'on')
        months = int(d.get('dc_months', 12) or 12)
        months = max(1, min(12, months))
        stat_cap = 27500 if has_db else 55000
        max_employee_monthly = max(0, min(emp_monthly, max(0, stat_cap - emp_monthly)))
        dc_matching_value = int(max_employee_monthly * months)
    other_deductions = (
        d.get('social_insurance', 0)
        + dc_matching_value
        + d.get('ideco', 0)
        + d.get('small_business', 0)
    )
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
def income_tax_marginal_rate(taxable):
    if taxable > 40_000_000:
        return 0.45
    if taxable > 18_000_000:
        return 0.40
    if taxable > 9_000_000:
        return 0.33
    if taxable > 6_950_000:
        return 0.23
    if taxable > 3_300_000:
        return 0.20
    if taxable > 1_950_000:
        return 0.10
    if taxable > 0:
        return 0.05
    return 0.0
def resident_tax(taxable):
    return taxable * 0.1
def furusato_limit(taxable_it, taxable_rt):
    it = income_tax(taxable_it)
    rt = resident_tax(taxable_rt)
    rate = income_tax_marginal_rate(taxable_it)
    denom = max(0.01, 0.9 - rate * 1.021)
    approx = (rt * 0.2) / denom + 2_000
    limit = math.floor(approx / 100) * 100
    return limit, it, rt
def main(path, tax_year: int):
    with open(path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
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
