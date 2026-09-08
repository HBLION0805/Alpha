import type { OptionsPaperPortfolioInput } from "../../contracts/OptionsPaperPortfolio";
import type { OptionsPaperScenario } from "../../contracts/OptionsPaperTrading";
import { assessOptionsPaperPortfolio as assess } from "./OptionsPaperPortfolio";
import { portfolioDefinition, portfolioFixture } from "./OptionsPortfolioRiskFixtures";
import { optionsPaperDemoScenarios, paperFixture } from "../options-paper/OptionsPaperFixtures";
import { appendOptionsPaperScenario, paperFingerprint, replayOptionsPaperAccount } from "../options-paper/OptionsPaperTradingEngine";

const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (v: unknown) => { if (!v) throw Error("Expected truthy"); };
function throws(work: () => unknown, code = "") { let caught; try { work(); } catch (e) { caught = e; } if (!(caught instanceof Error) || !caught.message.includes(code)) throw Error("Expected error " + code); }
function base(history: readonly OptionsPaperScenario[] = [], candidate: OptionsPaperScenario | null = portfolioDefinition("bridge-candidate", 5)): OptionsPaperPortfolioInput {
  const asOf = candidate?.asOf ?? history.at(-1)?.asOf ?? "2026-09-08T14:05:00.000Z";
  return { version: "OPTIONS_PAPER_PORTFOLIO_INPUT_V1", scenarioId: "bridge-test", origin: "SYNTHETIC_FIXTURE", asOf,
    historyComplete: true, modeledCostsReviewed: true, history, candidate,
    eventReview: { ...portfolioFixture().eventReview!, receivedAt: asOf } };
}
const codes = (s: OptionsPaperPortfolioInput) => assess(s).blockers.map(b => b.code);
const open = () => { const s = paperFixture("bridge-open"); return { ...s, quotes: s.quotes.slice(0, 2), asOf: s.quotes[1]!.receivedAt }; };
const demo = () => { let h: readonly OptionsPaperScenario[] = []; for (const s of optionsPaperDemoScenarios()) h = appendOptionsPaperScenario(h, s).scenarios; return h; };
let passed = 0; function test(name: string, work: () => void) { work(); passed++; console.log(`PASS ${name}`); }

