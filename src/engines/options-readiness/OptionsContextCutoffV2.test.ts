import { readFileSync } from "node:fs";
import { reconstructOptionsContextV2 as reconstruct, type ContextCutoffHistoriesV2 } from "./OptionsContextCutoffV2";
import { reconstructOptionsContext, type ContextHistory } from "./OptionsContextCutoff";
import { readinessFingerprint } from "./OptionsReadinessEngine";
import { FOMC_CALENDAR_URL, type FomcCalendarInput } from "../options-fomc-calendar/FomcCalendarEngine";

const early = "2026-09-07T04:00:00.000Z", cutoff = "2026-09-07T04:30:00.000Z", later = "2026-09-07T05:00:00.000Z";
const checked = "2026-09-07T06:00:00.000Z", finish = "2026-09-07T07:00:00.000Z";
const html = readFileSync("fixtures/options-fomc-calendar/calendar.synthetic.html", "utf8");
const available = <T>(payload: T, checkedAt = checked): ContextHistory<T> => ({ state: "AVAILABLE", checkedAt, payload, errorCode: null });
const input = (receivedAt = early, sourceText = html): FomcCalendarInput => ({ requestedAt: receivedAt, receivedAt, sourceText, url: FOMC_CALENDAR_URL, errorCode: null });
const failure = (receivedAt: string): FomcCalendarInput => ({ ...input(receivedAt), sourceText: null, errorCode: "NETWORK_FAILED" });
function histories(inputs: readonly FomcCalendarInput[] = [input()]): ContextCutoffHistoriesV2 {
  return { headlines: available({ observations: [], health: [] }), treasury: available([]), btc: available([]), blsCalendar: available([]), fomcCalendar: available(inputs) };
}
const run = (h = histories(), at = cutoff, end = checked) => reconstruct(h, at, end);
const fomc = (h = histories()) => run(h).context.components.fomcCalendar;
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`Expected ${JSON.stringify(b)}; received ${JSON.stringify(a)}`); };
const ok = (value: unknown) => { if (!value) throw Error("Expected truthy value"); };
function throws(work: () => unknown, code: string) { let caught; try { work(); } catch (error) { caught = error; } if (!(caught instanceof Error) || !caught.message.includes(code)) throw Error("Expected " + code); }
let passed = 0;
function test(name: string, work: () => void) { work(); passed++; console.log(`PASS ${name}`); }

