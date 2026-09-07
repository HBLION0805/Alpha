import type { OptionsPortfolioScenario, PortfolioRiskEvent } from "../../contracts/OptionsPortfolioRisk";
import type { OptionsPaperScenario } from "../../contracts/OptionsPaperTrading";
import { validateOptionsPaperScenario, freezePaper, paperFingerprint } from "../options-paper/OptionsPaperTradingEngine";
import { qualifyOptionQuote, validateOptionQuote } from "../options-contract-quote/OptionsContractQuoteEngine";
import { reviewClosedOptionTrade } from "../options-trade-review/OptionsTradeReviewEngine";
import { evaluateOptionsRetailFeasibility } from "../options-retail-feasibility/OptionsRetailFeasibilityEngine";
import { exchangeLocalDate } from "../market-calendar/MarketCalendarValidation";
import { readinessClock, readinessFingerprint } from "../options-readiness/OptionsReadinessEngine";

function fail(code: string): never { throw Error("PORTFOLIO_RISK_" + code); }
const localDate = (at: string) => exchangeLocalDate(at, "America/New_York");
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function exact(value: unknown, fields: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail("SHAPE");
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || keys.some(k => typeof k !== "string" || !fields.includes(k) || !("value" in descriptors[k]!) || !descriptors[k]!.enumerable)) fail("SHAPE");
}
function text(value: unknown) { if (typeof value !== "string" || !value.trim() || value.trim() !== value || value.length > 300 || /[\u0000-\u001f\u007f]/.test(value)) fail("TEXT"); }
function integer(value: unknown, max = 1_000_000_000_000) { if (typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0) || value < 0 || value > max) fail("INTEGER"); }
function array(value: unknown, limit: number) { if (!Array.isArray(value) || value.length > limit) fail("ARRAY_LIMIT"); }
function cents(value: bigint) { const n = Number(value); if (!Number.isSafeInteger(n)) fail("NUMERIC_OVERFLOW"); return n; }
const sum = (values: readonly number[]) => cents(values.reduce((a, b) => a + BigInt(b), 0n));
const budget = (equity: number, bps: number) => cents(BigInt(Math.max(0, equity)) * BigInt(bps) / 10000n);

