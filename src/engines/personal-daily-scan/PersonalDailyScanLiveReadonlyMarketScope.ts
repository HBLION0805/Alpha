import { BarInterval } from "../../contracts/CanonicalBar";
import {
  LIVE_READONLY_MARKET_SCOPE_POLICY_VERSION,
  LIVE_READONLY_MARKET_SCOPE_SCHEMA_VERSION,
  LIVE_READONLY_PROVIDER_SEMANTICS_SCHEMA_VERSION,
  LiveReadonlyMarketScopeIssueCode,
  type LiveReadonlyCanonicalBarEvidence,
  type LiveReadonlyCanonicalQuoteEvidence,
  type LiveReadonlyCompiledPlan,
  type LiveReadonlyCompiledRequest,
  type LiveReadonlyMarketScopeGateInput,
  type LiveReadonlyMarketScopeResult,
  type LiveReadonlyProviderSemanticsEvidence,
  type LiveReadonlyQueryParameter,
  type LiveReadonlyRawHttpResponse,
  type LiveReadonlyResponseBatch,
} from "../../contracts/PersonalDailyScanLiveReadonlyMarketScope";
import {
  LiveReadonlyPreflightIssueCode,
  type LiveReadonlyPreflightInput,
  type LiveReadonlyPreflightResult,
  type LiveReadonlyRequestPlanEntry,
  type OwnerAuthorizationVerifier,
  type OwnerNetworkAuthorizationBody,
} from "../../contracts/PersonalDailyScanLiveReadonly";
import type { PersonalWatchlistMappingRegistry } from "../../contracts/PersonalWatchlistMapping";
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
  canonicalizeRfc8785Jcs,
  liveReadonlyPlanFingerprint,
  liveReadonlyRequestFingerprint,
  sha256Jcs,
} from "./PersonalDailyScanLiveReadonlyPreflight";
import {
  verifiedEvidenceResolutionFingerprint,
  verifiedMappingRegistryFingerprint,
  verifiedProviderRequestFingerprint,
  verifiedProviderSymbolMappingFingerprint,
} from "../verified-market-snapshot/VerifiedMarketSnapshotEngine";
import {
  approvePersonalWatchlistMappingRegistry,
  createResearchVerifiedPersonalWatchlistCatalog,
} from "../personal-watchlist-mapping/PersonalWatchlistMappingRegistry";

const PROVIDER_ID = "provider:alpaca-basic-iex" as const;
export const MAPPING_REGISTRY_ID = "personal-watchlist:mvp-2026-07" as const;
export const MAPPING_REGISTRY_VERSION = "1.1" as const;
const REQUEST_FIELDS = Object.freeze([
  "ordinal", "method", "host", "path", "capability", "interval", "symbols", "feed", "currency",
  "adjustment", "sort", "start", "end", "limit", "timeoutMs", "maximumResponseBytes",
  "maximumEvidenceRecords", "calendarEvidenceFingerprint", "mappingRegistryId", "mappingRegistryVersion", "mappingRegistryFingerprint",
  "requestFingerprint",
]);
const COMPILED_REQUEST_FIELDS = Object.freeze([
  "ordinal", "requestId", "requestFingerprint", "queryFingerprint", "method", "host", "path", "capability", "interval",
  "symbols", "query", "timeoutMs", "maximumResponseBytes", "maximumEvidenceRecords", "calendarEvidenceFingerprint",
  "mappingRegistryId", "mappingRegistryVersion", "mappingRegistryFingerprint",
]);
const PROVIDER_ATTEMPT_REQUIRED_FIELDS = Object.freeze([
  "requestAttemptId", "requestId", "requestedProvider", "actualProvider", "capability",
  "requestedSymbolScope", "mappingRegistryId", "mappingRegistryVersion", "mappingRegistryFingerprint",
  "requestWindowStart", "requestWindowEnd", "requestFingerprint", "attemptOrder", "result",
  "receivedAt", "responseSourceReference", "dataOrigin", "adapterUnderTest",
]);
const SCOPE = Object.freeze([
  Object.freeze({ ordinal: 1, capability: "BARS", interval: "P1D", symbols: Object.freeze(["MU", "QQQ", "SKHY", "SMH", "SPCX", "TSLA"]), maximumEvidenceRecords: 12 }),
  Object.freeze({ ordinal: 2, capability: "BARS", interval: "PT1H", symbols: Object.freeze(["MU", "SKHY", "SPCX", "TSLA"]), maximumEvidenceRecords: 8 }),
  Object.freeze({ ordinal: 3, capability: "BARS", interval: "PT15M", symbols: Object.freeze(["MU", "SKHY", "SPCX", "TSLA"]), maximumEvidenceRecords: 8 }),
  Object.freeze({ ordinal: 4, capability: "BARS", interval: "PT5M", symbols: Object.freeze(["MU", "SKHY", "SPCX", "TSLA"]), maximumEvidenceRecords: 8 }),
  Object.freeze({ ordinal: 5, capability: "LATEST_QUOTES", interval: "NONE", symbols: Object.freeze(["MULL", "SKDD", "SKUU", "SPCH", "SSPC", "TSLL", "TSLQ"]), maximumEvidenceRecords: 7 }),
] as const);
const CANONICAL_INSTRUMENT_IDS: Readonly<Record<string, string>> = Object.freeze({
  MU: "instrument:00000000000000000000000101",
  MULL: "instrument:00000000000000000000000102",
  TSLA: "instrument:00000000000000000000000104",
  TSLL: "instrument:00000000000000000000000105",
  TSLQ: "instrument:00000000000000000000000106",
  SPCX: "instrument:00000000000000000000000107",
  SPCH: "instrument:00000000000000000000000108",
  SSPC: "instrument:00000000000000000000000109",
  SKHY: "instrument:00000000000000000000000110",
  SKUU: "instrument:00000000000000000000000111",
  SKDD: "instrument:00000000000000000000000112",
  QQQ: "instrument:00000000000000000000000201",
  SMH: "instrument:00000000000000000000000202",
});
const PRODUCT_MAPPING_REGISTRY = approvedProductMappingRegistry();
const MAPPING_REGISTRY_FINGERPRINT = liveReadonlyMappingRegistryContentFingerprint(PRODUCT_MAPPING_REGISTRY);

function approvedProductMappingRegistry(): PersonalWatchlistMappingRegistry {
  const catalog = createResearchVerifiedPersonalWatchlistCatalog();
  return approvePersonalWatchlistMappingRegistry(catalog, {
    mappingIds: catalog.mappings.map((mapping) => mapping.mappingId),
    decidedBy: "owner-phase1a",
    decidedAt: "2026-07-28T13:00:00.000Z",
    decisionReference: "owner:personal-watchlist:phase1a",
  });
}

/** Content-addresses the complete approved mapping meaning, independent of entry order. */
export function liveReadonlyMappingRegistryContentFingerprint(
  registry: PersonalWatchlistMappingRegistry,
): string {
  const contentEntries: { entryId: string; content: unknown }[] = registry.mappings.map((mapping) => ({
    entryId: mapping.mappingId,
    content: {
      ...mapping,
      authorityEvidence: [...mapping.authorityEvidence].sort((left, right) =>
        left.evidenceId.localeCompare(right.evidenceId)),
      analysisRole: "ANALYSIS_UNDERLYING",
      vehicleRole: mapping.dailyTargetBasisPoints > 0
        ? "LEVERAGED_LONG"
        : "LEVERAGED_INVERSE",
      leverageDirection: mapping.dailyTargetBasisPoints > 0 ? "LONG" : "INVERSE",
      leverageMultiple: Math.abs(mapping.dailyTargetBasisPoints) / 10_000,
      underlyingInstrumentId: mapping.analysisInstrument.instrumentId,
      vehicleInstrumentId: mapping.tradeVehicle.instrumentId,
    },
  }));
  contentEntries.push(
    {
      entryId: "benchmark:qqq",
      content: {
        canonicalInstrumentId: CANONICAL_INSTRUMENT_IDS.QQQ,
        providerSymbol: "QQQ",
        role: "BENCHMARK",
        classification: "ORDINARY_UNLEVERAGED",
        status: "APPROVED_FOR_PHASE1B_EVIDENCE",
      },
    },
    {
      entryId: "benchmark:smh",
      content: {
        canonicalInstrumentId: CANONICAL_INSTRUMENT_IDS.SMH,
        providerSymbol: "SMH",
        role: "BENCHMARK",
        classification: "ORDINARY_UNLEVERAGED",
        status: "APPROVED_FOR_PHASE1B_EVIDENCE",
      },
    },
  );
  return verifiedMappingRegistryFingerprint({
    mappingRegistryId: registry.registryId,
    mappingRegistryVersion: registry.version,
    contentEntries,
  });
}

