import {
  TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE,
  type TwelveDataCredentials,
} from "./TwelveDataContracts";
import {
  TwelveDataPersonalMulsReferenceResultCode,
  createTwelveDataPersonalMulsReferenceRequestFingerprint,
  type TwelveDataPersonalMulsReferenceRequest,
  type TwelveDataPersonalMulsReferenceResponse,
} from "./TwelveDataPersonalMulsReferenceDiagnostic";
import {
  TwelveDataPersonalMulsReferenceTransportError,
  TwelveDataPersonalMulsReferenceTransportErrorCode,
  type TwelveDataPersonalMulsReferenceLiveTransport,
} from "./TwelveDataPersonalMulsReferenceHttpsTransport";
import {
  TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION,
  TwelveDataPersonalMulsReferenceLiveError,
  TwelveDataPersonalMulsReferenceLiveErrorCode,
  runTwelveDataPersonalMulsReferenceLiveOperation,
} from "./TwelveDataPersonalMulsReferenceLiveOperation";

type Test = readonly [string, () => Promise<void>];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `${message}: expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

const API_KEY = "test-reference-operation-key";
const environment = Object.freeze({
  [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]: API_KEY,
  UNRELATED_SECRET: "must-not-cross",
});
const NOW = "2026-07-27T14:30:00.000Z";
const fingerprint =
  createTwelveDataPersonalMulsReferenceRequestFingerprint();
const authorization = Object.freeze({
  confirmation: TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION,
  operationDateUtc: "2026-07-27",
  requestFingerprint: fingerprint,
});

class LiveFixtureTransport
implements TwelveDataPersonalMulsReferenceLiveTransport {
  public readonly kind = "LIVE_HTTPS" as const;
  public readonly networkCapable = true as const;
  public asserted = 0;
  public calls = 0;
  public credentials?: TwelveDataCredentials;
  public response: TwelveDataPersonalMulsReferenceResponse = {
    statusCode: 200,
    receivedAt: NOW,
    body: JSON.stringify({
      result: {
        count: 1,
        list: [{
          symbol: "MULS",
          name: "Sensitive fund name",
          country: "United States",
          mic_code: "XNAS",
          fund_family: "Sensitive family",
          fund_type: "Sensitive type",
        }],
      },
      status: "ok",
    }),
  };
  public failure?: unknown;
  public readinessFailure?: unknown;

  public assertReady(
    _request: Readonly<TwelveDataPersonalMulsReferenceRequest>,
  ): void {
    this.asserted += 1;
    if (this.readinessFailure !== undefined) throw this.readinessFailure;
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

function base(transport: LiveFixtureTransport) {
  return {
    confirmed: false,
    environment,
    transport,
    clock: { now: () => NOW },
  } as const;
}

test("default dry run validates readiness and performs zero execution", async () => {
  const transport = new LiveFixtureTransport();
  const result = await runTwelveDataPersonalMulsReferenceLiveOperation(
    base(transport),
  );
  equal(result.mode, "DRY_RUN", "mode");
  equal(result.requestFingerprint, fingerprint, "fingerprint");
  equal(result.networkRequests, 0, "network");
  equal(transport.asserted, 1, "readiness");
  equal(transport.calls, 0, "calls");
  assert(!JSON.stringify(result).includes(API_KEY), "credential leaked");
});

test("missing credential blocks before readiness or execution", async () => {
  const transport = new LiveFixtureTransport();
  try {
    await runTwelveDataPersonalMulsReferenceLiveOperation({
      ...base(transport),
      environment: {},
    });
    throw new Error("Expected missing credential.");
  } catch (error) {
    assert(error instanceof Error, "error");
  }
  equal(transport.asserted, 0, "readiness");
  equal(transport.calls, 0, "calls");
});

test("confirmation without exact authorization fails before execution", async () => {
  for (const candidate of [
    undefined,
    { ...authorization, operationDateUtc: "2026-07-26" },
    { ...authorization, requestFingerprint:
      "twelve-data-muls-reference:0000000000000000" },
    { ...authorization, confirmation: "YES" },
    { ...authorization, order: "BUY" },
  ]) {
    const transport = new LiveFixtureTransport();
    await expectLiveError({
      ...base(transport),
      confirmed: true,
      ...(candidate === undefined ? {} : { authorization: candidate }),
    } as Parameters<
      typeof runTwelveDataPersonalMulsReferenceLiveOperation
    >[0], TwelveDataPersonalMulsReferenceLiveErrorCode.InvalidAuthorization);
    equal(transport.calls, 0, "calls");
  }
});

test("exact authorization executes once and returns sanitized identity", async () => {
  const transport = new LiveFixtureTransport();
  const result = await runTwelveDataPersonalMulsReferenceLiveOperation({
    ...base(transport),
    confirmed: true,
    authorization,
  });
  equal(result.mode, "LIVE_READ", "mode");
  equal(result.authorizationState, "VALID", "authorization");
  equal(result.networkRequests, 1, "network");
  equal(result.completedNetworkRequests, 1, "completed");
  equal(result.validation?.resultCode,
    TwelveDataPersonalMulsReferenceResultCode.ReferenceConfirmed, "result");
  equal(result.validation?.observation?.micCode, "XNAS", "MIC");
  equal(transport.calls, 1, "calls");
  equal(transport.credentials?.revealForTransport(), API_KEY, "credential");
  const serialized = JSON.stringify(result);
  assert(!serialized.includes(API_KEY), "credential leaked");
  assert(!serialized.includes("Sensitive"), "raw provider data leaked");
});

test("not-found response is a completed sanitized observation", async () => {
  const transport = new LiveFixtureTransport();
  transport.response = {
    ...transport.response,
    body: JSON.stringify({ status: "ok", result: { count: 0, list: [] } }),
  };
  const result = await runTwelveDataPersonalMulsReferenceLiveOperation({
    ...base(transport),
    confirmed: true,
    authorization,
  });
  equal(result.validation?.resultCode,
    TwelveDataPersonalMulsReferenceResultCode.ReferenceNotFound, "result");
  equal(result.validatedResponses, 1, "validated");
});

test("malformed response fails closed without raw payload", async () => {
  const transport = new LiveFixtureTransport();
  transport.response = { ...transport.response, body: `invalid ${API_KEY}` };
  const result = await runTwelveDataPersonalMulsReferenceLiveOperation({
    ...base(transport),
    confirmed: true,
    authorization,
  });
  equal(result.validation?.resultCode,
    TwelveDataPersonalMulsReferenceResultCode.ResponseInvalid, "result");
  equal(result.validatedResponses, 0, "validated");
  assert(!JSON.stringify(result).includes(API_KEY), "payload leaked");
});

test("transport failures preserve bounded request accounting", async () => {
  const cases = [
    [
      TwelveDataPersonalMulsReferenceTransportErrorCode.Timeout,
      TwelveDataPersonalMulsReferenceLiveErrorCode.Timeout,
      0,
    ],
    [
      TwelveDataPersonalMulsReferenceTransportErrorCode.HttpFailure,
      TwelveDataPersonalMulsReferenceLiveErrorCode.HttpFailure,
      1,
    ],
    [
      TwelveDataPersonalMulsReferenceTransportErrorCode.ResponseTooLarge,
      TwelveDataPersonalMulsReferenceLiveErrorCode.ResponseTooLarge,
      1,
    ],
  ] as const;
  for (const [transportCode, liveCode, completed] of cases) {
    const transport = new LiveFixtureTransport();
    transport.failure =
      new TwelveDataPersonalMulsReferenceTransportError(transportCode, 429);
    const error = await expectLiveError({
      ...base(transport),
      confirmed: true,
      authorization,
    }, liveCode);
    equal(error.attemptedNetworkRequests, 1, "attempted");
    equal(error.completedNetworkRequests, completed, "completed");
    equal(transport.calls, 1, "calls");
  }
});

test("unknown transport and readiness failures are sanitized", async () => {
  const executeTransport = new LiveFixtureTransport();
  executeTransport.failure = new Error(`unsafe ${API_KEY}`);
  const first = await expectLiveError({
    ...base(executeTransport),
    confirmed: true,
    authorization,
  }, TwelveDataPersonalMulsReferenceLiveErrorCode.NetworkFailure);
  assert(!JSON.stringify(first).includes(API_KEY), "execute error leaked");

  const readyTransport = new LiveFixtureTransport();
  readyTransport.readinessFailure = new Error(`unsafe ${API_KEY}`);
  const second = await expectLiveError({
    ...base(readyTransport),
    confirmed: true,
    authorization,
  }, TwelveDataPersonalMulsReferenceLiveErrorCode.InvalidConfiguration);
  equal(readyTransport.calls, 0, "readiness execution");
  assert(!JSON.stringify(second).includes(API_KEY), "readiness error leaked");
});

test("fixture-only substitution is rejected before invocation", async () => {
  const fixture = {
    kind: "FIXTURE_ONLY",
    networkCapable: false,
    assertReady: () => undefined,
    execute: () => {
      throw new Error("must not run");
    },
  };
  await expectLiveError({
    confirmed: false,
    environment,
    transport: fixture,
    clock: { now: () => NOW },
  } as unknown as Parameters<
    typeof runTwelveDataPersonalMulsReferenceLiveOperation
  >[0], TwelveDataPersonalMulsReferenceLiveErrorCode.InvalidConfiguration);
});

test("summary and nested authorization evidence are immutable", async () => {
  const transport = new LiveFixtureTransport();
  const result = await runTwelveDataPersonalMulsReferenceLiveOperation({
    ...base(transport),
    confirmed: true,
    authorization,
  });
  equal(Object.isFrozen(result), true, "result");
  equal(Object.isFrozen(result.validation), true, "validation");
  equal(Object.isFrozen(result.warnings), true, "warnings");
});

async function expectLiveError(
  input: Parameters<
    typeof runTwelveDataPersonalMulsReferenceLiveOperation
  >[0],
  expected: TwelveDataPersonalMulsReferenceLiveErrorCode,
): Promise<TwelveDataPersonalMulsReferenceLiveError> {
  try {
    await runTwelveDataPersonalMulsReferenceLiveOperation(input);
  } catch (error) {
    assert(error instanceof TwelveDataPersonalMulsReferenceLiveError,
      "typed live error");
    equal(error.safeCode, expected, "safe code");
    return error;
  }
  throw new Error("Expected live operation failure.");
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
  console.log(
    `Twelve Data MULS reference live-operation tests: ${passed}/${tests.length} passed.`,
  );
}

void runTests();
