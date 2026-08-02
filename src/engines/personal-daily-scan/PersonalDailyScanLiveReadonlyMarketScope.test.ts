import { generateKeyPairSync, sign } from "node:crypto";
import {
  LIVE_READONLY_PROVIDER_SEMANTICS_SCHEMA_VERSION,
  LiveReadonlyMarketScopeIssueCode,
  type LiveReadonlyCanonicalBarEvidence,
  type LiveReadonlyCanonicalQuoteEvidence,
  type LiveReadonlyCompiledPlan,
  type LiveReadonlyMarketScopeGateInput,
  type LiveReadonlyProviderSemanticsEvidence,
  type LiveReadonlyRawHttpResponse,
  type LiveReadonlyResponseBatch,
} from "../../contracts/PersonalDailyScanLiveReadonlyMarketScope";
import type {
  ExchangeCalendarBody,
  ExchangeCalendarEvidence,
  LiveReadonlyPreflightInput,
  LiveReadonlyRequestPlanEntry,
  OwnerNetworkAuthorizationBody,
  OwnerNetworkAuthorizationManifest,
  TrustedOwnerVerificationKey,
} from "../../contracts/PersonalDailyScanLiveReadonly";
import {
  VerifiedMarketDataOrigin,
  VerifiedMarketEvidenceResolutionResult,
  VerifiedMarketProviderAttemptResult,
  VerifiedMarketProviderCapability,
  type CanonicalBarReference,
  type CanonicalQuoteReference,
  type EvidenceResolution,
  type ProviderRequestAttempt,
} from "../../contracts/VerifiedMarketSnapshot";
import {
  createOwnerAuthorizationVerifier,
  exchangeCalendarSignatureMessage,
  liveReadonlyPlanFingerprint,
  liveReadonlyRequestFingerprint,
  ownerAuthorizationSignatureMessage,
  sha256Jcs,
  trustedPublicKeyFingerprint,
} from "./PersonalDailyScanLiveReadonlyPreflight";
import {
  compileLiveReadonlyMarketScopePlan,
  compileStructuralFixtureMarketScopePlan,
  liveReadonlyMappingRegistryContentFingerprint,
  liveReadonlyProductMappingRegistryFingerprint,
  liveReadonlyProviderSemanticsFingerprint,
  PersonalDailyScanLiveReadonlyTransportError,
  unprovenAlpacaProviderSemanticsEvidence,
  validateLiveReadonlyMarketScopeEvidence,
} from "./PersonalDailyScanLiveReadonlyMarketScope";
import { createPersonalDailyScanLiveReadonlyProductOperation } from "./PersonalDailyScanLiveReadonlyProductComposition";
import { createPersonalDailyScanLiveReadonlyTestOperation } from "./testing/PersonalDailyScanLiveReadonlyTestFactory";
import {
  approvePersonalWatchlistMappingRegistry,
  createResearchVerifiedPersonalWatchlistCatalog,
} from "../personal-watchlist-mapping/PersonalWatchlistMappingRegistry";
import {
  verifiedEvidenceResolutionFingerprint,
  verifiedProviderRequestFingerprint,
  verifiedProviderSymbolMappingFingerprint,
} from "../verified-market-snapshot/VerifiedMarketSnapshotEngine";
import process from "node:process";
import * as personalDailyScanProductBarrel from "./index";

type Test = readonly [string, () => void | Promise<void>];
const tests: Test[] = [];
function test(name: string, run: () => void | Promise<void>): void { tests.push([name, run]); }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function equal(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}
type Mutable<T> = T extends readonly (infer Entry)[] ? Mutable<Entry>[] : T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T;
function clone<T>(value: T): Mutable<T> { return JSON.parse(JSON.stringify(value)) as Mutable<T>; }

const CALENDAR = `sha256:${"a".repeat(64)}`;
const MAPPING_ID = "personal-watchlist:mvp-2026-07";
const MAPPING_VERSION = "1.1";
const MAPPING_FINGERPRINT = liveReadonlyProductMappingRegistryFingerprint();
const IDS: Readonly<Record<string, string>> = Object.freeze({
  MU: "instrument:00000000000000000000000101", MULL: "instrument:00000000000000000000000102",
  TSLA: "instrument:00000000000000000000000104", TSLL: "instrument:00000000000000000000000105",
  TSLQ: "instrument:00000000000000000000000106", SPCX: "instrument:00000000000000000000000107",
  SPCH: "instrument:00000000000000000000000108", SSPC: "instrument:00000000000000000000000109",
  SKHY: "instrument:00000000000000000000000110", SKUU: "instrument:00000000000000000000000111",
  SKDD: "instrument:00000000000000000000000112", QQQ: "instrument:00000000000000000000000201",
  SMH: "instrument:00000000000000000000000202",
});

function requestDescriptors(calendarEvidenceFingerprint = CALENDAR): readonly Omit<LiveReadonlyRequestPlanEntry, "requestFingerprint">[] {
  const common = { method: "GET" as const, host: "data.alpaca.markets" as const, feed: "iex" as const, currency: "USD" as const,
    timeoutMs: 10_000, maximumResponseBytes: 1_048_576, calendarEvidenceFingerprint,
    mappingRegistryId: MAPPING_ID, mappingRegistryVersion: MAPPING_VERSION, mappingRegistryFingerprint: MAPPING_FINGERPRINT };
  return [
    { ...common, ordinal: 1, path: "/v2/stocks/bars", capability: "BARS", interval: "P1D", symbols: ["MU", "QQQ", "SKHY", "SMH", "SPCX", "TSLA"], adjustment: "raw", sort: "asc", start: "2026-07-28T13:30:00.000Z", end: "2026-07-29T20:00:00.000Z", limit: 2, maximumEvidenceRecords: 12 },
    { ...common, ordinal: 2, path: "/v2/stocks/bars", capability: "BARS", interval: "PT1H", symbols: ["MU", "SKHY", "SPCX", "TSLA"], adjustment: "raw", sort: "asc", start: "2026-07-29T13:30:00.000Z", end: "2026-07-29T20:00:00.000Z", limit: 2, maximumEvidenceRecords: 8 },
    { ...common, ordinal: 3, path: "/v2/stocks/bars", capability: "BARS", interval: "PT15M", symbols: ["MU", "SKHY", "SPCX", "TSLA"], adjustment: "raw", sort: "asc", start: "2026-07-29T13:30:00.000Z", end: "2026-07-29T20:00:00.000Z", limit: 2, maximumEvidenceRecords: 8 },
    { ...common, ordinal: 4, path: "/v2/stocks/bars", capability: "BARS", interval: "PT5M", symbols: ["MU", "SKHY", "SPCX", "TSLA"], adjustment: "raw", sort: "asc", start: "2026-07-29T13:30:00.000Z", end: "2026-07-29T20:00:00.000Z", limit: 2, maximumEvidenceRecords: 8 },
    { ...common, ordinal: 5, path: "/v2/stocks/quotes/latest", capability: "LATEST_QUOTES", interval: "NONE", symbols: ["MULL", "SKDD", "SKUU", "SPCH", "SSPC", "TSLL", "TSLQ"], adjustment: "NONE", sort: "NONE", start: null, end: null, limit: null, maximumEvidenceRecords: 7 },
  ];
}

