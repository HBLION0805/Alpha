import {
  EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
  EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR,
  EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
  EventContractEvaluationMethod,
  EventContractObservationEventType,
  EventContractSourceCapability,
  EventContractSourceClass,
  EventContractSourceCredentialMode,
  EventContractSourceExecutionMode,
  EventContractSourceMappingReviewStatus,
  EventContractThresholdOperator,
  type EventContractFixedDecimal,
  type EventContractSourceTerms,
} from "../../../contracts";
import { EventContractSourceEngine } from "../../../engines";
import {
  KALSHI_BTC_FIFTEEN_MINUTE_SERIES_TICKER,
  KALSHI_EVENT_CONTRACT_EXCHANGE_ID,
  KALSHI_EVENT_CONTRACT_FIXTURE_SCHEMA_VERSION,
  KALSHI_EVENT_CONTRACT_PROVIDER_ID,
  KalshiEventContractFixtureIssueCode,
  KalshiEventContractFixtureStatus,
  type KalshiEventContractFixtureInput,
  type KalshiEventContractFixtureIssue,
  type KalshiEventContractFixtureResult,
  type RobinhoodReviewedEventContractEvidence,
} from "./KalshiEventContractFixtureContracts";

const MAX_BODY_BYTES = 100_000;
const MARKET_ENDPOINT = "https://external-api.kalshi.com/trade-api/v2/markets/KXBTC15M-26JUL232045-45";
const SERIES_ENDPOINT = "https://external-api.kalshi.com/trade-api/v2/series/KXBTC15M";
const MARKET_TICKER = "KXBTC15M-26JUL232045-45";
const EVENT_TICKER = "KXBTC15M-26JUL232045";
const ROBINHOOD_PAGE_URL = "https://robinhood.com/us/en/prediction-markets/crypto/events/btc-15-min-64-83926-target-jul-23-2026/";
const ROBINHOOD_PAGE_SLUG = "btc-15-min-64-83926-target-jul-23-2026";
const ROBINHOOD_DEEP_LINK_CONTRACT_ID = "882673e4-25e6-45b3-8d6a-4ff87ff21708";
const ROBINHOOD_ANALYTICS_EVENT_CONTRACT_ID = "7e129ce2-a081-4cbc-b1b9-c6808ca3ea38";
const CONTRACT_TERMS_URL = "https://assets.kalshi.com/contract_terms/CRYPTO15M.pdf";
const CONTRACT_TERMS_SHA256 = "418c225a3c45c7ddef028f12a4755652c456658f54ec27c5d365d5489ce5e874";
const CANONICAL_MAPPING_TITLE = "BTC-USD 15-minute direction ending 2026-07-24T00:45:00.000Z";
const MARKET_KEYS = [
  "can_close_early", "close_time", "created_time", "custom_strike", "event_ticker",
  "exchange_index", "expected_expiration_time", "expiration_time", "expiration_value",
  "floor_strike", "last_price_dollars", "latest_expiration_time", "liquidity_dollars",
  "market_type", "no_ask_dollars", "no_bid_dollars", "no_sub_title",
  "notional_value_dollars", "occurrence_datetime", "open_interest_fp", "open_time",
  "previous_price_dollars", "previous_yes_ask_dollars", "previous_yes_bid_dollars",
  "price_level_structure", "price_ranges", "result", "rules_primary", "rules_secondary",
  "settlement_timer_seconds", "settlement_ts", "settlement_value_dollars", "status",
  "strike_type", "ticker", "title", "updated_time", "volume_24h_fp", "volume_fp",
  "yes_ask_dollars", "yes_ask_size_fp", "yes_bid_dollars", "yes_bid_size_fp",
  "yes_sub_title",
] as const;
const SERIES_KEYS = [
  "additional_prohibitions", "category", "contract_terms_url", "contract_url",
  "fee_multiplier", "fee_type", "frequency", "last_updated_ts", "product_metadata",
  "settlement_sources", "tags", "ticker", "title",
] as const;
const ROBINHOOD_EVENT_KEYS = [
  "analytics_event_contract_id", "contract_label", "contract_question",
  "deep_link_contract_id", "display_title", "page_slug", "page_title", "page_url",
  "retrieved_at", "rules_primary", "rules_secondary", "terms_provider_host",
  "terms_sha256", "terms_url",
] as const;
const PRIMARY_RULE = "If the simple average of the sixty seconds of CF Benchmarks' BRTI before 8:45 PM EDT on Jul 23, 2026 is at least the simple average of the sixty seconds of CF Benchmarks' BRTI before 8:30 PM EDT on July 23, 2026, then the market resolves to Yes.";
const SECONDARY_RULE = "Not all cryptocurrency price data is the same. While checking a source like Google or Coinbase may help guide your decision, the price used to determine this market is based on CF Benchmarks' corresponding Real Time Index (RTI). At the last minute before expiration, 60 RTI prices are collected. The official and final value is the average of these prices, rounded to the nearest 2 decimal places.";

