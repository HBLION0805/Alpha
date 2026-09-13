import { guidanceLocal } from "./OptionsDailyGuidance";
import { readinessClock } from "../options-readiness/OptionsReadinessEngine";

const SCALE = 100000000n;
const names = ["delta", "gamma", "theta", "vega", "implied_volatility"] as const;
type Metric = typeof names[number];
export type SensitivityQuote = {
  id: string; symbol: "GLD" | "IBIT" | null; expiry: string | null; strike: string | null;
  type: "call" | "put" | null; multiplier: number | null; quoteReturned: boolean;
  sourceAt: string | null; receivedAt: string | null; greeks: Partial<Record<Metric, unknown>>;
};
function fixed(n: bigint | null): string | null {
  if (n === null) return null;
  const magnitude = n < 0n ? -n : n;
  return (n < 0n ? "-" : "") + magnitude / SCALE + "." + (magnitude % SCALE).toString().padStart(8, "0");
}
function metric(raw: unknown, name: Metric) {
  const missing = raw === undefined || raw === null;
  let n: bigint | null = null;
  if (typeof raw === "string" && /^-?\d{1,7}(?:\.\d{1,8})?$/.test(raw)) {
    const [whole, fraction = ""] = raw.replace(/^-/, "").split(".");
    n = (BigInt(whole!) * SCALE + BigInt(fraction.padEnd(8, "0"))) * (raw.startsWith("-") ? -1n : 1n);
    if (n < -1000000n * SCALE || n > 1000000n * SCALE ||
      (name === "delta" && (n < -SCALE || n > SCALE)) ||
      (["gamma", "vega", "implied_volatility"].includes(name) && n < 0n)) n = null;
  }
  return { n, evidence: { raw: typeof raw === "string" ? raw.slice(0,120) : null,
    value: fixed(n), status: missing ? "MISSING" : n === null ? "INVALID" : "REPORTED_MODEL_VALUE" } };
}
function clockStatus(at: string, source: string | null) {
  if (source === null || !Number.isFinite(Date.parse(source))) return "UNKNOWN";
  const age = Date.parse(at) - Date.parse(source);
  return age < 0 ? "FUTURE" : age > 120000 ? "STALE" : "WITHIN_120_SECONDS";
}

