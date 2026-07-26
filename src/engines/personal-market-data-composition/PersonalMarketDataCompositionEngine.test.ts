import {
  CANONICAL_BAR_SCHEMA_VERSION,
  BarAdjustmentState,
  BarDeliveryTiming,
  BarDerivationStatus,
  BarFreshnessStatus,
  BarInterval,
  BarMarketCoverage,
  BarQuantityUnit,
  BarSessionType,
  CanonicalBarStatus,
  type CanonicalBar,
  type CanonicalBarInput,
} from "../../contracts/CanonicalBar";
import {
  CANONICAL_QUOTE_SCHEMA_VERSION,
  CanonicalQuoteStatus,
  QuoteQuantityUnit,
  type CanonicalQuote,
} from "../../contracts/CanonicalQuote";
import {
  PersonalCandidateSession,
} from "../../contracts/PersonalCandidateScan";
import {
  PERSONAL_MARKET_DATA_COMPOSITION_SCHEMA_VERSION,
  PersonalMarketDataCompositionIssueCode,
  type PersonalMarketDataCompositionRequest,
} from "../../contracts/PersonalMarketDataComposition";
import { PersonalDecisionLiquidityStatus } from "../../contracts/PersonalDecision";
import {
  type PersonalWatchlistMapping,
} from "../../contracts/PersonalWatchlistMapping";
import { createCanonicalBar } from "../canonical-bar/CanonicalBar";
import { createCanonicalQuote } from "../canonical-quote/CanonicalQuote";
import {
  approvePersonalWatchlistMappingRegistry,
  createResearchVerifiedPersonalWatchlistCatalog,
} from "../personal-watchlist-mapping/PersonalWatchlistMappingRegistry";
import {
  PersonalMarketDataCompositionError,
  composePersonalMarketData,
} from "./PersonalMarketDataCompositionEngine";

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }
function assertTrue(value: unknown, label: string): asserts value {
  if (!value) throw new Error(`${label}: expected truthy.`);
}
function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}
function expectIssue(run: () => unknown, code: PersonalMarketDataCompositionIssueCode): void {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof PersonalMarketDataCompositionError
      && error.issues.some((entry) => entry.code === code)) return;
    throw error;
  }
  throw new Error(`Expected issue ${code}.`);
}

function approvedRegistry() {
  const proposal = createResearchVerifiedPersonalWatchlistCatalog();
  return approvePersonalWatchlistMappingRegistry(proposal, {
    mappingIds: proposal.mappings.map((mapping) => mapping.mappingId),
    decidedBy: "owner:personal",
    decidedAt: "2026-07-26T15:30:00.000Z",
    decisionReference: "decision:mvp-t3a-approved",
  });
}

function mapping(): PersonalWatchlistMapping {
  return approvedRegistry().mappings.find((entry) => entry.mappingId === "mapping:mu:mull")!;
}

function bar(
  selectedMapping: PersonalWatchlistMapping,
  interval: BarInterval,
  intervalStart: string,
  intervalEnd: string,
  closeAtomic: string,
  suffix: string,
): CanonicalBar {
  const sessionDate = intervalEnd.slice(0, 10);
  const input: CanonicalBarInput = {
    schemaVersion: CANONICAL_BAR_SCHEMA_VERSION,
    instrument: selectedMapping.analysisInstrument,
    interval,
    intervalStart,
    intervalEnd,
    observationTime: intervalEnd,
    providerPublishedAt: new Date(Date.parse(intervalEnd) + 500).toISOString(),
    receivedAt: new Date(Date.parse(intervalEnd) + 1_000).toISOString(),
    normalizedAt: new Date(Date.parse(intervalEnd) + 2_000).toISOString(),
    value: {
      open: { atomicValue: closeAtomic, scale: 2 },
      high: { atomicValue: String(BigInt(closeAtomic) + 10n), scale: 2 },
      low: { atomicValue: String(BigInt(closeAtomic) - 10n), scale: 2 },
      close: { atomicValue: closeAtomic, scale: 2 },
      volume: { atomicValue: "10000", scale: 0 },
    },
    currency: "USD",
    quantityUnit: BarQuantityUnit.BaseUnits,
    status: CanonicalBarStatus.Final,
    session: {
      sessionType: BarSessionType.Regular,
      sessionDate,
      timezone: "America/New_York",
    },
    adjustment: BarAdjustmentState.Raw,
    quality: {
      policyId: "market-data-policy:personal",
      policyVersion: "1.0",
      evaluatedAt: new Date(Date.parse(intervalEnd) + 5_000).toISOString(),
      maxAgeSeconds: 60,
      freshness: BarFreshnessStatus.Current,
      deliveryTiming: BarDeliveryTiming.RealTime,
      marketCoverage: BarMarketCoverage.FullMarket,
      derivation: BarDerivationStatus.ProviderReported,
      reasonCodes: [],
    },
    source: {
      providerId: "provider:fixture",
      adapterId: "adapter:personal-fixture",
      adapterVersion: "1.0",
      sourceReference: `fixture:bar:${suffix}`,
      contentIntegrityReference: `sha256:fixture-bar-${suffix}`,
    },
  };
  return createCanonicalBar(input);
}

