import {
  TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE,
  type TwelveDataCredentials,
} from "./TwelveDataContracts";
import {
  TWELVE_DATA_PERSONAL_MULS_REFERENCE_ENDPOINT,
  TwelveDataPersonalMulsReferenceError,
  TwelveDataPersonalMulsReferenceErrorCode,
  TwelveDataPersonalMulsReferenceResultCode,
  createTwelveDataPersonalMulsReferenceRequest,
  runTwelveDataPersonalMulsReferenceDiagnostic,
  validateTwelveDataPersonalMulsReferenceResponse,
  type TwelveDataPersonalMulsReferenceRequest,
  type TwelveDataPersonalMulsReferenceResponse,
  type TwelveDataPersonalMulsReferenceTransport,
} from "./TwelveDataPersonalMulsReferenceDiagnostic";

type Test = readonly [string, () => void | Promise<void>];
const tests: Test[] = [];
const test = (name: string, run: Test[1]): void => { tests.push([name, run]); };
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const equal = (actual: unknown, expected: unknown, message: string): void => {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`);
  }
};

const API_KEY = "test-twelve-data-key-123456";
const environment = Object.freeze({
  [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]: API_KEY,
  UNRELATED_SECRET: "must-not-be-copied",
});

function validBody(overrides: Readonly<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    result: {
      count: 1,
      list: [{
        symbol: "MULS",
        name: "GraniteShares 2x Short MU Daily ETF",
        country: "United States",
        mic_code: "XNAS",
        fund_family: "GraniteShares",
        fund_type: "Trading - Inverse Equity",
      }],
    },
    status: "ok",
    ...overrides,
  });
}

class FixtureTransport implements TwelveDataPersonalMulsReferenceTransport {
  public readonly kind = "FIXTURE_ONLY" as const;
  public readonly networkCapable = false as const;
  public calls = 0;
  public asserted = 0;
  public credentials?: TwelveDataCredentials;
  public response: TwelveDataPersonalMulsReferenceResponse = {
    statusCode: 200,
    receivedAt: "2026-07-27T02:00:00.000Z",
    body: validBody(),
  };
  public failure?: unknown;
  public readinessFailure?: unknown;

  public assertReady(request: Readonly<TwelveDataPersonalMulsReferenceRequest>): void {
    this.asserted += 1;
    if (this.readinessFailure !== undefined) throw this.readinessFailure;
    equal(request.endpoint, TWELVE_DATA_PERSONAL_MULS_REFERENCE_ENDPOINT, "endpoint");
  }

  public async execute(
    _request: Readonly<TwelveDataPersonalMulsReferenceRequest>,
    credentials: Readonly<TwelveDataCredentials>,
  ): Promise<TwelveDataPersonalMulsReferenceResponse> {
    this.calls += 1;
    this.credentials = credentials;
    if (this.failure !== undefined) throw this.failure;
    return this.response;
  }
}

test("planner freezes one exact GET and sorted query", () => {
  const request = createTwelveDataPersonalMulsReferenceRequest();
  equal(request.method, "GET", "method");
  equal(request.endpoint, TWELVE_DATA_PERSONAL_MULS_REFERENCE_ENDPOINT, "endpoint");
  equal(JSON.stringify(request.query), JSON.stringify([
    ["country", "US"], ["format", "JSON"], ["outputsize", "1"],
    ["page", "1"], ["symbol", "MULS"],
  ]), "query");
  equal(request.maxRequests, 1, "requests");
  equal(request.maxCredits, 1, "credits");
  equal(request.timeoutMs, 10_000, "timeout");
  equal(request.redirectsAllowed, false, "redirects");
  equal(request.retriesAllowed, false, "retries");
  equal(Object.isFrozen(request), true, "frozen");
});

test("exact US MULS ETF becomes one sanitized observation", () => {
  const result = validateTwelveDataPersonalMulsReferenceResponse(validBody());
  equal(result.resultCode, TwelveDataPersonalMulsReferenceResultCode.ReferenceConfirmed, "code");
  equal(result.observation?.symbol, "MULS", "symbol");
  equal(result.observation?.country, "US", "country");
  equal(result.observation?.micCode, "XNAS", "MIC");
  const serialized = JSON.stringify(result);
  assert(!serialized.includes("GraniteShares"), "name leaked");
  assert(!serialized.includes("fund_family"), "family leaked");
});

test("zero result becomes reference not found", () => {
  const result = validateTwelveDataPersonalMulsReferenceResponse(validBody({
    result: { count: 0, list: [] },
  }));
  equal(result.resultCode, TwelveDataPersonalMulsReferenceResultCode.ReferenceNotFound, "code");
});

test("multiple or inconsistent results are ambiguous", () => {
  const record = JSON.parse(validBody()).result.list[0];
  const multiple = validateTwelveDataPersonalMulsReferenceResponse(validBody({
    result: { count: 2, list: [record, record] },
  }));
  const mismatch = validateTwelveDataPersonalMulsReferenceResponse(validBody({
    result: { count: 1, list: [] },
  }));
  equal(multiple.resultCode, TwelveDataPersonalMulsReferenceResultCode.ReferenceAmbiguous, "multiple");
  equal(mismatch.resultCode, TwelveDataPersonalMulsReferenceResultCode.ReferenceAmbiguous, "mismatch");
});

test("wrong symbol country or MIC fails identity", () => {
  for (const field of [
    { symbol: "MU" },
    { country: "Canada" },
    { mic_code: "bad" },
  ]) {
    const record = { ...JSON.parse(validBody()).result.list[0], ...field };
    const result = validateTwelveDataPersonalMulsReferenceResponse(validBody({
      result: { count: 1, list: [record] },
    }));
    equal(result.resultCode,
      TwelveDataPersonalMulsReferenceResultCode.ReferenceIdentityMismatch, "identity");
  }
});

test("unknown null malformed and oversized response shapes fail closed", () => {
  const record = { ...JSON.parse(validBody()).result.list[0], orderSide: "BUY" };
  const bodies = [
    "not-json",
    JSON.stringify([]),
    validBody({ result: { count: 1, list: [record] } }),
    validBody({ result: { count: 1, list: [{ ...record, orderSide: undefined, name: null }] } }),
    "x".repeat(1_000_001),
  ];
  for (const body of bodies) {
    equal(validateTwelveDataPersonalMulsReferenceResponse(body).resultCode,
      TwelveDataPersonalMulsReferenceResultCode.ResponseInvalid, "invalid");
  }
});

test("provider error narrative is sanitized", () => {
  const secret = "provider-secret-narrative";
  const result = validateTwelveDataPersonalMulsReferenceResponse(JSON.stringify({
    status: "error", code: 400, message: secret,
  }));
  equal(result.resultCode, TwelveDataPersonalMulsReferenceResultCode.ProviderRejected, "code");
  assert(!JSON.stringify(result).includes(secret), "narrative leaked");
});

test("default dry run works without a transport and performs zero network", async () => {
  const result = await runTwelveDataPersonalMulsReferenceDiagnostic({
    confirmed: false, environment,
  });
  equal(result.mode, "DRY_RUN", "mode");
  equal(result.networkRequests, 0, "network");
  equal(result.persistenceWrites, 0, "writes");
  equal(result.tradingAuthority, false, "trading");
  assert(!JSON.stringify(result).includes(API_KEY), "credential leaked");
});

test("injected transport is not invoked in dry run", async () => {
  const transport = new FixtureTransport();
  await runTwelveDataPersonalMulsReferenceDiagnostic({
    confirmed: false, environment, transport,
  });
  equal(transport.asserted, 0, "readiness calls");
  equal(transport.calls, 0, "execute calls");
});

test("confirmed mode requires an injected transport", async () => {
  const error = await expectError({
    confirmed: true, environment,
  }, TwelveDataPersonalMulsReferenceErrorCode.MissingTransport);
  equal(error.attemptedNetworkRequests, 0, "attempts");
});

test("confirmed injected run executes exactly once and exposes no raw payload", async () => {
  const transport = new FixtureTransport();
  const result = await runTwelveDataPersonalMulsReferenceDiagnostic({
    confirmed: true, environment, transport,
  });
  equal(result.mode, "FIXTURE_REHEARSAL", "mode");
  equal(result.networkRequests, 0, "network");
  equal(result.transportInvocations, 1, "transport invocations");
  equal(result.validation?.resultCode,
    TwelveDataPersonalMulsReferenceResultCode.ReferenceConfirmed, "result");
  equal(transport.asserted, 1, "readiness");
  equal(transport.calls, 1, "calls");
  equal(transport.credentials?.revealForTransport(), API_KEY, "credential boundary");
  assert(!JSON.stringify(result).includes(API_KEY), "key leaked");
  assert(!JSON.stringify(result).includes("GraniteShares"), "payload leaked");
});

test("transport readiness failures are sanitized before execution", async () => {
  const transport = new FixtureTransport();
  transport.readinessFailure = new Error(`readiness ${API_KEY}`);
  const error = await expectError({
    confirmed: true, environment, transport,
  }, TwelveDataPersonalMulsReferenceErrorCode.InvalidInput);
  equal(error.attemptedNetworkRequests, 0, "attempts");
  equal(transport.asserted, 1, "readiness calls");
  equal(transport.calls, 0, "execute calls");
  assert(!JSON.stringify(error).includes(API_KEY), "readiness failure leaked");
});

test("transport and HTTP failures are sanitized and never retried", async () => {
  const transportFailure = new FixtureTransport();
  transportFailure.failure = new Error(`failure ${API_KEY}`);
  const first = await expectError({
    confirmed: true, environment, transport: transportFailure,
  }, TwelveDataPersonalMulsReferenceErrorCode.TransportFailure);
  equal(first.completedNetworkRequests, 0, "completed");
  equal(transportFailure.calls, 1, "transport calls");
  assert(!JSON.stringify(first).includes(API_KEY), "failure leaked");

  const httpFailure = new FixtureTransport();
  httpFailure.response = { ...httpFailure.response, statusCode: 429, body: API_KEY };
  const second = await expectError({
    confirmed: true, environment, transport: httpFailure,
  }, TwelveDataPersonalMulsReferenceErrorCode.HttpFailure);
  equal(second.completedNetworkRequests, 0, "HTTP completed");
  equal(httpFailure.calls, 1, "HTTP calls");
});

test("unknown operation authority fails before credential or transport", async () => {
  const transport = new FixtureTransport();
  await expectError({
    confirmed: true,
    environment,
    transport,
    order: "BUY",
  } as unknown as Parameters<typeof runTwelveDataPersonalMulsReferenceDiagnostic>[0],
  TwelveDataPersonalMulsReferenceErrorCode.InvalidInput);
  equal(transport.calls, 0, "calls");
});

test("result and nested values are deeply immutable", async () => {
  const result = await runTwelveDataPersonalMulsReferenceDiagnostic({
    confirmed: false, environment,
  });
  equal(Object.isFrozen(result), true, "result");
  equal(Object.isFrozen(result.credential), true, "credential");
  equal(Object.isFrozen(result.warnings), true, "warnings");
});

async function expectError(
  input: Parameters<typeof runTwelveDataPersonalMulsReferenceDiagnostic>[0],
  code: TwelveDataPersonalMulsReferenceErrorCode,
): Promise<TwelveDataPersonalMulsReferenceError> {
  try {
    await runTwelveDataPersonalMulsReferenceDiagnostic(input);
  } catch (error) {
    assert(error instanceof TwelveDataPersonalMulsReferenceError, "typed error");
    equal(error.safeCode, code, "safe code");
    return error;
  }
  throw new Error("Expected diagnostic failure.");
}

async function runTests(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    try {
      await run();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }
  console.log(`Twelve Data MULS reference diagnostic tests: ${passed}/${tests.length} passed.`);
}

void runTests();
