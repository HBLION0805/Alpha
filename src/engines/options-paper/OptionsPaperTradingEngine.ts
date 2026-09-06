import { createHash } from "node:crypto";
import { canonicalizeDeterministicValue } from "../../contracts/DeterministicFingerprint";
import type { OptionsPaperScenario, OptionsPaperPlan, OptionsPaperEvent, OptionsPaperFill } from "../../contracts/OptionsPaperTrading";
import type { OptionQuote } from "../../contracts/OptionsContractQuote";
import { validateOptionContract, validateOptionQuote, qualifyOptionQuote } from "../options-contract-quote/OptionsContractQuoteEngine";
import { evaluateOptionsRetailFeasibility } from "../options-retail-feasibility/OptionsRetailFeasibilityEngine";
import { reviewClosedOptionTrade, getOptionsMistakeNotebook, evaluateOptionsMistakeGuard } from "../options-trade-review/OptionsTradeReviewEngine";

export function paperFingerprint(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalizeDeterministicValue(value)).digest("hex")}`;
}
export function freezePaper<T>(value: T): T {
  if (value !== null && typeof value === "object") { for (const item of Object.values(value)) freezePaper(item); Object.freeze(value); }
  return value;
}
function record(value: unknown, keys: readonly string[], code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error(code);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== "string" || !keys.includes(key) || !("value" in descriptors[key]!) || !descriptors[key]!.enumerable)) throw new Error(code);
  return value as Record<string, unknown>;
}
function utc(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
function text(value: unknown, max = 400): value is string { return typeof value === "string" && value.trim().length > 0 && value.trim() === value && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value); }
function integer(value: unknown, minimum: number, maximum: number): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum; }
const PLAN_KEYS = ["planId", "strategyVersion", "setupKey", "createdAt", "entryDeadlineAt", "timeExitAt", "entryLimitPerShareCents", "quantity", "stopLossBps", "rewardMultipleMilliR", "entryFeeCents", "exitFeeCents", "exitSlippagePerShareCents", "maxEntrySpreadPerShareCents", "thesis"];

export function validateOptionsPaperScenario(input: unknown): OptionsPaperScenario {
  const value = record(input, ["scenarioId", "contract", "plan", "quotes", "asOf"], "INVALID_PAPER_SCENARIO");
  if (!text(value.scenarioId, 120) || !utc(value.asOf)) throw new Error("INVALID_PAPER_SCENARIO");
  const contract = validateOptionContract(value.contract);
  const plan = record(value.plan, PLAN_KEYS, "INVALID_PAPER_PLAN");
  for (const key of ["planId", "strategyVersion", "setupKey"]) if (!text(plan[key], 120)) throw new Error("INVALID_PAPER_PLAN");
  for (const key of ["createdAt", "entryDeadlineAt", "timeExitAt"]) if (!utc(plan[key])) throw new Error("INVALID_PAPER_PLAN_TIME");
  if (!(plan.createdAt! < plan.entryDeadlineAt! && plan.entryDeadlineAt! < plan.timeExitAt! && plan.createdAt! <= value.asOf)) throw new Error("INVALID_PAPER_PLAN_TIME");
  // A bounded first version: intraday paper plans expire before regular close, well before option expiry.
  if (String(plan.createdAt).slice(0, 10) !== String(plan.timeExitAt).slice(0, 10) || String(plan.timeExitAt).slice(0, 10) >= contract.expiryDate) throw new Error("UNSUPPORTED_PAPER_HOLDING_WINDOW");
  const dte = (Date.parse(`${contract.expiryDate}T00:00:00.000Z`) - Date.parse(`${String(plan.createdAt).slice(0, 10)}T00:00:00.000Z`)) / 86400000;
  if (dte < 14 || dte > 45) throw new Error("UNSUPPORTED_PAPER_TACTICAL_DTE");
  if (!integer(plan.entryLimitPerShareCents, 1, 1000000) || plan.entryLimitPerShareCents % contract.minimumPriceTickCents !== 0
    || !integer(plan.quantity, 1, 100) || !integer(plan.stopLossBps, 1000, 2500) || !integer(plan.rewardMultipleMilliR, 1500, 2000)) throw new Error("INVALID_PAPER_PLAN_ECONOMICS");
  for (const key of ["entryFeeCents", "exitFeeCents", "exitSlippagePerShareCents", "maxEntrySpreadPerShareCents"]) if (!integer(plan[key], 0, 10000)) throw new Error("INVALID_PAPER_PLAN_COSTS");
  if ((plan.exitSlippagePerShareCents as number) % contract.minimumPriceTickCents !== 0) throw new Error("INVALID_PAPER_SLIPPAGE_TICK");
  const thesis = record(plan.thesis, ["direction", "magnitude", "horizon", "volatility", "path", "invalidation", "monthlyContext", "dailySetup", "intradayTrigger"], "INVALID_PAPER_THESIS");
  if (thesis.direction !== (contract.optionType === "CALL" ? "BULLISH" : "BEARISH") || Object.values(thesis).some((field) => !text(field))) throw new Error("INVALID_PAPER_THESIS");
  if (!Array.isArray(value.quotes) || value.quotes.length < 1 || value.quotes.length > 10000) throw new Error("INVALID_PAPER_QUOTE_PATH");
  const quotes: OptionQuote[] = [];
  const ids = new Map<string, string>();
  for (const raw of value.quotes) {
    const quote = validateOptionQuote(raw, contract);
    const fingerprint = paperFingerprint(quote);
    if (ids.has(quote.quoteId)) { if (ids.get(quote.quoteId) !== fingerprint) throw new Error("CONFLICTING_PAPER_QUOTE_ID"); continue; }
    const last = quotes.at(-1);
    if (quote.receivedAt > value.asOf || (last && (quote.receivedAt <= last.receivedAt || quote.observedAt < last.observedAt))) throw new Error("PAPER_QUOTE_TIME_ORDER");
    if (last && (quote.origin !== last.origin || quote.sourceId !== last.sourceId)) throw new Error("MIXED_PAPER_QUOTE_ORIGINS");
    ids.set(quote.quoteId, fingerprint); quotes.push(quote);
  }
  if (quotes[0]!.receivedAt > String(plan.createdAt)) throw new Error("ENTRY_EVIDENCE_FROM_FUTURE");
  const typedPlan = structuredClone(plan) as unknown as OptionsPaperPlan;
  // Declared exit time must itself be inside the conservative regular-session window.
  const exitClockQuote = { ...quotes[0]!, observedAt: typedPlan.timeExitAt, receivedAt: typedPlan.timeExitAt, session: "REGULAR" as const };
  if (!qualifyOptionQuote(exitClockQuote, contract, typedPlan.timeExitAt).eligible) throw new Error("INVALID_PAPER_TIME_EXIT_SESSION");
  return freezePaper({ scenarioId: value.scenarioId, contract, plan: typedPlan, quotes, asOf: value.asOf });
}

type Review = ReturnType<typeof reviewClosedOptionTrade>;
export interface OptionsPaperTradeResult {
  readonly tradeId: string;
  readonly symbol: "GLD" | "IBIT";
  readonly origin: OptionQuote["origin"];
  readonly status: "NO_TRADE" | "CANCELLED" | "PENDING_ENTRY" | "OPEN" | "CLOSED";
  readonly planFingerprint: string;
  readonly plannedRiskCents: number | null;
  readonly entry: OptionsPaperFill | null;
  readonly exit: OptionsPaperFill | null;
  readonly exitReason: "TARGET" | "STOP" | "TIME_EXIT" | null;
  readonly pendingExitReason: "STOP" | "TIME_EXIT" | null;
  readonly netPnlCents: number | null;
  readonly events: readonly OptionsPaperEvent[];
  readonly blockers: readonly string[];
  readonly review: Review | null;
}

/** Local simulation only. Every result is rebuilt from frozen inputs; no brokerage API exists. */
export function replayOptionsPaperAccount(inputs: readonly unknown[]) {
  if (!Array.isArray(inputs) || inputs.length > 1000) throw new Error("PAPER_ACCOUNT_SCENARIO_LIMIT");
  const scenarios = inputs.map(validateOptionsPaperScenario);
  const initialEquityCents = 100000;
  let settledCashCents = initialEquityCents, unsettledCashCents = 0, reservedCashCents = 0, realizedPnlCents = 0;
  let positionMarkCents = 0, positionExitFee = 0, highWaterEquityCents = initialEquityCents;
  let occupied = false, previousAsOf = "", origin: OptionQuote["origin"] | null = null;
  const sessionPnl = new Map<string, number>();
  const scenarioIds = new Set<string>(), planIds = new Set<string>();
  const trades: OptionsPaperTradeResult[] = [], reviews: Review[] = [];
  for (const scenario of scenarios) {
    const { plan, contract, quotes, asOf } = scenario;
    if (scenarioIds.has(scenario.scenarioId) || planIds.has(plan.planId)) throw new Error("DUPLICATE_PAPER_PLAN_OR_SCENARIO");
    if (plan.createdAt < previousAsOf) throw new Error("PAPER_SCENARIO_TIME_ORDER");
    if (origin && origin !== quotes[0]!.origin) throw new Error("MIXED_PAPER_ACCOUNT_ORIGINS");
    origin = quotes[0]!.origin; previousAsOf = asOf; scenarioIds.add(scenario.scenarioId); planIds.add(plan.planId);
    const planFingerprint = paperFingerprint({ contract, plan });
    const events: OptionsPaperEvent[] = [], blockers: string[] = [];
    const emit = (type: string, at: string, amountCents = 0, quoteId: string | null = null, detail = "") => events.push({ sequence: events.length + 1, type, at, quoteId, amountCents, detail });
    const initialQuote = quotes[0]!;
    const qualified = qualifyOptionQuote(initialQuote, contract, plan.createdAt);
    const multiplier = plan.quantity * 100;
    const quoteSpread = (initialQuote.askPerShareCents - initialQuote.bidPerShareCents) * multiplier;
    const equityCents = settledCashCents + unsettledCashCents + positionMarkCents - positionExitFee;
    const economicsFor = (ask: number, bid: number, ownsReservation = false) => evaluateOptionsRetailFeasibility({
      symbol: contract.symbol, strategy: contract.optionType === "CALL" ? "LONG_CALL" : "LONG_PUT",
      currentEquityCents: equityCents, settledCashCents: settledCashCents - (ownsReservation ? 0 : reservedCashCents),
      quantity: plan.quantity, contractMultiplier: 100, bidPerShareCents: Math.min(ask, bid), askPerShareCents: ask,
      minimumPriceTickCents: contract.minimumPriceTickCents, roundTripFeesCents: plan.entryFeeCents + plan.exitFeeCents,
      slippageReserveCents: plan.exitSlippagePerShareCents * multiplier, mode: "NORMAL", stopLossBps: plan.stopLossBps, rewardMultipleMilliR: plan.rewardMultipleMilliR,
    });
    const initialEconomics = economicsFor(plan.entryLimitPerShareCents, initialQuote.bidPerShareCents);
    if (!qualified.eligible) blockers.push(...qualified.reasons);
    if (occupied) blockers.push("PAPER_ACCOUNT_POSITION_OR_ORDER_OPEN");
    if ((sessionPnl.get(plan.createdAt.slice(0, 10)) ?? 0) <= -1000) blockers.push("PAPER_SESSION_LOSS_LIMIT");
    if (equityCents * 10000 <= highWaterEquityCents * 9500) blockers.push("PAPER_DRAWDOWN_LIMIT");
    const plannedR = initialEconomics.economics?.plannedStopCents;
    if (plannedR !== null && plannedR !== undefined) {
      if (plannedR > 1000 + (sessionPnl.get(plan.createdAt.slice(0, 10)) ?? 0)) blockers.push("PAPER_SESSION_RISK_CAPACITY");
      if ((equityCents - plannedR) * 10000 < highWaterEquityCents * 9500) blockers.push("PAPER_DRAWDOWN_RISK_CAPACITY");
    }
    blockers.push(...initialEconomics.blockers.map((block) => block.code));
    const notebook = getOptionsMistakeNotebook(reviews);
    const guard = evaluateOptionsMistakeGuard(notebook, {
      symbol: contract.symbol, strategyVersion: plan.strategyVersion, setupKey: plan.setupKey, asOf: plan.createdAt,
      dataValid: qualified.eligible, costsKnown: true, exitLiquidityAvailable: initialQuote.bidSizeContracts >= plan.quantity,
      entrySpreadCents: quoteSpread, maxEntrySpreadCents: plan.maxEntrySpreadPerShareCents * multiplier,
      planUnchanged: true, riskWithinLimits: initialEconomics.status === "ECONOMICALLY_FEASIBLE_SCENARIO" && !occupied && blockers.length === 0,
    });
    blockers.push(...guard.blockers.map((block) => block.code));
    emit("PLAN_FROZEN", plan.createdAt, 0, initialQuote.quoteId, planFingerprint);
    emit("MISTAKE_CHECK", plan.createdAt, 0, null, JSON.stringify(guard));
    let status: OptionsPaperTradeResult["status"] = "NO_TRADE";
    let entry: OptionsPaperFill | null = null, exit: OptionsPaperFill | null = null;
    let plannedRiskCents: number | null = initialEconomics.economics?.plannedStopCents ?? null;
    let exitReason: "TARGET" | "STOP" | "TIME_EXIT" | null = null, pendingExitReason: "STOP" | "TIME_EXIT" | null = null;
    let review: Review | null = null, netPnlCents: number | null = null;
    let exitLiquidityDelayed = false, quoteGapObserved = false, lastQuote = initialQuote;
    let entrySpreadCents = quoteSpread, stopBidCents = 0, netTargetCents = 0;
    const reserve = initialEconomics.economics?.capitalRequiredCents ?? 0;
    if (blockers.length) emit("ORDER_REJECTED", plan.createdAt, 0, null, [...new Set(blockers)].join(","));
    else {
      occupied = true; status = "PENDING_ENTRY"; reservedCashCents = reserve;
      emit("CASH_RESERVED", plan.createdAt, reserve); emit("LIMIT_ORDER_SUBMITTED", plan.createdAt);
      for (const quote of quotes.slice(1)) {
        if (status === "CLOSED") break;
        const now = quote.receivedAt;
        if (status === "PENDING_ENTRY" && now > plan.entryDeadlineAt) {
          reservedCashCents = 0; occupied = false; status = "CANCELLED";
          emit("ENTRY_EXPIRED", plan.entryDeadlineAt, reserve); break;
        }
        if (status === "OPEN" && now >= plan.timeExitAt && pendingExitReason === null) {
          pendingExitReason = "TIME_EXIT"; emit("EXIT_TRIGGERED", plan.timeExitAt, 0, null, "TIME_EXIT");
        }
        const eligible = qualifyOptionQuote(quote, contract, now);
        if (!eligible.eligible) { emit("QUOTE_REJECTED", now, 0, quote.quoteId, eligible.reasons.join(",")); if (entry) quoteGapObserved = true; continue; }
        if (quote.observedAt <= lastQuote.observedAt) { emit("NON_ADVANCING_QUOTE_IGNORED", now, 0, quote.quoteId); continue; }
        if (entry && Date.parse(quote.observedAt) - Date.parse(lastQuote.observedAt) > 60000) quoteGapObserved = true;
        lastQuote = quote;
        if (status === "PENDING_ENTRY") {
          if (quote.observedAt <= plan.createdAt || quote.askPerShareCents > plan.entryLimitPerShareCents || quote.askSizeContracts < plan.quantity) {
            emit("ENTRY_NOT_FILLED", now, 0, quote.quoteId); continue;
          }
          // Re-evaluate economics against the actual simulated fill and reject deteriorated liquidity.
          const actual = economicsFor(quote.askPerShareCents, quote.bidPerShareCents, true);
          if (actual.status !== "ECONOMICALLY_FEASIBLE_SCENARIO" || quote.bidSizeContracts < plan.quantity
            || quote.askPerShareCents - quote.bidPerShareCents > plan.maxEntrySpreadPerShareCents) {
            emit("ENTRY_QUOTE_RISK_REJECTED", now, 0, quote.quoteId); continue;
          }
          entry = { at: now, quoteId: quote.quoteId, pricePerShareCents: quote.askPerShareCents, quantity: plan.quantity,
            premiumCents: quote.askPerShareCents * multiplier, feeCents: plan.entryFeeCents };
          settledCashCents -= entry.premiumCents + plan.entryFeeCents; reservedCashCents = plan.exitFeeCents;
          positionExitFee = plan.exitFeeCents;
          plannedRiskCents = actual.economics!.plannedStopCents!; netTargetCents = actual.economics!.netProfitTargetCents!;
          // Round toward an earlier stop; never widen the configured percentage to fit the tick grid.
          stopBidCents = Math.ceil(quote.askPerShareCents * (10000 - plan.stopLossBps) / (10000 * contract.minimumPriceTickCents)) * contract.minimumPriceTickCents;
          entrySpreadCents = (quote.askPerShareCents - quote.bidPerShareCents) * multiplier;
          status = "OPEN"; emit("BUY_FILLED", now, entry.premiumCents, quote.quoteId, "Simulated ask fill; displayed size is not an execution guarantee.");
        }
        if (status === "OPEN" && entry) {
          const exitPrice = Math.max(0, quote.bidPerShareCents - plan.exitSlippagePerShareCents);
          positionMarkCents = exitPrice * multiplier;
          if (quote.bidSizeContracts >= plan.quantity) highWaterEquityCents = Math.max(highWaterEquityCents, settledCashCents + unsettledCashCents + positionMarkCents - positionExitFee);
          const netIfSold = positionMarkCents - entry.premiumCents - plan.entryFeeCents - plan.exitFeeCents;
          if (pendingExitReason === null && quote.bidPerShareCents <= stopBidCents) {
            pendingExitReason = "STOP"; emit("EXIT_TRIGGERED", now, 0, quote.quoteId, "STOP");
          }
          // The entry quote cannot also be used to invent an immediate sell fill.
          const reason = pendingExitReason ?? (netIfSold >= netTargetCents ? "TARGET" : null);
          if (reason && quote.quoteId !== entry.quoteId) {
            if (reason === "TIME_EXIT" && quote.observedAt < plan.timeExitAt) { exitLiquidityDelayed = true; emit("EXIT_AWAITING_POST_TRIGGER_QUOTE", now, 0, quote.quoteId); continue; }
            if (quote.bidSizeContracts < plan.quantity) { exitLiquidityDelayed = true; emit("EXIT_AWAITING_LIQUIDITY", now, 0, quote.quoteId, reason); continue; }
            exit = { at: now, quoteId: quote.quoteId, pricePerShareCents: exitPrice, quantity: plan.quantity,
              premiumCents: positionMarkCents, feeCents: plan.exitFeeCents };
            settledCashCents -= plan.exitFeeCents; unsettledCashCents += exit.premiumCents;
            reservedCashCents = 0; positionMarkCents = 0; positionExitFee = 0; occupied = false;
            netPnlCents = exit.premiumCents - entry.premiumCents - plan.entryFeeCents - plan.exitFeeCents;
            realizedPnlCents += netPnlCents; sessionPnl.set(now.slice(0, 10), (sessionPnl.get(now.slice(0, 10)) ?? 0) + netPnlCents);
            highWaterEquityCents = Math.max(highWaterEquityCents, settledCashCents + unsettledCashCents);
            status = "CLOSED"; exitReason = reason; pendingExitReason = null;
            emit("SELL_FILLED", now, exit.premiumCents, quote.quoteId, reason);
            emit("PROCEEDS_UNSETTLED", now, exit.premiumCents, quote.quoteId, "No same-day reuse or synthetic settlement credit.");
            review = reviewClosedOptionTrade({ tradeId: scenario.scenarioId, symbol: contract.symbol,
              strategyVersion: plan.strategyVersion, setupKey: plan.setupKey, origin: quote.origin, planFingerprint,
              entryAt: entry.at, exitAt: exit.at, exitReason, entryPremiumCents: entry.premiumCents,
              exitProceedsCents: exit.premiumCents, feesCents: plan.entryFeeCents + plan.exitFeeCents, netPnlCents,
              plannedRiskCents: plannedRiskCents!, entrySpreadCents, exitLiquidityDelayed, quoteGapObserved, planViolations: [] });
            reviews.push(review); emit("TRADE_REVIEW_RECORDED", now, netPnlCents, null, review.reviewId);
          }
        }
      }
      if (status === "PENDING_ENTRY" && asOf >= plan.entryDeadlineAt) {
        status = "CANCELLED"; occupied = false; reservedCashCents = 0; emit("ENTRY_EXPIRED", plan.entryDeadlineAt, reserve);
      }
      if (status === "OPEN" && asOf >= plan.timeExitAt && pendingExitReason === null) {
        pendingExitReason = "TIME_EXIT"; exitLiquidityDelayed = true; emit("EXIT_TRIGGERED", plan.timeExitAt, 0, null, "TIME_EXIT_AWAITING_FRESH_BID");
      }
      if (status === "OPEN" && asOf.slice(0, 10) >= contract.expiryDate) emit("EXPIRY_EXPOSURE_UNRESOLVED", asOf, 0, null, "No synthetic exercise or fabricated closing fill.");
    }
    trades.push(freezePaper({ tradeId: scenario.scenarioId, symbol: contract.symbol, origin: initialQuote.origin,
      status, planFingerprint, plannedRiskCents, entry, exit, exitReason, pendingExitReason, netPnlCents,
      events, blockers: [...new Set(blockers)], review }));
  }
  const equityCents = settledCashCents + unsettledCashCents + positionMarkCents - positionExitFee;
  if (!occupied && equityCents !== initialEquityCents + realizedPnlCents) throw new Error("PAPER_CASH_RECONCILIATION_FAILURE");
  if (settledCashCents < reservedCashCents || reservedCashCents < 0) throw new Error("PAPER_CASH_RESERVATION_FAILURE");
  return freezePaper({ schemaVersion: "1.0" as const, executionAllowed: false as const, mode: "LOCAL_SIMULATION_ONLY" as const,
    origin, marketValidated: false as const, probability: null, account: { initialEquityCents, settledCashCents, unsettledCashCents,
      reservedCashCents, availableCashCents: settledCashCents - reservedCashCents, positionMarkCents, positionExitFeeCents: positionExitFee,
      equityCents, realizedPnlCents, highWaterEquityCents, openPositionCount: trades.filter((trade) => trade.status === "OPEN").length,
      pendingOrderCount: trades.filter((trade) => trade.status === "PENDING_ENTRY").length },
    trades, reviews, mistakeNotebook: getOptionsMistakeNotebook(reviews),
    limitations: ["Synthetic or unverified imported quotes only; no proven market outcome or calibrated win rate.",
      "Ask-entry/bid-exit matching with displayed size and adverse exit slippage is a simulation assumption, not exchange fill reconstruction.",
      "Regular-session clock checks do not independently verify holidays, broker eligibility or live market status.",
      "One open position; intraday plans only. Proceeds remain unsettled; settlement, exercise and broker order routing are not implemented.",
      "Trend/timeframe thesis fields are frozen scenario inputs, not automatically calculated signals or validated weights.",
      "1% initial-equity net realized session loss and 5% high-water drawdown entry guards are simulation assumptions; new planned R must fit remaining capacity. Gains offset losses in the session counter. Exits are never blocked."] });
}

/** Only the most recent scenario may receive an append-only path/as-of revision. */
export function appendOptionsPaperScenario(history: readonly OptionsPaperScenario[], input: unknown) {
  const candidate = validateOptionsPaperScenario(input);
  const index = history.findIndex((value) => value.scenarioId === candidate.scenarioId);
  if (index < 0) {
    const current = replayOptionsPaperAccount(history);
    if (current.account.openPositionCount || current.account.pendingOrderCount) throw new Error("ACTIVE_PAPER_SCENARIO_REQUIRES_RESUME");
    return freezePaper({ changed: true, scenarios: [...history, candidate] });
  }
  const prior = history[index]!;
  if (paperFingerprint(prior) === paperFingerprint(candidate)) return freezePaper({ changed: false, scenarios: [...history] });
  if (index !== history.length - 1 || paperFingerprint({ contract: prior.contract, plan: prior.plan }) !== paperFingerprint({ contract: candidate.contract, plan: candidate.plan })
    || candidate.asOf < prior.asOf || candidate.quotes.length < prior.quotes.length
    || candidate.quotes.slice(prior.quotes.length).some((quote) => quote.receivedAt <= prior.asOf)
    || prior.quotes.some((quote, offset) => paperFingerprint(quote) !== paperFingerprint(candidate.quotes[offset]))) throw new Error("PAPER_HISTORY_REWRITE_REJECTED");
  return freezePaper({ changed: true, scenarios: [...history.slice(0, -1), candidate] });
}
