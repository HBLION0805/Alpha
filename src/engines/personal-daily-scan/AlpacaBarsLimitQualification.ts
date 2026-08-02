import type {
  AlpacaBarsLimitQualificationAuthorizationBody,
  AlpacaBarsLimitQualificationDraftInput,
  AlpacaBarsLimitQualificationInput,
  AlpacaBarsLimitQualificationManifestDraft,
  AlpacaBarsLimitQualificationOperation,
  AlpacaBarsLimitQualificationRawResponse,
  AlpacaBarsLimitQualificationResult,
} from "../../contracts/AlpacaBarsLimitQualification";
import {
  ALPACA_BARS_LIMIT_QUALIFICATION_POLICY_VERSION,
  ALPACA_BARS_LIMIT_QUALIFICATION_SCHEMA_VERSION,
  AlpacaBarsLimitQualificationIssueCode,
  AlpacaBarsLimitQualificationTransportError,
} from "../../contracts/AlpacaBarsLimitQualification";
import type {
  LiveReadonlyPreflightResult,
  LiveReadonlyRequestPlanEntry,
  OwnerAuthorizationVerifier,
} from "../../contracts/PersonalDailyScanLiveReadonly";
import {
  createAlpacaBarsLimitQualificationAuthorizationVerifier,
  liveReadonlyPlanFingerprint,
  liveReadonlyRequestFingerprint,
  sha256Jcs,
} from "./PersonalDailyScanLiveReadonlyPreflight";
import {
  MAPPING_REGISTRY_ID,
  MAPPING_REGISTRY_VERSION,
  liveReadonlyProductMappingRegistryFingerprint,
} from "./PersonalDailyScanLiveReadonlyMarketScope";
import {
  AlpacaBarsLimitQualificationHttpsTransport,
  isAlpacaBarsLimitQualificationProductTransport,
  markAlpacaBarsLimitQualificationProductResponseAccepted,
  readAlpacaBarsLimitQualificationProductTransportLifecycle,
  type AlpacaBarsLimitQualificationTransportLifecycle,
} from "../../integration/market-data/alpaca/AlpacaBarsLimitQualificationHttpsTransport";

const SYMBOLS = Object.freeze(["MU", "QQQ"] as const);
const EMPTY_DIAGNOSTICS = Object.freeze({
  actualObservedBarsBySymbol: Object.freeze({ MU: 0, QQQ: 0 }),
  paginationTokenPresent: false,
  responseSymbols: Object.freeze([] as string[]),
});
const ZERO_LIFECYCLE: AlpacaBarsLimitQualificationTransportLifecycle = Object.freeze({
  attemptedNetworkRequests: 0,
  completedNetworkRequests: 0,
  networkRequests: 0,
});
const MAX_RESPONSE_BYTES = 1_048_576;
const TIMEOUT_MS = 10_000;

export { AlpacaBarsLimitQualificationTransportError } from "../../contracts/AlpacaBarsLimitQualification";

interface QualificationDispatchPermit {
  readonly authorizationId: string;
  readonly planFingerprint: string;
}

export interface AlpacaBarsLimitQualificationRawTransport {
  prepareCredentialsAfterAuthorization(): void;
  dispatchOnce(
    request: LiveReadonlyRequestPlanEntry,
    permit: QualificationDispatchPermit,
  ): Promise<AlpacaBarsLimitQualificationRawResponse>;
}

interface QualificationDependencies {
  readonly authorizationVerifier: OwnerAuthorizationVerifier;
  readonly rawTransport: AlpacaBarsLimitQualificationRawTransport;
}

const ISSUED_PERMITS = new WeakSet<object>();
const CONSUMED_MANIFESTS = new Set<string>();