const sourceEngine = new EventContractSourceEngine();
const provider = sourceEngine.createProvider({
  schemaVersion: EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
  providerId: KALSHI_EVENT_CONTRACT_PROVIDER_ID,
  displayName: "Kalshi Public Market API",
  sourceClass: EventContractSourceClass.Exchange,
  exchangeId: KALSHI_EVENT_CONTRACT_EXCHANGE_ID,
  capabilities: [
    EventContractSourceCapability.ContractTerms,
    EventContractSourceCapability.Settlement,
  ],
  executionModes: [EventContractSourceExecutionMode.Fixture],
  credentialMode: EventContractSourceCredentialMode.None,
  documentationReferences: [
    "https://docs.kalshi.com/api-reference/market/get-market",
    "https://docs.kalshi.com/api-reference/market/get-series",
  ],
  active: true,
});

/**
 * Normalizes two static official Kalshi API payloads plus one reviewed,
 * sanitized Robinhood public-page evidence fixture. It has no transport,
 * credential, persistence, observation, recommendation, or execution path.
 */
export class KalshiEventContractFixtureAdapter {
  public getProvider() {
    return provider;
  }

  public normalize(input: Readonly<KalshiEventContractFixtureInput>): KalshiEventContractFixtureResult {
    const blockers: KalshiEventContractFixtureIssue[] = [];
    const marketRoot = parse(input.marketBody, "marketBody", blockers);
    const seriesRoot = parse(input.seriesBody, "seriesBody", blockers);
    const robinhoodRoot = parse(input.robinhoodBody, "robinhoodBody", blockers);
    chronology(input, blockers);
    if (marketRoot === undefined || seriesRoot === undefined || robinhoodRoot === undefined) return rejected(blockers);

    exactKeys(marketRoot, ["market"], "marketBody", blockers);
    exactKeys(seriesRoot, ["series"], "seriesBody", blockers);
    exactKeys(robinhoodRoot, ["event"], "robinhoodBody", blockers);
    const market = record(marketRoot.market, "marketBody.market", blockers);
    const series = record(seriesRoot.series, "seriesBody.series", blockers);
    const robinhood = record(robinhoodRoot.event, "robinhoodBody.event", blockers);
    if (market === undefined || series === undefined || robinhood === undefined) return rejected(blockers);
    exactKeys(market, MARKET_KEYS, "marketBody.market", blockers);
    exactKeys(series, SERIES_KEYS, "seriesBody.series", blockers);
    exactKeys(robinhood, ROBINHOOD_EVENT_KEYS, "robinhoodBody.event", blockers);
    validateNestedShape(market, series, blockers);

    validateIdentity(market, series, blockers);
    validateTerms(market, series, blockers);
    validateRobinhoodEvidence(robinhood, market, series, input, blockers);
    validateSettlement(market, blockers);
    if (blockers.length > 0) return rejected(blockers);

    const targetPrice = decimalFromNumber(market.floor_strike as number);
    const expirationValue = decimalFromString(market.expiration_value as string);
    const observedAt = input.observedAt;
    const canonicalTerms: EventContractSourceTerms = {
      title: CANONICAL_MAPPING_TITLE,
      termsVersion: CONTRACT_TERMS_SHA256,
      eventType: EventContractObservationEventType.BtcFifteenMinute,
      instrumentId: EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
      outcomePair: EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR,
      windowStartsAt: canonicalTimestamp(market.open_time as string),
      tradingClosesAt: canonicalTimestamp(market.close_time as string),
      evaluatesAt: canonicalTimestamp(market.close_time as string),
      evaluationMethod: EventContractEvaluationMethod.AtScheduledTime,
      thresholdOperator: EventContractThresholdOperator.AtOrAbove,
      targetPrice,
      settlementSourceId: "source:cme-cf-brti",
    };
    const evidenceIds = [
      "evidence:official-page:robinhood:btc15m:20260723-2045",
      "evidence:official-terms:kalshi:CRYPTO15M",
      "evidence:official-api:kalshi:market:KXBTC15M-26JUL232045-45",
      "evidence:official-api:kalshi:series:KXBTC15M",
    ];
    const mapping = sourceEngine.createMapping({
      schemaVersion: EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
      mappingId: "mapping:robinhood:kalshi:KXBTC15M-26JUL232045-45",
      version: "1.0",
      createdAt: canonicalTimestamp(robinhood.retrieved_at as string),
      reviewStatus: EventContractSourceMappingReviewStatus.ReviewedExact,
      reviewedAt: input.normalizedAt,
      reviewerId: "reviewer:codex",
      evidenceIds,
      provider,
      robinhoodIdentity: {
        exchangeId: KALSHI_EVENT_CONTRACT_EXCHANGE_ID,
        marketId: `robinhood:event-page:${ROBINHOOD_PAGE_SLUG}`,
        contractId: `robinhood:deep-link:${ROBINHOOD_DEEP_LINK_CONTRACT_ID}`,
        termsId: "robinhood:terms-link:CRYPTO15M",
      },
      externalIdentity: {
        providerId: KALSHI_EVENT_CONTRACT_PROVIDER_ID,
        exchangeId: KALSHI_EVENT_CONTRACT_EXCHANGE_ID,
        eventId: EVENT_TICKER,
        marketId: MARKET_TICKER,
        contractId: MARKET_TICKER,
        nativeTicker: MARKET_TICKER,
      },
      robinhoodTerms: canonicalTerms,
      externalTerms: canonicalTerms,
    });
    const sourceSnapshot = sourceEngine.createSnapshot({
      schemaVersion: EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
      snapshotId: "snapshot:kalshi:settlement:KXBTC15M-26JUL232045-45",
      provider,
      mapping,
      capability: EventContractSourceCapability.Settlement,
      executionMode: EventContractSourceExecutionMode.Fixture,
      sourceRecordId: `kalshi:market:${MARKET_TICKER}`,
      observedAt,
      publishedAt: null,
      receivedAt: input.receivedAt,
      normalizedAt: input.normalizedAt,
      payloadFingerprint: fingerprint({ market: marketRoot, series: seriesRoot }),
      rawPayloadBytes: new TextEncoder().encode(input.marketBody).length
        + new TextEncoder().encode(input.seriesBody).length,
      recordCount: 2,
    });
    const robinhoodEvidence = normalizeRobinhoodEvidence(robinhood);
    const base = {
      schemaVersion: KALSHI_EVENT_CONTRACT_FIXTURE_SCHEMA_VERSION,
      status: KalshiEventContractFixtureStatus.NormalizedExactMapping as const,
      provider,
      robinhoodEvidence,
      externalIdentity: {
        providerId: KALSHI_EVENT_CONTRACT_PROVIDER_ID,
        exchangeId: KALSHI_EVENT_CONTRACT_EXCHANGE_ID,
        seriesTicker: KALSHI_BTC_FIFTEEN_MINUTE_SERIES_TICKER,
        eventTicker: EVENT_TICKER,
        marketTicker: MARKET_TICKER,
      },
      externalTerms: {
        title: market.title as string,
        termsVersion: CONTRACT_TERMS_SHA256,
        instrumentId: EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
        outcomePair: EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR,
        windowStartsAt: canonicalTimestamp(market.open_time as string),
        tradingClosesAt: canonicalTimestamp(market.close_time as string),
        evaluatesAt: canonicalTimestamp(market.close_time as string),
        evaluationMethod: "AT_SCHEDULED_TIME" as const,
        thresholdOperator: "AT_OR_ABOVE" as const,
        targetPrice,
        settlementSourceId: "source:cme-cf-brti" as const,
        contractTermsUrl: CONTRACT_TERMS_URL,
        contractCertificationUrl: series.contract_url as string,
        seriesLastUpdatedAt: canonicalTimestamp(series.last_updated_ts as string),
        ruleFingerprint: fingerprint({
          primary: market.rules_primary,
          secondary: market.rules_secondary,
        }),
      },
      settlement: {
        status: "FINALIZED" as const,
        result: market.result === "yes" ? "UP" as const : "DOWN" as const,
        settlementValueBasisPoints: dollarsToBasisPoints(market.settlement_value_dollars as string),
        settledAt: canonicalTimestamp(market.settlement_ts as string),
        expirationValue,
      },
      mappingAssessment: {
        reviewStatus: "REVIEWED_EXACT" as const,
        eligibleForCollection: true as const,
        matchingFacts: [
          "BTC_15_MINUTE_WINDOW",
          "TARGET_PRICE",
          "BRTI_SETTLEMENT_SOURCE",
          "PRIMARY_RULE",
          "SECONDARY_RULE",
          "KALSHI_TERMS_LINK",
        ] as const,
        evidenceIds,
      },
      mapping,
      provenance: {
        marketEndpoint: MARKET_ENDPOINT,
        seriesEndpoint: SERIES_ENDPOINT,
        robinhoodPageEndpoint: ROBINHOOD_PAGE_URL,
        marketPayloadFingerprint: fingerprint(marketRoot),
        seriesPayloadFingerprint: fingerprint(seriesRoot),
        robinhoodEvidenceFingerprint: robinhoodEvidence.evidenceFingerprint,
        termsSha256: CONTRACT_TERMS_SHA256,
        observedAt,
        receivedAt: input.receivedAt,
        normalizedAt: input.normalizedAt,
        rawPayloadBytes: new TextEncoder().encode(input.marketBody).length
          + new TextEncoder().encode(input.seriesBody).length
          + new TextEncoder().encode(input.robinhoodBody).length,
        recordCount: 3 as const,
      },
      eligibleForSourceSnapshot: true as const,
      sourceSnapshot,
      authorizationStatus: "RESEARCH_FIXTURE_ONLY_NOT_OBSERVATION_OR_TRADE_AUTHORITY" as const,
      deterministic: true as const,
      readOnly: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }
}

function validateRobinhoodEvidence(
  robinhood: Record<string, unknown>,
  market: Record<string, unknown>,
  series: Record<string, unknown>,
  input: Readonly<KalshiEventContractFixtureInput>,
  blockers: KalshiEventContractFixtureIssue[],
): void {
  equal(robinhood.page_url, ROBINHOOD_PAGE_URL, "robinhoodBody.event.page_url", blockers);
  equal(robinhood.page_slug, ROBINHOOD_PAGE_SLUG, "robinhoodBody.event.page_slug", blockers);
  equal(robinhood.page_title, "July 23, 2026: BTC 15 min · 8:30–8:45 PM EDT Prediction Market", "robinhoodBody.event.page_title", blockers);
  equal(robinhood.display_title, "BTC 15 min · 8:30–8:45 PM EDT", "robinhoodBody.event.display_title", blockers);
  equal(robinhood.contract_label, "$64,839.26 or above", "robinhoodBody.event.contract_label", blockers);
  equal(robinhood.contract_question, "Will the price of Bitcoin be at or above the $64,839.26 target price in the 15-minute window?", "robinhoodBody.event.contract_question", blockers);
  equal(robinhood.deep_link_contract_id, ROBINHOOD_DEEP_LINK_CONTRACT_ID, "robinhoodBody.event.deep_link_contract_id", blockers);
  equal(robinhood.analytics_event_contract_id, ROBINHOOD_ANALYTICS_EVENT_CONTRACT_ID, "robinhoodBody.event.analytics_event_contract_id", blockers);
  equal(robinhood.terms_url, CONTRACT_TERMS_URL, "robinhoodBody.event.terms_url", blockers);
  equal(robinhood.terms_provider_host, "assets.kalshi.com", "robinhoodBody.event.terms_provider_host", blockers);
  equal(robinhood.terms_sha256, CONTRACT_TERMS_SHA256, "robinhoodBody.event.terms_sha256", blockers);
  equal(robinhood.rules_primary, PRIMARY_RULE, "robinhoodBody.event.rules_primary", blockers);
  equal(robinhood.rules_secondary, SECONDARY_RULE, "robinhoodBody.event.rules_secondary", blockers);
  equal(robinhood.rules_primary, market.rules_primary, "mapping.rules_primary", blockers);
  equal(robinhood.rules_secondary, market.rules_secondary, "mapping.rules_secondary", blockers);
  equal(robinhood.terms_url, series.contract_terms_url, "mapping.terms_url", blockers);
  validProviderTimestamp(robinhood.retrieved_at, "robinhoodBody.event.retrieved_at", blockers);
  if (typeof robinhood.retrieved_at === "string") {
    if (!isCanonicalTimestamp(robinhood.retrieved_at)) {
      add(blockers, KalshiEventContractFixtureIssueCode.InvalidChronology, "robinhoodBody.event.retrieved_at", "Robinhood evidence retrieval time must be canonical UTC.");
    } else if (Date.parse(robinhood.retrieved_at) > Date.parse(input.normalizedAt)) {
      add(blockers, KalshiEventContractFixtureIssueCode.InvalidChronology, "robinhoodBody.event.retrieved_at", "Robinhood evidence retrieval cannot follow normalization.");
    }
  }
}

function normalizeRobinhoodEvidence(value: Record<string, unknown>): RobinhoodReviewedEventContractEvidence {
  const base = {
    pageUrl: value.page_url as string,
    pageSlug: value.page_slug as string,
    pageTitle: value.page_title as string,
    displayTitle: value.display_title as string,
    contractLabel: value.contract_label as string,
    contractQuestion: value.contract_question as string,
    deepLinkContractId: value.deep_link_contract_id as string,
    analyticsEventContractId: value.analytics_event_contract_id as string,
    termsUrl: value.terms_url as string,
    termsProviderHost: value.terms_provider_host as "assets.kalshi.com",
    termsSha256: value.terms_sha256 as string,
    rulesPrimary: value.rules_primary as string,
    rulesSecondary: value.rules_secondary as string,
    retrievedAt: canonicalTimestamp(value.retrieved_at as string),
  };
  return deepFreeze({ ...base, evidenceFingerprint: fingerprint(base) });
}

function parse(body: unknown, field: string, blockers: KalshiEventContractFixtureIssue[]): Record<string, unknown> | undefined {
  if (typeof body !== "string" || body.length === 0) {
    add(blockers, KalshiEventContractFixtureIssueCode.MalformedJson, field, "Fixture body must be non-empty JSON text.");
    return undefined;
  }
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
    add(blockers, KalshiEventContractFixtureIssueCode.PayloadTooLarge, field, "Fixture body exceeds the bounded byte limit.");
    return undefined;
  }
  try {
    return record(JSON.parse(body), field, blockers);
  } catch {
    add(blockers, KalshiEventContractFixtureIssueCode.MalformedJson, field, "Fixture body is not valid JSON.");
    return undefined;
  }
}

