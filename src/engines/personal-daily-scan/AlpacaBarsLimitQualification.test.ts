import { generateKeyPairSync, sign } from "node:crypto";
import process from "node:process";

import type {
  AlpacaBarsLimitQualificationAuthorizationBody,
  AlpacaBarsLimitQualificationInput,
  AlpacaBarsLimitQualificationRawResponse,
} from "../../contracts/AlpacaBarsLimitQualification";
import type {
  ExchangeCalendarBody,
  ExchangeCalendarEvidence,
  OwnerNetworkAuthorizationManifest,
  TrustedOwnerVerificationKey,
} from "../../contracts/PersonalDailyScanLiveReadonly";
import {
  createAlpacaBarsLimitQualificationManifestDraft,
  AlpacaBarsLimitQualificationTransportError,
  type AlpacaBarsLimitQualificationRawTransport,
} from "./AlpacaBarsLimitQualification";
import { createAlpacaBarsLimitQualificationProductOperation } from "./AlpacaBarsLimitQualificationProductComposition";
import * as productBarrel from "./index";
import * as alpacaIntegrationBarrel from "../../integration/market-data/alpaca/index";
import { createAlpacaBarsLimitQualificationTestOperation } from "./testing/AlpacaBarsLimitQualificationTestFactory";
import { AlpacaBarsLimitQualificationHttpsTransport } from "../../integration/market-data/alpaca/AlpacaBarsLimitQualificationHttpsTransport";
import {
  createAlpacaBarsLimitQualificationAuthorizationVerifier,
  exchangeCalendarSignatureMessage,
  ownerAuthorizationSignatureMessage,
  sha256Jcs,
  trustedPublicKeyFingerprint,
} from "./PersonalDailyScanLiveReadonlyPreflight";

type Test = readonly [string, () => void | Promise<void>];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function equal(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}
function base64(value: Uint8Array): string { return btoa(String.fromCharCode(...value)); }

const keys = generateKeyPairSync("ed25519");
const publicKeyPem = keys.publicKey.export({ format: "pem", type: "spki" });
const trust: TrustedOwnerVerificationKey = {
  source: "PINNED_PRODUCT_CONFIGURATION",
  ownerKeyId: "owner-key:d3a-test",
  publicKeyPem,
  publicKeyFingerprint: trustedPublicKeyFingerprint(publicKeyPem),
};
const verifier = createAlpacaBarsLimitQualificationAuthorizationVerifier({ getPinnedOwnerVerificationKey: () => trust });
let authorizationSequence = 0;