export function liveReadonlyProductMappingRegistryFingerprint(): string {
  return MAPPING_REGISTRY_FINGERPRINT;
}

interface VerifiedAuthorizationArtifact {
  readonly authorizationBody: OwnerNetworkAuthorizationBody;
  readonly manifestSha256: string;
}
const VERIFIED_AUTHORIZATION_ARTIFACTS = new WeakSet<object>();

/** Product execution accepts only an artifact minted after C1 verification. */
export function compileLiveReadonlyMarketScopePlan(value: unknown): LiveReadonlyMarketScopeResult {
  if (!isRecord(value) || !VERIFIED_AUTHORIZATION_ARTIFACTS.has(value)) {
    return blocked(new Set(), LiveReadonlyMarketScopeIssueCode.AuthorizationNotVerified);
  }
  return compileAuthorizationBody((value as unknown as VerifiedAuthorizationArtifact).authorizationBody);
}

/** Structural fixtures exercise the exact shape only and never prove Provider semantics or network authority. */
export function compileStructuralFixtureMarketScopePlan(value: unknown): LiveReadonlyMarketScopeResult {
  return compileAuthorizationBody(value);
}

function compileAuthorizationBody(value: unknown): LiveReadonlyMarketScopeResult {
  const issues = new Set<LiveReadonlyMarketScopeIssueCode>();
  if (!isRecord(value)) return blocked(issues, LiveReadonlyMarketScopeIssueCode.InvalidInput);
  const body = value as unknown as OwnerNetworkAuthorizationBody;
  const authorizedPlan = body["requests"];
  if (body.authorizationType !== "PERSONAL_DAILY_SCAN_LIVE_READONLY" || body.provider !== "ALPACA_MARKET_DATA" ||
      body.feed !== "iex" || body.maximumNetworkRequests !== 5 || body.maximumAttemptsPerRequest !== 1 ||
      body.retryAllowed !== false || body.paginationAllowed !== false || body.pollingAllowed !== false ||
      body.streamingAllowed !== false || body.backgroundExecutionAllowed !== false || body.persistenceAllowed !== false ||
      body.automatedExecutionAllowed !== false || body.mappingRegistryId !== MAPPING_REGISTRY_ID ||
      body.mappingRegistryVersion !== MAPPING_REGISTRY_VERSION || body.mappingRegistryFingerprint !== MAPPING_REGISTRY_FINGERPRINT ||
      !Array.isArray(authorizedPlan) || authorizedPlan.length !== 5) {
    issues.add(LiveReadonlyMarketScopeIssueCode.RequestPlanInvalid);
    return blocked(issues);
  }
  const compiled: LiveReadonlyCompiledRequest[] = [];
  authorizedPlan.forEach((request, index) => {
    const expected = SCOPE[index]!;
    if (!validAuthorizedRequest(request, expected)) {
      issues.add(LiveReadonlyMarketScopeIssueCode.RequestPlanInvalid);
      return;
    }
    try {
      const { requestFingerprint, ...descriptor } = request;
      if (requestFingerprint !== liveReadonlyRequestFingerprint(descriptor)) {
        issues.add(LiveReadonlyMarketScopeIssueCode.RequestFingerprintMismatch);
        return;
      }
      compiled.push(compileRequest(body.authorizationId, request));
    } catch {
      issues.add(LiveReadonlyMarketScopeIssueCode.RequestFingerprintMismatch);
    }
  });
  if (body.planFingerprint !== liveReadonlyPlanFingerprint(
    body.requests,
    body.calendarEvidenceFingerprint,
    body.mappingRegistryId,
    body.mappingRegistryVersion,
    body.mappingRegistryFingerprint,
  )) {
    issues.add(LiveReadonlyMarketScopeIssueCode.RequestFingerprintMismatch);
  }
  if (issues.size > 0 || compiled.length !== 5) return blocked(issues);
  const plan: LiveReadonlyCompiledPlan = deepFreeze({
    schemaVersion: LIVE_READONLY_MARKET_SCOPE_SCHEMA_VERSION,
    policyVersion: LIVE_READONLY_MARKET_SCOPE_POLICY_VERSION,
    authorizationId: body.authorizationId,
    planFingerprint: body.planFingerprint,
    mappingRegistryId: body.mappingRegistryId,
    mappingRegistryVersion: body.mappingRegistryVersion,
    mappingRegistryFingerprint: body.mappingRegistryFingerprint,
    requests: compiled,
    maximumNetworkRequests: 5,
    retryAllowed: false,
    paginationAllowed: false,
    persistenceAllowed: false,
    automatedExecutionAllowed: false,
  });
  return emptyResult("VERIFIED", [], plan);
}

export function validateLiveReadonlyMarketScopeEvidence(value: unknown): LiveReadonlyMarketScopeResult {
  const issues = new Set<LiveReadonlyMarketScopeIssueCode>();
  if (!isRecord(value) || !exactKeys(value, ["compiledPlan", "responseBatches", "evidenceResolutions"])) {
    issues.add(!isRecord(value) ? LiveReadonlyMarketScopeIssueCode.InvalidInput : LiveReadonlyMarketScopeIssueCode.UndeclaredField);
    return blocked(issues);
  }
  const input = value as unknown as LiveReadonlyMarketScopeGateInput;
  const planned = input.compiledPlan;
  if (!validCompiledPlan(planned)) return blocked(issues, LiveReadonlyMarketScopeIssueCode.QueryMutation);
  if (!Array.isArray(input.responseBatches) || input.responseBatches.length !== 5) {
    issues.add(LiveReadonlyMarketScopeIssueCode.RequestBudgetExceeded);
  }
  const bars: LiveReadonlyCanonicalBarEvidence[] = [];
  const quotes: LiveReadonlyCanonicalQuoteEvidence[] = [];
  const attempts: ProviderRequestAttempt[] = [];
  const batchesByOrdinal = new Map<number, LiveReadonlyResponseBatch>();
  (Array.isArray(input.responseBatches) ? input.responseBatches : []).forEach((batch, index) => {
    const expectedRequest = planned.requests[index];
    if (!isRecord(batch) || !exactKeys(batch, ["ordinal", "requestFingerprint", "queryFingerprint", "nextPageToken", "responseBytes", "attempt", "bars", "quotes"])) {
      issues.add(LiveReadonlyMarketScopeIssueCode.InvalidInput);
      return;
    }
    const typed = batch as unknown as LiveReadonlyResponseBatch;
    if (expectedRequest === undefined || typed.ordinal !== index + 1 || typed.ordinal !== expectedRequest.ordinal || batchesByOrdinal.has(typed.ordinal)) {
      issues.add(LiveReadonlyMarketScopeIssueCode.RequestOrdinalMismatch);
      return;
    }
    batchesByOrdinal.set(typed.ordinal, typed);
    if (typed.requestFingerprint !== expectedRequest.requestFingerprint || typed.queryFingerprint !== expectedRequest.queryFingerprint) {
      issues.add(LiveReadonlyMarketScopeIssueCode.QueryMutation);
    }
    if (typed.nextPageToken !== null) issues.add(LiveReadonlyMarketScopeIssueCode.PaginationForbidden);
    if (!Number.isSafeInteger(typed.responseBytes) || typed.responseBytes < 0 || typed.responseBytes > expectedRequest.maximumResponseBytes) {
      issues.add(LiveReadonlyMarketScopeIssueCode.ResponseBudgetExceeded);
    }
    if (!validAttempt(typed.attempt, expectedRequest, planned, index + 1)) {
      issues.add(LiveReadonlyMarketScopeIssueCode.ProviderAttemptMismatch);
    } else attempts.push(typed.attempt);
    if (!Array.isArray(typed.bars) || !Array.isArray(typed.quotes)) {
      issues.add(LiveReadonlyMarketScopeIssueCode.InvalidInput);
      return;
    }
    validateBatchEvidence(typed, expectedRequest, issues, bars, quotes);
  });
  if (bars.length !== 36) issues.add(LiveReadonlyMarketScopeIssueCode.BarCountMismatch);
  if (quotes.length !== 7) issues.add(LiveReadonlyMarketScopeIssueCode.QuoteCountMismatch);
  validateResolutions(input.evidenceResolutions, bars, quotes, batchesByOrdinal, issues);
  if (attempts.length !== 5) issues.add(LiveReadonlyMarketScopeIssueCode.ProviderAttemptMismatch);
  if (issues.size > 0) return blocked(issues);
  return deepFreeze({
    status: "VERIFIED",
    issueCodes: [],
    plan: planned,
    canonicalBarReferences: bars.map((entry) => entry.reference),
    canonicalQuoteReferences: quotes.map((entry) => entry.reference),
    providerRequestAttempts: attempts,
    evidenceResolutions: [...input.evidenceResolutions],
    barEvidenceCount: 36,
    quoteEvidenceCount: 7,
    credentialReadPermitted: false,
    candidates: [],
    attemptedNetworkRequests: 0,
    completedNetworkRequests: 0,
    persistenceWrites: 0,
    automatedExecutionAllowed: false,
  });
}