function validateIdentity(market: Record<string, unknown>, series: Record<string, unknown>, blockers: KalshiEventContractFixtureIssue[]): void {
  equal(market.ticker, MARKET_TICKER, "marketBody.market.ticker", blockers);
  equal(market.event_ticker, EVENT_TICKER, "marketBody.market.event_ticker", blockers);
  equal(series.ticker, KALSHI_BTC_FIFTEEN_MINUTE_SERIES_TICKER, "seriesBody.series.ticker", blockers);
  equal(market.market_type, "binary", "marketBody.market.market_type", blockers);
  equal(series.category, "Crypto", "seriesBody.series.category", blockers);
  equal(series.frequency, "fifteen_min", "seriesBody.series.frequency", blockers);
}

function validateNestedShape(market: Record<string, unknown>, series: Record<string, unknown>, blockers: KalshiEventContractFixtureIssue[]): void {
  const customStrike = record(market.custom_strike, "marketBody.market.custom_strike", blockers);
  if (customStrike !== undefined) exactKeys(customStrike, ["round_digits"], "marketBody.market.custom_strike", blockers);
  if (!Array.isArray(market.price_ranges) || market.price_ranges.length !== 3) {
    add(blockers, KalshiEventContractFixtureIssueCode.InvalidPayload, "marketBody.market.price_ranges", "Reviewed price ranges are missing.");
  } else {
    market.price_ranges.forEach((value, index) => {
      const range = record(value, `marketBody.market.price_ranges.${String(index)}`, blockers);
      if (range !== undefined) exactKeys(range, ["end", "start", "step"], `marketBody.market.price_ranges.${String(index)}`, blockers);
    });
  }
  if (!Array.isArray(series.settlement_sources)) {
    add(blockers, KalshiEventContractFixtureIssueCode.InvalidPayload, "seriesBody.series.settlement_sources", "Settlement sources must be an array.");
  } else {
    series.settlement_sources.forEach((value, index) => {
      const source = record(value, `seriesBody.series.settlement_sources.${String(index)}`, blockers);
      if (source !== undefined) exactKeys(source, ["name", "url"], `seriesBody.series.settlement_sources.${String(index)}`, blockers);
    });
  }
  const metadata = record(series.product_metadata, "seriesBody.series.product_metadata", blockers);
  if (metadata !== undefined) {
    exactKeys(metadata, ["important_info"], "seriesBody.series.product_metadata", blockers);
    const information = record(metadata.important_info, "seriesBody.series.product_metadata.important_info", blockers);
    if (information !== undefined) {
      exactKeys(information, ["id", "markdown", "message", "title"], "seriesBody.series.product_metadata.important_info", blockers);
    }
  }
  stringArray(series.additional_prohibitions, "seriesBody.series.additional_prohibitions", blockers);
  stringArray(series.tags, "seriesBody.series.tags", blockers);
}