function timeframes(selectedMapping: PersonalWatchlistMapping) {
  return [
    {
      interval: BarInterval.OneDay,
      start: bar(selectedMapping, BarInterval.OneDay, "2026-07-23T13:30:00.000Z", "2026-07-23T20:00:00.000Z", "12000", "d1-start"),
      end: bar(selectedMapping, BarInterval.OneDay, "2026-07-24T13:30:00.000Z", "2026-07-24T20:00:00.000Z", "12200", "d1-end"),
    },
    {
      interval: BarInterval.OneHour,
      start: bar(selectedMapping, BarInterval.OneHour, "2026-07-26T14:00:00.000Z", "2026-07-26T15:00:00.000Z", "12200", "h1-start"),
      end: bar(selectedMapping, BarInterval.OneHour, "2026-07-26T15:00:00.000Z", "2026-07-26T16:00:00.000Z", "12300", "h1-end"),
    },
    {
      interval: BarInterval.FifteenMinutes,
      start: bar(selectedMapping, BarInterval.FifteenMinutes, "2026-07-26T15:30:00.000Z", "2026-07-26T15:45:00.000Z", "12300", "m15-start"),
      end: bar(selectedMapping, BarInterval.FifteenMinutes, "2026-07-26T15:45:00.000Z", "2026-07-26T16:00:00.000Z", "12400", "m15-end"),
    },
    {
      interval: BarInterval.FiveMinutes,
      start: bar(selectedMapping, BarInterval.FiveMinutes, "2026-07-26T15:50:00.000Z", "2026-07-26T15:55:00.000Z", "12400", "m5-start"),
      end: bar(selectedMapping, BarInterval.FiveMinutes, "2026-07-26T15:55:00.000Z", "2026-07-26T16:00:00.000Z", "12500", "m5-end"),
    },
  ];
}

function quote(selectedMapping: PersonalWatchlistMapping): CanonicalQuote {
  return createCanonicalQuote({
    schemaVersion: CANONICAL_QUOTE_SCHEMA_VERSION,
    instrument: selectedMapping.tradeVehicle,
    value: {
      bidPrice: { atomicValue: "4995", scale: 2 },
      askPrice: { atomicValue: "5005", scale: 2 },
      bidSize: { atomicValue: "100", scale: 0 },
      askSize: { atomicValue: "120", scale: 0 },
      quantityUnit: QuoteQuantityUnit.BaseUnits,
    },
    currency: "USD",
    status: CanonicalQuoteStatus.Current,
    observationTime: "2026-07-26T16:00:00.000Z",
    providerPublishedAt: "2026-07-26T16:00:00.500Z",
    receivedAt: "2026-07-26T16:00:01.000Z",
    normalizedAt: "2026-07-26T16:00:02.000Z",
    quality: {
      policyId: "market-data-policy:personal",
      policyVersion: "1.0",
      evaluatedAt: "2026-07-26T16:00:05.000Z",
      maxAgeSeconds: 60,
      reasonCodes: [],
    },
    source: {
      providerId: "provider:fixture",
      adapterId: "adapter:personal-fixture",
      adapterVersion: "1.0",
      providerInstrumentId: "provider-instrument:mull",
      providerSymbol: "MULL",
      sourceReference: "fixture:quote:mull",
      contentIntegrityReference: "sha256:fixture-quote-mull",
    },
  });
}

function request(): PersonalMarketDataCompositionRequest {
  const registry = approvedRegistry();
  const selectedMapping = registry.mappings.find((entry) => entry.mappingId === "mapping:mu:mull")!;
  const selectedQuote = quote(selectedMapping);
  return {
    schemaVersion: PERSONAL_MARKET_DATA_COMPOSITION_SCHEMA_VERSION,
    scanId: "scan:personal:2026-07-26",
    profileId: "profile:personal:owner",
    profileVersion: "1.0",
    evaluatedAt: "2026-07-26T16:00:10.000Z",
    session: PersonalCandidateSession.Intraday,
    mappingRegistry: registry,
    candidates: [{
      candidateId: "candidate:mu:mull",
      mapping: selectedMapping,
      timeframes: timeframes(selectedMapping),
      quote: selectedQuote,
      liquidity: {
        assessmentId: "liquidity:mull:1",
        quoteId: selectedQuote.quoteId,
        quoteFingerprint: selectedQuote.fingerprint,
        status: PersonalDecisionLiquidityStatus.Sufficient,
        evaluatedAt: "2026-07-26T16:00:06.000Z",
        policyId: "liquidity-policy:personal",
        policyVersion: "1.0",
        evidenceReferences: ["evidence:quote-depth:mull"],
      },
    }],
  };
}

