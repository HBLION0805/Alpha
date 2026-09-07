import type { OptionsPaperScenario } from "../../contracts/OptionsPaperTrading";
import type { OptionsClosedTradeReview } from "../../contracts/OptionsTradeReview";
import { replayOptionsPaperAccount, freezePaper } from "../options-paper/OptionsPaperTradingEngine";
import { buildHistoricalReplayReport, type HistoricalReplayRun } from "../options-historical-replay/OptionsHistoricalReplayReview";
import { readinessClock, readinessFingerprint } from "./OptionsReadinessEngine";
import type { ContextHistory } from "./OptionsContextCutoff";

export interface OutcomeHistories {
  paper: ContextHistory<readonly OptionsPaperScenario[]>;
  historical: ContextHistory<readonly HistoricalReplayRun[]>;
}
interface OutcomeCase {
  id: string; origin: string; symbol: string | null; strategyVersion: string; setupKey: string;
  status: string; blockers: readonly string[]; planFingerprint: string; sourceFingerprint: string;
  recordedAt: string | null; scenarioAsOf: string | null; review: OptionsClosedTradeReview | null;
  candidateLessonCodes: readonly string[];
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function sum(values: readonly number[]) {
  const value = values.reduce((a, b) => a + BigInt(b), 0n), result = Number(value);
  if (!Number.isSafeInteger(result)) throw Error("OUTCOME_AUDIT_MONEY_RANGE");
  return result;
}
// Ratios truncate toward zero, using integer arithmetic throughout.
function scaled(numerator: number, denominator: number, scale: number) {
  if (!denominator) return null;
  const result = Number(BigInt(numerator) * BigInt(scale) / BigInt(denominator));
  if (!Number.isSafeInteger(result)) throw Error("OUTCOME_AUDIT_RATIO_RANGE");
  return result;
}
function metrics(cases: readonly OutcomeCase[]) {
  const closed = cases.flatMap(c => c.review ? [c.review] : []), positive = closed.filter(r => r.input.netPnlCents > 0), negative = closed.filter(r => r.input.netPnlCents < 0);
  const net = sum(closed.map(r => r.input.netPnlCents)), gains = sum(positive.map(r => r.input.netPnlCents)), losses = -sum(negative.map(r => r.input.netPnlCents));
  const statuses = [...new Set(cases.map(c => c.status))].sort();
  return {
    caseCount: cases.length, statusCounts: Object.fromEntries(statuses.map(s => [s, cases.filter(c => c.status === s).length])),
    closedCount: closed.length, netPositiveCount: positive.length, netNegativeCount: negative.length, breakevenCount: closed.length - positive.length - negative.length,
    openExposureCount: cases.filter(c => ["OPEN", "EXIT_PENDING"].includes(c.status)).length,
    targetExitCount: closed.filter(r => r.input.exitReason === "TARGET").length,
    stopExitCount: closed.filter(r => r.input.exitReason === "STOP").length, timeExitCount: closed.filter(r => r.input.exitReason === "TIME_EXIT").length,
    grossPnlCents: sum(closed.map(r => r.grossPnlCents)), feesCents: sum(closed.map(r => r.input.feesCents)), netPnlCents: net,
    positiveNetPnlCents: gains, absoluteNegativeNetPnlCents: losses,
    closedCaseNetPositiveShareBps: scaled(positive.length, closed.length, 10000),
    meanNetPnl: closed.length ? { numeratorCents: net, denominatorClosedCases: closed.length } : null,
    profitFactorMilli: scaled(gains, losses, 1000), netToTotalPlannedRiskMilli: scaled(net, sum(closed.map(r => r.input.plannedRiskCents)), 1000),
    lossBeyondPlannedRiskCount: closed.filter(r => r.input.netPnlCents < -r.input.plannedRiskCents).length,
    exitLiquidityDelayedCount: closed.filter(r => r.input.exitLiquidityDelayed).length,
    quoteGapObservedCount: closed.filter(r => r.input.quoteGapObserved).length,
    processViolationCount: closed.filter(r => r.input.planViolations.length > 0).length,
    candidateLessonOccurrenceCount: sum(cases.map(c => c.candidateLessonCodes.length)),
  };
}
function groups(cases: readonly OutcomeCase[]) {
  const buckets = new Map<string, OutcomeCase[]>();
  for (const c of cases) {
    const key = JSON.stringify([c.origin, c.symbol, c.strategyVersion, c.setupKey]);
    buckets.set(key, [...(buckets.get(key) ?? []), c]);
  }
  return [...buckets].sort(([a], [b]) => compare(a, b)).map(([, values]) => {
    const c = values[0]!;
    return { origin: c.origin, symbol: c.symbol, strategyVersion: c.strategyVersion, setupKey: c.setupKey, metrics: metrics(values) };
  });
}
function paperAudit(inputs: readonly OptionsPaperScenario[]) {
  const report = replayOptionsPaperAccount(inputs);
  const cases: OutcomeCase[] = report.trades.map(t => {
    const scenario = inputs.find(s => s.scenarioId === t.tradeId)!;
    return { id: t.tradeId, origin: t.origin, symbol: t.symbol, strategyVersion: scenario.plan.strategyVersion, setupKey: scenario.plan.setupKey,
      status: t.status, blockers: t.blockers, planFingerprint: t.planFingerprint, sourceFingerprint: readinessFingerprint(scenario), recordedAt: null,
      scenarioAsOf: scenario.asOf, review: t.review, candidateLessonCodes: t.review?.candidateLessons.map(l => l.code) ?? [] };
  });
  let equity = report.account.initialEquityCents, high = equity, drawdown = 0;
  for (const r of [...report.reviews].sort((a, b) => compare(a.input.exitAt, b.input.exitAt) || compare(a.input.tradeId, b.input.tradeId))) {
    equity = sum([equity, r.input.netPnlCents]); high = Math.max(high, equity); drawdown = Math.max(drawdown, high - equity);
  }
  return { basis: "SHARED_LOCAL_PAPER_ACCOUNT", sourceReportSha256: readinessFingerprint(report), metrics: metrics(cases), groups: groups(cases), cases,
    account: report.account, realizedClosedCurve: { initialEquityCents: report.account.initialEquityCents, finalEquityCents: equity, maxDrawdownCents: drawdown, includesOpenMarks: false },
    candidateNotebook: report.mistakeNotebook };
}
function historicalAudit(inputs: readonly HistoricalReplayRun[], checkedAt: string) {
  const report = buildHistoricalReplayReport(inputs);
  if (report.runs.some(r => r.recordedAt > checkedAt)) throw Error("OUTCOME_AUDIT_FUTURE_RECORDING");
  const cases: OutcomeCase[] = report.runs.map(r => ({ id: r.config.runId, origin: r.result.origin, symbol: r.result.symbol,
    strategyVersion: r.config.plan.strategyVersion, setupKey: r.config.plan.setupKey, status: r.result.status, blockers: r.result.blockers,
    planFingerprint: r.result.planFingerprint, sourceFingerprint: readinessFingerprint(inputs.find(i => i.config.runId === r.config.runId)), recordedAt: r.recordedAt,
    scenarioAsOf: null, review: r.review.closedTradeReview, candidateLessonCodes: r.review.candidateLessons.map(l => l.code) }));
  return { basis: report.accountAggregation, sourceReportSha256: readinessFingerprint(report), metrics: metrics(cases), groups: groups(cases), cases,
    realizedClosedCurve: null, candidateNotebook: report.mistakeNotebook };
}
function component<T, R>(history: ContextHistory<T>, constructedAt: string, audit: (inputs: T, checkedAt: string) => R) {
  if (!history || Object.keys(history).sort().join() !== ["checkedAt", "errorCode", "payload", "state"].join()) throw Error("OUTCOME_AUDIT_HISTORY_SHAPE");
  readinessClock(history.checkedAt);
  if (history.checkedAt > constructedAt) throw Error("OUTCOME_AUDIT_CLOCK_ORDER");
  if (history.state !== "AVAILABLE") {
    if (history.payload !== null || (history.state === "MISSING" ? history.errorCode !== "STORE_MISSING" : history.state !== "BLOCKED" || !["STORE_BUSY", "STORE_UNSAFE", "RECOVERY_FAILED"].includes(history.errorCode))) throw Error("OUTCOME_AUDIT_STORAGE_STATE");
    return { state: history.state, checkedAt: history.checkedAt, errorCode: history.errorCode, audit: null };
  }
  if (history.payload === null || history.errorCode !== null) throw Error("OUTCOME_AUDIT_STORAGE_STATE");
  try { return { state: "AVAILABLE" as const, checkedAt: history.checkedAt, errorCode: null, audit: audit(history.payload, history.checkedAt) }; }
  catch { return { state: "BLOCKED" as const, checkedAt: history.checkedAt, errorCode: "HISTORY_VALIDATION_FAILED", audit: null }; }
}

/** Descriptive process evidence, never a calibration or causal attribution engine. */
export function auditOptionsOutcomes(histories: OutcomeHistories, constructedAt: string) {
  readinessClock(constructedAt);
  if (!histories || Object.keys(histories).sort().join() !== "historical,paper") throw Error("OUTCOME_AUDIT_SHAPE");
  const components = { paper: component(histories.paper, constructedAt, paperAudit), historical: component(histories.historical, constructedAt, historicalAudit) };
  const payload = { version: "OPTIONS_OUTCOME_AUDIT_V1", constructedAt, components,
    blockedStores: Object.entries(components).filter(([, c]) => c.state === "BLOCKED").map(([id]) => id),
    missingStores: Object.entries(components).filter(([, c]) => c.state === "MISSING").map(([id]) => id),
    ratioRounding: "INTEGER_TRUNCATION_TOWARD_ZERO", performanceBasis: "CLOSED_CASES_ONLY_UNRESOLVED_CASES_RETAINED",
    winProbability: null, calibrated: false, marketValidated: false, executionAllowed: false, automaticStrategyChanges: false,
    limitations: ["Synthetic and unverified case ratios are descriptive, not trading probabilities or independent samples.",
      "Historical runs are independent hypothetical accounts; their PnL is not a compounded portfolio return.",
      "Fees and slippage are frozen modeled inputs, not verified executable costs.",
      "Realized paper drawdown excludes open marks; it is not the account's total exposure or worst possible loss.",
      "Candidate lessons and possible market causes require review; no success or failure cause is established automatically.",
      "Paper scenario clocks may be future hypothetical clocks. They are not brokerage executions or actual recording times."] };
  return freezePaper({ ...payload, artifactSha256: readinessFingerprint(payload) });
}
