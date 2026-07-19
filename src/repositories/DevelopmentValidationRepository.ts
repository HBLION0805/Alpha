import {
  DevelopmentDefectStatus,
  DevelopmentFollowUpStatus,
  DevelopmentRiskDecision,
  DevelopmentTestResult,
  DevelopmentValidationCheckResult,
  type DevelopmentAppendResult,
  type DevelopmentHistory,
  type DevelopmentQuery,
  type DevelopmentValidationRecord,
  type DevelopmentValidationRecordSnapshot,
} from "../contracts";

export interface DevelopmentValidationRepository {
  append(snapshot: DevelopmentValidationRecordSnapshot, acceptedAt: string): DevelopmentAppendResult;
  getById(recordId: string): DevelopmentValidationRecord | undefined;
  getTaskHistory(taskId: string): DevelopmentHistory | undefined;
  query(query?: DevelopmentQuery): ReadonlyArray<DevelopmentValidationRecord>;
  allRecords(): ReadonlyArray<DevelopmentValidationRecord>;
}

export function matchesDevelopmentQuery(record: DevelopmentValidationRecord, query: DevelopmentQuery = {}): boolean {
  const filter = query.filter;
  if (filter === undefined) return true;
  const ownerDecision = record.ownerApproval?.decision ?? record.ownerReview?.decision;
  const hasFailedValidation = record.testRuns.some((run) => run.result === DevelopmentTestResult.Failed)
    || record.validationChecks.some((check) => check.result === DevelopmentValidationCheckResult.Failed);
  return (filter.taskId === undefined || record.taskId === filter.taskId)
    && (filter.projectDay === undefined || record.projectDay === filter.projectDay)
    && (filter.recordTypes === undefined || filter.recordTypes.includes(record.recordType))
    && (filter.statuses === undefined || filter.statuses.includes(record.status))
    && (filter.ownerDecisions === undefined || (ownerDecision !== undefined && filter.ownerDecisions.includes(ownerDecision)))
    && (filter.commitHash === undefined || record.gitReference?.commit?.commitHash === filter.commitHash || record.gitReference?.push?.localCommit === filter.commitHash)
    && (filter.fromTimestamp === undefined || Date.parse(record.timestamp) >= Date.parse(filter.fromTimestamp))
    && (filter.toTimestamp === undefined || Date.parse(record.timestamp) <= Date.parse(filter.toTimestamp))
    && (filter.failedValidationsOnly !== true || hasFailedValidation)
    && (filter.openDefectsOnly !== true || record.defects.some((defect) => defect.status === DevelopmentDefectStatus.Open))
    && (filter.acceptedRisksOnly !== true || record.risks.some((risk) => risk.decision === DevelopmentRiskDecision.Accepted))
    && (filter.pendingFollowUpsOnly !== true || record.followUps.some((followUp) => followUp.status === DevelopmentFollowUpStatus.Pending));
}