function bodyFromDescriptors(
  descriptors: readonly Omit<LiveReadonlyRequestPlanEntry, "requestFingerprint">[] = requestDescriptors(),
  calendarEvidenceId = "calendar-evidence:phase1b-c2",
): OwnerNetworkAuthorizationBody {
  const requests = descriptors.map((descriptor) => ({ ...descriptor, requestFingerprint: liveReadonlyRequestFingerprint(descriptor) }));
  const calendarEvidenceFingerprint = requests[0]!.calendarEvidenceFingerprint;
  return {
    schemaVersion: "1.1", authorizationType: "PERSONAL_DAILY_SCAN_LIVE_READONLY", authorizationId: "authorization:phase1b-c2-test",
    ownerDecisionReference: "owner-decision:phase1b-c2", executeDate: "2026-07-30", validFrom: "2026-07-30T13:55:00.000Z",
    expiresAt: "2026-07-30T14:05:00.000Z", provider: "ALPACA_MARKET_DATA", feed: "iex", mappingRegistryId: MAPPING_ID,
    mappingRegistryVersion: MAPPING_VERSION, mappingRegistryFingerprint: MAPPING_FINGERPRINT,
    calendarEvidenceId, calendarEvidenceFingerprint,
    planFingerprint: liveReadonlyPlanFingerprint(requests, calendarEvidenceFingerprint, MAPPING_ID, MAPPING_VERSION, MAPPING_FINGERPRINT), maximumNetworkRequests: 5,
    maximumAttemptsPerRequest: 1, retryAllowed: false, paginationAllowed: false, pollingAllowed: false, streamingAllowed: false,
    backgroundExecutionAllowed: false, credentialReadAllowedAfterPreflightOnly: true, persistenceAllowed: false,
    accountAccessAllowed: false, positionAccessAllowed: false, balanceAccessAllowed: false, orderAccessAllowed: false,
    brokerAllowed: false, paperTradingAllowed: false, automatedExecutionAllowed: false, requests,
  };
}

const ownerKeys = generateKeyPairSync("ed25519");
const ownerPublicKeyPem = ownerKeys.publicKey.export({ format: "pem", type: "spki" });
const ownerTrust: TrustedOwnerVerificationKey = {
  source: "PINNED_PRODUCT_CONFIGURATION",
  ownerKeyId: "owner-key:phase1b-c2-r1-test",
  publicKeyPem: ownerPublicKeyPem,
  publicKeyFingerprint: trustedPublicKeyFingerprint(ownerPublicKeyPem),
};
const productOwnerVerifier = createOwnerAuthorizationVerifier(Object.freeze({
  getPinnedOwnerVerificationKey: (): TrustedOwnerVerificationKey => ownerTrust,
}));

function base64(value: Uint8Array): string { return btoa(String.fromCharCode(...value)); }

function signedProductInput(): LiveReadonlyPreflightInput {
  const calendarBody: ExchangeCalendarBody = {
    schemaVersion: "1.0",
    evidenceId: "calendar-evidence:phase1b-c2-r1-test",
    calendarId: "US_EQUITIES_PRIMARY_SESSION",
    calendarVersion: "exchange-calendar:2026.07",
    producerId: "calendar-producer:test",
    producerVersion: "producer:v1",
    authoritySource: "owner-approved-exchange-calendar",
    ownerDecisionReference: "owner-decision:phase1b-d2-c2-r1",
    timezone: "America/New_York",
    validFrom: "2026-01-01T00:00:00.000Z",
    validThrough: "2026-12-31T23:59:59.999Z",
    closureBufferSeconds: 300,
    sessions: [
      { sessionDate: "2026-07-28", status: "TRADING_SESSION", marketOpen: "2026-07-28T13:30:00.000Z", marketClose: "2026-07-28T20:00:00.000Z", earlyClose: false },
      { sessionDate: "2026-07-29", status: "TRADING_SESSION", marketOpen: "2026-07-29T13:30:00.000Z", marketClose: "2026-07-29T20:00:00.000Z", earlyClose: false },
      { sessionDate: "2026-07-30", status: "TRADING_SESSION", marketOpen: "2026-07-30T13:30:00.000Z", marketClose: "2026-07-30T20:00:00.000Z", earlyClose: false },
    ],
  };
  const calendarSha256 = sha256Jcs(calendarBody);
  const calendarEvidence: ExchangeCalendarEvidence = {
    calendarBody,
    ownerApprovalEnvelope: {
      calendarSha256,
      signatureAlgorithm: "Ed25519",
      ownerKeyId: ownerTrust.ownerKeyId,
      ownerPublicKeyFingerprint: ownerTrust.publicKeyFingerprint,
      ownerSignature: base64(sign(null, exchangeCalendarSignatureMessage(calendarSha256), ownerKeys.privateKey)),
    },
  };
  const body = bodyFromDescriptors(requestDescriptors(calendarSha256), calendarBody.evidenceId);
  const manifestSha256 = sha256Jcs(body);
  const manifest: OwnerNetworkAuthorizationManifest = {
    authorizationBody: body,
    ownerApprovalEnvelope: {
      manifestSha256,
      signatureAlgorithm: "Ed25519",
      ownerKeyId: ownerTrust.ownerKeyId,
      ownerPublicKeyFingerprint: ownerTrust.publicKeyFingerprint,
      ownerSignature: base64(sign(null, ownerAuthorizationSignatureMessage(manifestSha256), ownerKeys.privateKey)),
    },
  };
  return { asOf: "2026-07-30T14:00:00.000Z", calendarEvidence, manifest };
}

