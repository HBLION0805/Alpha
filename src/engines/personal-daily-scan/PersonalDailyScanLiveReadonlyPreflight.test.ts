import { generateKeyPairSync, sign } from "node:crypto";
import process from "node:process";

import {
  LiveReadonlyPreflightIssueCode,
  type ExchangeCalendarBody,
  type ExchangeCalendarEvidence,
  type LiveReadonlyPreflightInput,
  type LiveReadonlyRequestPlanEntry,
  type OwnerNetworkAuthorizationBody,
  type OwnerNetworkAuthorizationManifest,
  type OwnerAuthorizationVerifier,
  type TrustedOwnerVerificationKey,
} from "../../contracts/PersonalDailyScanLiveReadonly";
import {
  canonicalizeRfc8785Jcs,
  createOwnerAuthorizationVerifier,
  exchangeCalendarSignatureMessage,
  liveReadonlyPlanFingerprint,
  ownerAuthorizationSignatureMessage,
  sha256Jcs,
  trustedPublicKeyFingerprint,
} from "./PersonalDailyScanLiveReadonlyPreflight";

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: () => void): void { tests.push([name, run]); }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function equal(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}

const keys = generateKeyPairSync("ed25519");
const publicKeyPem = keys.publicKey.export({ format: "pem", type: "spki" });
const trust: TrustedOwnerVerificationKey = {
  source: "PINNED_PRODUCT_CONFIGURATION",
  ownerKeyId: "owner-key:phase1b-test",
  publicKeyPem,
  publicKeyFingerprint: trustedPublicKeyFingerprint(publicKeyPem),
};
const productTrustRootProvider = Object.freeze({
  getPinnedOwnerVerificationKey: (): TrustedOwnerVerificationKey => trust,
});
const productVerifier = createOwnerAuthorizationVerifier(productTrustRootProvider);
const calendarFingerprintPlaceholder = `sha256:${"a".repeat(64)}`;

function base64(value: Uint8Array): string { return btoa(String.fromCharCode(...value)); }

function requests(calendarFingerprint: string, dailyStart: string, sessionOpen: string, sessionClose: string): readonly LiveReadonlyRequestPlanEntry[] {
  const common = { method: "GET" as const, host: "data.alpaca.markets" as const, feed: "iex" as const,
    timeoutMs: 10_000, maximumResponseBytes: 1_048_576, calendarEvidenceFingerprint: calendarFingerprint,
    mappingRegistryVersion: "personal-watchlist-mapping:v1.0" };
  return Object.freeze([
    { ...common, ordinal: 1, path: "/v2/stocks/bars", capability: "BARS", interval: "P1D", symbols: ["MU", "QQQ", "SKHY", "SMH", "SPCX", "TSLA"], adjustment: "raw", sort: "asc", start: dailyStart, end: sessionClose, limit: 1000 },
    { ...common, ordinal: 2, path: "/v2/stocks/bars", capability: "BARS", interval: "PT1H", symbols: ["MU", "SKHY", "SPCX", "TSLA"], adjustment: "raw", sort: "asc", start: sessionOpen, end: sessionClose, limit: 1000 },
    { ...common, ordinal: 3, path: "/v2/stocks/bars", capability: "BARS", interval: "PT15M", symbols: ["MU", "SKHY", "SPCX", "TSLA"], adjustment: "raw", sort: "asc", start: sessionOpen, end: sessionClose, limit: 1000 },
    { ...common, ordinal: 4, path: "/v2/stocks/bars", capability: "BARS", interval: "PT5M", symbols: ["MU", "SKHY", "SPCX", "TSLA"], adjustment: "raw", sort: "asc", start: sessionOpen, end: sessionClose, limit: 1000 },
    { ...common, ordinal: 5, path: "/v2/stocks/quotes/latest", capability: "LATEST_QUOTES", interval: "NONE", symbols: ["MULL", "SKDD", "SKUU", "SPCH", "SSPC", "TSLL", "TSLQ"], adjustment: "NONE", sort: "NONE", start: null, end: null, limit: null },
  ]);
}