const calendarBody: ExchangeCalendarBody = {
  schemaVersion: "1.0",
  evidenceId: "calendar-evidence:d3a-test",
  calendarId: "US_EQUITIES_PRIMARY_SESSION",
  calendarVersion: "exchange-calendar:2026.07",
  producerId: "calendar-producer:test",
  producerVersion: "producer:v1",
  authoritySource: "owner-approved-exchange-calendar",
  ownerDecisionReference: "owner-decision:d3a",
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
const calendarHash = sha256Jcs(calendarBody);
const calendar: ExchangeCalendarEvidence = {
  calendarBody,
  ownerApprovalEnvelope: {
    calendarSha256: calendarHash,
    signatureAlgorithm: "Ed25519",
    ownerKeyId: trust.ownerKeyId,
    ownerPublicKeyFingerprint: trust.publicKeyFingerprint,
    ownerSignature: base64(sign(null, exchangeCalendarSignatureMessage(calendarHash), keys.privateKey)),
  },
};

function signedInput(overrides: Partial<AlpacaBarsLimitQualificationAuthorizationBody> = {}): AlpacaBarsLimitQualificationInput {
  authorizationSequence += 1;
  const draft = createAlpacaBarsLimitQualificationManifestDraft({
    authorizationId: `authorization:d3a-test:${authorizationSequence}`,
    ownerDecisionReference: "owner-decision:d3a",
    executeDate: "2026-07-30",
    validFrom: "2026-07-30T13:59:00.000Z",
    expiresAt: "2026-07-30T14:01:00.000Z",
    calendarEvidence: calendar,
    referenceSessionDate: "2026-07-29",
  });
  const body = { ...draft.authorizationBody, ...overrides } as AlpacaBarsLimitQualificationAuthorizationBody;
  const manifestHash = sha256Jcs(body);
  const manifest: OwnerNetworkAuthorizationManifest = {
    authorizationBody: body as never,
    ownerApprovalEnvelope: {
      manifestSha256: manifestHash,
      signatureAlgorithm: "Ed25519",
      ownerKeyId: trust.ownerKeyId,
      ownerPublicKeyFingerprint: trust.publicKeyFingerprint,
      ownerSignature: base64(sign(null, ownerAuthorizationSignatureMessage(manifestHash), keys.privateKey)),
    },
  };
  return { asOf: "2026-07-30T14:00:00.000Z", manifest, calendarEvidence: calendar };
}

function bar(t: string): Readonly<Record<string, unknown>> {
  return { t, o: 100, h: 103, l: 99, c: 102, v: 1000, n: 100, vw: 101 };
}

function body(overrides: Readonly<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    bars: {
      MU: [bar("2026-07-28T13:30:00Z"), bar("2026-07-29T13:30:00Z")],
      QQQ: [bar("2026-07-28T13:30:00Z"), bar("2026-07-29T13:30:00Z")],
    },
    next_page_token: null,
    ...overrides,
  });
}

function response(value = body()): AlpacaBarsLimitQualificationRawResponse {
  return {
    statusCode: 200,
    headers: [{ name: "content-type", value: "application/json" }],
    rawBytes: new TextEncoder().encode(value),
    startedAt: "2026-07-30T14:00:00.100Z",
    endedAt: "2026-07-30T14:00:00.200Z",
  };
}

function operation(rawTransport: Omit<AlpacaBarsLimitQualificationRawTransport, "prepareCredentialsAfterAuthorization"> & Partial<Pick<AlpacaBarsLimitQualificationRawTransport, "prepareCredentialsAfterAuthorization">> = { dispatchOnce: async () => response() }) {
  return createAlpacaBarsLimitQualificationTestOperation({ authorizationVerifier: verifier, rawTransport: {
    prepareCredentialsAfterAuthorization: rawTransport.prepareCredentialsAfterAuthorization ?? (() => undefined),
    dispatchOnce: rawTransport.dispatchOnce,
  } });
}

async function assertBlocked(
  resultPromise: ReturnType<ReturnType<typeof operation>["run"]>,
  issue: string,
): Promise<void> {
  const result = await resultPromise;
  equal(result.status, "BLOCKED", "status");
  assert(result.issueCodes.includes(issue as never), `missing ${issue}`);
  equal(result.candidates, [], "candidates");
  equal([result.attemptedNetworkRequests, result.completedNetworkRequests, result.networkRequests, result.persistenceWrites, result.automatedExecutionAllowed], [0, 0, 0, 0, false], "side effects");
  equal(result.issueCodes, [...result.issueCodes].sort(), "issue order");
}

test("unsigned draft binds the exact one-request qualification scope", () => {
  const draft = createAlpacaBarsLimitQualificationManifestDraft({
    authorizationId: "authorization:d3a-draft", ownerDecisionReference: "owner-decision:d3a",
    executeDate: "2026-07-30", validFrom: "2026-07-30T13:59:00.000Z", expiresAt: "2026-07-30T14:01:00.000Z",
    calendarEvidence: calendar, referenceSessionDate: "2026-07-29",
  });
  equal(draft.approvalStatus, "UNSIGNED_OWNER_APPROVAL_REQUIRED", "approval");
  equal(draft.authorizationBody.maximumNetworkRequests, 1, "request budget");
  equal(draft.authorizationBody.requests.length, 1, "request count");
  const request = draft.authorizationBody.requests[0];
  equal([request.host, request.path, request.symbols, request.interval, request.limit], ["data.alpaca.markets", "/v2/stocks/bars", ["MU", "QQQ"], "P1D", 2], "exact request");
});

