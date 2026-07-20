"""Versioned JSON contract validation for the Python integration boundary."""

from __future__ import annotations

from datetime import datetime, timezone
import math
import re
from time import perf_counter
from typing import Any, Callable


CONTRACT_VERSION = "1.0"
INTEGRATION_BOUNDARY = "PYTHON_INTEGRATION"
INTEGRATION_TRANSPORT = "LOCAL_SUBPROCESS"

VALIDATION_ERROR = "VALIDATION_ERROR"
UNSUPPORTED_CONTRACT_VERSION = "UNSUPPORTED_CONTRACT_VERSION"
UNKNOWN_OPERATION = "UNKNOWN_OPERATION"
DOMAIN_ERROR = "DOMAIN_ERROR"
INTERNAL_ERROR = "INTERNAL_ERROR"

VALIDATION_CATEGORY = "VALIDATION"
COMPATIBILITY_CATEGORY = "COMPATIBILITY"
DOMAIN_CATEGORY = "DOMAIN"
INTERNAL_CATEGORY = "INTERNAL"

_IDENTIFIER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$")
_SECRET_KEY = re.compile(
    r"(?:api[-_]?key|secret|token|password|credential|authorization|private[-_]?key)",
    re.IGNORECASE,
)


class IntegrationFault(Exception):
    """Safe stable fault returned through the public integration contract."""

    def __init__(
        self,
        code: str,
        message: str,
        category: str,
        retryable: bool = False,
        details: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.category = category
        self.retryable = retryable
        self.details = details


def utc_now() -> str:
    """Return a bounded UTC timestamp for protocol metadata."""

    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _is_record(value: Any) -> bool:
    return isinstance(value, dict) and all(
        isinstance(key, str) for key in value
    )


def _require_record(value: Any, name: str) -> dict[str, Any]:
    if not _is_record(value):
        raise IntegrationFault(
            VALIDATION_ERROR,
            f"{name} must be an object.",
            VALIDATION_CATEGORY,
        )
    return value


def _require_exact_keys(
    value: dict[str, Any],
    allowed: set[str],
    name: str,
) -> None:
    unexpected = sorted(set(value) - allowed)
    if unexpected:
        raise IntegrationFault(
            VALIDATION_ERROR,
            f"{name} contains unsupported fields.",
            VALIDATION_CATEGORY,
            details={"field": unexpected[0]},
        )


def _require_identifier(value: Any, name: str) -> str:
    if not isinstance(value, str) or _IDENTIFIER.fullmatch(value) is None:
        raise IntegrationFault(
            VALIDATION_ERROR,
            f"{name} must be a stable identifier.",
            VALIDATION_CATEGORY,
        )
    return value


def _require_timestamp(value: Any, name: str) -> str:
    if not isinstance(value, str) or len(value) > 64:
        raise IntegrationFault(
            VALIDATION_ERROR,
            f"{name} must be an ISO-8601 timestamp.",
            VALIDATION_CATEGORY,
        )
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise IntegrationFault(
            VALIDATION_ERROR,
            f"{name} must be an ISO-8601 timestamp.",
            VALIDATION_CATEGORY,
        ) from error
    if parsed.tzinfo is None:
        raise IntegrationFault(
            VALIDATION_ERROR,
            f"{name} must include a timezone.",
            VALIDATION_CATEGORY,
        )
    return value


def _require_metadata(value: Any) -> dict[str, str]:
    metadata = _require_record(value, "metadata")
    if len(metadata) > 32:
        raise IntegrationFault(
            VALIDATION_ERROR,
            "metadata contains too many entries.",
            VALIDATION_CATEGORY,
        )
    validated: dict[str, str] = {}
    for key, item in metadata.items():
        _require_identifier(key, "metadata key")
        if _SECRET_KEY.search(key):
            raise IntegrationFault(
                VALIDATION_ERROR,
                "metadata contains a secret-bearing key.",
                VALIDATION_CATEGORY,
            )
        if not isinstance(item, str) or not item.strip() or len(item) > 500:
            raise IntegrationFault(
                VALIDATION_ERROR,
                "metadata values must be bounded non-empty strings.",
                VALIDATION_CATEGORY,
            )
        validated[key] = item
    return validated


def require_finite_number(value: Any, name: str) -> float:
    """Validate JSON numeric input without accepting booleans or infinity."""

    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
    ):
        raise IntegrationFault(
            VALIDATION_ERROR,
            f"{name} must be a finite number.",
            VALIDATION_CATEGORY,
        )
    return float(value)


def validate_request(value: Any) -> dict[str, Any]:
    """Validate the shared envelope before operation dispatch."""

    request = _require_record(value, "request")
    _require_exact_keys(
        request,
        {
            "contractVersion",
            "requestId",
            "operation",
            "requestedAt",
            "payload",
            "metadata",
        },
        "request",
    )
    if request.get("contractVersion") != CONTRACT_VERSION:
        raise IntegrationFault(
            UNSUPPORTED_CONTRACT_VERSION,
            f"Only contract version {CONTRACT_VERSION} is supported.",
            COMPATIBILITY_CATEGORY,
        )
    validated = {
        "contractVersion": CONTRACT_VERSION,
        "requestId": _require_identifier(request.get("requestId"), "requestId"),
        "operation": _require_identifier(request.get("operation"), "operation"),
        "requestedAt": _require_timestamp(
            request.get("requestedAt"),
            "requestedAt",
        ),
        "payload": _require_record(request.get("payload"), "payload"),
    }
    if "metadata" in request:
        validated["metadata"] = _require_metadata(request["metadata"])
    return validated


def _safe_identity(value: Any, key: str) -> str:
    if _is_record(value):
        candidate = value.get(key)
        if isinstance(candidate, str) and _IDENTIFIER.fullmatch(candidate):
            return candidate
    return "unavailable"


def trace_metadata(started_at: float, monotonic: Callable[[], float]) -> dict[str, Any]:
    duration = max(0, round((monotonic() - started_at) * 1000))
    return {
        "durationMs": duration,
        "boundary": INTEGRATION_BOUNDARY,
        "transport": INTEGRATION_TRANSPORT,
    }


def success_response(
    request: dict[str, Any],
    data: dict[str, Any],
    started_at: float,
    clock: Callable[[], str] = utc_now,
    monotonic: Callable[[], float] = perf_counter,
) -> dict[str, Any]:
    return {
        "contractVersion": CONTRACT_VERSION,
        "requestId": request["requestId"],
        "operation": request["operation"],
        "status": "SUCCESS",
        "completedAt": clock(),
        "data": data,
        "warnings": [],
        "trace": trace_metadata(started_at, monotonic),
    }


def failure_response(
    raw_request: Any,
    fault: IntegrationFault,
    started_at: float,
    clock: Callable[[], str] = utc_now,
    monotonic: Callable[[], float] = perf_counter,
) -> dict[str, Any]:
    error: dict[str, Any] = {
        "code": fault.code,
        "message": fault.message,
        "category": fault.category,
        "retryable": fault.retryable,
    }
    if fault.details:
        error["details"] = fault.details
    return {
        "contractVersion": CONTRACT_VERSION,
        "requestId": _safe_identity(raw_request, "requestId"),
        "operation": _safe_identity(raw_request, "operation"),
        "status": "FAILURE",
        "completedAt": clock(),
        "error": error,
        "warnings": [],
        "trace": trace_metadata(started_at, monotonic),
    }
