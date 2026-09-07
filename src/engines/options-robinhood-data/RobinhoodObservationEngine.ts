import { createHash } from "node:crypto";
import { canonicalizeDeterministicValue } from "../../contracts/DeterministicFingerprint";
import type { MarketCalendarSessionEvidence } from "../../contracts/MarketCalendar";
import { exchangeLocalDate, validateMarketCalendarEvidence } from "../market-calendar/MarketCalendarValidation";
import { assessRobinhoodCapture } from "./RobinhoodCaptureEngine";

type Row = Record<string, unknown>;
type CaptureReport = ReturnType<typeof assessRobinhoodCapture>;
type Quote = CaptureReport["quotes"][number];
interface Call { tool: string; args: Row; data: Row; requestedAt: string; receivedAt: string }
interface ContractIdentity { id: string; symbol: "GLD" | "IBIT"; expiry: string; type: string; strike: number; multiplier: number; fingerprint: string }
export const OBSERVATION_VERSION = "ROBINHOOD_OBSERVATION_V1";
export const OBSERVATION_MAX_FRAMES = 120;
export const observationSha = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
const fingerprint = (v: unknown) => observationSha(canonicalizeDeterministicValue(v));
function fail(code: string): never { throw new Error(`ROBINHOOD_OBSERVATION_${code}`); }
function row(v: unknown): Row { return v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : fail("INVALID_OBJECT"); }
function keys(v: Row, allowed: string[]) { if (Object.keys(v).some(k => !allowed.includes(k))) fail("UNEXPECTED_FIELD"); }
export function observationClock(v: unknown): string {
  if (typeof v !== "string" || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v) fail("INVALID_CLOCK");
  return v;
}
export function observationId(v: unknown): string {
  return typeof v === "string" && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(v) ? v : fail("INVALID_ID");
}
function freeze<T>(v: T): T { if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function parsedCapture(inputText: string, at: string) {
  const report = assessRobinhoodCapture(inputText, at);
  const calls = (JSON.parse(inputText) as { calls: Call[] }).calls;
  const chains = new Map(calls.filter(c => c.tool === "get_option_chains").flatMap(c => (c.data.chains as Row[]).map(v => [v.id as string, v] as const)));
  const contracts: ContractIdentity[] = calls.filter(c => c.tool === "get_option_instruments").flatMap(c => (c.data.instruments as Row[]).map(v => {
    const chain = chains.get(v.chain_id as string)!;
    const identity = { id: v.id, chainId: v.chain_id, symbol: v.chain_symbol, expiry: v.expiration_date, type: v.type,
      strike: Number(v.strike_price), multiplier: Number(v.trade_value_multiplier), underlyingType: v.underlying_type,
      ticks: v.min_ticks, cashComponent: chain.cash_component, underlyingInstruments: chain.underlying_instruments };
    return { id: v.id as string, symbol: v.chain_symbol as "GLD" | "IBIT", expiry: v.expiration_date as string, type: v.type as string,
      strike: Number(v.strike_price), multiplier: Number(v.trade_value_multiplier), fingerprint: fingerprint(identity) };
  }));
  return { report, calls, contracts };
}

/** A sample screen, never a chain-wide search, trade selection or cost estimate. */
export function screenRobinhoodCaptures(inputTexts: readonly string[], assessedAt: string) {
  observationClock(assessedAt);
  if (!Array.isArray(inputTexts) || inputTexts.length < 1 || inputTexts.length > 16) fail("SCREEN_CAPTURE_LIMIT");
  const inputs = inputTexts.map(s => parsedCapture(s, assessedAt));
  if (new Set(inputs.map(v => v.report.captureId)).size !== inputs.length) fail("DUPLICATE_CAPTURE_ID");
  const identities = new Map<string, ContractIdentity>(), latest = new Map<string, { q: Quote | null; receivedAt: string; captureId: string }>();
  for (const input of inputs) {
    for (const contract of input.contracts) {
      const old = identities.get(contract.id);
      if (old && old.fingerprint !== contract.fingerprint) fail("CONTRACT_IDENTITY_CHANGED");
      identities.set(contract.id, contract);
    }
    for (const call of input.calls.filter(c => c.tool === "get_option_quotes")) for (const id of call.args.instrument_ids as string[]) {
      const hasQuote = (call.data.results as Row[]).some(r => r.quote !== null && row(r.quote).instrument_id === id);
      const matches = hasQuote ? input.report.quotes.filter(q => q.instrumentId === id && q.receivedAt === call.receivedAt) : [];
      if (matches.some(q => fingerprint(q) !== fingerprint(matches[0]))) fail("CONFLICTING_QUOTE_RECEIPT");
      const q = matches[0] ?? null, old = latest.get(id);
      if (old && call.receivedAt === old.receivedAt && fingerprint(q) !== fingerprint(old.q)) fail("CONFLICTING_QUOTE_RECEIPT");
      if (!old || call.receivedAt > old.receivedAt) latest.set(id, { q, receivedAt: call.receivedAt, captureId: input.report.captureId });
    }
  }
  const assessmentDate = exchangeLocalDate(assessedAt, "America/New_York");
  const candidates = [...identities.values()].sort((a, b) => a.id.localeCompare(b.id)).map(c => {
    const latestQuote = latest.get(c.id), q = latestQuote?.q, e = q?.budgetScenario?.economics;
    const dte = (Date.parse(c.expiry) - Date.parse(assessmentDate)) / 86400000;
    const blockers = [...(q?.blockers ?? ["MISSING_OPTION_QUOTE"])];
    if (dte < 14 || dte > 45) blockers.push("OUTSIDE_14_TO_45_CALENDAR_DTE");
    if (e && e.grossStopLossCents > e.plannedRiskBudgetCents) blockers.push("PREMIUM_STOP_ALONE_EXCEEDS_PLANNED_RISK");
    if (e && q?.oneContractSpreadCents !== null && q?.oneContractSpreadCents !== undefined &&
      e.grossStopLossCents - q.oneContractSpreadCents < e.oneTickLossCents) blockers.push("SPREAD_LEAVES_LESS_THAN_ONE_TICK_BEFORE_STOP");
    return { ...c, captureId: latestQuote?.captureId ?? null, calendarDte: dte, quote: q ?? null,
      premiumWithinAllocationLowerBound: e ? e.premiumCents <= e.applicableAllocationBudgetCents : null,
      premiumWithinStressLowerBound: e ? e.premiumCents <= e.legacyNormalMaxLossCents : null,
      costHeadroomCents: e ? { allocation: e.applicableAllocationBudgetCents - e.premiumCents,
        fullPremiumStress: e.legacyNormalMaxLossCents - e.premiumCents, plannedRisk: e.plannedRiskBudgetCents - e.grossStopLossCents } : null,
      blockers: [...new Set([...blockers, "COSTS_UNKNOWN", "SAMPLE_IS_NOT_STRATEGY_EVIDENCE"])], eligibleForTrading: false };
  });
  return freeze({ schemaVersion: "1.0", engineVersion: OBSERVATION_VERSION, assessedAt, assessmentDate, status: "NO_TRADE",
    scope: "BOUNDED_DECLARED_SAMPLE", chainCoverageComplete: false, contractCount: candidates.length,
    sourceCaptures: inputs.map(v => ({ captureId: v.report.captureId, sourceSha256: v.report.sourceSha256, declaredOrigin: v.report.declaredOrigin, issues: v.report.captureIssues })),
    candidates, costsVerified: false, winProbability: null, sizeEscalationAllowed: false, executionAllowed: false, tradeCount: 0,
    assumptions: ["USD 1,000 is a hypothetical account; no brokerage balance was read.", "Remaining headroom is not an estimate of actual costs or permission to trade.", "Low premium and provider expiry-profit estimates do not establish target-before-stop odds."] });
}

export interface ObservationPlan {
  schemaVersion: "1.0"; engineVersion: string; studyId: string; frozenAt: string; sourceCaptureSha256: string;
  declaredOrigin: string; contracts: ContractIdentity[]; windowStartAt: string; windowEndAt: string;
  calendar: MarketCalendarSessionEvidence; maxFrames: number; cadenceMs: number; maxGapMs: number;
  quoteFreshnessMs: number; underlyingSkewMs: number; planSha256: string;
  status: "OBSERVATION_ONLY"; executionAllowed: false; declarationAuthenticatedByParser: false;
}
/** The CLI supplies the actual freeze clock; callers cannot set it through plan JSON. */
export function freezeRobinhoodObservationPlan(configText: string, sourceText: string, frozenAt: string): ObservationPlan {
  const frozenMs = Date.parse(observationClock(frozenAt));
  if (new TextEncoder().encode(configText).byteLength > 16384) fail("CONFIG_LIMIT");
  let value: unknown; try { value = JSON.parse(configText); } catch { fail("INVALID_CONFIG_JSON"); }
  const config = row(value); keys(config, ["schemaVersion", "studyId", "instrumentIds", "windowStartAt", "windowEndAt", "calendar"]);
  if (config.schemaVersion !== "1.0") fail("CONFIG_VERSION");
  const studyId = observationId(config.studyId), source = parsedCapture(sourceText, frozenAt);
  const ids = config.instrumentIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 4 || ids.some(id => typeof id !== "string") || new Set(ids).size !== ids.length) fail("SELECTED_CONTRACTS");
  const contracts = ids.map(id => source.contracts.find(c => c.id === id) ?? fail("SELECTED_CONTRACT_NOT_LINKED")).sort((a, b) => a.id.localeCompare(b.id));
  const windowStartAt = observationClock(config.windowStartAt), windowEndAt = observationClock(config.windowEndAt);
  const start = Date.parse(windowStartAt), end = Date.parse(windowEndAt);
  if (start <= frozenMs || end <= start || end - start > 7200000) fail("PROSPECTIVE_WINDOW");
  if (!validateMarketCalendarEvidence([config.calendar], frozenAt).valid) fail("CALENDAR_DECLARATION");
  const calendar = config.calendar as MarketCalendarSessionEvidence;
  if (calendar.timezone !== "America/New_York" || calendar.sessionType !== "REGULAR" || calendar.status !== "SCHEDULED_TRADING_SESSION" ||
      start < Date.parse(calendar.marketOpen) || end > Date.parse(calendar.marketClose) || exchangeLocalDate(windowStartAt, calendar.timezone) !== calendar.sessionDate) fail("REGULAR_SESSION_WINDOW");
  for (const c of contracts) {
    const dte = (Date.parse(c.expiry) - Date.parse(calendar.sessionDate)) / 86400000;
    if (dte < 14 || dte > 45 || c.multiplier !== 100) fail("STUDY_CONTRACT_POLICY");
  }
  const payload = { schemaVersion: "1.0" as const, engineVersion: OBSERVATION_VERSION, studyId, frozenAt,
    sourceCaptureSha256: source.report.sourceSha256, declaredOrigin: source.report.declaredOrigin, contracts, windowStartAt, windowEndAt, calendar,
    maxFrames: OBSERVATION_MAX_FRAMES, cadenceMs: 60000, maxGapMs: 120000, quoteFreshnessMs: 60000, underlyingSkewMs: 10000,
    status: "OBSERVATION_ONLY" as const, executionAllowed: false as const, declarationAuthenticatedByParser: false as const };
  return freeze({ ...payload, planSha256: fingerprint(payload) });
}