function validate(input: unknown): OptionsPortfolioScenario {
  exact(input, ["version", "scenarioId", "origin", "asOf", "initialEquityCents", "accountMode", "historyComplete", "modeledCostsReviewed", "highWaterEquityCents", "closedTrades", "positions", "pendingEntries", "candidate", "eventReview"]);
  const s = input as OptionsPortfolioScenario;
  if (s.version !== "OPTIONS_PORTFOLIO_SCENARIO_V1" || !["SYNTHETIC_FIXTURE", "UNVERIFIED_IMPORT"].includes(s.origin) || s.initialEquityCents !== 100000 || !["CASH_SCENARIO", "UNKNOWN"].includes(s.accountMode)) fail("SCOPE");
  text(s.scenarioId); readinessClock(s.asOf);
  if (typeof s.historyComplete !== "boolean" || typeof s.modeledCostsReviewed !== "boolean") fail("DECLARATIONS");
  if (s.highWaterEquityCents !== null) { integer(s.highWaterEquityCents); if (s.highWaterEquityCents < s.initialEquityCents) fail("HIGH_WATER"); }
  array(s.closedTrades, 500); array(s.positions, 100); array(s.pendingEntries, 100);
  const ids = new Set<string>(), plans = new Set<string>(), fingerprints = new Set<string>();
  function identity(id: string, plan: string | null, fingerprint: string) {
    if (ids.has(id) || plan !== null && plans.has(plan) || fingerprints.has(fingerprint)) fail("DUPLICATE_ID");
    ids.add(id); if (plan !== null) plans.add(plan); fingerprints.add(fingerprint);
  }
  function definition(d: OptionsPaperScenario) {
    validateOptionsPaperScenario(d);
    if (d.asOf !== d.plan.createdAt || d.quotes.length !== 1 || d.plan.createdAt > s.asOf || d.quotes[0]!.receivedAt > d.plan.createdAt) fail("DEFINITION_CLOCK_OR_PATH");
    if (d.quotes[0]!.origin !== s.origin) fail("MIXED_ORIGINS"); identity(d.scenarioId, d.plan.planId, paperFingerprint({ contract: d.contract, plan: d.plan }));
  }
  for (const c of s.closedTrades) {
    exact(c, ["input", "exitFeeCents", "settlement"]); const r = reviewClosedOptionTrade(c.input);
    identity(r.input.tradeId, null, r.input.planFingerprint); integer(c.exitFeeCents);
    if (c.exitFeeCents > r.input.feesCents || r.input.exitAt > s.asOf) fail("CLOSED_TRADE_CLOCK_OR_FEES");
    if (r.input.origin !== s.origin) fail("MIXED_ORIGINS");
    if (c.settlement !== null) {
      exact(c.settlement, ["settledAt", "receivedAt", "reference"]); readinessClock(c.settlement.settledAt); readinessClock(c.settlement.receivedAt); text(c.settlement.reference);
      if (c.settlement.settledAt < r.input.exitAt || c.settlement.receivedAt < c.settlement.settledAt) fail("SETTLEMENT_CLOCK");
    }
  }
  for (const p of s.positions) {
    exact(p, ["definition", "entryAt", "entryPricePerShareCents", "mark"]); definition(p.definition); readinessClock(p.entryAt); integer(p.entryPricePerShareCents);
    const d = p.definition;
    if (p.entryAt <= d.plan.createdAt || p.entryAt > d.plan.entryDeadlineAt || p.entryAt > s.asOf || p.entryPricePerShareCents <= 0 || p.entryPricePerShareCents > d.plan.entryLimitPerShareCents || p.entryPricePerShareCents % d.contract.minimumPriceTickCents !== 0) fail("DECLARED_ENTRY");
    if (p.mark !== null) { validateOptionQuote(p.mark, d.contract); if (p.mark.origin !== s.origin) fail("MIXED_ORIGINS"); }
  }
  for (const d of s.pendingEntries) definition(d);
  if (s.candidate !== null) { definition(s.candidate); if (s.candidate.plan.createdAt !== s.asOf) fail("CANDIDATE_CLOCK"); }
  if (s.eventReview !== null) {
    const e = s.eventReview; exact(e, ["receivedAt", "coverageStartAt", "coverageEndAt", "reference", "events"]);
    for (const at of [e.receivedAt, e.coverageStartAt, e.coverageEndAt]) readinessClock(at); text(e.reference); array(e.events, 100);
    if (e.coverageStartAt > e.coverageEndAt || e.receivedAt > s.asOf) fail("EVENT_REVIEW_CLOCK");
    const eventIds = new Set<string>();
    for (const event of e.events) {
      exact(event, ["eventId", "symbols", "receivedAt", "reference", "precision", ...(event.precision === "INSTANT" ? ["startAt", "endAt"] : ["startDate", "endDate"])]);
      text(event.eventId); text(event.reference); readinessClock(event.receivedAt); array(event.symbols, 2);
      if (!event.symbols.length || event.symbols.some(v => v !== "GLD" && v !== "IBIT") || new Set(event.symbols).size !== event.symbols.length || eventIds.has(event.eventId)) fail("EVENT_SCOPE_OR_DUPLICATE"); eventIds.add(event.eventId);
      if (event.receivedAt > e.receivedAt) fail("EVENT_REVIEW_CLOCK");
      if (event.precision === "INSTANT") { readinessClock(event.startAt); readinessClock(event.endAt); if (event.startAt > event.endAt) fail("EVENT_INTERVAL"); }
      else if (event.precision === "DATE_ONLY") {
        for (const date of [event.startDate, event.endDate]) { if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("EVENT_DATE"); readinessClock(date + "T00:00:00.000Z"); }
        if (event.startDate > event.endDate) fail("EVENT_INTERVAL");
      } else fail("EVENT_PRECISION");
    }
  }
  return freezePaper(structuredClone(s));
}
interface Exposure { id: string; symbol: "GLD" | "IBIT"; kind: "OPEN" | "PENDING_ENTRY" | "CANDIDATE"; premiumCostCents: number; capitalAtRiskCents: number; originalPlannedRiskCents: number; additionalToStopCents: number | null; capacityRiskCents: number; markCents: number | null; remainingMarkToZeroCents: number | null; definition: OptionsPaperScenario }
interface Issue { code: string; subject: string }

