/**
 * Deterministic macro regime rules. No models, no AI: every threshold is a constant below and every
 * label carries the evidence that produced it. Changes are in bp for yields, % for prices.
 */
import type { SeriesStats } from "./stats.ts";

export const T = {
  rates20bp: 15, // 2Y 20d change for RISING/FALLING
  hikesPricedBp: 15, // 2Y minus Fed funds above this → market prices hikes
  cutsPricedBp: -25,
  usd20pct: 1.0,
  real20bp: 15,
  be20bp: 10,
  vix: { calm: 15, normal: 20, elevated: 30 },
  vix5Rising: 15, // % 5d change
  hy20Widening: 30, // bp
  hy20Tightening: -20,
  nfciTight: 0,
  nfciLoose: -0.4,
  spy20Up: 1.5, // %
  spy20Down: -1.5,
};

export type AxisId = "rates" | "expectations" | "usd" | "realYields" | "inflationExp" | "volatility" | "credit" | "liquidity" | "equities";

export interface Axis {
  id: AxisId;
  label: string; // e.g. RISING / FLAT / CALM
  evidence: string; // human readable numbers
  stats: Array<Pick<SeriesStats, "id" | "last" | "lastDate" | "chg1" | "chg5" | "chg20" | "z20" | "zLevel">>;
  missing?: boolean;
}

export type RegimeLabel = "RISK_ON" | "RISK_OFF" | "HAWKISH_TIGHTENING" | "STAGFLATION_ISH" | "DISINFLATION_EASING" | "MIXED";

export interface Regime {
  label: RegimeLabel;
  confidence: number; // 0..1: share of the label's weighted conditions that are met
  axes: Axis[];
  support: string[];
  against: string[];
  candidates: Array<{ label: RegimeLabel; score: number }>;
  asOf: string;
}

const p6 = (x: number | null) => (x === null ? "n/a" : String(Number(x.toPrecision(6))));
const fmt = (x: number | null, u: string) => (x === null ? "n/a" : `${x > 0 ? "+" : ""}${x}${u}`);
const pick = (s: SeriesStats) => ({ id: s.id, last: s.last, lastDate: s.lastDate, chg1: s.chg1, chg5: s.chg5, chg20: s.chg20, z20: s.z20, zLevel: s.zLevel });