function compileRequest(authorizationId: string, request: LiveReadonlyRequestPlanEntry): LiveReadonlyCompiledRequest {
  const query: LiveReadonlyQueryParameter[] = request.capability === "BARS" ? [
    { name: "symbols", value: request.symbols.join(",") },
    { name: "timeframe", value: timeframe(request.interval) },
    { name: "start", value: request.start! },
    { name: "end", value: request.end! },
    { name: "limit", value: "2" },
    { name: "adjustment", value: "raw" },
    { name: "feed", value: "iex" },
    { name: "currency", value: "USD" },
    { name: "sort", value: "asc" },
  ] : [
    { name: "symbols", value: request.symbols.join(",") },
    { name: "feed", value: "iex" },
    { name: "currency", value: "USD" },
  ];
  const descriptor = {
    ordinal: request.ordinal,
    requestId: `${authorizationId}:request:${request.ordinal}`,
    requestFingerprint: request.requestFingerprint,
    method: request.method,
    host: request.host,
    path: request.path,
    capability: request.capability,
    interval: request.interval,
    symbols: [...request.symbols],
    query,
    timeoutMs: request.timeoutMs,
    maximumResponseBytes: request.maximumResponseBytes,
    maximumEvidenceRecords: request.maximumEvidenceRecords,
    calendarEvidenceFingerprint: request.calendarEvidenceFingerprint,
    mappingRegistryId: request.mappingRegistryId,
    mappingRegistryVersion: request.mappingRegistryVersion,
    mappingRegistryFingerprint: request.mappingRegistryFingerprint,
  };
  return deepFreeze({ ...descriptor, queryFingerprint: sha256Jcs(descriptor) });
}

function validCompiledPlan(value: unknown): value is LiveReadonlyCompiledPlan {
  const compiledEntries = isRecord(value) ? value.requests : undefined;
  if (!isRecord(value) || value.schemaVersion !== LIVE_READONLY_MARKET_SCOPE_SCHEMA_VERSION ||
      value.policyVersion !== LIVE_READONLY_MARKET_SCOPE_POLICY_VERSION || value.maximumNetworkRequests !== 5 ||
      value.retryAllowed !== false || value.paginationAllowed !== false || value.persistenceAllowed !== false ||
      value.automatedExecutionAllowed !== false || value.mappingRegistryId !== MAPPING_REGISTRY_ID ||
      value.mappingRegistryVersion !== MAPPING_REGISTRY_VERSION || value.mappingRegistryFingerprint !== MAPPING_REGISTRY_FINGERPRINT ||
      typeof value.authorizationId !== "string" || typeof value.planFingerprint !== "string" ||
      !Array.isArray(compiledEntries) || compiledEntries.length !== 5) return false;
  if (!compiledEntries.every((request, index) => validCompiledRequest(request, SCOPE[index]!))) return false;
  const authorizedRequests = (compiledEntries as readonly LiveReadonlyCompiledRequest[]).map(authorizedRequestFromCompiled);
  return value.planFingerprint === liveReadonlyPlanFingerprint(
    authorizedRequests,
    authorizedRequests[0]!.calendarEvidenceFingerprint,
    MAPPING_REGISTRY_ID,
    MAPPING_REGISTRY_VERSION,
    MAPPING_REGISTRY_FINGERPRINT,
  );
}

function authorizedRequestFromCompiled(request: LiveReadonlyCompiledRequest): LiveReadonlyRequestPlanEntry {
  return {
    ordinal: request.ordinal,
    method: request.method,
    host: request.host,
    path: request.path,
    capability: request.capability,
    interval: request.interval,
    symbols: request.symbols,
    feed: "iex",
    currency: "USD",
    adjustment: request.capability === "BARS" ? "raw" : "NONE",
    sort: request.capability === "BARS" ? "asc" : "NONE",
    start: request.capability === "BARS" ? query(request, "start") : null,
    end: request.capability === "BARS" ? query(request, "end") : null,
    limit: request.capability === "BARS" ? 2 : null,
    timeoutMs: request.timeoutMs,
    maximumResponseBytes: request.maximumResponseBytes,
    maximumEvidenceRecords: request.maximumEvidenceRecords,
    calendarEvidenceFingerprint: request.calendarEvidenceFingerprint,
    mappingRegistryId: request.mappingRegistryId,
    mappingRegistryVersion: request.mappingRegistryVersion,
    mappingRegistryFingerprint: request.mappingRegistryFingerprint,
    requestFingerprint: request.requestFingerprint,
  };
}

function validCompiledRequest(value: unknown, expected: typeof SCOPE[number]): value is LiveReadonlyCompiledRequest {
  if (!isRecord(value) || !exactKeys(value, COMPILED_REQUEST_FIELDS) || !Array.isArray(value.query)) return false;
  const request = value as unknown as LiveReadonlyCompiledRequest;
  if (request.ordinal !== expected.ordinal || request.method !== "GET" || request.host !== "data.alpaca.markets" ||
      typeof request.requestId !== "string" || !request.requestId.endsWith(`:request:${expected.ordinal}`) ||
      request.path !== (expected.capability === "BARS" ? "/v2/stocks/bars" : "/v2/stocks/quotes/latest") ||
      request.capability !== expected.capability || request.interval !== expected.interval ||
      canonicalizeSafe(request.symbols) !== canonicalizeSafe(expected.symbols) ||
      request.timeoutMs !== 10_000 || request.maximumResponseBytes !== 1_048_576 ||
      request.maximumEvidenceRecords !== expected.maximumEvidenceRecords || request.mappingRegistryId !== MAPPING_REGISTRY_ID ||
      request.mappingRegistryVersion !== MAPPING_REGISTRY_VERSION || request.mappingRegistryFingerprint !== MAPPING_REGISTRY_FINGERPRINT ||
      typeof request.calendarEvidenceFingerprint !== "string") return false;
  const expectedQuery = request.capability === "BARS" ? [
    { name: "symbols", value: request.symbols.join(",") },
    { name: "timeframe", value: timeframe(request.interval) },
    { name: "start", value: query(request, "start") },
    { name: "end", value: query(request, "end") },
    { name: "limit", value: "2" },
    { name: "adjustment", value: "raw" },
    { name: "feed", value: "iex" },
    { name: "currency", value: "USD" },
    { name: "sort", value: "asc" },
  ] : [
    { name: "symbols", value: request.symbols.join(",") },
    { name: "feed", value: "iex" },
    { name: "currency", value: "USD" },
  ];
  const { queryFingerprint, ...descriptor } = request;
  return canonicalizeSafe(request.query) === canonicalizeSafe(expectedQuery) && queryFingerprint === sha256Jcs(descriptor);
}