/** Independent local diagnostic; no data fetch, ledger mutation or execution authority. */
export function assessOptionsPortfolioRisk(input: unknown) {
  const s = validate(input), issues: Issue[] = [], block = (code: string, subject = "portfolio") => issues.push({ code, subject });
  if (s.accountMode !== "CASH_SCENARIO") block("ACCOUNT_MODE_UNKNOWN");
  if (!s.historyComplete) block("HISTORY_INCOMPLETE"); if (!s.modeledCostsReviewed) block("MODELED_COSTS_UNREVIEWED");
  if (s.highWaterEquityCents === null) block("HIGH_WATER_UNKNOWN");
  const cashEvents: { at: string; id: string; deltaCents: number; kind: string }[] = [];
  const reviews = s.closedTrades.map(c => reviewClosedOptionTrade(c.input));
  let unsettled = 0;
  const receipts = s.closedTrades.map(c => {
    const r = c.input, entryFee = r.feesCents - c.exitFeeCents, net = r.exitProceedsCents - c.exitFeeCents;
    cashEvents.push({ at: r.entryAt, id: r.tradeId, deltaCents: -sum([r.entryPremiumCents, entryFee]), kind: "DECLARED_ENTRY_DEBIT" });
    if (net < 0) cashEvents.push({ at: r.exitAt, id: r.tradeId, deltaCents: net, kind: "NET_EXIT_FEE_DEBIT" });
    const recognized = c.settlement !== null && c.settlement.receivedAt <= s.asOf;
    if (recognized && net > 0) cashEvents.push({ at: c.settlement!.receivedAt, id: r.tradeId, deltaCents: net, kind: "DECLARED_SETTLEMENT_CREDIT" });
    else if (net > 0) unsettled = sum([unsettled, net]);
    return { tradeId: r.tradeId, netProceedsCents: net, state: net <= 0 ? "NO_POSITIVE_RECEIVABLE" : recognized ? "DECLARED_SETTLED" : "UNSETTLED", settlementRecognized: recognized, declaration: c.settlement };
  });
  const exposures: Exposure[] = [], today = localDate(s.asOf);
  function amounts(d: OptionsPaperScenario, price: number) {
    const premium = cents(BigInt(price) * BigInt(d.plan.quantity) * 100n), fees = sum([d.plan.entryFeeCents, d.plan.exitFeeCents]);
    const slippage = cents(BigInt(d.plan.exitSlippagePerShareCents) * BigInt(d.plan.quantity) * 100n);
    return { premiumCostCents: premium, capitalAtRiskCents: sum([premium, fees]), originalPlannedRiskCents: sum([budget(premium, d.plan.stopLossBps), fees, slippage]) };
  }
  for (const p of s.positions) {
    const d = p.definition, a = amounts(d, p.entryPricePerShareCents), id = d.scenarioId;
    cashEvents.push({ at: p.entryAt, id, deltaCents: -sum([a.premiumCostCents, d.plan.entryFeeCents]), kind: "DECLARED_OPEN_ENTRY_DEBIT" });
    let markCents: number | null = null;
    if (p.mark === null) block("POSITION_MARK_MISSING", id);
    else {
      const qualified = qualifyOptionQuote(p.mark, d.contract, s.asOf);
      if (!qualified.eligible) for (const reason of qualified.reasons) block(reason, id);
      if (p.mark.bidSizeContracts < d.plan.quantity || p.mark.bidPerShareCents === 0) block("POSITION_EXIT_LIQUIDITY_UNKNOWN", id);
      if (qualified.eligible && p.mark.bidSizeContracts >= d.plan.quantity && p.mark.bidPerShareCents > 0) markCents = cents(BigInt(p.mark.bidPerShareCents) * BigInt(d.plan.quantity) * 100n);
    }
    // Difference between current net mark and the original net stop endpoint.
    const additional = markCents === null ? null : Math.max(0, sum([markCents, -d.plan.exitFeeCents, -a.premiumCostCents, -d.plan.entryFeeCents, a.originalPlannedRiskCents]));
    if (markCents !== null) {
      const liquidationPnl = sum([markCents, -a.premiumCostCents, -d.plan.entryFeeCents, -d.plan.exitFeeCents, -d.plan.exitSlippagePerShareCents * d.plan.quantity * 100]);
      // Match the existing paper plan: round toward an earlier stop on the
      // contract's tick grid, rather than widening the stop to fit raw R.
      const tick = BigInt(d.contract.minimumPriceTickCents), denominator = 10000n * tick;
      const stopBid = cents((BigInt(p.entryPricePerShareCents) * BigInt(10000 - d.plan.stopLossBps) + denominator - 1n) / denominator * tick);
      if (p.mark!.bidPerShareCents <= stopBid) block("POSITION_PLANNED_STOP_REACHED", id);
      const target = cents((BigInt(a.originalPlannedRiskCents) * BigInt(d.plan.rewardMultipleMilliR) + 999n) / 1000n);
      if (liquidationPnl >= target) block("POSITION_PROFIT_TARGET_EXIT_UNCONFIRMED", id);
    }
    exposures.push({ id, symbol: d.contract.symbol, kind: "OPEN", ...a, additionalToStopCents: additional,
      capacityRiskCents: Math.max(a.originalPlannedRiskCents, additional ?? 0), markCents, remainingMarkToZeroCents: markCents, definition: d });
    if (s.asOf >= d.plan.timeExitAt) block("POSITION_TIME_EXIT_OVERDUE", id);
    if (localDate(p.entryAt) !== today) block("OVERNIGHT_POSITION_UNRESOLVED", id);
  }
  for (const [kind, definitions] of [["PENDING_ENTRY", s.pendingEntries], ["CANDIDATE", s.candidate ? [s.candidate] : []]] as const) {
    for (const d of definitions) {
      const a = amounts(d, d.plan.entryLimitPerShareCents);
      exposures.push({ id: d.scenarioId, symbol: d.contract.symbol, kind, ...a, additionalToStopCents: a.originalPlannedRiskCents, capacityRiskCents: a.originalPlannedRiskCents, markCents: null, remainingMarkToZeroCents: null, definition: d });
      if (kind === "PENDING_ENTRY" && s.asOf > d.plan.entryDeadlineAt) block("PENDING_ORDER_EXPIRY_UNCONFIRMED", d.scenarioId);
    }
  }
  for (const e of exposures) if (e.definition.contract.expiryDate <= today) block("EXPIRY_OR_EXERCISE_EXPOSURE_UNRESOLVED", e.id);
  cashEvents.sort((a, b) => compare(a.at, b.at) || (a.deltaCents < 0 ? 0 : 1) - (b.deltaCents < 0 ? 0 : 1) || compare(a.id, b.id));
  let settled = s.initialEquityCents as number, minimumSettled = settled;
  for (const event of cashEvents) { settled = sum([settled, event.deltaCents]); minimumSettled = Math.min(minimumSettled, settled); }
  if (minimumSettled < 0) block("HISTORICAL_SETTLED_CASH_DEFICIT");
  const open = exposures.filter(e => e.kind === "OPEN"), pending = exposures.filter(e => e.kind === "PENDING_ENTRY"), incumbent = exposures.filter(e => e.kind !== "CANDIDATE");
  const reserved = sum(pending.map(e => e.capitalAtRiskCents)), available = settled - reserved;
  if (available < 0) block("PENDING_RESERVATIONS_EXCEED_SETTLED_CASH");
  const equity = open.some(e => e.markCents === null) ? null : sum([settled, unsettled, ...open.map(e => e.markCents! - e.definition.plan.exitFeeCents)]);
  if (equity === null) block("CURRENT_EQUITY_UNKNOWN"); else if (equity <= 0) block("EQUITY_NONPOSITIVE");
  const sortedReviews = [...reviews].sort((a, b) => compare(a.input.exitAt, b.input.exitAt) || compare(a.input.tradeId, b.input.tradeId));
  const realized = sum(reviews.map(r => r.input.netPnlCents)), daily = sum(reviews.filter(r => localDate(r.input.exitAt) === today).map(r => r.input.netPnlCents));
  let realizedCurve = s.initialEquityCents as number, knownHigh = realizedCurve, streak: number | null = 0;
  for (let i = 0; i < sortedReviews.length;) {
    const at = sortedReviews[i]!.input.exitAt, group = [];
    while (i < sortedReviews.length && sortedReviews[i]!.input.exitAt === at) group.push(sortedReviews[i++]!.input.netPnlCents);
    realizedCurve = sum([realizedCurve, ...group]); knownHigh = Math.max(knownHigh, realizedCurve);
    const losses = group.filter(pnl => pnl < 0).length;
    streak = losses === 0 ? 0 : losses !== group.length || streak === null ? null : streak + losses;
  }
  if (equity !== null && equity !== sum([s.initialEquityCents, realized, ...open.map(e => e.markCents! - e.definition.plan.exitFeeCents - e.premiumCostCents - e.definition.plan.entryFeeCents)])) fail("CASH_RECONCILIATION");
  const highWater = s.highWaterEquityCents === null ? null : Math.max(s.highWaterEquityCents, knownHigh, equity ?? 0);
  const projectedRisk = sum(exposures.map(e => e.capacityRiskCents)), originalRisk = sum(exposures.map(e => e.originalPlannedRiskCents)), capital = sum(exposures.map(e => e.capitalAtRiskCents));
  const dailyCapacity = sum([1000, daily]);
  if (exposures.length > 1) block("PORTFOLIO_POSITION_OR_ORDER_LIMIT");
  if (capital > 2500) block("PORTFOLIO_FULL_PREMIUM_STRESS_LIMIT");
  if (daily <= -1000) block("PORTFOLIO_DAILY_LOSS_LIMIT");
  if (projectedRisk > dailyCapacity) block("PORTFOLIO_DAILY_RISK_CAPACITY");
  if (equity !== null) {
    if (capital > budget(equity, 500)) block("PORTFOLIO_ALLOCATION_LIMIT");
    if (originalRisk > budget(equity, 50)) block("PORTFOLIO_PLANNED_RISK_LIMIT");
    if (highWater !== null) {
      if (BigInt(equity) * 10000n <= BigInt(highWater) * 9500n) block("PORTFOLIO_DRAWDOWN_LIMIT");
      if (BigInt(equity - projectedRisk) * 10000n < BigInt(highWater) * 9500n) block("PORTFOLIO_DRAWDOWN_RISK_CAPACITY");
    }
  }
  let candidateEconomics = null;
  if (s.candidate !== null && equity !== null && equity > 0) {
    const d = s.candidate, q = d.quotes[0]!;
    for (const reason of qualifyOptionQuote(q, d.contract, s.asOf).reasons) block(reason, d.scenarioId);
    if (q.askSizeContracts < d.plan.quantity || q.bidSizeContracts < d.plan.quantity) block("CANDIDATE_LIQUIDITY_INSUFFICIENT", d.scenarioId);
    if (q.askPerShareCents > d.plan.entryLimitPerShareCents) block("CANDIDATE_ASK_ABOVE_LIMIT", d.scenarioId);
    if (q.askPerShareCents - q.bidPerShareCents > d.plan.maxEntrySpreadPerShareCents) block("CANDIDATE_SPREAD_LIMIT", d.scenarioId);
    candidateEconomics = evaluateOptionsRetailFeasibility({ symbol: d.contract.symbol, strategy: d.contract.optionType === "CALL" ? "LONG_CALL" : "LONG_PUT",
      currentEquityCents: equity, settledCashCents: Math.max(0, available), quantity: d.plan.quantity, contractMultiplier: 100,
      bidPerShareCents: Math.min(q.bidPerShareCents, d.plan.entryLimitPerShareCents), askPerShareCents: d.plan.entryLimitPerShareCents,
      minimumPriceTickCents: d.contract.minimumPriceTickCents, roundTripFeesCents: s.modeledCostsReviewed ? d.plan.entryFeeCents + d.plan.exitFeeCents : null,
      slippageReserveCents: s.modeledCostsReviewed ? d.plan.exitSlippagePerShareCents * d.plan.quantity * 100 : null,
      mode: "NORMAL", stopLossBps: d.plan.stopLossBps, rewardMultipleMilliR: d.plan.rewardMultipleMilliR });
    for (const issue of candidateEconomics.blockers) block(issue.code, d.scenarioId);
  }
  const holdingEnd = exposures.reduce((at, e) => e.definition.plan.timeExitAt > at ? e.definition.plan.timeExitAt : at, s.asOf);
  const eventMatches: { eventId: string; exposureId: string; precision: PortfolioRiskEvent["precision"] }[] = [];
  if (s.eventReview === null) block("EVENT_REVIEW_UNKNOWN");
  else {
    const r = s.eventReview;
    if (localDate(r.receivedAt) !== today || r.coverageStartAt > s.asOf || r.coverageEndAt < holdingEnd) block("EVENT_REVIEW_COVERAGE_INSUFFICIENT");
    for (const event of r.events) for (const e of exposures) {
      const end = e.definition.plan.timeExitAt > s.asOf ? e.definition.plan.timeExitAt : s.asOf;
      const overlap = event.precision === "INSTANT" ? event.startAt <= end && event.endAt >= s.asOf : event.startDate <= localDate(end) && event.endDate >= today;
      if (overlap && event.symbols.includes(e.symbol)) { eventMatches.push({ eventId: event.eventId, exposureId: e.id, precision: event.precision }); block(event.precision === "INSTANT" ? "DECLARED_EVENT_BLACKOUT_OVERLAP" : "DATE_ONLY_EVENT_REQUIRES_REVIEW", e.id); }
    }
  }
  const aggregate = (items: Exposure[]) => ({ count: items.length, fullPremiumAndFeesCents: sum(items.map(e => e.capitalAtRiskCents)), originalPlannedRiskCents: sum(items.map(e => e.originalPlannedRiskCents)), capacityRiskCents: sum(items.map(e => e.capacityRiskCents)), currentMarkToZeroCents: items.some(e => e.kind === "OPEN" && e.markCents === null) ? null : sum(items.filter(e => e.kind === "OPEN").map(e => e.markCents!)) });
  const blockers = [...new Map(issues.map(i => [i.code + ":" + i.subject, i])).values()].sort((a, b) => compare(a.code, b.code) || compare(a.subject, b.subject));
  const payload = { version: "OPTIONS_PORTFOLIO_RISK_V1", scenarioId: s.scenarioId, scenarioSha256: readinessFingerprint(s), origin: s.origin, asOf: s.asOf,
    status: blockers.length ? "SCENARIO_BLOCKED" : "SCENARIO_WITHIN_LIMITS", blockers,
    account: { initialEquityCents: s.initialEquityCents, settledCashCents: settled, unsettledCashCents: unsettled, reservedCashCents: reserved, availableSettledCashCents: available,
      currentEquityCents: equity, minimumHistoricalSettledCashCents: minimumSettled, realizedNetPnlCents: realized, dailyNetPnlCents: daily, dailyDateNewYork: today,
      consecutiveClosedLosses: streak, closedOutcomeOrder: "EXIT_CLOCK_GROUPS_MIXED_SIMULTANEOUS_OUTCOMES_UNKNOWN", effectiveHighWaterEquityCents: highWater, dailyCapacityCents: dailyCapacity,
      allocationBudgetCents: equity === null ? null : budget(equity, 500), plannedRiskBudgetCents: equity === null ? null : budget(equity, 50) },
    incumbent: aggregate(incumbent), withCandidate: aggregate(exposures), byAsset: ["GLD", "IBIT"].map(symbol => ({ symbol, ...aggregate(exposures.filter(e => e.symbol === symbol)) })),
    exposures: exposures.map(({ definition, ...e }) => ({ ...e, planFingerprint: readinessFingerprint({ contract: definition.contract, plan: definition.plan }) })),
    cashEvents, receipts, reviews, eventMatches, candidateEconomics,
    policy: { version: "OPTIONS_PORTFOLIO_RESEARCH_LIMITS_V1", allocationBps: 500, plannedRiskBps: 50, fullPremiumStressCents: 2500, maxPositionsAndOrders: 1, dailyLossCents: 1000, drawdownBps: 500,
      dailyBasis: "NET_REALIZED_NEW_YORK_EXIT_DATE", settlementBasis: "EXPLICIT_DECLARATION_RECEIPT_NOT_ELAPSED_TIME", externalCashFlowsSupported: false, diversificationOffsetAllowed: false },
    limitations: ["All balances, fills, costs, completeness and settlement references are scenario declarations, not inspected broker evidence.",
      "No future settlement schedule, T+1 date, holiday eligibility or buying power is inferred. Settlements are recognized only when their declarations are received.",
      "Marks and projected stop losses are assumptions; gaps, failed exits and exercise can exceed planned risk. Full-premium stress applies only before exercise.",
      "Unseen historical unrealized equity peaks, account-specific permissions, restrictions and positions outside the declared scope remain unverified.",
      "Manual event intervals and date-only overlaps are diagnostics, not calibrated event impact or automatically inferred BLS/FOMC trading windows.",
      "A favorable scenario is not a trade recommendation or an independent probability. No multi-leg, short, partial-fill or stock-exercise accounting is provided."],
    marketValidated: false, liveAccountInspected: false, executionAllowed: false, automaticOrdersEnabled: false, sizeEscalationAllowed: false, winProbability: null };
  return freezePaper({ ...payload, reportSha256: readinessFingerprint(payload) });
}