export function classifyAxes(st: Record<string, SeriesStats | undefined>): Axis[] {
  const axes: Axis[] = [];
  const miss = (id: AxisId, why: string): Axis => ({ id, label: "UNKNOWN", evidence: why, stats: [], missing: true });

  const two = st.UST2Y;
  if (two?.chg20 != null) {
    const c = two.chg20;
    axes.push({ id: "rates", label: c > T.rates20bp ? "RISING" : c < -T.rates20bp ? "FALLING" : "FLAT", evidence: `2Y ${two.last}% (${fmt(two.chg1, "bp")} 1d, ${fmt(two.chg5, "bp")} 5d, ${fmt(c, "bp")} 20d, z ${two.z20})`, stats: [pick(two)] });
  } else axes.push(miss("rates", "2Y yield unavailable"));

  const ff = st.FEDFUNDS;
  if (two?.last != null && ff?.last != null) {
    const spread = Math.round((two.last - ff.last) * 100);
    axes.push({ id: "expectations", label: spread > T.hikesPricedBp ? "HIKES_PRICED" : spread < T.cutsPricedBp ? "CUTS_PRICED" : "ON_HOLD", evidence: `2Y − Fed funds = ${fmt(spread, "bp")} (FF ${ff.last}%)`, stats: [pick(two), pick(ff)] });
  } else axes.push(miss("expectations", "2Y or Fed funds unavailable"));

  const usd = st.DXY?.chg20 != null ? st.DXY : st.USD_BROAD;
  if (usd?.chg20 != null) {
    const c = usd.chg20;
    axes.push({ id: "usd", label: c > T.usd20pct ? "UP" : c < -T.usd20pct ? "DOWN" : "FLAT", evidence: `${usd.id} ${p6(usd.last)} (${fmt(usd.chg5, "%")} 5d, ${fmt(c, "%")} 20d)`, stats: [pick(usd)] });
  } else axes.push(miss("usd", "USD unavailable"));

  const real = st.REAL10Y;
  if (real?.chg20 != null) {
    const c = real.chg20;
    axes.push({ id: "realYields", label: c > T.real20bp ? "RISING" : c < -T.real20bp ? "FALLING" : "FLAT", evidence: `10Y real ${real.last}% (${fmt(real.chg5, "bp")} 5d, ${fmt(c, "bp")} 20d)`, stats: [pick(real)] });
  } else axes.push(miss("realYields", "DFII10 unavailable"));

  const be = st.BE5Y;
  if (be?.chg20 != null) {
    const c = be.chg20;
    axes.push({ id: "inflationExp", label: c > T.be20bp ? "RISING" : c < -T.be20bp ? "FALLING" : "FLAT", evidence: `5Y breakeven ${be.last}% (${fmt(c, "bp")} 20d)`, stats: [pick(be)] });
  } else axes.push(miss("inflationExp", "breakevens unavailable"));

  const vix = st.VIX?.last != null ? st.VIX : st.VIX_FRED;
  if (vix?.last != null) {
    const l = vix.last;
    let label = l < T.vix.calm ? "CALM" : l < T.vix.normal ? "NORMAL" : l < T.vix.elevated ? "ELEVATED" : "STRESS";
    if ((vix.chg5 ?? 0) > T.vix5Rising && (label === "CALM" || label === "NORMAL")) label += "_RISING";
    axes.push({ id: "volatility", label, evidence: `VIX ${p6(l)} (${fmt(vix.chg5, "%")} 5d)`, stats: [pick(vix)] });
  } else axes.push(miss("volatility", "VIX unavailable"));

  const hy = st.HYOAS;
  if (hy?.chg20 != null) {
    const c = hy.chg20;
    axes.push({ id: "credit", label: c > T.hy20Widening ? "WIDENING" : c < T.hy20Tightening ? "TIGHTENING" : "STABLE", evidence: `HY OAS ${hy.last}% (${fmt(c, "bp")} 20d, level z ${hy.zLevel})`, stats: [pick(hy)] });
  } else axes.push(miss("credit", "HY OAS unavailable"));

  const nf = st.NFCI;
  if (nf?.last != null) {
    axes.push({ id: "liquidity", label: nf.last > T.nfciTight ? "TIGHT" : nf.last < T.nfciLoose ? "LOOSE" : "NEUTRAL", evidence: `NFCI ${nf.last} (${nf.chg20 != null ? `${nf.chg20 > 0 ? "+" : ""}${(nf.chg20 / 100).toFixed(2)}` : "n/a"} over 4w; <0 = looser than average)`, stats: [pick(nf)] });
  } else axes.push(miss("liquidity", "NFCI unavailable"));

  const spy = st.SPY;
  if (spy?.chg20 != null && spy.last != null) {
    const above = spy.ma50 != null ? spy.last > spy.ma50 : null;
    const c = spy.chg20;
    const label = c > T.spy20Up && above !== false ? "UP" : c < T.spy20Down && above !== true ? "DOWN" : "RANGE";
    axes.push({ id: "equities", label, evidence: `SPY ${p6(spy.last)} (${fmt(spy.chg1, "%")} 1d, ${fmt(c, "%")} 20d, ${above === null ? "MA50 n/a" : above ? "above" : "below"} MA50 ${spy.ma50})`, stats: [pick(spy)] });
  } else axes.push(miss("equities", "SPY unavailable"));
  return axes;
}

