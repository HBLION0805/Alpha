import { manualUsd, manualUsdUnits, reconcileManualLedger } from './OptionsManualLedger';
import { assessSnapshotQuote, snapshotNs, type SnapshotFrame } from '../options-robinhood-data/RobinhoodSnapshotPaper';
import { paperSession } from '../options-robinhood-data/RobinhoodPaperSession';
import { paperFingerprint } from '../options-paper/OptionsPaperTradingEngine';

type LedgerReport = ReturnType<typeof reconcileManualLedger>;
const fail = (code: string): never => { throw Error('POSITION_WATCH_' + code); };
const signedUsd = (v: string) => v.startsWith('-') ? -manualUsdUnits(v.slice(1)) : manualUsdUnits(v);
const optionalClock = (v: unknown) => { try { return snapshotNs(v); } catch { return null; } };
export function positionExitCost(value: unknown): string | null {
  if (value === null) return null;
  const amount = manualUsdUnits(value);
  if (amount > 1000000000000n) fail('COST_LIMIT');
  return manualUsd(amount);
}

/** A current saved-quote comparison, never a fill, persistent alert or ledger mutation. */
export function assessPositionWatch(ledger: LedgerReport, capture: SnapshotFrame | null, at: string, costs: Record<string, string | null> = {}) {
  const now = snapshotNs(at);
  if (ledger.assessedAt !== at) fail('LEDGER_CLOCK');
  const trades = ledger.trades.filter(t => t.openContracts > 0);
  if (!costs || typeof costs !== 'object' || Array.isArray(costs) || Object.keys(costs).some(id => !trades.some(t => t.tradeId === id))) fail('COST_FIELDS');
  const expectedOrigin = ledger.origin === 'SYNTHETIC_FIXTURE' ? 'SYNTHETIC_FIXTURE' : 'HOST_MARKET_TOOL_RESPONSES';
  const rows = trades.map(t => {
    const exitCost = positionExitCost(Object.hasOwn(costs, t.tradeId) ? costs[t.tradeId] : null), plan = t.plan;
    const matches = capture?.quotes.filter(q => q.symbol === t.contract.symbol && q.type.toUpperCase() === t.contract.optionType && q.expiry === t.contract.expiry && q.multiplier === t.contract.multiplier && manualUsdUnits(q.strike) === manualUsdUnits(t.contract.strikeUsd)) ?? [];
    const q = matches.length === 1 ? matches[0]! : null;
    const blockers: string[] = [];
    if (!capture) blockers.push('CAPTURE_MISSING');
    else {
      if (capture.origin !== expectedOrigin) blockers.push('SOURCE_ORIGIN_MISMATCH');
      if (snapshotNs(capture.recordedAt) > now || snapshotNs(capture.capturedAt) > now) blockers.push('FUTURE_CAPTURE');
      if (!matches.length) blockers.push('CONTRACT_NOT_IN_LATEST_CAPTURE');
      if (matches.length > 1) blockers.push('CONTRACT_IDENTITY_AMBIGUOUS');
    }
    const currentSession = paperSession(at, q?.chainSession);
    if (q) {
      const check = assessSnapshotQuote(q, at, true);
      const sourceClock = optionalClock(q.updatedAt), underlyingClock = optionalClock(q.underlyingAt);
      blockers.push(...check.blockers);
      if (check.staleNow) blockers.push('OPTION_STALE_NOW');
      if (underlyingClock === null || now - underlyingClock > 60000000000n) blockers.push('UNDERLYING_STALE_NOW');
      if (!currentSession.isOpen) blockers.push('CURRENT_SESSION_CLOSED_OR_UNREVIEWED');
      if (sourceClock !== null && t.lastExecutionAt && sourceClock < snapshotNs(t.lastExecutionAt)) blockers.push('QUOTE_PRECEDES_REPORTED_EXECUTION');
      if (q.bidCents === 0) blockers.push('NO_POSITIVE_BID');
      if (q.bidSize !== null && q.bidSize < t.openContracts) blockers.push('BID_SIZE_BELOW_OPEN_QUANTITY');
    }
    const usable = q !== null && blockers.length === 0;
    const gross = usable ? BigInt(q.bidCents!) * 10000n * BigInt(t.openContracts * 100) : null;
    const beforeCosts = gross !== null && t.netCashFlowUsd !== null ? gross + signedUsd(t.netCashFlowUsd) : null;
    const net = beforeCosts !== null && exitCost !== null ? beforeCosts - manualUsdUnits(exitCost) : null;
    const stop = plan?.stopPremiumUsd == null ? 'NOT_DECLARED' : !usable ? 'UNKNOWN_QUOTE' : BigInt(q.bidCents!) * 10000n <= manualUsdUnits(plan.stopPremiumUsd) ? 'OBSERVED_AT_OR_BELOW_STOP' : 'NOT_OBSERVED';
    const target = !plan ? 'NOT_DECLARED' : !usable ? 'UNKNOWN_QUOTE' : beforeCosts === null ? 'UNKNOWN_RECORDED_FEES' : exitCost === null ? 'UNKNOWN_EXIT_COSTS' : net! >= manualUsdUnits(plan.targetNetProfitUsd) ? 'OBSERVED_AT_OR_ABOVE_TARGET_UNDER_ASSUMPTION' : 'NOT_OBSERVED';
    const time = !plan?.timeExitAt ? 'NOT_DECLARED' : now >= snapshotNs(plan.timeExitAt) ? 'DUE_UNRESOLVED' : 'NOT_DUE';
    const expiry = t.contract.expiry < currentSession.date ? 'PAST_EXPIRY_UNRESOLVED' : t.contract.expiry === currentSession.date ? 'EXPIRY_DAY_REVIEW' : 'BEFORE_EXPIRY';
    const reasons = [stop.startsWith('OBSERVED') ? 'STOP_REFERENCE_REACHED' : null, target.startsWith('OBSERVED') ? 'TARGET_REFERENCE_REACHED' : null, time === 'DUE_UNRESOLVED' ? 'TIME_EXIT_DUE' : null, expiry !== 'BEFORE_EXPIRY' ? expiry : null].filter((v): v is string => v !== null);
    return {
      tradeId: t.tradeId, contract: t.contract, openContracts: t.openContracts, plan, planTiming: t.planTiming,
      lastReportedExecutionAt: t.lastExecutionAt, remainingPremiumUsd: t.remainingPremiumUsd, remainingCostBasisUsd: t.remainingCostBasisUsd,
      realizedNetPnlUsd: t.realizedNetPnlUsd, netCashFlowUsd: t.netCashFlowUsd,
      source: capture ? { path: capture.path, sha256: capture.sha256, origin: capture.origin, capturedAt: capture.capturedAt, recordedAt: capture.recordedAt } : null,
      quote: q ? { id: q.id, bidCents: q.bidCents, askCents: q.askCents, bidSize: q.bidSize, sourceAt: q.updatedAt, receivedAt: q.receivedAt, underlyingAt: q.underlyingAt } : null,
      usableQuote: usable, quoteBlockers: [...new Set(blockers)], currentSession,
      liquidationValueAtBidUsd: gross === null ? null : manualUsd(gross),
      fullTradePnlBeforeFutureExitCostsUsd: beforeCosts === null ? null : manualUsd(beforeCosts),
      assumedRemainingExitCostUsd: exitCost, estimatedFullTradeNetPnlUsd: net === null ? null : manualUsd(net),
      checks: { stop, target, time, expiry }, attentionReasons: reasons,
      status: reasons.length ? 'MANUAL_REVIEW_REQUIRED' : !usable ? 'AWAITING_USABLE_QUOTE' : [stop, target, time].some(v => v.startsWith('UNKNOWN') || v === 'NOT_DECLARED') ? 'CHECKS_INCOMPLETE' : 'NO_OBSERVED_THRESHOLD',
      actualExitConfirmed: false, continuousPathKnown: false, executionAllowed: false,
    };
  });
  return { version: 'OPTIONS_POSITION_WATCH_V1', assessedAt: at, ledgerId: ledger.ledgerId, ledgerFingerprint: ledger.reportFingerprint, ledgerEventsFingerprint: ledger.eventsFingerprint, origin: ledger.origin,
    rows, openTrades: rows.length, attentionCount: rows.filter(r => r.attentionReasons.length).length,
    inputFingerprint: paperFingerprint({ ledger: ledger.reportFingerprint, capture, at, costs }),
    limitation: 'Saved snapshots only; price checks use a 60-second freshness limit. Displayed bids and quantities do not guarantee fills. Time or expiry flags never close a position. Costs are explicit preview assumptions, not actual fees. No background alerts or orders.',
    sourceRefresh: false, accountAccessed: false, executionAllowed: false };
}