function validateTerms(market: Record<string, unknown>, series: Record<string, unknown>, blockers: KalshiEventContractFixtureIssue[]): void {
  equal(market.title, "BTC price up in next 15 mins?", "marketBody.market.title", blockers);
  equal(market.strike_type, "greater_or_equal", "marketBody.market.strike_type", blockers);
  equal(market.rules_primary, PRIMARY_RULE, "marketBody.market.rules_primary", blockers);
  equal(market.rules_secondary, SECONDARY_RULE, "marketBody.market.rules_secondary", blockers);
  equal(market.yes_sub_title, "Target Price: $64,839.26", "marketBody.market.yes_sub_title", blockers);
  equal(market.floor_strike, 64839.26, "marketBody.market.floor_strike", blockers);
  equal(series.contract_terms_url, "https://assets.kalshi.com/contract_terms/CRYPTO15M.pdf", "seriesBody.series.contract_terms_url", blockers);
  equal(series.contract_url, "https://assets.kalshi.com/regulatory/product-certifications/CRYPTO15M.pdf", "seriesBody.series.contract_url", blockers);
  if (!Array.isArray(series.settlement_sources)
    || series.settlement_sources.length !== 1
    || !isRecord(series.settlement_sources[0])
    || series.settlement_sources[0].name !== "CF Benchmarks"
    || series.settlement_sources[0].url !== "https://www.cfbenchmarks.com/") {
    add(blockers, KalshiEventContractFixtureIssueCode.InvalidTerms, "seriesBody.series.settlement_sources", "Settlement source must be the reviewed CF Benchmarks record.");
  }
  for (const field of ["open_time", "close_time"] as const) validProviderTimestamp(market[field], `marketBody.market.${field}`, blockers);
  validProviderTimestamp(series.last_updated_ts, "seriesBody.series.last_updated_ts", blockers);
  if (typeof market.open_time === "string" && typeof market.close_time === "string"
    && Date.parse(market.close_time) - Date.parse(market.open_time) !== 900_000) {
    add(blockers, KalshiEventContractFixtureIssueCode.InvalidTerms, "marketBody.market", "Market window must be exactly fifteen minutes.");
  }
}

