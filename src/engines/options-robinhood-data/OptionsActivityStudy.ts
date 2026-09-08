import { assessRobinhoodChainSurvey, parseChainSurveyJson } from "./RobinhoodChainSurvey";
import { freezePaper, paperFingerprint } from "../options-paper/OptionsPaperTradingEngine";
import { readinessClock } from "../options-readiness/OptionsReadinessEngine";
import { btcSourceNanoseconds } from "../options-btc-context/BtcSpotContextEngine";

type Survey = ReturnType<typeof assessRobinhoodChainSurvey>;
type Row = Survey["rows"][number];
export type ActivitySnapshot = { sessionDate: string; sourceText: string; assessedAt: string };
export const ACTIVITY_STUDY_POLICY = freezePaper({
  version: "OPTIONS_ACTIVITY_STUDY_POLICY_V1",
  sessions: ["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-14", "2026-09-15", "2026-09-16"],
  registrationDeadline: "2026-09-08T19:45:00.000Z", entrySession: "2026-09-08", primaryExit: "2026-09-09",
  quoteWindowUtc: ["19:45:00", "20:15:00"], captureWindowUtc: ["20:20:00", "22:00:00"],
  maxControlStrikeDistanceBps: 300, allocationUsd: "50.000000", quantity: 1,
  costs: [
    { id: "SPREAD_ONLY", feePerSideUsd: "0.000000", adversePerShareUsd: "0.000000" },
    { id: "ILLUSTRATIVE_BASE", feePerSideUsd: "0.500000", adversePerShareUsd: "0.010000" },
    { id: "ILLUSTRATIVE_STRESS", feePerSideUsd: "1.000000", adversePerShareUsd: "0.020000" },
  ],
  costStatus: "DECLARED_SENSITIVITY_ASSUMPTIONS_NOT_VERIFIED_BROKER_FEES",
  controlPolicy: "NEAREST_STRIKE_WITHOUT_REPLACEMENT_SAME_SYMBOL_EXPIRY_TYPE_QUOTE_DATE_MONEYNESS",
  interpretation: "INDICATIVE_LONG_OPTION_REFERENCE_RETURNS_NOT_FILLS",
});
const fail = (code: string): never => { throw Error("ACTIVITY_STUDY_" + code); };
const units = (s: string): bigint => { const [a, b = ""] = s.split("."); return BigInt(a!) * 1000000n + BigInt(b.padEnd(6, "0")); };
const usd = (n: bigint): string => (n < 0n ? "-" : "") + ((n < 0n ? -n : n) / 1000000n).toString() + "." + ((n < 0n ? -n : n) % 1000000n).toString().padStart(6, "0");
const abs = (n: bigint) => n < 0n ? -n : n;
const object = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
function hostIso(v: string): string {
  if (!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d UTC$/.test(v)) return fail("HOST_CLOCK");
  const at = v.replace(" ", "T").replace(" UTC", ".000Z"); readinessClock(at); return at;
}
function price(v: unknown): string | null { return typeof v === "string" && /^\d{1,8}(\.\d{1,6})?$/.test(v) && units(v) > 0n ? v : null; }
function side(r: Row, underlying: string): string {
  const strike = units(r.strike), spot = units(underlying);
  return strike === spot ? "ATM" : (r.type === "call" ? strike < spot : strike > spot) ? "ITM" : "OTM";
}
function referenceCloses(source: string, report: Survey) {
  const s = object(parseChainSurveyJson(source)), e = object(s?.equities), response = object(e?.response), data = object(response?.data);
  const results = Array.isArray(data?.results) ? data.results : [];
  return (["GLD", "IBIT"] as const).map(symbol => {
    const matches = results.map(object).map(r => object(r?.close)).filter(c => c?.symbol === symbol);
    const c = matches.length === 1 ? matches[0] : null;
    let valid = false;
    try {
      const received = hostIso(String(e?.receivedAt)), requested = hostIso(String(e?.requestedAt));
      valid = requested <= received && received <= hostIso(report.capturedAt) && c?.interpolated === false &&
        typeof c.date === "string" && /^\d{4}-\d\d-\d\d$/.test(c.date) && new Date(c.date).toISOString().slice(0, 10) === c.date && c.date <= received.slice(0, 10) &&
        price(c.price) !== null && typeof c.source === "string" && c.source.trim().length > 0;
    } catch { valid = false; }
    return { symbol, date: valid ? c!.date as string : null, price: valid ? c!.price as string : null,
      source: valid ? c!.source as string : null, status: valid ? "DECLARED_NONINTERPOLATED_CLOSE" : "UNDERLYING_CLOSE_UNAVAILABLE" };
  });
}
const identity = (r: Row) => ({ id: r.id, symbol: r.symbol, expiry: r.expiry, type: r.type, strike: r.strike, multiplier: r.multiplier });
function sameIdentity(a: ReturnType<typeof identity>, b: Row): boolean {
  return a.id === b.id && a.symbol === b.symbol && a.expiry === b.expiry && a.type === b.type && units(a.strike) === units(b.strike) && units(a.multiplier) === units(b.multiplier);
}

