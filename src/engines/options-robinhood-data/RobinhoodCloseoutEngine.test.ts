import { readFileSync } from "node:fs";
import { closeoutRobinhoodCollection as report, type CollectionAttemptSummary } from "./RobinhoodCloseoutEngine";
import { assessRobinhoodObservationFrame as assess, freezeRobinhoodObservationPlan, observationSha, type ObservationFrame } from "./RobinhoodObservationEngine";

const source = readFileSync("fixtures/options-robinhood-data/capture.synthetic.json", "utf8");
const config = readFileSync("fixtures/options-robinhood-data/observation-plan.synthetic.json", "utf8");
const plan = freezeRobinhoodObservationPlan(config, source, "2026-09-04T14:00:10.000Z");
const time = (slot: number, seconds = 0) => new Date(Date.parse(plan.windowStartAt) + slot * 60000 + seconds * 1000).toISOString();
const end = plan.windowEndAt;
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`Expected ${JSON.stringify(b)}; received ${JSON.stringify(a)}`); };
const ok = (v: unknown) => { if (!v) throw Error("Expected truthy value"); };
function throws(work: () => unknown, code: string) { let caught; try { work(); } catch (e) { caught = e; } if (!(caught instanceof Error) || !caught.message.includes(code)) throw Error("Expected " + code); }
let passed = 0;
function test(name: string, work: () => void) { work(); passed++; console.log(`PASS ${name}`); }
function frame(index = 0, previous: ObservationFrame[] = [], automatic = false, change: (v: any) => void = () => {}, recordedAt = time(index, 2)): ObservationFrame {
  const value = JSON.parse(source), attemptId = "attempt-" + index;
  value.captureId = automatic ? "auto-" + observationSha(plan.studyId + ":" + attemptId).slice(0, 40) : "manual-" + index;
  value.calls = value.calls.filter((c: any) => c.tool !== "get_option_historicals");
  for (const c of value.calls.filter((c: any) => ["get_option_quotes", "get_equity_quotes"].includes(c.tool))) {
    c.requestedAt = time(index); c.receivedAt = time(index, 1);
    if (c.tool === "get_option_quotes") { c.data.results[0].quote.updated_at = time(index); c.data.results[0].quote.bid_price = "0.18"; c.data.results[0].quote.ask_price = "0.20"; }
    else { c.data.results[0].quote.venue_bid_time = time(index); c.data.results[0].quote.venue_ask_time = time(index); }
  }
  change(value);
  return assess(plan, JSON.stringify(value), recordedAt, previous);
}
function attempt(index = 0, linked: ObservationFrame | null = null): CollectionAttemptSummary {
  return { attemptId: "attempt-" + index, attemptSha256: observationSha("attempt-" + index), recordedAt: time(index, 3),
    status: linked ? "FRAME_RECORDED" : "SOURCE_CALL_FAILED", frameSha256: linked?.frameSha256 ?? null,
    sourceCalls: [{ tool: "get_option_quotes", requestedAt: time(index), receivedAt: time(index, 1), errorCode: linked ? null : "TOOL_FAILED" },
      { tool: "get_equity_quotes", requestedAt: time(index), receivedAt: time(index, 1), errorCode: null }] };
}