test("test-only response can validate structure but cannot prove Provider semantics", async () => {
  const result = await operation().run(signedInput());
  equal(result.status, "QUALIFICATION_OBSERVED", "status");
  equal(result.actualObservedBarsBySymbol, { MU: 2, QQQ: 2 }, "counts");
  equal(result.responseOrigin, "TEST_INJECTED", "origin");
  equal(result.providerLimitSemantics, "UNPROVEN", "fixture is not proof");
  equal([result.attemptedNetworkRequests, result.completedNetworkRequests, result.networkRequests, result.persistenceWrites, result.automatedExecutionAllowed], [0, 0, 0, 0, false], "side effects");
});

test("product entry accepts no dependency injection and missing Manifest blocks before network", async () => {
  equal(createAlpacaBarsLimitQualificationProductOperation.length, 0, "product root arity");
  const result = await createAlpacaBarsLimitQualificationProductOperation().run({ asOf: "2026-07-30T14:00:00.000Z" });
  equal(result.issueCodes, ["OWNER_NETWORK_AUTHORIZATION_REQUIRED"], "authorization issue");
  equal([result.attemptedNetworkRequests, result.completedNetworkRequests, result.persistenceWrites], [0, 0, 0], "zero side effects");
});

test("product entry ignores caller Transport and authority arguments", async () => {
  let calls = 0;
  const forgedFactory = createAlpacaBarsLimitQualificationProductOperation as unknown as (input: unknown) => ReturnType<typeof createAlpacaBarsLimitQualificationProductOperation>;
  const product = forgedFactory({
    rawTransport: { dispatchOnce: async () => { calls += 1; return response(); } },
    responseOrigin: "REAL_HTTPS",
    providerAuthority: "OBSERVED_ONCE_PROVEN",
    networkRequests: 1,
  });
  const result = await product.run({ asOf: "2026-07-30T14:00:00.000Z" });
  equal(result.issueCodes, ["OWNER_NETWORK_AUTHORIZATION_REQUIRED"], "product remains fixed");
  equal([calls, result.responseOrigin, result.networkRequests], [0, "NONE", 0], "caller dependencies ignored");
});

test("test factory is absent from product barrels and cannot accept the product Transport capability", () => {
  assert(!Object.hasOwn(productBarrel, "createAlpacaBarsLimitQualificationTestOperation"), "test factory must not be product-exported");
  assert(!Object.hasOwn(productBarrel, "createAlpacaBarsLimitQualificationTestOperationInternal"), "internal test factory must not be product-exported");
  assert(!Object.hasOwn(alpacaIntegrationBarrel, "AlpacaBarsLimitQualificationHttpsTransport"), "injectable D3A Transport must not be integration-exported");
  let rejected = false;
  try {
    createAlpacaBarsLimitQualificationTestOperation({
      authorizationVerifier: verifier,
      rawTransport: new AlpacaBarsLimitQualificationHttpsTransport(),
    });
  } catch {
    rejected = true;
  }
  assert(rejected, "product Transport must be rejected by test composition");
});

test("missing product trust root blocks before credentials and network", async () => {
  const product = createAlpacaBarsLimitQualificationProductOperation();
  const result = await product.run(signedInput());
  equal(result.issueCodes, ["OWNER_AUTHORIZATION_VERIFICATION_KEY_UNAVAILABLE"], "trust issue");
  equal([result.credentialReadPermitted, result.attemptedNetworkRequests, result.completedNetworkRequests], [false, 0, 0], "pre-network block");
});

test("caller authority and Transport injection fields are rejected", async () => {
  for (const field of ["verifier", "providerAuthority", "transport", "publicKey", "fingerprint"]) {
    await assertBlocked(operation().run({ ...signedInput(), [field]: {} } as never), "OWNER_AUTHORIZATION_INVALID");
  }
});