export function createAlpacaBarsLimitQualificationManifestDraft(
  input: AlpacaBarsLimitQualificationDraftInput & { readonly referenceSessionDate: string },
): AlpacaBarsLimitQualificationManifestDraft {
  const calendar = input.calendarEvidence;
  const sessions = calendar.calendarBody.sessions.filter((session) => session.status === "TRADING_SESSION");
  const referenceIndex = sessions.findIndex((session) => session.sessionDate === input.referenceSessionDate);
  const reference = sessions[referenceIndex];
  const prior = sessions[referenceIndex - 1];
  if (reference === undefined || prior === undefined || reference.marketClose === null || prior.marketOpen === null) {
    throw new Error("A signed calendar with prior and reference completed sessions is required.");
  }
  const mappingRegistryFingerprint = liveReadonlyProductMappingRegistryFingerprint();
  const descriptor = {
    ordinal: 1,
    method: "GET",
    host: "data.alpaca.markets",
    path: "/v2/stocks/bars",
    capability: "BARS",
    interval: "P1D",
    symbols: SYMBOLS,
    feed: "iex",
    currency: "USD",
    adjustment: "raw",
    sort: "asc",
    start: prior.marketOpen,
    end: reference.marketClose,
    limit: 2,
    timeoutMs: TIMEOUT_MS,
    maximumResponseBytes: MAX_RESPONSE_BYTES,
    maximumEvidenceRecords: 4,
    calendarEvidenceFingerprint: calendar.ownerApprovalEnvelope.calendarSha256,
    mappingRegistryId: MAPPING_REGISTRY_ID,
    mappingRegistryVersion: MAPPING_REGISTRY_VERSION,
    mappingRegistryFingerprint,
  } as const;
  const request: LiveReadonlyRequestPlanEntry = Object.freeze({
    ...descriptor,
    requestFingerprint: liveReadonlyRequestFingerprint(descriptor),
  });
  const requests = Object.freeze([request] as const);
  const body: AlpacaBarsLimitQualificationAuthorizationBody = deepFreeze({
    schemaVersion: ALPACA_BARS_LIMIT_QUALIFICATION_SCHEMA_VERSION,
    authorizationType: "ALPACA_BARS_LIMIT_QUALIFICATION_LIVE_READONLY",
    authorizationId: input.authorizationId,
    ownerDecisionReference: input.ownerDecisionReference,
    executeDate: input.executeDate,
    validFrom: input.validFrom,
    expiresAt: input.expiresAt,
    provider: "ALPACA_MARKET_DATA",
    feed: "iex",
    mappingRegistryId: MAPPING_REGISTRY_ID,
    mappingRegistryVersion: MAPPING_REGISTRY_VERSION,
    mappingRegistryFingerprint,
    calendarEvidenceId: calendar.calendarBody.evidenceId,
    calendarEvidenceFingerprint: calendar.ownerApprovalEnvelope.calendarSha256,
    planFingerprint: liveReadonlyPlanFingerprint(
      requests,
      calendar.ownerApprovalEnvelope.calendarSha256,
      MAPPING_REGISTRY_ID,
      MAPPING_REGISTRY_VERSION,
      mappingRegistryFingerprint,
    ),
    maximumNetworkRequests: 1,
    maximumAttemptsPerRequest: 1,
    retryAllowed: false,
    paginationAllowed: false,
    pollingAllowed: false,
    streamingAllowed: false,
    backgroundExecutionAllowed: false,
    credentialReadAllowedAfterPreflightOnly: true,
    persistenceAllowed: false,
    accountAccessAllowed: false,
    positionAccessAllowed: false,
    balanceAccessAllowed: false,
    orderAccessAllowed: false,
    brokerAllowed: false,
    paperTradingAllowed: false,
    automatedExecutionAllowed: false,
    requests,
  });
  return deepFreeze({
    authorizationBody: body,
    manifestSha256: sha256Jcs(body),
    signatureDomain: "ALPHA_OWNER_NETWORK_AUTHORIZATION_V1",
    approvalStatus: "UNSIGNED_OWNER_APPROVAL_REQUIRED",
  });
}

/** Fixed product composition. No business input can replace authority or Transport. */
export function createAlpacaBarsLimitQualificationFixedProductOperation(): AlpacaBarsLimitQualificationOperation {
  const rawTransport = new AlpacaBarsLimitQualificationHttpsTransport();
  if (!isAlpacaBarsLimitQualificationProductTransport(rawTransport)) {
    throw new Error("Product Transport capability was not established.");
  }
  return createQualificationOperation({
    authorizationVerifier: createAlpacaBarsLimitQualificationAuthorizationVerifier(undefined),
    rawTransport,
  });
}

/** Test-only assembly seam. It cannot accept or mint the product Transport capability. */
export function createAlpacaBarsLimitQualificationTestOperationInternal(
  dependencies: QualificationDependencies,
): AlpacaBarsLimitQualificationOperation {
  if (isAlpacaBarsLimitQualificationProductTransport(dependencies.rawTransport)) {
    throw new Error("The product Transport cannot enter the test composition.");
  }
  return createQualificationOperation(dependencies);
}

