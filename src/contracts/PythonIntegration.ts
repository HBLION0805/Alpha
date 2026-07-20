export const PYTHON_INTEGRATION_CONTRACT_VERSION = "1.0" as const;

export const PythonIntegrationOperation = {
  CalculateRiskLimits: "risk.calculate_limits",
} as const;

export type PythonIntegrationOperation =
  (typeof PythonIntegrationOperation)[keyof typeof PythonIntegrationOperation];

export const PythonIntegrationStatus = {
  Success: "SUCCESS",
  Failure: "FAILURE",
} as const;

export type PythonIntegrationStatus =
  (typeof PythonIntegrationStatus)[keyof typeof PythonIntegrationStatus];

export const PythonIntegrationErrorCode = {
  ValidationError: "VALIDATION_ERROR",
  UnsupportedContractVersion: "UNSUPPORTED_CONTRACT_VERSION",
  UnknownOperation: "UNKNOWN_OPERATION",
  DomainError: "DOMAIN_ERROR",
  TransportError: "TRANSPORT_ERROR",
  Timeout: "TIMEOUT",
  ProtocolError: "PROTOCOL_ERROR",
  InternalError: "INTERNAL_ERROR",
} as const;

export type PythonIntegrationErrorCode =
  (typeof PythonIntegrationErrorCode)[keyof typeof PythonIntegrationErrorCode];

export const PythonIntegrationErrorCategory = {
  Validation: "VALIDATION",
  Compatibility: "COMPATIBILITY",
  Domain: "DOMAIN",
  Transport: "TRANSPORT",
  Protocol: "PROTOCOL",
  Internal: "INTERNAL",
} as const;

export type PythonIntegrationErrorCategory =
  (typeof PythonIntegrationErrorCategory)[keyof typeof PythonIntegrationErrorCategory];

export interface CalculateRiskLimitsPayload {
  readonly totalCapital: number;
}

export interface CalculateRiskLimitsResult {
  readonly maximumTotalPosition: number;
  readonly minimumCashReserve: number;
  readonly maximumDailyLoss: number;
  readonly maximumSingleTrade: number;
}

export interface PythonIntegrationOperationMap {
  readonly [PythonIntegrationOperation.CalculateRiskLimits]: {
    readonly payload: CalculateRiskLimitsPayload;
    readonly result: CalculateRiskLimitsResult;
  };
}

export type PythonIntegrationPayload<
  Operation extends PythonIntegrationOperation,
> = PythonIntegrationOperationMap[Operation]["payload"];

export type PythonIntegrationResult<
  Operation extends PythonIntegrationOperation,
> = PythonIntegrationOperationMap[Operation]["result"];

export type PythonIntegrationMetadata = Readonly<Record<string, string>>;

export interface PythonIntegrationRequest<
  Operation extends PythonIntegrationOperation = PythonIntegrationOperation,
> {
  readonly contractVersion: typeof PYTHON_INTEGRATION_CONTRACT_VERSION;
  readonly requestId: string;
  readonly operation: Operation;
  readonly requestedAt: string;
  readonly payload: PythonIntegrationPayload<Operation>;
  readonly metadata?: PythonIntegrationMetadata;
}

export interface PythonIntegrationTraceMetadata {
  readonly durationMs: number;
  readonly boundary: "PYTHON_INTEGRATION";
  readonly transport: "LOCAL_SUBPROCESS";
}

interface PythonIntegrationResponseBase {
  readonly contractVersion: typeof PYTHON_INTEGRATION_CONTRACT_VERSION;
  readonly requestId: string;
  readonly operation: string;
  readonly status: PythonIntegrationStatus;
  readonly completedAt: string;
  readonly warnings: ReadonlyArray<string>;
  readonly trace: PythonIntegrationTraceMetadata;
}

export interface PythonIntegrationSuccessResponse<
  Operation extends PythonIntegrationOperation = PythonIntegrationOperation,
> extends PythonIntegrationResponseBase {
  readonly operation: Operation;
  readonly status: "SUCCESS";
  readonly data: PythonIntegrationResult<Operation>;
}

export interface PythonIntegrationFailure {
  readonly code: PythonIntegrationErrorCode;
  readonly message: string;
  readonly category: PythonIntegrationErrorCategory;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, string>>;
}

export interface PythonIntegrationFailureResponse
  extends PythonIntegrationResponseBase {
  readonly status: "FAILURE";
  readonly error: PythonIntegrationFailure;
}

export type PythonIntegrationResponse<
  Operation extends PythonIntegrationOperation = PythonIntegrationOperation,
> =
  | PythonIntegrationSuccessResponse<Operation>
  | PythonIntegrationFailureResponse;

export interface PythonIntegrationRequestContext {
  readonly requestId: string;
  readonly requestedAt: string;
  readonly metadata?: PythonIntegrationMetadata;
}

export interface PythonIntegrationTransport {
  send(request: Readonly<PythonIntegrationRequest>): unknown;
}

export interface PythonIntegrationClient {
  execute<Operation extends PythonIntegrationOperation>(
    operation: Operation,
    payload: Readonly<PythonIntegrationPayload<Operation>>,
    context: Readonly<PythonIntegrationRequestContext>,
  ): PythonIntegrationSuccessResponse<Operation>;
}