function provenTestProviderSemantics(): LiveReadonlyProviderSemanticsEvidence {
  const descriptor = {
    schemaVersion: LIVE_READONLY_PROVIDER_SEMANTICS_SCHEMA_VERSION,
    evidenceId: "provider-semantics:test-only-exact-limit",
    provider: "ALPACA_MARKET_DATA" as const,
    endpoint: "/v2/stocks/bars" as const,
    status: "PROVEN_MULTI_SYMBOL_PER_SYMBOL_EXACT_LIMIT" as const,
    authoritySource: "PRODUCT_CONFIGURATION" as const,
    maximumNetworkRequests: 5 as const,
    paginationAllowed: false as const,
  };
  return { ...descriptor, evidenceFingerprint: liveReadonlyProviderSemanticsFingerprint(descriptor) };
}

function validFixture(): LiveReadonlyMarketScopeGateInput {
  const authorizationBody = bodyFromDescriptors();
  const planResult = compileStructuralFixtureMarketScopePlan(authorizationBody);
  assert(planResult.plan !== null, "valid plan");
  const compiledPlan = planResult.plan;
  const responseBatches = compiledPlan.requests.map((request) => responseBatch(request));
  const evidenceResolutions = resolutions(responseBatches);
  return { compiledPlan, responseBatches, evidenceResolutions };
}

function responseBatch(request: LiveReadonlyCompiledPlan["requests"][number]): LiveReadonlyResponseBatch {
  const quoteStart = "2026-07-30T13:59:00.000Z";
  const quoteEnd = "2026-07-30T14:00:00.000Z";
  const capability = request.capability === "BARS" ? VerifiedMarketProviderCapability.Bars : VerifiedMarketProviderCapability.LatestQuote;
  const interval = request.capability === "BARS" ? request.interval as CanonicalBarReference["interval"] : undefined;
  const descriptor = {
    requestAttemptId: `${request.requestId}:attempt:1`, requestId: request.requestId, requestedProvider: "provider:alpaca-basic-iex",
    capability, ...(interval === undefined ? {} : { interval }), requestedSymbolScope: request.symbols,
    mappingRegistryVersion: MAPPING_VERSION,
    mappingRegistryId: MAPPING_ID,
    mappingRegistryFingerprint: MAPPING_FINGERPRINT,
    requestWindowStart: request.capability === "BARS" ? parameter(request, "start") : quoteStart,
    requestWindowEnd: request.capability === "BARS" ? parameter(request, "end") : quoteEnd,
  };
  const attempt: ProviderRequestAttempt = {
    ...descriptor, actualProvider: "provider:alpaca-basic-iex", requestFingerprint: verifiedProviderRequestFingerprint(descriptor),
    attemptOrder: request.ordinal, result: VerifiedMarketProviderAttemptResult.Succeeded, receivedAt: quoteEnd,
    responseSourceReference: `fixture-response:phase1b-c2:${request.ordinal}`, dataOrigin: VerifiedMarketDataOrigin.Fixture,
    adapterUnderTest: "adapter:alpaca-personal-market-data",
  };
  return {
    ordinal: request.ordinal, requestFingerprint: request.requestFingerprint, queryFingerprint: request.queryFingerprint,
    nextPageToken: null, responseBytes: 4096, attempt,
    bars: request.capability === "BARS" ? request.symbols.flatMap((symbol) => barPair(symbol, request)) : [],
    quotes: request.capability === "LATEST_QUOTES" ? request.symbols.map((symbol) => quote(symbol)) : [],
  };
}

function barPair(symbol: string, request: LiveReadonlyCompiledPlan["requests"][number]): readonly LiveReadonlyCanonicalBarEvidence[] {
  const windows = request.interval === "P1D" ? [
    ["2026-07-28T13:30:00.000Z", "2026-07-28T20:00:00.000Z", "2026-07-28"],
    ["2026-07-29T13:30:00.000Z", "2026-07-29T20:00:00.000Z", "2026-07-29"],
  ] : request.interval === "PT1H" ? [
    ["2026-07-29T18:00:00.000Z", "2026-07-29T19:00:00.000Z", "2026-07-29"],
    ["2026-07-29T19:00:00.000Z", "2026-07-29T20:00:00.000Z", "2026-07-29"],
  ] : request.interval === "PT15M" ? [
    ["2026-07-29T19:30:00.000Z", "2026-07-29T19:45:00.000Z", "2026-07-29"],
    ["2026-07-29T19:45:00.000Z", "2026-07-29T20:00:00.000Z", "2026-07-29"],
  ] : [
    ["2026-07-29T19:50:00.000Z", "2026-07-29T19:55:00.000Z", "2026-07-29"],
    ["2026-07-29T19:55:00.000Z", "2026-07-29T20:00:00.000Z", "2026-07-29"],
  ];
  return windows.map(([start, end, sessionDate], index) => {
    const id = `bar:${symbol}:${request.interval}:${index + 1}`;
    const reference: CanonicalBarReference = {
      canonicalBarId: id, canonicalBarFingerprint: `fingerprint:${id}`, canonicalInstrumentId: IDS[symbol]!,
      interval: request.interval as CanonicalBarReference["interval"], intervalStart: start!, intervalEnd: end!, observationTime: end!,
      sessionDate: sessionDate!, status: "FINAL", freshness: "CURRENT", provenanceReference: `fixture-provenance:${id}`,
    };
    return { capability: "BARS", providerSymbol: symbol, mappingRegistryId: MAPPING_ID,
      mappingRegistryVersion: MAPPING_VERSION, mappingRegistryFingerprint: MAPPING_FINGERPRINT,
      providerSymbolMappingVersion: MAPPING_VERSION,
      providerSymbolMappingFingerprint: verifiedProviderSymbolMappingFingerprint({ canonicalInstrumentId: IDS[symbol]!, providerSymbol: symbol, providerSymbolMappingVersion: MAPPING_VERSION }), reference };
  });
}

function quote(symbol: string): LiveReadonlyCanonicalQuoteEvidence {
  const id = `quote:${symbol}:latest`;
  const reference: CanonicalQuoteReference = {
    canonicalQuoteId: id, canonicalQuoteFingerprint: `fingerprint:${id}`, canonicalInstrumentId: IDS[symbol]!,
    observationTime: "2026-07-30T13:59:30.000Z", status: "CURRENT", provenanceReference: `fixture-provenance:${id}`,
  };
  return { capability: "LATEST_QUOTES", providerSymbol: symbol, mappingRegistryId: MAPPING_ID,
    mappingRegistryVersion: MAPPING_VERSION, mappingRegistryFingerprint: MAPPING_FINGERPRINT,
    providerSymbolMappingVersion: MAPPING_VERSION,
    providerSymbolMappingFingerprint: verifiedProviderSymbolMappingFingerprint({ canonicalInstrumentId: IDS[symbol]!, providerSymbol: symbol, providerSymbolMappingVersion: MAPPING_VERSION }), reference };
}

