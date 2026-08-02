import { createHash, createPublicKey, verify } from "node:crypto";

import {
  EXCHANGE_CALENDAR_DOMAIN,
  EXCHANGE_CALENDAR_EVIDENCE_SCHEMA_VERSION,
  LIVE_READONLY_AUTHORIZATION_SCHEMA_VERSION,
  OWNER_AUTHORIZATION_DOMAIN,
  LiveReadonlyPreflightIssueCode,
  type ExchangeCalendarBody,
  type ExchangeCalendarEvidence,
  type ExchangeCalendarSession,
  type LiveReadonlyMarketPhase,
  type OwnerAuthorizationVerifier,
  type OwnerTrustRootProvider,
  type LiveReadonlyPreflightInput,
  type LiveReadonlyPreflightResult,
  type LiveReadonlyRequestPlanEntry,
  type OwnerNetworkAuthorizationBody,
  type OwnerNetworkAuthorizationManifest,
  type TrustedOwnerVerificationKey,
} from "../../contracts/PersonalDailyScanLiveReadonly";

const AUTHORIZATION_BODY_FIELDS = [
  "schemaVersion", "authorizationType", "authorizationId", "ownerDecisionReference",
  "executeDate", "validFrom", "expiresAt", "provider", "feed",
  "mappingRegistryId", "mappingRegistryVersion", "mappingRegistryFingerprint", "calendarEvidenceId", "calendarEvidenceFingerprint",
  "planFingerprint", "maximumNetworkRequests", "maximumAttemptsPerRequest",
  "retryAllowed", "paginationAllowed", "pollingAllowed", "streamingAllowed",
  "backgroundExecutionAllowed", "credentialReadAllowedAfterPreflightOnly",
  "persistenceAllowed", "accountAccessAllowed", "positionAccessAllowed",
  "balanceAccessAllowed", "orderAccessAllowed", "brokerAllowed", "paperTradingAllowed",
  "automatedExecutionAllowed", "requests",
] as const;
const REQUEST_FIELDS = [
  "ordinal", "method", "host", "path", "capability", "interval", "symbols", "feed",
  "currency", "adjustment", "sort", "start", "end", "limit", "timeoutMs", "maximumResponseBytes",
  "maximumEvidenceRecords", "calendarEvidenceFingerprint", "mappingRegistryId", "mappingRegistryVersion", "mappingRegistryFingerprint",
  "requestFingerprint",
] as const;
const OWNER_ENVELOPE_FIELDS = [
  "manifestSha256", "signatureAlgorithm", "ownerKeyId", "ownerPublicKeyFingerprint", "ownerSignature",
] as const;
const CALENDAR_BODY_FIELDS = [
  "schemaVersion", "evidenceId", "calendarId", "calendarVersion", "producerId",
  "producerVersion", "authoritySource", "ownerDecisionReference", "timezone", "validFrom",
  "validThrough", "closureBufferSeconds", "sessions",
] as const;
const CALENDAR_SESSION_FIELDS = ["sessionDate", "status", "marketOpen", "marketClose", "earlyClose"] as const;
const CALENDAR_ENVELOPE_FIELDS = [
  "calendarSha256", "signatureAlgorithm", "ownerKeyId", "ownerPublicKeyFingerprint", "ownerSignature",
] as const;
const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u;
const PEM_PUBLIC_KEY = /^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----\s*$/u;
const AUTHORIZATION_MAX_DURATION_MS = 10 * 60 * 1000;
const EXPECTED_REQUESTS = Object.freeze([
  Object.freeze({ ordinal: 1, capability: "BARS", interval: "P1D", maximumEvidenceRecords: 12, symbols: Object.freeze(["MU", "QQQ", "SKHY", "SMH", "SPCX", "TSLA"]) }),
  Object.freeze({ ordinal: 2, capability: "BARS", interval: "PT1H", maximumEvidenceRecords: 8, symbols: Object.freeze(["MU", "SKHY", "SPCX", "TSLA"]) }),
  Object.freeze({ ordinal: 3, capability: "BARS", interval: "PT15M", maximumEvidenceRecords: 8, symbols: Object.freeze(["MU", "SKHY", "SPCX", "TSLA"]) }),
  Object.freeze({ ordinal: 4, capability: "BARS", interval: "PT5M", maximumEvidenceRecords: 8, symbols: Object.freeze(["MU", "SKHY", "SPCX", "TSLA"]) }),
  Object.freeze({ ordinal: 5, capability: "LATEST_QUOTES", interval: "NONE", maximumEvidenceRecords: 7, symbols: Object.freeze(["MULL", "SKDD", "SKUU", "SPCH", "SSPC", "TSLL", "TSLQ"]) }),
] as const);

