import type {
  StrategyActivation, StrategyAppendResult, StrategyApproval, StrategyDefinition,
  StrategyHistory, StrategyHistoryBundle, StrategyPerformanceSummary, StrategyQuery,
  StrategyRetirement, StrategySuspension, StrategyValidationResult, StrategyVersion,
} from "../contracts";

export type StrategyRepositoryEvent =
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "DEFINITION_APPENDED"; readonly acceptedAt: string; readonly definition: StrategyDefinition }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "VERSION_PROPOSED"; readonly acceptedAt: string; readonly version: StrategyVersion }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "VALIDATION_STARTED"; readonly acceptedAt: string; readonly history: StrategyHistory }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "VALIDATION_APPENDED"; readonly acceptedAt: string; readonly validation: StrategyValidationResult }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "APPROVAL_APPENDED"; readonly acceptedAt: string; readonly approval: StrategyApproval; readonly history: StrategyHistory }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "ACTIVATION_APPENDED"; readonly acceptedAt: string; readonly activation: StrategyActivation; readonly history: StrategyHistory }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "SUSPENSION_APPENDED"; readonly acceptedAt: string; readonly suspension: StrategySuspension; readonly history: StrategyHistory }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "RETIREMENT_APPENDED"; readonly acceptedAt: string; readonly retirement: StrategyRetirement; readonly history: StrategyHistory }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "PERFORMANCE_APPENDED"; readonly acceptedAt: string; readonly performance: StrategyPerformanceSummary }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "VERSION_ARCHIVED"; readonly acceptedAt: string; readonly history: StrategyHistory };

export interface StrategyRepository {
  appendDefinition(definition: StrategyDefinition, acceptedAt: string): StrategyAppendResult<StrategyDefinition>;
  appendVersion(version: StrategyVersion, acceptedAt: string): StrategyAppendResult<StrategyVersion>;
  appendValidationStart(history: StrategyHistory, acceptedAt: string): StrategyAppendResult<StrategyHistory>;
  appendValidation(validation: StrategyValidationResult, acceptedAt: string): StrategyAppendResult<StrategyValidationResult>;
  appendApproval(approval: StrategyApproval, history: StrategyHistory, acceptedAt: string): StrategyAppendResult<StrategyApproval>;
  appendActivation(activation: StrategyActivation, history: StrategyHistory, acceptedAt: string): StrategyAppendResult<StrategyActivation>;
  appendSuspension(suspension: StrategySuspension, history: StrategyHistory, acceptedAt: string): StrategyAppendResult<StrategySuspension>;
  appendRetirement(retirement: StrategyRetirement, history: StrategyHistory, acceptedAt: string): StrategyAppendResult<StrategyRetirement>;
  appendPerformance(performance: StrategyPerformanceSummary, acceptedAt: string): StrategyAppendResult<StrategyPerformanceSummary>;
  appendArchive(history: StrategyHistory, acceptedAt: string): StrategyAppendResult<StrategyHistory>;
  getDefinition(definitionId: string): StrategyDefinition | undefined;
  getVersion(versionId: string): StrategyVersion | undefined;
  getValidation(validationId: string): StrategyValidationResult | undefined;
  getApproval(approvalId: string): StrategyApproval | undefined;
  getLatestApproval(versionId: string): StrategyApproval | undefined;
  getActivation(activationId: string): StrategyActivation | undefined;
  getCurrentActiveVersion(definitionId: string): StrategyVersion | undefined;
  getLatestVersion(definitionId: string): StrategyVersion | undefined;
  listDefinitions(): ReadonlyArray<StrategyDefinition>;
  listVersions(definitionId: string): ReadonlyArray<StrategyVersion>;
  listValidations(versionId: string): ReadonlyArray<StrategyValidationResult>;
  listPerformance(versionId: string): ReadonlyArray<StrategyPerformanceSummary>;
  getStrategyHistory(definitionId: string): StrategyHistoryBundle | undefined;
  query(query?: StrategyQuery): ReadonlyArray<StrategyVersion>;
  allEvents(): ReadonlyArray<StrategyRepositoryEvent>;
}

export function matchesStrategyQuery(version: StrategyVersion, query: StrategyQuery = {}): boolean {
  const filter = query.filter; if (filter === undefined) return true;
  const has = (values: ReadonlyArray<{ readonly referenceId: string }>, id: string | undefined): boolean => id === undefined || values.some((value) => value.referenceId === id);
  return (filter.definitionId === undefined || version.definitionId === filter.definitionId)
    && (filter.categories === undefined || filter.categories.includes(version.category))
    && (filter.statuses === undefined || filter.statuses.includes(version.status))
    && (filter.activeOnly !== true || version.status === "ACTIVE")
    && (filter.market === undefined || version.scope.markets.includes(filter.market))
    && (filter.assetType === undefined || version.scope.assetTypes.includes(filter.assetType))
    && (filter.capitalStage === undefined || version.scope.capitalStages.includes(filter.capitalStage))
    && has(version.references.research, filter.researchId)
    && has(version.references.predictions, filter.predictionId)
    && has(version.references.journals, filter.journalId)
    && (filter.tags === undefined || filter.tags.every((tag) => version.tags.includes(tag)))
    && (filter.fromCreatedAt === undefined || Date.parse(version.createdAt) >= Date.parse(filter.fromCreatedAt))
    && (filter.toCreatedAt === undefined || Date.parse(version.createdAt) <= Date.parse(filter.toCreatedAt))
    && (filter.correlationId === undefined || version.correlationId === filter.correlationId)
    && (filter.traceId === undefined || version.traceId === filter.traceId);
}