test("query, symbol order, limit, and window mutations block before Transport", async () => {
  const base = signedInput().manifest as Readonly<{ authorizationBody: AlpacaBarsLimitQualificationAuthorizationBody }>;
  const original = base.authorizationBody.requests[0];
  const mutations = [
    { ...original, symbols: ["QQQ", "MU"] },
    { ...original, limit: 3 },
    { ...original, start: "2026-07-28T14:30:00.000Z" },
    { ...original, path: "/v2/stocks/quotes/latest" },
  ];
  for (const request of mutations) {
    await assertBlocked(operation().run(signedInput({ requests: [request] as never })), "OWNER_AUTHORIZATION_INVALID");
  }
});

test("second request, duplicate request, and reordered ordinals block before Transport", async () => {
  const base = signedInput().manifest as Readonly<{ authorizationBody: AlpacaBarsLimitQualificationAuthorizationBody }>;
  const request = base.authorizationBody.requests[0];
  for (const requests of [[request, request], [{ ...request, ordinal: 2 }]]) {
    await assertBlocked(operation().run(signedInput({ maximumNetworkRequests: requests.length as never, requests: requests as never })), "OWNER_AUTHORIZATION_INVALID");
  }
});

test("pagination token blocks after one attempt without a second request", async () => {
  let calls = 0;
  const result = await operation({ dispatchOnce: async () => { calls += 1; return response(body({ next_page_token: "SECRET-NEXT-PAGE" })); } }).run(signedInput());
  equal(result.status, "BLOCKED", "pagination status");
  assert(result.issueCodes.includes("PAGINATION_FORBIDDEN" as never), "pagination issue");
  equal(result.actualObservedBarsBySymbol, { MU: 2, QQQ: 2 }, "pagination counts retained");
  equal(result.paginationTokenPresent, true, "pagination presence retained");
  assert(!JSON.stringify(result).includes("SECRET-NEXT-PAGE"), "pagination token is redacted");
  equal([result.attemptedNetworkRequests, result.completedNetworkRequests, result.networkRequests], [0, 0, 0], "test lifecycle remains zero");
  equal(calls, 1, "one dispatch only");
});

test("partial symbol coverage preserves sanitized counts and sorted response symbols", async () => {
  const value = JSON.stringify({
    bars: {
      QQQ: [],
      MU: [bar("2026-07-28T13:30:00Z"), bar("2026-07-29T13:30:00Z")],
    },
    next_page_token: null,
  });
  const result = await operation({ dispatchOnce: async () => response(value) }).run(signedInput());
  equal(result.status, "BLOCKED", "status");
  equal(result.issueCodes, ["BAR_COUNT_MISMATCH"], "stable issue");
  equal(result.actualObservedBarsBySymbol, { MU: 2, QQQ: 0 }, "actual counts retained");
  equal(result.responseSymbols, ["MU", "QQQ"], "response symbols normalized");
  equal([result.candidates, result.persistenceWrites, result.automatedExecutionAllowed], [[], 0, false], "no partial product output");
});

test("response source declarations cannot override test provenance", async () => {
  const forged = { ...response(), responseOrigin: "REAL_HTTPS", providerLimitSemantics: "OBSERVED_ONCE_PROVEN" } as never;
  const result = await operation({ dispatchOnce: async () => forged }).run(signedInput());
  equal(result.status, "BLOCKED", "status");
  assert(result.issueCodes.includes("TRANSPORT_FAILURE" as never), "source conflict rejected");
  equal([result.responseOrigin, result.providerLimitSemantics, result.networkRequests], ["TEST_INJECTED", "UNPROVEN", 0], "provenance cannot be forged");
});

