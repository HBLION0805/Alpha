import type { OptionsPaperScenario } from "../../contracts/OptionsPaperTrading";
import type { OptionQuote } from "../../contracts/OptionsContractQuote";
import { optionsPaperDemoScenarios, paperFixture } from "./OptionsPaperFixtures";
import { appendOptionsPaperScenario as append, paperFingerprint, replayOptionsPaperAccount as replay, validateOptionsPaperScenario as validate } from "./OptionsPaperTradingEngine";

let passed = 0, failed = 0;
function test(label: string, run: () => void): void {
  try { run(); passed++; console.log(`PASS ${label}`); }
  catch (error) { failed++; console.log(`FAIL ${label}: ${String(error)}`); }
}
function equal(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}`);
}
function truth(value: unknown): asserts value { if (!value) throw new Error("Assertion failed."); }
function throws(run: () => unknown, expected: string): void {
  try { run(); } catch (error) {
    if (error instanceof Error && error.message === expected) return;
    throw new Error(`Expected ${expected}; received ${String(error)}`);
  }
  throw new Error(`Expected ${expected}.`);
}
function replaceQuote(value: OptionsPaperScenario, index: number, changes: Partial<OptionQuote>): OptionsPaperScenario {
  return { ...value, quotes: value.quotes.map((quote, offset) => offset === index ? { ...quote, ...changes } : quote) };
}
function lastBid(value: OptionsPaperScenario, bid: number): OptionsPaperScenario {
  return replaceQuote(value, value.quotes.length - 1, { bidPerShareCents: bid, askPerShareCents: bid + 1 });
}
function shift(value: OptionsPaperScenario, milliseconds: number): OptionsPaperScenario {
  const at = (time: string) => new Date(Date.parse(time) + milliseconds).toISOString();
  return { ...value, asOf: at(value.asOf), plan: { ...value.plan, createdAt: at(value.plan.createdAt),
    entryDeadlineAt: at(value.plan.entryDeadlineAt), timeExitAt: at(value.plan.timeExitAt) },
  quotes: value.quotes.map((quote) => ({ ...quote, observedAt: at(quote.observedAt), receivedAt: at(quote.receivedAt) })) };
}
function onlyTrade(value: OptionsPaperScenario) {
  const result = replay([value]); truth(result.trades.length === 1); return { result, trade: result.trades[0]! };
}
const base = paperFixture();

test("a target round trip submits before filling and closes at bid with both fees", () => {
  const { result, trade } = onlyTrade(base);
  equal(trade.status, "CLOSED"); equal(trade.exitReason, "TARGET");
  equal(trade.entry?.pricePerShareCents, 20); equal(trade.exit?.pricePerShareCents, 29);
  equal(trade.plannedRiskCents, 420); equal(trade.netPnlCents, 880);
  equal(result.account.settledCashCents, 97980); equal(result.account.unsettledCashCents, 2900);
  equal(result.account.equityCents, 100880); equal(result.account.realizedPnlCents, 880);
  equal(result.account.reservedCashCents, 0); equal(result.account.openPositionCount, 0);
  const types = trade.events.map((event) => event.type);
  truth(types.indexOf("LIMIT_ORDER_SUBMITTED") < types.indexOf("BUY_FILLED"));
  truth(types.indexOf("BUY_FILLED") < types.indexOf("SELL_FILLED"));
  truth(types.includes("PROCEEDS_UNSETTLED")); truth(types.includes("TRADE_REVIEW_RECORDED"));
});
test("an ordinary stop realizes planned R and does not manufacture a mistake", () => {
  const { result, trade } = onlyTrade(lastBid(base, 16));
  equal(trade.exitReason, "STOP"); equal(trade.netPnlCents, -420); equal(trade.review?.realizedR, -1);
  equal(result.reviews.length, 1); equal(result.mistakeNotebook.reviewedTradeCount, 1);
  equal(result.mistakeNotebook.entries, []); equal(result.account.equityCents, 99580);
});
test("a quote gap can realize worse than R without fabricating a stop-price fill", () => {
  const gap = replaceQuote(lastBid(base, 10), 2, { observedAt: "2026-09-08T14:02:30.000Z", receivedAt: "2026-09-08T14:02:30.000Z" });
  const { trade } = onlyTrade(gap);
  equal(trade.exitReason, "STOP"); equal(trade.exit?.pricePerShareCents, 10); equal(trade.netPnlCents, -1020);
  truth(trade.review!.realizedR < -2); equal(trade.review?.input.quoteGapObserved, true);
  truth(trade.review?.candidateLessons.some((lesson) => lesson.code === "QUOTE_GAP_OBSERVED"));
});
test("a time exit does not wait for target and closes at the available bid", () => {
  const value = replaceQuote(lastBid(base, 21), 2, { observedAt: base.plan.timeExitAt, receivedAt: base.plan.timeExitAt });
  const { trade } = onlyTrade(value);
  equal(trade.exitReason, "TIME_EXIT"); equal(trade.netPnlCents, 80); equal(trade.review?.outcome, "WIN");
});
test("an above-limit path expires without a fill or invented trade review", () => {
  const value = { ...base, quotes: base.quotes.map((quote, index) => index ? { ...quote, bidPerShareCents: 24, askPerShareCents: 25 } : quote) };
  const { result, trade } = onlyTrade(value);
  equal(trade.status, "CANCELLED"); equal(trade.entry, null); equal(trade.exit, null); equal(trade.review, null);
  equal(result.account.settledCashCents, 100000); equal(result.account.reservedCashCents, 0); equal(result.reviews, []);
});
test("entry expiry is processed by the clock even without a subsequent quote", () => {
  const { trade } = onlyTrade({ ...base, quotes: [base.quotes[0]!] });
  equal(trade.status, "CANCELLED");
  const expired = trade.events.find((event) => event.type === "ENTRY_EXPIRED");
  equal(expired?.at, base.plan.entryDeadlineAt);
});
test("an unfilled live local order reserves cash without spending it", () => {
  const { result, trade } = onlyTrade({ ...base, quotes: [base.quotes[0]!], asOf: "2026-09-08T14:00:30.000Z" });
  equal(trade.status, "PENDING_ENTRY"); equal(result.account.settledCashCents, 100000);
  equal(result.account.reservedCashCents, 2020); equal(result.account.availableCashCents, 97980);
  equal(result.account.pendingOrderCount, 1); equal(result.account.equityCents, 100000);
});
test("an open position retains the exit fee reserve and reconciles conservative marks", () => {
  const { result, trade } = onlyTrade({ ...base, quotes: base.quotes.slice(0, 2), asOf: "2026-09-08T14:01:30.000Z" });
  equal(trade.status, "OPEN"); equal(result.account.settledCashCents, 97990); equal(result.account.reservedCashCents, 10);
  equal(result.account.positionMarkCents, 1900); equal(result.account.positionExitFeeCents, 10);
  equal(result.account.equityCents, 99880); equal(result.account.realizedPnlCents, 0);
});
test("missing exit liquidity leaves the triggered stop pending with no fake proceeds", () => {
  const pending = optionsPaperDemoScenarios()[5]!;
  const { result, trade } = onlyTrade(pending);
  equal(trade.status, "OPEN"); equal(trade.pendingExitReason, "STOP"); equal(trade.exit, null);
  equal(result.account.unsettledCashCents, 0); equal(result.reviews, []);
  truth(trade.events.some((event) => event.type === "EXIT_AWAITING_LIQUIDITY"));
});
test("resuming missing liquidity closes once and records the execution-risk lesson", () => {
  const cases = optionsPaperDemoScenarios(); const first = append([], cases[5]);
  const resumed = append(first.scenarios, cases[6]); const result = replay(resumed.scenarios);
  equal(result.trades.length, 1); equal(result.trades[0]?.status, "CLOSED"); equal(result.trades[0]?.exitReason, "STOP");
  equal(result.trades[0]?.netPnlCents, -520); equal(result.reviews.length, 1);
  equal(result.trades[0]?.events.filter((event) => event.type === "BUY_FILLED").length, 1);
  equal(result.trades[0]?.events.filter((event) => event.type === "SELL_FILLED").length, 1);
  truth(result.mistakeNotebook.entries.some((lesson) => lesson.code === "EXIT_LIQUIDITY_DELAYED"));
});
test("a triggered stop stays a stop even if a later liquid quote recovers to target", () => {
  const cases = optionsPaperDemoScenarios(); const recovered = lastBid(cases[6]!, 29);
  const result = replay(append(append([], cases[5]).scenarios, recovered).scenarios);
  equal(result.trades[0]?.exitReason, "STOP"); equal(result.trades[0]?.review?.outcome, "WIN");
  equal(result.trades[0]?.review?.input.exitLiquidityDelayed, true);
});
test("time exit triggers without new quotes and remains an unresolved open trade", () => {
  const { trade } = onlyTrade({ ...base, quotes: base.quotes.slice(0, 2) });
  equal(trade.status, "OPEN"); equal(trade.pendingExitReason, "TIME_EXIT"); equal(trade.review, null);
  truth(trade.events.some((event) => event.type === "EXIT_TRIGGERED" && event.at === base.plan.timeExitAt));
});
test("a quote observed before a time trigger cannot be sold after its receipt", () => {
  const value = replaceQuote(lastBid(base, 21), 2, { observedAt: "2026-09-08T14:02:59.999Z", receivedAt: "2026-09-08T14:03:00.030Z" });
  const { trade } = onlyTrade(value);
  equal(trade.status, "OPEN"); equal(trade.pendingExitReason, "TIME_EXIT"); equal(trade.exit, null);
  truth(trade.events.some((event) => event.type === "EXIT_AWAITING_POST_TRIGGER_QUOTE"));
});
test("the first valid post-time-trigger quote can complete a pending exit", () => {
  const prior = { ...replaceQuote(lastBid(base, 21), 2, { observedAt: "2026-09-08T14:02:59.999Z", receivedAt: "2026-09-08T14:03:00.030Z" }), asOf: "2026-09-08T14:03:00.030Z" };
  const next = { ...prior, asOf: "2026-09-08T14:03:01.000Z", quotes: [...prior.quotes,
    { ...prior.quotes[2]!, quoteId: "target:post-trigger", observedAt: "2026-09-08T14:03:01.000Z", receivedAt: "2026-09-08T14:03:01.000Z" }] };
  const result = replay(append(append([], prior).scenarios, next).scenarios);
  equal(result.trades[0]?.exitReason, "TIME_EXIT"); equal(result.trades[0]?.exit?.at, next.asOf);
});
test("buy fill needs displayed ask size and cannot use the initial evidence quote", () => {
  let value = replaceQuote(base, 1, { askSizeContracts: 0 });
  value = replaceQuote(value, 2, { bidPerShareCents: 19, askPerShareCents: 20, askSizeContracts: 0 });
  const { trade } = onlyTrade(value);
  equal(trade.entry, null); equal(trade.status, "CANCELLED");
});
test("entry quote spread deterioration fails the fill check even after reservation", () => {
  let value = replaceQuote(base, 1, { bidPerShareCents: 18, askPerShareCents: 20 });
  value = replaceQuote(value, 2, { bidPerShareCents: 18, askPerShareCents: 20 });
  const { trade } = onlyTrade(value);
  equal(trade.status, "CANCELLED"); equal(trade.entry, null);
  truth(trade.events.some((event) => event.type === "ENTRY_QUOTE_RISK_REJECTED"));
});
test("stale entry evidence blocks before cash reservation", () => {
  const { result, trade } = onlyTrade(replaceQuote(base, 0, { observedAt: "2026-09-08T13:58:00.000Z" }));
  equal(trade.status, "NO_TRADE"); truth(trade.blockers.includes("OPTION_QUOTE_STALE"));
  equal(result.account.reservedCashCents, 0); equal(result.account.settledCashCents, 100000);
});
test("closed-session entry evidence cannot become a local trade", () => {
  const { trade } = onlyTrade(replaceQuote(base, 0, { session: "CLOSED" }));
  equal(trade.status, "NO_TRADE"); truth(trade.blockers.includes("OPTION_QUOTE_SESSION_CLOSED"));
});
test("stale post-entry quotes do not invent exits or erase the open position", () => {
  const { trade } = onlyTrade(replaceQuote(base, 2, { observedAt: "2026-09-08T14:01:00.000Z", receivedAt: "2026-09-08T14:02:01.000Z" }));
  equal(trade.status, "OPEN"); equal(trade.exit, null);
  truth(trade.events.some((event) => event.type === "QUOTE_REJECTED"));
});
test("unknown costs and missing thesis dimensions fail rather than assume zero", () => {
  throws(() => validate({ ...base, plan: { ...base.plan, entryFeeCents: null } }), "INVALID_PAPER_PLAN_COSTS");
  throws(() => validate({ ...base, plan: { ...base.plan, thesis: { ...base.plan.thesis, dailySetup: "" } } }), "INVALID_PAPER_THESIS");
  const { monthlyContext: ignored, ...missing } = base.plan.thesis; void ignored;
  throws(() => validate({ ...base, plan: { ...base.plan, thesis: missing } }), "INVALID_PAPER_THESIS");
});
test("unknown authority fields and unsupported trade symbols are rejected", () => {
  throws(() => validate({ ...base, execute: true }), "INVALID_PAPER_SCENARIO");
  throws(() => validate({ ...base, plan: { ...base.plan, winProbability: 0.9 } }), "INVALID_PAPER_PLAN");
  throws(() => validate({ ...base, contract: { ...base.contract, symbol: "SPY" } }), "INVALID_OPTION_CONTRACT");
});
test("a quote must belong to the frozen option contract", () => {
  throws(() => validate(replaceQuote(base, 1, { contractId: "IBIT:2026-10-16:CALL:50000" })), "OPTION_QUOTE_CONTRACT_MISMATCH");
});
test("the tactical DTE boundary accepts 14 and 45 days but rejects 13 and 46", () => {
  const withDte = (days: number) => {
    const expiryDate = new Date(Date.parse(base.plan.createdAt) + days * 86400000).toISOString().slice(0, 10);
    const contractId = `${base.contract.symbol}:${expiryDate}:${base.contract.optionType}:${base.contract.strikePriceCents}`;
    return { ...base, contract: { ...base.contract, contractId, expiryDate }, quotes: base.quotes.map((quote) => ({ ...quote, contractId })) };
  };
  truth(validate(withDte(14))); truth(validate(withDte(45)));
  throws(() => validate(withDte(13)), "UNSUPPORTED_PAPER_TACTICAL_DTE");
  throws(() => validate(withDte(46)), "UNSUPPORTED_PAPER_TACTICAL_DTE");
});
test("risk rejects oversize premiums without modifying the account", () => {
  const value = { ...base, plan: { ...base.plan, entryLimitPerShareCents: 50 },
    quotes: base.quotes.map((quote) => ({ ...quote, bidPerShareCents: 49, askPerShareCents: 50 })) };
  const { result, trade } = onlyTrade(value);
  equal(trade.status, "NO_TRADE"); truth(trade.blockers.includes("PLANNED_RISK_BUDGET_EXCEEDED"));
  truth(trade.blockers.includes("LEGACY_MAX_LOSS_LIMIT_EXCEEDED")); equal(result.account.equityCents, 100000);
});
test("adverse modeled exit slippage is charged once and net targets cover costs", () => {
  const value = { ...base, plan: { ...base.plan, entryLimitPerShareCents: 18, exitSlippagePerShareCents: 1 },
    quotes: base.quotes.map((quote, index) => ({ ...quote, bidPerShareCents: index < 2 ? 17 : 29, askPerShareCents: index < 2 ? 18 : 30 })) };
  const { trade } = onlyTrade(value);
  equal(trade.status, "CLOSED"); equal(trade.plannedRiskCents, 480); equal(trade.exit?.pricePerShareCents, 28);
  equal(trade.netPnlCents, 980); truth(trade.netPnlCents! >= 2 * trade.plannedRiskCents!);
  equal(trade.review?.input.feesCents, 20);
});
test("an exact duplicate quote id is idempotent and does not duplicate fills", () => {
  const duplicated = { ...base, quotes: [base.quotes[0]!, base.quotes[1]!, base.quotes[1]!, base.quotes[2]!] };
  equal(validate(duplicated).quotes.length, 3); equal(replay([duplicated]), replay([base]));
});
test("a conflicting quote id fails instead of replacing historical evidence", () => {
  const conflicting = { ...base, quotes: [...base.quotes, { ...base.quotes[2]!, bidPerShareCents: 28 }] };
  throws(() => validate(conflicting), "CONFLICTING_PAPER_QUOTE_ID");
});
test("unique quotes sharing a receipt timestamp are rejected", () => {
  const value = replaceQuote(base, 1, { receivedAt: base.quotes[2]!.receivedAt });
  throws(() => validate(value), "PAPER_QUOTE_TIME_ORDER");
});
test("future-received quotes cannot influence an earlier as-of state", () => {
  throws(() => validate({ ...base, asOf: "2026-09-08T14:01:59.999Z" }), "PAPER_QUOTE_TIME_ORDER");
});
test("entry evidence must already be received when the plan is frozen", () => {
  throws(() => validate(replaceQuote(base, 0, { receivedAt: "2026-09-08T14:00:00.001Z" })), "ENTRY_EVIDENCE_FROM_FUTURE");
});
test("different origins or sources cannot be spliced into a single quote path", () => {
  throws(() => validate(replaceQuote(base, 1, { sourceId: "synthetic:other" })), "MIXED_PAPER_QUOTE_ORIGINS");
  throws(() => validate(replaceQuote(base, 1, { sourceId: "import:other", origin: "UNVERIFIED_IMPORT" })), "MIXED_PAPER_QUOTE_ORIGINS");
});
test("nonadvancing observation times are ignored even when later received", () => {
  const value = replaceQuote(base, 1, { observedAt: base.quotes[0]!.observedAt, receivedAt: "2026-09-08T14:00:01.000Z" });
  const { trade } = onlyTrade(value);
  equal(trade.entry, null); equal(trade.status, "CANCELLED");
  truth(trade.events.some((event) => event.type === "NON_ADVANCING_QUOTE_IGNORED"));
});
test("paper scenario validation copies frozen thesis and quote snapshots", () => {
  const raw = structuredClone(base); const validated = validate(raw);
  truth(Object.isFrozen(validated)); truth(Object.isFrozen(validated.plan)); truth(Object.isFrozen(validated.plan.thesis));
  truth(Object.isFrozen(validated.quotes)); truth(Object.isFrozen(validated.quotes[0]));
  truth(validated.plan !== raw.plan); truth(validated.quotes[0] !== raw.quotes[0]);
});
test("duplicate scenario or plan ids cannot cause duplicate money movements", () => {
  throws(() => replay([base, base]), "DUPLICATE_PAPER_PLAN_OR_SCENARIO");
  const next = paperFixture("next", 5);
  throws(() => replay([base, { ...next, plan: { ...next.plan, planId: base.plan.planId } }]), "DUPLICATE_PAPER_PLAN_OR_SCENARIO");
});
test("new scenarios must follow the previous acknowledged as-of time", () => {
  throws(() => replay([base, paperFixture("too-early", 3)]), "PAPER_SCENARIO_TIME_ORDER");
});
test("replaying identical inputs yields identical reports and notebook identities", () => {
  equal(replay([base]), replay([base]));
  const first = append([], base), second = append(first.scenarios, base);
  equal(second.changed, false); equal(replay(second.scenarios), replay(first.scenarios));
});
test("a prior as-of cannot be backfilled to invent a retrospective entry", () => {
  const prior = { ...base, quotes: [base.quotes[0]!], asOf: "2026-09-08T14:01:30.000Z" };
  throws(() => append(append([], prior).scenarios, base), "PAPER_HISTORY_REWRITE_REJECTED");
});
test("quote-path revisions cannot remove or rewrite previously accepted observations", () => {
  const history = append([], base).scenarios;
  throws(() => append(history, { ...base, quotes: base.quotes.slice(0, 2) }), "PAPER_HISTORY_REWRITE_REJECTED");
  throws(() => append(history, lastBid(base, 28)), "PAPER_HISTORY_REWRITE_REJECTED");
});
test("frozen plan or contract changes are rejected rather than relabeling the trade", () => {
  const history = append([], base).scenarios;
  throws(() => append(history, { ...base, plan: { ...base.plan, rewardMultipleMilliR: 1500 } }), "PAPER_HISTORY_REWRITE_REJECTED");
  const alteredContract = { ...base.contract, strikePriceCents: 51000, contractId: "GLD:2026-10-16:CALL:51000" };
  throws(() => append(history, { ...base, contract: alteredContract, quotes: base.quotes.map((quote) => ({ ...quote, contractId: alteredContract.contractId })) }), "PAPER_HISTORY_REWRITE_REJECTED");
});
test("only the most recent scenario may receive a nonidentical revision", () => {
  const history = append(append([], base).scenarios, paperFixture("next", 5)).scenarios;
  throws(() => append(history, { ...base, asOf: "2026-09-08T14:04:30.000Z" }), "PAPER_HISTORY_REWRITE_REJECTED");
});
test("a new scenario cannot displace an unresolved position or entry order", () => {
  for (const prior of [
    { ...base, quotes: base.quotes.slice(0, 2), asOf: "2026-09-08T14:01:30.000Z" },
    { ...base, quotes: [base.quotes[0]!], asOf: "2026-09-08T14:00:30.000Z" },
  ]) throws(() => append(append([], prior).scenarios, paperFixture("new", 5)), "ACTIVE_PAPER_SCENARIO_REQUIRES_RESUME");
});
test("direct replay also blocks a second entry while retaining existing holdings", () => {
  const open = { ...base, quotes: base.quotes.slice(0, 2), asOf: "2026-09-08T14:01:30.000Z" };
  const result = replay([open, paperFixture("next", 5)]);
  equal(result.account.openPositionCount, 1); equal(result.trades[1]?.status, "NO_TRADE");
  truth(result.trades[1]?.blockers.includes("PAPER_ACCOUNT_POSITION_OR_ORDER_OPEN"));
  equal(result.account.settledCashCents, 97990); equal(result.account.positionMarkCents, 1900);
});
test("remaining session risk blocks an entry before planned loss would cross its ceiling", () => {
  const result = replay([lastBid(paperFixture("loss-1", 0), 16), lastBid(paperFixture("loss-2", 5), 16), paperFixture("risk-guard", 10)]);
  equal(result.account.realizedPnlCents, -840); equal(result.trades[2]?.status, "NO_TRADE");
  truth(result.trades[2]?.blockers.includes("PAPER_SESSION_RISK_CAPACITY"));
});
test("session loss capacity uses net realized PnL including wins, not gross losses", () => {
  const scenarios = [paperFixture("win", 0), ...[1, 2, 3, 4].map((index) => lastBid(paperFixture(`loss-${index}`, index * 5), 16)), paperFixture("net-guard", 25)];
  const result = replay(scenarios);
  equal(result.trades.slice(0, 5).map((trade) => trade.status), ["CLOSED", "CLOSED", "CLOSED", "CLOSED", "CLOSED"]);
  equal(result.account.realizedPnlCents, -800); equal(result.trades[5]?.status, "NO_TRADE");
  truth(result.trades[5]?.blockers.includes("PAPER_SESSION_RISK_CAPACITY"));
});
test("a gap beyond the session ceiling blocks later entry but never blocks the exit", () => {
  const result = replay([lastBid(paperFixture("gap", 0), 10), paperFixture("guard", 5)]);
  equal(result.trades[0]?.status, "CLOSED"); equal(result.trades[0]?.netPnlCents, -1020);
  equal(result.trades[1]?.status, "NO_TRADE"); truth(result.trades[1]?.blockers.includes("PAPER_SESSION_LOSS_LIMIT"));
});
test("drawdown planned-R capacity remains effective after a new session starts", () => {
  const day = 24 * 60 * 60 * 1000;
  const scenarios = [lastBid(paperFixture("gap-1"), 0), shift(lastBid(paperFixture("gap-2"), 0), day),
    shift(lastBid(paperFixture("gap-3"), 12), day * 2), shift(paperFixture("drawdown-guard"), day * 3)];
  const result = replay(scenarios);
  equal(result.account.realizedPnlCents, -4860); equal(result.account.equityCents, 95140);
  equal(result.trades[3]?.status, "NO_TRADE"); truth(result.trades[3]?.blockers.includes("PAPER_DRAWDOWN_RISK_CAPACITY"));
});
test("a breached high-water drawdown blocks new entry across sessions", () => {
  const day = 24 * 60 * 60 * 1000;
  const scenarios = [0, 1, 2].map((index) => shift(lastBid(paperFixture(`loss-${index}`), 0), index * day));
  const result = replay([...scenarios, shift(paperFixture("guard"), day * 3)]);
  equal(result.account.equityCents, 93940); equal(result.trades[3]?.status, "NO_TRADE");
  truth(result.trades[3]?.blockers.includes("PAPER_DRAWDOWN_LIMIT"));
});
test("41 cash-funded round trips can use their own reservation; proceeds remain unsettled", () => {
  const scenarios = Array.from({ length: 42 }, (_, index) => {
    const value = paperFixture(`cash-${index}`, index * 5);
    return { ...value, plan: { ...value.plan, entryLimitPerShareCents: 24, entryFeeCents: 0, exitFeeCents: 0 },
      quotes: value.quotes.map((quote, offset) => ({ ...quote, bidPerShareCents: offset < 2 ? 23 : 34, askPerShareCents: offset < 2 ? 24 : 35 })) };
  });
  const result = replay(scenarios);
  equal(result.trades.slice(0, 41).filter((trade) => trade.status === "CLOSED").length, 41);
  equal(result.trades[40]?.status, "CLOSED"); equal(result.trades[41]?.status, "NO_TRADE");
  truth(result.trades[41]?.blockers.includes("SETTLED_CASH_INSUFFICIENT"));
  equal(result.account.settledCashCents, 1600); equal(result.account.unsettledCashCents, 139400);
  equal(result.account.realizedPnlCents, 41000); equal(result.account.equityCents, 141000);
});
test("the complete demo reviews every closed win and loss and preserves incomplete outcomes", () => {
  let scenarios: readonly OptionsPaperScenario[] = [];
  for (const value of optionsPaperDemoScenarios()) scenarios = append(scenarios, value).scenarios;
  const result = replay(scenarios);
  equal(result.trades.length, 7); equal(result.reviews.length, 5); equal(result.mistakeNotebook.reviewedTradeCount, 5);
  equal(result.reviews.filter((value) => value.outcome === "WIN").length, 2);
  equal(result.reviews.filter((value) => value.outcome === "LOSS").length, 3);
  equal(result.account.realizedPnlCents, -1000); equal(result.account.equityCents, 99000);
  equal(result.account.openPositionCount, 0); equal(result.account.pendingOrderCount, 0);
  truth(result.trades.filter((trade) => trade.status === "CLOSED").every((trade) => trade.review !== null));
  truth(result.trades.filter((trade) => trade.status !== "CLOSED").every((trade) => trade.review === null));
  equal(result.executionAllowed, false); equal(result.marketValidated, false); equal(result.probability, null);
});
test("accepted outputs are immutable and every event has a contiguous sequence", () => {
  const result = replay([base]);
  truth(Object.isFrozen(result)); truth(Object.isFrozen(result.account)); truth(Object.isFrozen(result.trades[0]?.events));
  const events = result.trades[0]!.events;
  equal(events.map((event) => event.sequence), events.map((_, index) => index + 1));
  equal(paperFingerprint(result), paperFingerprint(replay([base])));
});

console.log(`OptionsPaperTradingEngine: ${passed}/${passed + failed} tests passed.`);
if (failed > 0) throw new Error(`${failed} OptionsPaperTradingEngine tests failed.`);