/** Local changes only: deliberately produces no future option price or trade P&L. */
export function assessGuidanceSensitivities(at: string, quotes: SensitivityQuote[]) {
  readinessClock(at);
  if (quotes.length > 36 || new Set(quotes.map(q => q.id)).size !== quotes.length) throw Error("GUIDANCE_SENSITIVITY_SCOPE");
  const today = guidanceLocal(at).date;
  const rows = quotes.map(q => {
    if (q.symbol !== null && !["GLD", "IBIT"].includes(q.symbol)) throw Error("GUIDANCE_SENSITIVITY_SYMBOL");
    const parsed = Object.fromEntries(names.map(name => [name, metric(q.greeks[name], name)])) as Record<Metric, ReturnType<typeof metric>>;
    const g = (name: Metric) => parsed[name].n;
    const freshness = clockStatus(at, q.sourceAt), receiptStatus = clockStatus(at, q.receivedAt);
    // Robinhood keeps up to nanoseconds; only local-date derivation uses JS precision.
    const sourceDate = q.sourceAt && Number.isFinite(Date.parse(q.sourceAt)) ? guidanceLocal(new Date(Date.parse(q.sourceAt)).toISOString()).date : null;
    const standard = q.multiplier === 100 && ["call", "put"].includes(q.type ?? "");
    const baseBlockers = [...(!q.quoteReturned ? ["QUOTE_MISSING"] : []), ...(!standard ? ["STANDARD_CONTRACT_REQUIRED"] : []),
      ...([freshness, receiptStatus].includes("FUTURE") ? ["FUTURE_SOURCE_OR_RECEIPT"] : [])];
    const scenarios = [
      { id: "ONE_DAY", label: "One calendar day; ETF and IV unchanged", move: 0, days: 1, iv: 0 },
      { id: "IV_DOWN_ONE_POINT", label: "IV down 1 percentage point; ETF and time unchanged", move: 0, days: 0, iv: -1 },
      { id: "FAVORABLE_MOVE_WITH_DECAY", label: "Favorable $1 ETF move + one day + IV down 1 point", move: q.type === "put" ? -1 : 1, days: 1, iv: -1 },
      { id: "ADVERSE_MOVE_WITH_DECAY", label: "Adverse $1 ETF move + one day + IV up 1 point", move: q.type === "put" ? 1 : -1, days: 1, iv: 1 }
    ].map(s => {
      const blockers = [...baseBlockers];
      const effect = (name: Metric, factor: number) => {
        if (factor === 0) return 0n;
        if (g(name) === null) { blockers.push(name.toUpperCase() + "_UNAVAILABLE"); return null; }
        return g(name)! * BigInt(factor);
      };
      const delta = effect("delta", 100 * s.move), gamma = effect("gamma", 50 * s.move * s.move);
      const time = effect("theta", 100 * s.days), volatility = effect("vega", 100 * s.iv);
      if (s.iv !== 0 && g("implied_volatility") === null) blockers.push("IV_LEVEL_UNAVAILABLE");
      if (s.iv !== 0 && g("implied_volatility") !== null && g("implied_volatility")! + BigInt(s.iv) * SCALE / 100n < 0n) blockers.push("NEGATIVE_IV_SCENARIO");
      if (s.days && (!sourceDate || !q.expiry)) blockers.push("TIME_HORIZON_UNKNOWN");
      if (s.days && sourceDate && q.expiry && sourceDate >= q.expiry) blockers.push("DAY_SHOCK_BEYOND_EXPIRY");
      const parts = { deltaUsd: fixed(delta), gammaUsd: fixed(gamma), timeUsd: fixed(time), volatilityUsd: fixed(volatility) };
      return { id: s.id, label: s.label, underlyingChangeUsd: s.move, calendarDays: s.days, ivChangePercentagePoints: s.iv,
        status: blockers.length ? "UNAVAILABLE" : "LOCAL_MODEL_ILLUSTRATION", blockers,
        components: baseBlockers.length ? { deltaUsd: null, gammaUsd: null, timeUsd: null, volatilityUsd: null } : parts,
        valueChangeUsd: blockers.length ? null : fixed(delta! + gamma! + time! + volatility!) };
    });
    return { id: q.id, symbol: q.symbol, expiry: q.expiry, strike: q.strike, type: q.type,
      multiplier: q.multiplier, quoteReturned: q.quoteReturned, sourceAt: q.sourceAt, receivedAt: q.receivedAt,
      freshness, greekTimestamp: null,
      referenceStatus: !q.quoteReturned ? "QUOTE_MISSING" : baseBlockers.length ? "UNUSABLE_REFERENCE" :
        freshness !== "WITHIN_120_SECONDS" || receiptStatus !== "WITHIN_120_SECONDS" || !q.expiry || q.expiry <= today ? "HISTORICAL_OR_UNTIMED_ILLUSTRATION" : "RECENT_QUOTE_MODEL_VALUES_ONLY",
      metrics: Object.fromEntries(names.map(name => [name, parsed[name].evidence])),
      impliedVolatilityPercent: fixed(g("implied_volatility") === null ? null : g("implied_volatility")! * 100n),
      scenarios };
  });
  return { version: "OPTIONS_GUIDANCE_SENSITIVITIES_V1", assessedAt: at, rows,
    coverage: { selected: rows.length, returned: rows.filter(r => r.quoteReturned).length,
      allMetricsReported: rows.filter(r => Object.values(r.metrics).every(m => m.status === "REPORTED_MODEL_VALUE")).length,
      withinQuoteTimeWindow: rows.filter(r => r.referenceStatus === "RECENT_QUOTE_MODEL_VALUES_ONLY").length },
    basis: "One standard long contract (100 shares), frozen reported Greeks and unchanged interest rates. Signed local value changes before costs; no projected bid, ask, fill, P&L or net R.",
    limitation: "Greeks change with price, time and volatility. These unit shocks omit higher-order and cross effects, have no validated accuracy range and are especially unreliable near expiry or during large event moves. A $1 move has different relative size for each ETF. Quote timestamps do not independently verify Greek timestamps. No IV rank, historical comparison or win probability is established.",
    unitsSource: "https://robinhood.com/us/en/support/articles/options-chain-metrics/",
    probabilityUsed: false, winProbability: null, rankingChanged: false, sourceReads: 0, executionAllowed: false };
}

export function briefGuidanceSensitivities(report: ReturnType<typeof assessGuidanceSensitivities>, ids: string[]) {
  const selected = new Set(ids.slice(0,6));
  return { ...report, selection: "UP_TO_SIX_EXISTING_GUIDANCE_CANDIDATES_NOT_SENSITIVITY_RANKED", rows: report.rows.filter(r => selected.has(r.id)).map(r => ({
    ...r, scenarios: r.scenarios.map(({ components, ...scenario }) => scenario)
  })) };
}