function validAuthorizedRequest(request: unknown, expected: typeof SCOPE[number]): request is LiveReadonlyRequestPlanEntry {
  if (!isRecord(request) || !exactKeys(request, REQUEST_FIELDS)) return false;
  return request.ordinal === expected.ordinal && request.method === "GET" && request.host === "data.alpaca.markets" &&
    request.path === (expected.capability === "BARS" ? "/v2/stocks/bars" : "/v2/stocks/quotes/latest") &&
    request.capability === expected.capability && request.interval === expected.interval &&
    canonicalizeSafe(request.symbols) === canonicalizeSafe(expected.symbols) && request.feed === "iex" && request.currency === "USD" &&
    request.adjustment === (expected.capability === "BARS" ? "raw" : "NONE") &&
    request.sort === (expected.capability === "BARS" ? "asc" : "NONE") &&
    (expected.capability === "BARS" ? timestamp(request.start) && timestamp(request.end) && Date.parse(String(request.start)) < Date.parse(String(request.end)) && request.limit === 2 : request.start === null && request.end === null && request.limit === null) &&
    request.timeoutMs === 10_000 && request.maximumResponseBytes === 1_048_576 &&
    request.maximumEvidenceRecords === expected.maximumEvidenceRecords && request.mappingRegistryId === MAPPING_REGISTRY_ID &&
    request.mappingRegistryVersion === MAPPING_REGISTRY_VERSION && request.mappingRegistryFingerprint === MAPPING_REGISTRY_FINGERPRINT &&
    typeof request.calendarEvidenceFingerprint === "string" &&
    typeof request.requestFingerprint === "string";
}

function validAttempt(
  attempt: ProviderRequestAttempt,
  request: LiveReadonlyCompiledRequest,
  plan: LiveReadonlyCompiledPlan,
  attemptOrder: number,
): boolean {
  if (!isRecord(attempt)) return false;
  const expectedFields = [
    ...PROVIDER_ATTEMPT_REQUIRED_FIELDS,
    ...(request.capability === "BARS" ? ["interval"] : []),
    ...(attempt.failureReason === undefined ? [] : ["failureReason"]),
  ];
  if (!exactKeys(attempt, expectedFields)) return false;
  const capability = request.capability === "BARS" ? VerifiedMarketProviderCapability.Bars : VerifiedMarketProviderCapability.LatestQuote;
  const interval = request.capability === "BARS" ? request.interval as BarInterval : undefined;
  const descriptor = {
    requestAttemptId: attempt.requestAttemptId,
    requestId: attempt.requestId,
    requestedProvider: attempt.requestedProvider,
    capability,
    ...(interval === undefined ? {} : { interval }),
    requestedSymbolScope: request.symbols,
    mappingRegistryId: plan.mappingRegistryId,
    mappingRegistryVersion: plan.mappingRegistryVersion,
    mappingRegistryFingerprint: plan.mappingRegistryFingerprint,
    requestWindowStart: request.capability === "BARS" ? query(request, "start") : attempt.requestWindowStart,
    requestWindowEnd: request.capability === "BARS" ? query(request, "end") : attempt.requestWindowEnd,
  };
  return attempt.requestId === request.requestId && attempt.requestAttemptId === `${request.requestId}:attempt:1` &&
    attempt.requestedProvider === PROVIDER_ID && attempt.actualProvider === PROVIDER_ID && attempt.capability === capability &&
    attempt.interval === interval && canonicalizeSafe(attempt.requestedSymbolScope) === canonicalizeSafe(request.symbols) &&
    attempt.mappingRegistryId === plan.mappingRegistryId && attempt.mappingRegistryVersion === plan.mappingRegistryVersion &&
    attempt.mappingRegistryFingerprint === plan.mappingRegistryFingerprint &&
    attempt.requestWindowStart === descriptor.requestWindowStart &&
    attempt.requestWindowEnd === descriptor.requestWindowEnd && attempt.requestFingerprint === verifiedProviderRequestFingerprint(descriptor) &&
    attempt.attemptOrder === attemptOrder && attempt.result === VerifiedMarketProviderAttemptResult.Succeeded &&
    timestamp(attempt.receivedAt) && typeof attempt.responseSourceReference === "string" && attempt.responseSourceReference.length > 0 &&
    Object.values(VerifiedMarketDataOrigin).includes(attempt.dataOrigin) &&
    attempt.adapterUnderTest === (attempt.dataOrigin === VerifiedMarketDataOrigin.Network
      ? "adapter:alpaca-personal-market-data-live-readonly-r2"
      : "adapter:alpaca-personal-market-data");
}

function validateBatchEvidence(
  batch: LiveReadonlyResponseBatch,
  request: LiveReadonlyCompiledRequest,
  issues: Set<LiveReadonlyMarketScopeIssueCode>,
  bars: LiveReadonlyCanonicalBarEvidence[],
  quotes: LiveReadonlyCanonicalQuoteEvidence[],
): void {
  if (request.capability === "BARS") {
    if (batch.quotes.length > 0) issues.add(LiveReadonlyMarketScopeIssueCode.ResponseScopeMismatch);
    if (batch.bars.length !== request.maximumEvidenceRecords) issues.add(LiveReadonlyMarketScopeIssueCode.BarCountMismatch);
    for (const symbol of request.symbols) {
      const entries = batch.bars.filter((entry) => entry.providerSymbol === symbol);
      if (entries.length !== 2) issues.add(LiveReadonlyMarketScopeIssueCode.BarCountMismatch);
      validateBarPair(entries, symbol, request, batch.attempt, issues, bars);
    }
    if (batch.bars.some((entry) => !request.symbols.includes(entry.providerSymbol))) issues.add(LiveReadonlyMarketScopeIssueCode.ResponseScopeMismatch);
    if (canonicalizeSafe(batch.bars.map((entry) => entry.providerSymbol)) !==
        canonicalizeSafe(request.symbols.flatMap((symbol) => [symbol, symbol]))) {
      issues.add(LiveReadonlyMarketScopeIssueCode.ResponseOrderMismatch);
    }
  } else {
    if (batch.bars.length > 0) issues.add(LiveReadonlyMarketScopeIssueCode.ResponseScopeMismatch);
    if (batch.quotes.length !== request.maximumEvidenceRecords) issues.add(LiveReadonlyMarketScopeIssueCode.QuoteCountMismatch);
    for (const symbol of request.symbols) {
      const entries = batch.quotes.filter((entry) => entry.providerSymbol === symbol);
      if (entries.length !== 1) issues.add(LiveReadonlyMarketScopeIssueCode.QuoteCountMismatch);
      if (entries[0] !== undefined) validateQuote(entries[0], symbol, request, batch.attempt, issues, quotes);
    }
    if (batch.quotes.some((entry) => !request.symbols.includes(entry.providerSymbol))) issues.add(LiveReadonlyMarketScopeIssueCode.ResponseScopeMismatch);
    if (canonicalizeSafe(batch.quotes.map((entry) => entry.providerSymbol)) !== canonicalizeSafe(request.symbols)) {
      issues.add(LiveReadonlyMarketScopeIssueCode.ResponseOrderMismatch);
    }
  }
}