test("affordable candidate passes both engines without a fill or account debit", () => {
  const r = assess(base()); eq(r.status, "MODELED_CANDIDATE_WITHIN_LIMITS"); eq(r.candidatePreview!.trade.status, "PENDING_ENTRY");
  eq(r.candidatePreview!.trade.entry, null); eq(r.paper.account.settledCashCents, 100000); eq(r.paper.account.pendingOrderCount, 0);
  eq(r.portfolio.account.reservedCashCents, 0); eq(r.inventory, []); eq(r.existingJournalAppends, 0);
});
test("without a candidate even a clear modeled account is diagnostics only", () => { const r = assess(base([], null)); eq(r.status, "ACCOUNT_DIAGNOSTICS_ONLY"); eq(r.candidatePreview, null); eq(r.blockers, []); });
test("closed gross sale and net fee conventions reconcile without changing cash", () => {
  const r = assess(base([paperFixture()])); eq(r.paper.account.settledCashCents, 97980); eq(r.portfolio.account.settledCashCents, 97990);
  eq(r.paper.account.unsettledCashCents, 2900); eq(r.portfolio.account.unsettledCashCents, 2890);
  eq(r.reconciliation.exitFeeReclassificationCents, 10); eq(r.reconciliation.totalCashCents, 100880);
  eq(r.reconciliation.conservativeAvailableSettledCashCents, 97980); eq(r.projection.closedTrades[0]!.settlement, null);
});
test("sale proceeds smaller than exit fees reconcile the immediate settled deficit", () => {
  const s = paperFixture(), h = { ...s, plan: { ...s.plan, exitFeeCents: 150, stopLossBps: 1000 }, quotes: [...s.quotes.slice(0, 2), { ...s.quotes[2]!, bidPerShareCents: 1, askPerShareCents: 2 }] };
  const r = assess(base([h], null)); eq(r.inventory[0]!.status, "CLOSED"); eq(r.reconciliation.exitFeeReclassificationCents, 100);
  eq(r.portfolio.account.unsettledCashCents, 0); eq(r.paper.account.unsettledCashCents, 100); eq(r.reconciliation.totalCashCents, 97940);
});
test("zero net exit after adverse slippage creates no receivable or fee reclassification", () => {
  const s = paperFixture(), h = { ...s, plan: { ...s.plan, stopLossBps: 1000, exitSlippagePerShareCents: 1 }, quotes: [...s.quotes.slice(0, 2), { ...s.quotes[2]!, bidPerShareCents: 1, askPerShareCents: 2 }] };
  const r = assess(base([h], null)); eq(r.inventory[0]!.status, "CLOSED"); eq(r.paper.account.unsettledCashCents, 0); eq(r.reconciliation.exitFeeReclassificationCents, 0);
});
test("later day does not manufacture settlement or change acknowledged paper state", () => {
  const s = base([paperFixture()], null), a = assess(s), b = assess({ ...s, asOf: "2026-09-14T14:05:00.000Z", eventReview: null });
  eq(a.paper, b.paper); eq(a.reconciliation.totalCashCents, b.reconciliation.totalCashCents); eq(b.portfolio.account.unsettledCashCents, 2890);
});
test("GLD holding prevents an IBIT candidate across both original guards", () => {
  const r = assess(base([open()], portfolioDefinition("ibit-candidate", 2, "IBIT")));
  eq(r.status, "MODELED_CANDIDATE_BLOCKED"); ok(r.blockers.some(b => b.code === "PORTFOLIO_POSITION_OR_ORDER_LIMIT"));
  ok(r.blockers.some(b => b.code === "PAPER_ACCOUNT_POSITION_OR_ORDER_OPEN")); eq(r.portfolio.withCandidate.count, 2);
  eq(r.portfolio.byAsset.map(a => a.count), [1, 1]); eq(r.reconciliation.openExitFeeReservationCents, 10);
  eq(r.reconciliation.conservativeAvailableSettledCashCents, 97980);
});
test("pending entry is preserved when assessment advances beyond its deadline", () => {
  const pending = portfolioDefinition("pending", 0), s = base([pending]), r = assess(s);
  eq(r.inventory[0]!.status, "PENDING_ENTRY"); eq(r.paper.account.reservedCashCents, 2020); eq(r.portfolio.account.reservedCashCents, 2020);
  ok(r.blockers.some(b => b.code === "PENDING_ORDER_EXPIRY_UNCONFIRMED"));
});
test("acknowledged cancellation releases exposure but remains in inventory", () => {
  const s = portfolioDefinition("expired", 0), r = assess(base([{ ...s, asOf: s.plan.entryDeadlineAt }]));
  eq(r.inventory[0]!.status, "CANCELLED"); eq(r.portfolio.incumbent.count, 0); eq(r.paper.account.reservedCashCents, 0);
});
test("stale open mark retains exposure and unknown portfolio equity", () => {
  const r = assess(base([open()])); eq(r.paper.account.openPositionCount, 1); eq(r.portfolio.account.currentEquityCents, null);
  ok(r.blockers.some(b => b.code === "OPTION_QUOTE_STALE")); eq(r.portfolio.incumbent.fullPremiumAndFeesCents, 2020);
});
test("zero-size stop leaves an open position and original pending stop", () => {
  const s = paperFixture(), h = { ...s, asOf: s.quotes[2]!.receivedAt, quotes: [...s.quotes.slice(0, 2), { ...s.quotes[2]!, bidPerShareCents: 16, askPerShareCents: 17, bidSizeContracts: 0 }] };
  const r = assess(base([h], null)); eq(r.inventory[0]!.status, "OPEN"); eq(r.inventory[0]!.pendingExitReason, "STOP"); eq(r.portfolio.account.currentEquityCents, null);
});
test("ignored non-advancing quote cannot become a usable portfolio mark", () => {
  const s = open(), q = { ...s.quotes[1]!, quoteId: "duplicate-clock", receivedAt: "2026-09-08T14:02:00.000Z" };
  const r = assess(base([{ ...s, asOf: q.receivedAt, quotes: [...s.quotes, q] }], null)); eq(r.inventory[0]!.markQuoteId, null); eq(r.portfolio.account.currentEquityCents, null);
});
test("rejected quote cannot revive a prior mark", () => {
  const s = open(), q = { ...s.quotes[1]!, quoteId: "stale-clock", receivedAt: "2026-09-08T14:03:00.000Z" };
  const r = assess(base([{ ...s, asOf: q.receivedAt, quotes: [...s.quotes, q] }], null)); eq(r.inventory[0]!.markQuoteId, null); eq(r.portfolio.account.currentEquityCents, null);
});
test("slippage and gross-mark equity differences remain labeled with no balancing entry", () => {
  const s = open(), r = assess(base([{ ...s, plan: { ...s.plan, stopLossBps: 1000, exitSlippagePerShareCents: 1 } }], null));
  eq(r.reconciliation.portfolioEquityCents! - r.reconciliation.paperEquityCents, 100); eq(r.reconciliation.cashAndRealizedPnlMatched, true);
});
test("all seven final demo states five reviews and four candidate lessons survive", () => {
  const history = demo(), r = assess(base(history, portfolioDefinition("after-demo", 40, "IBIT")));
  eq(r.inventory.length, 7); eq(r.paper.reviews.length, 5); eq(r.paper.mistakeNotebook.entries.length, 4);
  eq(r.paper, replayOptionsPaperAccount(history)); eq(r.portfolio.reviews, r.paper.reviews);
  eq(r.status, "MODELED_CANDIDATE_BLOCKED"); ok(r.blockers.some(b => b.code === "PORTFOLIO_DAILY_LOSS_LIMIT"));
  ok(r.blockers.some(b => b.code === "PAPER_SESSION_LOSS_LIMIT"));
  ok(r.candidatePreview!.trade.events.some(e => e.type === "MISTAKE_CHECK"));
});
test("missing cost review, history declaration and event review all remain blockers", () => {
  const list = codes({ ...base(), historyComplete: false, modeledCostsReviewed: false, eventReview: null });
  for (const code of ["HISTORY_INCOMPLETE", "MODELED_COSTS_UNREVIEWED", "EVENT_REVIEW_UNKNOWN"]) ok(list.includes(code));
});
test("manual event overlap blocks an otherwise affordable candidate", () => {
  const s = base(), r = assess({ ...s, eventReview: { ...s.eventReview!, events: [{ eventId: "event", symbols: ["GLD"], receivedAt: s.asOf, reference: "Declared event", precision: "DATE_ONLY", startDate: "2026-09-08", endDate: "2026-09-08" }] } });
  eq(r.status, "MODELED_CANDIDATE_BLOCKED"); ok(r.blockers.some(b => b.code === "DATE_ONLY_EVENT_REQUIRES_REVIEW"));
});
test("unsettled profits and portfolio fee netting cannot fund a paper cash shortfall", () => {
  const history = Array.from({ length: 49 }, (_, i) => paperFixture("cash-drain-" + i, i * 5));
  const d = portfolioDefinition("cash-shortfall", 245), c = { ...d, plan: { ...d.plan, entryLimitPerShareCents: 14 }, quotes: [{ ...d.quotes[0]!, bidPerShareCents: 13, askPerShareCents: 14 }] };
  const r = assess(base(history, c)); eq(r.paper.reviews.length, 49);
  eq(r.paper.account.availableCashCents, 1020); eq(r.portfolio.account.availableSettledCashCents, 1510);
  eq(r.reconciliation.conservativeAvailableSettledCashCents, 1020); eq(r.status, "MODELED_CANDIDATE_BLOCKED");
  ok(r.blockers.some(b => b.code === "CONSERVATIVE_SETTLED_CASH_INSUFFICIENT"));
  eq(r.portfolio.status, "SCENARIO_WITHIN_LIMITS"); eq(r.candidatePreview!.trade.status, "NO_TRADE");
});
test("both declared origins are retained without promotion to qualified data", () => {
  const s = base(), c = s.candidate!;
  const r = assess({ ...s, origin: "UNVERIFIED_IMPORT", candidate: { ...c, quotes: c.quotes.map(q => ({ ...q, origin: "UNVERIFIED_IMPORT", sourceId: "import:manual-test" })) } });
  eq(r.origin, "UNVERIFIED_IMPORT"); eq(r.marketValidated, false); eq(r.executionAllowed, false);
});
test("history known only after assessment is rejected instead of silently filtered", () => { throws(() => assess({ ...base([paperFixture()]), asOf: "2026-09-08T14:03:00.000Z" }), "HISTORY_AFTER_ASSESSMENT"); });
test("mixed or falsely labeled origins are rejected", () => { throws(() => assess({ ...base([paperFixture()]), origin: "UNVERIFIED_IMPORT" }), "ORIGIN"); });
test("candidate path cannot contain later-fill quotes", () => { const s = paperFixture("candidate", 5); throws(() => assess(base([], s)), "DEFINITION_CLOCK_OR_PATH"); });
test("candidate cannot reuse scenario ID of a cancelled plan", () => { const s = portfolioDefinition("reused", 0); throws(() => assess(base([{ ...s, asOf: s.plan.entryDeadlineAt }], portfolioDefinition("reused", 5))), "DUPLICATE"); });
test("candidate cannot reuse plan ID of a no-trade case", () => {
  const s = paperFixture("blocked"), h = { ...s, plan: { ...s.plan, entryLimitPerShareCents: 200 } }, c = portfolioDefinition("different", 5);
  eq(replayOptionsPaperAccount([h]).trades[0]!.status, "NO_TRADE");
  throws(() => assess(base([h], { ...c, plan: { ...c.plan, planId: h.plan.planId } })), "DUPLICATE");
});
test("malformed metadata and unsupported authority inputs fail exact validation", () => {
  for (const bad of [{ ...base(), version: "v2" }, { ...base(), winProbability: 0.9 }, { ...base(), historyComplete: "true" }, { ...base(), asOf: "tomorrow" }, { ...base(), origin: "LIVE" }]) throws(() => assess(bad));
});
test("metadata accessor is rejected without invoking it", () => {
  const s = base(); let calls = 0; Object.defineProperty(s, "historyComplete", { enumerable: true, get: () => { calls++; return true; } }); throws(() => assess(s), "SHAPE"); eq(calls, 0);
});
test("history limit rejects excessive inputs before replay", () => { throws(() => assess({ ...base(), history: Array(501).fill(paperFixture()) }), "HISTORY_LIMIT"); });
test("repeated computation is deterministic and original inputs stay unchanged", () => {
  const s = base(demo(), portfolioDefinition("repeat", 40)), before = paperFingerprint(s), a = assess(s), b = assess(s);
  eq(a, b); eq(paperFingerprint(s), before); ok(Object.isFrozen(a));
  for (const field of ["marketValidated", "executionAllowed", "automaticOrdersEnabled", "sizeEscalationAllowed", "liveAccountInspected"] as const) eq(a[field], false);
  eq(a.winProbability, null);
});
test("freezing the projection never freezes or retains caller-owned candidate and event objects", () => {
  const input = JSON.parse(JSON.stringify(base())), r = assess(input), before = paperFingerprint(r);
  ok(!Object.isFrozen(input.candidate)); ok(!Object.isFrozen(input.eventReview));
  input.candidate.plan.entryLimitPerShareCents = 999; input.eventReview.events.push({ unrelated: true });
  eq(paperFingerprint(r), before); eq(r.projection.candidate!.plan.entryLimitPerShareCents, 20);
});
console.log(`${passed}/${passed} tests passed.`);