function validateSettlement(market: Record<string, unknown>, blockers: KalshiEventContractFixtureIssue[]): void {
  equal(market.status, "finalized", "marketBody.market.status", blockers);
  if (market.result !== "yes" && market.result !== "no") {
    add(blockers, KalshiEventContractFixtureIssueCode.InvalidPayload, "marketBody.market.result", "Final result must be yes or no.");
  }
  if (typeof market.expiration_value !== "string" || !/^\d+\.\d{2}$/u.test(market.expiration_value)) {
    add(blockers, KalshiEventContractFixtureIssueCode.InvalidPayload, "marketBody.market.expiration_value", "Expiration value must be a two-decimal string.");
  }
  if (typeof market.settlement_value_dollars !== "string" || !/^(?:0|1)\.\d{4}$/u.test(market.settlement_value_dollars)) {
    add(blockers, KalshiEventContractFixtureIssueCode.InvalidPayload, "marketBody.market.settlement_value_dollars", "Settlement value must be a bounded dollar string.");
  }
  validProviderTimestamp(market.settlement_ts, "marketBody.market.settlement_ts", blockers);
  if (typeof market.close_time === "string" && typeof market.settlement_ts === "string"
    && Date.parse(market.settlement_ts) < Date.parse(market.close_time)) {
    add(blockers, KalshiEventContractFixtureIssueCode.InvalidChronology, "marketBody.market.settlement_ts", "Settlement cannot predate market close.");
  }
}

