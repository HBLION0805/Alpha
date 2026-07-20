"""Explicit registry and dispatcher for supported Python operations."""

from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from types import MappingProxyType
from typing import Any, Callable, Mapping

from app.integration.contract import (
    DOMAIN_CATEGORY,
    DOMAIN_ERROR,
    INTERNAL_CATEGORY,
    INTERNAL_ERROR,
    UNKNOWN_OPERATION,
    COMPATIBILITY_CATEGORY,
    IntegrationFault,
    failure_response,
    require_finite_number,
    success_response,
    utc_now,
    validate_request,
)
from app.risk_engine import RiskEngine


RISK_LIMITS_OPERATION = "risk.calculate_limits"


@dataclass(frozen=True)
class OperationDefinition:
    """One registered operation with explicit input, handler, and output checks."""

    name: str
    validate_payload: Callable[[dict[str, Any]], dict[str, Any]]
    handler: Callable[[dict[str, Any]], dict[str, Any]]
    validate_result: Callable[[dict[str, Any]], dict[str, Any]]


def _validate_risk_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if set(payload) != {"totalCapital"}:
        raise IntegrationFault(
            "VALIDATION_ERROR",
            "risk.calculate_limits requires only totalCapital.",
            "VALIDATION",
        )
    return {
        "totalCapital": require_finite_number(
            payload["totalCapital"],
            "payload.totalCapital",
        )
    }


def _calculate_risk_limits(payload: dict[str, Any]) -> dict[str, Any]:
    summary = RiskEngine().get_summary(payload["totalCapital"])
    return {
        "maximumTotalPosition": summary["maximum_total_position"],
        "minimumCashReserve": summary["minimum_cash_reserve"],
        "maximumDailyLoss": summary["maximum_daily_loss"],
        "maximumSingleTrade": summary["maximum_single_trade"],
    }


def _validate_risk_result(result: dict[str, Any]) -> dict[str, Any]:
    expected = {
        "maximumTotalPosition",
        "minimumCashReserve",
        "maximumDailyLoss",
        "maximumSingleTrade",
    }
    if not isinstance(result, dict) or set(result) != expected:
        raise IntegrationFault(
            INTERNAL_ERROR,
            "The registered operation returned an invalid result.",
            INTERNAL_CATEGORY,
        )
    try:
        return {
            key: require_finite_number(result[key], f"result.{key}")
            for key in sorted(expected)
        }
    except IntegrationFault as error:
        raise IntegrationFault(
            INTERNAL_ERROR,
            "The registered operation returned an invalid result.",
            INTERNAL_CATEGORY,
        ) from error


_OPERATIONS: Mapping[str, OperationDefinition] = MappingProxyType(
    {
        RISK_LIMITS_OPERATION: OperationDefinition(
            name=RISK_LIMITS_OPERATION,
            validate_payload=_validate_risk_payload,
            handler=_calculate_risk_limits,
            validate_result=_validate_risk_result,
        )
    }
)


def registered_operations() -> tuple[str, ...]:
    """Return the immutable deterministic operation registry view."""

    return tuple(sorted(_OPERATIONS))


def dispatch_request(
    raw_request: Any,
    clock: Callable[[], str] = utc_now,
    monotonic: Callable[[], float] = perf_counter,
) -> dict[str, Any]:
    """Validate, dispatch one registered operation, and normalize all errors."""

    started_at = monotonic()
    try:
        request = validate_request(raw_request)
        definition = _OPERATIONS.get(request["operation"])
        if definition is None:
            raise IntegrationFault(
                UNKNOWN_OPERATION,
                "The requested operation is not registered.",
                COMPATIBILITY_CATEGORY,
            )
        payload = definition.validate_payload(request["payload"])
        try:
            result = definition.handler(payload)
        except ValueError as error:
            raise IntegrationFault(
                DOMAIN_ERROR,
                "The operation rejected the supplied domain input.",
                DOMAIN_CATEGORY,
            ) from error
        validated_result = definition.validate_result(result)
        return success_response(
            request,
            validated_result,
            started_at,
            clock,
            monotonic,
        )
    except IntegrationFault as fault:
        return failure_response(
            raw_request,
            fault,
            started_at,
            clock,
            monotonic,
        )
    except Exception:
        return failure_response(
            raw_request,
            IntegrationFault(
                INTERNAL_ERROR,
                "The Python integration operation failed internally.",
                INTERNAL_CATEGORY,
            ),
            started_at,
            clock,
            monotonic,
        )
