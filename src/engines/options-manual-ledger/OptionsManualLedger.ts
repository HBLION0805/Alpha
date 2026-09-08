import type { ManualFillValues, ManualLedgerCommand, ManualLedgerEvent, ManualLedgerInput } from "../../contracts/OptionsManualLedger";
import { paperFingerprint, freezePaper } from "../options-paper/OptionsPaperTradingEngine";
import { exportId } from "../options-evidence-export/OptionsEvidenceExportEngine";
import { readinessClock } from "../options-readiness/OptionsReadinessEngine";
import { btcSourceNanoseconds } from "../options-btc-context/BtcSpotContextEngine";
import { exchangeLocalDate } from "../market-calendar/MarketCalendarValidation";

function fail(code: string): never { throw Error("MANUAL_LEDGER_" + code); }
function exact(v: unknown, fields: string[]): Record<string, any> {
  if (!v || typeof v !== "object" || Array.isArray(v) || Object.getPrototypeOf(v) !== Object.prototype) fail("OBJECT");
  const keys = Reflect.ownKeys(v), d = Object.getOwnPropertyDescriptors(v);
  if (keys.length !== fields.length || keys.some(k => typeof k !== "string" || !fields.includes(k) || !("value" in d[k]!))) fail("FIELDS");
  return v as Record<string, any>;
}
function count(v: unknown, min = 1, max = 1000): asserts v is number { if (typeof v !== "number" || !Number.isSafeInteger(v) || Object.is(v, -0) || v < min || v > max) fail("COUNT"); }
function label(v: unknown, max = 1000): asserts v is string { if (typeof v !== "string" || !v.length || v.length > max || v.trim() !== v || /[\u0000-\u001f\u007f-\u009f]/u.test(v)) fail("LABEL"); }
export function manualUsdUnits(v: unknown): bigint {
  if (typeof v !== "string" || !/^(0|[1-9]\d{0,7})(\.\d{1,6})?$/.test(v)) fail("MONEY");
  const [a, b = ""] = (v as string).split("."); return BigInt(a!) * 1000000n + BigInt(b.padEnd(6, "0"));
}
export function manualUsd(n: bigint): string { const v = n < 0n ? -n : n; return (n < 0n ? "-" : "") + (v / 1000000n) + "." + (v % 1000000n).toString().padStart(6, "0"); }
function money(v: unknown, positive = false): void { if (manualUsdUnits(v) === 0n && positive) fail("POSITIVE_MONEY"); }
function date(v: unknown): void { if (typeof v !== "string" || !/^\d{4}-\d\d-\d\d$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) fail("DATE"); }
function digest(v: unknown): void { if (typeof v !== "string" || !/^sha256:[0-9a-f]{64}$/.test(v)) fail("FINGERPRINT"); }
function fill(v: unknown, at: string): void {
  const f = exact(v, ["executionSequence", "executedAt", "action", "quantity", "pricePerShareUsd", "feesUsd", "externalExecutionRef", "evidence", "exitReason"]);
  count(f.executionSequence, 1, 100000); count(f.quantity);
  if (!["BUY_TO_OPEN", "SELL_TO_CLOSE"].includes(f.action)) fail("ACTION");
  if (btcSourceNanoseconds(f.executedAt) > btcSourceNanoseconds(at)) fail("FUTURE_EXECUTION");
  money(f.pricePerShareUsd, f.action === "BUY_TO_OPEN"); if (f.feesUsd !== null) money(f.feesUsd);
  if (f.externalExecutionRef !== null) label(f.externalExecutionRef, 120);
  if (f.evidence !== null) {
    const e = exact(f.evidence, ["description", "documentSha256"]); label(e.description, 500);
    if (e.documentSha256 !== null && (typeof e.documentSha256 !== "string" || !/^[0-9a-f]{64}$/.test(e.documentSha256))) fail("DOCUMENT_HASH");
  }
  if (f.action === "BUY_TO_OPEN" ? f.exitReason !== "NOT_APPLICABLE" : !["STOP", "TARGET", "TIME", "MANUAL", "UNKNOWN"].includes(f.exitReason)) fail("EXIT_REASON");
}
export function validateManualLedgerCommand(input: unknown, recordedAt: string): ManualLedgerCommand {
  readinessClock(recordedAt);
  if (!input || typeof input !== "object") fail("COMMAND");
  const type = Object.getOwnPropertyDescriptor(input, "type")?.value;
  const fields = type === "REGISTER_TRADE" ? ["type", "requestId", "tradeId", "contract", "plan", "activityReference"]
    : type === "RECORD_FILL" ? ["type", "requestId", "tradeId", "fillId", "fill"]
    : type === "CORRECT_FILL" ? ["type", "requestId", "tradeId", "fillId", "expectedRevision", "reason", "replacement"] : fail("COMMAND_TYPE");
  const c = exact(input, fields); exportId(c.requestId); exportId(c.tradeId);
  if (type === "REGISTER_TRADE") {
    const i = exact(c.contract, ["symbol", "expiry", "optionType", "strikeUsd", "multiplier"]);
    if (!["GLD", "IBIT"].includes(i.symbol) || !["CALL", "PUT"].includes(i.optionType) || i.multiplier !== 100) fail("CONTRACT_SCOPE");
    date(i.expiry); money(i.strikeUsd, true);
    if (c.plan !== null) {
      const p = exact(c.plan, ["declaredAt", "maxContracts", "maxEntryDebitUsd", "plannedRiskUsd", "targetNetProfitUsd", "stopPremiumUsd", "entryDeadlineAt", "timeExitAt", "thesis"]);
      readinessClock(p.declaredAt); if (p.declaredAt > recordedAt) fail("FUTURE_PLAN"); count(p.maxContracts);
      money(p.maxEntryDebitUsd, true); money(p.plannedRiskUsd, true); money(p.targetNetProfitUsd);
      if (p.stopPremiumUsd !== null) money(p.stopPremiumUsd);
      for (const key of ["entryDeadlineAt", "timeExitAt"]) if (p[key] !== null) { readinessClock(p[key]); if (p[key] <= p.declaredAt) fail("PLAN_CLOCK_ORDER"); }
      if (p.entryDeadlineAt !== null && p.timeExitAt !== null && p.timeExitAt <= p.entryDeadlineAt) fail("PLAN_CLOCK_ORDER");
      label(p.thesis);
    }
    if (c.activityReference !== null) {
      const r = exact(c.activityReference, ["studyId", "studyFingerprint", "candidateId"]); exportId(r.studyId); digest(r.studyFingerprint);
      if (typeof r.candidateId !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(r.candidateId)) fail("CANDIDATE_ID");
    }
  } else {
    exportId(c.fillId);
    if (type === "RECORD_FILL") fill(c.fill, recordedAt);
    else { count(c.expectedRevision); label(c.reason); if (c.replacement !== null) fill(c.replacement, recordedAt); }
  }
  return freezePaper(JSON.parse(JSON.stringify(c)) as ManualLedgerCommand);
}
type Registered = Extract<ManualLedgerCommand, { type: "REGISTER_TRADE" }>;
type EffectiveFill = { fillId: string; tradeId: string; revision: number; originalRecordedAt: string; lastRecordedAt: string; value: ManualFillValues | null };
type Lot = { fillId: string; quantity: number; remaining: number; premiumPerContract: bigint; fee: bigint | null; allocatedFee: bigint };