function chronology(input: Readonly<KalshiEventContractFixtureInput>, blockers: KalshiEventContractFixtureIssue[]): void {
  const fields = [input.observedAt, input.receivedAt, input.normalizedAt];
  if (!fields.every(isCanonicalTimestamp)) {
    add(blockers, KalshiEventContractFixtureIssueCode.InvalidChronology, "input", "Fixture chronology must use canonical UTC timestamps.");
    return;
  }
  if (Date.parse(input.observedAt) > Date.parse(input.receivedAt)
    || Date.parse(input.receivedAt) > Date.parse(input.normalizedAt)) {
    add(blockers, KalshiEventContractFixtureIssueCode.InvalidChronology, "input", "Fixture chronology is invalid.");
  }
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], field: string, blockers: KalshiEventContractFixtureIssue[]): void {
  const expected = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) add(blockers, KalshiEventContractFixtureIssueCode.UnknownField, `${field}.${key}`, "Field is not part of the reviewed fixture schema.");
  }
  for (const key of keys) {
    if (!(key in value)) add(blockers, KalshiEventContractFixtureIssueCode.InvalidPayload, `${field}.${key}`, "Required field is missing.");
  }
}

function record(value: unknown, field: string, blockers: KalshiEventContractFixtureIssue[]): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    add(blockers, KalshiEventContractFixtureIssueCode.InvalidPayload, field, "Value must be an object.");
    return undefined;
  }
  return value;
}

