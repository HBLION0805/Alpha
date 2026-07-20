import {
  EvidenceEntityResolutionStatus,
  EvidenceEntityType,
  EvidenceLinkErrorCode,
  EvidenceLinkResolutionStatus,
  EvidenceRelationType,
  type AlphaJournalEntry,
  type HistoricalAnalogyRecord,
  type HistoricalPattern,
  type Prediction,
  type PredictionOutcome,
  type ReplaySession,
  type StrategyVersion,
} from "../../contracts";
import type { CrossSystemEvidenceReadSources } from "./CrossSystemEvidenceAdapters";
import {
  ALLOWED_EVIDENCE_RELATIONS,
  CrossSystemEvidenceLinkError,
  CrossSystemEvidenceLinkingSurface,
} from "./CrossSystemEvidenceLinkingSurface";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function expectError(run: () => void, code: EvidenceLinkErrorCode): void {
  try {
    run();
  } catch (error) {
    if (error instanceof CrossSystemEvidenceLinkError && error.code === code) return;
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

const prediction = {
  predictionId: "prediction:one",
  version: { predictionVersion: "1.0", schemaVersion: "1.0" },
  status: "LOCKED",
  evidence: { auditReferences: [{ auditId: "audit:prediction", traceId: "trace:shared" }] },
} as unknown as Prediction;

const strategy = {
  versionId: "strategy-version:one",
  semanticVersion: "2.0.0",
  status: "ACTIVE",
  correlationId: "correlation:shared",
  traceId: "trace:shared",
  references: { audits: [{ referenceId: "audit:strategy" }] },
} as unknown as StrategyVersion;

const pattern = {
  patternId: "historical-pattern:one",
  recordVersion: "1.1",
  status: "REVIEWED",
  correlationId: "correlation:shared",
  traceId: "trace:shared",
  references: { audits: [{ referenceId: "audit:pattern" }] },
} as unknown as HistoricalPattern;

const analogy = {
  analogyId: "historical-analogy:one",
  recordVersion: "1.0",
  status: "REVIEWED",
  correlationId: "correlation:shared",
  traceId: "trace:shared",
  auditReference: { auditId: "audit:analogy", auditVersion: "1.0" },
} as unknown as HistoricalAnalogyRecord;

const replay = {
  sessionId: "event-replay:one",
  sessionVersion: "1.0",
  status: "COMPLETED",
  correlationId: "correlation:shared",
  traceId: "trace:shared",
} as unknown as ReplaySession;

const outcome = {
  outcomeId: "prediction-outcome:one",
  predictionId: prediction.predictionId,
  evidenceReferences: [{ auditId: "audit:outcome", traceId: "trace:shared" }],
} as unknown as PredictionOutcome;

const journal = {
  entryId: "journal-entry:one",
  status: "REVIEWED",
  correlationId: "correlation:shared",
  traceId: "trace:shared",
  evidence: { audits: [{ referenceId: "audit:journal" }] },
} as unknown as AlphaJournalEntry;

let readCount = 0;
let arbitraryExecutionCount = 0;
const predictionPort = {
  getById: (id: string) => { readCount += 1; return id === prediction.predictionId ? prediction : undefined; },
  allOutcomes: () => { readCount += 1; return [outcome]; },
  execute: () => { arbitraryExecutionCount += 1; },
};

function sources(options: { readonly omitJournal?: boolean } = {}): CrossSystemEvidenceReadSources {
  return {
    predictions: predictionPort,
    strategies: { getVersion: (id) => { readCount += 1; return id === strategy.versionId ? strategy : undefined; } },
    historicalPatterns: { getPatternById: (id) => { readCount += 1; return id === pattern.patternId ? pattern : undefined; } },
    historicalAnalogies: { getAnalogyById: (id) => { readCount += 1; return id === analogy.analogyId ? analogy : undefined; } },
    eventReplays: { getSessionById: (id) => { readCount += 1; return id === replay.sessionId ? replay : undefined; } },
    ...(options.omitJournal ? {} : { journal: { getById: (id: string) => { readCount += 1; return id === journal.entryId ? journal : undefined; } } }),
  };
}

const reference = (entityType: EvidenceEntityType, entityId: string, version?: string) => ({
  entityType,
  entityId,
  ...(version === undefined ? {} : { version }),
});

const chain = [
  { linkId: "06-outcome-journal", source: reference(EvidenceEntityType.PredictionOutcome, outcome.outcomeId), relation: EvidenceRelationType.DocumentedBy, target: reference(EvidenceEntityType.JournalEntry, journal.entryId) },
  { linkId: "05-replay-outcome", source: reference(EvidenceEntityType.EventReplay, replay.sessionId), relation: EvidenceRelationType.ResultedIn, target: reference(EvidenceEntityType.PredictionOutcome, outcome.outcomeId) },
  { linkId: "04-analogy-replay", source: reference(EvidenceEntityType.HistoricalAnalogy, analogy.analogyId), relation: EvidenceRelationType.ReplayedBy, target: reference(EvidenceEntityType.EventReplay, replay.sessionId) },
  { linkId: "03-pattern-analogy", source: reference(EvidenceEntityType.HistoricalPattern, pattern.patternId), relation: EvidenceRelationType.ComparedWith, target: reference(EvidenceEntityType.HistoricalAnalogy, analogy.analogyId) },
  { linkId: "02-strategy-pattern", source: reference(EvidenceEntityType.StrategyVersion, strategy.versionId), relation: EvidenceRelationType.SupportedBy, target: reference(EvidenceEntityType.HistoricalPattern, pattern.patternId) },
  { linkId: "01-prediction-strategy", source: reference(EvidenceEntityType.Prediction, prediction.predictionId, "1.0"), relation: EvidenceRelationType.UsedStrategy, target: reference(EvidenceEntityType.StrategyVersion, strategy.versionId, "2.0.0") },
];

const tests: ReadonlyArray<{ readonly name: string; readonly run: () => void }> = [
  {
    name: "valid supported link resolves through authoritative read ports",
    run: () => {
      const result = new CrossSystemEvidenceLinkingSurface(sources()).resolve({ links: [chain[5]] });
      assertEqual(result.links[0]?.status, EvidenceLinkResolutionStatus.Resolved, "link status");
      assertEqual(result.links[0]?.source.resolvedVersion, "1.0", "prediction version");
      assertDeepEqual(result.links[0]?.target.audit.traceIds, ["trace:shared"], "trace metadata");
    },
  },
  {
    name: "explicit chain is returned in deterministic order without traversal",
    run: () => {
      const surface = new CrossSystemEvidenceLinkingSurface(sources());
      const first = surface.resolve({ links: chain });
      const second = surface.resolve({ links: [...chain].reverse() });
      const expected = ["01-prediction-strategy", "02-strategy-pattern", "03-pattern-analogy", "04-analogy-replay", "05-replay-outcome", "06-outcome-journal"];
      assertDeepEqual(first.links.map((value) => value.linkId), expected, "ordered links");
      assertDeepEqual(first, second, "deterministic result");
      assertEqual(first.links.length, chain.length, "bounded flat result");
    },
  },
  {
    name: "unsupported entity type is rejected",
    run: () => expectError(() => new CrossSystemEvidenceLinkingSurface(sources()).resolve({ links: [{ ...chain[5], source: { entityType: "ARBITRARY", entityId: "x" } }] }), EvidenceLinkErrorCode.UnsupportedEntityType),
  },
  {
    name: "unsupported relation type is rejected",
    run: () => expectError(() => new CrossSystemEvidenceLinkingSurface(sources()).resolve({ links: [{ ...chain[5], relation: "SEMANTICALLY_RELATED" }] }), EvidenceLinkErrorCode.UnsupportedRelationType),
  },
  {
    name: "invalid relation pairing is rejected",
    run: () => expectError(() => new CrossSystemEvidenceLinkingSurface(sources()).resolve({ links: [{ ...chain[5], target: reference(EvidenceEntityType.JournalEntry, journal.entryId) }] }), EvidenceLinkErrorCode.InvalidRelationPairing),
  },
  {
    name: "malformed reference is rejected",
    run: () => expectError(() => new CrossSystemEvidenceLinkingSurface(sources()).resolve({ links: [{ ...chain[5], source: reference(EvidenceEntityType.Prediction, " ") }] }), EvidenceLinkErrorCode.MalformedReference),
  },
  {
    name: "missing target remains explicit and unresolved",
    run: () => {
      const result = new CrossSystemEvidenceLinkingSurface(sources()).resolve({ links: [{ ...chain[5], target: reference(EvidenceEntityType.StrategyVersion, "strategy-version:missing") }] });
      assertEqual(result.links[0]?.status, EvidenceLinkResolutionStatus.Unresolved, "link status");
      assertEqual(result.links[0]?.target.status, EvidenceEntityResolutionStatus.Unresolved, "target status");
      assertEqual(result.warnings[0]?.code, "ENTITY_NOT_FOUND", "warning code");
    },
  },
  {
    name: "unavailable repository remains explicit",
    run: () => {
      const result = new CrossSystemEvidenceLinkingSurface(sources({ omitJournal: true })).resolve({ links: [chain[0]] });
      assertEqual(result.links[0]?.target.status, EvidenceEntityResolutionStatus.RepositoryUnavailable, "repository status");
    },
  },
  {
    name: "version mismatch preserves requested and resolved versions",
    run: () => {
      const value = { ...chain[5], target: reference(EvidenceEntityType.StrategyVersion, strategy.versionId, "9.0.0") };
      const result = new CrossSystemEvidenceLinkingSurface(sources()).resolve({ links: [value] });
      assertEqual(result.links[0]?.target.reference.version, "9.0.0", "requested version");
      assertEqual(result.links[0]?.target.resolvedVersion, "2.0.0", "resolved version");
      assertEqual(result.links[0]?.target.status, EvidenceEntityResolutionStatus.VersionMismatch, "version status");
    },
  },
  {
    name: "unversioned entity reports requested version as unavailable",
    run: () => {
      const value = { ...chain[0], target: reference(EvidenceEntityType.JournalEntry, journal.entryId, "1.0") };
      const result = new CrossSystemEvidenceLinkingSurface(sources()).resolve({ links: [value] });
      assertEqual(result.links[0]?.target.status, EvidenceEntityResolutionStatus.VersionUnavailable, "version unavailable");
    },
  },
  {
    name: "empty request performs no fuzzy or implicit inference",
    run: () => {
      readCount = 0;
      const result = new CrossSystemEvidenceLinkingSurface(sources()).resolve({ links: [] });
      assertEqual(result.links.length, 0, "empty links");
      assertEqual(readCount, 0, "repository reads");
    },
  },
  {
    name: "result and nested link views are runtime read-only",
    run: () => {
      const result = new CrossSystemEvidenceLinkingSurface(sources()).resolve({ links: [chain[5]] });
      assertEqual(Object.isFrozen(result), true, "result frozen");
      assertEqual(Object.isFrozen(result.links), true, "links frozen");
      assertEqual(Object.isFrozen(result.links[0]?.source.reference), true, "reference frozen");
      assertEqual(Object.isFrozen(result.links[0]?.source.audit.traceIds), true, "audit frozen");
    },
  },
  {
    name: "fixed adapters never execute arbitrary repository capabilities",
    run: () => {
      arbitraryExecutionCount = 0;
      const keysBefore = Object.keys(predictionPort);
      new CrossSystemEvidenceLinkingSurface(sources()).resolve({ links: [chain[5]] });
      assertEqual(arbitraryExecutionCount, 0, "arbitrary execution");
      assertDeepEqual(Object.keys(predictionPort), keysBefore, "repository unchanged");
    },
  },
  {
    name: "allowed relation table has no implicit reverse relations",
    run: () => {
      const reverse = ALLOWED_EVIDENCE_RELATIONS.filter((candidate) => ALLOWED_EVIDENCE_RELATIONS.some((value) =>
        value.source === candidate.target && value.target === candidate.source && value.relation === candidate.relation));
      assertEqual(reverse.length, 0, "implicit reverse relations");
    },
  },
];

let passed = 0;
for (const test of tests) {
  test.run();
  passed += 1;
}

console.log(`Cross-System Evidence Linking: ${passed}/${tests.length} tests passed.`);