export function freezeOptionsActivityStudy(sourceText: string, baselineAssessedAt: string, registeredAt: string) {
  readinessClock(registeredAt); readinessClock(baselineAssessedAt);
  if (registeredAt >= ACTIVITY_STUDY_POLICY.registrationDeadline || registeredAt < baselineAssessedAt) fail("REGISTRATION_CLOCK");
  const baseline = assessRobinhoodChainSurvey(sourceText, baselineAssessedAt);
  if (baseline.scope.expirationStart !== "2026-09-08" || baseline.scope.expirationEnd !== "2026-09-16" || JSON.stringify(baseline.scope.comparisonExpirations) !== '["2026-09-18"]') fail("BASELINE_SCOPE");
  if (baseline.rows.length > 4000) fail("COHORT_BOUND");
  const references = referenceCloses(sourceText, baseline), used = new Set<string>();
  const candidates = baseline.rows.filter(r => r.reviewCandidate).map(r => {
    const reference = references.find(p => p.symbol === r.symbol)!;
    const comparable = reference.date === r.quoteRefreshDateNewYork && reference.price !== null;
    const moneyness = comparable ? side(r, reference.price!) : null;
    const controls = comparable ? baseline.rows.filter(c => !c.reviewCandidate && !used.has(c.id) && c.peerScreenEligible &&
      c.symbol === r.symbol && c.expiry === r.expiry && c.type === r.type && c.quoteRefreshDateNewYork === r.quoteRefreshDateNewYork &&
      side(c, reference.price!) === moneyness && c.bid !== null && c.ask !== null && units(c.bid) > 0n && units(c.ask) >= units(c.bid) &&
      (c.bidSize ?? 0) >= 1 && (c.askSize ?? 0) >= 1 && !c.quality.includes("CONTRACT_NOT_STANDARD_ACTIVE_TRADABLE") &&
      abs(units(c.strike) - units(r.strike)) * 10000n <= units(r.strike) * 300n).sort((a, b) => {
        const da = abs(units(a.strike) - units(r.strike)), db = abs(units(b.strike) - units(r.strike));
        return da < db ? -1 : da > db ? 1 : units(a.strike) < units(b.strike) ? -1 : units(a.strike) > units(b.strike) ? 1 : a.id.localeCompare(b.id);
      }) : [];
    const control = controls[0] ?? null; if (control) used.add(control.id);
    return { candidate: identity(r), control: control ? identity(control) : null, moneyness,
      matchStatus: control ? "MATCHED" : comparable ? "NO_ELIGIBLE_UNUSED_NEARBY_CONTROL" : "UNDERLYING_REFERENCE_UNAVAILABLE",
      cohort: r.expiry === "2026-09-18" ? "SEPTEMBER_18_COMPARISON" : "THROUGH_SEPTEMBER_16",
      baselineQuoteAt: r.quoteUpdatedAt, baselineVolume: r.volume, baselineOpenInterest: r.openInterest, activityFlags: r.activityFlags,
      baselineControlQuoteAt: control?.quoteUpdatedAt ?? null, baselineControlVolume: control?.volume ?? null,
      volumeSessionVerified: false, institutionsIdentified: false };
  });
  const body = { version: "OPTIONS_ACTIVITY_STUDY_V1", registeredAt, baselineAssessedAt, baselineSourceSha256: baseline.sourceSha256,
    baselineReportFingerprint: baseline.reportFingerprint, origin: baseline.origin, policy: ACTIVITY_STUDY_POLICY, references, candidates,
    counts: { baselineContracts: baseline.rows.length, candidates: candidates.length, matched: used.size, unmatched: candidates.length - used.size },
    historicalAnomalyConfirmed: false, validatedEdge: false, executionAllowed: false, winProbability: null };
  return freezePaper({ ...body, studyFingerprint: paperFingerprint(body) });
}
type Study = ReturnType<typeof freezeOptionsActivityStudy>;
type Contract = Study["candidates"][number]["candidate"];
type PreparedSnapshot = { sessionDate: string; report: Survey; assessedAt: string; rows: Map<string, Row> };