test("before the window all slots are pending with null coverage and no invented gaps", () => {
  const r = report(plan, [], [], plan.frozenAt); eq(r.declaredSlotCount, 10); eq(r.elapsedSlotCount, 0); eq(r.completedCoverage.requestCoverageBps, null); eq(r.gaps, []); eq(r.operationalLessons, []);
});
test("an open slot is not prematurely counted as missing", () => {
  const r = report(plan, [], [], time(0, 59)); eq(r.slots[0]!.phase, "OPEN"); eq(r.elapsedSlotCount, 0); eq(r.gaps, []);
});
test("half-open boundaries assign a request exactly at the next slot start", () => {
  const f = frame(1), r = report(plan, [f], [], time(2)); eq(r.slots[0]!.frameCount, 0); eq(r.slots[1]!.frameCount, 1); eq(r.elapsedSlotCount, 2);
});
test("a fully missed window records coverage gaps rather than source failure or a trade", () => {
  const r = report(plan, [], [], end); eq(r.completedCoverage.requestCoverageBps, 0); eq(r.totals.sourceFailureAttempts, 0); eq(r.gaps[0]!.slotCount, 10);
  eq(r.operationalLessons[0]!.firstKnownAt, end); eq(r.tradeCount, 0); eq(r.winProbability, null);
});
test("a failed source call is request evidence without a fabricated frame", () => {
  const r = report(plan, [], [attempt()], time(1)); eq(r.completedCoverage.requestCoverageBps, 10000); eq(r.completedCoverage.frameCoverageBps, 0);
  eq(r.totals.sourceFailureAttempts, 1); eq(r.slots[0]!.sourceErrors[0]!.errorCode, "TOOL_FAILED"); eq(r.operationalLessons[0]!.firstKnownAt, time(0, 3));
});
test("mixed failed and successful attempts retain each outcome", () => {
  const f = frame(1, [], true), r = report(plan, [f], [attempt(1, f), attempt()], time(2)); eq(r.totals.automaticAttempts, 2); eq(r.totals.sourceFailureAttempts, 1);
  eq(r.completedCoverage.frameCoverageBps, 5000); eq(r.totals.unlinkedAutomaticFrames, 0);
});
test("manual frames are distinct from automatic attempt completion", () => {
  const f = frame(), r = report(plan, [f], [], time(1)); eq(r.totals.manualFrames, 1); eq(r.totals.automaticAttempts, 0); eq(r.completedCoverage.completeUsableCoverageBps, 10000);
  eq(r.status, "NO_REPLAY"); eq(r.observationReview.status, "NO_REPLAY"); eq(r.executionAllowed, false);
});
test("an automatic frame without its attempt retains an explicit recording gap", () => {
  const f = frame(0, [], true), r = report(plan, [f], [], time(1)); eq(r.totals.unlinkedAutomaticFrames, 1); eq(r.operationalLessons[0]!.code, "AUTOMATIC_FRAME_NEEDS_ITS_ATTEMPT_RECORD");
});
test("recorded stale quotes do not become usable coverage", () => {
  const f = frame(0, [], false, v => { v.calls[2].data.results[0].quote.updated_at = "2026-09-04T13:30:00.000Z"; });
  const r = report(plan, [f], [], time(1)); eq(r.completedCoverage.frameCoverageBps, 10000); eq(r.completedCoverage.completeUsableCoverageBps, 0); ok(r.sourceBlockerCounts.some(v => v.code.includes("STALE")));
});

