import {
  CANONICAL_INSTRUMENT_SCHEMA_VERSION,
  InstrumentAssetClass,
  InstrumentStatus,
  InstrumentType,
} from "../../../contracts/CanonicalInstrument";
import { BarInterval } from "../../../contracts/CanonicalBar";
import {
  MARKET_DATA_SCHEMA_VERSION,
  MarketDataBarMode,
  MarketDataCapability,
  MarketDataOperation,
  type MarketDataBarRequest,
} from "../../../contracts/MarketData";
import {
  TWELVE_DATA_ADAPTER_SCHEMA_VERSION,
  TWELVE_DATA_PROVIDER_ID,
  TwelveDataMappingReviewStatus,
  TwelveDataTransportKind,
  TwelveDataVolumeEvidenceStatus,
  type TwelveDataHttpRequest,
  type TwelveDataHttpResponse,
  type TwelveDataHttpTransport,
  type TwelveDataInstrumentMapping,
  type TwelveDataNormalizationPolicy,
} from "../../../contracts/TwelveDataAdapter";
import { TWELVE_DATA_AAPL_FIXTURE_MAPPING } from "./TwelveDataProvider";

export const FIXTURE_RECEIVED_AT = "2026-07-20T14:45:00.000Z";
export const FIXTURE_NORMALIZED_AT = "2026-07-20T14:45:01.000Z";

export function fixtureRequest(overrides: Partial<MarketDataBarRequest> = {}): MarketDataBarRequest {
  return {
    schemaVersion: MARKET_DATA_SCHEMA_VERSION,
    requestId: "request:twelve-data:bars:1",
    operation: MarketDataOperation.Bars,
    providerId: TWELVE_DATA_PROVIDER_ID,
    barMode: MarketDataBarMode.Historical,
    instrument: { instrumentId: TWELVE_DATA_AAPL_FIXTURE_MAPPING.canonicalInstrument.instrumentId },
    interval: BarInterval.FiveMinutes,
    startTime: "2026-07-20T14:30:00.000Z",
    endTime: "2026-07-20T14:40:00.000Z",
    maxRecords: 20,
    requestedAt: "2026-07-20T14:44:59.000Z",
    evaluatedAt: FIXTURE_NORMALIZED_AT,
    policy: {
      schemaVersion: MARKET_DATA_SCHEMA_VERSION,
      policyId: "market-data-bars:twelve-data:1",
      version: "1.0",
      allowedProviderIds: [TWELVE_DATA_PROVIDER_ID],
      requiredCapabilities: [MarketDataCapability.Bars],
      maxRecords: 100,
    },
    trace: { correlationId: "correlation:twelve-data:1" },
    ...overrides,
  };
}

export function fixturePolicy(overrides: Partial<TwelveDataNormalizationPolicy> = {}): TwelveDataNormalizationPolicy {
  return {
    schemaVersion: TWELVE_DATA_ADAPTER_SCHEMA_VERSION,
    policyId: "twelve-data-bar-policy:1",
    version: "1.0",
    closureBufferSeconds: 120,
    maxAgeSeconds: 3_600,
    allowedAssetClasses: [InstrumentAssetClass.Equity, InstrumentAssetClass.Etf],
    allowedIntervals: [BarInterval.OneMinute, BarInterval.FiveMinutes, BarInterval.FifteenMinutes, BarInterval.OneHour],
    volumeEvidenceStatus: TwelveDataVolumeEvidenceStatus.FixtureReviewed,
    ...overrides,
  };
}

export function fixtureBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    meta: {
      symbol: "AAPL",
      interval: "5min",
      currency: "USD",
      exchange: "NASDAQ",
      mic_code: "XNAS",
      exchange_timezone: "America/New_York",
      type: "Common Stock",
    },
    values: [
      { datetime: "2026-07-20 14:30:00", open: "224.1000", high: "224.5000", low: "224.0000", close: "224.3000", volume: "12500" },
      { datetime: "2026-07-20 14:35:00", open: "224.3000", high: "224.6000", low: "224.2000", close: "224.5500", volume: "8400" },
    ],
    status: "ok",
    ...overrides,
  });
}

export const TWELVE_DATA_SPY_TEST_MAPPING: TwelveDataInstrumentMapping = {
  schemaVersion: TWELVE_DATA_ADAPTER_SCHEMA_VERSION,
  mappingId: "mapping:twelve-data:spy:test:1",
  mappingVersion: "test-reviewed-1",
  providerId: TWELVE_DATA_PROVIDER_ID,
  providerSymbol: "SPY",
  providerExchangeId: "NYSE ARCA",
  providerMic: "ARCX",
  providerAssetType: "ETF",
  canonicalInstrument: {
    schemaVersion: CANONICAL_INSTRUMENT_SCHEMA_VERSION,
    instrumentId: "instrument:00000000000000000000000002",
    metadataVersion: "test-reviewed-1",
    displaySymbol: "SPY",
    displayName: "SPDR S&P 500 ETF Trust",
    assetClass: InstrumentAssetClass.Etf,
    instrumentType: InstrumentType.ExchangeTradedFund,
    status: InstrumentStatus.Active,
    currency: "USD",
    exchange: "ARCX",
    timezone: "America/New_York",
    effectiveFrom: "2026-07-20T00:00:00.000Z",
  },
  effectiveFrom: "2026-07-20T00:00:00.000Z",
  sourceReference: "test-fixture:owner-reviewed-spy-mapping",
  reviewStatus: TwelveDataMappingReviewStatus.Approved,
};

export class FixtureTwelveDataTransport implements TwelveDataHttpTransport {
  public request?: TwelveDataHttpRequest;
  public credentialObserved = false;
  public response: TwelveDataHttpResponse = {
    statusCode: 200,
    receivedAt: FIXTURE_RECEIVED_AT,
    transportKind: TwelveDataTransportKind.Fixture,
    body: fixtureBody(),
  };

  public async execute(request: Readonly<TwelveDataHttpRequest>, credentials: Readonly<{ apiKey: string }>): Promise<TwelveDataHttpResponse> {
    this.request = request;
    this.credentialObserved = credentials.apiKey === "fixture-secret-value";
    return this.response;
  }
}