type Cond = { axis: AxisId; any: string[]; w: number; text: string };
export const RULES: Record<Exclude<RegimeLabel, "MIXED">, Cond[]> = {
  RISK_OFF: [
    { axis: "volatility", any: ["ELEVATED", "STRESS", "NORMAL_RISING", "CALM_RISING"], w: 2, text: "volatility elevated or rising" },
    { axis: "credit", any: ["WIDENING"], w: 2, text: "credit spreads widening" },
    { axis: "equities", any: ["DOWN"], w: 1.5, text: "equities trending down" },
    { axis: "liquidity", any: ["TIGHT"], w: 1, text: "financial conditions tight" },
  ],
  HAWKISH_TIGHTENING: [
    { axis: "rates", any: ["RISING"], w: 2, text: "2Y yield rising" },
    { axis: "expectations", any: ["HIKES_PRICED"], w: 1.5, text: "hikes priced (2Y above Fed funds)" },
    { axis: "realYields", any: ["RISING"], w: 1.5, text: "real yields rising" },
    { axis: "usd", any: ["UP"], w: 1, text: "USD rising" },
  ],
  STAGFLATION_ISH: [
    { axis: "inflationExp", any: ["RISING"], w: 2, text: "breakevens rising" },
    { axis: "rates", any: ["RISING"], w: 1, text: "2Y yield rising" },
    { axis: "equities", any: ["DOWN", "RANGE"], w: 1.5, text: "equities not trending up" },
    { axis: "credit", any: ["WIDENING", "STABLE"], w: 0.5, text: "credit not tightening" },
  ],
  DISINFLATION_EASING: [
    { axis: "rates", any: ["FALLING"], w: 2, text: "2Y yield falling" },
    { axis: "expectations", any: ["CUTS_PRICED", "ON_HOLD"], w: 1, text: "no hikes priced" },
    { axis: "inflationExp", any: ["FALLING", "FLAT"], w: 1.5, text: "breakevens not rising" },
    { axis: "realYields", any: ["FALLING", "FLAT"], w: 1, text: "real yields not rising" },
    { axis: "credit", any: ["TIGHTENING", "STABLE"], w: 0.5, text: "credit calm" },
  ],
  RISK_ON: [
    { axis: "volatility", any: ["CALM", "NORMAL"], w: 2, text: "volatility calm" },
    { axis: "credit", any: ["TIGHTENING", "STABLE"], w: 2.5, text: "credit spreads stable/tightening" },
    { axis: "equities", any: ["UP"], w: 2, text: "equities trending up" },
    { axis: "liquidity", any: ["LOOSE", "NEUTRAL"], w: 1, text: "financial conditions not tight" },
  ],
};

export const MIN_CONFIDENCE = 0.6;

export function classifyRegime(axes: Axis[], asOf = new Date().toISOString()): Regime {
  const by = new Map(axes.map((a) => [a.id, a]));
  const cands = (Object.keys(RULES) as Array<keyof typeof RULES>).map((label) => {
    let met = 0, total = 0;
    const support: string[] = [], against: string[] = [];
    for (const c of RULES[label]) {
      const a = by.get(c.axis);
      if (!a || a.missing) continue; // unknown axes don't count either way
      total += c.w;
      if (c.any.includes(a.label)) {
        met += c.w;
        support.push(`${c.text}: ${a.evidence}`);
      } else against.push(`not ${c.text}: ${a.evidence}`);
    }
    return { label, score: total ? met / total : 0, support, against };
  });
  cands.sort((a, b) => b.score - a.score);
  const top = cands[0]!;
  const second = cands[1];
  // ambiguous when the best rule is weak or two incompatible regimes tie closely
  const ambiguous = top.score < MIN_CONFIDENCE || (second && top.score - second.score < 0.1 && !compatible(top.label, second.label));
  return {
    label: ambiguous ? "MIXED" : top.label,
    confidence: Math.round(top.score * 100) / 100,
    axes,
    support: top.support,
    against: ambiguous && second ? [...top.against, `competing regime ${second.label} scores ${second.score.toFixed(2)}`] : top.against,
    candidates: cands.map((c) => ({ label: c.label, score: Math.round(c.score * 100) / 100 })),
    asOf,
  };
}

function compatible(a: RegimeLabel, b: RegimeLabel): boolean {
  const pairs = new Set(["HAWKISH_TIGHTENING|STAGFLATION_ISH", "STAGFLATION_ISH|HAWKISH_TIGHTENING", "RISK_OFF|STAGFLATION_ISH", "STAGFLATION_ISH|RISK_OFF", "RISK_ON|DISINFLATION_EASING", "DISINFLATION_EASING|RISK_ON"]);
  return pairs.has(`${a}|${b}`);
}
