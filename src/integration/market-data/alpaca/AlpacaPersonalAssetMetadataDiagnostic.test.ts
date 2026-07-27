import {
  ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE,
  ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE,
  type AlpacaCredentials,
} from "./AlpacaPersonalMarketDataContracts";
import {
  ALPACA_PERSONAL_MULS_ASSET_CONFIRMATION_FLAG,
  AlpacaPersonalAssetMetadataCommandError,
  createAlpacaPersonalAssetMetadataCommandInput,
  parseAlpacaPersonalAssetMetadataCommandArguments,
} from "./AlpacaPersonalAssetMetadataCommand";
import {
  ALPACA_PERSONAL_MULS_ASSET_ENDPOINT,
  AlpacaPersonalAssetMetadataClassification,
  AlpacaPersonalAssetMetadataError,
  AlpacaPersonalAssetMetadataErrorCode,
  createAlpacaPersonalMulsAssetMetadataRequest,
  runAlpacaPersonalMulsAssetMetadataDiagnostic,
  validateAlpacaPersonalMulsAssetMetadataResponse,
  type AlpacaPersonalAssetMetadataRequest,
  type AlpacaPersonalAssetMetadataResponse,
  type AlpacaPersonalAssetMetadataTransport,
} from "./AlpacaPersonalAssetMetadataDiagnostic";