function calendarBody(sessions: ExchangeCalendarBody["sessions"], overrides: Partial<ExchangeCalendarBody> = {}): ExchangeCalendarBody {
  return {
    schemaVersion: "1.0", evidenceId: "calendar-evidence:phase1b-test", calendarId: "US_EQUITIES_PRIMARY_SESSION",
    calendarVersion: "exchange-calendar:2026.07", producerId: "calendar-producer:test", producerVersion: "producer:v1",
    authoritySource: "owner-approved-exchange-calendar", ownerDecisionReference: "owner-decision:phase1b-d2",
    timezone: "America/New_York", validFrom: "2026-01-01T00:00:00.000Z", validThrough: "2026-12-31T23:59:59.999Z",
    closureBufferSeconds: 300, sessions, ...overrides,
  };
}

function signedCalendarWith(
  body: ExchangeCalendarBody,
  signingKeys: typeof keys,
  signingTrust: TrustedOwnerVerificationKey,
  signatureMessage = exchangeCalendarSignatureMessage,
): ExchangeCalendarEvidence {
  const hash = sha256Jcs(body);
  return { calendarBody: body, ownerApprovalEnvelope: { calendarSha256: hash, signatureAlgorithm: "Ed25519",
    ownerKeyId: signingTrust.ownerKeyId, ownerPublicKeyFingerprint: signingTrust.publicKeyFingerprint,
    ownerSignature: base64(sign(null, signatureMessage(hash), signingKeys.privateKey)) } };
}

function signedCalendar(body: ExchangeCalendarBody): ExchangeCalendarEvidence {
  return signedCalendarWith(body, keys, trust);
}

function manifestBody(calendar: ExchangeCalendarEvidence, asOf = "2026-07-30T14:00:00.000Z"): OwnerNetworkAuthorizationBody {
  const fingerprint = calendar.ownerApprovalEnvelope.calendarSha256;
  const local = localDate(asOf);
  const current = calendar.calendarBody.sessions.find((session) => session.sessionDate === local);
  const asOfMs = Date.parse(asOf);
  const currentCompleted = current?.status === "TRADING_SESSION" && current.marketClose !== null &&
    asOfMs >= Date.parse(current.marketClose) + calendar.calendarBody.closureBufferSeconds * 1000;
  const trading = calendar.calendarBody.sessions.filter((session) => session.status === "TRADING_SESSION" &&
    (session.sessionDate < local || (session.sessionDate === local && currentCompleted)));
  const reference = trading.at(-1)!;
  const prior = trading.at(-2)!;
  const plan = requests(fingerprint, prior.marketOpen!, reference.marketOpen!, reference.marketClose!);
  return {
    schemaVersion: "1.0", authorizationType: "PERSONAL_DAILY_SCAN_LIVE_READONLY", authorizationId: "authorization:phase1b-test",
    ownerDecisionReference: "owner-decision:phase1b-d2", executeDate: asOf.slice(0, 10), validFrom: "2026-07-30T13:55:00.000Z",
    expiresAt: "2026-07-30T14:05:00.000Z", provider: "ALPACA_MARKET_DATA", feed: "iex",
    mappingRegistryVersion: "personal-watchlist-mapping:v1.0", calendarEvidenceId: calendar.calendarBody.evidenceId,
    calendarEvidenceFingerprint: fingerprint, planFingerprint: liveReadonlyPlanFingerprint(plan, fingerprint, "personal-watchlist-mapping:v1.0"),
    maximumNetworkRequests: 5, maximumAttemptsPerRequest: 1, retryAllowed: false, paginationAllowed: false,
    pollingAllowed: false, streamingAllowed: false, backgroundExecutionAllowed: false,
    credentialReadAllowedAfterPreflightOnly: true, persistenceAllowed: false, accountAccessAllowed: false,
    positionAccessAllowed: false, balanceAccessAllowed: false, orderAccessAllowed: false, brokerAllowed: false,
    paperTradingAllowed: false, automatedExecutionAllowed: false, requests: plan,
  };
}

