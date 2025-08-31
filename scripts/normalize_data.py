import argparse
import re
import yaml


def parse_value(v):
    if isinstance(v, (int, float)):
        return v
    s = str(v)
    s = s.replace(',', '').replace('円', '').strip()
    if s.endswith('%'):
        return float(s[:-1]) / 100.0
    try:
        return int(s)
    except ValueError:
        return float(s)


MAPPING = {
    '給与収入': 'salary_income',
    '副業収入': 'side_income',
    '投資差益': 'capital_gains',
    '経費率': 'expense_rate',
    '社会保険料': 'social_insurance',
    '基礎控除': 'basic_deduction',
    '所得税の基礎控除': 'basic_deduction_income',
    '住民税の基礎控除': 'basic_deduction_resident',
    'dcマッチング拠出': 'dc_matching',
    'iDeCo拠出': 'ideco',
    '小規模企業共済': 'small_business',
}


def normalize(input_path, output_path):
    with open(input_path, 'r', encoding='utf-8') as f:
        raw = yaml.safe_load(f)
    normalized = {}
    for k, v in raw.items():
        key = MAPPING.get(k, k)
        normalized[key] = parse_value(v)
    with open(output_path, 'w', encoding='utf-8') as f:
        yaml.safe_dump(normalized, f, allow_unicode=True, sort_keys=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Normalize tax input data')
    parser.add_argument('input')
    parser.add_argument('output')
    args = parser.parse_args()
    normalize(args.input, args.output)