function usable(contract: Contract, date: string, snapshots: Map<string, PreparedSnapshot>, at: string) {
  const snapshot = snapshots.get(date), r = snapshot?.rows.get(contract.id);
  let reason: string | null = null;
  if (contract.expiry <= date) reason = "EXPIRY_ON_OR_BEFORE_REFERENCE_SESSION";
  else if (!snapshot) reason = at < date + "T22:00:00.000Z" ? "AWAITING_SESSION_BOARD" : "SESSION_BOARD_MISSING";
  else if (!r) reason = "CONTRACT_ABSENT_FROM_SNAPSHOT";
  else if (!sameIdentity(contract, r)) fail("CONTRACT_IDENTITY_CHANGED");
  else if (r.quality.includes("CONTRACT_NOT_STANDARD_ACTIVE_TRADABLE")) reason = "CONTRACT_NOT_ELIGIBLE";
  else if (r.quoteRefreshDateNewYork !== date || r.quoteUpdatedAt === null) reason = "WRONG_OR_UNKNOWN_QUOTE_SESSION";
  else if (r.quality.some(q => q.startsWith("QUOTE_AFTER"))) reason = "FUTURE_QUOTE_CLOCK";
  else {
    const clock = btcSourceNanoseconds(r.quoteUpdatedAt);
    if (clock < btcSourceNanoseconds(date + "T19:45:00Z") || clock > btcSourceNanoseconds(date + "T20:15:00Z")) reason = "OUTSIDE_DECLARED_CLOSE_REFERENCE_WINDOW";
    else if (!r.receivedAt || hostIso(r.receivedAt) < date + "T20:20:00.000Z" || hostIso(r.receivedAt) >= date + "T22:00:00.000Z") reason = "RECEIPT_OUTSIDE_CLOSE_CAPTURE_WINDOW";
    else if (r.bid === null || r.ask === null || units(r.bid) <= 0n || units(r.ask) <= 0n || units(r.bid) > units(r.ask)) reason = "MISSING_ZERO_OR_CROSSED_PRICE";
    else if ((r.bidSize ?? 0) < 1 || (r.askSize ?? 0) < 1) reason = "DISPLAYED_SIZE_INSUFFICIENT";
  }
  return { row: reason === null ? r! : null, reason, sourceQuoteAt: r?.quoteUpdatedAt ?? null, receivedAt: r?.receivedAt ?? null };
}
function outcome(contract: Contract, exitDate: string, cost: typeof ACTIVITY_STUDY_POLICY.costs[number], snapshots: Map<string, PreparedSnapshot>, at: string) {
  const entry = usable(contract, ACTIVITY_STUDY_POLICY.entrySession, snapshots, at), exit = usable(contract, exitDate, snapshots, at);
  const entryAsk = entry.row?.ask ?? null, exitBid = exit.row?.bid ?? null;
  const fee = units(cost.feePerSideUsd), allowance = units(cost.adversePerShareUsd) * 100n;
  const debit = entryAsk === null ? null : units(entryAsk) * 100n + fee + allowance;
  let reason = entry.reason !== null ? "ENTRY_" + entry.reason : exit.reason !== null ? "EXIT_" + exit.reason : null;
  if (reason === null && units(exitBid!) * 100n <= allowance) reason = "EXIT_ALLOWANCE_CONSUMES_BID";
  const gross = reason === null ? (units(exitBid!) - units(entryAsk!)) * 100n : null;
  const net = gross === null ? null : gross - 2n * (fee + allowance);
  const exactBps = net === null ? null : net * 10000n / debit!;
  // Bound integer projections and sums; the exact return fraction is also retained.
  if (exactBps !== null && abs(exactBps) > 1000000000000n) fail("RETURN_RATIO_BOUND");
  const bps = exactBps === null ? null : Number(exactBps);
  return { status: reason === null ? "INDICATIVE_REFERENCE_OUTCOME" : "UNAVAILABLE", reason, entryAsk, exitBid,
    entryQuoteAt: entry.sourceQuoteAt, exitQuoteAt: exit.sourceQuoteAt, entryReceivedAt: entry.receivedAt, exitReceivedAt: exit.receivedAt,
    entryDebitUsd: debit === null ? null : usd(debit), affordableUnder50Usd: debit === null ? null : debit <= 50000000n,
    grossReferenceChangeUsd: gross === null ? null : usd(gross), netReferenceChangeUsd: net === null ? null : usd(net),
    netReturnBpsTruncated: bps, result: net === null ? "UNKNOWN" : net > 0n ? "POSITIVE" : net < 0n ? "NEGATIVE" : "FLAT",
    returnNumeratorMicroUsd: net?.toString() ?? null, returnDenominatorMicroUsd: net === null ? null : debit!.toString(),
    review: net === null ? "Missing or ineligible evidence; no zero return or fill inferred." : net > 0n
      ? "Exit Bid exceeds entry Ask and declared costs. This does not identify why the option moved or who traded."
      : "Exit Bid does not exceed entry Ask and declared costs. Spread, premium movement and allowances are measured; causal attribution is unavailable.",
    actualFill: false, stopOrTargetPathKnown: false };
}