test("budget exclusions retain successful collection coverage without becoming source failures", () => {
  const f = frame(0, [], true, v => {
    const quote = v.calls.find((c: any) => c.tool === "get_option_quotes").data.results[0].quote;
    quote.bid_price = "0.98"; quote.ask_price = "1.00";
  });
  const r = report(plan, [f], [attempt(0, f)], time(1));
  eq(r.totals.automaticAttempts, 1); eq(r.totals.sourceFailureAttempts, 0); eq(r.totals.savedFrames, 1);
  eq(r.completedCoverage.requestCoverageBps, 10000); eq(r.completedCoverage.frameCoverageBps, 10000);
  eq(r.completedCoverage.completeUsableCoverageBps, 0);
  eq(r.sourceBlockerCounts.map(v => v.code), ["PREMIUM_ALONE_EXCEEDS_ALLOCATION", "PREMIUM_ALONE_EXCEEDS_STRESS_CAP"]);
  eq(r.gaps.map(g => g.reason), ["NO_COMPLETE_USABLE_CONTRACT_SET"]);
  eq(r.slots[0]!.sourceErrors, []); eq(r.operationalLessons, []); eq(r.tradeCount, 0); eq(r.winProbability, null);
});
test("repeated source clocks do not add usable slot coverage", () => {
  const a = frame(), b = frame(1, [a], false, v => { v.calls[2].data.results[0].quote.updated_at = time(0); });
  const r = report(plan, [a, b], [], time(2)); eq(r.completedCoverage.completeUsableCoverageBps, 5000); ok(r.sourceBlockerCounts.some(v => v.code === "REPEATED_SOURCE_OBSERVATION"));
});
test("gaps merge adjacent missing slots and stop across observed data", () => {
  const f = frame(2), r = report(plan, [f], [], time(5));
  eq(r.gaps.filter(g => g.reason === "NO_RECORDED_REQUEST").map(g => g.slotCount), [2, 2]);
});
test("full diagnostic sample coverage still cannot qualify a replay", () => {
  const frames: ObservationFrame[] = []; for (let i = 0; i < 10; i++) frames.push(frame(i, frames));
  const r = report(plan, frames, [], end); eq(r.completedCoverage.completeUsableCoverageBps, 10000); eq(r.gaps, []); eq(r.status, "NO_REPLAY"); eq(r.strategyChangeAllowed, false); eq(r.hostSchedule, "NOT_INSPECTED");
});
test("late replies retain a recorded request slot while failing its quality checks", () => {
  const f = frame(9, [], false, v => { for (const c of v.calls.filter((c: any) => c.tool.endsWith('_quotes'))) c.receivedAt = time(10, 1); }, time(10, 2));
  const r = report(plan, [f], [], time(10, 3)); eq(r.slots[9]!.frameCount, 1); eq(r.slots[9]!.allContractsUsable, false);
  ok(r.sourceBlockerCounts.some(c => c.code === "OUTSIDE_DECLARED_WINDOW"));
});
test("off-window smoke frames do not fill the prospective request grid", () => {
  const f = frame(-0.5, [], false, v => { v.captureId = 'off-window-smoke'; });
  const r = report(plan, [f], [], end); eq(r.totals.savedFrames, 1); eq(r.totals.inWindowRequestedFrames, 0); eq(r.completedCoverage.frameCoverageBps, 0);
});
test("one usable contract cannot hide a missing contract in the same slot", () => {
  const multi = JSON.parse(source), secondId = '00000000-0000-4000-8000-000000000003';
  multi.calls[1].data.instruments.push({ ...multi.calls[1].data.instruments[0], id: secondId, type: 'put' });
  multi.calls[2].args.instrument_ids.push(secondId);
  const extra = structuredClone(multi.calls[2].data.results[0]); extra.quote.instrument_id = secondId; extra.close.instrument_id = secondId;
  multi.calls[2].data.results.push(extra);
  const selection = JSON.parse(config); selection.instrumentIds.push(secondId);
  const selected = freezeRobinhoodObservationPlan(JSON.stringify(selection), JSON.stringify(multi), plan.frozenAt);
  multi.captureId = 'partial-contract-set'; multi.calls = multi.calls.filter((c: any) => c.tool !== 'get_option_historicals');
  for (const c of multi.calls.filter((c: any) => c.tool.endsWith('_quotes'))) {
    c.requestedAt = time(0); c.receivedAt = time(0, 1);
    if (c.tool === 'get_option_quotes') { c.data.results = [c.data.results[0]]; Object.assign(c.data.results[0].quote, { updated_at: time(0), bid_price: '0.18', ask_price: '0.20' }); }
    else Object.assign(c.data.results[0].quote, { venue_bid_time: time(0), venue_ask_time: time(0) });
  }
  const f = assess(selected, JSON.stringify(multi), time(0, 2), []), r = report(selected, [f], [], time(1));
  eq(r.byContract.map(c => c.completedUsableCoverageBps), [10000, 0]); eq(r.completedCoverage.completeUsableCoverageBps, 0);
});
test("future attempt receipts and recording clocks fail", () => {
  const a = attempt(); a.recordedAt = time(1); throws(() => report(plan, [], [a], time(0, 5)), "ATTEMPT_CLOCK");
});
test("an out-of-window attempt cannot enter coverage", () => {
  const a = attempt(); a.sourceCalls[0]!.requestedAt = plan.frozenAt; throws(() => report(plan, [], [a], time(1)), "ATTEMPT_CLOCK");
});
test("unknown tools and provider error bodies are rejected", () => {
  const a = attempt(); (a.sourceCalls[0] as any).tool = "get_account"; throws(() => report(plan, [], [a], time(1)), "REQUEST_SCOPE");
  const b = attempt(); (b.sourceCalls[0] as any).errorBody = "private"; throws(() => report(plan, [], [b], time(1)), "INPUT_SHAPE");
});
test("duplicate attempt ids or hashes cannot inflate coverage", () => {
  const a = attempt(); throws(() => report(plan, [], [a, a], time(1)), "DUPLICATE_ATTEMPT");
  const b = attempt(1); b.attemptSha256 = a.attemptSha256; throws(() => report(plan, [], [a, b], time(2)), "DUPLICATE_ATTEMPT");
});
test("success claims need the exact linked automatic frame", () => {
  const f = frame(), a = attempt(0, f); throws(() => report(plan, [f], [a], time(1)), "ATTEMPT_FRAME_LINK");
});
test("a failed request cannot claim a frame or successful status", () => {
  const a = attempt(); a.frameSha256 = observationSha("fabricated"); throws(() => report(plan, [], [a], time(1)), "FAILED_ATTEMPT_HAS_FRAME");
  const b = attempt(); b.status = "FRAME_RECORDED"; throws(() => report(plan, [], [b], time(1)), "ATTEMPT_STATUS");
});
test("attempt sequence validates both source request clocks and recording order", () => {
  const a = attempt(), b = attempt(1); b.sourceCalls[1]!.requestedAt = time(0, 59); throws(() => report(plan, [], [a, b], time(2)), "ATTEMPT_SEQUENCE");
});
test("input fingerprints are deterministic across attempt directory ordering", () => {
  const a = attempt(), b = attempt(1); const x = report(plan, [], [a, b], time(2)), y = report(plan, [], [b, a], time(2)); eq(x, y); ok(Object.isFrozen(x.slots));
});
console.log(`${passed}/${passed} tests passed.`);