function stringArray(value: unknown, field: string, blockers: KalshiEventContractFixtureIssue[]): void {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string")) {
    add(blockers, KalshiEventContractFixtureIssueCode.InvalidPayload, field, "Value must be a non-empty string array.");
  }
}

function equal(actual: unknown, expected: unknown, field: string, blockers: KalshiEventContractFixtureIssue[]): void {
  if (actual !== expected) add(blockers, KalshiEventContractFixtureIssueCode.IdentityMismatch, field, "Value does not match the reviewed official fixture.");
}

function validProviderTimestamp(value: unknown, field: string, blockers: KalshiEventContractFixtureIssue[]): void {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    add(blockers, KalshiEventContractFixtureIssueCode.InvalidPayload, field, "Provider timestamp is invalid.");
  }
}

function canonicalTimestamp(value: string): string {
  return new Date(Date.parse(value)).toISOString();
}

function decimalFromNumber(value: number): EventContractFixedDecimal {
  return decimalFromString(value.toFixed(2));
}

function decimalFromString(value: string): EventContractFixedDecimal {
  const [whole, fraction = ""] = value.split(".");
  return { atomicValue: `${whole ?? ""}${fraction}`, scale: fraction.length };
}

function dollarsToBasisPoints(value: string): number {
  const decimal = decimalFromString(value);
  const atomic = Number(decimal.atomicValue);
  return decimal.scale === 4 ? atomic : atomic * (10 ** (4 - decimal.scale));
}

function rejected(blockers: readonly KalshiEventContractFixtureIssue[]): KalshiEventContractFixtureResult {
  return deepFreeze({
    schemaVersion: KALSHI_EVENT_CONTRACT_FIXTURE_SCHEMA_VERSION,
    status: KalshiEventContractFixtureStatus.Rejected,
    blockers: [...blockers].sort((left, right) => `${left.field}|${left.code}`.localeCompare(`${right.field}|${right.code}`)),
    eligibleForSourceSnapshot: false,
    sourceSnapshot: null,
  });
}

function add(blockers: KalshiEventContractFixtureIssue[], code: KalshiEventContractFixtureIssueCode, field: string, message: string): void {
  blockers.push({ code, field, message });
}

function fingerprint(value: unknown): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(canonicalize(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`).join(",")}}`;
}

function isCanonicalTimestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