test("exact approved canonical observations compose one scan request", () => {
  const result = composePersonalMarketData(request());
  assertEqual(result.scanRequest.candidates.length, 1, "candidate count");
  assertEqual(result.scanRequest.candidates[0]?.analysisInstrument.symbol, "MU", "analysis symbol");
  assertEqual(result.scanRequest.candidates[0]?.tradeVehicle.symbol, "MULL", "vehicle symbol");
  assertEqual(result.scanRequest.candidates[0]?.timeframes.length, 4, "timeframe count");
  assertEqual(result.scanRequest.candidates[0]?.quote.spreadBasisPoints, 20, "conservative spread");
  assertEqual(result.automatedExecutionAllowed, false, "execution authority");
});

test("Owner approval binds the exact complete eight-mapping registry", () => {
  const registry = approvedRegistry();
  assertTrue(registry.mappings.every((entry) => activate(entry)), "all mappings active");
});

test("pending Owner mappings cannot compose", () => {
  const value = request();
  const pending = createResearchVerifiedPersonalWatchlistCatalog();
  const pendingMapping = pending.mappings.find((entry) => entry.mappingId === "mapping:mu:mull")!;
  expectIssue(
    () => composePersonalMarketData({
      ...value,
      mappingRegistry: pending,
      candidates: [{ ...value.candidates[0]!, mapping: pendingMapping }],
    }),
    PersonalMarketDataCompositionIssueCode.MappingNotApproved,
  );
});

test("candidate mapping substitution fails exact registry binding", () => {
  const value = request();
  expectIssue(
    () => composePersonalMarketData({
      ...value,
      candidates: [{
        ...value.candidates[0]!,
        mapping: { ...value.candidates[0]!.mapping, version: "2.0" },
      }],
    }),
    PersonalMarketDataCompositionIssueCode.MappingNotRegistered,
  );
});

test("missing required timeframe fails closed", () => {
  const value = request();
  expectIssue(
    () => composePersonalMarketData({
      ...value,
      candidates: [{ ...value.candidates[0]!, timeframes: value.candidates[0]!.timeframes.slice(1) }],
    }),
    PersonalMarketDataCompositionIssueCode.InvalidTimeframeSet,
  );
});

test("bar from another analysis instrument fails closed", () => {
  const value = request();
  const other = value.mappingRegistry.mappings.find((entry) => entry.mappingId === "mapping:tsla:tsll")!;
  const changed = [...value.candidates[0]!.timeframes];
  changed[0] = {
    interval: BarInterval.OneDay,
    start: bar(other, BarInterval.OneDay, "2026-07-23T13:30:00.000Z", "2026-07-23T20:00:00.000Z", "12000", "other-start"),
    end: bar(other, BarInterval.OneDay, "2026-07-24T13:30:00.000Z", "2026-07-24T20:00:00.000Z", "12200", "other-end"),
  };
  expectIssue(
    () => composePersonalMarketData({
      ...value,
      candidates: [{ ...value.candidates[0]!, timeframes: changed }],
    }),
    PersonalMarketDataCompositionIssueCode.BarInstrumentMismatch,
  );
});

test("quote from the underlying instead of the ETF fails closed", () => {
  const value = request();
  const candidate = value.candidates[0]!;
  const wrongQuote = createCanonicalQuote({
    ...candidate.quote,
    instrument: candidate.mapping.analysisInstrument,
    source: {
      ...candidate.quote.source,
      providerInstrumentId: "provider-instrument:mu",
      providerSymbol: "MU",
    },
  });
  expectIssue(
    () => composePersonalMarketData({
      ...value,
      candidates: [{ ...candidate, quote: wrongQuote }],
    }),
    PersonalMarketDataCompositionIssueCode.QuoteInstrumentMismatch,
  );
});

test("liquidity assessment cannot bind a different quote fingerprint", () => {
  const value = request();
  const candidate = value.candidates[0]!;
  expectIssue(
    () => composePersonalMarketData({
      ...value,
      candidates: [{
        ...candidate,
        liquidity: { ...candidate.liquidity, quoteFingerprint: "fnv1a64:0000000000000000" },
      }],
    }),
    PersonalMarketDataCompositionIssueCode.LiquidityBindingMismatch,
  );
});

test("undeclared candidate execution field fails closed", () => {
  const value = request();
  expectIssue(
    () => composePersonalMarketData({
      ...value,
      candidates: [{ ...value.candidates[0]!, orderType: "MARKET" }],
    }),
    PersonalMarketDataCompositionIssueCode.UndeclaredField,
  );
});

test("composition is deterministic and deeply immutable", () => {
  const left = composePersonalMarketData(request());
  const right = composePersonalMarketData(request());
  assertEqual(left.inputFingerprint, right.inputFingerprint, "fingerprint");
  assertEqual(Object.isFrozen(left), true, "result frozen");
  assertEqual(Object.isFrozen(left.scanRequest.candidates), true, "candidates frozen");
});

function activate(mappingValue: PersonalWatchlistMapping): boolean {
  return mappingValue.ownerDecision.status === "APPROVED"
    && mappingValue.authorityEvidence.length > 0;
}

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
console.log(`${passed}/${tests.length} personal market-data composition tests passed.`);
