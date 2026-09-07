import { canonicalizeDeterministicValue } from "../../contracts/DeterministicFingerprint";
import { observationClock, observationId, observationSha, reviewRobinhoodObservationStudy,
  type ObservationFrame, type ObservationPlan } from "./RobinhoodObservationEngine";

export const ROBINHOOD_CLOSEOUT_VERSION = "ROBINHOOD_COLLECTION_CLOSEOUT_V1";
type SourceTool = "get_option_quotes" | "get_equity_quotes";
type SourceError = "TOOL_FAILED" | "TOOL_UNAVAILABLE" | "RESPONSE_SHAPE_UNAVAILABLE";
export interface CollectionAttemptSummary {
  attemptId: string; attemptSha256: string; recordedAt: string;
  status: "FRAME_RECORDED" | "SOURCE_CALL_FAILED"; frameSha256: string | null;
  sourceCalls: { tool: SourceTool; requestedAt: string; receivedAt: string; errorCode: SourceError | null }[];
}
const hash = (value: unknown) => observationSha(canonicalizeDeterministicValue(value));
function fail(code: string): never { throw new Error("ROBINHOOD_CLOSEOUT_" + code); }
function exactKeys(value: unknown, allowed: string[]): void {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...allowed].sort().join()) fail("INPUT_SHAPE");
}
function sha(value: unknown): void { if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail("INPUT_HASH"); }
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const fraction = (count: number, total: number) => total ? Math.floor(count * 10000 / total) : null;
const isArray = (value: unknown): boolean => Array.isArray(value);

function validateAttempts(plan: ObservationPlan, frames: readonly ObservationFrame[], attempts: readonly CollectionAttemptSummary[], at: string) {
  if (!isArray(attempts) || attempts.length > 120) fail("ATTEMPT_LIMIT");
  const ids = new Set<string>(), hashes = new Set<string>(), linked = new Set<string>();
  const checked = attempts.map(attempt => {
    exactKeys(attempt, ["attemptId", "attemptSha256", "recordedAt", "status", "frameSha256", "sourceCalls"]);
    observationId(attempt.attemptId); sha(attempt.attemptSha256); observationClock(attempt.recordedAt);
    if (ids.has(attempt.attemptId) || hashes.has(attempt.attemptSha256)) fail("DUPLICATE_ATTEMPT");
    ids.add(attempt.attemptId); hashes.add(attempt.attemptSha256);
    if (attempt.recordedAt > at || attempt.recordedAt < plan.frozenAt) fail("ATTEMPT_CLOCK");
    if (!isArray(attempt.sourceCalls) || attempt.sourceCalls.length !== 2) fail("REQUEST_SCOPE");
    const tools = new Set<string>();
    for (const request of attempt.sourceCalls) {
      exactKeys(request, ["tool", "requestedAt", "receivedAt", "errorCode"]);
      if (!["get_option_quotes", "get_equity_quotes"].includes(request.tool) || tools.has(request.tool)) fail("REQUEST_SCOPE");
      tools.add(request.tool); observationClock(request.requestedAt); observationClock(request.receivedAt);
      if (request.requestedAt < plan.windowStartAt || request.requestedAt >= plan.windowEndAt || request.requestedAt <= plan.frozenAt ||
          request.receivedAt < request.requestedAt || request.receivedAt > attempt.recordedAt) fail("ATTEMPT_CLOCK");
      if (request.errorCode !== null && !["TOOL_FAILED", "TOOL_UNAVAILABLE", "RESPONSE_SHAPE_UNAVAILABLE"].includes(request.errorCode)) fail("SOURCE_ERROR_CODE");
    }
    const option = attempt.sourceCalls.find(r => r.tool === "get_option_quotes")!;
    const failed = attempt.sourceCalls.some(r => r.errorCode !== null);
    if (attempt.status !== (failed ? "SOURCE_CALL_FAILED" : "FRAME_RECORDED")) fail("ATTEMPT_STATUS");
    if (failed) { if (attempt.frameSha256 !== null) fail("FAILED_ATTEMPT_HAS_FRAME"); }
    else {
      sha(attempt.frameSha256);
      const frame = frames.find(f => f.frameSha256 === attempt.frameSha256);
      if (!frame || frame.captureId !== "auto-" + observationSha(plan.studyId + ":" + attempt.attemptId).slice(0, 40) ||
          frame.requestedAt !== option.requestedAt || frame.receivedAt !== option.receivedAt || frame.recordedAt > attempt.recordedAt ||
          linked.has(frame.frameSha256)) fail("ATTEMPT_FRAME_LINK");
      linked.add(frame.frameSha256);
    }
    return { ...attempt, sourceCalls: [...attempt.sourceCalls].sort((a, b) => a.tool.localeCompare(b.tool)), requestedAt: option.requestedAt };
  }).sort((a, b) => a.requestedAt.localeCompare(b.requestedAt) || a.attemptId.localeCompare(b.attemptId));
  for (let i = 1; i < checked.length; i++) {
    const previous = checked[i - 1]!, current = checked[i]!;
    const priorRequest = Math.max(...previous.sourceCalls.map(r => Date.parse(r.requestedAt)));
    if (current.recordedAt < previous.recordedAt || current.sourceCalls.some(r => Date.parse(r.requestedAt) - priorRequest < plan.cadenceMs)) fail("ATTEMPT_SEQUENCE");
  }
  return { checked, linked };
}

