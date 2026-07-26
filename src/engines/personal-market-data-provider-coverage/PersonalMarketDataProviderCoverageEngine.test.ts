import {
  PersonalMarketDataFeedCoverage,
  PersonalMarketDataProviderCoverageIssueCode,
  PersonalMarketDataProviderId,
  PersonalMarketDataProviderReadiness,
  PersonalMarketDataVerificationStatus,
  type PersonalMarketDataProviderProfile,
  type PersonalMarketDataProviderRequirement,
} from "../../contracts/PersonalMarketDataProviderCoverage";
import {
  PERSONAL_MARKET_DATA_INTERVALS,
  PERSONAL_MARKET_DATA_SYMBOLS,
  PersonalMarketDataProviderCoverageError,
  assessPersonalMarketDataProvider,
  createPersonalMarketDataProviderCatalog,
} from "./PersonalMarketDataProviderCoverageEngine";

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }
const assert = {
  equal(actual: unknown, expected: unknown): void {
    if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  },
  deepEqual(actual: unknown, expected: unknown): void {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Values are not deeply equal.");
  },
  ok(value: unknown): void {
    if (!value) throw new Error("Expected a truthy value.");
  },
  match(value: string, pattern: RegExp): void {
    if (!pattern.test(value)) throw new Error(`Value did not match ${String(pattern)}.`);
  },
  throws(run: () => unknown, expected: Function): void {
    try {
      run();
    } catch (error) {
      if (expected.prototype instanceof Error) {
        if (error instanceof (expected as new (...args: never[]) => Error)) return;
      } else if ((expected as (error: unknown) => boolean)(error)) {
        return;
      }
      throw error;
    }
    throw new Error("Expected function to throw.");
  },
};

const requirement = (overrides: Partial<PersonalMarketDataProviderRequirement> = {}): PersonalMarketDataProviderRequirement => ({
  requirementId: "personal-market-data:mvp",
  requiredSymbols: PERSONAL_MARKET_DATA_SYMBOLS,
  requiredIntervals: PERSONAL_MARKET_DATA_INTERVALS,
  requireTwoSidedQuote: true,
  requireQuoteSizes: true,
  maxMonthlyCostUsd: 0,
  ownerApproved: false,
  credentialsAvailable: false,
  ...overrides,
});

const profile = (providerId: PersonalMarketDataProviderId): PersonalMarketDataProviderProfile => {
  const found = createPersonalMarketDataProviderCatalog().find((entry) => entry.providerId === providerId);
  if (found === undefined) throw new Error(`Provider ${providerId} is missing.`);
  return found;
};

test("catalog declares exactly the personal MVP provider candidates", () => {
  assert.deepEqual(createPersonalMarketDataProviderCatalog().map((entry) => entry.providerId), [
    PersonalMarketDataProviderId.AlpacaBasicIex,
    PersonalMarketDataProviderId.AlpacaSip,
    PersonalMarketDataProviderId.TwelveDataBasic,
  ]);
});

test("Alpaca Basic is only ready for bounded smoke before implementation and verification", () => {
  const result = assessPersonalMarketDataProvider(profile(PersonalMarketDataProviderId.AlpacaBasicIex), requirement());
  assert.equal(result.readiness, PersonalMarketDataProviderReadiness.ReadyForBoundedSmoke);
  assert.equal(result.monthlyCostUsd, 0);
  assert.equal(result.coverage, PersonalMarketDataFeedCoverage.SingleVenue);
  assert.ok(result.blockers.some((entry) => entry.code === "SYMBOL_UNVERIFIED"));
  assert.ok(result.blockers.some((entry) => entry.code === "ADAPTER_NOT_IMPLEMENTED"));
});

test("single-venue data carries a mandatory non-NBBO warning", () => {
  const result = assessPersonalMarketDataProvider(profile(PersonalMarketDataProviderId.AlpacaBasicIex), requirement());
  assert.match(result.warnings[0] ?? "", /must not be labeled NBBO/u);
});