test("v2 preserves all four v1 components and binds the original context hash", () => {
  const h = histories(), { fomcCalendar: _fomc, ...original } = h, a = reconstructOptionsContext(original, cutoff, checked), b = run(h);
  eq(b.context.baseContextSha256, a.contextSha256);
  const { fomcCalendar: _component, ...components } = b.context.components; eq(components, a.context.components);
  eq(b.context.version, "OPTIONS_JOURNAL_CONTEXT_CUTOFF_V2"); ok(b.contextSha256 !== a.contextSha256);
});
test("equal receipt is included and one millisecond later is excluded", () => {
  const r = fomc(histories([input(cutoff), input("2026-09-07T04:30:00.001Z")]));
  eq(r.report!.retrievalCount, 1); eq(r.report!.latestRetrieval!.receivedAt, cutoff);
  eq(r.selectedPrefixSha256, readinessFingerprint([input(cutoff)])); eq(r.reportSha256, readinessFingerprint(r.report));
});
test("earlier request and page update date cannot backdate later receipt", () => {
  const r = fomc(histories([{ ...input(later), requestedAt: early }]));
  eq(r.state, "AVAILABLE"); eq(r.report!.retrievalCount, 0); eq(r.report!.latestRetrieval, null); eq(r.report!.upcoming, []);
});
test("date-only calendar never acquires an intraday release or confirmation", () => {
  const r = fomc().report!, c = r.latestRetrieval!.calendar!;
  eq(c.pageUpdatedDate, "2026-08-19"); eq(c.intradayTimesKnown, false); eq(c.originalPublicationTimesKnown, false);
  const meeting = r.upcoming[0]!; eq(meeting.startDate, "2026-09-15"); eq(meeting.endDate, "2026-09-16");
  eq(meeting.confirmationStatus, "NOT_INDEPENDENTLY_VERIFIED"); eq(r.tradingRiskWindow, null);
});
test("a failure at cutoff remains latest and does not promote old dates", () => {
  const r = fomc(histories([input(), failure(cutoff)])).report!;
  eq(r.latestRetrieval!.status, "FAILED"); eq(r.upcoming, []); eq(r.lastKnownSchedule!.fromLatestRetrieval, false);
});
test("later failures and valid corrections cannot change the earlier context", () => {
  const a = run(), b = run(histories([input(), input(later, html.replace("15-16*", "16-17*")), failure(checked)]), cutoff, finish);
  eq(a.contextSha256, b.contextSha256); ok(a.artifactSha256 !== b.artifactSha256);
});
test("A to B to A and equal-clock changes retain receipt order", () => {
  const r = fomc(histories([input(), input(cutoff, html.replace("15-16*", "15-16")), input(cutoff)])).report!;
  eq(r.retrievalCount, 3); eq(r.comparison.changed.length, 1);
  eq(r.comparison.changed[0]!.before.projectionMarker, false); eq(r.comparison.changed[0]!.after.projectionMarker, true);
  eq(r.comparison.changed[0]!.observedAt, cutoff);
});
test("a disappeared date key is never interpreted as a cancellation", () => {
  const r = fomc(histories([input(), input(cutoff, html.replace("15-16*", "16-17*"))])).report!;
  eq(r.comparison.absentDateKeys.length, 1); eq(r.comparison.absenceMeansCancellation, false); eq(r.comparison.dateKeyChangesProveRescheduling, false);
});
test("invalid future history blocks only FOMC and hides raw input", () => {
  const r = run(histories([input(), { ...input(later), url: "https://PRIVATE.invalid" }]));
  eq(r.blockedStores, ["fomcCalendar"]); eq(r.context.components.fomcCalendar.errorCode, "HISTORY_VALIDATION_FAILED");
  eq(r.context.components.treasury.state, "AVAILABLE"); ok(!JSON.stringify(r).includes("PRIVATE"));
});
test("future receipt beyond recovery time and oversized histories fail visibly", () => {
  for (const records of [[input(finish)], Array.from({ length: 367 }, () => input())])
    eq(fomc(histories(records)).errorCode, "HISTORY_VALIDATION_FAILED");
});
test("missing and failed stores differ from an available empty prefix", () => {
  const h = histories(); h.fomcCalendar = { state: "MISSING", checkedAt: checked, payload: null, errorCode: "STORE_MISSING" };
  eq(run(h).missingStores, ["fomcCalendar"]); eq(fomc(h).report, null);
  for (const errorCode of ["STORE_BUSY", "STORE_UNSAFE", "RECOVERY_FAILED"] as const) {
    h.fomcCalendar = { state: "BLOCKED", checkedAt: checked, payload: null, errorCode }; eq(fomc(h).errorCode, errorCode);
  }
  eq(fomc(histories([])).report!.retrievalCount, 0); eq(fomc(histories([])).state, "AVAILABLE");
});
test("construction and check clocks change artifact hash only", () => {
  const a = run(), h = histories(); h.fomcCalendar = available([input()], finish);
  const b = run(h, cutoff, finish); eq(a.contextSha256, b.contextSha256); ok(a.artifactSha256 !== b.artifactSha256);
});
test("the fifth check cannot precede the fourth or exceed construction", () => {
  for (const at of [early, cutoff, later, finish]) { const h = histories(); h.fomcCalendar = available([], at); throws(() => run(h), "CHECK_CLOCK_ORDER"); }
  throws(() => run(histories(), finish), "FUTURE_CUTOFF");
});
test("ambiguous fifth-source shapes and storage states are rejected", () => {
  throws(() => run({ ...histories(), extra: true } as ContextCutoffHistoriesV2), "SHAPE");
  for (const patch of [{ extra: true }, { payload: null }, { errorCode: "STORE_BUSY" }, { state: "MISSING", payload: null, errorCode: "RECOVERY_FAILED" }]) {
    const h = histories(); h.fomcCalendar = { ...h.fomcCalendar, ...patch } as ContextCutoffHistoriesV2["fomcCalendar"];
    throws(() => run(h), patch.extra ? "SHAPE" : "STORAGE_STATE");
  }
});
test("v2 stays deterministic immutable read-only context without replay permission", () => {
  const h = histories(), before = JSON.stringify(h), r = run(h); eq(run(h), r); eq(JSON.stringify(h), before);
  const { artifactSha256, ...body } = r; eq(artifactSha256, readinessFingerprint(body)); eq(r.contextSha256, readinessFingerprint(r.context));
  ok(Object.isFrozen(r.context.components.fomcCalendar.report!.upcoming));
  eq(r.context.historicalDecisionProven, false); eq(r.context.journalAppendTimesKnown, false); eq(r.context.winProbability, null);
  eq(r.context.replayAllowed, false); eq(r.executionAllowed, false); eq(r.networkAccess, false); eq(r.sourceAppends, 0);
});
console.log(`${passed}/${passed} tests passed.`);