function validateBarPair(
  entries: readonly LiveReadonlyCanonicalBarEvidence[],
  symbol: string,
  request: LiveReadonlyCompiledRequest,
  attempt: ProviderRequestAttempt,
  issues: Set<LiveReadonlyMarketScopeIssueCode>,
  accepted: LiveReadonlyCanonicalBarEvidence[],
): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    const reference = entry.reference;
    const validIdentity = entry.capability === "BARS" && entry.providerSymbol === symbol &&
      reference.canonicalInstrumentId === CANONICAL_INSTRUMENT_IDS[symbol] && reference.interval === request.interval &&
      entry.mappingRegistryId === request.mappingRegistryId &&
      entry.mappingRegistryVersion === request.mappingRegistryVersion &&
      entry.mappingRegistryFingerprint === request.mappingRegistryFingerprint &&
      entry.providerSymbolMappingVersion === MAPPING_REGISTRY_VERSION && entry.providerSymbolMappingFingerprint ===
        verifiedProviderSymbolMappingFingerprint({ canonicalInstrumentId: reference.canonicalInstrumentId, providerSymbol: symbol, providerSymbolMappingVersion: MAPPING_REGISTRY_VERSION });
    if (!validIdentity) issues.add(LiveReadonlyMarketScopeIssueCode.ResponseScopeMismatch);
    if (reference.status !== "FINAL") issues.add(LiveReadonlyMarketScopeIssueCode.IncompleteBar);
    if (!timestamp(reference.intervalStart) || !timestamp(reference.intervalEnd) || !timestamp(reference.observationTime) ||
        Date.parse(reference.intervalStart) >= Date.parse(reference.intervalEnd) || reference.intervalStart < query(request, "start") ||
        reference.intervalEnd > query(request, "end")) issues.add(LiveReadonlyMarketScopeIssueCode.EvidenceWindowMismatch);
    if (Date.parse(reference.intervalEnd) > Date.parse(attempt.receivedAt) || Date.parse(reference.observationTime) > Date.parse(attempt.receivedAt)) {
      issues.add(LiveReadonlyMarketScopeIssueCode.FutureEvidence);
    }
    const typedKey = `BARS:${reference.canonicalBarId}`;
    if (seen.has(typedKey)) issues.add(LiveReadonlyMarketScopeIssueCode.DuplicateEvidence);
    seen.add(typedKey);
    if (validIdentity) accepted.push(entry);
  }
  if (entries.length === 2) {
    const [first, second] = entries;
    if (first!.reference.intervalStart >= second!.reference.intervalStart || first!.reference.intervalEnd >= second!.reference.intervalEnd ||
        first!.reference.canonicalBarId === second!.reference.canonicalBarId || first!.reference.canonicalBarFingerprint === second!.reference.canonicalBarFingerprint) {
      issues.add(LiveReadonlyMarketScopeIssueCode.DuplicateEvidence);
    }
    if (request.interval !== "P1D" && first!.reference.sessionDate !== second!.reference.sessionDate) {
      issues.add(LiveReadonlyMarketScopeIssueCode.EvidenceWindowMismatch);
    }
  }
}

function validateQuote(
  entry: LiveReadonlyCanonicalQuoteEvidence,
  symbol: string,
  request: LiveReadonlyCompiledRequest,
  attempt: ProviderRequestAttempt,
  issues: Set<LiveReadonlyMarketScopeIssueCode>,
  accepted: LiveReadonlyCanonicalQuoteEvidence[],
): void {
  const reference = entry.reference;
  const valid = entry.capability === "LATEST_QUOTES" && reference.canonicalInstrumentId === CANONICAL_INSTRUMENT_IDS[symbol] &&
    entry.mappingRegistryId === request.mappingRegistryId && entry.mappingRegistryVersion === request.mappingRegistryVersion &&
    entry.mappingRegistryFingerprint === request.mappingRegistryFingerprint &&
    entry.providerSymbolMappingVersion === MAPPING_REGISTRY_VERSION && entry.providerSymbolMappingFingerprint ===
      verifiedProviderSymbolMappingFingerprint({ canonicalInstrumentId: reference.canonicalInstrumentId, providerSymbol: symbol, providerSymbolMappingVersion: MAPPING_REGISTRY_VERSION });
  if (!valid) issues.add(LiveReadonlyMarketScopeIssueCode.ResponseScopeMismatch);
  if (!timestamp(reference.observationTime) || Date.parse(reference.observationTime) > Date.parse(attempt.receivedAt)) {
    issues.add(LiveReadonlyMarketScopeIssueCode.FutureEvidence);
  }
  if (valid) accepted.push(entry);
}

function validateResolutions(
  value: unknown,
  bars: readonly LiveReadonlyCanonicalBarEvidence[],
  quotes: readonly LiveReadonlyCanonicalQuoteEvidence[],
  batches: ReadonlyMap<number, LiveReadonlyResponseBatch>,
  issues: Set<LiveReadonlyMarketScopeIssueCode>,
): void {
  if (!Array.isArray(value) || value.length !== 43) {
    issues.add(LiveReadonlyMarketScopeIssueCode.EvidenceResolutionMismatch);
    return;
  }
  const evidence = [...bars, ...quotes];
  const expected = new Map<string, EvidenceResolution>();
  for (const entry of evidence) {
    const reference = entry.reference;
    const capability = entry.capability === "BARS" ? VerifiedMarketProviderCapability.Bars : VerifiedMarketProviderCapability.LatestQuote;
    const evidenceId = entry.capability === "BARS" ? (reference as CanonicalBarReference).canonicalBarId : (reference as CanonicalQuoteReference).canonicalQuoteId;
    const evidenceFingerprint = entry.capability === "BARS" ? (reference as CanonicalBarReference).canonicalBarFingerprint : (reference as CanonicalQuoteReference).canonicalQuoteFingerprint;
    const interval = entry.capability === "BARS" ? (reference as CanonicalBarReference).interval : undefined;
    const batch = [...batches.values()].find((candidate) => candidate.attempt.capability === capability && candidate.attempt.interval === interval && candidate.attempt.requestedSymbolScope.includes(entry.providerSymbol));
    if (batch === undefined) {
      issues.add(LiveReadonlyMarketScopeIssueCode.EvidenceResolutionMismatch);
      continue;
    }
    const descriptor = {
      resolutionId: `evidence-resolution:${capability}:${evidenceId}`,
      result: VerifiedMarketEvidenceResolutionResult.Resolved,
      requestAttemptId: batch.attempt.requestAttemptId,
      evidenceId,
      evidenceFingerprint,
      canonicalInstrumentId: reference.canonicalInstrumentId,
      providerSymbol: entry.providerSymbol,
      providerSymbolMappingVersion: entry.providerSymbolMappingVersion,
      providerSymbolMappingFingerprint: entry.providerSymbolMappingFingerprint,
      mappingRegistryId: entry.mappingRegistryId,
      mappingRegistryVersion: entry.mappingRegistryVersion,
      mappingRegistryFingerprint: entry.mappingRegistryFingerprint,
      capability,
      ...(interval === undefined ? {} : { interval }),
      evidenceWindowStart: entry.capability === "BARS" ? (reference as CanonicalBarReference).intervalStart : reference.observationTime,
      evidenceWindowEnd: entry.capability === "BARS" ? (reference as CanonicalBarReference).intervalEnd : reference.observationTime,
      observedAt: reference.observationTime,
      provenanceReference: reference.provenanceReference,
      responseSourceReference: batch.attempt.responseSourceReference,
    };
    const resolution = { ...descriptor, resolutionFingerprint: verifiedEvidenceResolutionFingerprint(descriptor) };
    expected.set(`${capability}:${evidenceId}`, resolution);
  }
  const seen = new Set<string>();
  for (const resolution of value as readonly EvidenceResolution[]) {
    const typedKey = `${resolution.capability}:${resolution.evidenceId}`;
    if (seen.has(typedKey)) issues.add(LiveReadonlyMarketScopeIssueCode.DuplicateEvidence);
    seen.add(typedKey);
    const match = expected.get(typedKey);
    if (match === undefined || canonicalizeSafe(match) !== canonicalizeSafe(resolution)) {
      issues.add(LiveReadonlyMarketScopeIssueCode.EvidenceResolutionMismatch);
    }
  }
  if (seen.size !== 43 || expected.size !== 43) issues.add(LiveReadonlyMarketScopeIssueCode.EvidenceResolutionMismatch);
}

export class PersonalDailyScanLiveReadonlyTransportError extends Error {
  public constructor(public readonly code: "HTTP_ERROR" | "TIMEOUT" | "PARSE_FAILURE" | "OVERSIZED_RESPONSE" | "MULTIPLE_ATTEMPTS") {
    super(`Live-readonly transport failed: ${code}.`);
    this.name = "PersonalDailyScanLiveReadonlyTransportError";
  }
}

export function liveReadonlyProviderSemanticsFingerprint(
  value: Omit<LiveReadonlyProviderSemanticsEvidence, "evidenceFingerprint">,
): string {
  return sha256Jcs(value);
}