interface SourceObservation { instrumentId: string; sourceQuoteAt: string | null; sourceNanoseconds: string | null; valueSha256: string | null;
  blockers: string[]; diagnosticUsable: boolean }
export interface ObservationFrame {
  schemaVersion: "1.0"; engineVersion: string; studyId: string; planSha256: string; sequence: number; captureId: string;
  sourceSha256: string; recordedAt: string; requestedAt: string; receivedAt: string; previousFrameSha256: string | null;
  originalCaptureAssessment: CaptureReport; observations: SourceObservation[]; blockers: string[]; candidateLessons: string[];
  status: "DIAGNOSTIC_GAPS" | "DIAGNOSTICS_PASSED_ONLY"; executionAllowed: false; tradeCount: 0; frameSha256: string;
}
function nanos(v: string | null): bigint | null {
  if (!v || !Number.isFinite(Date.parse(v))) return null;
  const fraction = /\.(\d{1,9})(?:Z|[+-]\d\d:\d\d)$/.exec(v)?.[1] ?? "";
  return BigInt(Date.parse(v)) * 1000000n + BigInt(fraction.padEnd(9, "0").slice(3));
}
const sameSet = (a: unknown, b: readonly string[]) => Array.isArray(a) && a.length === b.length && new Set(a).size === a.length && b.every(v => a.includes(v));
function checkPlanAndFrames(plan: ObservationPlan, frames: readonly ObservationFrame[]) {
  const { planSha256, ...payload } = plan;
  if (fingerprint(payload) !== planSha256 || plan.engineVersion !== OBSERVATION_VERSION || plan.maxFrames !== OBSERVATION_MAX_FRAMES ||
    plan.cadenceMs !== 60000 || plan.maxGapMs !== 120000 || plan.quoteFreshnessMs !== 60000 || plan.underlyingSkewMs !== 10000 || plan.executionAllowed !== false) fail("PLAN_INTEGRITY");
  if (frames.length > OBSERVATION_MAX_FRAMES) fail("FRAME_LIMIT");
  for (const [i, frame] of frames.entries()) {
    const { frameSha256, ...body } = frame;
    if (fingerprint(body) !== frameSha256 || frame.sequence !== i + 1 || frame.studyId !== plan.studyId || frame.planSha256 !== planSha256 ||
      frame.previousFrameSha256 !== (frames[i - 1]?.frameSha256 ?? null)) fail("FRAME_INTEGRITY");
  }
}

