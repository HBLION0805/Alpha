import {
  PYTHON_INTEGRATION_CONTRACT_VERSION,
  PythonIntegrationErrorCategory,
  PythonIntegrationErrorCode,
  PythonIntegrationOperation,
  PythonIntegrationStatus,
  type CalculateRiskLimitsResult,
  type PythonIntegrationFailure,
  type PythonIntegrationMetadata,
  type PythonIntegrationRequest,
  type PythonIntegrationResponse,
} from "./PythonIntegration";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/u;
const SECRET_KEY = /(?:api[-_]?key|secret|token|password|credential|authorization|private[-_]?key)/iu;

function record(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${name}: expected an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: ReadonlyArray<string>,
  name: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new Error(`Invalid ${name}.${key}: field is not allowed.`);
    }
  }
}

function identifier(value: unknown, name: string): string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw new Error(`Invalid ${name}: expected a stable identifier.`);
  }
  return value;
}

function nonEmpty(value: unknown, name: string, maximumLength = 500): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximumLength
  ) {
    throw new Error(`Invalid ${name}: expected a bounded non-empty string.`);
  }
  return value;
}

function timestamp(value: unknown, name: string): string {
  const text = nonEmpty(value, name, 64);
  if (!Number.isFinite(Date.parse(text))) {
    throw new Error(`Invalid ${name}: expected an ISO-8601 timestamp.`);
  }
  return text;
}

function finiteNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid ${name}: expected a finite number.`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${name}: expected a non-negative safe integer.`);
  }
  return value;
}

function stringArray(value: unknown, name: string): ReadonlyArray<string> {
  if (!Array.isArray(value) || value.length > 20) {
    throw new Error(`Invalid ${name}: expected a bounded string array.`);
  }
  return value.map((item, index) => nonEmpty(item, `${name}[${String(index)}]`));
}

function metadata(value: unknown, name: string): PythonIntegrationMetadata {
  const entries = record(value, name);
  if (Object.keys(entries).length > 32) {
    throw new Error(`Invalid ${name}: too many entries.`);
  }
  const validated: Record<string, string> = {};
  for (const [key, item] of Object.entries(entries)) {
    identifier(key, `${name} key`);
    if (SECRET_KEY.test(key)) {
      throw new Error(`Invalid ${name}.${key}: secret-bearing keys are forbidden.`);
    }
    validated[key] = nonEmpty(item, `${name}.${key}`, 500);
  }
  return validated;
}

function operation(value: unknown, name: string): PythonIntegrationOperation {
  if (!Object.values(PythonIntegrationOperation).includes(value as PythonIntegrationOperation)) {
    throw new Error(`Invalid ${name}: operation is not registered.`);
  }
  return value as PythonIntegrationOperation;
}

function riskPayload(value: unknown): { readonly totalCapital: number } {
  const payload = record(value, "request.payload");
  exactKeys(payload, ["totalCapital"], "request.payload");
  return { totalCapital: finiteNumber(payload.totalCapital, "request.payload.totalCapital") };
}

function riskResult(value: unknown): CalculateRiskLimitsResult {
  const data = record(value, "response.data");
  const keys = [
    "maximumTotalPosition",
    "minimumCashReserve",
    "maximumDailyLoss",
    "maximumSingleTrade",
  ] as const;
  exactKeys(data, keys, "response.data");
  return {
    maximumTotalPosition: finiteNumber(data.maximumTotalPosition, "response.data.maximumTotalPosition"),
    minimumCashReserve: finiteNumber(data.minimumCashReserve, "response.data.minimumCashReserve"),
    maximumDailyLoss: finiteNumber(data.maximumDailyLoss, "response.data.maximumDailyLoss"),
    maximumSingleTrade: finiteNumber(data.maximumSingleTrade, "response.data.maximumSingleTrade"),
  };
}

export function validatePythonIntegrationRequest(value: unknown): PythonIntegrationRequest {
  const request = record(value, "request");
  exactKeys(
    request,
    ["contractVersion", "requestId", "operation", "requestedAt", "payload", "metadata"],
    "request",
  );
  if (request.contractVersion !== PYTHON_INTEGRATION_CONTRACT_VERSION) {
    throw new Error(`Invalid request.contractVersion: expected ${PYTHON_INTEGRATION_CONTRACT_VERSION}.`);
  }
  const selectedOperation = operation(request.operation, "request.operation");
  const payload = selectedOperation === PythonIntegrationOperation.CalculateRiskLimits
    ? riskPayload(request.payload)
    : (() => { throw new Error("Invalid request.operation: operation is not registered."); })();
  return {
    contractVersion: PYTHON_INTEGRATION_CONTRACT_VERSION,
    requestId: identifier(request.requestId, "request.requestId"),
    operation: selectedOperation,
    requestedAt: timestamp(request.requestedAt, "request.requestedAt"),
    payload,
    ...(request.metadata === undefined ? {} : { metadata: metadata(request.metadata, "request.metadata") }),
  };
}