function createQualificationOperation(
  dependencies: QualificationDependencies,
): AlpacaBarsLimitQualificationOperation {
  return Object.freeze({
    async run(input: AlpacaBarsLimitQualificationInput): Promise<AlpacaBarsLimitQualificationResult> {
      if (!exactInput(input)) return blocked([AlpacaBarsLimitQualificationIssueCode.OwnerAuthorizationInvalid]);
      if (input.manifest === undefined || input.calendarEvidence === undefined) {
        return blocked([AlpacaBarsLimitQualificationIssueCode.OwnerNetworkAuthorizationRequired]);
      }
      const preflight = dependencies.authorizationVerifier.evaluate({
        asOf: input.asOf,
        manifest: input.manifest,
        calendarEvidence: input.calendarEvidence,
      });
      if (preflight.status !== "VERIFIED") return blocked(preflightIssues(preflight));
      const body = authorizationBody(input.manifest);
      if (body === undefined || !exactAuthorizationBody(body)) {
        return blocked([AlpacaBarsLimitQualificationIssueCode.RequestPlanInvalid], preflight);
      }
      const request = body.requests[0];
      if (!exactRequest(request, body)) {
        return blocked([AlpacaBarsLimitQualificationIssueCode.RequestMutationDetected], preflight);
      }
      if (preflight.manifestSha256 === null || CONSUMED_MANIFESTS.has(preflight.manifestSha256)) {
        return blocked([AlpacaBarsLimitQualificationIssueCode.AuthorizationReplayForbidden], preflight);
      }
      try {
        dependencies.rawTransport.prepareCredentialsAfterAuthorization();
      } catch {
        return blocked([AlpacaBarsLimitQualificationIssueCode.CredentialUnavailable], preflight);
      }
      const permit = Object.freeze({ authorizationId: body.authorizationId, planFingerprint: body.planFingerprint });
      ISSUED_PERMITS.add(permit);
      CONSUMED_MANIFESTS.add(preflight.manifestSha256);
      let response: AlpacaBarsLimitQualificationRawResponse;
      const responseOrigin = transportResponseOrigin(dependencies.rawTransport);
      const credentialReadPermitted = responseOrigin === "REAL_HTTPS";
      try {
        response = await dependencies.rawTransport.dispatchOnce(request, permit);
      } catch (error) {
        return blocked(
          [transportIssue(error)],
          preflight,
          readAlpacaBarsLimitQualificationProductTransportLifecycle(dependencies.rawTransport),
          responseOrigin,
          EMPTY_DIAGNOSTICS,
          request.requestFingerprint,
          credentialReadPermitted,
        );
      }
      const validation = validateRawResponse(response, request);
      if (validation.issues.length > 0) {
        return blocked(
          validation.issues,
          preflight,
          readAlpacaBarsLimitQualificationProductTransportLifecycle(dependencies.rawTransport),
          responseOrigin,
          validation.diagnostics,
          request.requestFingerprint,
          credentialReadPermitted,
        );
      }
      if (responseOrigin === "REAL_HTTPS") {
        markAlpacaBarsLimitQualificationProductResponseAccepted(dependencies.rawTransport);
      }
      const lifecycle = readAlpacaBarsLimitQualificationProductTransportLifecycle(dependencies.rawTransport);
      return resultWithRunId({
        schemaVersion: ALPACA_BARS_LIMIT_QUALIFICATION_SCHEMA_VERSION,
        policyVersion: ALPACA_BARS_LIMIT_QUALIFICATION_POLICY_VERSION,
        status: "QUALIFICATION_OBSERVED",
        issueCodes: [],
        authorizationId: preflight.authorizationId,
        manifestSha256: preflight.manifestSha256,
        requestFingerprint: request.requestFingerprint,
        marketPhase: preflight.marketPhase,
        referenceSessionDate: preflight.referenceSessionDate,
        provider: "ALPACA_MARKET_DATA",
        feed: "iex",
        symbols: SYMBOLS,
        timeframe: "1Day",
        requestedLimit: 2,
        responseOrigin,
        actualObservedBarsBySymbol: validation.diagnostics.actualObservedBarsBySymbol,
        paginationTokenPresent: validation.diagnostics.paginationTokenPresent,
        responseSymbols: validation.diagnostics.responseSymbols,
        providerLimitSemantics: responseOrigin === "REAL_HTTPS" ? "OBSERVED_ONCE_NOT_PROVEN" : "UNPROVEN",
        credentialReadPermitted,
        attemptedNetworkRequests: lifecycle.attemptedNetworkRequests,
        completedNetworkRequests: lifecycle.completedNetworkRequests,
        networkRequests: lifecycle.networkRequests,
        persistenceWrites: 0,
        automatedExecutionAllowed: false,
        candidates: [],
      });
    },
  });
}