export function unprovenAlpacaProviderSemanticsEvidence(): LiveReadonlyProviderSemanticsEvidence {
  const descriptor = {
    schemaVersion: LIVE_READONLY_PROVIDER_SEMANTICS_SCHEMA_VERSION,
    evidenceId: "provider-semantics:alpaca-multi-symbol-bars-limit:unproven",
    provider: "ALPACA_MARKET_DATA" as const,
    endpoint: "/v2/stocks/bars" as const,
    status: "PROVIDER_LIMIT_SEMANTICS_UNPROVEN" as const,
    authoritySource: "PRODUCT_CONFIGURATION" as const,
    maximumNetworkRequests: 5 as const,
    paginationAllowed: false as const,
  };
  return deepFreeze({ ...descriptor, evidenceFingerprint: liveReadonlyProviderSemanticsFingerprint(descriptor) });
}

/** @internal Test code imports this only through the physically isolated test factory. */
export interface LiveReadonlyInternalDispatchPermit {
  beginNetworkAttempt(): void;
}

/** @internal Production composition supplies the implementation; business input never does. */
export interface LiveReadonlyInternalRawTransport {
  dispatchOnce(
    request: LiveReadonlyCompiledRequest,
    permit: LiveReadonlyInternalDispatchPermit,
  ): Promise<LiveReadonlyRawHttpResponse>;
}

/** @internal Not exported by the product barrel. */
export interface LiveReadonlyInternalCompositionDependencies {
  readonly ownerAuthorizationVerifier: OwnerAuthorizationVerifier;
  readonly providerSemanticsAuthority: {
    getProviderSemanticsEvidence(): LiveReadonlyProviderSemanticsEvidence;
  };
  readonly rawTransport: LiveReadonlyInternalRawTransport;
}

/**
 * @internal Shared deterministic runtime used by the product composition root
 * and the separately exported test-only factory. It is intentionally absent
 * from every product barrel.
 */
export function createPersonalDailyScanLiveReadonlyInternalOperation(
  dependencies: LiveReadonlyInternalCompositionDependencies,
): { run(input: LiveReadonlyPreflightInput): Promise<LiveReadonlyMarketScopeResult> } {
  const ownerAuthorizationVerifier = dependencies.ownerAuthorizationVerifier;
  const providerSemanticsAuthority = dependencies.providerSemanticsAuthority;
  const rawTransport = dependencies.rawTransport;
  return Object.freeze({
    async run(input: LiveReadonlyPreflightInput): Promise<LiveReadonlyMarketScopeResult> {
      const preflight = ownerAuthorizationVerifier.evaluate(input);
      if (!verifiedPreflight(preflight)) {
        const issue = preflight.issueCodes.includes(
          LiveReadonlyPreflightIssueCode.OwnerAuthorizationVerificationKeyUnavailable,
        )
          ? LiveReadonlyMarketScopeIssueCode.OwnerVerificationKeyUnavailable
          : LiveReadonlyMarketScopeIssueCode.AuthorizationNotVerified;
        return blocked(new Set(), issue);
      }
      const authorizationBody = authorizationBodyFromVerifiedInput(input, preflight);
      if (authorizationBody === undefined) {
        return blocked(new Set(), LiveReadonlyMarketScopeIssueCode.AuthorizationNotVerified);
      }
      const artifact = Object.freeze({ authorizationBody, manifestSha256: preflight.manifestSha256 });
      VERIFIED_AUTHORIZATION_ARTIFACTS.add(artifact);
      const compilation = compileLiveReadonlyMarketScopePlan(artifact);
      if (compilation.plan === null) return compilation;

      const semantics = safeProviderSemantics(providerSemanticsAuthority);
      if (!provesExactPerSymbolLimit(semantics)) {
        return blocked(new Set(), LiveReadonlyMarketScopeIssueCode.ProviderLimitSemanticsUnproven);
      }

      const responseBatches: LiveReadonlyResponseBatch[] = [];
      const evidenceResolutions: EvidenceResolution[] = [];
      let attemptedNetworkRequests = 0;
      let completedNetworkRequests = 0;
      for (const request of compilation.plan.requests) {
        if (!validCompiledRequest(request, SCOPE[request.ordinal - 1]!)) {
          return blockedWithCounts(new Set([LiveReadonlyMarketScopeIssueCode.QueryMutation]), attemptedNetworkRequests, completedNetworkRequests);
        }
        let beginCount = 0;
        const permit: LiveReadonlyInternalDispatchPermit = Object.freeze({
          beginNetworkAttempt(): void {
            beginCount += 1;
            if (beginCount > 1) {
              throw new PersonalDailyScanLiveReadonlyTransportError("MULTIPLE_ATTEMPTS");
            }
            attemptedNetworkRequests += 1;
          },
        });
        let rawResponse: LiveReadonlyRawHttpResponse;
        try {
          rawResponse = await rawTransport.dispatchOnce(request, permit);
        } catch (error) {
          return blockedWithCounts(
            new Set([transportIssue(error)]),
            attemptedNetworkRequests,
            completedNetworkRequests,
          );
        }
        if (beginCount !== 1) {
          return blockedWithCounts(
            new Set([LiveReadonlyMarketScopeIssueCode.TransportFailure]),
            attemptedNetworkRequests,
            completedNetworkRequests,
          );
        }
        const boundaryIssues = rawResponseBoundaryIssues(rawResponse, request);
        if (boundaryIssues.length > 0) {
          return blockedWithCounts(new Set(boundaryIssues), attemptedNetworkRequests, completedNetworkRequests);
        }
        completedNetworkRequests += 1;
        const normalized = normalizeRawResponse(rawResponse, request, compilation.plan);
        if (normalized.issueCodes.length > 0 || normalized.batch === null) {
          return blockedWithCounts(
            new Set(normalized.issueCodes),
            attemptedNetworkRequests,
            completedNetworkRequests,
          );
        }
        responseBatches.push(normalized.batch);
        evidenceResolutions.push(...normalized.evidenceResolutions);
      }
      const validated = validateLiveReadonlyMarketScopeEvidence({
        compiledPlan: compilation.plan,
        responseBatches,
        evidenceResolutions,
      });
      return withCounts(validated, attemptedNetworkRequests, completedNetworkRequests);
    },
  });
}

function verifiedPreflight(value: LiveReadonlyPreflightResult): value is LiveReadonlyPreflightResult & {
  readonly status: "VERIFIED";
  readonly authorizationId: string;
  readonly manifestSha256: string;
} {
  return value.status === "VERIFIED" && value.credentialReadPermitted === true &&
    typeof value.authorizationId === "string" && typeof value.manifestSha256 === "string";
}

function authorizationBodyFromVerifiedInput(
  input: unknown,
  preflight: LiveReadonlyPreflightResult & { readonly authorizationId: string; readonly manifestSha256: string },
): OwnerNetworkAuthorizationBody | undefined {
  if (!isRecord(input) || !isRecord(input.manifest) || !isRecord(input.manifest.authorizationBody) ||
      !isRecord(input.manifest.ownerApprovalEnvelope)) return undefined;
  const body = input.manifest.authorizationBody as unknown as OwnerNetworkAuthorizationBody;
  return body.authorizationId === preflight.authorizationId &&
    input.manifest.ownerApprovalEnvelope.manifestSha256 === preflight.manifestSha256 ? body : undefined;
}

function safeProviderSemantics(
  authority: LiveReadonlyInternalCompositionDependencies["providerSemanticsAuthority"],
): LiveReadonlyProviderSemanticsEvidence | undefined {
  try { return authority.getProviderSemanticsEvidence(); } catch { return undefined; }
}

function provesExactPerSymbolLimit(value: unknown): value is LiveReadonlyProviderSemanticsEvidence {
  if (!isRecord(value) || !exactKeys(value, [
    "schemaVersion", "evidenceId", "provider", "endpoint", "status", "authoritySource",
    "maximumNetworkRequests", "paginationAllowed", "evidenceFingerprint",
  ])) return false;
  const { evidenceFingerprint, ...descriptor } = value;
  return value.schemaVersion === LIVE_READONLY_PROVIDER_SEMANTICS_SCHEMA_VERSION &&
    value.provider === "ALPACA_MARKET_DATA" && value.endpoint === "/v2/stocks/bars" &&
    value.status === "PROVEN_MULTI_SYMBOL_PER_SYMBOL_EXACT_LIMIT" &&
    value.authoritySource === "PRODUCT_CONFIGURATION" && value.maximumNetworkRequests === 5 &&
    value.paginationAllowed === false && evidenceFingerprint === liveReadonlyProviderSemanticsFingerprint(
      descriptor as Omit<LiveReadonlyProviderSemanticsEvidence, "evidenceFingerprint">,
    );
}

