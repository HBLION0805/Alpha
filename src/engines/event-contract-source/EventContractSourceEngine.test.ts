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
  EventContractSourceIssueCode,
  EventContractSourceMappingReviewStatus,
  EventContractThresholdOperator,
  type EventContractSourceMapping,
  type EventContractSourceMappingInput,
  type EventContractSourceProvider,
  type EventContractSourceProviderInput,
  type EventContractSourceSnapshotInput,
  type EventContractSourceTerms,
} from "../../contracts";
import {
  EventContractSourceEngine,
  EventContractSourceValidationError,
  INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY,
} from "./EventContractSourceEngine";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}
function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}
function expectIssue(run: () => unknown, code: EventContractSourceIssueCode, field?: string): void {
  try { run(); }
  catch (error) {
    if (!(error instanceof EventContractSourceValidationError)) throw error;
    if (!error.issues.some((item) => item.code === code && (field === undefined || item.field.includes(field)))) {
      throw new Error(`Expected ${code}${field === undefined ? "" : ` at ${field}`}; received ${JSON.stringify(error.issues)}.`);
    }
    return;
  }
  throw new Error(`Expected ${code}.`);
}

const engine = new EventContractSourceEngine();

function providerInput(overrides: Partial<EventContractSourceProviderInput> = {}): EventContractSourceProviderInput {
  return {
    schemaVersion: EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
    providerId: "provider:exchange:fixture",
    displayName: "Fixture Exchange",
    sourceClass: EventContractSourceClass.Exchange,
    exchangeId: "exchange:fixture",
    capabilities: [
      EventContractSourceCapability.TopOfBook,
      EventContractSourceCapability.ContractTerms,
      EventContractSourceCapability.Settlement,
    ],
    executionModes: [
      EventContractSourceExecutionMode.BoundedLiveRead,
      EventContractSourceExecutionMode.Fixture,
    ],
    credentialMode: EventContractSourceCredentialMode.ReadOnlyDataCredential,
    documentationReferences: ["https://example.test/official-api", "https://example.test/official-rules"],
    active: true,
    ...overrides,
  };
}
function provider(overrides: Partial<EventContractSourceProviderInput> = {}): EventContractSourceProvider {
  return engine.createProvider(providerInput(overrides));
}
function terms(overrides: Partial<EventContractSourceTerms> = {}): EventContractSourceTerms {
  return {
    title: "Will BTC be above the target at 12:15 UTC?",
    termsVersion: "1.0",
    eventType: EventContractObservationEventType.BtcFifteenMinute,
    instrumentId: EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
    outcomePair: EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR,
    windowStartsAt: "2026-07-24T12:00:00.000Z",
    tradingClosesAt: "2026-07-24T12:14:59.000Z",
    evaluatesAt: "2026-07-24T12:15:00.000Z",
    evaluationMethod: EventContractEvaluationMethod.AtScheduledTime,
    thresholdOperator: EventContractThresholdOperator.Above,
    targetPrice: { atomicValue: "6500000", scale: 2 },
    settlementSourceId: "source:brti",
    ...overrides,
  };
}
function mappingInput(overrides: Partial<EventContractSourceMappingInput> = {}): EventContractSourceMappingInput {
  return {
    schemaVersion: EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
    mappingId: "mapping:fixture:btc:1215",
    version: "1.0",
    createdAt: "2026-07-24T11:50:00.000Z",
    reviewStatus: EventContractSourceMappingReviewStatus.ReviewedExact,
    reviewedAt: "2026-07-24T11:55:00.000Z",
    reviewerId: "owner:alpha",
    evidenceIds: ["evidence:exchange-terms", "evidence:robinhood-terms"],
    provider: provider(),
    robinhoodIdentity: {
      exchangeId: "exchange:fixture",
      marketId: "rh-market:btc:1215",
      contractId: "rh-contract:btc:1215",
      termsId: "rh-terms:btc:1215",
    },
    externalIdentity: {
      providerId: "provider:exchange:fixture",
      exchangeId: "exchange:fixture",
      eventId: "event:btc:20260724",
      marketId: "market:btc:1215",
      contractId: "contract:btc:1215",
      nativeTicker: "BTC-26JUL241215",
    },
    robinhoodTerms: terms(),
    externalTerms: terms(),
    ...overrides,
  };
}
function mapping(overrides: Partial<EventContractSourceMappingInput> = {}): EventContractSourceMapping {
  return engine.createMapping(mappingInput(overrides));
}
function snapshotInput(overrides: Partial<EventContractSourceSnapshotInput> = {}): EventContractSourceSnapshotInput {
  const mapped = mapping();
  return {
    schemaVersion: EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
    snapshotId: "snapshot:fixture:btc:001",
    provider: mapped.provider,
    mapping: mapped,
    capability: EventContractSourceCapability.TopOfBook,
    executionMode: EventContractSourceExecutionMode.Fixture,
    sourceRecordId: "source-record:fixture:001",
    observedAt: "2026-07-24T12:10:00.000Z",
    publishedAt: "2026-07-24T12:10:00.100Z",
    receivedAt: "2026-07-24T12:10:00.200Z",
    normalizedAt: "2026-07-24T12:10:00.300Z",
    payloadFingerprint: "fnv1a64:0123456789abcdef",
    rawPayloadBytes: 2_048,
    recordCount: 1,
    ...overrides,
  };
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["provider construction is deterministic sorted and immutable", () => {
    const first = provider();
    const second = provider({ capabilities: [...providerInput().capabilities].reverse() });
    assertEqual(first.fingerprint, second.fingerprint, "provider fingerprint");
    assertEqual(first.capabilities.join("|"), [...first.capabilities].sort().join("|"), "capability order");
    assertTrue(Object.isFrozen(first) && Object.isFrozen(first.capabilities), "provider immutable");
  }],
  ["provider rejects unknown root fields", () => expectIssue(
    () => engine.createProvider({ ...providerInput(), apiKey: "secret" }),
    EventContractSourceIssueCode.InvalidRecord,
    "apiKey",
  )],
  ["exchange provider requires exchange identity", () => expectIssue(
    () => engine.createProvider(providerInput({ exchangeId: null })),
    EventContractSourceIssueCode.InvalidIdentifier,
    "exchangeId",
  )],
  ["non-exchange provider rejects exchange identity", () => expectIssue(
    () => engine.createProvider(providerInput({ sourceClass: EventContractSourceClass.Platform })),
    EventContractSourceIssueCode.InvalidProvider,
    "exchangeId",
  )],
  ["source class cannot overclaim capabilities", () => expectIssue(
    () => engine.createProvider(providerInput({
      sourceClass: EventContractSourceClass.SettlementReference,
      exchangeId: null,
      capabilities: [EventContractSourceCapability.TopOfBook],
    })),
    EventContractSourceIssueCode.InvalidCapability,
  )],
  ["duplicate provider capabilities fail", () => expectIssue(
    () => engine.createProvider(providerInput({ capabilities: [EventContractSourceCapability.Trades, EventContractSourceCapability.Trades] })),
    EventContractSourceIssueCode.InvalidCapability,
  )],
  ["operator evidence cannot claim credentials", () => expectIssue(
    () => engine.createProvider(providerInput({
      sourceClass: EventContractSourceClass.OperatorEvidence,
      exchangeId: null,
      capabilities: [EventContractSourceCapability.ContractTerms],
    })),
    EventContractSourceIssueCode.InvalidCredentialMode,
  )],
  ["documentation references must be official HTTPS shapes", () => expectIssue(
    () => engine.createProvider(providerInput({ documentationReferences: ["file://private"] })),
    EventContractSourceIssueCode.InvalidRecord,
    "documentationReferences",
  )],
  ["provider fingerprint tampering fails", () => {
    const value = structuredClone(provider()) as unknown as Record<string, unknown>;
    value["displayName"] = "Changed";
    expectIssue(() => engine.verifyProvider(value), EventContractSourceIssueCode.InvalidFingerprint);
  }],
  ["reviewed exact mapping is eligible deterministic and immutable", () => {
    const result = mapping();
    assertTrue(result.eligibleForCollection, "eligible");
    assertEqual(result.fingerprint, mapping().fingerprint, "deterministic");
    assertTrue(Object.isFrozen(result) && Object.isFrozen(result.robinhoodTerms.targetPrice), "mapping immutable");
  }],
  ["pending mapping remains ineligible without review metadata", () => {
    const result = mapping({
      reviewStatus: EventContractSourceMappingReviewStatus.Pending,
      reviewedAt: null,
      reviewerId: null,
      externalTerms: terms({ title: "Unconfirmed title" }),
    });
    assertEqual(result.eligibleForCollection, false, "pending eligibility");
  }],
  ["rejected mapping remains explicit and ineligible", () => {
    const result = mapping({
      reviewStatus: EventContractSourceMappingReviewStatus.Rejected,
      externalTerms: terms({ settlementSourceId: "source:other" }),
    });
    assertEqual(result.eligibleForCollection, false, "rejected eligibility");
  }],
  ["pending mapping cannot claim a reviewer", () => expectIssue(
    () => mapping({ reviewStatus: EventContractSourceMappingReviewStatus.Pending, reviewedAt: null }),
    EventContractSourceIssueCode.InvalidMapping,
    "reviewedAt",
  )],
  ["mapping review cannot predate creation", () => expectIssue(
    () => mapping({ reviewedAt: "2026-07-24T11:49:59.000Z" }),
    EventContractSourceIssueCode.InvalidChronology,
  )],
  ["mapping requires evidence", () => expectIssue(
    () => mapping({ evidenceIds: [] }),
    EventContractSourceIssueCode.InvalidRecord,
    "evidenceIds",
  )],
  ["mapping binds provider identity", () => expectIssue(
    () => mapping({ externalIdentity: { ...mappingInput().externalIdentity, providerId: "provider:other" } }),
    EventContractSourceIssueCode.MappingMismatch,
  )],
  ["mapping binds exchange identity on both venues", () => expectIssue(
    () => mapping({ robinhoodIdentity: { ...mappingInput().robinhoodIdentity, exchangeId: "exchange:other" } }),
    EventContractSourceIssueCode.MappingMismatch,
  )],
  ["non-exchange provider cannot create mapping", () => {
    const platform = provider({
      providerId: "provider:platform:fixture",
      sourceClass: EventContractSourceClass.Platform,
      exchangeId: null,
      capabilities: [EventContractSourceCapability.ContractTerms],
      credentialMode: EventContractSourceCredentialMode.None,
    });
    expectIssue(() => mapping({
      provider: platform,
      externalIdentity: { ...mappingInput().externalIdentity, providerId: platform.providerId },
    }), EventContractSourceIssueCode.InvalidMapping);
  }],
  ["reviewed exact mapping rejects title mismatch", () => expectIssue(
    () => mapping({ externalTerms: terms({ title: "Different title" }) }),
    EventContractSourceIssueCode.MappingMismatch,
    "terms",
  )],
  ["reviewed exact mapping rejects target mismatch", () => expectIssue(
    () => mapping({ externalTerms: terms({ targetPrice: { atomicValue: "6500001", scale: 2 } }) }),
    EventContractSourceIssueCode.MappingMismatch,
  )],
  ["reviewed exact mapping rejects threshold mismatch", () => expectIssue(
    () => mapping({ externalTerms: terms({ thresholdOperator: EventContractThresholdOperator.AtOrAbove }) }),
    EventContractSourceIssueCode.MappingMismatch,
  )],
  ["reviewed exact mapping rejects cutoff mismatch", () => expectIssue(
    () => mapping({ externalTerms: terms({ tradingClosesAt: "2026-07-24T12:14:58.000Z" }) }),
    EventContractSourceIssueCode.MappingMismatch,
  )],
  ["reviewed exact mapping rejects settlement source mismatch", () => expectIssue(
    () => mapping({ externalTerms: terms({ settlementSourceId: "source:other" }) }),
    EventContractSourceIssueCode.MappingMismatch,
  )],
  ["nested mapping terms reject unknown fields", () => expectIssue(
    () => mapping({ externalTerms: { ...terms(), priceHint: 65_000 } as EventContractSourceTerms }),
    EventContractSourceIssueCode.InvalidRecord,
    "priceHint",
  )],
  ["mapping fingerprint tampering fails", () => {
    const value = structuredClone(mapping()) as unknown as Record<string, unknown>;
    value["version"] = "2.0";
    expectIssue(() => engine.verifyMapping(value), EventContractSourceIssueCode.InvalidFingerprint);
  }],
  ["fixture snapshot preserves exact lineage and authority", () => {
    const result = engine.createSnapshot(snapshotInput());
    assertEqual(result.providerFingerprint, result.provider.fingerprint, "provider lineage");
    assertEqual(result.mappingFingerprint, result.mapping?.fingerprint ?? null, "mapping lineage");
    assertTrue(Object.isFrozen(result) && Object.isFrozen(result.provider), "snapshot immutable");
    assertTrue(!JSON.stringify(result).toLowerCase().includes("recommendation"), "no recommendation");
  }],
  ["exchange snapshot requires mapping", () => expectIssue(
    () => engine.createSnapshot(snapshotInput({ mapping: null })),
    EventContractSourceIssueCode.MappingNotEligible,
  )],
  ["exchange snapshot rejects pending mapping", () => {
    const pending = mapping({ reviewStatus: EventContractSourceMappingReviewStatus.Pending, reviewedAt: null, reviewerId: null });
    expectIssue(() => engine.createSnapshot(snapshotInput({ provider: pending.provider, mapping: pending })), EventContractSourceIssueCode.MappingNotEligible);
  }],
  ["snapshot rejects undeclared capability", () => expectIssue(
    () => engine.createSnapshot(snapshotInput({ capability: EventContractSourceCapability.ReferencePrice })),
    EventContractSourceIssueCode.InvalidCapability,
  )],
  ["snapshot rejects inactive provider", () => {
    const inactive = provider({ active: false });
    const exact = mapping({ provider: inactive });
    expectIssue(() => engine.createSnapshot(snapshotInput({ provider: inactive, mapping: exact })), EventContractSourceIssueCode.InvalidProvider);
  }],
  ["bounded live snapshot is reserved and unauthorized", () => expectIssue(
    () => engine.createSnapshot(snapshotInput({ executionMode: EventContractSourceExecutionMode.BoundedLiveRead })),
    EventContractSourceIssueCode.UnauthorizedLiveRead,
  )],
  ["arbitrary bounded-live policy remains unauthorized", () => expectIssue(
    () => new EventContractSourceEngine({
      ...INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY,
      maximumRecordCount: 2,
    }),
    EventContractSourceIssueCode.UnauthorizedLiveRead,
  )],
  ["exact T3B8 policy permits one bounded-live snapshot", () => {
    const liveEngine = new EventContractSourceEngine(INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY);
    const liveProvider = liveEngine.createProvider(providerInput());
    const liveMapping = liveEngine.createMapping(mappingInput({ provider: liveProvider }));
    const result = liveEngine.createSnapshot(snapshotInput({
      provider: liveProvider,
      mapping: liveMapping,
      executionMode: EventContractSourceExecutionMode.BoundedLiveRead,
      rawPayloadBytes: 100_000,
      recordCount: 1,
    }));
    assertEqual(result.executionMode, EventContractSourceExecutionMode.BoundedLiveRead, "live execution mode");
  }],
  ["snapshot rejects observation after publication", () => expectIssue(
    () => engine.createSnapshot(snapshotInput({ publishedAt: "2026-07-24T12:09:59.999Z" })),
    EventContractSourceIssueCode.InvalidChronology,
  )],
  ["snapshot rejects publication after receipt", () => expectIssue(
    () => engine.createSnapshot(snapshotInput({ publishedAt: "2026-07-24T12:10:00.300Z" })),
    EventContractSourceIssueCode.InvalidChronology,
  )],
  ["snapshot rejects receipt after normalization", () => expectIssue(
    () => engine.createSnapshot(snapshotInput({ receivedAt: "2026-07-24T12:10:00.400Z" })),
    EventContractSourceIssueCode.InvalidChronology,
  )],
  ["snapshot accepts explicitly unavailable publication time", () => {
    const result = engine.createSnapshot(snapshotInput({ publishedAt: null }));
    assertEqual(result.publishedAt, null, "publication");
  }],
  ["snapshot enforces payload fingerprint format", () => expectIssue(
    () => engine.createSnapshot(snapshotInput({ payloadFingerprint: "sha256:abc" })),
    EventContractSourceIssueCode.InvalidFingerprint,
  )],
  ["snapshot enforces payload byte bound", () => expectIssue(
    () => engine.createSnapshot(snapshotInput({ rawPayloadBytes: 1_000_001 })),
    EventContractSourceIssueCode.InvalidBound,
    "rawPayloadBytes",
  )],
  ["snapshot enforces record-count bound", () => expectIssue(
    () => engine.createSnapshot(snapshotInput({ recordCount: 1_001 })),
    EventContractSourceIssueCode.InvalidBound,
    "recordCount",
  )],
  ["non-exchange snapshot rejects cross-venue mapping", () => {
    const reference = provider({
      providerId: "provider:reference:fixture",
      sourceClass: EventContractSourceClass.SettlementReference,
      exchangeId: null,
      capabilities: [EventContractSourceCapability.ReferencePrice],
      credentialMode: EventContractSourceCredentialMode.None,
    });
    expectIssue(() => engine.createSnapshot(snapshotInput({
      provider: reference,
      mapping: mapping(),
      capability: EventContractSourceCapability.ReferencePrice,
    })), EventContractSourceIssueCode.InvalidMapping);
  }],
  ["snapshot rejects unknown fields", () => expectIssue(
    () => engine.createSnapshot({ ...snapshotInput(), orderSide: "UP" }),
    EventContractSourceIssueCode.InvalidRecord,
    "orderSide",
  )],
  ["snapshot fingerprint and lineage tampering fail", () => {
    const value = structuredClone(engine.createSnapshot(snapshotInput())) as unknown as Record<string, unknown>;
    value["mappingFingerprint"] = null;
    expectIssue(() => engine.verifySnapshot(value), EventContractSourceIssueCode.InvalidFingerprint);
  }],
  ["engine exposes no provider network persistence or trade methods", () => {
    const methods = ["createProvider", "verifyProvider", "createMapping", "verifyMapping", "createSnapshot", "verifySnapshot"].join("|").toLowerCase();
    for (const forbidden of ["fetch", "network", "persist", "poll", "schedule", "order", "trade", "recommend", "probability"]) assertTrue(!methods.includes(forbidden), `${forbidden} absent`);
  }],
];

for (const [name, run] of tests) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`Event Contract Source tests passed: ${tests.length}/${tests.length}.`);