export function assertAlpacaBarsLimitQualificationDispatchPermit(value: unknown): asserts value is QualificationDispatchPermit {
  if (typeof value !== "object" || value === null || !ISSUED_PERMITS.has(value)) {
    throw new AlpacaBarsLimitQualificationTransportError("TRANSPORT_FAILURE");
  }
}

function exactInput(value: unknown): value is AlpacaBarsLimitQualificationInput {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length <= 3 && keys.every((key) => ["asOf", "calendarEvidence", "manifest"].includes(key)) && canonicalTimestamp(value.asOf);
}

function authorizationBody(value: unknown): AlpacaBarsLimitQualificationAuthorizationBody | undefined {
  if (!isRecord(value) || !isRecord(value.authorizationBody)) return undefined;
  return value.authorizationBody as unknown as AlpacaBarsLimitQualificationAuthorizationBody;
}

function exactAuthorizationBody(body: AlpacaBarsLimitQualificationAuthorizationBody): boolean {
  const requestPlan = body.requests;
  return body.authorizationType === "ALPACA_BARS_LIMIT_QUALIFICATION_LIVE_READONLY" &&
    body.maximumNetworkRequests === 1 && requestPlan.length === 1 && body.planFingerprint === liveReadonlyPlanFingerprint(
      requestPlan,
      body.calendarEvidenceFingerprint,
      body.mappingRegistryId,
      body.mappingRegistryVersion,
      body.mappingRegistryFingerprint,
    );
}

function exactRequest(request: LiveReadonlyRequestPlanEntry, body: AlpacaBarsLimitQualificationAuthorizationBody): boolean {
  const { requestFingerprint, ...descriptor } = request;
  return request.ordinal === 1 && request.method === "GET" && request.host === "data.alpaca.markets" &&
    request.path === "/v2/stocks/bars" && request.capability === "BARS" && request.interval === "P1D" &&
    JSON.stringify(request.symbols) === JSON.stringify(SYMBOLS) && request.feed === "iex" && request.currency === "USD" &&
    request.adjustment === "raw" && request.sort === "asc" && request.limit === 2 && request.timeoutMs === TIMEOUT_MS &&
    request.maximumResponseBytes === MAX_RESPONSE_BYTES && request.maximumEvidenceRecords === 4 &&
    request.mappingRegistryId === MAPPING_REGISTRY_ID && request.mappingRegistryVersion === MAPPING_REGISTRY_VERSION &&
    request.mappingRegistryFingerprint === liveReadonlyProductMappingRegistryFingerprint() &&
    request.calendarEvidenceFingerprint === body.calendarEvidenceFingerprint && requestFingerprint === liveReadonlyRequestFingerprint(descriptor);
}

