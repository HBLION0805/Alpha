import { btcSourceNanoseconds } from "../options-btc-context/BtcSpotContextEngine";
import { paperFingerprint } from "../options-paper/OptionsPaperTradingEngine";
import { assessRobinhoodChainSurvey } from "./RobinhoodChainSurvey";

export function compareRobinhoodChainSurveys(beforeText: string, beforeAt: string, afterText: string, afterAt: string) {
  const before = assessRobinhoodChainSurvey(beforeText, beforeAt), after = assessRobinhoodChainSurvey(afterText, afterAt);
  if (beforeAt >= afterAt || before.capturedAt >= after.capturedAt || before.origin !== after.origin || before.scope.expirationEnd !== after.scope.expirationEnd || JSON.stringify(before.scope.comparisonExpirations) !== JSON.stringify(after.scope.comparisonExpirations)) throw Error("CHAIN_COMPARISON_ORDER_OR_SCOPE");
  const left = new Map(before.rows.map(r => [r.id, r])), right = new Map(after.rows.map(r => [r.id, r]));
  const values = (r: typeof before.rows[number] | undefined) => r ? { quoteUpdatedAt: r.quoteUpdatedAt, quoteRefreshDateNewYork: r.quoteRefreshDateNewYork, volume: r.volume, openInterest: r.openInterest, bid: r.bid, ask: r.ask, mark: r.mark, activityFlags: r.activityFlags } : null;
  const rows = [...new Set([...left.keys(), ...right.keys()])].sort().map(id => {
    const a = left.get(id), b = right.get(id), identity = b ?? a!;
    if (a && b && ["symbol", "expiry", "type", "strike", "multiplier"].some(k => a[k as keyof typeof a] !== b[k as keyof typeof b])) throw Error("CHAIN_COMPARISON_IDENTITY");
    let clockStatus = !a ? "ADDED_TO_CAPTURE" : !b ? "ABSENT_FROM_CAPTURE" : "UNKNOWN_CLOCK";
    if (a && b && ![a, b].some(r => r.quality.some(q => q === "QUOTE_CLOCK_UNKNOWN" || q.startsWith("QUOTE_AFTER")))) {
      const x = btcSourceNanoseconds(a.quoteUpdatedAt!), y = btcSourceNanoseconds(b.quoteUpdatedAt!);
      clockStatus = y === x ? "UNCHANGED_QUOTE_CLOCK" : y < x ? "REGRESSED_QUOTE_CLOCK" : a.quoteRefreshDateNewYork === b.quoteRefreshDateNewYork ? "ADVANCED_WITHIN_QUOTE_DATE" : "ADVANCED_TO_LATER_QUOTE_DATE";
    }
    const advanced = clockStatus.startsWith("ADVANCED_");
    return { id, symbol: identity.symbol, expiry: identity.expiry, type: identity.type, strike: identity.strike, before: values(a), after: values(b), clockStatus,
      reportedVolumeDifference: advanced && a?.volume !== null && b?.volume !== null ? b!.volume! - a!.volume! : null,
      reportedOiDifference: advanced && a?.openInterest !== null && b?.openInterest !== null ? b!.openInterest! - a!.openInterest! : null,
      newlyFlaggedInCapture: Boolean(b?.reviewCandidate && !a?.reviewCandidate),
      confirmedNewTradingActivity: false, verifiedVolumeSession: false, verifiedOiDate: false, confirmedCause: false };
  });
  const body = { version: "ROBINHOOD_CHAIN_COMPARISON_V1", beforeFingerprint: before.reportFingerprint, afterFingerprint: after.reportFingerprint, beforeCapturedAt: before.capturedAt, afterCapturedAt: after.capturedAt,
    rows, counts: { union: rows.length, added: rows.filter(r => r.clockStatus === "ADDED_TO_CAPTURE").length, absent: rows.filter(r => r.clockStatus === "ABSENT_FROM_CAPTURE").length, unchangedQuoteClock: rows.filter(r => r.clockStatus === "UNCHANGED_QUOTE_CLOCK").length },
    interpretation: "Reported counter differences only. Across quote dates, volume totals can reset; subtraction is not extra contracts traded. OI has no independent as-of clock. Unchanged clocks suppress differences even if counters changed. Absence is not proof of delisting. No causal or historical anomaly confirmation.", executionAllowed: false };
  return { ...body, reportFingerprint: paperFingerprint(body) };
}
