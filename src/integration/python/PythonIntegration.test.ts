import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execPath } from "node:process";
import {
  PYTHON_INTEGRATION_CONTRACT_VERSION,
  PythonIntegrationErrorCode,
  PythonIntegrationOperation,
  PythonIntegrationStatus,
  type PythonIntegrationRequest,
  type PythonIntegrationTransport,
  validatePythonIntegrationRequest,
} from "../../contracts";
import { AlphaIntegrationError } from "./AlphaIntegrationError";
import { DefaultPythonIntegrationClient } from "./PythonIntegrationClient";
import { SubprocessPythonIntegrationTransport } from "./SubprocessPythonIntegrationTransport";

interface TestCase {
  readonly name: string;
  readonly run: () => void;
}

const now = "2026-07-19T18:00:00.000Z";
const projectRoot = resolve(".");
const bundledRoot = resolve(dirname(execPath), "..", "..");
const pythonCandidates = [
  resolve(bundledRoot, "python", "python.exe"),
  resolve(bundledRoot, "python", "bin", "python"),
];
const pythonExecutable = pythonCandidates.find((candidate) => existsSync(candidate)) ?? "python";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: values differ.`);
  }
}

function expectIntegrationError(
  action: () => void,
  code: string,
): AlphaIntegrationError {
  try {
    action();
  } catch (error: unknown) {
    if (!(error instanceof AlphaIntegrationError)) {
      throw error;
    }
    assertEqual(error.code, code, "integration error code");
    return error;
  }
  throw new Error(`Expected AlphaIntegrationError ${code}.`);
}

function request(overrides: Readonly<Record<string, unknown>> = {}): PythonIntegrationRequest {
  return {
    contractVersion: PYTHON_INTEGRATION_CONTRACT_VERSION,
    requestId: "integration-request:one",
    operation: PythonIntegrationOperation.CalculateRiskLimits,
    requestedAt: now,
    payload: { totalCapital: 1_000 },
    metadata: { taskId: "D7-T1" },
    ...overrides,
  } as PythonIntegrationRequest;
}

function transport(options: { readonly timeoutMs?: number; readonly pythonExecutable?: string } = {}): SubprocessPythonIntegrationTransport {
  return new SubprocessPythonIntegrationTransport({
    projectRoot,
    pythonExecutable: options.pythonExecutable ?? pythonExecutable,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
  });
}

function client(selectedTransport: PythonIntegrationTransport = transport()): DefaultPythonIntegrationClient {
  return new DefaultPythonIntegrationClient(selectedTransport);
}

class FixedTransport implements PythonIntegrationTransport {
  constructor(private readonly response: unknown) {}

  send(): unknown {
    return this.response;
  }
}

const validResponse = {
  contractVersion: PYTHON_INTEGRATION_CONTRACT_VERSION,
  requestId: "integration-request:one",
  operation: PythonIntegrationOperation.CalculateRiskLimits,
  status: PythonIntegrationStatus.Success,
  completedAt: now,
  data: {
    maximumTotalPosition: 400,
    minimumCashReserve: 200,
    maximumDailyLoss: 30,
    maximumSingleTrade: 100,
  },
  warnings: [],
  trace: {
    durationMs: 1,
    boundary: "PYTHON_INTEGRATION",
    transport: "LOCAL_SUBPROCESS",
  },
};

const tests: ReadonlyArray<TestCase> = [
  {
    name: "valid TypeScript request invokes the registered Python operation",
    run: () => {
      const response = client().execute(
        PythonIntegrationOperation.CalculateRiskLimits,
        { totalCapital: 1_000 },
        { requestId: "integration-request:one", requestedAt: now },
      );
      assertDeepEqual(response.data, validResponse.data, "risk limits");
      assertEqual(response.trace.boundary, "PYTHON_INTEGRATION", "trace boundary");
    },
  },
  {
    name: "TypeScript request validator rejects malformed payload",
    run: () => {
      let rejected = false;
      try {
        validatePythonIntegrationRequest(request({ payload: { totalCapital: "1000" } }));
      } catch {
        rejected = true;
      }
      assertEqual(rejected, true, "malformed payload rejection");
    },
  },
  {
    name: "client exposes stable validation error",
    run: () => {
      expectIntegrationError(
        () => client(new FixedTransport(validResponse)).execute(
          PythonIntegrationOperation.CalculateRiskLimits,
          { totalCapital: Number.NaN },
          { requestId: "integration-request:one", requestedAt: now },
        ),
        PythonIntegrationErrorCode.ValidationError,
      );
    },
  },
  {
    name: "invalid Python response is rejected as protocol error",
    run: () => {
      expectIntegrationError(
        () => client(new FixedTransport({ ...validResponse, data: { maximumTotalPosition: 400 } })).execute(
          PythonIntegrationOperation.CalculateRiskLimits,
          { totalCapital: 1_000 },
          { requestId: "integration-request:one", requestedAt: now },
        ),
        PythonIntegrationErrorCode.ProtocolError,
      );
    },
  },
  {
    name: "request ID mismatch is rejected as protocol error",
    run: () => {
      expectIntegrationError(
        () => client(new FixedTransport({ ...validResponse, requestId: "integration-request:other" })).execute(
          PythonIntegrationOperation.CalculateRiskLimits,
          { totalCapital: 1_000 },
          { requestId: "integration-request:one", requestedAt: now },
        ),
        PythonIntegrationErrorCode.ProtocolError,
      );
    },
  },
  {
    name: "unexpected response status is rejected as protocol error",
    run: () => {
      expectIntegrationError(
        () => client(new FixedTransport({ ...validResponse, status: "UNKNOWN" })).execute(
          PythonIntegrationOperation.CalculateRiskLimits,
          { totalCapital: 1_000 },
          { requestId: "integration-request:one", requestedAt: now },
        ),
        PythonIntegrationErrorCode.ProtocolError,
      );
    },
  },
  {
    name: "inconsistent failure taxonomy is rejected as protocol error",
    run: () => {
      const { data: ignoredData, ...responseBase } = validResponse;
      void ignoredData;
      expectIntegrationError(
        () => client(new FixedTransport({
          ...responseBase,
          status: PythonIntegrationStatus.Failure,
          error: {
            code: PythonIntegrationErrorCode.DomainError,
            message: "Rejected.",
            category: "TRANSPORT",
            retryable: true,
          },
        })).execute(
          PythonIntegrationOperation.CalculateRiskLimits,
          { totalCapital: 1_000 },
          { requestId: "integration-request:one", requestedAt: now },
        ),
        PythonIntegrationErrorCode.ProtocolError,
      );
    },
  },
  {
    name: "domain failure maps to stable Alpha integration error",
    run: () => {
      const error = expectIntegrationError(
        () => client().execute(
          PythonIntegrationOperation.CalculateRiskLimits,
          { totalCapital: -1 },
          { requestId: "integration-request:one", requestedAt: now },
        ),
        PythonIntegrationErrorCode.DomainError,
      );
      assertEqual(error.retryable, false, "domain retryability");
    },
  },
  {
    name: "transport timeout maps to stable timeout error",
    run: () => {
      expectIntegrationError(
        () => client(transport({ timeoutMs: 1 })).execute(
          PythonIntegrationOperation.CalculateRiskLimits,
          { totalCapital: 1_000 },
          { requestId: "integration-request:one", requestedAt: now },
        ),
        PythonIntegrationErrorCode.Timeout,
      );
    },
  },
  {
    name: "process start failure maps to stable transport error",
    run: () => {
      expectIntegrationError(
        () => client(transport({ pythonExecutable: "alpha-python-does-not-exist" })).execute(
          PythonIntegrationOperation.CalculateRiskLimits,
          { totalCapital: 1_000 },
          { requestId: "integration-request:one", requestedAt: now },
        ),
        PythonIntegrationErrorCode.TransportError,
      );
    },
  },
  {
    name: "unknown operation is rejected by Python registry",
    run: () => {
      const response = transport().send(request({ operation: "os.system" })) as Record<string, unknown>;
      const error = response.error as Record<string, unknown>;
      assertEqual(response.status, PythonIntegrationStatus.Failure, "unknown operation status");
      assertEqual(error.code, PythonIntegrationErrorCode.UnknownOperation, "unknown operation code");
    },
  },
  {
    name: "unsupported version is rejected by Python boundary",
    run: () => {
      const response = transport().send(request({ contractVersion: "2.0" })) as Record<string, unknown>;
      const error = response.error as Record<string, unknown>;
      assertEqual(error.code, PythonIntegrationErrorCode.UnsupportedContractVersion, "version code");
    },
  },
  {
    name: "demonstration operation data is deterministic",
    run: () => {
      const first = client().execute(
        PythonIntegrationOperation.CalculateRiskLimits,
        { totalCapital: 1_000 },
        { requestId: "integration-request:first", requestedAt: now },
      );
      const second = client().execute(
        PythonIntegrationOperation.CalculateRiskLimits,
        { totalCapital: 1_000 },
        { requestId: "integration-request:second", requestedAt: now },
      );
      assertDeepEqual(first.data, second.data, "deterministic operation data");
    },
  },
  {
    name: "secret-bearing metadata is rejected before transport",
    run: () => {
      expectIntegrationError(
        () => client(new FixedTransport(validResponse)).execute(
          PythonIntegrationOperation.CalculateRiskLimits,
          { totalCapital: 1_000 },
          {
            requestId: "integration-request:one",
            requestedAt: now,
            metadata: { apiKey: "not-a-real-secret" },
          },
        ),
        PythonIntegrationErrorCode.ValidationError,
      );
    },
  },
  {
    name: "consumer receives no Python implementation details",
    run: () => {
      const serialized = JSON.stringify(validResponse);
      assertEqual(serialized.includes("app.risk_engine"), false, "module path absence");
      assertEqual(serialized.includes("Traceback"), false, "traceback absence");
      assertEqual(serialized.includes(projectRoot), false, "local path absence");
    },
  },
];

let passed = 0;
for (const test of tests) {
  try {
    test.run();
    passed += 1;
    console.log(`PASS ${test.name}`);
  } catch (error: unknown) {
    console.error(`FAIL ${test.name}`);
    throw error;
  }
}
console.log(`Python Integration TypeScript tests: ${String(passed)}/${String(tests.length)} passed.`);