test("issue order and runId are deterministic across input property order", async () => {
  const first = await createAlpacaBarsLimitQualificationProductOperation().run({
    asOf: "2026-07-30T14:00:00.000Z",
    manifest: undefined,
  });
  const second = await createAlpacaBarsLimitQualificationProductOperation().run({
    manifest: undefined,
    asOf: "2026-07-30T14:00:00.000Z",
  });
  equal(first.issueCodes, second.issueCodes, "issue order");
  equal(first.runId, second.runId, "run identity");
});

test("the same signed authorization cannot dispatch a second request or retry", async () => {
  let calls = 0;
  const op = operation({ dispatchOnce: async () => { calls += 1; return response(); } });
  const input = signedInput();
  equal((await op.run(input)).status, "QUALIFICATION_OBSERVED", "first run");
  const replay = await op.run(input);
  equal(replay.issueCodes, ["AUTHORIZATION_REPLAY_FORBIDDEN"], "replay issue");
  equal([replay.attemptedNetworkRequests, replay.completedNetworkRequests], [0, 0], "replay counters");
  equal(calls, 1, "single dispatch");
});

test("credential absence blocks after authorization but before dispatcher attempt", async () => {
  let calls = 0;
  const op = operation({
    prepareCredentialsAfterAuthorization: () => { throw new Error("missing"); },
    dispatchOnce: async () => { calls += 1; return response(); },
  });
  const result = await op.run(signedInput());
  equal(result.issueCodes, ["ALPACA_CREDENTIAL_UNAVAILABLE"], "credential issue");
  equal([result.attemptedNetworkRequests, result.completedNetworkRequests, calls], [0, 0, 0], "pre-dispatch counters");
});

test("missing symbol, one Bar, and more than two Bars block", async () => {
  const cases = [
    JSON.stringify({ bars: { MU: [bar("2026-07-28T13:30:00Z"), bar("2026-07-29T13:30:00Z")] }, next_page_token: null }),
    body({ bars: { MU: [bar("2026-07-28T13:30:00Z")], QQQ: [bar("2026-07-28T13:30:00Z"), bar("2026-07-29T13:30:00Z")] } }),
    body({ bars: { MU: [bar("2026-07-27T13:30:00Z"), bar("2026-07-28T13:30:00Z"), bar("2026-07-29T13:30:00Z")], QQQ: [bar("2026-07-28T13:30:00Z"), bar("2026-07-29T13:30:00Z")] } }),
  ];
  for (const value of cases) {
    const result = await operation({ dispatchOnce: async () => response(value) }).run(signedInput());
    equal(result.status, "BLOCKED", "response block"); equal(result.attemptedNetworkRequests, 0, "attempted"); equal(result.completedNetworkRequests, 0, "completed");
  }
});

test("extra symbol and malformed or out-of-window Bars block", async () => {
  const extra = body({ bars: { MU: [bar("2026-07-28T13:30:00Z"), bar("2026-07-29T13:30:00Z")], QQQ: [bar("2026-07-28T13:30:00Z"), bar("2026-07-29T13:30:00Z")], TSLA: [bar("2026-07-28T13:30:00Z"), bar("2026-07-29T13:30:00Z")] } });
  await assertBlocked(operation({ dispatchOnce: async () => response(extra) }).run(signedInput()), "RESPONSE_SCOPE_MISMATCH");
  const outside = body({ bars: { MU: [bar("2026-07-27T13:30:00Z"), bar("2026-07-29T13:30:00Z")], QQQ: [bar("2026-07-28T13:30:00Z"), bar("2026-07-29T13:30:00Z")] } });
  await assertBlocked(operation({ dispatchOnce: async () => response(outside) }).run(signedInput()), "INVALID_BAR");
});

