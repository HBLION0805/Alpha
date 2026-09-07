import { assessOptionsPortfolioRisk as assess } from "./OptionsPortfolioRiskEngine";
import { portfolioFixture, portfolioDefinition, portfolioClosedFixture, portfolioOpenFixture, portfolioDemoScenarios } from "./OptionsPortfolioRiskFixtures";
import { readinessFingerprint } from "../options-readiness/OptionsReadinessEngine";
import type { OptionsPortfolioScenario } from "../../contracts/OptionsPortfolioRisk";
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
function ok(v: unknown) { if (!v) throw Error("Expected truthy"); }
function throws(work: () => unknown, code = "") { let caught; try { work(); } catch (e) { caught = e; } if (!(caught instanceof Error) || !caught.message.includes(code)) throw Error("Expected error " + code); }
const codes = (s: OptionsPortfolioScenario) => assess(s).blockers.map(b => b.code);
const includes = (s: OptionsPortfolioScenario, code: string) => ok(codes(s).includes(code));
const no = (s: OptionsPortfolioScenario, code: string) => ok(!codes(s).includes(code));
const base = portfolioFixture, closed = portfolioClosedFixture;
const empty = () => ({ ...base(), candidate: null });
const changedTrade = (net: number, id = "portfolio-closed") => { const c = closed(); return { ...c, input: { ...c.input, tradeId: id, entryPremiumCents: 10000, exitProceedsCents: 10020 + net, netPnlCents: net } }; };
let passed = 0; function test(name: string, work: () => void) { work(); passed++; console.log(`PASS ${name}`); }
test("single affordable synthetic candidate reuses unchanged entry economics", () => {
  const r = assess(base()); eq(r.status, "SCENARIO_WITHIN_LIMITS"); eq(r.account.currentEquityCents, 100000); eq(r.account.availableSettledCashCents, 100000);
  eq(r.withCandidate.fullPremiumAndFeesCents, 2020); eq(r.withCandidate.originalPlannedRiskCents, 420); eq(r.candidateEconomics!.economics!.plannedStopCents, 420);
});
test("new candidate never debits actual or modeled current cash", () => { eq(assess(base()).account, assess(empty()).account); });
test("sale proceeds stay unsettled including the next calendar day", () => {
  const s = { ...empty(), closedTrades: [closed()] }, r = assess(s); eq(r.account.settledCashCents, 97990); eq(r.account.unsettledCashCents, 2890); eq(r.account.currentEquityCents, 100880);
  const later = assess({ ...s, asOf: "2026-09-09T14:02:00.000Z" }); eq(later.account.settledCashCents, r.account.settledCashCents); eq(later.account.unsettledCashCents, 2890);
});
test("weekend passage alone cannot settle receipts", () => { const r = assess({ ...empty(), asOf: "2026-09-13T14:02:00.000Z", closedTrades: [closed()] }); eq(r.account.unsettledCashCents, 2890); });
test("settlement receipt equality includes credit but one millisecond before excludes it", () => {
  const c = closed(), at = "2026-09-09T14:00:00.000Z", s = { ...empty(), asOf: at, closedTrades: [{ ...c, settlement: { settledAt: at, receivedAt: at, reference: "Synthetic settlement" } }] };
  eq(assess(s).account.settledCashCents, 100880); eq(assess(s).account.unsettledCashCents, 0);
  const early = assess({ ...s, asOf: "2026-09-09T13:59:59.999Z" }); eq(early.account.settledCashCents, 97990); eq(early.account.unsettledCashCents, 2890);
});
test("late receipt cannot backdate settled buying power", () => {
  const s = { ...empty(), asOf: "2026-09-09T14:00:00.000Z", closedTrades: [{ ...closed(), settlement: { settledAt: "2026-09-09T13:00:00.000Z", receivedAt: "2026-09-09T15:00:00.000Z", reference: "Late evidence" } }] };
  eq(assess(s).account.unsettledCashCents, 2890); eq(assess({ ...s, asOf: "2026-09-09T15:00:00.000Z" }).account.unsettledCashCents, 0);
});
test("negative sale net fees debit immediately rather than wait as negative receivable", () => {
  const c = closed(), s = { ...empty(), closedTrades: [{ ...c, input: { ...c.input, exitProceedsCents: 0, netPnlCents: -2020 } }] };
  const r = assess(s); eq(r.account.settledCashCents, 97980); eq(r.account.unsettledCashCents, 0); eq(r.account.currentEquityCents, 97980);
});
test("later settlements cannot hide an unfunded historical buy", () => {
  const c = closed(), s = { ...empty(), closedTrades: [{ ...c, input: { ...c.input, entryPremiumCents: 100000, exitProceedsCents: 100020, netPnlCents: 0 }, settlement: { settledAt: base().asOf, receivedAt: base().asOf, reference: "Synthetic only" } }] };
  const r = assess(s); eq(r.account.currentEquityCents, 100000); eq(r.account.minimumHistoricalSettledCashCents, -10); includes(s, "HISTORICAL_SETTLED_CASH_DEFICIT");
});
test("pending premium and roundtrip fees reserved once even after deadline", () => {
  const d = portfolioDefinition("pending", 0), s = { ...empty(), pendingEntries: [d] }, r = assess(s);
  eq(r.account.reservedCashCents, 2020); eq(r.account.settledCashCents, 100000); eq(r.account.availableSettledCashCents, 97980);
  const later = { ...s, asOf: "2026-09-08T14:04:00.000Z" }; eq(assess(later).account.reservedCashCents, 2020); includes(later, "PENDING_ORDER_EXPIRY_UNCONFIRMED");
});
test("GLD and IBIT risk aggregates without diversification or directional offsets", () => {
  const s = { ...base(), positions: [portfolioOpenFixture()] }, r = assess(s); includes(s, "PORTFOLIO_POSITION_OR_ORDER_LIMIT"); includes(s, "PORTFOLIO_FULL_PREMIUM_STRESS_LIMIT");
  eq(r.withCandidate.fullPremiumAndFeesCents, 4040); eq(r.byAsset.map(x => x.fullPremiumAndFeesCents), [2020, 2020]); eq(r.withCandidate.originalPlannedRiskCents, 840);
});
test("open mark and exit fee reconcile net equity independently of cash settlement", () => {
  const r = assess({ ...empty(), positions: [portfolioOpenFixture()] }); eq(r.account.settledCashCents, 97990); eq(r.account.currentEquityCents, 99880); eq(r.exposures[0]!.additionalToStopCents, 300); eq(r.exposures[0]!.capacityRiskCents, 420);
});
test("gains do not shrink risk measured from current mark back to original stop", () => {
  const p = portfolioOpenFixture(), s = { ...empty(), positions: [{ ...p, mark: { ...p.mark!, bidPerShareCents: 29, askPerShareCents: 30 } }] }, r = assess(s);
  eq(r.exposures[0]!.additionalToStopCents, 1300); eq(r.withCandidate.capacityRiskCents, 1300); includes(s, "PORTFOLIO_DAILY_RISK_CAPACITY"); eq(r.withCandidate.currentMarkToZeroCents, 2900);
});
test("unknown marks retain premium exposure while equity and mark stress stay null", () => {
  const s = { ...empty(), positions: [{ ...portfolioOpenFixture(), mark: null }] }, r = assess(s); eq(r.account.currentEquityCents, null); eq(r.incumbent.currentMarkToZeroCents, null); eq(r.incumbent.fullPremiumAndFeesCents, 2020); includes(s, "CURRENT_EQUITY_UNKNOWN");
});
test("stop equality and adverse gaps block despite remaining account-level budgets", () => {
  const p = portfolioOpenFixture();
  for (const bid of [16, 10]) includes({ ...empty(), positions: [{ ...p, mark: { ...p.mark!, bidPerShareCents: bid, askPerShareCents: bid + 1 } }] }, "POSITION_PLANNED_STOP_REACHED");
  no({ ...empty(), positions: [{ ...p, mark: { ...p.mark!, bidPerShareCents: 17, askPerShareCents: 18 } }] }, "POSITION_PLANNED_STOP_REACHED");
});
test("target reached remains a held position until a separate exit record exists", () => {
  const p = portfolioOpenFixture(), s = { ...empty(), positions: [{ ...p, mark: { ...p.mark!, bidPerShareCents: 29, askPerShareCents: 30 } }] };
  includes(s, "POSITION_PROFIT_TARGET_EXIT_UNCONFIRMED"); eq(assess(s).incumbent.count, 1); eq(assess(s).account.unsettledCashCents, 0);
});
test("a fractional-cent percentage stop rounds toward the existing earlier tick", () => {
  const p = portfolioOpenFixture(), definition = { ...p.definition, plan: { ...p.definition.plan, entryLimitPerShareCents: 21 } };
  const position = { ...p, definition, entryPricePerShareCents: 21, mark: { ...p.mark!, bidPerShareCents: 17, askPerShareCents: 18 } };
  const s = { ...empty(), positions: [position] };
  // 21 cents less 20% is 16.8 cents: the established plan stops at 17, not 16.
  includes(s, "POSITION_PLANNED_STOP_REACHED"); eq(assess(s).incumbent.count, 1);
  no({ ...s, positions: [{ ...position, mark: { ...position.mark, bidPerShareCents: 18, askPerShareCents: 19 } }] }, "POSITION_PLANNED_STOP_REACHED");
});
test("stale, future, zero-bid and zero-size marks cannot value the portfolio", () => {
  const p = portfolioOpenFixture(); for (const patch of [{ observedAt: "2026-09-08T14:00:00.000Z" }, { observedAt: "2026-09-08T14:03:00.000Z", receivedAt: "2026-09-08T14:03:00.000Z" }, { bidPerShareCents: 0 }, { bidSizeContracts: 0 }]) eq(assess({ ...empty(), positions: [{ ...p, mark: { ...p.mark!, ...patch } }] }).account.currentEquityCents, null);
});
test("time-exit equality and overnight exposure remain unresolved", () => {
  const s = { ...empty(), asOf: "2026-09-08T14:03:00.000Z", positions: [portfolioOpenFixture()] }; includes(s, "POSITION_TIME_EXIT_OVERDUE");
  const later = { ...s, asOf: "2026-09-09T14:03:00.000Z" }; includes(later, "OVERNIGHT_POSITION_UNRESOLVED"); eq(assess(later).incumbent.count, 1);
});
test("expiry day never invents liquidation or exercise protection", () => {
  const s = { ...empty(), asOf: "2026-10-16T14:00:00.000Z", positions: [portfolioOpenFixture()] }; includes(s, "EXPIRY_OR_EXERCISE_EXPOSURE_UNRESOLVED"); eq(assess(s).account.settledCashCents, 97990);
});
test("daily net loss equality blocks and one cent above remains below that limit", () => {
  includes({ ...empty(), closedTrades: [changedTrade(-1000)] }, "PORTFOLIO_DAILY_LOSS_LIMIT"); no({ ...empty(), closedTrades: [changedTrade(-999)] }, "PORTFOLIO_DAILY_LOSS_LIMIT");
});
test("daily capacity rejects a candidate before its planned R crosses remaining budget", () => {
  includes({ ...base(), closedTrades: [changedTrade(-581)] }, "PORTFOLIO_DAILY_RISK_CAPACITY"); no({ ...base(), closedTrades: [changedTrade(-580)] }, "PORTFOLIO_DAILY_RISK_CAPACITY");
});
test("drawdown equality blocks and no artificial reset comes from date change", () => {
  includes({ ...empty(), closedTrades: [changedTrade(-5000)] }, "PORTFOLIO_DRAWDOWN_LIMIT"); no({ ...empty(), closedTrades: [changedTrade(-4999)] }, "PORTFOLIO_DRAWDOWN_LIMIT");
  includes({ ...empty(), asOf: "2026-09-09T14:02:00.000Z", closedTrades: [changedTrade(-5000)] }, "PORTFOLIO_DRAWDOWN_LIMIT");
});
test("New York exit day controls daily loss instead of UTC calendar date", () => {
  const c = changedTrade(-1000), r = assess({ ...empty(), closedTrades: [{ ...c, input: { ...c.input, entryAt: "2026-09-07T23:00:00.000Z", exitAt: "2026-09-08T00:10:00.000Z" } }] });
  eq(r.account.dailyDateNewYork, "2026-09-08"); eq(r.account.dailyNetPnlCents, 0); eq(r.account.realizedNetPnlCents, -1000);
});
test("known realized high water cannot be understated by a lower declaration", () => {
  const r = assess({ ...empty(), closedTrades: [closed()] }); eq(r.account.effectiveHighWaterEquityCents, 100880);
});
test("simultaneous mixed outcomes cannot invent a loss streak or intermediate high water", () => {
  const win = closed(), loss = changedTrade(-880, "simultaneous-loss"), trades = [win, { ...loss, input: { ...loss.input, planFingerprint: "sha256:" + "b".repeat(64) } }];
  const s = { ...empty(), closedTrades: trades }, r = assess(s); eq(r.account.consecutiveClosedLosses, null); eq(r.account.effectiveHighWaterEquityCents, 100000);
  eq(assess({ ...s, closedTrades: [...trades].reverse() }).account, r.account);
});
test("one R equality at 0.5 percent passes but one cent above blocks", () => {
  const s = base(), d = s.candidate!, candidate = { ...d, plan: { ...d.plan, entryLimitPerShareCents: 24 }, quotes: [{ ...d.quotes[0]!, bidPerShareCents: 23, askPerShareCents: 24 }] };
  no({ ...s, candidate }, "PORTFOLIO_PLANNED_RISK_LIMIT"); includes({ ...s, candidate: { ...candidate, plan: { ...candidate.plan, entryFeeCents: 11 } } }, "PORTFOLIO_PLANNED_RISK_LIMIT");
});
test("full-premium stress equality versus one-cent excess is independent of stop", () => {
  const s = base(), d = s.candidate!, candidate = { ...d, plan: { ...d.plan, entryFeeCents: 490 } };
  no({ ...s, candidate }, "PORTFOLIO_FULL_PREMIUM_STRESS_LIMIT"); includes({ ...s, candidate: { ...candidate, plan: { ...candidate.plan, entryFeeCents: 491 } } }, "PORTFOLIO_FULL_PREMIUM_STRESS_LIMIT");
});
test("an explicit blackout interval includes the holding endpoint", () => {
  const s = base(), end = s.candidate!.plan.timeExitAt, event = { eventId: "test-event", symbols: ["GLD"] as const, receivedAt: s.asOf, reference: "Declared interval", precision: "INSTANT" as const, startAt: end, endAt: end };
  includes({ ...s, eventReview: { ...s.eventReview!, events: [event] } }, "DECLARED_EVENT_BLACKOUT_OVERLAP");
  no({ ...s, eventReview: { ...s.eventReview!, events: [{ ...event, startAt: "2026-09-08T14:05:00.001Z", endAt: "2026-09-08T14:06:00.000Z" }] } }, "DECLARED_EVENT_BLACKOUT_OVERLAP");
});
test("date-only range overlap retains unknown intraday timing and asset scope", () => {
  const s = base(), event = { eventId: "date-event", symbols: ["IBIT"] as const, receivedAt: s.asOf, reference: "Date only", precision: "DATE_ONLY" as const, startDate: "2026-09-08", endDate: "2026-09-08" };
  no({ ...s, eventReview: { ...s.eventReview!, events: [event] } }, "DATE_ONLY_EVENT_REQUIRES_REVIEW");
  const r = assess({ ...s, eventReview: { ...s.eventReview!, events: [{ ...event, symbols: ["GLD"] }] } }); eq(r.eventMatches[0]!.precision, "DATE_ONLY"); ok(r.blockers.some(b => b.code === "DATE_ONLY_EVENT_REQUIRES_REVIEW"));
});
test("missing or insufficient event coverage is never a clear calendar", () => {
  const s = base(); includes({ ...s, eventReview: null }, "EVENT_REVIEW_UNKNOWN");
  includes({ ...s, eventReview: { ...s.eventReview!, coverageEndAt: s.asOf } }, "EVENT_REVIEW_COVERAGE_INSUFFICIENT");
  includes({ ...s, eventReview: { ...s.eventReview!, receivedAt: "2026-09-07T20:00:00.000Z" } }, "EVENT_REVIEW_COVERAGE_INSUFFICIENT");
});
test("unknown account, history, costs and high water fail independently", () => {
  const s = { ...base(), accountMode: "UNKNOWN" as const, historyComplete: false, modeledCostsReviewed: false, highWaterEquityCents: null };
  for (const code of ["ACCOUNT_MODE_UNKNOWN", "HISTORY_INCOMPLETE", "MODELED_COSTS_UNREVIEWED", "HIGH_WATER_UNKNOWN", "COSTS_UNKNOWN"]) includes(s, code);
});
test("duplicate trades cannot credit a receivable twice", () => { throws(() => assess({ ...empty(), closedTrades: [closed(), closed()] }), "DUPLICATE_ID"); });
test("duplicate pending and candidate definitions cannot double-use a plan", () => { const s = base(); throws(() => assess({ ...s, pendingEntries: [s.candidate!] }), "DUPLICATE_ID"); });
test("closed plan fingerprint prevents reusing its plan under a new trade ID", () => {
  const p = portfolioOpenFixture("GLD"), c = closed(), d = portfolioDefinition("portfolio-closed", 0);
  throws(() => assess({ ...empty(), positions: [{ ...p, definition: { ...d, scenarioId: "renamed" } }], closedTrades: [c] }), "DUPLICATE_ID");
});
test("mixed quote and review origins are rejected", () => {
  const s = base(); throws(() => assess({ ...s, origin: "UNVERIFIED_IMPORT" }), "MIXED_ORIGINS"); const c = closed(); throws(() => assess({ ...empty(), closedTrades: [{ ...c, input: { ...c.input, origin: "UNVERIFIED_IMPORT" } }] }), "MIXED_ORIGINS");
});
test("invalid monetary inputs and false closed PnL assertions cannot reach totals", () => {
  const c = closed(); throws(() => assess({ ...empty(), closedTrades: [{ ...c, exitFeeCents: 21 }] })); throws(() => assess({ ...empty(), closedTrades: [{ ...c, input: { ...c.input, netPnlCents: 999999 } }] }));
  throws(() => assess({ ...base(), highWaterEquityCents: Number.NaN })); throws(() => assess({ ...base(), highWaterEquityCents: Number.MAX_SAFE_INTEGER }));
});
test("invalid settlement chronology and future closed trades fail", () => {
  const c = closed(); throws(() => assess({ ...empty(), closedTrades: [{ ...c, settlement: { settledAt: "2026-09-08T13:00:00.000Z", receivedAt: base().asOf, reference: "bad" } }] }), "SETTLEMENT_CLOCK");
  throws(() => assess({ ...empty(), asOf: "2026-09-08T14:01:59.999Z", closedTrades: [c] }), "CLOSED_TRADE_CLOCK_OR_FEES");
});
test("incomplete definitions and price-tick violations fail", () => {
  const p = portfolioOpenFixture(); throws(() => assess({ ...empty(), positions: [{ ...p, entryPricePerShareCents: 20.5 }] }));
  const s = base(), d = s.candidate!; throws(() => assess({ ...s, candidate: { ...d, quotes: [...d.quotes, d.quotes[0]!] } }));
});
test("caller probability, extra authority fields and getters are not accepted", () => {
  throws(() => assess({ ...base(), winProbability: 0.99 }), "SHAPE"); const s = { ...base() }; Object.defineProperty(s, "asOf", { get: () => { throw Error("GETTER_EXECUTED"); }, enumerable: true }); throws(() => assess(s), "SHAPE");
});
test("limits on case arrays and event scope are enforced", () => {
  throws(() => assess({ ...empty(), closedTrades: Array.from({ length: 501 }, closed) }), "ARRAY_LIMIT");
  const s = base(); throws(() => assess({ ...s, eventReview: { ...s.eventReview!, events: [{ eventId: "x", symbols: ["SPY"], receivedAt: s.asOf, reference: "bad", precision: "DATE_ONLY", startDate: "2026-09-08", endDate: "2026-09-08" }] } }), "EVENT_SCOPE_OR_DUPLICATE");
});
test("all demo outcomes are deterministic immutable and carry no authority", () => {
  for (const s of portfolioDemoScenarios()) { const before = readinessFingerprint(s), r = assess(s), { reportSha256, ...body } = r; eq(reportSha256, readinessFingerprint(body)); eq(r, assess(s)); eq(readinessFingerprint(s), before); ok(Object.isFrozen(r.account)); eq(r.winProbability, null); eq(r.executionAllowed, false); eq(r.automaticOrdersEnabled, false); eq(r.sizeEscalationAllowed, false); }
});
console.log(`${passed}/${passed} tests passed.`);