function rawResponseBoundaryIssues(
  value: unknown,
  request: LiveReadonlyCompiledRequest,
): readonly LiveReadonlyMarketScopeIssueCode[] {
  if (!isRecord(value) || !exactKeys(value, [
    "kind", "ordinal", "requestId", "requestFingerprint", "httpStatus",
    "headers", "body", "startedAt", "endedAt",
  ])) return [LiveReadonlyMarketScopeIssueCode.TransportParseFailure];
  const response = value as unknown as LiveReadonlyRawHttpResponse;
  if (response.kind !== "RESPONSE" || response.ordinal !== request.ordinal ||
      response.requestId !== request.requestId || response.requestFingerprint !== request.requestFingerprint) {
    return [LiveReadonlyMarketScopeIssueCode.QueryMutation];
  }
  if (!timestamp(response.startedAt) || !timestamp(response.endedAt) ||
      Date.parse(response.startedAt) > Date.parse(response.endedAt) ||
      !Number.isSafeInteger(response.httpStatus) || response.httpStatus < 100 || response.httpStatus > 599 ||
      typeof response.body !== "string" || !validRawHeaders(response.headers, response.body)) {
    return [LiveReadonlyMarketScopeIssueCode.TransportParseFailure];
  }
  if (new TextEncoder().encode(response.body).byteLength > request.maximumResponseBytes) {
    return [LiveReadonlyMarketScopeIssueCode.TransportResponseOversized];
  }
  if (response.httpStatus < 200 || response.httpStatus > 299) {
    return [LiveReadonlyMarketScopeIssueCode.TransportHttpError];
  }
  return [];
}

function validRawHeaders(value: unknown, body: string): boolean {
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  let contentType = false;
  for (const entry of value) {
    if (!isRecord(entry) || !exactKeys(entry, ["name", "value"]) ||
        !["content-type", "content-length", "x-request-id"].includes(String(entry.name)) ||
        typeof entry.value !== "string" || entry.value.length === 0 || seen.has(String(entry.name))) return false;
    seen.add(String(entry.name));
    if (entry.name === "content-type") contentType = entry.value === "application/json";
    if (entry.name === "content-length" && entry.value !== String(new TextEncoder().encode(body).byteLength)) return false;
  }
  return contentType;
}

interface NormalizedRawResponse {
  readonly issueCodes: readonly LiveReadonlyMarketScopeIssueCode[];
  readonly batch: LiveReadonlyResponseBatch | null;
  readonly evidenceResolutions: readonly EvidenceResolution[];
}

function normalizeRawResponse(
  response: LiveReadonlyRawHttpResponse,
  request: LiveReadonlyCompiledRequest,
  plan: LiveReadonlyCompiledPlan,
): NormalizedRawResponse {
  let parsed: unknown;
  try { parsed = JSON.parse(response.body) as unknown; } catch {
    return { issueCodes: [LiveReadonlyMarketScopeIssueCode.TransportParseFailure], batch: null, evidenceResolutions: [] };
  }
  if (!isRecord(parsed) || !exactKeys(parsed, ["schemaVersion", "nextPageToken", "bars", "quotes"]) ||
      parsed.schemaVersion !== "alpha.alpaca.raw.market-data.v1" || !Array.isArray(parsed.bars) || !Array.isArray(parsed.quotes)) {
    return { issueCodes: [LiveReadonlyMarketScopeIssueCode.TransportParseFailure], batch: null, evidenceResolutions: [] };
  }
  if (parsed.nextPageToken !== null) {
    return { issueCodes: [LiveReadonlyMarketScopeIssueCode.PaginationForbidden], batch: null, evidenceResolutions: [] };
  }
  const responseSourceReference = `network-response:${request.requestId}:${sha256Jcs(response.body)}`;
  const requestWindowStart = request.capability === "BARS" ? query(request, "start") : response.startedAt;
  const requestWindowEnd = request.capability === "BARS" ? query(request, "end") : response.endedAt;
  const capability = request.capability === "BARS"
    ? VerifiedMarketProviderCapability.Bars
    : VerifiedMarketProviderCapability.LatestQuote;
  const attemptDescriptor = {
    requestAttemptId: `${request.requestId}:attempt:1`,
    requestId: request.requestId,
    requestedProvider: PROVIDER_ID,
    capability,
    ...(request.capability === "BARS" ? { interval: request.interval as CanonicalBarReference["interval"] } : {}),
    requestedSymbolScope: request.symbols,
    mappingRegistryId: request.mappingRegistryId,
    mappingRegistryVersion: request.mappingRegistryVersion,
    mappingRegistryFingerprint: request.mappingRegistryFingerprint,
    requestWindowStart,
    requestWindowEnd,
  };
  const attempt: ProviderRequestAttempt = {
    ...attemptDescriptor,
    actualProvider: PROVIDER_ID,
    requestFingerprint: verifiedProviderRequestFingerprint(attemptDescriptor),
    attemptOrder: request.ordinal,
    result: VerifiedMarketProviderAttemptResult.Succeeded,
    receivedAt: response.endedAt,
    responseSourceReference,
    dataOrigin: VerifiedMarketDataOrigin.Network,
    adapterUnderTest: "adapter:alpaca-personal-market-data-live-readonly-r2",
  };
  const bars = normalizeRawBars(parsed.bars, request, responseSourceReference);
  const quotes = normalizeRawQuotes(parsed.quotes, request, responseSourceReference);
  if (bars === null || quotes === null) {
    return { issueCodes: [LiveReadonlyMarketScopeIssueCode.TransportParseFailure], batch: null, evidenceResolutions: [] };
  }
  const batch: LiveReadonlyResponseBatch = {
    ordinal: request.ordinal,
    requestFingerprint: request.requestFingerprint,
    queryFingerprint: request.queryFingerprint,
    nextPageToken: null,
    responseBytes: new TextEncoder().encode(response.body).byteLength,
    attempt,
    bars,
    quotes,
  };
  const issues = new Set<LiveReadonlyMarketScopeIssueCode>();
  const acceptedBars: LiveReadonlyCanonicalBarEvidence[] = [];
  const acceptedQuotes: LiveReadonlyCanonicalQuoteEvidence[] = [];
  validateBatchEvidence(batch, request, issues, acceptedBars, acceptedQuotes);
  if (!validAttempt(attempt, request, plan, request.ordinal)) issues.add(LiveReadonlyMarketScopeIssueCode.ProviderAttemptMismatch);
  if (issues.size > 0) return { issueCodes: [...issues].sort(), batch: null, evidenceResolutions: [] };
  return { issueCodes: [], batch, evidenceResolutions: buildEvidenceResolutions(batch) };
}

function normalizeRawBars(
  rows: readonly unknown[],
  request: LiveReadonlyCompiledRequest,
  responseSourceReference: string,
): readonly LiveReadonlyCanonicalBarEvidence[] | null {
  if (request.capability !== "BARS" && rows.length > 0) return null;
  const output: LiveReadonlyCanonicalBarEvidence[] = [];
  for (const value of rows) {
    if (!isRecord(value) || !exactKeys(value, ["symbol", "intervalStart", "intervalEnd", "sessionDate", "status"]) ||
        typeof value.symbol !== "string" || !timestamp(value.intervalStart) || !timestamp(value.intervalEnd) ||
        typeof value.sessionDate !== "string" || value.status !== "FINAL") return null;
    const canonicalInstrumentId = CANONICAL_INSTRUMENT_IDS[value.symbol];
    if (canonicalInstrumentId === undefined) return null;
    const canonicalBarId = `bar:${value.symbol}:${request.interval}:${value.intervalStart}`;
    const provenanceReference = `provenance:${responseSourceReference}:BARS:${canonicalBarId}`;
    const referenceDescriptor = {
      canonicalBarId,
      canonicalInstrumentId,
      interval: request.interval as CanonicalBarReference["interval"],
      intervalStart: value.intervalStart,
      intervalEnd: value.intervalEnd,
      observationTime: value.intervalEnd,
      sessionDate: value.sessionDate,
      status: "FINAL" as const,
      freshness: "CURRENT" as const,
      provenanceReference,
    };
    output.push({
      capability: "BARS",
      providerSymbol: value.symbol,
      mappingRegistryId: request.mappingRegistryId,
      mappingRegistryVersion: request.mappingRegistryVersion,
      mappingRegistryFingerprint: request.mappingRegistryFingerprint,
      providerSymbolMappingVersion: request.mappingRegistryVersion,
      providerSymbolMappingFingerprint: verifiedProviderSymbolMappingFingerprint({
        canonicalInstrumentId,
        providerSymbol: value.symbol,
        providerSymbolMappingVersion: request.mappingRegistryVersion,
      }),
      reference: {
        ...referenceDescriptor,
        canonicalBarFingerprint: sha256Jcs(referenceDescriptor),
      },
    });
  }
  return output;
}