function resolutions(batches: readonly LiveReadonlyResponseBatch[]): EvidenceResolution[] {
  return batches.flatMap((batch) => [...batch.bars, ...batch.quotes].map((entry) => {
    const isBar = entry.capability === "BARS";
    const reference = entry.reference;
    const capability = isBar ? VerifiedMarketProviderCapability.Bars : VerifiedMarketProviderCapability.LatestQuote;
    const evidenceId = isBar ? (reference as CanonicalBarReference).canonicalBarId : (reference as CanonicalQuoteReference).canonicalQuoteId;
    const evidenceFingerprint = isBar ? (reference as CanonicalBarReference).canonicalBarFingerprint : (reference as CanonicalQuoteReference).canonicalQuoteFingerprint;
    const interval = isBar ? (reference as CanonicalBarReference).interval : undefined;
    const descriptor = {
      resolutionId: `evidence-resolution:${capability}:${evidenceId}`, result: VerifiedMarketEvidenceResolutionResult.Resolved,
      requestAttemptId: batch.attempt.requestAttemptId, evidenceId, evidenceFingerprint,
      canonicalInstrumentId: reference.canonicalInstrumentId, providerSymbol: entry.providerSymbol,
      providerSymbolMappingVersion: entry.providerSymbolMappingVersion, providerSymbolMappingFingerprint: entry.providerSymbolMappingFingerprint,
      mappingRegistryId: entry.mappingRegistryId, mappingRegistryVersion: entry.mappingRegistryVersion,
      mappingRegistryFingerprint: entry.mappingRegistryFingerprint,
      capability, ...(interval === undefined ? {} : { interval }),
      evidenceWindowStart: isBar ? (reference as CanonicalBarReference).intervalStart : reference.observationTime,
      evidenceWindowEnd: isBar ? (reference as CanonicalBarReference).intervalEnd : reference.observationTime,
      observedAt: reference.observationTime, provenanceReference: reference.provenanceReference,
      responseSourceReference: batch.attempt.responseSourceReference,
    };
    return { ...descriptor, resolutionFingerprint: verifiedEvidenceResolutionFingerprint(descriptor) };
  }));
}

function rawResponseFor(request: LiveReadonlyCompiledPlan["requests"][number]): LiveReadonlyRawHttpResponse {
  const batch = responseBatch(request);
  const body = JSON.stringify({
    schemaVersion: "alpha.alpaca.raw.market-data.v1",
    nextPageToken: null,
    bars: batch.bars.map((entry) => ({
      symbol: entry.providerSymbol,
      intervalStart: entry.reference.intervalStart,
      intervalEnd: entry.reference.intervalEnd,
      sessionDate: entry.reference.sessionDate,
      status: entry.reference.status,
    })),
    quotes: batch.quotes.map((entry) => ({
      symbol: entry.providerSymbol,
      observationTime: entry.reference.observationTime,
    })),
  });
  return {
    kind: "RESPONSE",
    ordinal: request.ordinal,
    requestId: request.requestId,
    requestFingerprint: request.requestFingerprint,
    httpStatus: 200,
    headers: [{ name: "content-type", value: "application/json" }],
    body,
    startedAt: "2026-07-30T13:59:59.000Z",
    endedAt: "2026-07-30T14:00:00.000Z",
  };
}

function parameter(request: LiveReadonlyCompiledPlan["requests"][number], name: string): string {
  return request.query.find((entry) => entry.name === name)!.value;
}
function assertBlocked(input: LiveReadonlyMarketScopeGateInput, expected: LiveReadonlyMarketScopeIssueCode): void {
  const result = validateLiveReadonlyMarketScopeEvidence(input);
  equal(result.status, "BLOCKED", "blocked status"); assert(result.issueCodes.includes(expected), `missing ${expected}`);
  equal(result.issueCodes, [...result.issueCodes].sort(), "stable issues");
  equal([result.canonicalBarReferences.length, result.canonicalQuoteReferences.length, result.providerRequestAttempts.length, result.evidenceResolutions.length, result.candidates.length], [0, 0, 0, 0, 0], "no partial output");
  equal([result.credentialReadPermitted, result.attemptedNetworkRequests, result.completedNetworkRequests, result.persistenceWrites, result.automatedExecutionAllowed], [false, 0, 0, 0, false], "zero authority and side effects");
}

test("exact five-request plan authorizes only 36 Bars and 7 Quotes", () => {
  const fixture = validFixture(); const result = validateLiveReadonlyMarketScopeEvidence(fixture);
  equal([result.status, result.barEvidenceCount, result.quoteEvidenceCount, result.providerRequestAttempts.length, result.evidenceResolutions.length], ["VERIFIED", 36, 7, 5, 43], "exact evidence budget");
  equal(result.plan?.requests.map((request) => [request.ordinal, request.maximumEvidenceRecords]), [[1, 12], [2, 8], [3, 8], [4, 8], [5, 7]], "request maxima");
  equal([result.attemptedNetworkRequests, result.completedNetworkRequests, result.persistenceWrites, result.automatedExecutionAllowed], [0, 0, 0, false], "offline side effects");
});

test("an unverified raw Manifest body cannot mint a product compiled plan", () => {
  const result = compileLiveReadonlyMarketScopePlan(bodyFromDescriptors());
  equal(result.status, "BLOCKED", "raw Manifest must not compile");
  assert(result.issueCodes.includes(LiveReadonlyMarketScopeIssueCode.AuthorizationNotVerified), "authorization issue");
});

test("every Bars timeframe rejects one or three rows per symbol while two succeeds", () => {
  for (const ordinal of [1, 2, 3, 4]) {
    for (const count of [1, 3]) {
      const fixture = clone(validFixture()); const batch = fixture.responseBatches[ordinal - 1]!;
      const symbol = batch.bars[0]!.providerSymbol; const selected = batch.bars.filter((entry) => entry.providerSymbol === symbol);
      const replacement = count === 1 ? selected.slice(0, 1) : [...selected, { ...selected[1]!, reference: { ...selected[1]!.reference, canonicalBarId: `${selected[1]!.reference.canonicalBarId}:extra`, canonicalBarFingerprint: `${selected[1]!.reference.canonicalBarFingerprint}:extra` } }];
      const bars = [...batch.bars.filter((entry) => entry.providerSymbol !== symbol), ...replacement];
      fixture.responseBatches[ordinal - 1] = { ...batch, bars };
      fixture.evidenceResolutions = resolutions(fixture.responseBatches);
      assertBlocked(fixture, LiveReadonlyMarketScopeIssueCode.BarCountMismatch);
    }
  }
});