function signedManifestWith(
  body: OwnerNetworkAuthorizationBody,
  signingKeys: typeof keys,
  signingTrust: TrustedOwnerVerificationKey,
  signatureMessage = ownerAuthorizationSignatureMessage,
): OwnerNetworkAuthorizationManifest {
  const hash = sha256Jcs(body);
  return { authorizationBody: body, ownerApprovalEnvelope: { manifestSha256: hash, signatureAlgorithm: "Ed25519",
    ownerKeyId: signingTrust.ownerKeyId, ownerPublicKeyFingerprint: signingTrust.publicKeyFingerprint,
    ownerSignature: base64(sign(null, signatureMessage(hash), signingKeys.privateKey)) } };
}

function signedManifest(body: OwnerNetworkAuthorizationBody): OwnerNetworkAuthorizationManifest {
  return signedManifestWith(body, keys, trust);
}

const julySessions: ExchangeCalendarBody["sessions"] = [
  { sessionDate: "2026-07-28", status: "TRADING_SESSION", marketOpen: "2026-07-28T13:30:00.000Z", marketClose: "2026-07-28T20:00:00.000Z", earlyClose: false },
  { sessionDate: "2026-07-29", status: "TRADING_SESSION", marketOpen: "2026-07-29T13:30:00.000Z", marketClose: "2026-07-29T20:00:00.000Z", earlyClose: false },
  { sessionDate: "2026-07-30", status: "TRADING_SESSION", marketOpen: "2026-07-30T13:30:00.000Z", marketClose: "2026-07-30T20:00:00.000Z", earlyClose: false },
  { sessionDate: "2026-07-31", status: "TRADING_SESSION", marketOpen: "2026-07-31T13:30:00.000Z", marketClose: "2026-07-31T20:00:00.000Z", earlyClose: false },
  { sessionDate: "2026-08-01", status: "WEEKEND", marketOpen: null, marketClose: null, earlyClose: false },
];

function validInput(asOf = "2026-07-30T14:00:00.000Z", sessions = julySessions): LiveReadonlyPreflightInput {
  const calendar = signedCalendar(calendarBody(sessions));
  const body = manifestBody(calendar, asOf);
  const from = new Date(Date.parse(asOf) - 60_000).toISOString();
  const until = new Date(Date.parse(asOf) + 60_000).toISOString();
  const dated = { ...body, executeDate: localDate(asOf), validFrom: from, expiresAt: until };
  return { asOf, calendarEvidence: calendar, manifest: signedManifest(dated) };
}

