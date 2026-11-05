/**
 * Kelly sizing used ONLY as an upper reference. The result never sets the size.
 *
 * 大佬 2026-10-14 (knowledge/mentor/MENTOR_KELLY_INTC_2026-10-14.md), "Critical thinking: Why Kelly is BS":
 *  1. "Fully utilize kelly will be bad; ... when correlations suddenly converge toward 1, you can end up carrying
 *     a much larger effective beta than you thought."              → correlation-stress warning
 *  2. "The probability of winning (p) is basically an assumption ... A small change in your p assumption can change
 *     the Kelly sizing. like DCF"                                   → p ±5 / ±10 pt sensitivity table
 *  3. "Kelly doesn't fully capture the constraints that actually determine whether you survive. Liquidity, cash on
 *     hand, margin requirements.."                                  → liquidity / cash / margin checks
 * Background: knowledge/mentor/kelly/kelly-article.pdf (Kelly 公式补充).
 * Hard caps come from the rule card: 1% max loss per trade and 3% per underlying (期权课 13.3, owner rules).
 */
import { DEFAULT_RULES, type RuleCard } from "./rules.ts";

export const KELLY_CITE = "大佬 2026-10-14 Why Kelly is BS (knowledge/mentor/MENTOR_KELLY_INTC_2026-10-14.md)";
export const MAX_KELLY_FRACTION = 0.25;

/** Full-Kelly fraction of capital to RISK. p = win probability, b = average win / average loss (both > 0). */
export function kellyFraction(p: number, b: number): number {
  if (!(b > 0) || !(p >= 0 && p <= 1)) return 0;
  return Math.max(0, p - (1 - p) / b);
}

export interface KellyInput {
  capital: number;
  p: number;                       // assumed win probability (an assumption, not a fact)
  winPerContract: number;          // $ average win per contract
  maxLossPerContract: number;      // $ defined max loss per contract (must be > 0; undefined risk is not sized)
  kellyFraction?: number;          // default 0.25, clamped to ≤ 0.25
  existingUnderlyingRisk?: number; // $ max loss already open on this underlying
  /** $ max loss of other open positions that could move together in a stress (corr → 1) */
  correlatedRisk?: number[];
  cash?: number;                   // cash on hand for debit
  debitPerContract?: number;       // $ paid per contract (default = maxLossPerContract)
  buyingPower?: number; marginPerContract?: number;
  openInterest?: number | null; bid?: number | null; ask?: number | null;
}
export interface KellyWarning { id: string; severity: "BLOCK" | "WARN" | "INFO"; detail: string; cite: string }
export interface KellyResult {
  fullKelly: number; usedFraction: number;
  kellyRiskDollars: number;        // fractional-Kelly $ at risk (reference)
  capRiskDollars: number;          // rule-card cap in $
  maxContracts: number;            // UPPER BOUND after every cap; the actual size is chosen separately and may be 0
  binding: string;                 // which limit binds
  sensitivity: { dp: number; p: number; fullKelly: number; contracts: number }[];
  warnings: KellyWarning[];
  note: string;
}