test("vehicle Quote missing, duplicate, or extra fails closed", () => {
  for (const mode of ["missing", "duplicate", "extra"] as const) {
    const fixture = clone(validFixture()); const batch = fixture.responseBatches[4]!;
    const quotes = mode === "missing" ? batch.quotes.slice(1) : mode === "duplicate" ? [...batch.quotes, batch.quotes[0]!] : [...batch.quotes, quote("MU")];
    fixture.responseBatches[4] = { ...batch, quotes }; fixture.evidenceResolutions = resolutions(fixture.responseBatches);
    assertBlocked(fixture, mode === "extra" ? LiveReadonlyMarketScopeIssueCode.ResponseScopeMismatch : LiveReadonlyMarketScopeIssueCode.QuoteCountMismatch);
  }
});

test("underlying Quotes, vehicle Bars, and QQQ or SMH intraday evidence are rejected", () => {
  for (const symbol of ["TSLA", "QQQ", "SMH"]) {
    const quoteFixture = clone(validFixture()); const quoteBatch = quoteFixture.responseBatches[4]!;
    quoteFixture.responseBatches[4] = { ...quoteBatch, quotes: [...quoteBatch.quotes, quote(symbol)] };
    quoteFixture.evidenceResolutions = resolutions(quoteFixture.responseBatches); assertBlocked(quoteFixture, LiveReadonlyMarketScopeIssueCode.ResponseScopeMismatch);
  }
  const vehicleFixture = clone(validFixture()); const barBatch = vehicleFixture.responseBatches[1]!;
  vehicleFixture.responseBatches[1] = { ...barBatch, bars: [...barBatch.bars, ...barPair("TSLL", vehicleFixture.compiledPlan.requests[1]!)] };
  vehicleFixture.evidenceResolutions = resolutions(vehicleFixture.responseBatches); assertBlocked(vehicleFixture, LiveReadonlyMarketScopeIssueCode.ResponseScopeMismatch);
  for (const symbol of ["QQQ", "SMH"]) {
    const benchmarkFixture = clone(validFixture()); const batch = benchmarkFixture.responseBatches[2]!;
    benchmarkFixture.responseBatches[2] = { ...batch, bars: [...batch.bars, ...barPair(symbol, benchmarkFixture.compiledPlan.requests[2]!)] };
    benchmarkFixture.evidenceResolutions = resolutions(benchmarkFixture.responseBatches); assertBlocked(benchmarkFixture, LiveReadonlyMarketScopeIssueCode.ResponseScopeMismatch);
  }
});

test("signed-scope-equivalent symbol addition, deletion, substitution, or reordering cannot plan", () => {
  const mutations = [
    (symbols: string[]) => [...symbols, "NVDA"].sort(),
    (symbols: string[]) => symbols.slice(1),
    (symbols: string[]) => symbols.map((symbol) => symbol === "MU" ? "NVDA" : symbol).sort(),
    (symbols: string[]) => [...symbols].reverse(),
  ];
  for (const mutate of mutations) {
    const descriptors = clone(requestDescriptors()); descriptors[0] = { ...descriptors[0]!, symbols: mutate([...descriptors[0]!.symbols]) };
    const result = compileStructuralFixtureMarketScopePlan(bodyFromDescriptors(descriptors));
    equal(result.status, "BLOCKED", "mutated scope"); assert(result.issueCodes.includes(LiveReadonlyMarketScopeIssueCode.RequestPlanInvalid), "scope issue");
  }
});

test("duplicate, exchanged, or sixth request is rejected", () => {
  for (const descriptors of [
    [requestDescriptors()[0]!, requestDescriptors()[0]!, ...requestDescriptors().slice(2)],
    [requestDescriptors()[1]!, requestDescriptors()[0]!, ...requestDescriptors().slice(2)],
    [...requestDescriptors(), requestDescriptors()[4]!],
  ]) {
    const result = compileStructuralFixtureMarketScopePlan(bodyFromDescriptors(descriptors));
    equal(result.status, "BLOCKED", "request ordering/budget"); assert(result.issueCodes.includes(LiveReadonlyMarketScopeIssueCode.RequestPlanInvalid), "plan issue");
  }
});

test("maximum Bar limit is two and the signed request window is immutable at query execution", () => {
  const descriptors = clone(requestDescriptors()); descriptors[1] = { ...descriptors[1]!, limit: 3 };
  const invalidBudget = compileStructuralFixtureMarketScopePlan(bodyFromDescriptors(descriptors));
  equal(invalidBudget.status, "BLOCKED", "budget mutation");
  assert(invalidBudget.issueCodes.includes(LiveReadonlyMarketScopeIssueCode.RequestPlanInvalid), "plan issue");
  for (const [name, value] of [["start", "2026-07-29T13:35:00.000Z"], ["end", "2026-07-29T19:55:00.000Z"]] as const) {
    const fixture = clone(validFixture());
    fixture.compiledPlan.requests[1]!.query.find((entry) => entry.name === name)!.value = value;
    assertBlocked(fixture, LiveReadonlyMarketScopeIssueCode.QueryMutation);
  }
});

test("actual Query or request fingerprint mutation fails before evidence acceptance", () => {
  const queryFixture = clone(validFixture()); queryFixture.compiledPlan.requests[0]!.query[0]!.value = "MU,NVDA";
  assertBlocked(queryFixture, LiveReadonlyMarketScopeIssueCode.QueryMutation);
  const fingerprintFixture = clone(validFixture()); fingerprintFixture.responseBatches[0]!.requestFingerprint = `sha256:${"b".repeat(64)}`;
  assertBlocked(fingerprintFixture, LiveReadonlyMarketScopeIssueCode.QueryMutation);
  const planFixture = clone(validFixture()); planFixture.compiledPlan.planFingerprint = `sha256:${"c".repeat(64)}`;
  assertBlocked(planFixture, LiveReadonlyMarketScopeIssueCode.QueryMutation);
});

test("non-empty pagination token blocks without requesting page two", () => {
  const fixture = clone(validFixture()); fixture.responseBatches[0]!.nextPageToken = "next-secret-page";
  assertBlocked(fixture, LiveReadonlyMarketScopeIssueCode.PaginationForbidden);
});

test("provider response cannot add undeclared symbol or capability evidence", () => {
  const fixture = clone(validFixture()); const batch = fixture.responseBatches[0]!;
  fixture.responseBatches[0] = { ...batch, bars: [...batch.bars, ...barPair("MULL", fixture.compiledPlan.requests[0]!)] };
  fixture.evidenceResolutions = resolutions(fixture.responseBatches);
  assertBlocked(fixture, LiveReadonlyMarketScopeIssueCode.ResponseScopeMismatch);
});