function failure(value: unknown): PythonIntegrationFailure {
  const error = record(value, "response.error");
  exactKeys(error, ["code", "message", "category", "retryable", "details"], "response.error");
  if (!Object.values(PythonIntegrationErrorCode).includes(error.code as PythonIntegrationErrorCode)) {
    throw new Error("Invalid response.error.code.");
  }
  if (!Object.values(PythonIntegrationErrorCategory).includes(error.category as PythonIntegrationErrorCategory)) {
    throw new Error("Invalid response.error.category.");
  }
  if (typeof error.retryable !== "boolean") {
    throw new Error("Invalid response.error.retryable: expected a boolean.");
  }
  const code = error.code as PythonIntegrationErrorCode;
  const expectations: Readonly<Record<PythonIntegrationErrorCode, {
    readonly category: PythonIntegrationErrorCategory;
    readonly retryable: boolean;
  }>> = {
    [PythonIntegrationErrorCode.ValidationError]: { category: PythonIntegrationErrorCategory.Validation, retryable: false },
    [PythonIntegrationErrorCode.UnsupportedContractVersion]: { category: PythonIntegrationErrorCategory.Compatibility, retryable: false },
    [PythonIntegrationErrorCode.UnknownOperation]: { category: PythonIntegrationErrorCategory.Compatibility, retryable: false },
    [PythonIntegrationErrorCode.DomainError]: { category: PythonIntegrationErrorCategory.Domain, retryable: false },
    [PythonIntegrationErrorCode.TransportError]: { category: PythonIntegrationErrorCategory.Transport, retryable: true },
    [PythonIntegrationErrorCode.Timeout]: { category: PythonIntegrationErrorCategory.Transport, retryable: true },
    [PythonIntegrationErrorCode.ProtocolError]: { category: PythonIntegrationErrorCategory.Protocol, retryable: false },
    [PythonIntegrationErrorCode.InternalError]: { category: PythonIntegrationErrorCategory.Internal, retryable: false },
  };
  const expectation = expectations[code];
  if (error.category !== expectation.category || error.retryable !== expectation.retryable) {
    throw new Error("Invalid response.error: code, category, and retryability are inconsistent.");
  }
  return {
    code,
    message: nonEmpty(error.message, "response.error.message"),
    category: error.category as PythonIntegrationErrorCategory,
    retryable: error.retryable,
    ...(error.details === undefined ? {} : { details: metadata(error.details, "response.error.details") }),
  };
}

export function validatePythonIntegrationResponse(
  value: unknown,
  request: Readonly<PythonIntegrationRequest>,
): PythonIntegrationResponse {
  const response = record(value, "response");
  const baseKeys = [
    "contractVersion", "requestId", "operation", "status", "completedAt", "warnings", "trace",
  ];
  if (response.status === PythonIntegrationStatus.Success) {
    exactKeys(response, [...baseKeys, "data"], "response");
  } else if (response.status === PythonIntegrationStatus.Failure) {
    exactKeys(response, [...baseKeys, "error"], "response");
  } else {
    throw new Error("Invalid response.status: unexpected status value.");
  }
  if (response.contractVersion !== PYTHON_INTEGRATION_CONTRACT_VERSION) {
    throw new Error("Invalid response.contractVersion.");
  }
  const responseRequestId = identifier(response.requestId, "response.requestId");
  if (responseRequestId !== request.requestId) {
    throw new Error("Invalid response.requestId: it must match the request.");
  }
  const responseOperation = nonEmpty(response.operation, "response.operation", 128);
  if (responseOperation !== request.operation) {
    throw new Error("Invalid response.operation: it must match the request.");
  }
  const trace = record(response.trace, "response.trace");
  exactKeys(trace, ["durationMs", "boundary", "transport"], "response.trace");
  if (trace.boundary !== "PYTHON_INTEGRATION" || trace.transport !== "LOCAL_SUBPROCESS") {
    throw new Error("Invalid response.trace: boundary metadata is inconsistent.");
  }
  const base = {
    contractVersion: PYTHON_INTEGRATION_CONTRACT_VERSION,
    requestId: responseRequestId,
    operation: responseOperation,
    completedAt: timestamp(response.completedAt, "response.completedAt"),
    warnings: stringArray(response.warnings, "response.warnings"),
    trace: {
      durationMs: nonNegativeInteger(trace.durationMs, "response.trace.durationMs"),
      boundary: "PYTHON_INTEGRATION" as const,
      transport: "LOCAL_SUBPROCESS" as const,
    },
  };
  if (response.status === PythonIntegrationStatus.Failure) {
    return { ...base, status: PythonIntegrationStatus.Failure, error: failure(response.error) };
  }
  return {
    ...base,
    operation: request.operation,
    status: PythonIntegrationStatus.Success,
    data: riskResult(response.data),
  };
}