type Test = readonly [string, () => void | Promise<void>];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`);
}

const KEY_ID = "PKTESTKEY123456";
const SECRET_KEY = "test-secret-key-123456789";
const environment = Object.freeze({
  [ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE]: KEY_ID,
  [ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE]: SECRET_KEY,
});

function validBody(overrides: Readonly<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    id: "123e4567-e89b-42d3-a456-426614174000",
    class: "us_equity",
    exchange: "NASDAQ",
    symbol: "MULS",
    name: "GraniteShares 2x Short MU Daily ETF",
    status: "active",
    tradable: true,
    marginable: true,
    maintenance_margin_requirement: 30,
    shortable: true,
    easy_to_borrow: false,
    fractionable: false,
    attributes: [],
    borrow_status: "hard_to_borrow",
    ...overrides,
  });
}

class FixtureTransport implements AlpacaPersonalAssetMetadataTransport {
  public calls = 0;
  public response: AlpacaPersonalAssetMetadataResponse = {
    statusCode: 200,
    receivedAt: "2026-07-26T22:00:00.000Z",
    body: validBody(),
  };
  public failure?: unknown;
  public request?: Readonly<AlpacaPersonalAssetMetadataRequest>;

  public assertReady(request: Readonly<AlpacaPersonalAssetMetadataRequest>): void {
    if (request.endpoint !== ALPACA_PERSONAL_MULS_ASSET_ENDPOINT) throw new Error("unready");
  }

  public async execute(
    request: Readonly<AlpacaPersonalAssetMetadataRequest>,
    _credentials: Readonly<AlpacaCredentials>,
  ): Promise<AlpacaPersonalAssetMetadataResponse> {
    this.calls += 1;
    this.request = request;
    if (this.failure !== undefined) throw this.failure;
    return this.response;
  }
}

test("planner fixes one GET request to the exact Paper asset endpoint", () => {
  const request = createAlpacaPersonalMulsAssetMetadataRequest();
  equal(request.method, "GET", "method");
  equal(request.endpoint, ALPACA_PERSONAL_MULS_ASSET_ENDPOINT, "endpoint");
  equal(request.query.length, 0, "query count");
  equal(request.bodyAllowed, false, "body authority");
  equal(request.timeoutMs, 10_000, "timeout");
  equal(request.maxResponseBytes, 65_536, "response bound");
  assert(Object.isFrozen(request), "request frozen");
});

test("valid active NMS asset becomes one sanitized observation", () => {
  const result = validateAlpacaPersonalMulsAssetMetadataResponse(validBody());
  assert(result !== undefined, "validated result");
  equal(result.classification, AlpacaPersonalAssetMetadataClassification.ActiveTradableNms, "classification");
  equal(result.exchange, "NASDAQ", "exchange");
  const serialized = JSON.stringify(result);
  assert(!serialized.includes("123e4567"), "asset id exposed");
  assert(!serialized.includes("marginable"), "discarded fields exposed");
  assert(Object.isFrozen(result), "observation frozen");
});

test("inactive nontradable and OTC assets classify without overclaim", () => {
  const inactive = validateAlpacaPersonalMulsAssetMetadataResponse(validBody({ status: "inactive", tradable: false }));
  const otc = validateAlpacaPersonalMulsAssetMetadataResponse(validBody({ exchange: "OTC", tradable: true }));
  equal(inactive?.classification, AlpacaPersonalAssetMetadataClassification.Inactive, "inactive");
  equal(otc?.classification, AlpacaPersonalAssetMetadataClassification.OtcUnsupported, "OTC");
});

test("active nontradable NMS asset remains explicit", () => {
  const result = validateAlpacaPersonalMulsAssetMetadataResponse(validBody({ tradable: false }));
  equal(result?.classification, AlpacaPersonalAssetMetadataClassification.ActiveNonTradableNms, "classification");
});

test("symbol substitution and unknown fields fail closed", () => {
  equal(validateAlpacaPersonalMulsAssetMetadataResponse(validBody({ symbol: "MU" })), undefined, "symbol");
  equal(validateAlpacaPersonalMulsAssetMetadataResponse(validBody({ orderSide: "BUY" })), undefined, "unknown field");
});

test("malformed optional fields and oversized responses fail closed", () => {
  equal(validateAlpacaPersonalMulsAssetMetadataResponse(validBody({ attributes: ["bad attribute!"] })), undefined, "attributes");
  equal(validateAlpacaPersonalMulsAssetMetadataResponse("x".repeat(65_537)), undefined, "size");
  equal(validateAlpacaPersonalMulsAssetMetadataResponse("not-json"), undefined, "JSON");
});

test("default diagnostic remains zero-network dry run", async () => {
  const transport = new FixtureTransport();
  const result = await runAlpacaPersonalMulsAssetMetadataDiagnostic({ confirmed: false, environment, transport });
  equal(result.mode, "DRY_RUN", "mode");
  equal(result.networkRequests, 0, "network requests");
  equal(transport.calls, 0, "transport calls");
  equal(result.persistenceWrites, 0, "persistence writes");
  equal(result.tradingAuthority, false, "trading authority");
  assert(!JSON.stringify(result).includes(SECRET_KEY), "secret leaked");
});

test("confirmed injected run executes once and returns no raw payload", async () => {
  const transport = new FixtureTransport();
  const result = await runAlpacaPersonalMulsAssetMetadataDiagnostic({ confirmed: true, environment, transport });
  equal(result.mode, "LIVE_READ", "mode");
  equal(result.networkRequests, 1, "network requests");
  equal(result.validatedResponses, 1, "validated responses");
  equal(transport.calls, 1, "transport calls");
  equal(result.rawPayloadExposed, false, "raw payload");
  assert(!JSON.stringify(result).includes("123e4567"), "raw body leaked");
});

test("404 becomes sanitized asset-not-found and is never retried", async () => {
  const transport = new FixtureTransport();
  transport.failure = { statusCode: 404, body: SECRET_KEY };
  const error = await expectDiagnosticFailure(transport, AlpacaPersonalAssetMetadataErrorCode.AssetNotFound);
  equal(transport.calls, 1, "transport calls");
  assert(!JSON.stringify(error).includes(SECRET_KEY), "failure leaked");
});

test("invalid provider response stops after one request", async () => {
  const transport = new FixtureTransport();
  transport.response = { ...transport.response, body: validBody({ symbol: "MULL" }) };
  await expectDiagnosticFailure(transport, AlpacaPersonalAssetMetadataErrorCode.ResponseInvalid);
  equal(transport.calls, 1, "transport calls");
});

test("unknown operation authority fails before transport", async () => {
  const transport = new FixtureTransport();
  try {
    await runAlpacaPersonalMulsAssetMetadataDiagnostic({
      confirmed: true, environment, transport, order: "BUY",
    } as unknown as Parameters<typeof runAlpacaPersonalMulsAssetMetadataDiagnostic>[0]);
    throw new Error("Expected failure.");
  } catch (error) {
    assert(error instanceof AlpacaPersonalAssetMetadataError, "typed error");
    equal(error.safeCode, AlpacaPersonalAssetMetadataErrorCode.InvalidRequest, "code");
  }
  equal(transport.calls, 0, "transport calls");
});

test("command is dry by default and accepts one exact confirmation", () => {
  equal(parseAlpacaPersonalAssetMetadataCommandArguments([]).confirmed, false, "dry run");
  equal(parseAlpacaPersonalAssetMetadataCommandArguments([
    ALPACA_PERSONAL_MULS_ASSET_CONFIRMATION_FLAG,
  ]).confirmed, true, "confirmed");
});

test("unknown duplicate or substituted flags fail closed", () => {
  expectCommandFailure(["--confirm-alpaca-live-read"]);
  expectCommandFailure([
    ALPACA_PERSONAL_MULS_ASSET_CONFIRMATION_FLAG,
    ALPACA_PERSONAL_MULS_ASSET_CONFIRMATION_FLAG,
  ]);
  expectCommandFailure(["--symbol=MULL"]);
});

test("command copies only the two declared credentials", () => {
  const input = createAlpacaPersonalAssetMetadataCommandInput(
    { confirmed: false },
    { ...environment, UNRELATED_SECRET: "must-not-cross" },
  );
  assert(input.environment !== undefined, "environment");
  equal(Object.keys(input.environment).length, 2, "environment key count");
  assert(!JSON.stringify(input).includes("must-not-cross"), "unrelated environment leaked");
  assert(Object.isFrozen(input), "input frozen");
  assert(Object.isFrozen(input.environment), "environment frozen");
});

async function expectDiagnosticFailure(
  transport: FixtureTransport,
  expected: AlpacaPersonalAssetMetadataErrorCode,
): Promise<AlpacaPersonalAssetMetadataError> {
  try {
    await runAlpacaPersonalMulsAssetMetadataDiagnostic({ confirmed: true, environment, transport });
    throw new Error("Expected diagnostic failure.");
  } catch (error) {
    assert(error instanceof AlpacaPersonalAssetMetadataError, "typed error");
    equal(error.safeCode, expected, "safe code");
    return error;
  }
}

function expectCommandFailure(args: readonly string[]): void {
  try {
    parseAlpacaPersonalAssetMetadataCommandArguments(args);
    throw new Error("Expected command failure.");
  } catch (error) {
    assert(error instanceof AlpacaPersonalAssetMetadataCommandError, "typed command error");
  }
}

async function runAll(): Promise<void> {
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
  console.log(`Alpaca MULS asset-metadata diagnostic tests: ${passed}/${tests.length} passed.`);
}

void runAll();