function localDate(value: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function evaluate(input: unknown, verifier: OwnerAuthorizationVerifier = productVerifier): ReturnType<OwnerAuthorizationVerifier["evaluate"]> {
  return verifier.evaluate(input);
}

function assertBlocked(result: ReturnType<OwnerAuthorizationVerifier["evaluate"]>, code: LiveReadonlyPreflightIssueCode): void {
  equal(result.status, "BLOCKED", "status"); assert(result.issueCodes.includes(code), `missing ${code}`);
  equal([result.attemptedNetworkRequests, result.completedNetworkRequests, result.persistenceWrites, result.automatedExecutionAllowed, result.credentialReadPermitted], [0, 0, 0, false, false], "side effects");
  equal(result.candidates, [], "blocked candidates");
  equal(result.issueCodes, [...result.issueCodes].sort(), "stable issue ordering");
}

test("RFC 8785 JCS golden vector is stable", () => {
  equal(canonicalizeRfc8785Jcs({ b: 1, a: 2 }), '{"a":2,"b":1}', "canonical JSON");
  equal(sha256Jcs({ b: 1, a: 2 }), "sha256:d3626ac30a87e6f7a6428233b3c68299976865fa5508e4267c5415c76af7a772", "golden SHA-256");
});

test("RFC 8785 number golden vector and Unicode rejection are stable", () => {
  const numbers = [333333333.33333329, 1e30, 4.5, 0.002, 1e-27];
  equal(canonicalizeRfc8785Jcs(numbers), "[333333333.3333333,1e+30,4.5,0.002,1e-27]", "canonical numbers");
  equal(sha256Jcs(numbers), "sha256:7c6bc86d861387d823ae596b79ca0b26567dddc22a77acb1f4e06d441f555adf", "number-vector SHA-256");
  let rejected = false;
  try { canonicalizeRfc8785Jcs("\ud800"); } catch { rejected = true; }
  assert(rejected, "lone surrogate must be rejected");
});

test("exact domain-separated signature message contains raw 32-byte hash", () => {
  const hash = `sha256:${"00".repeat(32)}`;
  const message = ownerAuthorizationSignatureMessage(hash);
  equal(message.length, new TextEncoder().encode("ALPHA_OWNER_NETWORK_AUTHORIZATION_V1\0").length + 32, "message length");
  equal([...message.slice(-32)], new Array(32).fill(0), "raw hash suffix");
});

test("trusted Ed25519 approval verifies with zero side effects", () => {
  const result = evaluate(validInput());
  equal(result.status, "VERIFIED", "status"); equal(result.marketPhase, "REGULAR_SESSION", "phase");
  equal(result.referenceSessionDate, "2026-07-29", "completed session");
  equal([result.attemptedNetworkRequests, result.completedNetworkRequests, result.persistenceWrites, result.automatedExecutionAllowed], [0, 0, 0, false], "side effects");
});

test("missing product trust-root provider blocks before credential or network authority", () => {
  assertBlocked(evaluate(validInput(), createOwnerAuthorizationVerifier(undefined)), LiveReadonlyPreflightIssueCode.OwnerAuthorizationVerificationKeyUnavailable);
});

test("self-consistent attacker key, metadata, Manifest, and Calendar cannot replace product trust", () => {
  const attackerKeys = generateKeyPairSync("ed25519");
  const attackerPem = attackerKeys.publicKey.export({ format: "pem", type: "spki" });
  const attackerTrust: TrustedOwnerVerificationKey = {
    source: "PINNED_PRODUCT_CONFIGURATION",
    ownerKeyId: "owner-key:attacker",
    publicKeyPem: attackerPem,
    publicKeyFingerprint: trustedPublicKeyFingerprint(attackerPem),
  };
  const calendar = signedCalendarWith(calendarBody(julySessions), attackerKeys, attackerTrust);
  const body = manifestBody(calendar);
  const attackerInput = {
    asOf: "2026-07-30T14:00:00.000Z",
    calendarEvidence: calendar,
    manifest: signedManifestWith(body, attackerKeys, attackerTrust),
  };
  const result = evaluate(attackerInput);
  assertBlocked(result, LiveReadonlyPreflightIssueCode.OwnerKeyMismatch);
  assert(result.issueCodes.includes(LiveReadonlyPreflightIssueCode.OwnerPublicKeyFingerprintMismatch), "attacker fingerprint must not select trust");
  assert(result.issueCodes.includes(LiveReadonlyPreflightIssueCode.OwnerSignatureInvalid), "attacker Manifest signature must fail");
  assert(result.issueCodes.includes(LiveReadonlyPreflightIssueCode.CalendarOwnerApprovalInvalid), "attacker Calendar signature must fail");
});

test("business input cannot inject or override trust-root material", () => {
  const input = validInput();
  for (const injected of [
    { trustedOwnerVerificationKey: trust },
    { ownerPublicKeyPem: trust.publicKeyPem },
    { ownerPublicKeyFingerprint: trust.publicKeyFingerprint },
    { ownerKeyId: trust.ownerKeyId },
    { ownerTrustRootSource: trust.source },
  ]) {
    assertBlocked(evaluate({ ...input, ...injected }), LiveReadonlyPreflightIssueCode.UndeclaredField);
  }
});

test("product trust configuration rejects wrong key, fingerprint, and key ID", () => {
  const otherKeys = generateKeyPairSync("ed25519");
  const otherPem = otherKeys.publicKey.export({ format: "pem", type: "spki" });
  const otherFingerprint = trustedPublicKeyFingerprint(otherPem);
  const cases = [
    [
      { ...trust, publicKeyPem: otherPem, publicKeyFingerprint: otherFingerprint },
      LiveReadonlyPreflightIssueCode.OwnerSignatureInvalid,
    ],
    [
      { ...trust, publicKeyFingerprint: otherFingerprint },
      LiveReadonlyPreflightIssueCode.OwnerPublicKeyFingerprintMismatch,
    ],
    [
      { ...trust, ownerKeyId: "owner-key:wrong-product-key-id" },
      LiveReadonlyPreflightIssueCode.OwnerKeyMismatch,
    ],
  ] as const;
  for (const [configured, issue] of cases) {
    const verifier = createOwnerAuthorizationVerifier({ getPinnedOwnerVerificationKey: () => configured });
    assertBlocked(evaluate(validInput(), verifier), issue);
  }
});

test("Manifest and Calendar approvals fail independently", () => {
  const input = validInput();
  const manifest = input.manifest as OwnerNetworkAuthorizationManifest;
  const calendar = input.calendarEvidence as ExchangeCalendarEvidence;
  const badManifest = {
    ...manifest,
    ownerApprovalEnvelope: { ...manifest.ownerApprovalEnvelope, ownerSignature: base64(new Uint8Array(64)) },
  };
  const badCalendar = {
    ...calendar,
    ownerApprovalEnvelope: { ...calendar.ownerApprovalEnvelope, ownerSignature: base64(new Uint8Array(64)) },
  };
  assertBlocked(evaluate({ ...input, manifest: badManifest }), LiveReadonlyPreflightIssueCode.OwnerSignatureInvalid);
  assertBlocked(evaluate({ ...input, calendarEvidence: badCalendar }), LiveReadonlyPreflightIssueCode.CalendarOwnerApprovalInvalid);
});

test("Manifest and Calendar signature domains cannot be exchanged", () => {
  const input = validInput();
  const originalCalendar = input.calendarEvidence as ExchangeCalendarEvidence;
  const wrongCalendar = signedCalendarWith(originalCalendar.calendarBody, keys, trust, ownerAuthorizationSignatureMessage);
  const originalManifest = input.manifest as OwnerNetworkAuthorizationManifest;
  const wrongManifest = signedManifestWith(originalManifest.authorizationBody, keys, trust, exchangeCalendarSignatureMessage);
  assertBlocked(evaluate({ ...input, calendarEvidence: wrongCalendar }), LiveReadonlyPreflightIssueCode.CalendarOwnerApprovalInvalid);
  assertBlocked(evaluate({ ...input, manifest: wrongManifest }), LiveReadonlyPreflightIssueCode.OwnerSignatureInvalid);
});

test("signed Manifest content cannot introduce trust-root material", () => {
  const input = validInput();
  const manifest = input.manifest as OwnerNetworkAuthorizationManifest;
  const injectedBody = {
    ...manifest.authorizationBody,
    trustedOwnerVerificationKey: trust,
  };
  assertBlocked(
    evaluate({ ...input, manifest: signedManifest(injectedBody as unknown as OwnerNetworkAuthorizationBody) }),
    LiveReadonlyPreflightIssueCode.UndeclaredField,
  );
});

test("unknown manifest field fails closed", () => {
  const input = validInput();
  assertBlocked(evaluate({ ...input, manifest: { ...(input.manifest as object), extension: true } }), LiveReadonlyPreflightIssueCode.UndeclaredField);
});

test("tampered hash and signature fail closed", () => {
  const input = validInput();
  const manifest = input.manifest as OwnerNetworkAuthorizationManifest;
  const tampered = { ...manifest, ownerApprovalEnvelope: { ...manifest.ownerApprovalEnvelope, manifestSha256: `sha256:${"b".repeat(64)}`, ownerSignature: base64(new Uint8Array(64)) } };
  const result = evaluate({ ...input, manifest: tampered });
  assertBlocked(result, LiveReadonlyPreflightIssueCode.ManifestHashMismatch);
  assert(result.issueCodes.includes(LiveReadonlyPreflightIssueCode.OwnerSignatureInvalid), "signature issue");
});

test("not-yet-valid, expired, and execute-date conflict fail closed", () => {
  for (const [change, issue] of [
    [{ validFrom: "2026-07-30T14:01:00.000Z", expiresAt: "2026-07-30T14:02:00.000Z" }, LiveReadonlyPreflightIssueCode.AuthorizationNotYetValid],
    [{ validFrom: "2026-07-30T13:00:00.000Z", expiresAt: "2026-07-30T13:01:00.000Z" }, LiveReadonlyPreflightIssueCode.AuthorizationExpired],
    [{ executeDate: "2026-07-29" }, LiveReadonlyPreflightIssueCode.ExecuteDateConflict],
  ] as const) {
    const input = validInput(); const manifest = input.manifest as OwnerNetworkAuthorizationManifest;
    assertBlocked(evaluate({ ...input, manifest: signedManifest({ ...manifest.authorizationBody, ...change }) }), issue);
  }
});

test("request mutation, expansion, repetition, and sixth request fail before network", () => {
  for (const mutate of [
    (plan: readonly LiveReadonlyRequestPlanEntry[]) => plan.map((entry, index) => index === 0 ? { ...entry, host: "evil.example" as "data.alpaca.markets" } : entry),
    (plan: readonly LiveReadonlyRequestPlanEntry[]) => plan.map((entry, index) => index === 1 ? { ...entry, start: "2026-07-29T13:35:00.000Z" } : entry),
    (plan: readonly LiveReadonlyRequestPlanEntry[]) => plan.map((entry, index) => index === 0 ? { ...entry, symbols: [...entry.symbols, "NVDA"].sort() } : entry),
    (plan: readonly LiveReadonlyRequestPlanEntry[]) => [plan[0]!, plan[0]!, ...plan.slice(2)],
    (plan: readonly LiveReadonlyRequestPlanEntry[]) => [...plan, plan[4]!],
  ]) {
    const input = validInput(); const manifest = input.manifest as OwnerNetworkAuthorizationManifest;
    const plan = mutate(manifest.authorizationBody.requests);
    const body = { ...manifest.authorizationBody, requests: plan, planFingerprint: liveReadonlyPlanFingerprint(plan, manifest.authorizationBody.calendarEvidenceFingerprint, manifest.authorizationBody.mappingRegistryVersion) };
    assertBlocked(evaluate({ ...input, manifest: signedManifest(body as OwnerNetworkAuthorizationBody) }), LiveReadonlyPreflightIssueCode.RequestPlanInvalid);
  }
});

test("calendar unknown fields, fingerprint mismatch, and invalid approval fail closed", () => {
  const input = validInput(); const calendar = input.calendarEvidence as ExchangeCalendarEvidence;
  assertBlocked(evaluate({ ...input, calendarEvidence: { ...calendar, extra: true } }), LiveReadonlyPreflightIssueCode.UndeclaredField);
  const badHash = { ...calendar, ownerApprovalEnvelope: { ...calendar.ownerApprovalEnvelope, calendarSha256: calendarFingerprintPlaceholder } };
  assertBlocked(evaluate({ ...input, calendarEvidence: badHash }), LiveReadonlyPreflightIssueCode.CalendarFingerprintMismatch);
  const badSignature = { ...calendar, ownerApprovalEnvelope: { ...calendar.ownerApprovalEnvelope, ownerSignature: base64(new Uint8Array(64)) } };
  assertBlocked(evaluate({ ...input, calendarEvidence: badSignature }), LiveReadonlyPreflightIssueCode.CalendarOwnerApprovalInvalid);
});

test("calendar matrix covers premarket, intraday, close buffer, post-close, and weekend", () => {
  for (const [asOf, phase, reference] of [
    ["2026-07-30T12:30:00.000Z", "PRE_MARKET", "2026-07-29"],
    ["2026-07-30T14:00:00.000Z", "REGULAR_SESSION", "2026-07-29"],
    ["2026-07-30T20:02:00.000Z", "POST_CLOSE_BUFFER", "2026-07-29"],
    ["2026-07-30T20:06:00.000Z", "POST_CLOSE", "2026-07-30"],
    ["2026-08-01T16:00:00.000Z", "NON_TRADING_DAY", "2026-07-31"],
  ] as const) {
    const result = evaluate(validInput(asOf));
    equal(result.status, "VERIFIED", `${phase} status`); equal(result.marketPhase, phase, `${phase} phase`); equal(result.referenceSessionDate, reference, `${phase} reference`);
  }
});

test("holiday and approved early close use explicit sessions", () => {
  const sessions: ExchangeCalendarBody["sessions"] = [
    { sessionDate: "2026-11-24", status: "TRADING_SESSION", marketOpen: "2026-11-24T14:30:00.000Z", marketClose: "2026-11-24T21:00:00.000Z", earlyClose: false },
    { sessionDate: "2026-11-25", status: "TRADING_SESSION", marketOpen: "2026-11-25T14:30:00.000Z", marketClose: "2026-11-25T21:00:00.000Z", earlyClose: false },
    { sessionDate: "2026-11-26", status: "MARKET_HOLIDAY", marketOpen: null, marketClose: null, earlyClose: false },
    { sessionDate: "2026-11-27", status: "TRADING_SESSION", marketOpen: "2026-11-27T14:30:00.000Z", marketClose: "2026-11-27T18:00:00.000Z", earlyClose: true },
  ];
  const holiday = evaluate(validInput("2026-11-26T17:00:00.000Z", sessions));
  equal([holiday.status, holiday.marketPhase, holiday.referenceSessionDate], ["VERIFIED", "NON_TRADING_DAY", "2026-11-25"], "holiday");
  const early = evaluate(validInput("2026-11-27T18:06:00.000Z", sessions));
  equal([early.status, early.marketPhase, early.referenceSessionDate], ["VERIFIED", "POST_CLOSE", "2026-11-27"], "early close");
});

test("DST boundaries require explicit offset-correct calendar timestamps", () => {
  const transition: ExchangeCalendarBody["sessions"] = [
    { sessionDate: "2026-03-05", status: "TRADING_SESSION", marketOpen: "2026-03-05T14:30:00.000Z", marketClose: "2026-03-05T21:00:00.000Z", earlyClose: false },
    { sessionDate: "2026-03-06", status: "TRADING_SESSION", marketOpen: "2026-03-06T14:30:00.000Z", marketClose: "2026-03-06T21:00:00.000Z", earlyClose: false },
    { sessionDate: "2026-03-09", status: "TRADING_SESSION", marketOpen: "2026-03-09T13:30:00.000Z", marketClose: "2026-03-09T20:00:00.000Z", earlyClose: false },
  ];
  const result = evaluate(validInput("2026-03-09T14:00:00.000Z", transition));
  equal([result.status, result.marketPhase, result.referenceSessionDate], ["VERIFIED", "REGULAR_SESSION", "2026-03-06"], "DST transition session");
  const malformed = [...transition]; malformed[2] = { ...malformed[2]!, marketOpen: "2026-03-09T14:30:00.000Z", marketClose: "2026-03-09T21:00:00.000Z" };
  assertBlocked(evaluate(validInput("2026-03-09T15:00:00.000Z", malformed)), LiveReadonlyPreflightIssueCode.InvalidCalendarEvidence);
});

test("missing, stale, conflicting, or unapproved calendar evidence blocks", () => {
  const input = validInput();
  assertBlocked(evaluate({ ...input, calendarEvidence: null }), LiveReadonlyPreflightIssueCode.InvalidCalendarEvidence);
  const calendar = input.calendarEvidence as ExchangeCalendarEvidence;
  const stale = signedCalendar({ ...calendar.calendarBody, validThrough: "2026-07-29T23:59:59.999Z" });
  assertBlocked(evaluate({ ...input, calendarEvidence: stale }), LiveReadonlyPreflightIssueCode.CalendarEvidenceExpired);
  const duplicate = signedCalendar({ ...calendar.calendarBody, sessions: [...calendar.calendarBody.sessions, calendar.calendarBody.sessions[0]!] });
  assertBlocked(evaluate({ ...input, calendarEvidence: duplicate }), LiveReadonlyPreflightIssueCode.CalendarDateConflict);
});

let passed = 0;
for (const [name, run] of tests) {
  try { run(); passed += 1; process.stdout.write(`PASS ${name}\n`); }
  catch (error) { process.stderr.write(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; }
}
process.stdout.write(`Personal Daily Scan live-readonly preflight: ${passed}/${tests.length} passed.\n`);