test("provider response symbol reordering and response byte overflow are rejected", () => {
  const bars = clone(validFixture());
  bars.responseBatches[0]!.bars = [...bars.responseBatches[0]!.bars].reverse();
  bars.evidenceResolutions = resolutions(bars.responseBatches);
  assertBlocked(bars, LiveReadonlyMarketScopeIssueCode.ResponseOrderMismatch);
  const quotes = clone(validFixture());
  quotes.responseBatches[4]!.quotes = [...quotes.responseBatches[4]!.quotes].reverse();
  quotes.evidenceResolutions = resolutions(quotes.responseBatches);
  assertBlocked(quotes, LiveReadonlyMarketScopeIssueCode.ResponseOrderMismatch);
  const oversized = clone(validFixture());
  oversized.responseBatches[0]!.responseBytes = 1_048_577;
  assertBlocked(oversized, LiveReadonlyMarketScopeIssueCode.ResponseBudgetExceeded);
});

test("response request ordinal repetition and exchange fail closed", () => {
  for (const batches of [
    (source: Mutable<LiveReadonlyResponseBatch>[]) => [source[0]!, source[0]!, ...source.slice(2)],
    (source: Mutable<LiveReadonlyResponseBatch>[]) => [source[1]!, source[0]!, ...source.slice(2)],
  ]) {
    const fixture = clone(validFixture()); fixture.responseBatches = batches([...fixture.responseBatches]);
    assertBlocked(fixture, LiveReadonlyMarketScopeIssueCode.RequestOrdinalMismatch);
  }
});

test("duplicate, incomplete, outside-window, cross-session, and future Bars fail closed", () => {
  const cases: readonly [Partial<CanonicalBarReference>, LiveReadonlyMarketScopeIssueCode][] = [
    [{ status: "STALE" as "FINAL" }, LiveReadonlyMarketScopeIssueCode.IncompleteBar],
    [{ intervalEnd: "2026-07-29T20:05:00.000Z" }, LiveReadonlyMarketScopeIssueCode.EvidenceWindowMismatch],
    [{ sessionDate: "2026-07-28" }, LiveReadonlyMarketScopeIssueCode.EvidenceWindowMismatch],
    [{ observationTime: "2026-07-30T14:01:00.000Z" }, LiveReadonlyMarketScopeIssueCode.FutureEvidence],
  ];
  for (const [change, issue] of cases) {
    const fixture = clone(validFixture()); const entry = fixture.responseBatches[1]!.bars[1]!;
    fixture.responseBatches[1]!.bars[1] = { ...entry, reference: { ...entry.reference, ...change } };
    fixture.evidenceResolutions = resolutions(fixture.responseBatches); assertBlocked(fixture, issue);
  }
  const duplicate = clone(validFixture()); duplicate.responseBatches[2]!.bars[1] = clone(duplicate.responseBatches[2]!.bars[0]!);
  duplicate.evidenceResolutions = resolutions(duplicate.responseBatches); assertBlocked(duplicate, LiveReadonlyMarketScopeIssueCode.DuplicateEvidence);
});

test("EvidenceResolution must be exactly 43 with one typed binding each", () => {
  for (const mutate of [
    (items: EvidenceResolution[]) => items.slice(1),
    (items: EvidenceResolution[]) => [...items, items[0]!],
    (items: EvidenceResolution[]) => items.map((entry, index) => index === 0 ? { ...entry, requestAttemptId: "ghost-attempt" } : entry),
  ]) {
    const fixture = clone(validFixture()); fixture.evidenceResolutions = mutate([...fixture.evidenceResolutions]);
    assertBlocked(fixture, LiveReadonlyMarketScopeIssueCode.EvidenceResolutionMismatch);
  }
});

test("mapping, attempt, and response-source bindings cannot drift", () => {
  for (const field of ["mappingRegistryId", "mappingRegistryVersion", "mappingRegistryFingerprint"] as const) {
    const mapping = clone(validFixture());
    mapping.responseBatches[0]!.bars[0]![field] = `${mapping.responseBatches[0]!.bars[0]![field]}:drift`;
    mapping.evidenceResolutions = resolutions(mapping.responseBatches);
    assertBlocked(mapping, LiveReadonlyMarketScopeIssueCode.ResponseScopeMismatch);
    const resolutionMapping = clone(validFixture());
    resolutionMapping.evidenceResolutions[0]![field] = `${resolutionMapping.evidenceResolutions[0]![field]}:drift`;
    assertBlocked(resolutionMapping, LiveReadonlyMarketScopeIssueCode.EvidenceResolutionMismatch);
  }
  const symbolMapping = clone(validFixture()); symbolMapping.responseBatches[0]!.bars[0]!.providerSymbolMappingVersion = "9.9";
  symbolMapping.evidenceResolutions = resolutions(symbolMapping.responseBatches); assertBlocked(symbolMapping, LiveReadonlyMarketScopeIssueCode.ResponseScopeMismatch);
  const attempt = clone(validFixture()); attempt.responseBatches[0]!.attempt.requestedSymbolScope = ["MU"];
  assertBlocked(attempt, LiveReadonlyMarketScopeIssueCode.ProviderAttemptMismatch);
  const resolution = clone(validFixture()); resolution.evidenceResolutions[0]!.responseSourceReference = "ghost-response";
  assertBlocked(resolution, LiveReadonlyMarketScopeIssueCode.EvidenceResolutionMismatch);
});

test("all failure paths retain zero network, persistence, candidates, and execution authority", () => {
  const fixture = clone(validFixture()); fixture.responseBatches = fixture.responseBatches.slice(0, 4);
  assertBlocked(fixture, LiveReadonlyMarketScopeIssueCode.RequestBudgetExceeded);
});

test("unproven Alpaca multi-symbol limit blocks the product path before Transport", async () => {
  let calls = 0;
  const operation = createPersonalDailyScanLiveReadonlyTestOperation({
    ownerAuthorizationVerifier: productOwnerVerifier,
    providerSemanticsEvidence: unprovenAlpacaProviderSemanticsEvidence(),
    rawTransport: { dispatchOnce: async (request, permit) => { calls += 1; permit.beginNetworkAttempt(); return rawResponseFor(request); } },
  });
  const result = await operation.run(signedProductInput());
  equal(result.status, "BLOCKED", "unproven status");
  equal(result.issueCodes, [LiveReadonlyMarketScopeIssueCode.ProviderLimitSemanticsUnproven], "exact blocker");
  equal([calls, result.attemptedNetworkRequests, result.completedNetworkRequests], [0, 0, 0], "network-before block");
  equal([result.candidates.length, result.persistenceWrites, result.automatedExecutionAllowed], [0, 0, false], "side effects");
});