/** Coverage diagnostics only. Source authenticity, executable fills and strategy outcomes are never inferred. */
export function closeoutRobinhoodCollection(plan: ObservationPlan, frames: readonly ObservationFrame[], attempts: readonly CollectionAttemptSummary[], assessedAt: string) {
  const observationReview = reviewRobinhoodObservationStudy(plan, frames, assessedAt);
  const { checked, linked } = validateAttempts(plan, frames, attempts, assessedAt);
  const start = Date.parse(plan.windowStartAt), end = Date.parse(plan.windowEndAt), now = Date.parse(assessedAt);
  const slotCount = Math.ceil((end - start) / plan.cadenceMs);
  if (slotCount < 1 || slotCount > 120) fail("SLOT_LIMIT");
  const slots = Array.from({ length: slotCount }, (_, index) => {
    const from = start + index * plan.cadenceMs, to = Math.min(from + plan.cadenceMs, end);
    const inSlot = (time: string) => Date.parse(time) >= from && Date.parse(time) < to;
    const localAttempts = checked.filter(a => inSlot(a.requestedAt)), localFrames = frames.filter(f => inSlot(f.requestedAt));
    const byContract = plan.contracts.map(contract => ({ instrumentId: contract.id, symbol: contract.symbol,
      usableObservations: localFrames.reduce((n, f) => n + (f.observations.find(o => o.instrumentId === contract.id)?.diagnosticUsable ? 1 : 0), 0) }));
    const failed = localAttempts.filter(a => a.status === "SOURCE_CALL_FAILED");
    const unlinkedAutomatic = localFrames.filter(f => f.captureId.startsWith("auto-") && !linked.has(f.frameSha256));
    return { index, startAt: new Date(from).toISOString(), endAt: new Date(to).toISOString(),
      phase: now < from ? "FUTURE" as const : now < to ? "OPEN" as const : "ELAPSED" as const,
      automaticAttemptCount: localAttempts.length, sourceFailureCount: failed.length, frameCount: localFrames.length,
      manualFrameCount: localFrames.filter(f => !f.captureId.startsWith("auto-")).length,
      unlinkedAutomaticFrameCount: unlinkedAutomatic.length,
      hasRequestEvidence: localAttempts.length > 0 || localFrames.length > 0,
      allContractsUsable: byContract.every(c => c.usableObservations > 0), byContract,
      attemptSha256s: localAttempts.map(a => a.attemptSha256), frameSha256s: localFrames.map(f => f.frameSha256),
      sourceErrors: failed.flatMap(a => a.sourceCalls.filter(r => r.errorCode !== null).map(r => ({ attemptId: a.attemptId, tool: r.tool, errorCode: r.errorCode }))) };
  });
  const elapsed = slots.filter(s => s.phase === "ELAPSED");
  type Gap = { reason: string; startAt: string; endAt: string; slotCount: number };
  const gaps: Gap[] = [];
  for (const reason of ["NO_RECORDED_REQUEST", "NO_RECORDED_FRAME", "NO_COMPLETE_USABLE_CONTRACT_SET"]) {
    for (const slot of elapsed) {
      const missing = reason === "NO_RECORDED_REQUEST" ? !slot.hasRequestEvidence : reason === "NO_RECORDED_FRAME" ? slot.frameCount === 0 : !slot.allContractsUsable;
      if (!missing) continue;
      const last = gaps.at(-1);
      if (last?.reason === reason && last.endAt === slot.startAt) { last.endAt = slot.endAt; last.slotCount++; }
      else gaps.push({ reason, startAt: slot.startAt, endAt: slot.endAt, slotCount: 1 });
    }
  }
  const frequencies = new Map<string, number>();
  for (const frame of frames) for (const code of new Set([...frame.blockers, ...frame.observations.flatMap(o => o.blockers)])) frequencies.set(code, (frequencies.get(code) ?? 0) + 1);
  const failures = checked.filter(a => a.status === "SOURCE_CALL_FAILED");
  const unlinkedAutomaticFrames = frames.filter(f => f.captureId.startsWith("auto-") && !linked.has(f.frameSha256));
  const operationalLessons: { code: string; firstKnownAt: string; evidenceSha256s: string[]; status: "CANDIDATE_DATA_QUALITY_RULE"; tradeOutcome: null; strategyChangeAllowed: false }[] = [];
  const lesson = (code: string, at: string, refs: string[]) => operationalLessons.push({ code, firstKnownAt: at, evidenceSha256s: refs,
    status: "CANDIDATE_DATA_QUALITY_RULE", tradeOutcome: null, strategyChangeAllowed: false });
  if (failures.length) lesson("SOURCE_FAILURE_IS_NOT_MARKET_INACTIVITY", failures[0]!.recordedAt, failures.map(a => a.attemptSha256));
  if (elapsed.some(s => !s.hasRequestEvidence)) lesson("SCHEDULE_GAPS_CANNOT_BE_BACKFILLED_WITH_ASSUMED_QUOTES", assessedAt, [plan.planSha256]);
  if (unlinkedAutomaticFrames.length) lesson("AUTOMATIC_FRAME_NEEDS_ITS_ATTEMPT_RECORD", assessedAt, unlinkedAutomaticFrames.map(f => f.frameSha256));
  const completedCounts = { requestSlots: elapsed.filter(s => s.hasRequestEvidence).length,
    frameSlots: elapsed.filter(s => s.frameCount > 0).length, completeUsableSlots: elapsed.filter(s => s.allContractsUsable).length };
  const input = { planSha256: plan.planSha256, frameSha256s: frames.map(f => f.frameSha256), attemptSha256s: checked.map(a => a.attemptSha256) };
  const payload = { schemaVersion: "1.0", engineVersion: ROBINHOOD_CLOSEOUT_VERSION, studyId: plan.studyId, assessedAt,
    stage: now < start ? "WAITING_FOR_WINDOW" : now < end ? "WINDOW_IN_PROGRESS" : "WINDOW_ENDED",
    windowStartAt: plan.windowStartAt, windowEndAt: plan.windowEndAt, input, inputSha256: hash(input),
    declaredSlotCount: slotCount, elapsedSlotCount: elapsed.length, pendingSlotCount: slotCount - elapsed.length,
    completedCoverage: { ...completedCounts, requestCoverageBps: fraction(completedCounts.requestSlots, elapsed.length),
      frameCoverageBps: fraction(completedCounts.frameSlots, elapsed.length), completeUsableCoverageBps: fraction(completedCounts.completeUsableSlots, elapsed.length) },
    totals: { automaticAttempts: checked.length, sourceFailureAttempts: failures.length, savedFrames: frames.length,
      inWindowRequestedFrames: slots.reduce((n, s) => n + s.frameCount, 0), manualFrames: frames.filter(f => !f.captureId.startsWith("auto-")).length,
      unlinkedAutomaticFrames: unlinkedAutomaticFrames.length, diagnosticUsableObservations: observationReview.diagnosticUsableObservations },
    byContract: plan.contracts.map(contract => ({ instrumentId: contract.id, symbol: contract.symbol,
      completedUsableSlots: elapsed.filter(s => s.byContract.find(c => c.instrumentId === contract.id)!.usableObservations > 0).length,
      completedUsableCoverageBps: fraction(elapsed.filter(s => s.byContract.find(c => c.instrumentId === contract.id)!.usableObservations > 0).length, elapsed.length) })),
    slots, gaps, sourceBlockerCounts: [...frequencies].sort(([a], [b]) => a.localeCompare(b)).map(([code, frameCount]) => ({ code, frameCount })),
    operationalLessons, observationReview, hostSchedule: "NOT_INSPECTED", networkAccess: false, status: "NO_REPLAY", executionAllowed: false,
    tradeCount: 0, winProbability: null, strategyChangeAllowed: false,
    limitations: ["Slot coverage is not trading accuracy or source entitlement.", "No recorded request is missing evidence, not proof that a host never ran.",
      "Original quote-quality exclusions and unresolved execution semantics still apply.", "The offline command cannot verify the host scheduler or account state."] };
  return freeze({ ...payload, reportSha256: hash(payload) });
}