test("HTTP error, timeout, malformed JSON, and oversized response keep test lifecycle at zero", async () => {
  await assertBlocked(operation({ dispatchOnce: async () => ({ ...response(), statusCode: 500 }) }).run(signedInput()), "HTTP_ERROR");
  await assertBlocked(operation({ dispatchOnce: async () => { throw new AlpacaBarsLimitQualificationTransportError("TIMEOUT"); } }).run(signedInput()), "TRANSPORT_TIMEOUT");
  await assertBlocked(operation({ dispatchOnce: async () => response("{") }).run(signedInput()), "INVALID_JSON");
  await assertBlocked(operation({ dispatchOnce: async () => ({ ...response(), rawBytes: new Uint8Array(1_048_577) }) }).run(signedInput()), "RESPONSE_TOO_LARGE");
});

test("unknown response headers and partial output are rejected", async () => {
  const result = await operation({ dispatchOnce: async () => ({ ...response(), headers: [{ name: "authorization" as never, value: "secret" }] }) }).run(signedInput());
  equal(result.status, "BLOCKED", "status"); equal(result.candidates, [], "no partial candidates"); equal(result.persistenceWrites, 0, "no writes"); equal(result.automatedExecutionAllowed, false, "no execution");
});

test("product-owned HTTPS boundary emits the exact allow-listed target and bounded raw response", async () => {
  let targetSeen = "";
  let credentialReads = 0;
  const payload = new TextEncoder().encode(body());
  const transport = new AlpacaBarsLimitQualificationHttpsTransport({
    credentialLoader: () => {
      credentialReads += 1;
      return {
        revealForTransport: () => ({ keyId: "test-key-id", secretKey: "test-secret-key" }),
        toRedactedDiagnostic: () => ({ environmentVariables: ["ALPHA_ALPACA_API_KEY_ID", "ALPHA_ALPACA_API_SECRET_KEY"], configured: true, values: ["[REDACTED]", "[REDACTED]"] }),
        toJSON: () => ({ environmentVariables: ["ALPHA_ALPACA_API_KEY_ID", "ALPHA_ALPACA_API_SECRET_KEY"], configured: true, values: ["[REDACTED]", "[REDACTED]"] }),
        toString: () => "[REDACTED]",
      };
    },
    clock: { now: (() => { let count = 0; return () => count++ === 0 ? "2026-07-30T14:00:00.100Z" : "2026-07-30T14:00:00.200Z"; })() },
    fetchFunction: async (target, init) => {
      targetSeen = target;
      equal(init.method, "GET", "method");
      equal(init.redirect, "error", "redirect");
      equal(init.headers.accept, "application/json", "accept");
      let delivered = false;
      return {
        status: 200,
        headers: { get: (name: string) => name === "content-type" ? "application/json" : null },
        body: { getReader: () => ({
          read: async () => delivered ? { done: true } : (delivered = true, { done: false, value: payload }),
          cancel: async () => undefined,
        }) },
      };
    },
  });
  const result = await createAlpacaBarsLimitQualificationTestOperation({ authorizationVerifier: verifier, rawTransport: transport }).run(signedInput());
  equal(result.status, "QUALIFICATION_OBSERVED", "status");
  equal(credentialReads, 1, "credential read after preflight");
  equal([result.responseOrigin, result.providerLimitSemantics, result.attemptedNetworkRequests, result.completedNetworkRequests, result.networkRequests], ["TEST_INJECTED", "UNPROVEN", 0, 0, 0], "injected HTTPS cannot mint real evidence");
  equal(targetSeen, "https://data.alpaca.markets/v2/stocks/bars?symbols=MU%2CQQQ&timeframe=1Day&start=2026-07-28T13%3A30%3A00.000Z&end=2026-07-29T20%3A00%3A00.000Z&limit=2&adjustment=raw&feed=iex&currency=USD&sort=asc", "exact target");
});

async function main(): Promise<void> {
  let failures = 0;
  for (const [name, run] of tests) {
    try { await run(); process.stdout.write(`PASS ${name}\n`); }
    catch (error) { failures += 1; process.stderr.write(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}\n`); }
  }
  process.stdout.write(`Alpaca Bars limit qualification: ${tests.length - failures}/${tests.length} tests passed.\n`);
  if (failures > 0) process.exitCode = 1;
}

void main();