export function kellyReference(k: KellyInput, R: RuleCard = DEFAULT_RULES): KellyResult {
  const warnings: KellyWarning[] = [];
  const frac = Math.min(MAX_KELLY_FRACTION, Math.max(0, k.kellyFraction ?? MAX_KELLY_FRACTION));
  if ((k.kellyFraction ?? 0) > MAX_KELLY_FRACTION) warnings.push({ id: "kelly_fraction_clamped", severity: "WARN", detail: `requested Kelly fraction ${k.kellyFraction} clamped to ${MAX_KELLY_FRACTION}`, cite: `${KELLY_CITE} 1: Fully utilize kelly will be bad` });
  const L = k.maxLossPerContract;
  if (!(L > 0)) {
    warnings.push({ id: "undefined_risk", severity: "BLOCK", detail: "max loss per contract not defined. Kelly is not computed for undefined-risk trades", cite: "owner rule: defined-risk only / 期权课 附录 D.2" });
    return { fullKelly: 0, usedFraction: frac, kellyRiskDollars: 0, capRiskDollars: 0, maxContracts: 0, binding: "undefined_risk", sensitivity: [], warnings, note: "NO_TRADE" };
  }
  const b = k.winPerContract / L;
  const perTradeCap = k.capital * R.sellerMaxLossPerTradePct / 100;
  const underlyingCap = Math.max(0, k.capital * R.perUnderlyingMaxLossPct / 100 - (k.existingUnderlyingRisk ?? 0));
  const capRisk = Math.min(perTradeCap, underlyingCap);

  const contractsFor = (p: number) => {
    const limits: [string, number][] = [
      ["fractional_kelly", Math.floor((frac * kellyFraction(p, b) * k.capital) / L)],
      ["per_trade_1pct", Math.floor(perTradeCap / L)],
      ["per_underlying_3pct", Math.floor(underlyingCap / L)],
    ];
    const debit = k.debitPerContract ?? L;
    if (k.cash != null) limits.push(["cash", Math.floor(k.cash / debit)]);
    if (k.buyingPower != null && k.marginPerContract) limits.push(["margin", Math.floor(k.buyingPower / k.marginPerContract)]);
    return limits.reduce((a, x) => (x[1] < a[1] ? x : a));
  };
  const full = kellyFraction(k.p, b);
  const [binding, n] = contractsFor(k.p);

  const sensitivity = [-10, -5, 0, 5, 10].map((dp) => {
    const p = Math.min(1, Math.max(0, k.p + dp / 100));
    return { dp, p, fullKelly: kellyFraction(p, b), contracts: Math.max(0, contractsFor(p)[1]) };
  });
  const lo = sensitivity[0]!;
  if (full > 0 && lo.fullKelly === 0) warnings.push({ id: "p_sensitivity", severity: "WARN", detail: `edge disappears if p is 10 pts lower (p ${lo.p.toFixed(2)} → Kelly 0). If you cannot defend p within ±10 pts, NO_TRADE`, cite: `${KELLY_CITE} 2: p is basically an assumption ... like DCF` });
  else if (full > 0 && lo.fullKelly < full / 2) warnings.push({ id: "p_sensitivity", severity: "WARN", detail: `full Kelly ${(full * 100).toFixed(1)}% → ${(lo.fullKelly * 100).toFixed(1)}% when p −10 pts: the size depends heavily on an assumption`, cite: `${KELLY_CITE} 2` });
  if (full === 0) warnings.push({ id: "no_edge", severity: "BLOCK", detail: `Kelly ≤ 0 at p=${k.p}, b=${b.toFixed(2)}: no edge under your own assumptions → NO_TRADE`, cite: KELLY_CITE });

  const thisRisk = Math.max(0, n) * L;
  const corrTotal = (k.correlatedRisk ?? []).reduce((s, x) => s + x, 0) + (k.existingUnderlyingRisk ?? 0) + thisRisk;
  const corrCap = k.capital * R.commonBetMaxLossPct / 100;
  warnings.push({ id: "correlation_stress", severity: corrTotal > corrCap ? "WARN" : "INFO", detail: `if correlations go to 1, this trade plus correlated/same-underlying positions lose $${corrTotal.toFixed(0)} together (${((corrTotal / k.capital) * 100).toFixed(2)}% vs common-bet cap ${R.commonBetMaxLossPct}%)${corrTotal > corrCap ? ". Your effective beta is larger than it looks, so cut size" : ""}`, cite: `${KELLY_CITE} 1: correlations suddenly converge toward 1 / 期权课 清单 13-3` });

  const spr = k.bid != null && k.ask != null && k.ask > 0 ? ((k.ask - k.bid) / ((k.ask + k.bid) / 2)) * 100 : null;
  if (k.openInterest == null && spr == null) warnings.push({ id: "liquidity", severity: "WARN", detail: "liquidity unknown (no OI / bid-ask). Check before sizing", cite: `${KELLY_CITE} 3: Liquidity` });
  else if ((k.openInterest != null && k.openInterest < R.minOpenInterest) || (spr != null && spr > R.maxBidAskPct)) warnings.push({ id: "liquidity", severity: "WARN", detail: `thin: OI ${k.openInterest ?? "—"}, spread ${spr?.toFixed(1) ?? "—"}%`, cite: `${KELLY_CITE} 3 / 期权课 附录 D.1` });
  if (k.cash == null) warnings.push({ id: "cash", severity: "WARN", detail: "cash on hand not provided", cite: `${KELLY_CITE} 3: cash on hand` });
  else if (n < 1 && binding === "cash") warnings.push({ id: "cash", severity: "BLOCK", detail: `cash $${k.cash} cannot pay one contract`, cite: `${KELLY_CITE} 3` });
  if (k.marginPerContract && k.buyingPower == null) warnings.push({ id: "margin", severity: "WARN", detail: "margin needed but buying power not provided", cite: `${KELLY_CITE} 3: margin requirements` });
  else if (k.marginPerContract && n < 1 && binding === "margin") warnings.push({ id: "margin", severity: "BLOCK", detail: "buying power cannot carry one contract", cite: `${KELLY_CITE} 3` });

  return {
    fullKelly: full, usedFraction: frac, kellyRiskDollars: frac * full * k.capital, capRiskDollars: capRisk,
    maxContracts: Math.max(0, n), binding, sensitivity, warnings,
    note: "Upper reference only. Kelly is never the size. Choose ≤ maxContracts; 0 / NO_TRADE is valid.",
  };
}
