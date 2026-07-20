"""Focused tests for the Python side of the integration boundary."""

from __future__ import annotations

from unittest import TestCase, mock

from app.integration.contract import CONTRACT_VERSION
from app.integration.registry import (
    RISK_LIMITS_OPERATION,
    dispatch_request,
    registered_operations,
)


FIXED_TIME = "2026-07-19T18:00:00.000Z"


def fixed_clock() -> str:
    return FIXED_TIME


def fixed_monotonic() -> float:
    return 1.0


def request(**overrides: object) -> dict[str, object]:
    value: dict[str, object] = {
        "contractVersion": CONTRACT_VERSION,
        "requestId": "integration-request:python",
        "operation": RISK_LIMITS_OPERATION,
        "requestedAt": FIXED_TIME,
        "payload": {"totalCapital": 1000},
        "metadata": {"taskId": "D7-T1"},
    }
    value.update(overrides)
    return value


def dispatch(value: object) -> dict[str, object]:
    return dispatch_request(value, fixed_clock, fixed_monotonic)


class PythonIntegrationTests(TestCase):
    def test_valid_request_succeeds(self) -> None:
        response = dispatch(request())
        self.assertEqual(response["status"], "SUCCESS")
        self.assertEqual(
            response["data"],
            {
                "maximumDailyLoss": 30.0,
                "maximumSingleTrade": 100.0,
                "maximumTotalPosition": 400.0,
                "minimumCashReserve": 200.0,
            },
        )

    def test_malformed_request_is_rejected(self) -> None:
        response = dispatch(request(payload={"totalCapital": "1000"}))
        self.assertEqual(response["error"]["code"], "VALIDATION_ERROR")

    def test_unknown_operation_is_rejected(self) -> None:
        response = dispatch(request(operation="os.system"))
        self.assertEqual(response["error"]["code"], "UNKNOWN_OPERATION")

    def test_unsupported_contract_version_is_rejected(self) -> None:
        response = dispatch(request(contractVersion="2.0"))
        self.assertEqual(
            response["error"]["code"],
            "UNSUPPORTED_CONTRACT_VERSION",
        )

    def test_domain_error_is_stable(self) -> None:
        response = dispatch(request(payload={"totalCapital": -1}))
        self.assertEqual(response["error"]["code"], "DOMAIN_ERROR")
        self.assertFalse(response["error"]["retryable"])

    def test_operation_is_deterministic(self) -> None:
        first = dispatch(request(requestId="integration-request:first"))
        second = dispatch(request(requestId="integration-request:second"))
        self.assertEqual(first["data"], second["data"])

    def test_registry_is_explicit_and_closed(self) -> None:
        self.assertEqual(registered_operations(), (RISK_LIMITS_OPERATION,))
        self.assertNotIn("os.system", registered_operations())
        self.assertNotIn("__import__", registered_operations())

    def test_handler_exception_hides_internal_details(self) -> None:
        with mock.patch(
            "app.integration.registry.RiskEngine.get_summary",
            side_effect=RuntimeError("C:/secret/path internal traceback"),
        ):
            response = dispatch(request())
        self.assertEqual(response["error"]["code"], "INTERNAL_ERROR")
        serialized = str(response)
        self.assertNotIn("C:/secret/path", serialized)
        self.assertNotIn("RuntimeError", serialized)

    def test_invalid_handler_output_maps_to_internal_error(self) -> None:
        with mock.patch(
            "app.integration.registry.RiskEngine.get_summary",
            return_value={"unexpected": 1},
        ):
            response = dispatch(request())
        self.assertEqual(response["error"]["code"], "INTERNAL_ERROR")

    def test_secret_metadata_is_rejected(self) -> None:
        response = dispatch(request(metadata={"apiKey": "not-real"}))
        self.assertEqual(response["error"]["code"], "VALIDATION_ERROR")

    def test_failure_envelope_contains_audit_metadata(self) -> None:
        response = dispatch(request(operation="unknown.operation"))
        self.assertEqual(response["requestId"], "integration-request:python")
        self.assertEqual(response["operation"], "unknown.operation")
        self.assertEqual(response["trace"]["boundary"], "PYTHON_INTEGRATION")
        self.assertEqual(response["trace"]["durationMs"], 0)


if __name__ == "__main__":
    import unittest

    unittest.main()
