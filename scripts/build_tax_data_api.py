#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from io import StringIO
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "official" / "nta-tax-parameters-2026.json"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build(out_dir: Path) -> dict:
    source_bytes = SOURCE.read_bytes()
    source = json.loads(source_bytes)
    out_dir.mkdir(parents=True, exist_ok=True)

    api = {
        "schema_version": source["schema_version"],
        "tax_year": source["tax_year"],
        "headline": source["headline"],
        "salary_income_rules": source["salary_income_rules"],
        "income_tax_brackets": source["income_tax_brackets"],
        "provenance": {
            "publisher": source["publisher"],
            "retrieved_at": source["retrieved_at"],
            "sources": source["sources"],
            "license": source["license"],
        },
    }
    parameters_json = (json.dumps(api, ensure_ascii=False, indent=2) + "\n").encode()

    sio = StringIO()
    writer = csv.writer(sio, lineterminator="\n")
    writer.writerow(["record_type", "min_yen", "max_yen", "formula_or_rate", "deduction_yen"])
    for row in source["salary_income_rules"]:
        writer.writerow([
            "salary_income_rule",
            row["min_salary_yen"],
            "" if row["max_salary_yen"] is None else row["max_salary_yen"],
            row["formula"],
            "",
        ])
    for row in source["income_tax_brackets"]:
        writer.writerow([
            "income_tax_bracket",
            row["min_taxable_income_yen"],
            "" if row["max_taxable_income_yen"] is None else row["max_taxable_income_yen"],
            row["rate"],
            row["deduction_yen"],
        ])
    parameters_csv = sio.getvalue().encode()

    files = {"parameters.json": parameters_json, "parameters.csv": parameters_csv}
    for name, payload in files.items():
        (out_dir / name).write_bytes(payload)

    manifest = {
        "schema_version": "1.0",
        "tax_year": source["tax_year"],
        "generated_from": str(SOURCE.relative_to(ROOT)),
        "record_counts": {
            "salary_income_rules": len(source["salary_income_rules"]),
            "income_tax_brackets": len(source["income_tax_brackets"]),
        },
        "source_snapshot_sha256": sha256_bytes(source_bytes),
        "files": {
            name: {"bytes": len(payload), "sha256": sha256_bytes(payload)}
            for name, payload in files.items()
        },
        "retrieved_at": source["retrieved_at"],
        "license": source["license"],
        "cache": {"strategy": "compare-manifest-sha256", "max_age_seconds": 86400},
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "docs" / "api" / "v1")
    args = parser.parse_args()
    result = build(args.out)
    print(json.dumps(result["record_counts"], ensure_ascii=False))