function normalizeRawQuotes(
  rows: readonly unknown[],
  request: LiveReadonlyCompiledRequest,
  responseSourceReference: string,
): readonly LiveReadonlyCanonicalQuoteEvidence[] | null {
  if (request.capability !== "LATEST_QUOTES" && rows.length > 0) return null;
  const output: LiveReadonlyCanonicalQuoteEvidence[] = [];
  for (const value of rows) {
    if (!isRecord(value) || !exactKeys(value, ["symbol", "observationTime"]) ||
        typeof value.symbol !== "string" || !timestamp(value.observationTime)) return null;
    const canonicalInstrumentId = CANONICAL_INSTRUMENT_IDS[value.symbol];
    if (canonicalInstrumentId === undefined) return null;
    const canonicalQuoteId = `quote:${value.symbol}:${value.observationTime}`;
    const provenanceReference = `provenance:${responseSourceReference}:LATEST_QUOTES:${canonicalQuoteId}`;
    const referenceDescriptor = {
      canonicalQuoteId,
      canonicalInstrumentId,
      observationTime: value.observationTime,
      status: "CURRENT" as const,
      provenanceReference,
    };
    output.push({
      capability: "LATEST_QUOTES",
      providerSymbol: value.symbol,
      mappingRegistryId: request.mappingRegistryId,
      mappingRegistryVersion: request.mappingRegistryVersion,
      mappingRegistryFingerprint: request.mappingRegistryFingerprint,
      providerSymbolMappingVersion: request.mappingRegistryVersion,
      providerSymbolMappingFingerprint: verifiedProviderSymbolMappingFingerprint({
        canonicalInstrumentId,
        providerSymbol: value.symbol,
        providerSymbolMappingVersion: request.mappingRegistryVersion,
      }),
      reference: {
        ...referenceDescriptor,
        canonicalQuoteFingerprint: sha256Jcs(referenceDescriptor),
      },
    });
  }
  return output;
}

function buildEvidenceResolutions(batch: LiveReadonlyResponseBatch): readonly EvidenceResolution[] {
  return [...batch.bars, ...batch.quotes].map((entry) => {
    const reference = entry.reference;
    const capability = entry.capability === "BARS"
      ? VerifiedMarketProviderCapability.Bars
      : VerifiedMarketProviderCapability.LatestQuote;
    const evidenceId = entry.capability === "BARS"
      ? (reference as CanonicalBarReference).canonicalBarId
      : (reference as CanonicalQuoteReference).canonicalQuoteId;
    const evidenceFingerprint = entry.capability === "BARS"
      ? (reference as CanonicalBarReference).canonicalBarFingerprint
      : (reference as CanonicalQuoteReference).canonicalQuoteFingerprint;
    const interval = entry.capability === "BARS" ? (reference as CanonicalBarReference).interval : undefined;
    const descriptor = {
      resolutionId: `evidence-resolution:${capability}:${evidenceId}`,
      result: VerifiedMarketEvidenceResolutionResult.Resolved,
      requestAttemptId: batch.attempt.requestAttemptId,
      evidenceId,
      evidenceFingerprint,
      canonicalInstrumentId: reference.canonicalInstrumentId,
      providerSymbol: entry.providerSymbol,
      providerSymbolMappingVersion: entry.providerSymbolMappingVersion,
      providerSymbolMappingFingerprint: entry.providerSymbolMappingFingerprint,
      mappingRegistryId: entry.mappingRegistryId,
      mappingRegistryVersion: entry.mappingRegistryVersion,
      mappingRegistryFingerprint: entry.mappingRegistryFingerprint,
      capability,
      ...(interval === undefined ? {} : { interval }),
      evidenceWindowStart: entry.capability === "BARS" ? (reference as CanonicalBarReference).intervalStart : reference.observationTime,
      evidenceWindowEnd: entry.capability === "BARS" ? (reference as CanonicalBarReference).intervalEnd : reference.observationTime,
      observedAt: reference.observationTime,
      provenanceReference: reference.provenanceReference,
      responseSourceReference: batch.attempt.responseSourceReference,
    };
    return { ...descriptor, resolutionFingerprint: verifiedEvidenceResolutionFingerprint(descriptor) };
  });
}

function transportIssue(error: unknown): LiveReadonlyMarketScopeIssueCode {
  if (!(error instanceof PersonalDailyScanLiveReadonlyTransportError)) return LiveReadonlyMarketScopeIssueCode.TransportFailure;
  return ({
    HTTP_ERROR: LiveReadonlyMarketScopeIssueCode.TransportHttpError,
    TIMEOUT: LiveReadonlyMarketScopeIssueCode.TransportTimeout,
    PARSE_FAILURE: LiveReadonlyMarketScopeIssueCode.TransportParseFailure,
    OVERSIZED_RESPONSE: LiveReadonlyMarketScopeIssueCode.TransportResponseOversized,
    MULTIPLE_ATTEMPTS: LiveReadonlyMarketScopeIssueCode.TransportMultipleAttempts,
  } as const)[error.code];
}

function withCounts(
  result: LiveReadonlyMarketScopeResult,
  attemptedNetworkRequests: number,
  completedNetworkRequests: number,
): LiveReadonlyMarketScopeResult {
  return deepFreeze({ ...result, attemptedNetworkRequests, completedNetworkRequests });
}

function blockedWithCounts(
  issues: Set<LiveReadonlyMarketScopeIssueCode>,
  attemptedNetworkRequests: number,
  completedNetworkRequests: number,
): LiveReadonlyMarketScopeResult {
  return withCounts(blocked(issues), attemptedNetworkRequests, completedNetworkRequests);
}

function timeframe(interval: string): string {
  return ({ P1D: "1Day", PT1H: "1Hour", PT15M: "15Min", PT5M: "5Min" } as Readonly<Record<string, string>>)[interval] ?? "";
}
function query(request: LiveReadonlyCompiledRequest, name: string): string {
  return request.query.find((entry) => entry.name === name)?.value ?? "";
}
function timestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return actual.length === sorted.length && actual.every((key, index) => key === sorted[index]);
}
function canonicalizeSafe(value: unknown): string {
  try { return canonicalizeRfc8785Jcs(value); } catch { return "<INVALID>"; }
}
function blocked(issues: Set<LiveReadonlyMarketScopeIssueCode>, add?: LiveReadonlyMarketScopeIssueCode): LiveReadonlyMarketScopeResult {
  if (add !== undefined) issues.add(add);
  return emptyResult("BLOCKED", [...issues].sort(), null);
}
function emptyResult(status: "VERIFIED" | "BLOCKED", issueCodes: readonly LiveReadonlyMarketScopeIssueCode[], plan: LiveReadonlyCompiledPlan | null): LiveReadonlyMarketScopeResult {
  return deepFreeze({ status, issueCodes: [...issueCodes], plan, canonicalBarReferences: [], canonicalQuoteReferences: [], providerRequestAttempts: [], evidenceResolutions: [], barEvidenceCount: 0, quoteEvidenceCount: 0, credentialReadPermitted: false, candidates: [], attemptedNetworkRequests: 0, completedNetworkRequests: 0, persistenceWrites: 0, automatedExecutionAllowed: false });
}
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return value;
}
