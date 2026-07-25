import {
  KalshiEventContractFixtureAdapter,
  KalshiEventContractFixtureIssueCode,
  KalshiEventContractFixtureStatus,
} from "./index";
import {
  KALSHI_BTC_15M_MARKET_FIXTURE_NORMALIZED_AT,
  KALSHI_BTC_15M_MARKET_FIXTURE_OBSERVED_AT,
  KALSHI_BTC_15M_MARKET_FIXTURE_RECEIVED_AT,
  kalshiBtcFifteenMinuteMarketBody,
  kalshiBtcFifteenMinuteSeriesBody,
  robinhoodBtcFifteenMinuteEventBody,
} from "./KalshiEventContractTestFixtures";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}
function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}
function fixture(overrides: Partial<Parameters<KalshiEventContractFixtureAdapter["normalize"]>[0]> = {}) {
  return new KalshiEventContractFixtureAdapter().normalize({
    marketBody: kalshiBtcFifteenMinuteMarketBody(),
    seriesBody: kalshiBtcFifteenMinuteSeriesBody(),
    robinhoodBody: robinhoodBtcFifteenMinuteEventBody(),
    observedAt: KALSHI_BTC_15M_MARKET_FIXTURE_OBSERVED_AT,
    receivedAt: KALSHI_BTC_15M_MARKET_FIXTURE_RECEIVED_AT,
    normalizedAt: KALSHI_BTC_15M_MARKET_FIXTURE_NORMALIZED_AT,
    ...overrides,
  });
}
function mutate(body: string, update: (value: Record<string, unknown>) => void): string {
  const value = JSON.parse(body) as Record<string, unknown>;
  update(value);
  return JSON.stringify(value);
}
function expectIssue(result: ReturnType<typeof fixture>, code: KalshiEventContractFixtureIssueCode, field?: string): void {
  assertEqual(result.status, KalshiEventContractFixtureStatus.Rejected, "status");
  if (result.status !== KalshiEventContractFixtureStatus.Rejected) return;
  assertTrue(result.blockers.some((item) => item.code === code && (field === undefined || item.field.includes(field))), `${code} issue`);
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["normalizes the official BTC fifteen-minute fixture deterministically", () => {
    const first = fixture();
    const second = fixture();
    assertEqual(first.status, KalshiEventContractFixtureStatus.NormalizedExactMapping, "status");
    if (first.status !== KalshiEventContractFixtureStatus.NormalizedExactMapping
      || second.status !== KalshiEventContractFixtureStatus.NormalizedExactMapping) return;
    assertEqual(first.fingerprint, second.fingerprint, "fingerprint");
    assertTrue(Object.isFrozen(first) && Object.isFrozen(first.externalTerms.targetPrice), "immutable");
  }],
  ["preserves exact official Kalshi identity", () => {
    const result = fixture();
    if (result.status !== KalshiEventContractFixtureStatus.NormalizedExactMapping) throw new Error("fixture rejected");
    assertEqual(result.externalIdentity.seriesTicker, "KXBTC15M", "series");
    assertEqual(result.externalIdentity.eventTicker, "KXBTC15M-26JUL232045", "event");
    assertEqual(result.externalIdentity.marketTicker, "KXBTC15M-26JUL232045-45", "market");
  }],
  ["normalizes the EDT display interval to the exact UTC window", () => {
    const result = fixture();
    if (result.status !== KalshiEventContractFixtureStatus.NormalizedExactMapping) throw new Error("fixture rejected");
    assertEqual(result.externalTerms.windowStartsAt, "2026-07-24T00:30:00.000Z", "window start");
    assertEqual(result.externalTerms.tradingClosesAt, "2026-07-24T00:45:00.000Z", "close");
    assertEqual(result.externalTerms.evaluatesAt, "2026-07-24T00:45:00.000Z", "evaluate");
  }],
  ["preserves target and BRTI semantics", () => {
    const result = fixture();
    if (result.status !== KalshiEventContractFixtureStatus.NormalizedExactMapping) throw new Error("fixture rejected");
    assertEqual(result.externalTerms.targetPrice.atomicValue, "6483926", "target");
    assertEqual(result.externalTerms.targetPrice.scale, 2, "scale");
    assertEqual(result.externalTerms.settlementSourceId, "source:cme-cf-brti", "source");
    assertEqual(result.externalTerms.thresholdOperator, "AT_OR_ABOVE", "operator");
  }],
  ["preserves finalized down settlement without creating an observation", () => {
    const result = fixture();
    if (result.status !== KalshiEventContractFixtureStatus.NormalizedExactMapping) throw new Error("fixture rejected");
    assertEqual(result.settlement.result, "DOWN", "result");
    assertEqual(result.settlement.expirationValue.atomicValue, "6480904", "expiration value");
    assertEqual(result.eligibleForSourceSnapshot, true, "snapshot eligibility");
    assertEqual(result.sourceSnapshot.capability, "SETTLEMENT", "snapshot capability");
  }],
  ["creates the reviewed exact Robinhood-to-Kalshi mapping", () => {
    const result = fixture();
    if (result.status !== KalshiEventContractFixtureStatus.NormalizedExactMapping) throw new Error("fixture rejected");
    assertEqual(result.mappingAssessment.matchingFacts.length, 6, "matching facts");
    assertEqual(result.mappingAssessment.eligibleForCollection, true, "mapping eligibility");
    assertEqual(result.mapping.robinhoodIdentity.exchangeId, "exchange:kalshi-ex", "declared exchange");
    assertEqual(result.mapping.robinhoodIdentity.contractId, "robinhood:deep-link:882673e4-25e6-45b3-8d6a-4ff87ff21708", "Robinhood contract identity");
    assertEqual(result.mapping.externalIdentity.nativeTicker, "KXBTC15M-26JUL232045-45", "Kalshi ticker");
    assertEqual(result.mapping.reviewerId, "reviewer:codex", "technical reviewer");
  }],
  ["content-addresses the linked Kalshi terms document", () => {
    const result = fixture();
    if (result.status !== KalshiEventContractFixtureStatus.NormalizedExactMapping) throw new Error("fixture rejected");
    assertEqual(result.robinhoodEvidence.termsSha256, "418c225a3c45c7ddef028f12a4755652c456658f54ec27c5d365d5489ce5e874", "terms digest");
    assertEqual(result.mapping.robinhoodTerms.termsVersion, result.mapping.externalTerms.termsVersion, "terms version");
    assertEqual(result.mapping.robinhoodTerms.termsVersion, result.robinhoodEvidence.termsSha256, "content version");
  }],
  ["preserves distinct native titles without weakening canonical terms equality", () => {
    const result = fixture();
    if (result.status !== KalshiEventContractFixtureStatus.NormalizedExactMapping) throw new Error("fixture rejected");
    assertEqual(result.robinhoodEvidence.displayTitle, "BTC 15 min · 8:30–8:45 PM EDT", "Robinhood title");
    assertEqual(result.externalTerms.title, "BTC price up in next 15 mins?", "Kalshi title");
    assertEqual(result.mapping.robinhoodTerms.title, result.mapping.externalTerms.title, "canonical mapping title");
  }],
  ["does not leak raw provider payload into normalized output", () => {
    const result = fixture();
    assertTrue(!JSON.stringify(result).includes("Persons who are employed"), "raw payload absent");
  }],
  ["rejects malformed market JSON", () => expectIssue(fixture({ marketBody: "{" }), KalshiEventContractFixtureIssueCode.MalformedJson, "marketBody")],
  ["rejects malformed series JSON", () => expectIssue(fixture({ seriesBody: "[]" }), KalshiEventContractFixtureIssueCode.InvalidPayload, "seriesBody")],
  ["rejects malformed Robinhood evidence JSON", () => expectIssue(fixture({ robinhoodBody: "[]" }), KalshiEventContractFixtureIssueCode.InvalidPayload, "robinhoodBody")],
  ["rejects oversized payloads", () => expectIssue(fixture({ marketBody: `{"padding":"${"x".repeat(100_001)}"}` }), KalshiEventContractFixtureIssueCode.PayloadTooLarge)],
  ["rejects unknown market fields", () => expectIssue(fixture({
    marketBody: mutate(kalshiBtcFifteenMinuteMarketBody(), (root) => {
      (root.market as Record<string, unknown>).secret = "not-allowed";
    }),
  }), KalshiEventContractFixtureIssueCode.UnknownField, "secret")],
  ["rejects unknown nested market fields", () => expectIssue(fixture({
    marketBody: mutate(kalshiBtcFifteenMinuteMarketBody(), (root) => {
      ((root.market as Record<string, unknown>).custom_strike as Record<string, unknown>).precision_hint = 2;
    }),
  }), KalshiEventContractFixtureIssueCode.UnknownField, "precision_hint")],
  ["rejects unknown nested series fields", () => expectIssue(fixture({
    seriesBody: mutate(kalshiBtcFifteenMinuteSeriesBody(), (root) => {
      const sources = (root.series as Record<string, unknown>).settlement_sources as Array<Record<string, unknown>>;
      sources[0]!.credential = "not-allowed";
    }),
  }), KalshiEventContractFixtureIssueCode.UnknownField, "credential")],
  ["rejects unknown root fields", () => expectIssue(fixture({
    seriesBody: mutate(kalshiBtcFifteenMinuteSeriesBody(), (root) => { root.cursor = "unexpected"; }),
  }), KalshiEventContractFixtureIssueCode.UnknownField, "cursor")],
  ["rejects unknown Robinhood evidence fields", () => expectIssue(fixture({
    robinhoodBody: mutate(robinhoodBtcFifteenMinuteEventBody(), (root) => {
      (root.event as Record<string, unknown>).exchange_guess = "kalshi";
    }),
  }), KalshiEventContractFixtureIssueCode.UnknownField, "exchange_guess")],
  ["rejects a different market ticker", () => expectIssue(fixture({
    marketBody: mutate(kalshiBtcFifteenMinuteMarketBody(), (root) => {
      (root.market as Record<string, unknown>).ticker = "KXBTC15M-OTHER";
    }),
  }), KalshiEventContractFixtureIssueCode.IdentityMismatch, "ticker")],
  ["rejects a different series", () => expectIssue(fixture({
    seriesBody: mutate(kalshiBtcFifteenMinuteSeriesBody(), (root) => {
      (root.series as Record<string, unknown>).ticker = "KXETH15M";
    }),
  }), KalshiEventContractFixtureIssueCode.IdentityMismatch, "ticker")],
  ["rejects target mismatches", () => expectIssue(fixture({
    marketBody: mutate(kalshiBtcFifteenMinuteMarketBody(), (root) => {
      (root.market as Record<string, unknown>).floor_strike = 64839.27;
    }),
  }), KalshiEventContractFixtureIssueCode.IdentityMismatch, "floor_strike")],
  ["rejects altered primary rules", () => expectIssue(fixture({
    marketBody: mutate(kalshiBtcFifteenMinuteMarketBody(), (root) => {
      (root.market as Record<string, unknown>).rules_primary = "similar but not exact";
    }),
  }), KalshiEventContractFixtureIssueCode.IdentityMismatch, "rules_primary")],
  ["rejects a Robinhood rule mismatch", () => expectIssue(fixture({
    robinhoodBody: mutate(robinhoodBtcFifteenMinuteEventBody(), (root) => {
      (root.event as Record<string, unknown>).rules_primary = "similar but not exact";
    }),
  }), KalshiEventContractFixtureIssueCode.IdentityMismatch, "rules_primary")],
  ["rejects a non-Kalshi Robinhood terms link", () => expectIssue(fixture({
    robinhoodBody: mutate(robinhoodBtcFifteenMinuteEventBody(), (root) => {
      (root.event as Record<string, unknown>).terms_url = "https://example.test/CRYPTO15M.pdf";
    }),
  }), KalshiEventContractFixtureIssueCode.IdentityMismatch, "terms_url")],
  ["rejects a changed terms-document digest", () => expectIssue(fixture({
    robinhoodBody: mutate(robinhoodBtcFifteenMinuteEventBody(), (root) => {
      (root.event as Record<string, unknown>).terms_sha256 = "0".repeat(64);
    }),
  }), KalshiEventContractFixtureIssueCode.IdentityMismatch, "terms_sha256")],
  ["rejects a different Robinhood deep-link identity", () => expectIssue(fixture({
    robinhoodBody: mutate(robinhoodBtcFifteenMinuteEventBody(), (root) => {
      (root.event as Record<string, unknown>).deep_link_contract_id = "00000000-0000-0000-0000-000000000000";
    }),
  }), KalshiEventContractFixtureIssueCode.IdentityMismatch, "deep_link_contract_id")],
  ["rejects noncanonical Robinhood evidence retrieval time", () => expectIssue(fixture({
    robinhoodBody: mutate(robinhoodBtcFifteenMinuteEventBody(), (root) => {
      (root.event as Record<string, unknown>).retrieved_at = "2026-07-25T01:04:45Z";
    }),
  }), KalshiEventContractFixtureIssueCode.InvalidChronology, "retrieved_at")],
  ["rejects Robinhood evidence retrieved after normalization", () => expectIssue(fixture({
    robinhoodBody: mutate(robinhoodBtcFifteenMinuteEventBody(), (root) => {
      (root.event as Record<string, unknown>).retrieved_at = "2026-07-25T01:07:31.000Z";
    }),
  }), KalshiEventContractFixtureIssueCode.InvalidChronology, "retrieved_at")],
  ["rejects settlement-source mismatches", () => expectIssue(fixture({
    seriesBody: mutate(kalshiBtcFifteenMinuteSeriesBody(), (root) => {
      (root.series as Record<string, unknown>).settlement_sources = [{ name: "Other", url: "https://example.test/" }];
    }),
  }), KalshiEventContractFixtureIssueCode.InvalidTerms, "settlement_sources")],
  ["rejects non-fifteen-minute windows", () => expectIssue(fixture({
    marketBody: mutate(kalshiBtcFifteenMinuteMarketBody(), (root) => {
      (root.market as Record<string, unknown>).close_time = "2026-07-24T00:44:00Z";
    }),
  }), KalshiEventContractFixtureIssueCode.InvalidTerms)],
  ["rejects non-finalized fixture state", () => expectIssue(fixture({
    marketBody: mutate(kalshiBtcFifteenMinuteMarketBody(), (root) => {
      (root.market as Record<string, unknown>).status = "active";
    }),
  }), KalshiEventContractFixtureIssueCode.IdentityMismatch, "status")],
  ["rejects settlement before close", () => expectIssue(fixture({
    marketBody: mutate(kalshiBtcFifteenMinuteMarketBody(), (root) => {
      (root.market as Record<string, unknown>).settlement_ts = "2026-07-24T00:44:59Z";
    }),
  }), KalshiEventContractFixtureIssueCode.InvalidChronology, "settlement_ts")],
  ["rejects noncanonical local chronology", () => expectIssue(fixture({
    receivedAt: "2026-07-24T13:40:00Z",
  }), KalshiEventContractFixtureIssueCode.InvalidChronology)],
  ["rejects reversed local chronology", () => expectIssue(fixture({
    normalizedAt: "2026-07-24T13:39:59.000Z",
  }), KalshiEventContractFixtureIssueCode.InvalidChronology)],
];

let passed = 0;
for (const [name, test] of tests) {
  try {
    test();
    passed += 1;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`Kalshi Event Contract Fixture Adapter tests passed: ${String(passed)}/${String(tests.length)}.`);
