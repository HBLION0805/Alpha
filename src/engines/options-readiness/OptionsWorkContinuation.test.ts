import { routeOptionsWorkContinuation as route, OPENING_START, OPENING_END } from "./OptionsWorkContinuation";
import { readinessFingerprint } from "./OptionsReadinessEngine";
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`Expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`); };
const ok = (value: unknown) => { if (!value) throw Error("Expected truthy"); };
function throws(work: () => unknown) { let caught = false; try { work(); } catch { caught = true; } ok(caught); }
let passed = 0; function test(name: string, work: () => void) { work(); passed++; console.log("PASS " + name); }
test("before opening guard normal wakes route bounded development", () => { const r = route("armed", "2026-09-07T19:00:00.000Z"); eq(r.action, "DEVELOPMENT"); eq(r.developmentStopAt, "2026-09-07T19:10:00.000Z"); eq(r.frozenQuoteTickDue, false); eq(r.marketContextRefreshDue, false); });
test("daily context occurs once in the first quarter-hour of nine New York", () => {
  for (const at of ["2026-09-07T13:00:00.000Z", "2026-09-07T13:14:59.999Z"]) eq(route("armed", at).action, "DAILY_CONTEXT");
  eq(route("armed", "2026-09-07T13:15:00.000Z").action, "DEVELOPMENT");
});
test("opening day context has priority before the quiet guard", () => { const r = route("armed", "2026-09-08T13:00:00.000Z"); eq(r.action, "DAILY_CONTEXT"); eq(r.developmentStopAt, null); });
test("opening day 09:15 to before 09:30 does not start code or sources", () => {
  for (const at of ["2026-09-08T13:15:00.000Z", "2026-09-08T13:29:59.999Z"]) { const r = route("armed", at); eq(r.action, "YIELD"); eq(r.frozenQuoteTickDue, false); eq(r.marketContextRefreshDue, false); }
});
test("opening tick starts at exact 09:30", () => { const r = route("armed", OPENING_START); eq(r.action, "COLLECT"); eq(r.frozenQuoteTickDue, true); eq(r.maximumNewWorkMinutes, 0); });
test("last millisecond in the window still routes the original tick", () => { eq(route("armed", "2026-09-08T13:49:59.999Z").action, "COLLECT"); });
test("exact window end restores v6 before opening any collection evidence", () => { const r = route("armed", OPENING_END); eq(r.action, "RESTORE_THEN_CLOSEOUT"); eq(r.restoreV6BeforeCollectionEvidence, true); eq(r.frozenQuoteTickDue, false); });
test("missed opening still restores before any late research or context", () => { eq(route("armed", "2026-09-09T13:00:00.000Z").action, "RESTORE_THEN_CLOSEOUT"); });
test("premature daily phase is blocked even at a context wake", () => { eq(route("daily", "2026-09-08T13:00:00.000Z").action, "PHASE_BLOCKED"); eq(route("daily", OPENING_START).action, "PHASE_BLOCKED"); });
test("post-window guard lasts until exact 10 New York", () => { eq(route("daily", OPENING_END).action, "YIELD"); eq(route("daily", "2026-09-08T13:59:59.999Z").action, "YIELD"); eq(route("daily", "2026-09-08T14:00:00.000Z").action, "DEVELOPMENT"); });
test("work fits before next daily source deadline or yields", () => {
  eq(route("daily", "2026-09-09T12:50:00.000Z").developmentStopAt, "2026-09-09T13:00:00.000Z");
  eq(route("daily", "2026-09-09T12:50:00.001Z").action, "YIELD"); eq(route("daily", "2026-09-09T12:59:59.999Z").action, "YIELD");
});
test("daily source routing follows New York daylight saving rather than fixed UTC", () => {
  eq(route("daily", "2026-11-02T14:00:00.000Z").action, "DAILY_CONTEXT"); eq(route("daily", "2026-11-02T13:00:00.000Z").action, "DEVELOPMENT");
  eq(route("daily", "2027-03-15T13:00:00.000Z").action, "DAILY_CONTEXT");
});
test("quarter-hour sequence contains one daily refresh and no repeated closeout", () => {
  const actions = [0, 15, 30, 45].map(m => route("daily", `2026-09-09T13:${String(m).padStart(2, "0")}:00.000Z`).action);
  eq(actions, ["DAILY_CONTEXT", "DEVELOPMENT", "DEVELOPMENT", "DEVELOPMENT"]);
});
test("routing results are immutable and contain no side-effect authority", () => {
  const r = route("armed", OPENING_START), { routeSha256, ...body } = r; eq(readinessFingerprint(body), routeSha256); ok(Object.isFrozen(r));
  for (const key of ["brokerAccountAllowed", "orderExecutionAllowed", "sourceCallExecuted", "schedulerUpdated"] as const) eq(r[key], false);
});
test("invalid phase and noncanonical date inputs fail closed", () => {
  for (const phase of [null, "collect", "ARMED", {}]) throws(() => route(phase, OPENING_START));
  for (const at of ["2026-09-08", "2026-02-30T13:00:00.000Z", "2026-09-08T13:30:00Z"]) throws(() => route("armed", at));
});
console.log(`${passed}/${passed} tests passed.`);
