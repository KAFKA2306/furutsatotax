"""Pure calculation adapter for browser/Pyodide callers.

This module deliberately performs no file or network I/O.  It exposes the existing
Python tax core through JSON-friendly inputs so the Web UI can migrate away from
its duplicate JavaScript tax formulas without inventing a third calculation core.
"""

from __future__ import annotations

import json
from typing import Any

from calc_furusato import (
    _notice_mode,
    _number,
    calc_taxable_income_bases,
    furusato_limit,
    validate_tax_year,
)


def calculate(payload: dict[str, Any]) -> dict[str, Any]:
    """Calculate a donation limit from a JSON-compatible mapping.

    ``mode`` is either ``notice`` or ``estimate``.  Notice mode is preferred when
    the resident-tax notice fields are available.  Unknown tax years and the same
    unsupported estimate-mode cases as the CLI fail closed in the canonical core.
    """

    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")

    mode = str(payload.get("mode", "estimate")).strip().lower()
    year = validate_tax_year(payload.get("tax_year", 2025))

    if mode == "notice":
        result = _notice_mode(payload, year)
        if result is None:
            raise ValueError(
                "notice mode requires resident_income_levy_before_tax_credits "
                "and resident_taxable_general_income"
            )
        return {"mode": "notice", **result}

    if mode != "estimate":
        raise ValueError("mode must be 'notice' or 'estimate'")

    (
        taxable_income_tax,
        taxable_resident_tax,
        total_income,
        basic_income_tax,
        basic_resident_tax,
    ) = calc_taxable_income_bases(payload, year)

    human_diff = _number(
        payload.get("human_deduction_difference", 50_000),
        "human_deduction_difference",
        minimum=0,
    )
    safe_limit, income_tax_amount, resident_tax_amount = furusato_limit(
        taxable_income_tax,
        taxable_resident_tax,
        tax_year=year,
        human_deduction_difference=human_diff,
        income_tax_basic_deduction=basic_income_tax,
        total_income=total_income,
    )

    return {
        "mode": "estimate",
        "tax_year": year,
        "total_income": total_income,
        "basic_deduction_income_tax": basic_income_tax,
        "basic_deduction_resident_tax": basic_resident_tax,
        "taxable_income_tax": taxable_income_tax,
        "taxable_resident_tax": taxable_resident_tax,
        "estimated_income_tax_before_reconstruction_surtax": income_tax_amount,
        "estimated_resident_income_levy_before_credits": resident_tax_amount,
        "safe_limit_1000_yen": safe_limit,
    }


def calculate_json(payload_json: str) -> str:
    """JSON string bridge intended for ``pyodide.runPython``/PyProxy boundaries."""

    try:
        payload = json.loads(payload_json)
    except json.JSONDecodeError as exc:
        raise ValueError("payload_json must contain valid JSON") from exc
    return json.dumps(calculate(payload), ensure_ascii=False, sort_keys=True)
