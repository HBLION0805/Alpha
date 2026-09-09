import type { GuidanceInput } from "../../contracts/OptionsDailyGuidance";
import { assessDailyGuidance } from "./OptionsDailyGuidance";
import { paperFingerprint } from "../options-paper/OptionsPaperTradingEngine";

export interface CandidateChecksInput {
  version: "OPTIONS_CANDIDATE_CHECKS_INPUT_V1";
  guidance: GuidanceInput;
  sourcePaths: string[];
}
type Status = "PASS" | "BLOCKED" | "UNKNOWN";
interface Check { id: string; label: string; status: Status; reasons: string[]; explanation: string; nextAction: string }
const usd = (n: number | null | undefined) => n === null || n === undefined ? "Unknown" : "$" + (n / 100).toFixed(2);
const fail = (code: string): never => { throw Error("CANDIDATE_CHECKS_" + code); };

/** Presentation and audit projection only. Original decisions and economics are unchanged. */
export function assessCandidateChecks(input: CandidateChecksInput) {
  if (!input || Object.keys(input).sort().join() !== "guidance,sourcePaths,version" || input.version !== "OPTIONS_CANDIDATE_CHECKS_INPUT_V1" || !Array.isArray(input.sourcePaths) || input.sourcePaths.length > 60 || new Set(input.sourcePaths).size !== input.sourcePaths.length || input.sourcePaths.some(p => typeof p !== "string" || !/^data\/runtime\/options-daily-guidance\/captures\/\d{4}-\d\d-\d\d\/\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z-[a-f0-9-]{36}\.json$/.test(p))) fail("INPUT");
  const original = assessDailyGuidance(input.guidance), settings = original.settings;
  const rows = original.assets.flatMap(asset => asset.candidates.map(candidate => {
    const q = candidate.contract, e = candidate.feasibility.economics, reasons = candidate.blockers;
    const checks: Check[] = [];
    const add = (id: string, label: string, codes: string[], explanation: string, nextAction: string, unknown = false) => {
      const matched = reasons.filter(b => codes.includes(b));
      checks.push({id, label, status: unknown ? "UNKNOWN" : matched.length ? "BLOCKED" : "PASS", reasons: matched, explanation, nextAction});
    };
    add("capture", "Recorded capture scope", ["MARKET_CAPTURE_MISSING", "MARKET_CAPTURE_PARTIAL", "UNVERIFIED_OR_SYNTHETIC_CAPTURE"], "Recorded origin and bounded sample completeness; not source authentication or full-chain coverage.", "Inspect the next authorized capture and retain missing replies.", !input.guidance.captureAt);
    add("session", "Regular session window", ["OUTSIDE_REGULAR_SESSION"], "Existing New York weekday/time envelope; separate exchange-session qualification is still required.", "Reassess during an eligible regular session with fresh quotes.");
    add("contract", "Contract and expiry policy", ["CONTRACT_OUTSIDE_POLICY", "INVALID_INPUT", "NUMERIC_OVERFLOW"], `${candidate.dte} calendar days to expiry; current policy requires 14–45 days and a standard 100-share contract.`, "Use a supported listed contract; do not widen the policy to admit a cheaper option.");
    add("clocks", "Quote and underlying clocks", ["OPTION_QUOTE_NOT_FRESH", "UNDERLYING_PRICE_NOT_FRESH", "UNDERLYING_OPTION_CLOCK_MISMATCH"], "Existing 120-second freshness/alignment checks; option refresh time is not an independent bid/ask event clock.", "Wait for aligned, current source observations; do not backfill timestamps.", q.updatedAt === null || asset.equity?.sourceAt == null);
    add("spread", "Prices and spread", ["SPREAD_OR_PRICE_UNSUITABLE"], `Bid ${usd(q.bidCents)} / ask ${usd(q.askCents)} per share. Spread must be no more than 10% of ask.`, "Review positive two-sided prices and tick precision; do not use Mark as a fill.", q.bidCents === null || q.askCents === null);
    add("size", "Displayed quote size", ["QUOTE_SIZE_UNKNOWN_OR_ZERO"], `Bid size ${q.bidSize ?? "Unknown"}; ask size ${q.askSize ?? "Unknown"}. These are displayed quantities, not guaranteed availability.`, "Require positive displayed sizes and retain the source timing limitations.", q.bidSize === null || q.askSize === null);
    add("delta", "Delta research range", ["DELTA_OUTSIDE_RESEARCH_RANGE"], `Reported delta ${q.delta ?? "Unknown"}; signed absolute range 0.35–0.70. Delta is not a win probability.`, "Use a supported reported delta; do not substitute a probability estimate.", q.delta === null);
    add("direction", "Trend and attributed context", ["DIRECTION_NOT_CONFIRMED", "NEWS_AND_TREND_NOT_ALIGNED", "ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD", "OPPOSES_OBSERVED_TREND", "HEADLINE_REFRESH_UNAVAILABLE"], `${asset.trend.direction}; ${asset.trend.closes.length} distinct recent closes in the existing trend window.`, "Resolve missing/conflicting trend and source-backed context before considering a direction.", asset.trend.direction === "INSUFFICIENT_HISTORY");
    add("events", "Calendar and event posture", ["CALENDAR_COVERAGE_UNAVAILABLE", "MAJOR_EVENT_WAIT"], "Existing major-event wait windows remain in force.", "Verify calendar coverage and reassess after the existing event wait window.", !input.guidance.calendarAvailable);
    const costsUnknown = settings.roundTripFeesCents === null || settings.slippageReserveCents === null;
    add("costs", "Declared costs", ["COSTS_UNKNOWN"], `Round-trip fee assumption ${usd(settings.roundTripFeesCents)}; exit slippage reserve ${usd(settings.slippageReserveCents)} per contract. Declarations are not verified brokerage charges.`, "Declare sourced or explicitly hypothetical costs in Planning assumptions; blanks remain unknown.", costsUnknown);
    add("allocation", "All-in allocation", ["ALLOCATION_BUDGET_EXCEEDED", "ALLOCATION_BELOW_MINIMUM"], settings.tradeBudget?`Premium ${usd(e?.premiumCents)}; capital required ${usd(e?.capitalRequiredCents)}; owner-declared range ${usd(settings.tradeBudget.minCents)}–${usd(settings.tradeBudget.maxCents)} including fees.`:`Premium ${usd(e?.premiumCents)}; capital required ${usd(e?.capitalRequiredCents)}; 5% allocation ceiling ${usd(e?.applicableAllocationBudgetCents)}.`, settings.tradeBudget?"Review a whole-contract position within the declared range; do not add contracts just to reach the minimum.":"Require one whole contract and its declared costs to fit the unchanged allocation ceiling.", !e || costsUnknown && !reasons.some(b=>["ALLOCATION_BUDGET_EXCEEDED","ALLOCATION_BELOW_MINIMUM"].includes(b)));
    add("loss", "Planned loss and spread friction", ["PLANNED_RISK_BUDGET_EXCEEDED", "STOP_BUDGET_NOT_EXECUTABLE"], `Planned all-in loss ${usd(e?.plannedStopCents)} / budget ${usd(e?.plannedRiskBudgetCents)}; immediate liquidation friction ${usd(e?.immediateLiquidationFrictionCents)}. A stop is not a guaranteed fill.`, "Keep friction and planned loss within the existing risk budget; do not enlarge the stop to force acceptance.", !e || costsUnknown && !reasons.some(b => ["PLANNED_RISK_BUDGET_EXCEEDED", "STOP_BUDGET_NOT_EXECUTABLE"].includes(b)));
    add("stress", "Full-premium stress", ["LEGACY_MAX_LOSS_LIMIT_EXCEEDED"], `Stress loss ${usd(e?.stressLossCents)}; normal full-premium cap ${usd(e?.legacyNormalMaxLossCents)}. This cap is independent of the allocation ceiling.`, "A budget-affordable contract must also fit the unchanged full-premium risk cap.", !e || costsUnknown && !reasons.includes("LEGACY_MAX_LOSS_LIMIT_EXCEEDED"));
    add("reward", "Net reward target", ["PROFIT_TARGET_CAP_EXCEEDED"], `Indicative exit target ${usd(candidate.plan.targetExitCents)} per share for ${settings.rewardMultipleMilliR / 1000}R; net target ${usd(candidate.plan.netTargetCents)}.`, "Retain unknown targets until costs are declared; a calculated target does not establish a fill.", !e || costsUnknown);
    add("cash", "Declared settled cash", ["SETTLED_CASH_INSUFFICIENT"], `Declared cash ${usd(settings.settledCashCents)}. Alpha has not read or verified brokerage buying power.`, "Check the declared cash scenario separately from actual broker account eligibility.", !e || costsUnknown && !reasons.includes("SETTLED_CASH_INSUFFICIENT"));
    const mapped = new Set(checks.flatMap(c => c.reasons)), other = reasons.filter(b => !mapped.has(b));
    if (other.length) checks.push({id:"other", label:"Other original blockers", status:"BLOCKED", reasons:other, explanation:"Unmapped original blockers are retained, never silently dropped.", nextAction:"Review the original decision evidence."});
    const premiumWithinBudget = e ? e.premiumCents <= e.applicableAllocationBudgetCents && (!settings.tradeBudget || e.premiumCents>=settings.tradeBudget.minCents) : null;
    const budgetPosition=e&&settings.tradeBudget?(e.premiumCents>settings.tradeBudget.maxCents?"OVER":e.premiumCents<settings.tradeBudget.minCents?"BELOW":"WITHIN"):"UNKNOWN";
    return {contract:q, dte:candidate.dte, disposition:candidate.disposition, originalBlockers:reasons, premiumWithinBudget, ...(settings.tradeBudget?{budgetPosition}:{}), checks, economics:e, plan:candidate.plan,
      nextActions:[...new Set(checks.filter(c => c.status !== "PASS").map(c => c.nextAction))], paperAdapterQualified:false, executionAllowed:false};
  }));
  return {version:settings.tradeBudget?"OPTIONS_CANDIDATE_CHECKS_V2":"OPTIONS_CANDIDATE_CHECKS_V1", assessedAt:original.assessedAt, capturedAt:original.marketCapturedAt,
    settings, sourcePaths:input.sourcePaths, originalGuidanceFingerprint:paperFingerprint(original), rows,
    counts:{sampled:rows.length, premiumWithinBudget:rows.filter(r => r.premiumWithinBudget === true).length, premiumOverBudget:rows.filter(r => settings.tradeBudget?r.budgetPosition==="OVER":r.premiumWithinBudget === false).length, ...(settings.tradeBudget?{premiumBelowBudget:rows.filter(r=>r.budgetPosition==="BELOW").length}:{}), premiumUnknown:rows.filter(r => r.premiumWithinBudget === null).length, conditionalResearch:rows.filter(r => r.disposition === "CONDITIONAL_RESEARCH").length, blocked:rows.filter(r => r.disposition === "NO_TRADE").length},
    qualification:{status:"NOT_ESTABLISHED", requirements:["Independent option-side and size timing remains unverified.", "Full contract/deliverable and exchange-session evidence requires separate qualification.", "Source-use evidence and a reviewed source-specific paper execution model remain open.", "Account and cost inputs are local declarations; no brokerage account was inspected."], paperAdapterQualified:false},
    scope:settings.tradeBudget?"Latest bounded guidance sample only. Owner-declared allocation range applies; 14–45 DTE policy and independent risk limits remain. Historical close-chain activity remains separate.":"Latest bounded guidance sample only. Existing 14–45 DTE policy, budgets and risk limits are unchanged. Historical close-chain activity remains separate.",
    interpretation:"PASS applies only to the named local check. Conditional research is not an executable recommendation, a qualified fill path or a calibrated edge.",
    executionAllowed:false, winProbability:null, sourceRefresh:false};
}