function validateRawResponse(
  response: AlpacaBarsLimitQualificationRawResponse,
  request: LiveReadonlyRequestPlanEntry,
): {
  readonly issues: readonly AlpacaBarsLimitQualificationIssueCode[];
  readonly diagnostics: {
    readonly actualObservedBarsBySymbol: Readonly<{ readonly MU: number; readonly QQQ: number }>;
    readonly paginationTokenPresent: boolean;
    readonly responseSymbols: readonly string[];
  };
} {
  const issues = new Set<AlpacaBarsLimitQualificationIssueCode>();
  if (!isRecord(response) || !exactKeys(response as unknown as Record<string, unknown>, ["endedAt", "headers", "rawBytes", "startedAt", "statusCode"])) {
    issues.add(AlpacaBarsLimitQualificationIssueCode.TransportFailure);
  }
  if (!Number.isSafeInteger(response.statusCode) || response.statusCode < 200 || response.statusCode > 299) issues.add(AlpacaBarsLimitQualificationIssueCode.HttpError);
  if (!canonicalTimestamp(response.startedAt) || !canonicalTimestamp(response.endedAt) || Date.parse(response.endedAt) < Date.parse(response.startedAt)) {
    issues.add(AlpacaBarsLimitQualificationIssueCode.TransportFailure);
  }
  if (!(response.rawBytes instanceof Uint8Array) || response.rawBytes.byteLength === 0 || response.rawBytes.byteLength > request.maximumResponseBytes) {
    issues.add(response.rawBytes instanceof Uint8Array && response.rawBytes.byteLength > request.maximumResponseBytes
      ? AlpacaBarsLimitQualificationIssueCode.ResponseTooLarge : AlpacaBarsLimitQualificationIssueCode.TransportFailure);
  }
  if (!validHeaders(response.headers)) issues.add(AlpacaBarsLimitQualificationIssueCode.TransportFailure);
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(response.rawBytes)); }
  catch { issues.add(AlpacaBarsLimitQualificationIssueCode.InvalidJson); return { issues: sorted(issues), diagnostics: EMPTY_DIAGNOSTICS }; }
  const diagnostics = responseDiagnostics(payload);
  if (!isRecord(payload) || !exactKeys(payload, ["bars", "next_page_token"]) || !isRecord(payload.bars)) {
    issues.add(AlpacaBarsLimitQualificationIssueCode.ResponseScopeMismatch);
    return { issues: sorted(issues), diagnostics };
  }
  if (payload.next_page_token !== null && payload.next_page_token !== "") issues.add(AlpacaBarsLimitQualificationIssueCode.PaginationForbidden);
  if (!exactKeys(payload.bars, SYMBOLS)) issues.add(AlpacaBarsLimitQualificationIssueCode.ResponseScopeMismatch);
  for (const symbol of SYMBOLS) {
    const rows = payload.bars[symbol];
    if (!Array.isArray(rows) || rows.length !== 2) { issues.add(AlpacaBarsLimitQualificationIssueCode.BarCountMismatch); continue; }
    let prior = -Infinity;
    for (const row of rows) {
      if (!validBar(row, request, prior)) { issues.add(AlpacaBarsLimitQualificationIssueCode.InvalidBar); continue; }
      prior = Date.parse((row as Record<string, unknown>).t as string);
    }
  }
  return { issues: sorted(issues), diagnostics };
}

function responseDiagnostics(payload: unknown): {
  readonly actualObservedBarsBySymbol: Readonly<{ readonly MU: number; readonly QQQ: number }>;
  readonly paginationTokenPresent: boolean;
  readonly responseSymbols: readonly string[];
} {
  if (!isRecord(payload)) return EMPTY_DIAGNOSTICS;
  const bars = isRecord(payload.bars) ? payload.bars : undefined;
  const responseSymbols = bars === undefined ? [] : Object.keys(bars).sort();
  return deepFreeze({
    actualObservedBarsBySymbol: {
      MU: bars !== undefined && Array.isArray(bars.MU) ? bars.MU.length : 0,
      QQQ: bars !== undefined && Array.isArray(bars.QQQ) ? bars.QQQ.length : 0,
    },
    paginationTokenPresent: payload.next_page_token !== null && payload.next_page_token !== "" && payload.next_page_token !== undefined,
    responseSymbols,
  });
}

function validBar(value: unknown, request: LiveReadonlyRequestPlanEntry, prior: number): boolean {
  if (!isRecord(value) || !exactKeys(value, ["c", "h", "l", "n", "o", "t", "v", "vw"]) || !canonicalProviderTimestamp(value.t)) return false;
  const time = Date.parse(value.t as string);
  return time > prior && time >= Date.parse(request.start!) && time <= Date.parse(request.end!) &&
    [value.o, value.h, value.l, value.c, value.vw].every(positiveFinite) &&
    Number.isSafeInteger(value.v) && Number(value.v) >= 0 && Number.isSafeInteger(value.n) && Number(value.n) >= 0 &&
    Number(value.l) <= Math.min(Number(value.o), Number(value.c)) && Number(value.h) >= Math.max(Number(value.o), Number(value.c));
}

function validHeaders(value: unknown): boolean {
  return Array.isArray(value) && value.every((header) => isRecord(header) &&
    ["content-type", "content-length", "x-request-id"].includes(String(header.name)) && typeof header.value === "string" && header.value.length <= 512);
}

function preflightIssues(preflight: LiveReadonlyPreflightResult): AlpacaBarsLimitQualificationIssueCode[] {
  if (preflight.issueCodes.includes("OWNER_AUTHORIZATION_VERIFICATION_KEY_UNAVAILABLE" as never)) {
    return [AlpacaBarsLimitQualificationIssueCode.OwnerAuthorizationVerificationKeyUnavailable];
  }
  return [AlpacaBarsLimitQualificationIssueCode.OwnerAuthorizationInvalid];
}