test("flatMap structural fixture proves shape but cannot prove Provider capability", async () => {
  equal(validateLiveReadonlyMarketScopeEvidence(validFixture()).status, "VERIFIED", "fixture shape");
  const operation = createPersonalDailyScanLiveReadonlyTestOperation({
    ownerAuthorizationVerifier: productOwnerVerifier,
    providerSemanticsEvidence: unprovenAlpacaProviderSemanticsEvidence(),
    rawTransport: { dispatchOnce: async (request, permit) => { permit.beginNetworkAttempt(); return rawResponseFor(request); } },
  });
  const result = await operation.run(signedProductInput());
  equal(result.issueCodes, [LiveReadonlyMarketScopeIssueCode.ProviderLimitSemanticsUnproven], "fixture is not authority");
});

test("caller-forged VERIFIED payload cannot bypass the C1 verifier", async () => {
  let calls = 0;
  const operation = createPersonalDailyScanLiveReadonlyTestOperation({
    ownerAuthorizationVerifier: productOwnerVerifier,
    providerSemanticsEvidence: provenTestProviderSemantics(),
    rawTransport: { dispatchOnce: async (request, permit) => { calls += 1; permit.beginNetworkAttempt(); return rawResponseFor(request); } },
  });
  const result = await operation.run({ status: "VERIFIED", authorizationId: "forged", manifestSha256: `sha256:${"0".repeat(64)}` } as unknown as LiveReadonlyPreflightInput);
  equal(result.issueCodes, [LiveReadonlyMarketScopeIssueCode.AuthorizationNotVerified], "forgery blocker");
  equal([calls, result.attemptedNetworkRequests, result.completedNetworkRequests], [0, 0, 0], "no Transport");
});

test("C1 verification composes the exact C2 plan into the isolated raw test Transport", async () => {
  const observed: string[] = [];
  const operation = createPersonalDailyScanLiveReadonlyTestOperation({
    ownerAuthorizationVerifier: productOwnerVerifier,
    providerSemanticsEvidence: provenTestProviderSemantics(),
    rawTransport: { dispatchOnce: async (request, permit) => {
      permit.beginNetworkAttempt();
      observed.push(`${request.ordinal}:${request.method}:${request.host}${request.path}:${request.interval}:${parameter(request, "symbols")}:${request.capability === "BARS" ? parameter(request, "limit") : ""}`);
      return rawResponseFor(request);
    } },
  });
  const result = await operation.run(signedProductInput());
  equal(result.status, "VERIFIED", "product composition status");
  equal([result.barEvidenceCount, result.quoteEvidenceCount, result.evidenceResolutions.length], [36, 7, 43], "exact evidence");
  equal([result.attemptedNetworkRequests, result.completedNetworkRequests], [5, 5], "lifecycle counts");
  equal(observed, [
    "1:GET:data.alpaca.markets/v2/stocks/bars:P1D:MU,QQQ,SKHY,SMH,SPCX,TSLA:2",
    "2:GET:data.alpaca.markets/v2/stocks/bars:PT1H:MU,SKHY,SPCX,TSLA:2",
    "3:GET:data.alpaca.markets/v2/stocks/bars:PT15M:MU,SKHY,SPCX,TSLA:2",
    "4:GET:data.alpaca.markets/v2/stocks/bars:PT5M:MU,SKHY,SPCX,TSLA:2",
    "5:GET:data.alpaca.markets/v2/stocks/quotes/latest:NONE:MULL,SKDD,SKUU,SPCH,SSPC,TSLL,TSLQ:",
  ], "exact transport requests");
  equal(result.providerRequestAttempts.every((attempt) => attempt.dataOrigin === VerifiedMarketDataOrigin.Network), true, "product provenance");
  equal([result.candidates.length, result.persistenceWrites, result.automatedExecutionAllowed], [0, 0, false], "no product side effects");
});

test("HTTP, timeout, oversized, and parse failures preserve dispatcher-owned counts", async () => {
  for (const mode of ["HTTP", "TIMEOUT", "OVERSIZED", "PARSE"] as const) {
    const operation = createPersonalDailyScanLiveReadonlyTestOperation({
      ownerAuthorizationVerifier: productOwnerVerifier,
      providerSemanticsEvidence: provenTestProviderSemantics(),
      rawTransport: { dispatchOnce: async (request, permit) => {
        permit.beginNetworkAttempt();
        if (request.ordinal !== 3) return rawResponseFor(request);
        if (mode === "TIMEOUT") throw new PersonalDailyScanLiveReadonlyTransportError("TIMEOUT");
        const response = clone(rawResponseFor(request));
        if (mode === "HTTP") response.httpStatus = 503;
        if (mode === "PARSE") response.body = "{";
        if (mode === "OVERSIZED") response.body = "x".repeat(request.maximumResponseBytes + 1);
        return response;
      } },
    });
    const result = await operation.run(signedProductInput());
    const expectedIssue = mode === "HTTP" ? LiveReadonlyMarketScopeIssueCode.TransportHttpError
      : mode === "TIMEOUT" ? LiveReadonlyMarketScopeIssueCode.TransportTimeout
      : mode === "OVERSIZED" ? LiveReadonlyMarketScopeIssueCode.TransportResponseOversized
      : LiveReadonlyMarketScopeIssueCode.TransportParseFailure;
    equal(result.issueCodes, [expectedIssue], `${mode} issue`);
    equal([result.attemptedNetworkRequests, result.completedNetworkRequests], [3, mode === "PARSE" ? 3 : 2], `${mode} lifecycle`);
    equal([result.candidates.length, result.persistenceWrites, result.automatedExecutionAllowed], [0, 0, false], `${mode} side effects`);
  }
});

test("a second internal dispatch start is blocked and counted once", async () => {
  const operation = createPersonalDailyScanLiveReadonlyTestOperation({
    ownerAuthorizationVerifier: productOwnerVerifier,
    providerSemanticsEvidence: provenTestProviderSemantics(),
    rawTransport: { dispatchOnce: async (request, permit) => {
      permit.beginNetworkAttempt();
      permit.beginNetworkAttempt();
      return rawResponseFor(request);
    } },
  });
  const result = await operation.run(signedProductInput());
  equal(result.issueCodes, [LiveReadonlyMarketScopeIssueCode.TransportMultipleAttempts], "retry blocker");
  equal([result.attemptedNetworkRequests, result.completedNetworkRequests], [1, 0], "single counted attempt");
});