/** Bad market observations are retained; malformed scope/chronology cannot enter a study. */
export function assessRobinhoodObservationFrame(plan: ObservationPlan, inputText: string, recordedAt: string, previous: readonly ObservationFrame[]): ObservationFrame {
  checkPlanAndFrames(plan, previous);
  const now = Date.parse(observationClock(recordedAt));
  if (previous.length >= plan.maxFrames) fail("FRAME_LIMIT");
  const source = parsedCapture(inputText, recordedAt), last = previous.at(-1);
  if (source.report.declaredOrigin !== plan.declaredOrigin) fail("ORIGIN_CHANGED");
  if (last && (now < Date.parse(last.recordedAt) || last.studyId !== plan.studyId || last.planSha256 !== plan.planSha256)) fail("FRAME_RECORDING_ORDER");
  if (previous.some(v => v.captureId === source.report.captureId)) fail("DUPLICATE_CAPTURE_ID");
  const ids = plan.contracts.map(c => c.id), symbols = [...new Set(plan.contracts.map(c => c.symbol))].sort();
  if (!sameSet(source.contracts.map(c => c.id), ids)) fail("FROZEN_CONTRACT_SET_CHANGED");
  for (const c of source.contracts) if (plan.contracts.find(p => p.id === c.id)?.fingerprint !== c.fingerprint) fail("CONTRACT_IDENTITY_CHANGED");
  const optionCalls = source.calls.filter(c => c.tool === "get_option_quotes"), equityCalls = source.calls.filter(c => c.tool === "get_equity_quotes");
  if (source.calls.some(c => c.tool === "get_option_historicals") || optionCalls.length !== 1 || equityCalls.length !== 1) fail("FRAME_QUOTE_CALL_SCOPE");
  const optionCall = optionCalls[0]!, equityCall = equityCalls[0]!;
  if (!sameSet(optionCall.args.instrument_ids, ids) || !sameSet(equityCall.args.symbols, symbols)) fail("FRAME_REQUEST_COVERAGE");
  const requestMs = Date.parse(optionCall.requestedAt), receiptMs = Date.parse(optionCall.receivedAt);
  if ([optionCall, equityCall].some(c => Date.parse(c.requestedAt) <= Date.parse(plan.frozenAt))) fail("REQUEST_PREDATES_FREEZE");
  if (last && requestMs - Date.parse(last.requestedAt) < plan.cadenceMs) fail("COLLECTION_CADENCE");
  const blockers = new Set<string>();
  const start = Date.parse(plan.windowStartAt), end = Date.parse(plan.windowEndAt);
  if ([optionCall, equityCall].some(c => Date.parse(c.requestedAt) < start || Date.parse(c.receivedAt) >= end)) blockers.add("OUTSIDE_DECLARED_WINDOW");
  if ([optionCall, equityCall].some(c => now - Date.parse(c.receivedAt) > 120000)) blockers.add("RECORDED_LATE");
  if (requestMs - Math.max(start, last ? Date.parse(last.requestedAt) : start) > plan.maxGapMs) blockers.add("COLLECTION_GAP");
  if (source.report.captureIssues.some(v => v.includes("PAGINATED"))) blockers.add("PAGINATED_CATALOG_UNRESOLVED");
  const observations = plan.contracts.map(contract => {
    const q = source.report.quotes.find(v => v.instrumentId === contract.id), issues = new Set(q?.blockers ?? ["MISSING_OPTION_QUOTE"]);
    // Recording age is tracked separately; receipt freshness is the observation diagnostic.
    issues.delete("STALE_AT_ASSESSMENT");
    const ns = q && !q.blockers.includes("QUOTE_CLOCK_UNKNOWN") ? nanos(q.sourceQuoteAt) : null;
    if (ns !== null && ns > BigInt(receiptMs) * 1000000n) issues.add("QUOTE_CLOCK_IN_FUTURE");
    const sourceAt = ns === null ? null : Number(ns / 1000000n);
    if (sourceAt !== null && (sourceAt < start || sourceAt >= end)) issues.add("SOURCE_OUTSIDE_DECLARED_WINDOW");
    const valueSha256 = q ? fingerprint({ bid: q.bidPerUnitCents, ask: q.askPerUnitCents, bidSize: q.bidSize, askSize: q.askSize }) : null;
    const prior = previous.flatMap(f => f.observations.filter(o => o.instrumentId === contract.id && o.sourceNanoseconds !== null && !o.blockers.includes("QUOTE_CLOCK_IN_FUTURE")));
    const maxPrior = prior.reduce<bigint | null>((max, o) => { const n = BigInt(o.sourceNanoseconds!); return max === null || n > max ? n : max; }, null);
    if (ns !== null && maxPrior !== null && ns < maxPrior) issues.add("SOURCE_CLOCK_REGRESSED");
    const identicalClocks = ns === null ? [] : prior.filter(o => o.sourceNanoseconds === ns.toString());
    if (identicalClocks.length) issues.add(identicalClocks.some(o => o.valueSha256 !== valueSha256) ? "SOURCE_CLOCK_VALUE_CONFLICT" : "REPEATED_SOURCE_OBSERVATION");
    const equity = source.report.equities.find(e => e.symbol === contract.symbol);
    if (!equity) issues.add("MISSING_UNDERLYING_QUOTE");
    else {
      equity.blockers.forEach(v => issues.add(v));
      for (const clock of [equity.bidAt, equity.askAt]) {
        const t = clock === null ? NaN : Date.parse(clock);
        if (!Number.isFinite(t) || t < start || t >= end) issues.add("UNDERLYING_OUTSIDE_DECLARED_WINDOW");
        if (sourceAt === null || !Number.isFinite(t) || Math.abs(t - sourceAt) > plan.underlyingSkewMs) issues.add("UNDERLYING_SOURCE_TIME_SKEW");
      }
    }
    return { instrumentId: contract.id, sourceQuoteAt: q?.sourceQuoteAt ?? null, sourceNanoseconds: ns?.toString() ?? null,
      valueSha256, blockers: [...issues], diagnosticUsable: issues.size === 0 && blockers.size === 0 };
  });
  const codes = new Set([...blockers, ...observations.flatMap(o => o.blockers)]), lessons: string[] = [];
  if ([...codes].some(c => /STALE|CLOCK|RECORDED_LATE/.test(c))) lessons.push("RECEIPT_AND_SOURCE_CLOCKS_ARE_DISTINCT");
  if (codes.has("REPEATED_SOURCE_OBSERVATION") || codes.has("SOURCE_CLOCK_VALUE_CONFLICT")) lessons.push("REPEATED_POLLS_DO_NOT_ADD_INDEPENDENT_EVIDENCE");
  if ([...codes].some(c => /SIZE|MISSING|SKEW|GAP/.test(c))) lessons.push("MISSING_OR_UNALIGNED_DATA_CANNOT_SUPPORT_A_FILL");
  if ([...codes].some(c => /WINDOW/.test(c))) lessons.push("OFF_SESSION_DATA_DOES_NOT_VALIDATE_A_REGULAR_SESSION_PATH");
  if ([...codes].some(c => /PREMIUM|STRESS|ALLOCATION/.test(c))) lessons.push("CHEAPER_CONTRACTS_STILL_REQUIRE_THE_SAME_RISK_CHECKS");
  const payload = { schemaVersion: "1.0" as const, engineVersion: OBSERVATION_VERSION, studyId: plan.studyId, planSha256: plan.planSha256,
    sequence: previous.length + 1, captureId: source.report.captureId, sourceSha256: source.report.sourceSha256, recordedAt,
    requestedAt: optionCall.requestedAt, receivedAt: optionCall.receivedAt, previousFrameSha256: last?.frameSha256 ?? null,
    originalCaptureAssessment: source.report, observations, blockers: [...blockers], candidateLessons: lessons,
    status: observations.every(o => o.diagnosticUsable) ? "DIAGNOSTICS_PASSED_ONLY" as const : "DIAGNOSTIC_GAPS" as const,
    executionAllowed: false as const, tradeCount: 0 as const };
  return freeze({ ...payload, frameSha256: fingerprint(payload) });
}