export function reconcileManualLedger(input: ManualLedgerInput, assessedAt: string) {
  exact(input, ["ledgerId", "origin", "createdAt", "events"]); exportId(input.ledgerId); readinessClock(input.createdAt); readinessClock(assessedAt);
  if (!["OWNER_REPORTED_UNVERIFIED", "SYNTHETIC_FIXTURE"].includes(input.origin) || input.createdAt > assessedAt || !Array.isArray(input.events) || input.events.length > 1000) fail("LEDGER_SCOPE");
  const trades = new Map<string, { registration: Registered; registeredAt: string }>(), fills = new Map<string, EffectiveFill>(), requestIds = new Set<string>();
  let lastAt = input.createdAt;
  const checkedEvents: ManualLedgerEvent[] = [];
  for (const [index, raw] of input.events.entries()) {
    exact(raw, ["sequence", "recordedAt", "savedAt", "command"]); readinessClock(raw.recordedAt); readinessClock(raw.savedAt);
    if (raw.sequence !== index + 1 || raw.recordedAt < lastAt || raw.savedAt < raw.recordedAt || raw.savedAt > assessedAt) fail("EVENT_ORDER"); lastAt = raw.savedAt;
    const c = validateManualLedgerCommand(raw.command, raw.recordedAt);
    if (requestIds.has(c.requestId)) fail("DUPLICATE_REQUEST"); requestIds.add(c.requestId);
    if (c.type === "REGISTER_TRADE") {
      if (trades.has(c.tradeId) || trades.size >= 200) fail("TRADE_ID_OR_BOUND"); trades.set(c.tradeId, { registration: c, registeredAt: raw.savedAt });
    } else {
      if (!trades.has(c.tradeId)) fail("TRADE_UNKNOWN"); const previous = fills.get(c.fillId);
      if (c.type === "RECORD_FILL") {
        if (previous) fail("FILL_ID_REUSED");
        fills.set(c.fillId, { fillId: c.fillId, tradeId: c.tradeId, revision: 1, originalRecordedAt: raw.recordedAt, lastRecordedAt: raw.recordedAt, value: c.fill });
      } else {
        if (!previous || previous.tradeId !== c.tradeId) fail("CORRECTION_FILL_UNKNOWN");
        if (previous.revision !== c.expectedRevision) fail("STALE_CORRECTION");
        fills.set(c.fillId, { ...previous, revision: previous.revision + 1, lastRecordedAt: raw.recordedAt, value: c.replacement });
      }
    }
    checkedEvents.push({ sequence: raw.sequence, recordedAt: raw.recordedAt, savedAt: raw.savedAt, command: c });
  }
  const active = [...fills.values()].filter(f => f.value !== null), refs = new Set<string>(), possibleDuplicates = new Set<string>();
  const signatureGroups = new Map<string, EffectiveFill[]>();
  for (const f of active) {
    const v = f.value!, ref = v.externalExecutionRef;
    if (ref !== null) { if (refs.has(ref)) fail("DUPLICATE_EXECUTION_REF"); refs.add(ref); }
    const contract = trades.get(f.tradeId)!.registration.contract;
    const key = paperFingerprint({ ...contract, strikeUsd: manualUsdUnits(contract.strikeUsd).toString(), at: btcSourceNanoseconds(v.executedAt).toString(), action: v.action, quantity: v.quantity, price: manualUsdUnits(v.pricePerShareUsd).toString() });
    const group = signatureGroups.get(key) ?? [];
    for (const other of group) if (ref === null || other.value!.externalExecutionRef === null) { possibleDuplicates.add(f.fillId); possibleDuplicates.add(other.fillId); }
    group.push(f); signatureGroups.set(key, group);
  }
  const results = [...trades.values()].map(({ registration: c, registeredAt }) => {
    const effective = [...fills.values()].filter(f => f.tradeId === c.tradeId), ordered = effective.filter(f => f.value !== null).sort((a, b) => a.value!.executionSequence - b.value!.executionSequence);
    const lots: Lot[] = [], matches = [], lessons = new Set<string>();
    let position = 0, maxPosition = 0, bought = 0, sold = 0, hasClosed = false, previousTime: bigint | null = null, previousSequence = 0;
    let entryPremium = 0n, saleProceeds = 0n, entryFees: bigint | null = 0n, exitFees: bigint | null = 0n, matchedFees: bigint | null = 0n, grossRealized = 0n;
    for (const f of ordered) {
      const v = f.value!, time = btcSourceNanoseconds(v.executedAt), premium = manualUsdUnits(v.pricePerShareUsd) * 100n, fee = v.feesUsd === null ? null : manualUsdUnits(v.feesUsd);
      if (v.executionSequence <= previousSequence || previousTime !== null && time < previousTime) fail("EXECUTION_ORDER");
      if (hasClosed) fail("CLOSED_TRADE_REOPENED"); previousTime = time; previousSequence = v.executionSequence;
      if (fee === null) lessons.add("FEES_UNKNOWN"); if (v.evidence === null || v.evidence.documentSha256 === null) lessons.add("DOCUMENT_EVIDENCE_MISSING");
      if (possibleDuplicates.has(f.fillId)) lessons.add("POSSIBLE_DUPLICATE_FILL");
      if (v.action === "BUY_TO_OPEN") {
        position += v.quantity; bought += v.quantity; maxPosition = Math.max(maxPosition, position); entryPremium += premium * BigInt(v.quantity);
        entryFees = entryFees === null || fee === null ? null : entryFees + fee;
        lots.push({ fillId: f.fillId, quantity: v.quantity, remaining: v.quantity, premiumPerContract: premium, fee, allocatedFee: 0n });
        if (c.plan?.entryDeadlineAt && time > btcSourceNanoseconds(c.plan.entryDeadlineAt)) lessons.add("ENTRY_AFTER_DECLARED_DEADLINE");
      } else {
        if (v.quantity > position) fail("OVERSELL_OR_MISSING_OPEN"); position -= v.quantity; sold += v.quantity; saleProceeds += premium * BigInt(v.quantity);
        exitFees = exitFees === null || fee === null ? null : exitFees + fee;
        let remaining = v.quantity, saleAllocated = 0n;
        for (const lot of lots) {
          if (!remaining) break; if (!lot.remaining) continue;
          const n = Math.min(remaining, lot.remaining), consumed = lot.quantity - lot.remaining + n;
          const entryFee = lot.fee === null ? null : lot.fee * BigInt(consumed) / BigInt(lot.quantity) - lot.allocatedFee;
          if (entryFee !== null) lot.allocatedFee += entryFee;
          const closingFee = fee === null ? null : fee * BigInt(v.quantity - remaining + n) / BigInt(v.quantity) - saleAllocated;
          if (closingFee !== null) saleAllocated += closingFee;
          const gross = (premium - lot.premiumPerContract) * BigInt(n), net = entryFee === null || closingFee === null ? null : gross - entryFee - closingFee;
          grossRealized += gross; matchedFees = matchedFees === null || entryFee === null ? null : matchedFees + entryFee;
          lot.remaining -= n; remaining -= n;
          matches.push({ openingFillId: lot.fillId, closingFillId: f.fillId, quantity: n, grossPnlUsd: manualUsd(gross), entryFeeAllocatedUsd: entryFee === null ? null : manualUsd(entryFee), closingFeeAllocatedUsd: closingFee === null ? null : manualUsd(closingFee), netPnlUsd: net === null ? null : manualUsd(net) });
        }
        hasClosed = position === 0;
        if (c.plan?.stopPremiumUsd !== null && c.plan?.stopPremiumUsd !== undefined && manualUsdUnits(v.pricePerShareUsd) < manualUsdUnits(c.plan.stopPremiumUsd)) lessons.add("EXIT_PRICE_BELOW_DECLARED_STOP_NOT_PROOF_OF_VIOLATION");
        if (c.plan?.timeExitAt && time > btcSourceNanoseconds(c.plan.timeExitAt)) lessons.add("EXIT_AFTER_DECLARED_TIME");
      }
    }
    const remainingPremium = lots.reduce((n, l) => n + l.premiumPerContract * BigInt(l.remaining), 0n);
    const remainingFee = lots.filter(l => l.remaining > 0).reduce<bigint | null>((n, l) => n === null || l.fee === null ? null : n + l.fee - l.allocatedFee, 0n);
    const totalFees = entryFees === null || exitFees === null ? null : entryFees + exitFees;
    const realizedNet = matchedFees === null || exitFees === null ? null : grossRealized - matchedFees - exitFees;
    const remainingBasis = remainingFee === null ? null : remainingPremium + remainingFee;
    const netCash = totalFees === null ? null : saleProceeds - entryPremium - totalFees;
    if (saleProceeds - entryPremium !== grossRealized - remainingPremium || netCash !== null && realizedNet !== null && remainingBasis !== null && netCash !== realizedNet - remainingBasis) fail("RECONCILIATION");
    const entryDebit = entryFees === null ? null : entryPremium + entryFees;
    const first = ordered[0]?.value, last = ordered.at(-1)?.value;
    const planTiming = c.plan === null ? "NO_PLAN_RECORDED" : !first ? "REGISTERED_NO_ENTRY_EVIDENCE" : btcSourceNanoseconds(registeredAt) >= btcSourceNanoseconds(first.executedAt) ? "RETROSPECTIVE_DECLARATION" : "LOCALLY_RECORDED_BEFORE_REPORTED_ENTRY";
    if (!c.plan) lessons.add("PLAN_MISSING"); else if (planTiming === "RETROSPECTIVE_DECLARATION") lessons.add("PLAN_RECORDED_AFTER_REPORTED_ENTRY");
    if (entryDebit !== null && entryDebit > 50000000n || entryPremium > 50000000n) lessons.add("ENTRY_DEBIT_EXCEEDS_50_USD_DIAGNOSTIC");
    if (c.plan) {
      if (maxPosition > c.plan.maxContracts) lessons.add("DECLARED_QUANTITY_EXCEEDED");
      if (entryDebit !== null && entryDebit > manualUsdUnits(c.plan.maxEntryDebitUsd) || entryPremium > manualUsdUnits(c.plan.maxEntryDebitUsd)) lessons.add("DECLARED_ENTRY_DEBIT_EXCEEDED");
      if (hasClosed && realizedNet !== null && -realizedNet > manualUsdUnits(c.plan.plannedRiskUsd)) lessons.add("CLOSED_LOSS_EXCEEDS_DECLARED_RISK");
    }
    if (hasClosed && realizedNet !== null && realizedNet < 0n) lessons.add("NEGATIVE_REPORTED_OUTCOME");
    if (effective.some(f => f.revision > 1)) lessons.add("CORRECTED_RECORDS_REVIEW");
    const nyDate = exchangeLocalDate(assessedAt, "America/New_York");
    if (position > 0 && c.contract.expiry < nyDate) lessons.add("PAST_EXPIRY_POSITION_UNRESOLVED");
    const r = c.plan && hasClosed && realizedNet !== null ? { numeratorMicroUsd: realizedNet.toString(), denominatorMicroUsd: manualUsdUnits(c.plan.plannedRiskUsd).toString() } : null;
    return { tradeId: c.tradeId, contract: c.contract, registeredAt, plan: c.plan, planFingerprint: c.plan ? paperFingerprint(c.plan) : null,
      planTiming, activityReference: c.activityReference, activityReferenceStatus: c.activityReference ? "DECLARED_LINK_REQUIRES_ORIGINAL_STUDY_VERIFICATION" : "NONE",
      status: !bought ? "REGISTERED_NO_FILLS" : hasClosed ? "CLOSED" : sold ? "PARTIALLY_CLOSED" : "OPEN", openedAt: first?.executedAt ?? null, lastExecutionAt: last?.executedAt ?? null,
      contractsBought: bought, contractsSold: sold, openContracts: position, maximumOpenContracts: maxPosition, effectiveFills: effective, matches,
      entryPremiumUsd: manualUsd(entryPremium), exitProceedsUsd: manualUsd(saleProceeds), entryFeesUsd: entryFees === null ? null : manualUsd(entryFees), exitFeesUsd: exitFees === null ? null : manualUsd(exitFees),
      entryDebitUsd: entryDebit === null ? null : manualUsd(entryDebit), grossRealizedPnlUsd: manualUsd(grossRealized), realizedNetPnlUsd: realizedNet === null ? null : manualUsd(realizedNet),
      remainingPremiumUsd: manualUsd(remainingPremium), remainingCostBasisUsd: remainingBasis === null ? null : manualUsd(remainingBasis), netCashFlowUsd: netCash === null ? null : manualUsd(netCash),
      closedTradeNetPnlUsd: hasClosed && realizedNet !== null ? manualUsd(realizedNet) : null, realizedR: r,
      targetComparison: hasClosed && realizedNet !== null && c.plan ? realizedNet >= manualUsdUnits(c.plan.targetNetProfitUsd) ? "AT_OR_ABOVE_DECLARED_TARGET" : "BELOW_DECLARED_TARGET_NOT_PROOF_EXIT_WAS_WRONG" : "UNKNOWN",
      reviewStatus: lessons.size ? "REVIEW_REQUIRED" : "NO_LISTED_DIAGNOSTIC_NOT_BROKER_VERIFICATION", candidateLessons: [...lessons].sort().map(code => ({ code, recordedAt: assessedAt, approvedRule: false, causalStatus: "NOT_ESTABLISHED" })),
      stopTargetPathKnown: false, slippageUsd: null, unrealizedPnlUsd: null, brokerVerified: false, marketCause: "UNKNOWN" };
  });
  const body = { version: "OPTIONS_MANUAL_LEDGER_REPORT_V1", ledgerId: input.ledgerId, origin: input.origin, createdAt: input.createdAt, assessedAt,
    eventCount: checkedEvents.length, eventsFingerprint: paperFingerprint(checkedEvents), trades: results,
    counts: { trades: results.length, activeFills: active.length, voidedFills: fills.size - active.length, closedTrades: results.filter(t => t.status === "CLOSED").length, openTrades: results.filter(t => t.openContracts > 0).length,
      possibleDuplicateFills: possibleDuplicates.size, candidateLessons: results.reduce((n, t) => n + t.candidateLessons.length, 0) },
    brokerVerified: false, accountBalanceUsd: null, settlementKnown: false, taxBasis: false, executionAllowed: false, winProbability: null, approvedKnowledge: false };
  return freezePaper({ ...body, reportFingerprint: paperFingerprint(body) });
}
