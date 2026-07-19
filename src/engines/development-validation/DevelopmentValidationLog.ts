import {
  DevelopmentDefectSeverity,
  DevelopmentDefectStatus,
  DevelopmentFollowUpStatus,
  DevelopmentRiskDecision,
  DevelopmentTestResult,
  DevelopmentValidationCheckResult,
  DevelopmentValidationRecordType,
  type DevelopmentAppendResult,
  type DevelopmentFilter,
  type DevelopmentHistory,
  type DevelopmentQuery,
  type DevelopmentStatistics,
  type DevelopmentSummary,
  type DevelopmentValidationRecord,
  type DevelopmentValidationRecordSnapshot,
} from "../../contracts";
import type { DevelopmentValidationRepository } from "../../repositories";

export interface DevelopmentValidationClock { now(): string; }
export class SystemDevelopmentValidationClock implements DevelopmentValidationClock { now(): string { return new Date().toISOString(); } }

export class DevelopmentValidationLog {
  constructor(private readonly repository: DevelopmentValidationRepository, private readonly clock: DevelopmentValidationClock = new SystemDevelopmentValidationClock()) {}

  append(snapshot: DevelopmentValidationRecordSnapshot): DevelopmentAppendResult {
    return this.repository.append(structuredClone(snapshot), this.clock.now());
  }

  get(recordId: string): DevelopmentValidationRecord | undefined { return this.repository.getById(recordId); }
  history(taskId: string): DevelopmentHistory | undefined { return this.repository.getTaskHistory(taskId); }
  query(query: DevelopmentQuery = {}): ReadonlyArray<DevelopmentValidationRecord> { return this.repository.query(query); }

  summary(taskId: string): DevelopmentSummary | undefined {
    const history = this.repository.getTaskHistory(taskId); if (history === undefined) return undefined;
    const records = history.records; const latestCommit = [...records].reverse().find((record) => record.gitReference?.commit !== undefined)?.gitReference?.commit;
    return {
      taskId: history.task.taskId, taskTitle: history.task.taskTitle, projectDay: history.task.projectDay,
      latestStatus: history.currentStatus, recordCount: records.length,
      validationPassed: records.reduce((sum, record) => sum + record.testRuns.filter((run) => run.result === DevelopmentTestResult.Passed).length + record.validationChecks.filter((check) => check.result === DevelopmentValidationCheckResult.Passed).length, 0),
      validationFailed: records.reduce((sum, record) => sum + record.testRuns.filter((run) => run.result === DevelopmentTestResult.Failed).length + record.validationChecks.filter((check) => check.result === DevelopmentValidationCheckResult.Failed).length, 0),
      openDefectCount: records.reduce((sum, record) => sum + record.defects.filter((defect) => defect.status === DevelopmentDefectStatus.Open).length, 0),
      acceptedRiskCount: records.reduce((sum, record) => sum + record.risks.filter((risk) => risk.decision === DevelopmentRiskDecision.Accepted).length, 0),
      pendingFollowUpCount: records.reduce((sum, record) => sum + record.followUps.filter((followUp) => followUp.status === DevelopmentFollowUpStatus.Pending).length, 0),
      ...(latestCommit === undefined ? {} : { commitHash: latestCommit.commitHash }),
      pushed: records.some((record) => record.recordType === DevelopmentValidationRecordType.PushCompleted && record.gitReference?.push?.synchronized === true),
    };
  }

  statistics(filter?: DevelopmentFilter): DevelopmentStatistics {
    const records = this.repository.query(filter === undefined ? {} : { filter });
    const taskIds = [...new Set(records.map((record) => record.taskId))];
    const histories = taskIds.map((taskId) => this.repository.getTaskHistory(taskId)).filter((history): history is DevelopmentHistory => history !== undefined);
    const tasksByStatus: DevelopmentStatistics["tasksByStatus"] extends infer _ ? Partial<Record<DevelopmentHistory["currentStatus"], number>> : never = {};
    const tasksByProjectDay: Record<string, number> = {}; const testCountsBySubsystem: Record<string, { passed: number; failed: number; skipped: number }> = {};
    const defectsBySeverity: Partial<Record<DevelopmentDefectSeverity, number>> = {}; const reviewToApprovalDurationMs: Record<string, number> = {}; const implementationToPushDurationMs: Record<string, number> = {}; const commitsByMilestone: Record<string, number> = {}; const environmentWarningsByType: Record<string, number> = {};
    let validationsPassed = 0; let validationsFailed = 0; let openDefectCount = 0; let acceptedRiskCount = 0; let tasksRequiringFollowUp = 0;
    for (const history of histories) { tasksByStatus[history.currentStatus] = (tasksByStatus[history.currentStatus] ?? 0) + 1; tasksByProjectDay[history.task.projectDay] = (tasksByProjectDay[history.task.projectDay] ?? 0) + 1; if (history.records.some((record) => record.followUps.some((followUp) => followUp.status === DevelopmentFollowUpStatus.Pending))) tasksRequiringFollowUp += 1; const review = history.records.find((record) => record.ownerReview !== undefined)?.ownerReview; const approval = history.records.find((record) => record.ownerApproval !== undefined)?.ownerApproval; if (review !== undefined && approval !== undefined) reviewToApprovalDurationMs[history.task.taskId] = Date.parse(approval.decidedAt) - Date.parse(review.reviewedAt); const implementation = history.records.find((record) => record.recordType === DevelopmentValidationRecordType.ImplementationCompleted); const push = history.records.find((record) => record.recordType === DevelopmentValidationRecordType.PushCompleted)?.gitReference?.push; if (implementation !== undefined && push !== undefined) implementationToPushDurationMs[history.task.taskId] = Date.parse(push.pushedAt) - Date.parse(implementation.timestamp); }
    for (const record of records) {
      for (const run of record.testRuns) { const counts = testCountsBySubsystem[run.subsystem] ?? { passed: 0, failed: 0, skipped: 0 }; counts.passed += run.passedCount; counts.failed += run.failedCount; counts.skipped += run.skippedCount; testCountsBySubsystem[run.subsystem] = counts; if (run.result === DevelopmentTestResult.Passed) validationsPassed += 1; if (run.result === DevelopmentTestResult.Failed) validationsFailed += 1; }
      for (const check of record.validationChecks) { if (check.result === DevelopmentValidationCheckResult.Passed) validationsPassed += 1; if (check.result === DevelopmentValidationCheckResult.Failed) validationsFailed += 1; }
      for (const defect of record.defects) { defectsBySeverity[defect.severity] = (defectsBySeverity[defect.severity] ?? 0) + 1; if (defect.status === DevelopmentDefectStatus.Open) openDefectCount += 1; }
      acceptedRiskCount += record.risks.filter((risk) => risk.decision === DevelopmentRiskDecision.Accepted).length;
      for (const warning of record.environmentWarnings) environmentWarningsByType[warning.warningType] = (environmentWarningsByType[warning.warningType] ?? 0) + 1;
      const milestone = record.gitReference?.milestoneTag ?? record.projectDay; if (record.gitReference?.commit !== undefined) commitsByMilestone[milestone] = (commitsByMilestone[milestone] ?? 0) + 1;
    }
    return { generatedAt: this.clock.now(), taskCount: taskIds.length, recordCount: records.length, tasksByStatus, tasksByProjectDay, validationsPassed, validationsFailed, testCountsBySubsystem, defectsBySeverity, openDefectCount, acceptedRiskCount, tasksRequiringFollowUp, reviewToApprovalDurationMs, implementationToPushDurationMs, commitsByMilestone, environmentWarningsByType };
  }
}