export function reviewRobinhoodObservationStudy(plan: ObservationPlan, frames: readonly ObservationFrame[], assessedAt: string) {
  checkPlanAndFrames(plan, frames);
  const now = Date.parse(observationClock(assessedAt)), last = frames.at(-1), start = Date.parse(plan.windowStartAt), end = Date.parse(plan.windowEndAt);
  if (now < Date.parse(last?.recordedAt ?? plan.frozenAt)) fail("REVIEW_CLOCK");
  const codes = [...new Set(frames.flatMap(f => [...f.blockers, ...f.observations.flatMap(o => o.blockers)]))];
  const lessons = frames.flatMap(f => f.candidateLessons.map(code => ({ code, firstRecordedAt: f.recordedAt, frameSha256: f.frameSha256,
    status: "CANDIDATE_DATA_QUALITY_RULE", tradeOutcome: null, strategyChangeAllowed: false })));
  const seen = new Set<string>();
  const lastInWindow = [...frames].reverse().find(f => Date.parse(f.requestedAt) >= start && Date.parse(f.receivedAt) < end);
  const gapAtEnd = now >= end && (!lastInWindow || end - Date.parse(lastInWindow.requestedAt) > plan.maxGapMs);
  const stage = now < start ? "WAITING_FOR_WINDOW" : now >= end ? "WINDOW_ENDED" : frames.length >= plan.maxFrames ? "FRAME_LIMIT_REACHED" : "COLLECTING";
  const nextAt = Math.max(start, last ? Date.parse(last.requestedAt) + plan.cadenceMs : start);
  return freeze({ schemaVersion: "1.0", engineVersion: OBSERVATION_VERSION, studyId: plan.studyId, assessedAt, stage,
    frozenAt: plan.frozenAt, planSha256: plan.planSha256, frameCount: frames.length,
    diagnosticUsableObservations: frames.reduce((n, f) => n + f.observations.filter(o => o.diagnosticUsable).length, 0),
    byContract: plan.contracts.map(c => ({ instrumentId: c.id, symbol: c.symbol, frameCount: frames.length,
      usableCount: frames.reduce((n, f) => n + (f.observations.find(o => o.instrumentId === c.id)?.diagnosticUsable ? 1 : 0), 0) })),
    blockers: [...new Set([...(frames.length ? [] : ["NO_PROSPECTIVE_FRAMES"]), ...codes, ...(gapAtEnd ? ["WINDOW_TAIL_GAP"] : []),
      "SIDE_AND_SIZE_EVENT_CLOCKS_UNVERIFIED", "CALENDAR_AND_SOURCE_ARE_LOCAL_DECLARATIONS", "COSTS_AND_ACCOUNT_RULES_UNVERIFIED", "REPLAY_ADAPTER_NOT_IMPLEMENTED"])],
    candidateLessons: lessons.filter(v => { if (seen.has(v.code)) return false; seen.add(v.code); return true; }),
    nextRequestAt: nextAt < end && frames.length < plan.maxFrames && now < end ? new Date(nextAt).toISOString() : null,
    nextRequests: now < end && frames.length < plan.maxFrames ? [
      { tool: "get_option_quotes", args: { instrument_ids: plan.contracts.map(c => c.id) } },
      { tool: "get_equity_quotes", args: { symbols: [...new Set(plan.contracts.map(c => c.symbol))].sort() } },
    ] : [],
    requestReadyNow: now >= nextAt && now < end && frames.length < plan.maxFrames,
    automaticCollectionEnabled: false, status: "NO_REPLAY", executionAllowed: false, tradeCount: 0, winProbability: null });
}
