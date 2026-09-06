import { createHash } from "node:crypto";
import type {
  OptionsClosedTradeReview, OptionsClosedTradeReviewInput, OptionsMistakeGuardCode,
  OptionsMistakeGuardInput, OptionsMistakeGuardResult, OptionsMistakeNotebook,
  OptionsMistakeNotebookEntry, OptionsTradeCandidateLesson, OptionsTradePlanViolation,
} from "../../contracts/OptionsTradeReview";

const MAX_MONEY_CENTS = 1_000_000_000_000;
const MAX_REVIEW_COUNT = 2000;
const VIOLATIONS: readonly OptionsTradePlanViolation[] = [
  "DATA_INVALID", "COSTS_UNKNOWN", "SPREAD_LIMIT_EXCEEDED", "EXIT_LIQUIDITY_UNAVAILABLE", "PLAN_CHANGED", "RISK_LIMIT_EXCEEDED",
];
const REVIEW_FIELDS = [
  "tradeId", "symbol", "strategyVersion", "setupKey", "origin", "planFingerprint", "entryAt", "exitAt", "exitReason",
  "entryPremiumCents", "exitProceedsCents", "feesCents", "netPnlCents", "plannedRiskCents", "entrySpreadCents",
  "exitLiquidityDelayed", "quoteGapObserved", "planViolations",
];
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}
function digest(value: unknown): string { return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`; }
function record(value: unknown, fields: readonly string[], error: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(error);
  const data = value as Record<string, unknown>;
  if (Object.keys(data).length !== fields.length || Object.keys(data).some((key) => !fields.includes(key))) throw new Error(error);
  return data;
}
function label(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 120
    && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
}
function utc(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
function cents(value: unknown, minimum = 0): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= MAX_MONEY_CENTS;
}
function scope(value: Record<string, unknown>): void {
  if ((value.symbol !== "GLD" && value.symbol !== "IBIT") || !label(value.strategyVersion) || !label(value.setupKey)) {
    throw new Error("INVALID_OPTIONS_REVIEW_SCOPE");
  }
}
const RULE_TEXT: Readonly<Record<OptionsTradePlanViolation, { observation: string; nextCheck: string }>> = freeze({
  DATA_INVALID: { observation: "The record reports a data-validation rule violation.", nextCheck: "Require valid, correctly matched and timely contract quotes before entry." },
  COSTS_UNKNOWN: { observation: "The record reports entry with unqualified costs.", nextCheck: "Require explicit fee and slippage assumptions before entry." },
  SPREAD_LIMIT_EXCEEDED: { observation: "The record reports entry beyond the allowed spread.", nextCheck: "Require the current position spread to fit the frozen maximum." },
  EXIT_LIQUIDITY_UNAVAILABLE: { observation: "The record reports entry without required displayed exit liquidity.", nextCheck: "Require displayed exit-side liquidity; later liquidity can still disappear." },
  PLAN_CHANGED: { observation: "The record reports a frozen-plan violation.", nextCheck: "Require the plan to match its accepted immutable version." },
  RISK_LIMIT_EXCEEDED: { observation: "The record reports a risk-limit violation.", nextCheck: "Require the current account and trade to pass every applicable risk limit." },
});

/** Reviews provided modeled facts; it does not verify a broker fill or infer market causality. */
export function reviewClosedOptionTrade(input: unknown): OptionsClosedTradeReview {
  const data = record(input, REVIEW_FIELDS, "INVALID_CLOSED_OPTION_TRADE_FIELDS");
  scope(data);
  if (!label(data.tradeId) || (data.origin !== "SYNTHETIC_FIXTURE" && data.origin !== "UNVERIFIED_IMPORT")
    || typeof data.planFingerprint !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(data.planFingerprint)
    || !utc(data.entryAt) || !utc(data.exitAt) || data.exitAt <= data.entryAt
    || !["TARGET", "STOP", "TIME_EXIT"].includes(data.exitReason as string)
    || !cents(data.entryPremiumCents, 1) || !cents(data.exitProceedsCents) || !cents(data.feesCents)
    || !cents(data.netPnlCents, -MAX_MONEY_CENTS) || !cents(data.plannedRiskCents, 1) || !cents(data.entrySpreadCents)
    || typeof data.exitLiquidityDelayed !== "boolean" || typeof data.quoteGapObserved !== "boolean"
    || !Array.isArray(data.planViolations) || data.planViolations.length > VIOLATIONS.length
    || data.planViolations.some((code) => !VIOLATIONS.includes(code))
    || new Set(data.planViolations).size !== data.planViolations.length) throw new Error("INVALID_CLOSED_OPTION_TRADE");
  if (BigInt(data.exitProceedsCents) - BigInt(data.entryPremiumCents) - BigInt(data.feesCents) !== BigInt(data.netPnlCents)) {
    throw new Error("CLOSED_OPTION_TRADE_CASH_MISMATCH");
  }
  if (BigInt(data.plannedRiskCents) > BigInt(data.entryPremiumCents) + BigInt(data.feesCents)
    || BigInt(data.entryPremiumCents) + BigInt(data.feesCents) > BigInt(MAX_MONEY_CENTS)) {
    throw new Error("INVALID_CLOSED_OPTION_TRADE_RISK");
  }
  const validated = { ...data, planViolations: [...data.planViolations].sort() } as unknown as OptionsClosedTradeReviewInput;
  const outcome: OptionsClosedTradeReview["outcome"] = validated.netPnlCents > 0 ? "WIN" : validated.netPnlCents < 0 ? "LOSS" : "BREAKEVEN";
  const candidateLessons: OptionsTradeCandidateLesson[] = validated.planViolations.map((code) => ({
    code, classification: "REPORTED_PROCESS_VIOLATION", guardCode: code, ...RULE_TEXT[code],
    causalStatus: "NOT_ESTABLISHED", approvedKnowledge: false,
  }));
  if (validated.exitLiquidityDelayed) candidateLessons.push({
    code: "EXIT_LIQUIDITY_DELAYED", classification: "EXECUTION_RISK_TO_REVIEW", guardCode: "EXIT_LIQUIDITY_UNAVAILABLE",
    observation: "A requested exit waited for suitable bid liquidity in this modeled path.",
    nextCheck: "Check current exit-side liquidity and retain an explicit no-liquidity scenario; an entry check cannot guarantee a later fill.",
    causalStatus: "NOT_ESTABLISHED", approvedKnowledge: false,
  });
  if (validated.quoteGapObserved) candidateLessons.push({
    code: "QUOTE_GAP_OBSERVED", classification: "EXECUTION_RISK_TO_REVIEW", guardCode: "DATA_INVALID",
    observation: "The record reports a gap in the observed quote path; the unobserved path is unknown.",
    nextCheck: "Check current quote validity and preserve gap scenarios; a valid entry quote cannot prevent a future gap.",
    causalStatus: "NOT_ESTABLISHED", approvedKnowledge: false,
  });
  if (validated.netPnlCents < -validated.plannedRiskCents) candidateLessons.push({
    code: "LOSS_EXCEEDED_PLANNED_R", classification: "EXECUTION_RISK_TO_REVIEW", guardCode: "RISK_LIMIT_EXCEEDED",
    observation: "The modeled realized loss exceeded planned cash R; the input does not establish the cause.",
    nextCheck: "Validate current trade and account risk and retain adverse stop-gap stress scenarios; a risk check cannot guarantee a future exit price or loss cap.",
    causalStatus: "NOT_ESTABLISHED", approvedKnowledge: false,
  });
  const facts = [
    `This ${validated.origin} case closed by ${validated.exitReason}.`,
    `Recorded gross PnL is ${validated.exitProceedsCents - validated.entryPremiumCents} cents; fees are ${validated.feesCents} cents; net PnL is ${validated.netPnlCents} cents.`,
    `Planned cash risk is ${validated.plannedRiskCents} cents; entry position spread is ${validated.entrySpreadCents} cents.`,
    validated.planViolations.length === 0 ? "No plan violations were reported; this does not independently prove process compliance."
      : `${validated.planViolations.length} plan violation(s) were reported regardless of the profit outcome.`,
  ];
  if (validated.netPnlCents < -validated.plannedRiskCents) facts.push("The modeled realized loss exceeded planned R; the planned stop was not a guaranteed loss cap.");
  if (outcome === "LOSS" && validated.planViolations.length === 0) facts.push("A losing outcome alone is not classified as a mistake.");
  if (outcome === "WIN" && validated.planViolations.length > 0) facts.push("A profitable outcome does not remove the reported process violations.");
  const body = {
    schemaVersion: "1.0" as const, reviewId: `review:${digest(validated).slice(7)}`, input: validated, outcome,
    grossPnlCents: validated.exitProceedsCents - validated.entryPremiumCents,
    realizedR: validated.netPnlCents / validated.plannedRiskCents,
    processAssessment: validated.planViolations.length > 0 ? "VIOLATIONS_REPORTED" as const : "NO_VIOLATIONS_REPORTED" as const,
    facts, hypotheses: [
      "The recorded exit mechanism explains the accounting outcome, not why the market moved.",
      "Trend, timing, volatility and news explanations require separate point-in-time evidence and comparative outcomes; no causal attribution is established here.",
      "One outcome cannot establish a win probability, approved strategy knowledge or a reason to change risk or timeframe weights.",
    ], candidateLessons, evidenceClassification: "LOCAL_ENGINEERING_CASE" as const,
    winProbability: null, approvedKnowledge: false as const, executionAllowed: false as const,
  };
  return freeze({ ...body, fingerprint: digest(body) });
}

function validateReview(input: unknown): OptionsClosedTradeReview {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_OPTIONS_TRADE_REVIEW");
  const recreated = reviewClosedOptionTrade((input as Record<string, unknown>).input);
  if (canonical(input) !== canonical(recreated)) throw new Error("OPTIONS_TRADE_REVIEW_INTEGRITY_FAILURE");
  return recreated;
}

/** Rebuilds the notebook from validated reviews; duplicates never increase occurrences. */
export function getOptionsMistakeNotebook(reviews: readonly OptionsClosedTradeReview[]): OptionsMistakeNotebook {
  if (!Array.isArray(reviews) || reviews.length > MAX_REVIEW_COUNT) throw new Error("INVALID_OPTIONS_REVIEW_COLLECTION");
  const distinct = new Map<string, OptionsClosedTradeReview>();
  for (const raw of reviews) {
    const review = validateReview(raw);
    const previous = distinct.get(review.input.tradeId);
    if (previous && previous.fingerprint !== review.fingerprint) throw new Error("OPTIONS_TRADE_ID_CONFLICT");
    distinct.set(review.input.tradeId, review);
  }
  const ordered = [...distinct.values()].sort((a, b) => a.input.exitAt.localeCompare(b.input.exitAt) || a.input.tradeId.localeCompare(b.input.tradeId));
  const grouped = new Map<string, OptionsMistakeNotebookEntry>();
  for (const review of ordered) {
    for (const lesson of review.candidateLessons) {
      const binding = { symbol: review.input.symbol, strategyVersion: review.input.strategyVersion, setupKey: review.input.setupKey, code: lesson.code };
      const lessonId = `lesson:${digest(binding).slice(7)}`;
      const previous = grouped.get(lessonId);
      const supportingTradeIds = [...(previous?.supportingTradeIds ?? []), review.input.tradeId];
      grouped.set(lessonId, {
        lessonId, ...binding, classification: lesson.classification, guardCode: lesson.guardCode,
        observation: lesson.observation, nextCheck: lesson.nextCheck, firstRecordedAt: previous?.firstRecordedAt ?? review.input.exitAt,
        lastRecordedAt: review.input.exitAt, supportingTradeIds, occurrenceCount: supportingTradeIds.length,
        causalStatus: "NOT_ESTABLISHED", approvedKnowledge: false,
      });
    }
  }
  const body = {
    schemaVersion: "1.0" as const, reviewedTradeCount: ordered.length, reviews: ordered,
    entries: [...grouped.values()].sort((a, b) => a.lessonId.localeCompare(b.lessonId)), executionAllowed: false as const,
  };
  return freeze({ ...body, fingerprint: digest(body) });
}

/** Objective checks remain active without losses; historical lesson links are scope- and time-qualified. */
export function evaluateOptionsMistakeGuard(notebook: OptionsMistakeNotebook, input: unknown): OptionsMistakeGuardResult {
  if (notebook === null || typeof notebook !== "object" || Array.isArray(notebook)) throw new Error("INVALID_OPTIONS_MISTAKE_NOTEBOOK");
  const checked = getOptionsMistakeNotebook(notebook.reviews);
  if (canonical(notebook) !== canonical(checked)) throw new Error("OPTIONS_MISTAKE_NOTEBOOK_INTEGRITY_FAILURE");
  const data = record(input, ["symbol", "strategyVersion", "setupKey", "asOf", "dataValid", "costsKnown", "exitLiquidityAvailable", "entrySpreadCents", "maxEntrySpreadCents", "planUnchanged", "riskWithinLimits"], "INVALID_OPTIONS_MISTAKE_GUARD_FIELDS");
  scope(data);
  if (!utc(data.asOf) || !cents(data.entrySpreadCents) || !cents(data.maxEntrySpreadCents)
    || ["dataValid", "costsKnown", "exitLiquidityAvailable", "planUnchanged", "riskWithinLimits"].some((key) => typeof data[key] !== "boolean")) {
    throw new Error("INVALID_OPTIONS_MISTAKE_GUARD");
  }
  const request = data as unknown as OptionsMistakeGuardInput;
  // Reconstruct support from closed trades known by the decision clock, not merely
  // a lesson's earliest occurrence. Future corroboration is not historical evidence.
  const available = getOptionsMistakeNotebook(checked.reviews.filter((review) => review.input.exitAt <= request.asOf));
  const applicable = available.entries.filter((lesson) => lesson.symbol === request.symbol && lesson.strategyVersion === request.strategyVersion
    && lesson.setupKey === request.setupKey);
  const conditions: readonly [OptionsMistakeGuardCode, boolean][] = [
    ["DATA_INVALID", request.dataValid], ["COSTS_UNKNOWN", request.costsKnown],
    ["SPREAD_LIMIT_EXCEEDED", request.entrySpreadCents <= request.maxEntrySpreadCents],
    ["EXIT_LIQUIDITY_UNAVAILABLE", request.exitLiquidityAvailable], ["PLAN_CHANGED", request.planUnchanged],
    ["RISK_LIMIT_EXCEEDED", request.riskWithinLimits],
  ];
  const blockers = conditions.filter(([, passes]) => !passes).map(([code]) => ({
    code, message: RULE_TEXT[code].nextCheck, lessonIds: applicable.filter((lesson) => lesson.guardCode === code).map((lesson) => lesson.lessonId),
  }));
  return freeze({
    schemaVersion: "1.0", status: blockers.length > 0 ? "BLOCKED" : "PASS", applicableLessonIds: applicable.map((lesson) => lesson.lessonId),
    blockers, executionAllowed: false, approvedKnowledge: false, futureLiquidityGuaranteed: false, strategyWeightsChanged: false,
  });
}
