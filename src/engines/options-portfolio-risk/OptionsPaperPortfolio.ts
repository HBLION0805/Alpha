import type { OptionsPaperPortfolioInput } from "../../contracts/OptionsPaperPortfolio";
import type { OptionsPaperScenario } from "../../contracts/OptionsPaperTrading";
import type { OptionsPortfolioScenario } from "../../contracts/OptionsPortfolioRisk";
import { freezePaper, paperFingerprint, replayOptionsPaperAccount, validateOptionsPaperScenario } from "../options-paper/OptionsPaperTradingEngine";
import { readinessClock } from "../options-readiness/OptionsReadinessEngine";
import { assessOptionsPortfolioRisk } from "./OptionsPortfolioRiskEngine";

function fail(code: string): never { throw Error("PAPER_PORTFOLIO_" + code); }
const sum = (values: readonly number[]) => {
  const result = Number(values.reduce((a, b) => a + BigInt(b), 0n));
  if (!Number.isSafeInteger(result)) fail("OVERFLOW");
  return result;
};
const definition = (s: OptionsPaperScenario): OptionsPaperScenario => ({ ...s, quotes: [s.quotes[0]!], asOf: s.plan.createdAt });

/** Read-only composition of two unchanged simulation engines. No account transition. */
export function assessOptionsPaperPortfolio(input: unknown) {
  const fields = ["version", "scenarioId", "origin", "asOf", "historyComplete", "modeledCostsReviewed", "history", "candidate", "eventReview"];
  if (!input || typeof input !== "object" || Object.getPrototypeOf(input) !== Object.prototype) fail("SHAPE");
  const descriptors = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(input);
  if (keys.length !== fields.length || keys.some(k => typeof k !== "string" || !fields.includes(k) || !("value" in descriptors[k]!) || !descriptors[k]!.enumerable)) fail("SHAPE");
  const s = input as OptionsPaperPortfolioInput;
  if (s.version !== "OPTIONS_PAPER_PORTFOLIO_INPUT_V1") fail("VERSION");
  readinessClock(s.asOf);
  if (!Array.isArray(s.history) || s.history.length > 500) fail("HISTORY_LIMIT");
  const history = s.history.map(validateOptionsPaperScenario);
  if (history.some(h => h.asOf > s.asOf)) fail("HISTORY_AFTER_ASSESSMENT");
  const paper = replayOptionsPaperAccount(history);
  if (paper.origin !== null && paper.origin !== s.origin) fail("ORIGIN");
  const closedTrades: OptionsPortfolioScenario["closedTrades"][number][] = [];
  const positions: OptionsPortfolioScenario["positions"][number][] = [];
  const pendingEntries: OptionsPaperScenario[] = [];
  const inventory = paper.trades.map((trade, index) => {
    const h = history[index]!;
    let markQuoteId: string | null = null;
    if (trade.status === "CLOSED") {
      if (!trade.review || !trade.exit || !trade.entry) fail("CLOSED_STATE");
      closedTrades.push({ input: trade.review.input, exitFeeCents: h.plan.exitFeeCents, settlement: null });
    } else if (trade.status === "OPEN") {
      if (!trade.entry) fail("OPEN_STATE");
      const latest = h.quotes.at(-1)!;
      // A rejected/non-advancing last quote must not revive an older usable mark.
      const ignored = trade.events.some(e => e.quoteId === latest.quoteId && ["QUOTE_REJECTED", "NON_ADVANCING_QUOTE_IGNORED"].includes(e.type));
      const mark = ignored || latest.receivedAt < trade.entry.at ? null : latest;
      markQuoteId = mark?.quoteId ?? null;
      positions.push({ definition: definition(h), entryAt: trade.entry.at, entryPricePerShareCents: trade.entry.pricePerShareCents, mark });
    } else if (trade.status === "PENDING_ENTRY") pendingEntries.push(definition(h));
    return { tradeId: trade.tradeId, symbol: trade.symbol, status: trade.status, planFingerprint: trade.planFingerprint,
      acknowledgedAsOf: h.asOf, scenarioFingerprint: paperFingerprint(h), markQuoteId,
      pendingExitReason: trade.pendingExitReason, reviewId: trade.review?.reviewId ?? null };
  });
  const projection: OptionsPortfolioScenario = { version: "OPTIONS_PORTFOLIO_SCENARIO_V1", scenarioId: s.scenarioId,
    origin: s.origin, asOf: s.asOf, initialEquityCents: 100000, accountMode: "CASH_SCENARIO",
    historyComplete: s.historyComplete, modeledCostsReviewed: s.modeledCostsReviewed,
    highWaterEquityCents: paper.account.highWaterEquityCents,
    closedTrades, positions, pendingEntries, candidate: s.candidate, eventReview: s.eventReview };
  // This also validates the exact one-quote candidate and all declaration fields.
  const portfolio = assessOptionsPortfolioRisk(projection);
  const preview = s.candidate === null ? null : replayOptionsPaperAccount([...history, s.candidate]);
  const candidate = preview?.trades.at(-1) ?? null;
  if (candidate && (candidate.entry !== null || candidate.exit !== null || !["PENDING_ENTRY", "NO_TRADE"].includes(candidate.status))) fail("CANDIDATE_TRANSITION");
  const exitFeeReclassificationCents = sum(paper.trades.filter(t => t.status === "CLOSED").map(t => Math.min(t.exit!.premiumCents, t.exit!.feeCents)));
  const openExitFeeReservationCents = sum(positions.map(p => p.definition.plan.exitFeeCents));
  const a = paper.account, b = portfolio.account;
  if (b.settledCashCents - a.settledCashCents !== exitFeeReclassificationCents ||
      a.unsettledCashCents - b.unsettledCashCents !== exitFeeReclassificationCents ||
      a.reservedCashCents - b.reservedCashCents !== openExitFeeReservationCents ||
      a.realizedPnlCents !== b.realizedNetPnlCents || paper.reviews.length !== portfolio.reviews.length ||
      a.openPositionCount !== positions.length || a.pendingOrderCount !== pendingEntries.length ||
      portfolio.reviews.some((r, i) => paperFingerprint(r) !== paperFingerprint(paper.reviews[i]))) fail("RECONCILIATION");
  const conservativeAvailableSettledCashCents = Math.min(a.availableCashCents, b.availableSettledCashCents);
  const blockers = [
    ...portfolio.blockers.map(i => ({ source: "PORTFOLIO", ...i })),
    ...(candidate?.blockers ?? []).map(code => ({ source: "PAPER_CANDIDATE", code, subject: candidate!.tradeId })),
  ];
  if (s.candidate !== null) {
    const p = s.candidate.plan, required = sum([p.entryLimitPerShareCents * p.quantity * 100, p.entryFeeCents, p.exitFeeCents]);
    if (required > conservativeAvailableSettledCashCents) blockers.push({ source: "RECONCILIATION", code: "CONSERVATIVE_SETTLED_CASH_INSUFFICIENT", subject: s.candidate.scenarioId });
  }
  const body = { version: "OPTIONS_PAPER_PORTFOLIO_V1", scenarioId: s.scenarioId, origin: s.origin, asOf: s.asOf,
    inputFingerprint: paperFingerprint(s),
    status: candidate === null ? "ACCOUNT_DIAGNOSTICS_ONLY" : blockers.length ? "MODELED_CANDIDATE_BLOCKED" : "MODELED_CANDIDATE_WITHIN_LIMITS",
    blockers, inventory, paper, portfolio, projection: structuredClone(projection),
    candidatePreview: candidate === null ? null : { trade: candidate, previewFingerprint: paperFingerprint(preview), recorded: false },
    reconciliation: { cashAndRealizedPnlMatched: true, exitFeeReclassificationCents, openExitFeeReservationCents,
      totalCashCents: sum([a.settledCashCents, a.unsettledCashCents]), conservativeAvailableSettledCashCents,
      paperEquityCents: a.equityCents, portfolioEquityCents: b.currentEquityCents,
      equityBasis: "PAPER_LAST_ACKNOWLEDGED_SLIPPAGE_MARK_VS_PORTFOLIO_ASSESSMENT_GROSS_QUALIFIED_BID",
      settlementInferred: false, highWaterBasis: "ORIGINAL_MODELED_PATH_NOT_VERIFIED_BROKER_PEAK" },
    limitations: ["Only one declared local paper account is reconstructed. Complete model history is not complete brokerage evidence.",
      "Candidate preview is unrecorded and contains no modeled fill. Original paper and portfolio checks both apply; no account mutation occurs.",
      "Cash buckets retain different fee conventions. The lesser available settled cash is used; elapsed time never settles proceeds.",
      "Portfolio equity can be unknown while paper retains an old or slippage-adjusted mark. Neither is a verified live liquidation value.",
      "ETF opening-price screenshots provide context; they cannot supply missing option bids, asks, quantities or execution evidence.",
      "Costs and manual event coverage remain explicit scenario declarations. Candidate lessons remain candidates; no strategy probability is computed."],
    existingJournalAppends: 0, marketValidated: false, liveAccountInspected: false,
    executionAllowed: false, automaticOrdersEnabled: false, sizeEscalationAllowed: false, winProbability: null };
  return freezePaper({ ...body, reportFingerprint: paperFingerprint(body) });
}
