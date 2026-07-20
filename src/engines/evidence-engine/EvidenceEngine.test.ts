import {
  EVIDENCE_ASSESSMENT_SCHEMA_VERSION,
  EvidenceAssessmentBlockerCode,
  EvidenceAssessmentErrorCode,
  EvidenceAssessmentStatus,
  EvidenceConflictReason,
  EvidenceDimension,
  EvidenceDimensionStatus,
  EvidenceEntityResolutionStatus,
  EvidenceEntityType,
  EvidenceItemResolutionStatus,
  EvidenceLinkResolutionStatus,
  EvidenceRelationType,
  EvidenceRequirement,
  type CrossSystemEvidenceLinkResult,
  type EvidenceAssessmentRequest,
  type EvidenceAuditMetadata,
  type EvidenceReference,
  type ResolvedEvidenceLink,
} from "../../contracts";
import { EvidenceAssessmentError, EvidenceEngine } from "./EvidenceEngine";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function expectError(run: () => void, code: EvidenceAssessmentErrorCode): void {
  try {
    run();
  } catch (error) {
    if (error instanceof EvidenceAssessmentError && error.code === code) return;
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

const audit = (suffix: string): EvidenceAuditMetadata => ({
  correlationIds: [`correlation:${suffix}`],
  traceIds: [`trace:${suffix}`],
  auditReferenceIds: [`audit:${suffix}`],
});

const reference = (entityType: EvidenceEntityType, entityId: string, version?: string): EvidenceReference => ({
  entityType,
  entityId,
  ...(version === undefined ? {} : { version }),
});

interface LinkOptions {
  readonly sourceType?: EvidenceEntityType;
  readonly sourceId?: string;
  readonly sourceVersion?: string;
  readonly relation?: EvidenceRelationType;
  readonly targetType?: EvidenceEntityType;
  readonly targetId?: string;
  readonly targetVersion?: string;
  readonly targetStatus?: EvidenceEntityResolutionStatus;
  readonly targetAudit?: EvidenceAuditMetadata;
}

function link(linkId: string, options: LinkOptions = {}): ResolvedEvidenceLink {
  const sourceVersion = options.sourceVersion ?? "1.0";
  const targetVersion = options.targetVersion ?? "1.0";
  const targetStatus = options.targetStatus ?? EvidenceEntityResolutionStatus.Resolved;
  const source = {
    reference: reference(options.sourceType ?? EvidenceEntityType.Prediction, options.sourceId ?? "prediction:one", sourceVersion),
    status: EvidenceEntityResolutionStatus.Resolved,
    resolvedVersion: sourceVersion,
    recordStatus: "LOCKED",
    audit: audit("source"),
    warnings: [],
  };
  const target = {
    reference: reference(options.targetType ?? EvidenceEntityType.HistoricalPattern, options.targetId ?? `historical-pattern:${linkId}`, targetVersion),
    status: targetStatus,
    ...(targetStatus === EvidenceEntityResolutionStatus.RepositoryUnavailable
      || targetStatus === EvidenceEntityResolutionStatus.Unresolved
      || targetStatus === EvidenceEntityResolutionStatus.VersionUnavailable
      ? {}
      : { resolvedVersion: targetStatus === EvidenceEntityResolutionStatus.VersionMismatch ? "0.9" : targetVersion }),
    recordStatus: targetStatus === EvidenceEntityResolutionStatus.Resolved ? "REVIEWED" : "UNKNOWN",
    audit: options.targetAudit ?? (targetStatus === EvidenceEntityResolutionStatus.RepositoryUnavailable ? emptyAudit() : audit(linkId)),
    warnings: [],
  };
  return {
    linkId,
    source,
    relation: options.relation ?? EvidenceRelationType.SupportedBy,
    target,
    status: targetStatus === EvidenceEntityResolutionStatus.Resolved
      ? EvidenceLinkResolutionStatus.Resolved
      : EvidenceLinkResolutionStatus.Unresolved,
    warnings: [],
  };
}

function emptyAudit(): EvidenceAuditMetadata {
  return { correlationIds: [], traceIds: [], auditReferenceIds: [] };
}

function linkedEvidence(...links: ReadonlyArray<ResolvedEvidenceLink>): CrossSystemEvidenceLinkResult {
  return { links, warnings: [], deterministic: true, readOnly: true };
}

const policy = {
  policyId: "evidence-policy:default",
  version: "1.0",
  minimumRequiredEvidence: 1,
  requireProvenanceForRequiredEvidence: true,
  requireExplicitVersionForRequiredEvidence: true,
  freshnessRules: [],
} as const;

function request(
  links: ReadonlyArray<ResolvedEvidenceLink> = [link("evidence:pattern")],
  itemRequirements: ReadonlyArray<EvidenceRequirement> = links.map(() => EvidenceRequirement.Required),
): EvidenceAssessmentRequest {
  return {
    schemaVersion: EVIDENCE_ASSESSMENT_SCHEMA_VERSION,
    assessmentId: "evidence-assessment:one",
    subject: reference(EvidenceEntityType.Prediction, "prediction:one", "1.0"),
    evaluatedAt: "2026-07-20T12:00:00.000Z",
    policy,
    linkedEvidence: linkedEvidence(...links),
    evidenceItems: links.map((value, index) => ({
      itemId: `evidence-item:${index + 1}`,
      linkId: value.linkId,
      requirement: itemRequirements[index] ?? EvidenceRequirement.Required,
    })),
    conflicts: [],
  };
}

const engine = new EvidenceEngine();

const tests: ReadonlyArray<{ readonly name: string; readonly run: () => void }> = [
  {
    name: "resolved prediction and historical evidence produces a deterministic sufficient assessment",
    run: () => {
      const result = engine.assess(request());
      assertEqual(result.overallStatus, EvidenceAssessmentStatus.Sufficient, "overall status");
      assertDeepEqual(result.acceptedEvidenceItemIds, ["evidence-item:1"], "accepted IDs");
      assertEqual(result.deterministic, true, "deterministic marker");
      assertEqual(result.readOnly, true, "read-only marker");
    },
  },
  {
    name: "missing required evidence produces insufficient",
    run: () => {
      const missing = link("evidence:missing", { targetStatus: EvidenceEntityResolutionStatus.Unresolved });
      const result = engine.assess(request([missing]));
      assertEqual(result.overallStatus, EvidenceAssessmentStatus.Insufficient, "overall status");
      assertTrue(result.blockers.some((value) => value.code === EvidenceAssessmentBlockerCode.RequiredEvidenceUnresolved), "unresolved blocker");
    },
  },
  {
    name: "no explicit evidence fails closed",
    run: () => {
      const result = engine.assess(request([]));
      assertEqual(result.overallStatus, EvidenceAssessmentStatus.Insufficient, "overall status");
      assertTrue(result.blockers.some((value) => value.code === EvidenceAssessmentBlockerCode.NoEvidence), "no-evidence blocker");
    },
  },
  {
    name: "accepted evidence below the policy minimum remains insufficient",
    run: () => {
      const value = request();
      const result = engine.assess({ ...value, policy: { ...policy, minimumRequiredEvidence: 2 } });
      assertEqual(result.overallStatus, EvidenceAssessmentStatus.Insufficient, "overall status");
      assertDeepEqual(result.metrics.requiredCompleteness, { numerator: 1, denominator: 2 }, "required completeness");
    },
  },
  {
    name: "unavailable source produces unavailable",
    run: () => {
      const unavailable = link("evidence:unavailable", { targetStatus: EvidenceEntityResolutionStatus.RepositoryUnavailable });
      const result = engine.assess(request([unavailable]));
      assertEqual(result.overallStatus, EvidenceAssessmentStatus.Unavailable, "overall status");
      assertDeepEqual(result.unavailableEvidenceItemIds, ["evidence-item:1"], "unavailable IDs");
    },
  },
  {
    name: "conflicting required evidence produces conflicting without arbitration",
    run: () => {
      const value = request([link("evidence:a"), link("evidence:b")]);
      const result = engine.assess({
        ...value,
        conflicts: [{
          conflictId: "conflict:one",
          itemIds: ["evidence-item:2", "evidence-item:1"],
          field: "observed.marketRegime",
          reason: EvidenceConflictReason.ContradictoryFact,
        }],
      });
      assertEqual(result.overallStatus, EvidenceAssessmentStatus.Conflicting, "overall status");
      assertDeepEqual(result.conflicts[0]?.itemIds, ["evidence-item:1", "evidence-item:2"], "conflict order");
    },
  },
  {
    name: "optional unresolved evidence does not automatically fail sufficiency",
    run: () => {
      const result = engine.assess(request(
        [link("evidence:required"), link("evidence:optional", { targetStatus: EvidenceEntityResolutionStatus.Unresolved })],
        [EvidenceRequirement.Required, EvidenceRequirement.Optional],
      ));
      assertEqual(result.overallStatus, EvidenceAssessmentStatus.Sufficient, "overall status");
      assertEqual(result.warnings.length > 0, true, "optional warning");
    },
  },
  {
    name: "malformed evidence reference is rejected",
    run: () => expectError(
      () => engine.assess({ ...request(), subject: { entityType: EvidenceEntityType.Prediction, entityId: "" } }),
      EvidenceAssessmentErrorCode.MalformedEvidenceReference,
    ),
  },
  {
    name: "unsupported evidence type is rejected",
    run: () => expectError(
      () => engine.assess({ ...request(), subject: { entityType: "TRADE_RECOMMENDATION", entityId: "entity:one" } }),
      EvidenceAssessmentErrorCode.UnsupportedEvidenceType,
    ),
  },
  {
    name: "unresolved reference is preserved rather than discarded",
    run: () => {
      const missing = link("evidence:preserved", { targetStatus: EvidenceEntityResolutionStatus.Unresolved });
      const result = engine.assess(request([missing]));
      assertEqual(result.evidenceItems.length, 1, "item count");
      assertEqual(result.evidenceItems[0]?.status, EvidenceItemResolutionStatus.Unresolved, "item status");
      assertEqual(result.evidenceItems[0]?.target.entityId, "historical-pattern:evidence:preserved", "target ID");
    },
  },
  {
    name: "freshness behavior uses an explicit deterministic threshold",
    run: () => {
      const value = request();
      const result = engine.assess({
        ...value,
        policy: { ...policy, freshnessRules: [{ entityType: EvidenceEntityType.HistoricalPattern, maximumAgeSeconds: 60 }] },
        evidenceItems: [{ ...value.evidenceItems[0], observedAt: "2026-07-20T11:58:00.000Z" }],
      });
      assertEqual(result.overallStatus, EvidenceAssessmentStatus.Insufficient, "overall status");
      assertEqual(result.evidenceItems[0]?.ageSeconds, 120, "age seconds");
      assertDeepEqual(result.staleEvidenceItemIds, ["evidence-item:1"], "stale IDs");
    },
  },
  {
    name: "policy identity version and thresholds are preserved",
    run: () => {
      const value = request();
      const result = engine.assess({
        ...value,
        policy: {
          ...policy,
          policyId: "evidence-policy:reviewed",
          version: "2.1",
          freshnessRules: [{ entityType: EvidenceEntityType.HistoricalPattern, maximumAgeSeconds: 3600 }],
        },
        evidenceItems: [{ ...value.evidenceItems[0], observedAt: "2026-07-20T11:30:00.000Z" }],
      });
      assertEqual(result.policy.policyId, "evidence-policy:reviewed", "policy ID");
      assertEqual(result.policy.version, "2.1", "policy version");
      assertEqual(result.evidenceItems[0]?.freshnessThresholdSeconds, 3600, "freshness threshold");
    },
  },
  {
    name: "required explicit version policy fails closed when the evidence version is absent",
    run: () => {
      const resolved = link("evidence:unversioned");
      const { resolvedVersion: _resolvedVersion, ...targetWithoutResolvedVersion } = resolved.target;
      const unversioned: ResolvedEvidenceLink = {
        ...resolved,
        target: {
          ...targetWithoutResolvedVersion,
          reference: reference(EvidenceEntityType.HistoricalPattern, "historical-pattern:unversioned"),
        },
      };
      const result = engine.assess(request([unversioned]));
      assertEqual(result.overallStatus, EvidenceAssessmentStatus.Insufficient, "overall status");
      assertTrue(result.blockers.some((value) => value.code === EvidenceAssessmentBlockerCode.RequiredVersionUnverifiable), "version blocker");
    },
  },
  {
    name: "required provenance policy fails closed when target audit metadata is absent",
    run: () => {
      const result = engine.assess(request([link("evidence:no-provenance", { targetAudit: emptyAudit() })]));
      assertEqual(result.overallStatus, EvidenceAssessmentStatus.Insufficient, "overall status");
      assertTrue(result.blockers.some((value) => value.code === EvidenceAssessmentBlockerCode.RequiredProvenanceMissing), "provenance blocker");
    },
  },
  {
    name: "output ordering is deterministic",
    run: () => {
      const value = request([link("evidence:z"), link("evidence:a")]);
      const result = engine.assess({
        ...value,
        evidenceItems: [
          { itemId: "evidence-item:z", linkId: "evidence:z", requirement: EvidenceRequirement.Required },
          { itemId: "evidence-item:a", linkId: "evidence:a", requirement: EvidenceRequirement.Required },
        ],
      });
      assertDeepEqual(result.evidenceItems.map((item) => item.itemId), ["evidence-item:a", "evidence-item:z"], "item order");
      assertDeepEqual(result.trace.auditReferenceIds, ["audit:evidence:a", "audit:evidence:z", "audit:source"], "trace order");
    },
  },
  {
    name: "repeated identical input produces an identical assessment",
    run: () => {
      const value = request();
      assertDeepEqual(engine.assess(value), engine.assess(value), "repeat result");
    },
  },
  {
    name: "assessment exposes no AI provider or fuzzy-inference path",
    run: () => {
      const serialized = JSON.stringify(engine.assess(request()));
      assertEqual(/provider|modelId|semanticSimilarity|fuzzy/iu.test(serialized), false, "AI or fuzzy fields");
    },
  },
  {
    name: "source link view remains unchanged",
    run: () => {
      const value = request();
      const before = JSON.stringify(value.linkedEvidence);
      engine.assess(value);
      assertEqual(JSON.stringify(value.linkedEvidence), before, "source link view");
    },
  },
  {
    name: "evidence assessment cannot output a trading recommendation",
    run: () => {
      const result = engine.assess(request()) as unknown as Record<string, unknown>;
      assertEqual("recommendation" in result, false, "recommendation field");
      assertEqual("decision" in result, false, "decision field");
      assertEqual("positionSize" in result, false, "position size field");
    },
  },
  {
    name: "required blockers cannot be hidden by an aggregate score",
    run: () => {
      const result = engine.assess(request(
        [link("evidence:missing", { targetStatus: EvidenceEntityResolutionStatus.Unresolved }), link("evidence:support")],
        [EvidenceRequirement.Required, EvidenceRequirement.Optional],
      ));
      assertEqual(result.overallStatus, EvidenceAssessmentStatus.Insufficient, "overall status");
      assertEqual("score" in (result as unknown as Record<string, unknown>), false, "aggregate score");
      assertDeepEqual(result.metrics.requiredCompleteness, { numerator: 0, denominator: 1 }, "visible completeness ratio");
    },
  },
  {
    name: "read-only result cannot mutate source evidence",
    run: () => {
      const value = request();
      const result = engine.assess(value);
      assertTrue(Object.isFrozen(result), "result frozen");
      assertTrue(Object.isFrozen(result.evidenceItems), "items frozen");
      assertTrue(Object.isFrozen(result.evidenceItems[0]?.target), "reference frozen");
      (value.linkedEvidence.links[0]?.target.reference as { entityId: string }).entityId = "historical-pattern:changed";
      assertEqual(result.evidenceItems[0]?.target.entityId, "historical-pattern:evidence:pattern", "copied target");
    },
  },
  {
    name: "explicit link chains are assessed once without graph traversal",
    run: () => {
      const links = [
        link("chain:three", { sourceType: EvidenceEntityType.HistoricalPattern, sourceId: "historical-pattern:one", relation: EvidenceRelationType.ComparedWith, targetType: EvidenceEntityType.HistoricalAnalogy, targetId: "historical-analogy:one" }),
        link("chain:one", { relation: EvidenceRelationType.UsedStrategy, targetType: EvidenceEntityType.StrategyVersion, targetId: "strategy-version:one" }),
        link("chain:two", { sourceType: EvidenceEntityType.StrategyVersion, sourceId: "strategy-version:one", targetId: "historical-pattern:one" }),
      ];
      const result = engine.assess(request(links));
      assertEqual(result.evidenceItems.length, 3, "explicit item count");
      assertDeepEqual(result.evidenceItems.map((item) => item.linkId), ["chain:three", "chain:one", "chain:two"], "no traversal output");
    },
  },
  {
    name: "freshness remains explicitly not assessed when no rule exists",
    run: () => {
      const result = engine.assess(request());
      const freshness = result.dimensions.find((value) => value.dimension === EvidenceDimension.Freshness);
      assertEqual(freshness?.status, EvidenceDimensionStatus.NotAssessed, "freshness status");
    },
  },
  {
    name: "unmapped linked evidence is rejected so evidence cannot be silently ignored",
    run: () => {
      const value = request([link("evidence:one"), link("evidence:two")]);
      expectError(
        () => engine.assess({ ...value, evidenceItems: [value.evidenceItems[0]] }),
        EvidenceAssessmentErrorCode.UnmappedEvidenceLink,
      );
    },
  },
  {
    name: "assessment subject must appear in the explicit linked-evidence view",
    run: () => expectError(
      () => engine.assess({
        ...request(),
        subject: reference(EvidenceEntityType.Prediction, "prediction:unrelated", "1.0"),
      }),
      EvidenceAssessmentErrorCode.SubjectNotLinked,
    ),
  },
  {
    name: "malformed link results cannot bypass approved relation pairings",
    run: () => expectError(
      () => engine.assess(request([link("evidence:bad-pair", { relation: EvidenceRelationType.ReplayedBy })])),
      EvidenceAssessmentErrorCode.MalformedLinkedEvidence,
    ),
  },
];

let passed = 0;
for (const test of tests) {
  test.run();
  passed += 1;
}

console.log(`Evidence Engine: ${passed}/${tests.length} tests passed`);
