"""Pure calculation adapter for browser/Pyodide callers.

This module deliberately performs no file or network I/O. It exposes the existing
Python tax core through JSON-friendly inputs so the Web UI has one policy authority.
"""

from __future__ import annotations

import json
from typing import Any

from calc_furusato import (
    _notice_mode,
    _number,
    _required_number,
    calc_taxable_income_bases,
    furusato_limit_from_notice,
    income_tax,
    resident_adjustment_deduction,
    resident_tax,
    validate_tax_year,
)


def _with_donation_state(result: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    raw = payload.get("current_donation")
    donation = None if raw in (None, "") else _number(raw, "current_donation", minimum=0)
    result["current_donation"] = donation
    result["remaining_to_theoretical"] = (
        None if donation is None else result["theoretical_limit_yen"] - donation
    )
    result["remaining_to_safe"] = (
        None if donation is None else result["safe_limit_1000_yen"] - donation
    )
    return result


def calculate(payload: dict[str, Any]) -> dict[str, Any]:
    """Calculate a donation limit from a JSON-compatible mapping."""

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
        return _with_donation_state({"mode": "notice", **result}, payload)

    if mode != "estimate":
        raise ValueError("mode must be 'notice' or 'estimate'")

    (
        taxable_income_tax,
        taxable_resident_tax,
        total_income,
        basic_income_tax,
        basic_resident_tax,
    ) = calc_taxable_income_bases(payload, year)

    human_diff = _required_number(payload, "human_deduction_difference", minimum=0)
    resident_before_credits = resident_tax(taxable_resident_tax)
    adjustment = resident_adjustment_deduction(taxable_resident_tax, human_diff)
    limit_result = furusato_limit_from_notice(
        tax_year=year,
        resident_income_levy_before_tax_credits=resident_before_credits,
        resident_adjustment_deduction_amount=adjustment,
        taxable_resident_general_income=taxable_resident_tax,
        human_deduction_difference=human_diff,
        income_tax_basic_deduction=basic_income_tax,
        total_income=total_income,
    )

    result = {
        "mode": "estimate",
        "tax_year": year,
        "total_income": total_income,
        "basic_deduction_income_tax": basic_income_tax,
        "basic_deduction_resident_tax": basic_resident_tax,
        "taxable_income_tax": taxable_income_tax,
        "taxable_resident_tax": taxable_resident_tax,
        "estimated_income_tax_before_reconstruction_surtax": income_tax(taxable_income_tax),
        "estimated_resident_income_levy_before_credits": resident_before_credits,
        **limit_result,
    }
    return _with_donation_state(result, payload)


def calculate_json(payload_json: str) -> str:
    """JSON string bridge intended for Pyodide boundaries."""

    try:
        payload = json.loads(payload_json)
    except json.JSONDecodeError as exc:
        raise ValueError("payload_json must contain valid JSON") from exc
    return json.dumps(calculate(payload), ensure_ascii=False, sort_keys=True)