test("pagination is rejected after one complete response and never requests page two", async () => {
  let calls = 0;
  const operation = createPersonalDailyScanLiveReadonlyTestOperation({
    ownerAuthorizationVerifier: productOwnerVerifier,
    providerSemanticsEvidence: provenTestProviderSemantics(),
    rawTransport: { dispatchOnce: async (request, permit) => {
      calls += 1; permit.beginNetworkAttempt();
      const response = clone(rawResponseFor(request));
      if (request.ordinal === 2) {
        const body = JSON.parse(response.body) as Record<string, unknown>;
        body.nextPageToken = "forbidden-second-page";
        response.body = JSON.stringify(body);
      }
      return response;
    } },
  });
  const result = await operation.run(signedProductInput());
  equal(result.issueCodes, [LiveReadonlyMarketScopeIssueCode.PaginationForbidden], "pagination issue");
  equal([calls, result.attemptedNetworkRequests, result.completedNetworkRequests], [2, 2, 2], "no page two");
});

test("processed fixture envelopes cannot cross the raw live Transport boundary", async () => {
  const operation = createPersonalDailyScanLiveReadonlyTestOperation({
    ownerAuthorizationVerifier: productOwnerVerifier,
    providerSemanticsEvidence: provenTestProviderSemantics(),
    rawTransport: { dispatchOnce: async (request, permit) => {
      permit.beginNetworkAttempt();
      return { batch: responseBatch(request), evidenceResolutions: [] } as unknown as LiveReadonlyRawHttpResponse;
    } },
  });
  const result = await operation.run(signedProductInput());
  equal(result.issueCodes, [LiveReadonlyMarketScopeIssueCode.TransportParseFailure], "processed envelope blocked");
  equal([result.attemptedNetworkRequests, result.completedNetworkRequests], [1, 0], "raw boundary lifecycle");
});

test("fixture provenance and extra legacy symbols cannot enter the raw live path", async () => {
  for (const mode of ["fixture-provenance", "extra-symbol"] as const) {
    const operation = createPersonalDailyScanLiveReadonlyTestOperation({
      ownerAuthorizationVerifier: productOwnerVerifier,
      providerSemanticsEvidence: provenTestProviderSemantics(),
      rawTransport: { dispatchOnce: async (request, permit) => {
        permit.beginNetworkAttempt();
        const response = clone(rawResponseFor(request));
        if (request.ordinal === 1) {
          const body = JSON.parse(response.body) as { bars: Record<string, unknown>[] } & Record<string, unknown>;
          if (mode === "fixture-provenance") body.dataOrigin = "FIXTURE";
          else body.bars.push({ symbol: "MULL", intervalStart: "2026-07-28T13:30:00.000Z", intervalEnd: "2026-07-28T20:00:00.000Z", sessionDate: "2026-07-28", status: "FINAL" });
          response.body = JSON.stringify(body);
        }
        return response;
      } },
    });
    const result = await operation.run(signedProductInput());
    const expectedIssue = mode === "fixture-provenance"
      ? LiveReadonlyMarketScopeIssueCode.TransportParseFailure
      : LiveReadonlyMarketScopeIssueCode.ResponseScopeMismatch;
    assert(result.issueCodes.includes(expectedIssue), `${mode} blocker`);
    equal(result.issueCodes, [...result.issueCodes].sort(), `${mode} stable issues`);
    equal([result.candidates.length, result.persistenceWrites, result.automatedExecutionAllowed], [0, 0, false], "no partial output");
  }
});

test("product barrel exposes only the no-argument fail-closed composition root", async () => {
  assert(!("createPersonalDailyScanLiveReadonlyTestOperation" in personalDailyScanProductBarrel), "test factory absent");
  assert(!("createPersonalDailyScanLiveReadonlyInternalOperation" in personalDailyScanProductBarrel), "internal factory absent");
  assert(!("liveReadonlyProviderSemanticsFingerprint" in personalDailyScanProductBarrel), "semantics minter absent");
  const attackerDependencies = { ownerAuthorizationVerifier: productOwnerVerifier, providerSemanticsAuthority: {}, rawTransport: {} };
  const operation = (createPersonalDailyScanLiveReadonlyProductOperation as unknown as (value: unknown) => ReturnType<typeof createPersonalDailyScanLiveReadonlyProductOperation>)(attackerDependencies);
  const result = await operation.run(signedProductInput());
  equal(result.issueCodes, [LiveReadonlyMarketScopeIssueCode.OwnerVerificationKeyUnavailable], "product trust root unavailable");
  equal([result.attemptedNetworkRequests, result.completedNetworkRequests, result.persistenceWrites, result.automatedExecutionAllowed], [0, 0, 0, false], "pre-network block");
});

test("mapping registry fingerprint binds full content but not input order", () => {
  const catalog = createResearchVerifiedPersonalWatchlistCatalog();
  const approved = approvePersonalWatchlistMappingRegistry(catalog, {
    mappingIds: catalog.mappings.map((mapping) => mapping.mappingId),
    decidedBy: "owner-phase1a",
    decidedAt: "2026-07-28T13:00:00.000Z",
    decisionReference: "owner:personal-watchlist:phase1a",
  });
  const reordered = { ...approved, mappings: [...approved.mappings].reverse() };
  equal(liveReadonlyMappingRegistryContentFingerprint(reordered), MAPPING_FINGERPRINT, "order normalization");
  const changed = clone(approved);
  changed.mappings[0]!.dailyTargetBasisPoints = 19_000;
  const changedFingerprint = liveReadonlyMappingRegistryContentFingerprint(changed);
  assert(changedFingerprint !== MAPPING_FINGERPRINT, "content change changes fingerprint");
  const descriptors = requestDescriptors().map((entry) => ({ ...entry, mappingRegistryFingerprint: changedFingerprint }));
  const result = compileStructuralFixtureMarketScopePlan(bodyFromDescriptors(descriptors));
  equal(result.status, "BLOCKED", "same ID/version changed content blocked");
  assert(result.issueCodes.includes(LiveReadonlyMarketScopeIssueCode.RequestPlanInvalid), "mapping fingerprint blocker");
});

async function runAll(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    try { await run(); passed += 1; process.stdout.write(`PASS ${name}\n`); }
    catch (error) { process.stderr.write(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
  }
  process.stdout.write(`Personal Daily Scan live-readonly market scope: ${passed}/${tests.length} passed.\n`);
}

void runAll();
