import { readFileSync } from "node:fs";
import { deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import { assessRobinhoodObservationFrame as frame, freezeRobinhoodObservationPlan as prepare, reviewRobinhoodObservationStudy as review, screenRobinhoodCaptures as screen } from "./RobinhoodObservationEngine";

const source = readFileSync("fixtures/options-robinhood-data/capture.synthetic.json", "utf8");
const config = readFileSync("fixtures/options-robinhood-data/observation-plan.synthetic.json", "utf8");
const freezeAt = "2026-09-04T14:00:10.000Z", at = "2026-09-04T14:01:03.000Z";
const plan = () => prepare(config, source, freezeAt);
const equal = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}; received ${JSON.stringify(a)}`); };
function ok(v: unknown) { if (!v) throw new Error("Expected truthy value"); }
function throws(work: () => unknown, code: string) { let caught: unknown; try { work(); } catch (e) { caught = e; } if (!(caught instanceof Error) || !caught.message.includes(code)) throw new Error("Expected rejection: " + code); }
let passed = 0;
function test(name: string, work: () => void) { work(); passed++; console.log(`PASS ${name}`); }
function capture(index = 0) {
  const v = JSON.parse(source);
  v.captureId = `frame-${index}`;
  v.calls = v.calls.filter((c: { tool: string }) => c.tool !== "get_option_historicals");
  for (const c of v.calls.filter((c: { tool: string }) => c.tool === "get_option_quotes" || c.tool === "get_equity_quotes")) {
    c.requestedAt = new Date(Date.parse("2026-09-04T14:01:00.000Z") + index * 60000).toISOString();
    c.receivedAt = new Date(Date.parse(c.requestedAt) + 1000).toISOString();
    const q = c.data.results[0].quote;
    if (c.tool === "get_option_quotes") { q.updated_at = c.requestedAt.replace(".000Z", ".000123456Z"); q.ask_price = "0.20"; q.bid_price = "0.18"; }
    else { q.venue_bid_time = c.requestedAt; q.venue_ask_time = c.requestedAt; }
  }
  return v;
}
const option = (v: ReturnType<typeof capture>) => v.calls.find((c: { tool: string }) => c.tool === "get_option_quotes");
const equity = (v: ReturnType<typeof capture>) => v.calls.find((c: { tool: string }) => c.tool === "get_equity_quotes");
const quote = (v: ReturnType<typeof capture>) => option(v).data.results[0].quote;
function run(change: (v: ReturnType<typeof capture>) => void = () => {}) { const v = capture(); change(v); return frame(plan(), JSON.stringify(v), at, []); }
const rejected = (change: (v: ReturnType<typeof capture>) => void, code: string) => throws(() => run(change), code);

test("screen preserves costs unknown, normal limits and model-probability isolation", () => {
  const r = screen([source], freezeAt), c = r.candidates[0]!;
  equal(c.costHeadroomCents, { allocation: 2500, fullPremiumStress: 0, plannedRisk: 0 });
  equal(r.winProbability, null); equal(r.sizeEscalationAllowed, false); equal(c.eligibleForTrading, false);
  equal(r.chainCoverageComplete, false); equal(c.calendarDte, 21); ok(c.blockers.includes("COSTS_UNKNOWN"));
});
test("low premiums can still leave less than a tick before the stop", () => {
  const v = JSON.parse(source); v.calls[2].data.results[0].quote.bid_price = "0.01";
  ok(screen([JSON.stringify(v)], freezeAt).candidates[0]!.blockers.includes("SPREAD_LEAVES_LESS_THAN_ONE_TICK_BEFORE_STOP"));
});
test("latest sample retains missing-contract visibility and no full-chain claim", () => {
  const v = JSON.parse(source); v.calls[2].data.results = [];
  const r = screen([JSON.stringify(v)], freezeAt); equal(r.contractCount, 1); equal(r.candidates[0]!.quote, null); equal(r.candidates[0]!.costHeadroomCents, null);
});
test("an expired capture remains a visible blocked candidate", () => {
  const r = screen([source], "2026-10-01T14:00:00.000Z"); ok(r.candidates[0]!.blockers.includes("OUTSIDE_14_TO_45_CALENDAR_DTE"));
});
test("a missing latest response cannot silently reuse an older valid quote", () => {
  const v = capture(); option(v).data.results = [];
  const c = screen([source, JSON.stringify(v)], at).candidates[0]!;
  equal(c.quote, null); equal(c.captureId, "frame-0"); ok(c.blockers.includes("MISSING_OPTION_QUOTE"));
});
test("screen date uses New York rather than UTC midnight", () => {
  const r = screen([source], "2026-09-05T01:00:00.000Z"); equal(r.assessmentDate, "2026-09-04"); equal(r.candidates[0]!.calendarDte, 21);
});
test("over-budget premium cannot be hidden by a low modeled expiry-profit probability", () => {
  const v = JSON.parse(source); v.calls[2].data.results[0].quote.ask_price = "1.00";
  const c = screen([JSON.stringify(v)], freezeAt).candidates[0]!;
  equal(c.premiumWithinAllocationLowerBound, false); equal(c.premiumWithinStressLowerBound, false); ok(c.blockers.includes("PREMIUM_STOP_ALONE_EXCEEDS_PLANNED_RISK"));
});
test("screen uses latest receipt independent of input order", () => {
  const v = capture(), a = screen([source, JSON.stringify(v)], at), b = screen([JSON.stringify(v), source], at);
  equal(a.candidates, b.candidates); equal(a.candidates[0]!.quote!.askPerUnitCents, 20);
});
test("conflicting same-receipt quotes and duplicate capture IDs fail", () => {
  const a = capture(), b = capture(); b.captureId = "other"; quote(b).bid_price = "0.17";
  throws(() => screen([JSON.stringify(a), JSON.stringify(b)], at), "CONFLICTING_QUOTE_RECEIPT");
  throws(() => screen([source, source], freezeAt), "DUPLICATE_CAPTURE_ID");
});
test("sample source and contract bounds are enforced", () => {
  throws(() => screen([], at), "SCREEN_CAPTURE_LIMIT"); throws(() => screen(Array(17).fill(source), at), "SCREEN_CAPTURE_LIMIT");
  const v = capture(); v.calls[0].args.underlying_symbol = "AAPL";
  throws(() => screen([JSON.stringify(v)], at), "SYMBOL_OUTSIDE_SCOPE");
});
test("freeze retains source hash and refuses mutable or oversized config", () => {
  const p = plan(); equal(p.frozenAt, freezeAt); equal(p.executionAllowed, false); ok(Object.isFrozen(p.contracts));
  const v = JSON.parse(config); v.riskBudget = 999; throws(() => prepare(JSON.stringify(v), source, freezeAt), "UNEXPECTED_FIELD");
  throws(() => prepare(" ".repeat(16385), source, freezeAt), "CONFIG_LIMIT");
});
test("freeze must precede the future window and follow source receipts", () => {
  throws(() => prepare(config, source, "2026-09-04T14:01:00.000Z"), "PROSPECTIVE_WINDOW");
  throws(() => prepare(config, source, "2026-09-04T13:59:00.000Z"), "CAPTURE_CHRONOLOGY");
});
test("calendar fingerprints and eligible window cannot be invented by changing one field", () => {
  const v = JSON.parse(config); v.calendar.marketOpen = "2026-09-04T15:00:00.000Z";
  throws(() => prepare(JSON.stringify(v), source, freezeAt), "CALENDAR_DECLARATION");
  const { calendarEvidenceFingerprint: ignored, ...body } = v.calendar;
  v.calendar.calendarEvidenceFingerprint = deterministicFingerprint(body);
  throws(() => prepare(JSON.stringify(v), source, freezeAt), "REGULAR_SESSION_WINDOW");
});
test("holiday and out-of-session windows fail despite coherent declaration hashes", () => {
  const v = JSON.parse(config); v.calendar.status = "MARKET_HOLIDAY";
  const { calendarEvidenceFingerprint: ignored, ...body } = v.calendar; v.calendar.calendarEvidenceFingerprint = deterministicFingerprint(body);
  throws(() => prepare(JSON.stringify(v), source, freezeAt), "REGULAR_SESSION_WINDOW");
});
test("selection identities and observation horizon are bounded", () => {
  const v = JSON.parse(config); v.instrumentIds = ["11111111-1111-4111-8111-111111111111"];
  throws(() => prepare(JSON.stringify(v), source, freezeAt), "SELECTED_CONTRACT_NOT_LINKED");
  v.instrumentIds = []; throws(() => prepare(JSON.stringify(v), source, freezeAt), "SELECTED_CONTRACTS");
  const long = JSON.parse(config); long.windowEndAt = "2026-09-04T17:01:00.000Z";
  throws(() => prepare(JSON.stringify(long), source, freezeAt), "PROSPECTIVE_WINDOW");
});
test("fresh aligned prospective observations pass diagnostics only", () => {
  const f = run(); equal(f.status, "DIAGNOSTICS_PASSED_ONLY"); equal(f.observations[0]!.diagnosticUsable, true);
  equal(f.tradeCount, 0); equal(f.executionAllowed, false); equal(f.originalCaptureAssessment.status, "NO_REPLAY");
  equal(f.observations[0]!.sourceQuoteAt, "2026-09-04T14:01:00.000123456Z");
});
test("recording old captures cannot backdate the observation plan", () => {
  throws(() => frame(plan(), source, at, []), "FRAME_QUOTE_CALL_SCOPE");
  rejected(v => { option(v).requestedAt = "2026-09-04T14:00:09.000Z"; }, "REQUEST_PREDATES_FREEZE");
});
test("a pre-window actual read is retained as a diagnostic failure", () => {
  const f = run(v => { option(v).requestedAt = "2026-09-04T14:00:30.000Z"; });
  ok(f.blockers.includes("OUTSIDE_DECLARED_WINDOW")); equal(f.observations[0]!.diagnosticUsable, false);
});
test("source quotes outside the window are not fresh prospective evidence", () => {
  const f = run(v => { quote(v).updated_at = "2026-09-04T13:59:00.000Z"; });
  ok(f.observations[0]!.blockers.includes("SOURCE_OUTSIDE_DECLARED_WINDOW")); ok(f.observations[0]!.blockers.includes("STALE_ON_RECEIPT"));
});
test("future and unknown source clocks cannot count", () => {
  ok(run(v => { quote(v).updated_at = "2026-09-04T14:01:02Z"; }).observations[0]!.blockers.includes("QUOTE_CLOCK_IN_FUTURE"));
  ok(run(v => { quote(v).updated_at = null; }).observations[0]!.blockers.includes("QUOTE_CLOCK_UNKNOWN"));
});
test("missing quote results stay as explicit selected-contract observations", () => {
  const f = run(v => { option(v).data.results = []; }); equal(f.observations.length, 1); ok(f.observations[0]!.blockers.includes("MISSING_OPTION_QUOTE"));
});
test("missing and zero sizes cannot be replaced by high volume", () => {
  ok(run(v => { quote(v).bid_size = null; quote(v).volume = 999999; }).observations[0]!.blockers.includes("SIZE_UNKNOWN"));
  ok(run(v => { quote(v).ask_size = 0; }).observations[0]!.blockers.includes("ZERO_DISPLAYED_SIZE"));
});
test("underlying must be present with both aligned source sides", () => {
  ok(run(v => { equity(v).data.results = []; }).observations[0]!.blockers.includes("MISSING_UNDERLYING_QUOTE"));
  ok(run(v => { equity(v).data.results[0].quote.venue_ask_time = "2026-09-04T14:00:40Z"; }).observations[0]!.blockers.includes("UNDERLYING_SOURCE_TIME_SKEW"));
});
test("extra symbols, missing requested IDs and historical substitutions fail", () => {
  rejected(v => { equity(v).args.symbols = ["GLD", "IBIT"]; }, "FRAME_REQUEST_COVERAGE");
  rejected(v => { option(v).args.instrument_ids = []; }, "CONTRACT_LIMIT");
  rejected(v => { v.calls.push(JSON.parse(source).calls[3]); }, "FRAME_QUOTE_CALL_SCOPE");
});
test("contract identity cannot change under an existing UUID", () => {
  rejected(v => { v.calls[1].data.instruments[0].strike_price = "411"; v.calls[1].args.strike_price = "411"; }, "CONTRACT_IDENTITY_CHANGED");
});
test("synthetic and declared owner captures cannot be mixed in a study", () => {
  rejected(v => { v.declaredOrigin = "OWNER_AUTHORIZED_MCP_CAPTURE"; }, "ORIGIN_CHANGED");
});
test("late recording stays visible and prevents usable observations", () => {
  const f = frame(plan(), JSON.stringify(capture()), "2026-09-04T14:05:00.000Z", []); ok(f.blockers.includes("RECORDED_LATE")); equal(f.observations[0]!.diagnosticUsable, false);
});
test("fast repolls cannot expand sample size", () => {
  const f = run(), v = capture(); v.captureId = "repoll";
  throws(() => frame(plan(), JSON.stringify(v), at, [f]), "COLLECTION_CADENCE");
});
test("repeated source nanoseconds are excluded despite a newer receipt", () => {
  const f = run(), v = capture(1); quote(v).updated_at = quote(capture()).updated_at;
  const second = frame(plan(), JSON.stringify(v), "2026-09-04T14:02:03.000Z", [f]);
  ok(second.observations[0]!.blockers.includes("REPEATED_SOURCE_OBSERVATION")); equal(second.observations[0]!.diagnosticUsable, false);
});
test("different values at the same source time indicate a conflict", () => {
  const f = run(), v = capture(1); quote(v).updated_at = quote(capture()).updated_at; quote(v).bid_price = "0.17";
  const second = frame(plan(), JSON.stringify(v), "2026-09-04T14:02:03.000Z", [f]);
  ok(second.observations[0]!.blockers.includes("SOURCE_CLOCK_VALUE_CONFLICT"));
});
test("source regression is detected at nanosecond precision", () => {
  const f = run(), v = capture(1); quote(v).updated_at = "2026-09-04T14:01:00.000123455Z";
  ok(frame(plan(), JSON.stringify(v), "2026-09-04T14:02:03.000Z", [f]).observations[0]!.blockers.includes("SOURCE_CLOCK_REGRESSED"));
});
test("a sub-millisecond future source clock is not rounded into an acceptable receipt", () => {
  const f = run(v => { quote(v).updated_at = "2026-09-04T14:01:01.000000001Z"; });
  ok(f.observations[0]!.blockers.includes("QUOTE_CLOCK_IN_FUTURE")); equal(f.observations[0]!.diagnosticUsable, false);
});
test("fresh source clocks and later requests extend the linked record sequence", () => {
  const first = run(), second = frame(plan(), JSON.stringify(capture(1)), "2026-09-04T14:02:03.000Z", [first]);
  equal(second.sequence, 2); equal(second.previousFrameSha256, first.frameSha256); equal(second.status, "DIAGNOSTICS_PASSED_ONLY");
});
test("gaps are reported without inventing intermediate observations", () => {
  const f = frame(plan(), JSON.stringify(capture(3)), "2026-09-04T14:04:03.000Z", []); ok(f.blockers.includes("COLLECTION_GAP")); equal(f.observations.length, 1);
});
test("tampered plans, record bodies and hash chains fail", () => {
  const p = JSON.parse(JSON.stringify(plan())); p.cadenceMs = 1; throws(() => frame(p, JSON.stringify(capture()), at, []), "PLAN_INTEGRITY");
  const f = JSON.parse(JSON.stringify(run())); f.observations[0].diagnosticUsable = false;
  throws(() => review(plan(), [f], at), "FRAME_INTEGRITY");
});
test("a pre-window diagnostic does not invent a gap before the first in-window frame", () => {
  const early = capture(); option(early).requestedAt = "2026-09-04T14:00:11.000Z"; option(early).receivedAt = "2026-09-04T14:00:12.000Z";
  equity(early).requestedAt = "2026-09-04T14:00:11.000Z"; equity(early).receivedAt = "2026-09-04T14:00:12.000Z";
  quote(early).updated_at = "2026-09-04T14:00:11Z"; equity(early).data.results[0].quote.venue_bid_time = "2026-09-04T14:00:11Z"; equity(early).data.results[0].quote.venue_ask_time = "2026-09-04T14:00:11Z";
  const first = frame(plan(), JSON.stringify(early), "2026-09-04T14:00:13.000Z", []);
  const next = capture(1); const second = frame(plan(), JSON.stringify(next), "2026-09-04T14:02:03.000Z", [first]);
  ok(!second.blockers.includes("COLLECTION_GAP"));
});
test("an after-window poll cannot conceal missing window coverage", () => {
  const late = frame(plan(), JSON.stringify(capture(11)), "2026-09-04T14:12:03.000Z", []);
  ok(review(plan(), [late], "2026-09-04T14:12:04.000Z").blockers.includes("WINDOW_TAIL_GAP"));
});
test("review waits before the window and yields only two approved request types", () => {
  const r = review(plan(), [], freezeAt); equal(r.stage, "WAITING_FOR_WINDOW"); equal(r.requestReadyNow, false);
  equal(r.nextRequests.map(v => v.tool), ["get_option_quotes", "get_equity_quotes"]); equal(r.automaticCollectionEnabled, false);
});
test("review never converts clean observations to trades or probability", () => {
  const r = review(plan(), [run()], at); equal(r.diagnosticUsableObservations, 1); equal(r.status, "NO_REPLAY"); equal(r.tradeCount, 0); equal(r.winProbability, null);
  ok(r.blockers.includes("SIDE_AND_SIZE_EVENT_CLOCKS_UNVERIFIED"));
});
test("closed windows stop generating requests and retain incomplete tails", () => {
  const r = review(plan(), [run()], "2026-09-04T14:11:00.000Z"); equal(r.stage, "WINDOW_ENDED"); equal(r.nextRequests, []); equal(r.nextRequestAt, null); ok(r.blockers.includes("WINDOW_TAIL_GAP"));
});
test("data-quality lessons use actual record time and never approve guards", () => {
  const f = run(v => { quote(v).bid_size = null; }); const r = review(plan(), [f], at);
  equal(r.candidateLessons[0]!.firstRecordedAt, at); equal(r.candidateLessons[0]!.tradeOutcome, null); equal(r.candidateLessons[0]!.strategyChangeAllowed, false);
});
test("review refuses clock rollback", () => { throws(() => review(plan(), [run()], freezeAt), "REVIEW_CLOCK"); });
console.log(`${passed}/${passed} tests passed.`);