export function evaluateOptionsActivityStudy(sourceText: string, baselineAssessedAt: string, registeredAt: string, inputs: readonly ActivitySnapshot[], assessedAt: string) {
  const study = freezeOptionsActivityStudy(sourceText, baselineAssessedAt, registeredAt); readinessClock(assessedAt);
  if (assessedAt < registeredAt || inputs.length > 7) fail("REPORT_CLOCK_OR_BOUND");
  const snapshots = new Map<string, PreparedSnapshot>();
  for (const input of inputs) {
    if (!ACTIVITY_STUDY_POLICY.sessions.includes(input.sessionDate) || snapshots.has(input.sessionDate)) fail("SESSION_DUPLICATE_OR_SCOPE");
    readinessClock(input.assessedAt); if (input.assessedAt > assessedAt || input.assessedAt <= registeredAt) fail("SNAPSHOT_KNOWLEDGE_CLOCK");
    const report = assessRobinhoodChainSurvey(input.sourceText, input.assessedAt), captured = hostIso(report.capturedAt);
    if (report.origin !== study.origin || report.scope.expirationStart !== input.sessionDate || report.scope.expirationEnd !== "2026-09-16" || JSON.stringify(report.scope.comparisonExpirations) !== '["2026-09-18"]') fail("SNAPSHOT_SCOPE_OR_ORIGIN");
    if (captured < input.sessionDate + "T20:20:00.000Z" || captured >= input.sessionDate + "T22:00:00.000Z") fail("SNAPSHOT_CAPTURE_WINDOW");
    for (const pair of study.candidates) for (const c of [pair.candidate, pair.control]) {
      const row = c && report.rows.find(r => r.id === c.id); if (c && row && !sameIdentity(c, row)) fail("CONTRACT_IDENTITY_CHANGED");
    }
    snapshots.set(input.sessionDate, { sessionDate: input.sessionDate, assessedAt: input.assessedAt, report, rows: new Map(report.rows.map(r => [r.id, r])) });
  }
  const cases = study.candidates.map(pair => ({ ...pair,
    observations: ACTIVITY_STUDY_POLICY.sessions.map(date => ({ sessionDate: date, ...Object.fromEntries((["candidate", "control"] as const).map(role => {
      const c = pair[role], r = c ? snapshots.get(date)?.rows.get(c.id) : undefined;
      return [role, r ? { quoteAt: r.quoteUpdatedAt, receivedAt: r.receivedAt, volume: r.volume, openInterest: r.openInterest, bid: r.bid, ask: r.ask,
        volumeSessionDate: null, openInterestAsOf: null } : null];
    })) })),
    outcomes: ACTIVITY_STUDY_POLICY.sessions.slice(1).flatMap(exitDate => ACTIVITY_STUDY_POLICY.costs.map(cost => {
      const candidate = outcome(pair.candidate, exitDate, cost, snapshots, assessedAt), control = pair.control ? outcome(pair.control, exitDate, cost, snapshots, assessedAt) : null;
      const paired = candidate.netReturnBpsTruncated !== null && control?.netReturnBpsTruncated !== null && control?.netReturnBpsTruncated !== undefined;
      return { exitDate, primary: exitDate === ACTIVITY_STUDY_POLICY.primaryExit, costScenario: cost.id, candidate, control,
        pairedDifferenceBps: paired ? candidate.netReturnBpsTruncated! - control!.netReturnBpsTruncated! : null,
        affordablePair: paired && candidate.affordableUnder50Usd === true && control?.affordableUnder50Usd === true };
    })),
  }));
  const summaries = (["THROUGH_SEPTEMBER_16", "SEPTEMBER_18_COMPARISON"] as const).flatMap(cohort => (["GLD", "IBIT"] as const).flatMap(symbol =>
    ACTIVITY_STUDY_POLICY.sessions.slice(1).flatMap(exitDate => ACTIVITY_STUDY_POLICY.costs.map(cost => {
      const all = cases.filter(c => c.cohort === cohort && c.candidate.symbol === symbol).map(c => c.outcomes.find(o => o.exitDate === exitDate && o.costScenario === cost.id)!);
      const paired = all.filter(o => o.pairedDifferenceBps !== null), affordable = paired.filter(o => o.affordablePair);
      const mean = (rs: typeof all) => rs.length ? Math.trunc(rs.reduce((n, o) => n + o.pairedDifferenceBps!, 0) / rs.length) : null;
      return { cohort, symbol, exitDate, primary: exitDate === ACTIVITY_STUDY_POLICY.primaryExit, costScenario: cost.id,
        candidates: all.length, evaluableCandidates: all.filter(o => o.candidate.result !== "UNKNOWN").length,
        positive: all.filter(o => o.candidate.result === "POSITIVE").length, negative: all.filter(o => o.candidate.result === "NEGATIVE").length,
        flat: all.filter(o => o.candidate.result === "FLAT").length, unavailable: all.filter(o => o.candidate.result === "UNKNOWN").length,
        evaluablePairs: paired.length, candidateAheadOfControl: paired.filter(o => o.pairedDifferenceBps! > 0).length,
        meanPairedDifferenceBpsTruncated: mean(paired), affordablePairs: affordable.length, affordableMeanPairedDifferenceBpsTruncated: mean(affordable),
        independentSampleCount: null };
    }))));
  const lessons = cases.flatMap(c => {
    const primary = c.outcomes.find(o => o.primary && o.costScenario === "ILLUSTRATIVE_BASE")!;
    const codes = [
      ...(c.control === null ? ["MATCHED_CONTROL_UNAVAILABLE"] : []),
      ...(primary.candidate.result === "UNKNOWN" && !primary.candidate.reason?.includes("AWAITING") ? ["PRIMARY_OUTCOME_UNAVAILABLE"] : []),
      ...(primary.candidate.affordableUnder50Usd === false ? ["ONE_CONTRACT_EXCEEDS_ALLOCATION"] : []),
      ...(primary.candidate.result === "NEGATIVE" ? ["NEGATIVE_REFERENCE_OUTCOME"] : []),
      ...(primary.candidate.grossReferenceChangeUsd !== null && unitsSigned(primary.candidate.grossReferenceChangeUsd) > 0n && primary.candidate.result !== "POSITIVE" ? ["DECLARED_COSTS_ERODE_GROSS_GAIN"] : []),
      ...(primary.pairedDifferenceBps !== null && primary.pairedDifferenceBps <= 0 ? ["NO_PRIMARY_ADVANTAGE_OVER_MATCHED_CONTROL"] : []),
      ...(c.baselineOpenInterest !== null && c.baselineOpenInterest < 100 ? ["SMALL_REPORTED_OI_BASE"] : []),
    ];
    return codes.map(code => ({ candidateId: c.candidate.id, code, status: "CANDIDATE_LESSON", recordedAt: assessedAt, approvedRule: false,
      prevention: "Retain this case and its evidence limits in future review; require independent validation before any rule change." }));
  });
  const body = { version: "OPTIONS_ACTIVITY_STUDY_REPORT_V1", assessedAt, studyFingerprint: study.studyFingerprint, origin: study.origin,
    status: snapshots.size === 0 ? "AWAITING_FUTURE_CLOSES" : "DESCRIPTIVE_FOLLOWUP_ONLY", policy: study.policy,
    inputSnapshots: [...snapshots.values()].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)).map(s => ({ sessionDate: s.sessionDate, assessedAt: s.assessedAt,
      capturedAt: s.report.capturedAt, sourceSha256: s.report.sourceSha256, reportFingerprint: s.report.reportFingerprint,
      recordedAfterCaptureSession: s.assessedAt >= s.sessionDate + "T22:00:00.000Z" })),
    counts: { ...study.counts, observedSessions: snapshots.size, scheduledSessions: 7, primaryEvaluableCandidates: cases.filter(c => c.outcomes.some(o => o.primary && o.costScenario === "ILLUSTRATIVE_BASE" && o.candidate.result !== "UNKNOWN")).length },
    cases, summaries, candidateLessons: lessons,
    limitations: ["All hypothetical long references are independent; dollar outcomes must not be summed into a $1,000 portfolio.",
      "Primary September 9 and secondary horizons are predeclared. Selecting the best later horizon is hindsight.",
      "Many contracts share ETF, expiry and session shocks; seven sessions do not provide independent contract samples or a win probability.",
      "Positive returns alone do not validate the activity filter. Unmatched, unavailable and unaffordable cases remain in the denominator.",
      "Activity, volume-session identity, institutions, opening/closing trades and causes remain unconfirmed. No historical volume baseline.",
      "Indicative Ask/Bid references and assumed costs are not executable closes, stops, targets, paper fills or verified brokerage fees."],
    validatedEdge: false, winProbability: null, strategyChangeAuthorized: false, executionAllowed: false, actualTrades: 0, sourceJournalAppends: 0 };
  return freezePaper({ ...body, reportFingerprint: paperFingerprint(body) });
}
function unitsSigned(s: string): bigint { return s.startsWith("-") ? -units(s.slice(1)) : units(s); }