test("Twelve Data Basic is blocked when exact two-sided quote semantics are absent", () => {
  const result = assessPersonalMarketDataProvider(profile(PersonalMarketDataProviderId.TwelveDataBasic), requirement());
  assert.equal(result.readiness, PersonalMarketDataProviderReadiness.Blocked);
  assert.ok(result.blockers.some((entry) => entry.code === "QUOTE_CAPABILITY_MISSING"));
});

test("SIP plan is blocked by a zero-dollar monthly budget", () => {
  const result = assessPersonalMarketDataProvider(profile(PersonalMarketDataProviderId.AlpacaSip), requirement());
  assert.equal(result.readiness, PersonalMarketDataProviderReadiness.Blocked);
  assert.ok(result.blockers.some((entry) => entry.code === "COST_EXCEEDS_LIMIT"));
});

test("missing required timeframe fails closed", () => {
  const source = profile(PersonalMarketDataProviderId.AlpacaBasicIex);
  const result = assessPersonalMarketDataProvider(
    { ...source, supportedIntervals: source.supportedIntervals.slice(1) },
    requirement(),
  );
  assert.equal(result.readiness, PersonalMarketDataProviderReadiness.Blocked);
  assert.ok(result.blockers.some((entry) => entry.code === "INTERVAL_MISSING"));
});

test("failed or missing exact symbol fails closed", () => {
  const source = profile(PersonalMarketDataProviderId.AlpacaBasicIex);
  const result = assessPersonalMarketDataProvider(
    {
      ...source,
      symbolVerification: {
        ...source.symbolVerification,
        SPCH: PersonalMarketDataVerificationStatus.Failed,
      },
    },
    requirement(),
  );
  assert.equal(result.readiness, PersonalMarketDataProviderReadiness.Blocked);
  assert.ok(result.blockers.some((entry) => entry.field === "symbolVerification.SPCH" && entry.code === "SYMBOL_FAILED"));
});

test("all exact symbols, adapter, credentials, and Owner approval produce collection readiness", () => {
  const source = profile(PersonalMarketDataProviderId.AlpacaBasicIex);
  const verified = Object.fromEntries(
    PERSONAL_MARKET_DATA_SYMBOLS.map((symbol) => [symbol, PersonalMarketDataVerificationStatus.Verified]),
  );
  const result = assessPersonalMarketDataProvider(
    { ...source, adapterImplemented: true, symbolVerification: verified },
    requirement({ ownerApproved: true, credentialsAvailable: true }),
  );
  assert.equal(result.readiness, PersonalMarketDataProviderReadiness.ReadyForPersonalCollection);
  assert.deepEqual(result.blockers, []);
});

test("credentials and Owner approval remain separate explicit gates", () => {
  const source = profile(PersonalMarketDataProviderId.AlpacaBasicIex);
  const result = assessPersonalMarketDataProvider(source, requirement());
  assert.ok(result.blockers.some((entry) => entry.code === "OWNER_APPROVAL_MISSING"));
  assert.ok(result.blockers.some((entry) => entry.code === "CREDENTIALS_MISSING"));
});

test("unknown provider fields are rejected", () => {
  assert.throws(
    () => assessPersonalMarketDataProvider(
      { ...profile(PersonalMarketDataProviderId.AlpacaBasicIex), brokerOrder: "BUY" },
      requirement(),
    ),
    (error: unknown) => error instanceof PersonalMarketDataProviderCoverageError
      && error.issues.some((entry) => entry.code === PersonalMarketDataProviderCoverageIssueCode.UndeclaredField),
  );
});

test("unknown requirement fields are rejected", () => {
  assert.throws(
    () => assessPersonalMarketDataProvider(
      profile(PersonalMarketDataProviderId.AlpacaBasicIex),
      { ...requirement(), leverage: 3 },
    ),
    PersonalMarketDataProviderCoverageError,
  );
});

test("assessment is immutable and has no execution authority", () => {
  const result = assessPersonalMarketDataProvider(profile(PersonalMarketDataProviderId.AlpacaBasicIex), requirement());
  assert.equal(result.advisoryOnly, true);
  assert.equal(result.automatedExecutionAllowed, false);
  assert.equal(result.deterministic, true);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.blockers));
});

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`${passed}/${tests.length} personal market-data provider coverage tests passed.`);