export function canonicalizeRfc8785Jcs(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") {
    if (hasLoneSurrogate(value)) throw new Error("JCS does not permit lone Unicode surrogates.");
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("JCS does not permit non-finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) throw new Error("JCS does not permit sparse arrays.");
    }
    return `[${value.map((entry) => canonicalizeRfc8785Jcs(entry)).join(",")}]`;
  }
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error("JCS accepts only JSON objects, arrays, and primitives.");
  }
  const entries = Object.keys(value).sort().map((key) => {
    if (hasLoneSurrogate(key)) throw new Error("JCS does not permit lone Unicode surrogates.");
    const nested = value[key];
    if (nested === undefined || typeof nested === "bigint" || typeof nested === "function" || typeof nested === "symbol") {
      throw new Error("JCS input contains a non-JSON value.");
    }
    return `${JSON.stringify(key)}:${canonicalizeRfc8785Jcs(nested)}`;
  });
  return `{${entries.join(",")}}`;
}

export function sha256Jcs(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalizeRfc8785Jcs(value), "utf8").digest("hex")}`;
}

export function liveReadonlyPlanFingerprint(
  requestPlan: readonly LiveReadonlyRequestPlanEntry[],
  calendarEvidenceFingerprint: string,
  mappingRegistryId: string,
  mappingRegistryVersion: string,
  mappingRegistryFingerprint: string,
): string {
  return sha256Jcs({ calendarEvidenceFingerprint, mappingRegistryId, mappingRegistryVersion, mappingRegistryFingerprint, requests: requestPlan });
}

export function liveReadonlyRequestFingerprint(
  request: Omit<LiveReadonlyRequestPlanEntry, "requestFingerprint">,
): string {
  return sha256Jcs(request);
}

export function ownerAuthorizationSignatureMessage(manifestSha256: string): Uint8Array {
  return domainSeparatedMessage(OWNER_AUTHORIZATION_DOMAIN, manifestSha256);
}

export function exchangeCalendarSignatureMessage(calendarSha256: string): Uint8Array {
  return domainSeparatedMessage(EXCHANGE_CALENDAR_DOMAIN, calendarSha256);
}

export function trustedPublicKeyFingerprint(publicKeyPem: string): string {
  const key = createPublicKey(publicKeyPem);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("Trusted verification key must be Ed25519.");
  return `sha256:${createHash("sha256").update(key.export({ format: "der", type: "spki" })).digest("hex")}`;
}

export function createOwnerAuthorizationVerifier(
  trustRootProvider: OwnerTrustRootProvider | undefined,
): OwnerAuthorizationVerifier {
  const pinnedTrustRoot = loadPinnedTrustRoot(trustRootProvider);
  return Object.freeze({
    evaluate(input: unknown): LiveReadonlyPreflightResult {
      return evaluateLiveReadonlyPreflight(input, pinnedTrustRoot);
    },
  });
}

function evaluateLiveReadonlyPreflight(
  value: unknown,
  pinnedTrustRoot: TrustedOwnerVerificationKey | undefined,
): LiveReadonlyPreflightResult {
  const issues = new Set<LiveReadonlyPreflightIssueCode>();
  const blocked = (): LiveReadonlyPreflightResult => result("BLOCKED", issues);
  if (!isRecord(value) || !hasExactKeys(value, ["asOf", "manifest", "calendarEvidence"])) {
    addUnknownOrInvalid(value, ["asOf", "manifest", "calendarEvidence"], issues, LiveReadonlyPreflightIssueCode.InvalidAuthorizationManifest);
    return blocked();
  }
  const input = value as unknown as LiveReadonlyPreflightInput;
  if (pinnedTrustRoot === undefined) {
    issues.add(LiveReadonlyPreflightIssueCode.OwnerAuthorizationVerificationKeyUnavailable);
    return blocked();
  }
  const trust = validateTrustRoot(pinnedTrustRoot, issues);
  if (trust === undefined) return blocked();

  const calendar = validateCalendarEvidence(input.calendarEvidence, input.asOf, trust, issues);
  const manifest = validateManifest(input.manifest, input.asOf, trust, issues);
  if (calendar === undefined || manifest === undefined) return blocked();

  if (manifest.authorizationBody.calendarEvidenceId !== calendar.body.evidenceId ||
      manifest.authorizationBody.calendarEvidenceFingerprint !== calendar.fingerprint) {
    issues.add(LiveReadonlyPreflightIssueCode.CalendarDateConflict);
  }
  for (const request of manifest.authorizationBody.requests) {
    if (request.calendarEvidenceFingerprint !== calendar.fingerprint ||
        request.mappingRegistryId !== manifest.authorizationBody.mappingRegistryId ||
        request.mappingRegistryVersion !== manifest.authorizationBody.mappingRegistryVersion ||
        request.mappingRegistryFingerprint !== manifest.authorizationBody.mappingRegistryFingerprint) {
      issues.add(LiveReadonlyPreflightIssueCode.RequestPlanInvalid);
    }
  }
  const phase = deriveMarketPhase(calendar.body, input.asOf, issues);
  if (phase !== undefined && !requestWindowsMatchCalendar(manifest.authorizationBody.requests, calendar.body, phase.referenceSessionDate)) {
    issues.add(LiveReadonlyPreflightIssueCode.RequestPlanInvalid);
  }
  if (issues.size > 0 || phase === undefined) return blocked();
  return {
    status: "VERIFIED",
    issueCodes: Object.freeze([]),
    authorizationId: manifest.authorizationBody.authorizationId,
    manifestSha256: manifest.hash,
    calendarEvidenceId: calendar.body.evidenceId,
    calendarFingerprint: calendar.fingerprint,
    marketPhase: phase.marketPhase,
    referenceSessionDate: phase.referenceSessionDate,
    credentialReadPermitted: true,
    candidates: Object.freeze([]),
    attemptedNetworkRequests: 0,
    completedNetworkRequests: 0,
    persistenceWrites: 0,
    automatedExecutionAllowed: false,
  };
}

function loadPinnedTrustRoot(
  provider: OwnerTrustRootProvider | undefined,
): TrustedOwnerVerificationKey | undefined {
  try {
    const configured = provider?.getPinnedOwnerVerificationKey();
    if (configured === undefined) return undefined;
    return Object.freeze({
      source: configured.source,
      ownerKeyId: configured.ownerKeyId,
      publicKeyPem: configured.publicKeyPem,
      publicKeyFingerprint: configured.publicKeyFingerprint,
    });
  } catch {
    return undefined;
  }
}

function requestWindowsMatchCalendar(
  requestPlan: readonly LiveReadonlyRequestPlanEntry[],
  calendar: ExchangeCalendarBody,
  referenceSessionDate: string,
): boolean {
  const trading = calendar.sessions.filter((session) => session.status === "TRADING_SESSION" && session.sessionDate <= referenceSessionDate);
  const reference = trading.at(-1);
  const prior = trading.at(-2);
  if (reference === undefined || prior === undefined || reference.sessionDate !== referenceSessionDate ||
      reference.marketOpen === null || reference.marketClose === null || prior.marketOpen === null) return false;
  return requestPlan.every((request) => {
    if (request.capability !== "BARS") return request.start === null && request.end === null;
    if (request.interval === "P1D") return request.start === prior.marketOpen && request.end === reference.marketClose;
    return request.start === reference.marketOpen && request.end === reference.marketClose;
  });
}

function validateTrustRoot(
  value: TrustedOwnerVerificationKey,
  issues: Set<LiveReadonlyPreflightIssueCode>,
): TrustedOwnerVerificationKey | undefined {
  try {
    if (!hasExactKeys(value as unknown as Record<string, unknown>, ["source", "ownerKeyId", "publicKeyPem", "publicKeyFingerprint"]) ||
        value.source !== "PINNED_PRODUCT_CONFIGURATION" ||
        !IDENTIFIER.test(value.ownerKeyId) || !PEM_PUBLIC_KEY.test(value.publicKeyPem) ||
        !SHA256.test(value.publicKeyFingerprint)) {
      issues.add(LiveReadonlyPreflightIssueCode.OwnerAuthorizationVerificationKeyUnavailable);
      return undefined;
    }
    if (trustedPublicKeyFingerprint(value.publicKeyPem) !== value.publicKeyFingerprint) {
      issues.add(LiveReadonlyPreflightIssueCode.OwnerPublicKeyFingerprintMismatch);
      return undefined;
    }
    return value;
  } catch {
    issues.add(LiveReadonlyPreflightIssueCode.OwnerAuthorizationVerificationKeyUnavailable);
    return undefined;
  }
}

function validateManifest(
  value: unknown,
  asOf: string,
  trust: TrustedOwnerVerificationKey,
  issues: Set<LiveReadonlyPreflightIssueCode>,
): { readonly authorizationBody: OwnerNetworkAuthorizationBody; readonly hash: string } | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ["authorizationBody", "ownerApprovalEnvelope"])) {
    addUnknownOrInvalid(value, ["authorizationBody", "ownerApprovalEnvelope"], issues, LiveReadonlyPreflightIssueCode.InvalidAuthorizationManifest);
    return undefined;
  }
  const body = value.authorizationBody;
  const envelope = value.ownerApprovalEnvelope;
  if (!isRecord(body) || !hasExactKeys(body, AUTHORIZATION_BODY_FIELDS) || !isRecord(envelope) || !hasExactKeys(envelope, OWNER_ENVELOPE_FIELDS)) {
    addUnknownOrInvalid(body, AUTHORIZATION_BODY_FIELDS, issues, LiveReadonlyPreflightIssueCode.InvalidAuthorizationManifest);
    addUnknownOrInvalid(envelope, OWNER_ENVELOPE_FIELDS, issues, LiveReadonlyPreflightIssueCode.InvalidAuthorizationManifest);
    return undefined;
  }
  const initialIssueCount = issues.size;
  validateAuthorizationBody(body, asOf, issues);
  const hash = safeSha256Jcs(body, issues, LiveReadonlyPreflightIssueCode.InvalidAuthorizationManifest);
  if (hash === undefined) return undefined;
  if (envelope.manifestSha256 !== hash) issues.add(LiveReadonlyPreflightIssueCode.ManifestHashMismatch);
  validateApprovalEnvelope(envelope, hash, OWNER_AUTHORIZATION_DOMAIN, trust, issues, false);
  if (issues.size > initialIssueCount) return undefined;
  return { authorizationBody: body as unknown as OwnerNetworkAuthorizationBody, hash };
}

function validateAuthorizationBody(
  body: Record<string, unknown>,
  asOf: string,
  issues: Set<LiveReadonlyPreflightIssueCode>,
): void {
  const exact = body.schemaVersion === LIVE_READONLY_AUTHORIZATION_SCHEMA_VERSION &&
    body.authorizationType === "PERSONAL_DAILY_SCAN_LIVE_READONLY" &&
    isIdentifier(body.authorizationId) && isIdentifier(body.ownerDecisionReference) &&
    body.provider === "ALPACA_MARKET_DATA" && body.feed === "iex" &&
    isIdentifier(body.mappingRegistryId) && isIdentifier(body.mappingRegistryVersion) &&
    typeof body.mappingRegistryFingerprint === "string" && SHA256.test(body.mappingRegistryFingerprint) &&
    isIdentifier(body.calendarEvidenceId) &&
    typeof body.calendarEvidenceFingerprint === "string" && SHA256.test(body.calendarEvidenceFingerprint) &&
    typeof body.planFingerprint === "string" && SHA256.test(body.planFingerprint) &&
    body.maximumNetworkRequests === 5 && body.maximumAttemptsPerRequest === 1 &&
    body.retryAllowed === false && body.paginationAllowed === false && body.pollingAllowed === false &&
    body.streamingAllowed === false && body.backgroundExecutionAllowed === false &&
    body.credentialReadAllowedAfterPreflightOnly === true && body.persistenceAllowed === false &&
    body.accountAccessAllowed === false && body.positionAccessAllowed === false &&
    body.balanceAccessAllowed === false && body.orderAccessAllowed === false &&
    body.brokerAllowed === false && body.paperTradingAllowed === false && body.automatedExecutionAllowed === false;
  if (!exact) issues.add(LiveReadonlyPreflightIssueCode.InvalidAuthorizationManifest);
  const validFrom = timestamp(body.validFrom);
  const expiresAt = timestamp(body.expiresAt);
  const now = timestamp(asOf);
  if (validFrom === undefined || expiresAt === undefined || now === undefined || expiresAt <= validFrom || expiresAt - validFrom > AUTHORIZATION_MAX_DURATION_MS) {
    issues.add(LiveReadonlyPreflightIssueCode.InvalidAuthorizationWindow);
  } else {
    if (now < validFrom) issues.add(LiveReadonlyPreflightIssueCode.AuthorizationNotYetValid);
    if (now > expiresAt) issues.add(LiveReadonlyPreflightIssueCode.AuthorizationExpired);
  }
  if (typeof body.executeDate !== "string" || !DATE.test(body.executeDate) || body.executeDate !== exchangeLocalDate(asOf) ||
      (typeof body.validFrom === "string" && body.executeDate !== exchangeLocalDate(body.validFrom)) ||
      (typeof body.expiresAt === "string" && body.executeDate !== exchangeLocalDate(body.expiresAt))) {
    issues.add(LiveReadonlyPreflightIssueCode.ExecuteDateConflict);
  }
  const requestPlan = body.requests;
  if (!Array.isArray(requestPlan) || requestPlan.length !== 5) {
    issues.add(LiveReadonlyPreflightIssueCode.RequestPlanInvalid);
    return;
  }
  requestPlan.forEach((request) => validateRequest(request, issues));
  if (!requestSetIsExact(requestPlan)) issues.add(LiveReadonlyPreflightIssueCode.RequestPlanInvalid);
  try {
    const expected = liveReadonlyPlanFingerprint(
      requestPlan as unknown as readonly LiveReadonlyRequestPlanEntry[],
      body.calendarEvidenceFingerprint as string,
      body.mappingRegistryId as string,
      body.mappingRegistryVersion as string,
      body.mappingRegistryFingerprint as string,
    );
    if (body.planFingerprint !== expected) issues.add(LiveReadonlyPreflightIssueCode.PlanFingerprintMismatch);
  } catch {
    issues.add(LiveReadonlyPreflightIssueCode.PlanFingerprintMismatch);
  }
}

function validateRequest(value: unknown, issues: Set<LiveReadonlyPreflightIssueCode>): void {
  if (!isRecord(value) || !hasExactKeys(value, REQUEST_FIELDS)) {
    addUnknownOrInvalid(value, REQUEST_FIELDS, issues, LiveReadonlyPreflightIssueCode.RequestPlanInvalid);
    return;
  }
  const common = Number.isInteger(value.ordinal) && value.method === "GET" && value.host === "data.alpaca.markets" &&
    value.feed === "iex" && value.currency === "USD" && value.timeoutMs === 10_000 && value.maximumResponseBytes === 1_048_576 &&
    Number.isSafeInteger(value.maximumEvidenceRecords) && Number(value.maximumEvidenceRecords) > 0 &&
    typeof value.calendarEvidenceFingerprint === "string" && SHA256.test(value.calendarEvidenceFingerprint) &&
    isIdentifier(value.mappingRegistryId) && isIdentifier(value.mappingRegistryVersion) &&
    typeof value.mappingRegistryFingerprint === "string" && SHA256.test(value.mappingRegistryFingerprint) &&
    isSortedUniqueSymbols(value.symbols);
  if (!common) issues.add(LiveReadonlyPreflightIssueCode.RequestPlanInvalid);
  if (value.capability === "BARS") {
    if (value.path !== "/v2/stocks/bars" || !["P1D", "PT1H", "PT15M", "PT5M"].includes(value.interval as string) ||
        value.adjustment !== "raw" || value.sort !== "asc" || timestamp(value.start) === undefined ||
        timestamp(value.end) === undefined || (timestamp(value.start) ?? 0) >= (timestamp(value.end) ?? 0) || value.limit !== 2) {
      issues.add(LiveReadonlyPreflightIssueCode.RequestPlanInvalid);
    }
  } else if (value.capability === "LATEST_QUOTES") {
    if (value.path !== "/v2/stocks/quotes/latest" || value.interval !== "NONE" || value.adjustment !== "NONE" ||
        value.sort !== "NONE" || value.start !== null || value.end !== null || value.limit !== null) {
      issues.add(LiveReadonlyPreflightIssueCode.RequestPlanInvalid);
    }
  } else {
    issues.add(LiveReadonlyPreflightIssueCode.RequestPlanInvalid);
  }
  try {
    const { requestFingerprint, ...descriptor } = value;
    if (typeof requestFingerprint !== "string" || requestFingerprint !== liveReadonlyRequestFingerprint(
      descriptor as unknown as Omit<LiveReadonlyRequestPlanEntry, "requestFingerprint">,
    )) {
      issues.add(LiveReadonlyPreflightIssueCode.RequestFingerprintMismatch);
      issues.add(LiveReadonlyPreflightIssueCode.RequestPlanInvalid);
    }
  } catch {
    issues.add(LiveReadonlyPreflightIssueCode.RequestFingerprintMismatch);
    issues.add(LiveReadonlyPreflightIssueCode.RequestPlanInvalid);
  }
}

function requestSetIsExact(requests: readonly unknown[]): boolean {
  return EXPECTED_REQUESTS.every((expected, index) => {
    const request = requests[index];
    return isRecord(request) && request.ordinal === expected.ordinal && request.capability === expected.capability &&
      request.interval === expected.interval && request.maximumEvidenceRecords === expected.maximumEvidenceRecords &&
      JSON.stringify(request.symbols) === JSON.stringify(expected.symbols);
  });
}

function validateCalendarEvidence(
  value: unknown,
  asOf: string,
  trust: TrustedOwnerVerificationKey,
  issues: Set<LiveReadonlyPreflightIssueCode>,
): { readonly body: ExchangeCalendarBody; readonly fingerprint: string } | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ["calendarBody", "ownerApprovalEnvelope"])) {
    addUnknownOrInvalid(value, ["calendarBody", "ownerApprovalEnvelope"], issues, LiveReadonlyPreflightIssueCode.InvalidCalendarEvidence);
    return undefined;
  }
  const body = value.calendarBody;
  const envelope = value.ownerApprovalEnvelope;
  if (!isRecord(body) || !hasExactKeys(body, CALENDAR_BODY_FIELDS) || !isRecord(envelope) || !hasExactKeys(envelope, CALENDAR_ENVELOPE_FIELDS)) {
    addUnknownOrInvalid(body, CALENDAR_BODY_FIELDS, issues, LiveReadonlyPreflightIssueCode.InvalidCalendarEvidence);
    addUnknownOrInvalid(envelope, CALENDAR_ENVELOPE_FIELDS, issues, LiveReadonlyPreflightIssueCode.InvalidCalendarEvidence);
    return undefined;
  }
  const initialIssueCount = issues.size;
  validateCalendarBody(body, asOf, issues);
  const fingerprint = safeSha256Jcs(body, issues, LiveReadonlyPreflightIssueCode.InvalidCalendarEvidence);
  if (fingerprint === undefined) return undefined;
  if (envelope.calendarSha256 !== fingerprint) issues.add(LiveReadonlyPreflightIssueCode.CalendarFingerprintMismatch);
  validateApprovalEnvelope(envelope, fingerprint, EXCHANGE_CALENDAR_DOMAIN, trust, issues, true);
  if (issues.size > initialIssueCount) return undefined;
  return { body: body as unknown as ExchangeCalendarBody, fingerprint };
}

function validateCalendarBody(
  body: Record<string, unknown>,
  asOf: string,
  issues: Set<LiveReadonlyPreflightIssueCode>,
): void {
  if (body.schemaVersion !== EXCHANGE_CALENDAR_EVIDENCE_SCHEMA_VERSION || !isIdentifier(body.evidenceId) ||
      body.calendarId !== "US_EQUITIES_PRIMARY_SESSION" || !isIdentifier(body.calendarVersion) ||
      !isIdentifier(body.producerId) || !isIdentifier(body.producerVersion) || !isIdentifier(body.authoritySource) ||
      !isIdentifier(body.ownerDecisionReference) || body.timezone !== "America/New_York" ||
      !Number.isInteger(body.closureBufferSeconds) || (body.closureBufferSeconds as number) < 1 ||
      (body.closureBufferSeconds as number) > 900 || !Array.isArray(body.sessions) || body.sessions.length < 2) {
    issues.add(LiveReadonlyPreflightIssueCode.InvalidCalendarEvidence);
  }
  const validFrom = timestamp(body.validFrom);
  const validThrough = timestamp(body.validThrough);
  const now = timestamp(asOf);
  if (validFrom === undefined || validThrough === undefined || now === undefined || validThrough < validFrom) {
    issues.add(LiveReadonlyPreflightIssueCode.InvalidCalendarEvidence);
  } else if (now < validFrom || now > validThrough) {
    issues.add(LiveReadonlyPreflightIssueCode.CalendarEvidenceExpired);
  }
  if (!Array.isArray(body.sessions)) return;
  let priorDate = "";
  for (const session of body.sessions) {
    validateCalendarSession(session, issues);
    if (isRecord(session) && typeof session.sessionDate === "string") {
      if (session.sessionDate <= priorDate) issues.add(LiveReadonlyPreflightIssueCode.CalendarDateConflict);
      priorDate = session.sessionDate;
    }
  }
}

function validateCalendarSession(value: unknown, issues: Set<LiveReadonlyPreflightIssueCode>): void {
  if (!isRecord(value) || !hasExactKeys(value, CALENDAR_SESSION_FIELDS) || typeof value.sessionDate !== "string" || !DATE.test(value.sessionDate)) {
    addUnknownOrInvalid(value, CALENDAR_SESSION_FIELDS, issues, LiveReadonlyPreflightIssueCode.InvalidCalendarEvidence);
    return;
  }
  if (value.status === "TRADING_SESSION") {
    const open = timestamp(value.marketOpen);
    const close = timestamp(value.marketClose);
    if (open === undefined || close === undefined || close <= open ||
        exchangeLocalDate(value.marketOpen as string) !== value.sessionDate ||
        exchangeLocalDate(value.marketClose as string) !== value.sessionDate ||
        exchangeLocalTime(value.marketOpen as string) !== "09:30:00" ||
        (value.earlyClose === false && exchangeLocalTime(value.marketClose as string) !== "16:00:00") ||
        (value.earlyClose === true && exchangeLocalTime(value.marketClose as string) !== "13:00:00") ||
        typeof value.earlyClose !== "boolean") {
      issues.add(LiveReadonlyPreflightIssueCode.InvalidCalendarEvidence);
    } else {
      const duration = close - open;
      if (duration > 6.5 * 60 * 60 * 1000 || duration < 3 * 60 * 60 * 1000 || value.earlyClose !== (duration < 6.5 * 60 * 60 * 1000)) {
        issues.add(LiveReadonlyPreflightIssueCode.InvalidCalendarEvidence);
      }
    }
  } else if (value.status === "MARKET_HOLIDAY" || value.status === "WEEKEND") {
    if (value.marketOpen !== null || value.marketClose !== null || value.earlyClose !== false) {
      issues.add(LiveReadonlyPreflightIssueCode.InvalidCalendarEvidence);
    }
  } else {
    issues.add(LiveReadonlyPreflightIssueCode.InvalidCalendarEvidence);
  }
}

function deriveMarketPhase(
  calendar: ExchangeCalendarBody,
  asOf: string,
  issues: Set<LiveReadonlyPreflightIssueCode>,
): { readonly marketPhase: LiveReadonlyMarketPhase; readonly referenceSessionDate: string } | undefined {
  const currentDate = exchangeLocalDate(asOf);
  const current = calendar.sessions.find((session) => session.sessionDate === currentDate);
  if (current === undefined) {
    issues.add(LiveReadonlyPreflightIssueCode.CalendarEvidenceUnavailable);
    return undefined;
  }
  const now = timestamp(asOf);
  if (now === undefined) {
    issues.add(LiveReadonlyPreflightIssueCode.CalendarDateConflict);
    return undefined;
  }
  let phase: LiveReadonlyMarketPhase;
  let includeCurrent = false;
  if (current.status !== "TRADING_SESSION") {
    phase = "NON_TRADING_DAY";
  } else {
    const open = timestamp(current.marketOpen);
    const close = timestamp(current.marketClose);
    if (open === undefined || close === undefined) return undefined;
    if (now < open) phase = "PRE_MARKET";
    else if (now < close) phase = "REGULAR_SESSION";
    else if (now < close + calendar.closureBufferSeconds * 1000) phase = "POST_CLOSE_BUFFER";
    else {
      phase = "POST_CLOSE";
      includeCurrent = true;
    }
  }
  const completed = calendar.sessions.filter((session) => session.status === "TRADING_SESSION" &&
    (session.sessionDate < currentDate || (includeCurrent && session.sessionDate === currentDate)));
  const reference = completed.at(-1);
  if (reference === undefined) {
    issues.add(LiveReadonlyPreflightIssueCode.CompletedReferenceSessionUnavailable);
    return undefined;
  }
  return { marketPhase: phase, referenceSessionDate: reference.sessionDate };
}

function validateApprovalEnvelope(
  envelope: Record<string, unknown>,
  hash: string,
  domain: string,
  trust: TrustedOwnerVerificationKey,
  issues: Set<LiveReadonlyPreflightIssueCode>,
  calendar: boolean,
): void {
  const hashField = calendar ? envelope.calendarSha256 : envelope.manifestSha256;
  if (hashField !== hash || envelope.signatureAlgorithm !== "Ed25519") {
    issues.add(calendar ? LiveReadonlyPreflightIssueCode.CalendarOwnerApprovalInvalid : LiveReadonlyPreflightIssueCode.ManifestHashMismatch);
  }
  if (envelope.ownerKeyId !== trust.ownerKeyId) issues.add(LiveReadonlyPreflightIssueCode.OwnerKeyMismatch);
  if (envelope.ownerPublicKeyFingerprint !== trust.publicKeyFingerprint) issues.add(LiveReadonlyPreflightIssueCode.OwnerPublicKeyFingerprintMismatch);
  if (typeof envelope.ownerSignature !== "string") {
    issues.add(calendar ? LiveReadonlyPreflightIssueCode.CalendarOwnerApprovalInvalid : LiveReadonlyPreflightIssueCode.OwnerSignatureInvalid);
    return;
  }
  try {
    const signature = decodeBase64Strict(envelope.ownerSignature);
    const key = createPublicKey(trust.publicKeyPem);
    const valid = verify(null, domainSeparatedMessage(domain, hash), key, signature);
    if (!valid) issues.add(calendar ? LiveReadonlyPreflightIssueCode.CalendarOwnerApprovalInvalid : LiveReadonlyPreflightIssueCode.OwnerSignatureInvalid);
  } catch {
    issues.add(calendar ? LiveReadonlyPreflightIssueCode.CalendarOwnerApprovalInvalid : LiveReadonlyPreflightIssueCode.OwnerSignatureInvalid);
  }
}

function domainSeparatedMessage(domain: string, hash: string): Uint8Array {
  if (!SHA256.test(hash)) throw new Error("A canonical SHA-256 fingerprint is required.");
  const prefix = new TextEncoder().encode(domain);
  const rawHash = hexToBytes(hash.slice("sha256:".length));
  const message = new Uint8Array(prefix.length + rawHash.length);
  message.set(prefix);
  message.set(rawHash, prefix.length);
  return message;
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/u.test(hex)) throw new Error("Invalid SHA-256 hex.");
  return Uint8Array.from({ length: 32 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16));
}

function decodeBase64Strict(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(value) || value.length % 4 !== 0) throw new Error("Invalid base64.");
  const decoded = atob(value);
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  if (btoa(String.fromCharCode(...bytes)) !== value) throw new Error("Non-canonical base64.");
  return bytes;
}

function safeSha256Jcs(
  value: unknown,
  issues: Set<LiveReadonlyPreflightIssueCode>,
  issue: LiveReadonlyPreflightIssueCode,
): string | undefined {
  try { return sha256Jcs(value); } catch { issues.add(issue); return undefined; }
}

function result(status: "BLOCKED", issues: Set<LiveReadonlyPreflightIssueCode>): LiveReadonlyPreflightResult {
  return {
    status,
    issueCodes: Object.freeze([...issues].sort()),
    authorizationId: null,
    manifestSha256: null,
    calendarEvidenceId: null,
    calendarFingerprint: null,
    marketPhase: null,
    referenceSessionDate: null,
    credentialReadPermitted: false,
    candidates: Object.freeze([]),
    attemptedNetworkRequests: 0,
    completedNetworkRequests: 0,
    persistenceWrites: 0,
    automatedExecutionAllowed: false,
  };
}

function addUnknownOrInvalid(
  value: unknown,
  fields: readonly string[],
  issues: Set<LiveReadonlyPreflightIssueCode>,
  invalid: LiveReadonlyPreflightIssueCode,
): void {
  if (isRecord(value) && Object.keys(value).some((key) => !fields.includes(key))) {
    issues.add(LiveReadonlyPreflightIssueCode.UndeclaredField);
  } else {
    issues.add(invalid);
  }
}

function hasExactKeys(value: Record<string, unknown>, fields: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === fields.length && keys.every((key) => fields.includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function timestamp(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : undefined;
}

function exchangeLocalDate(timestampValue: string): string {
  const parsed = timestamp(timestampValue);
  if (parsed === undefined) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(parsed));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function exchangeLocalTime(timestampValue: string): string {
  const parsed = timestamp(timestampValue);
  if (parsed === undefined) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(parsed));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.hour}:${values.minute}:${values.second}`;
}

function isSortedUniqueSymbols(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && /^[A-Z][A-Z0-9.]{0,9}$/u.test(item)) &&
    JSON.stringify(value) === JSON.stringify([...new Set(value)].sort());
}

function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}