function transportIssue(error: unknown): AlpacaBarsLimitQualificationIssueCode {
  if (!(error instanceof AlpacaBarsLimitQualificationTransportError)) return AlpacaBarsLimitQualificationIssueCode.TransportFailure;
  if (error.safeCode === "CREDENTIAL_UNAVAILABLE") return AlpacaBarsLimitQualificationIssueCode.CredentialUnavailable;
  if (error.safeCode === "TIMEOUT") return AlpacaBarsLimitQualificationIssueCode.TransportTimeout;
  if (error.safeCode === "HTTP_ERROR") return AlpacaBarsLimitQualificationIssueCode.HttpError;
  if (error.safeCode === "RESPONSE_TOO_LARGE") return AlpacaBarsLimitQualificationIssueCode.ResponseTooLarge;
  return AlpacaBarsLimitQualificationIssueCode.TransportFailure;
}

function blocked(
  issues: readonly AlpacaBarsLimitQualificationIssueCode[],
  preflight?: LiveReadonlyPreflightResult,
  lifecycle: AlpacaBarsLimitQualificationTransportLifecycle = ZERO_LIFECYCLE,
  responseOrigin: "NONE" | "TEST_INJECTED" | "REAL_HTTPS" = "NONE",
  diagnostics: {
    readonly actualObservedBarsBySymbol: Readonly<{ readonly MU: number; readonly QQQ: number }>;
    readonly paginationTokenPresent: boolean;
    readonly responseSymbols: readonly string[];
  } = EMPTY_DIAGNOSTICS,
  requestFingerprint: string | null = null,
  credentialReadPermitted = false,
): AlpacaBarsLimitQualificationResult {
  return resultWithRunId({
    schemaVersion: ALPACA_BARS_LIMIT_QUALIFICATION_SCHEMA_VERSION,
    policyVersion: ALPACA_BARS_LIMIT_QUALIFICATION_POLICY_VERSION,
    status: "BLOCKED",
    issueCodes: [...new Set(issues)].sort(),
    authorizationId: preflight?.authorizationId ?? null,
    manifestSha256: preflight?.manifestSha256 ?? null,
    requestFingerprint,
    marketPhase: preflight?.marketPhase ?? null,
    referenceSessionDate: preflight?.referenceSessionDate ?? null,
    provider: "ALPACA_MARKET_DATA",
    feed: "iex",
    symbols: SYMBOLS,
    timeframe: "1Day",
    requestedLimit: 2,
    responseOrigin,
    actualObservedBarsBySymbol: diagnostics.actualObservedBarsBySymbol,
    paginationTokenPresent: diagnostics.paginationTokenPresent,
    responseSymbols: diagnostics.responseSymbols,
    providerLimitSemantics: "UNPROVEN",
    credentialReadPermitted,
    attemptedNetworkRequests: lifecycle.attemptedNetworkRequests,
    completedNetworkRequests: lifecycle.completedNetworkRequests,
    networkRequests: lifecycle.networkRequests,
    persistenceWrites: 0,
    automatedExecutionAllowed: false,
    candidates: [],
  });
}

function transportResponseOrigin(
  transport: AlpacaBarsLimitQualificationRawTransport,
): "TEST_INJECTED" | "REAL_HTTPS" {
  return isAlpacaBarsLimitQualificationProductTransport(transport) ? "REAL_HTTPS" : "TEST_INJECTED";
}

function resultWithRunId(
  value: Omit<AlpacaBarsLimitQualificationResult, "runId">,
): AlpacaBarsLimitQualificationResult {
  const runId = `alpaca-bars-limit-qualification:${sha256Jcs(value)}`;
  return deepFreeze({ ...value, runId });
}

function sorted(value: Set<AlpacaBarsLimitQualificationIssueCode>): AlpacaBarsLimitQualificationIssueCode[] { return [...value].sort(); }
function canonicalTimestamp(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value; }
function canonicalProviderTimestamp(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u.test(value) && Number.isFinite(Date.parse(value)); }
function positiveFinite(value: unknown): boolean { return typeof value === "number" && Number.isFinite(value) && value > 0; }
function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean { const keys = Object.keys(value).sort(); const sortedExpected = [...expected].sort(); return keys.length === sortedExpected.length && keys.every((key, index) => key === sortedExpected[index]); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function deepFreeze<T>(value: T): T { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested); } return value; }
