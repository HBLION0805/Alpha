/**
 * 做空清单 (short-side pre-trade checklist) from the mentor text 做空学 (knowledge/mentor/discipline/short-selling.md, verbatim;
 * the mapping is DK 整理). Machine-readable spec: knowledge/mentor/discipline/short-selling.rules.json (kept in sync by test/shortside.test.ts).
 *
 * WARN-ONLY. Nothing here blocks a trade: the only hard requirement for a practice trade stays the written plan card (paper.ts cardMissing).
 * Phase 1 expresses bearish views only through defined-risk structures (long puts / put debit spreads). Short stock and covered puts are
 * NOT enabled (docs/DECISIONS.md 2026-10-17). Pure: all bars are fetched by the CLI and passed in; missing data is reported, never filled.
 */
import { sma } from "../adapters/indicators.ts";

export interface OhlcBar { t: string; o: number; h: number; l: number; c: number; v?: number }
export interface ShortInput {
  sym: string;
  /** daily bars of the underlying, oldest first; the last bar is the entry day (may be a live/partial bar) */
  bars: OhlcBar[];
  /** entry price of the underlying (defaults to the last close) */
  spot?: number | null;
  /** SPY daily bars (index benchmark) */
  spyBars?: OhlcBar[] | null;
  /** sector ETF / peer benchmark symbol and bars (null sym = no mapping known) */
  sectorSym?: string | null; sectorBars?: OhlcBar[] | null;
  /** option expirations of the structure (front = earliest) and the as-of ET day */
  expirations?: string[]; asOf?: string;
  /** days the thesis needs to play out (proposal.thesisHorizonDays); default SHORT_LIMITS.defaultHorizonDays */
  horizonDays?: number | null;
  /** planned time stop (YYYY-MM-DD) — must not be after the front expiry */
  timeStopAt?: string | null;
  /** price at which the bearish thesis is wrong (close above it) */
  invalidationLevel?: number | null;
  /** the user's written squeeze check (short interest, float, gamma, meme sentiment); empty = not checked */
  squeezeCheck?: string | null;
  /** dealer net gamma from gex.ts ($ per 1%), for the squeeze detail only */
  netGamma?: number | null;
}
export interface ShortMetrics {
  ret20: number | null; ret5: number | null; spyRet20: number | null; spyRet5: number | null; sectorRet20: number | null; sectorRet5: number | null;
  ma20: number | null; ma50: number | null; ma50Prev: number | null; atr14: number | null; dayChgPct: number | null; priorLow: number | null;
  stretchAtr: number | null; maxUpDay60: number | null; rvol20: number | null; frontDte: number | null; failedRebound: boolean | null;
}
export interface ShortCheck { tags: string[]; details: string[]; info: string[]; manual: string[]; metrics: ShortMetrics }

/** DK thresholds (review/practice thresholds, NOT trading rules). Mirror of short-selling.rules.json "thresholds". */
export const SHORT_LIMITS = {
  rsLookback: 20, rsShortLookback: 5,
  maFast: 20, maSlow: 50, maSlopeLookback: 10,
  chaseDayDropPct: -3, chaseStretchAtr: 2, atrPeriod: 14,
  reboundLookback: 5,
  squeezeUpDayPct: 10, squeezeUpDayLookback: 60, squeezeRvolPct: 80,
  defaultHorizonDays: 7, earlyBufferDays: 14,
} as const;

/** every warn tag this module can emit (the rules.json spec must list exactly these) */
export const SHORT_TAGS = ["short_vs_strength", "short_no_relative_weakness", "short_chasing", "short_squeeze_prone", "short_squeeze_risk_unchecked",
  "short_expiry_too_short", "short_invalidation_not_above_spot", "short_data_insufficient"] as const;
export type ShortTag = typeof SHORT_TAGS[number];

/** manual items (not derivable from Alpha data at entry) — shown on the plan card and asked at review */
export const SHORT_MANUAL: Array<{ id: string; point: number[]; text: string }> = [
  { id: "narrative_breaking", point: [1], text: "叙事在破、资金在跑吗？写下哪条叙事破了、谁在走（新闻/资金流/财报指引）——不是“大家都在买的热门股”" },
  { id: "squeeze_inputs", point: [5], text: "轧空风险：空头率（short interest % float）、流通盘大小、Gamma（期权集中/负 gamma）、散户情绪/梗股热度——写进 --squeeze-check" },
  { id: "peers_weaker", point: [7], text: "同行对比：同板块的同行涨 5% 它涨 1%、同行跌 2% 它跌 8% 吗？（Alpha 只自动比 SPY 和板块 ETF）" },
  { id: "price_thesis_divergence", point: [6], text: "持仓中：价格和论点分离（论点没变但价格一直涨、或强于板块）→ 离场，不跟市场讲道理" },
  { id: "take_profit_into_panic", point: [9], text: "持仓中：恐慌暴跌日先收钱（按计划卡第 5 节分批止盈），别等一根大阳线抢回去" },
  { id: "admit_when_wrong", point: [2, 10], text: "复盘：Thesis 错了就认、仓位错了就砍、节奏错了就撤；“可是我最后看对了”不算（纪律 #19 论点与仓位分开）" },
];

/** sector ETF used as the "板块" benchmark when the user gives no --sector (small, editable map; unknown → manual) */
export const SECTOR_OF: Record<string, string> = {
  NVDA: "SMH", AMD: "SMH", INTC: "SMH", AVGO: "SMH", MU: "SMH", TSM: "SMH", QCOM: "SMH", ARM: "SMH", SMCI: "SMH", MRVL: "SMH", AMAT: "SMH", LRCX: "SMH",
  AAPL: "XLK", MSFT: "XLK", ORCL: "XLK", CRM: "XLK", ADBE: "XLK", NOW: "XLK", PLTR: "XLK", IBM: "XLK",
  GOOGL: "XLC", GOOG: "XLC", META: "XLC", NFLX: "XLC", DIS: "XLC",
  AMZN: "XLY", TSLA: "XLY", HD: "XLY", NKE: "XLY", MCD: "XLY", SBUX: "XLY",
  JPM: "XLF", BAC: "XLF", GS: "XLF", MS: "XLF", WFC: "XLF", C: "XLF", COIN: "XLF", HOOD: "XLF",
  XOM: "XLE", CVX: "XLE", OXY: "XLE", COP: "XLE", UNH: "XLV", LLY: "XLV", JNJ: "XLV", PFE: "XLV", MRNA: "XLV",
  BA: "XLI", CAT: "XLI", GE: "XLI", UPS: "XLI", WMT: "XLP", COST: "XLP", KO: "XLP", PG: "XLP",
};
/** broad index / sector / macro ETFs: no sector benchmark and no single-stock squeeze mechanics */
export const BROAD_ETFS = new Set(["SPY", "QQQ", "IWM", "DIA", "SMH", "XLK", "XLC", "XLY", "XLF", "XLE", "XLV", "XLI", "XLP", "XLU", "XLB", "XLRE", "TLT", "HYG", "GLD", "GDX", "UUP", "IBIT", "KRE", "XBI", "ARKK"]);

const r2 = (x: number) => Math.round(x * 100) / 100;
const pct = (x: number | null) => (x == null ? "—" : `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`);
const day = (t: string) => t.slice(0, 10);

/** % return over n bars ending at the last bar; null when not enough bars */
export function retN(bars: OhlcBar[], n: number): number | null {
  if (bars.length < n + 1) return null;
  const a = bars.at(-1 - n)!.c, b = bars.at(-1)!.c;
  return a > 0 ? (b / a - 1) * 100 : null;
}
/** align benchmark bars to the underlying's dates (common dates only), so both returns cover the same sessions */
export function aligned(a: OhlcBar[], b: OhlcBar[]): [OhlcBar[], OhlcBar[]] {
  const m = new Map(b.map((x) => [day(x.t), x])), A: OhlcBar[] = [], B: OhlcBar[] = [];
  for (const x of a) { const y = m.get(day(x.t)); if (y) { A.push(x); B.push(y); } }
  return [A, B];
}
export function atr(bars: OhlcBar[], n: number = SHORT_LIMITS.atrPeriod): number | null {
  if (bars.length < n + 1) return null;
  let s = 0;
  for (let i = bars.length - n; i < bars.length; i++) { const b = bars[i]!, pc = bars[i - 1]!.c; s += Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)); }
  return s / n;
}
/** annualised close-to-close realised vol over n bars, in % */
export function realizedVol(bars: OhlcBar[], n = 20): number | null {
  if (bars.length < n + 1) return null;
  const r: number[] = [];
  for (let i = bars.length - n; i < bars.length; i++) r.push(Math.log(bars[i]!.c / bars[i - 1]!.c));
  const m = r.reduce((s, x) => s + x, 0) / r.length, v = r.reduce((s, x) => s + (x - m) ** 2, 0) / (r.length - 1);
  return Math.sqrt(v * 252) * 100;
}

/** Entry-time short-side checks for a bearish plan / practice open. Every tag is a warning; `manual` lists what Alpha cannot check. */
export function shortEntryChecks(i: ShortInput): ShortCheck {
  const L = SHORT_LIMITS, tags: ShortTag[] = [], details: string[] = [], info: string[] = [], missing: string[] = [];
  const add = (t: ShortTag, d: string) => { if (!tags.includes(t)) tags.push(t); details.push(`做空清单·${t}：${d}`); };
  const b = i.bars, closes = b.map((x) => x.c), spot = i.spot ?? b.at(-1)?.c ?? null;
  const ma20 = sma(closes, L.maFast), ma50 = sma(closes, L.maSlow), ma50Prev = b.length >= L.maSlow + L.maSlopeLookback ? sma(closes.slice(0, -L.maSlopeLookback), L.maSlow) : null;
  const a14 = atr(b), last = b.at(-1), prev = b.at(-2);
  const dayChgPct = last && prev && prev.c > 0 ? ((spot ?? last.c) / prev.c - 1) * 100 : null;
  const stretchAtr = ma20 != null && a14 && spot != null ? (ma20 - spot) / a14 : null;
  const broad = BROAD_ETFS.has(i.sym.toUpperCase());

  // 3) 别猜顶 / don't short strong uptrends: close > MA20 > MA50 with MA50 rising
  if (ma20 == null || ma50 == null || ma50Prev == null || spot == null) missing.push(`趋势（需要 ≥${L.maSlow + L.maSlopeLookback} 根日线）`);
  else if (spot > ma20 && ma20 > ma50 && ma50 > ma50Prev)
    add("short_vs_strength", `${i.sym} 处在上升趋势（价 ${r2(spot)} > MA20 ${r2(ma20)} > MA50 ${r2(ma50)}，MA50 ${L.maSlopeLookback} 日前 ${r2(ma50Prev)} 在上升）→ “涨太多”不是做空理由，等它自己开始倒（第 3 条 / 纪律 #08）`);

  // 7) 空弱不空强: weaker than the index AND the sector over 20 sessions (5-day shown)
  const ret20 = retN(b, L.rsLookback), ret5 = retN(b, L.rsShortLookback);
  let spyRet20: number | null = null, spyRet5: number | null = null, sectorRet20: number | null = null, sectorRet5: number | null = null;
  const rel = (bench: OhlcBar[] | null | undefined): [number | null, number | null, number | null] => {
    if (!bench?.length) return [null, null, null];
    const [A, B] = aligned(b, bench); return [retN(A, L.rsLookback), retN(B, L.rsLookback), retN(B, L.rsShortLookback)];
  };
  const notWeaker: string[] = [];
  if (i.sym.toUpperCase() !== "SPY") {
    const [s20, x20, x5] = rel(i.spyBars); spyRet20 = x20; spyRet5 = x5;
    if (s20 == null || x20 == null) missing.push("相对 SPY 强弱（缺 SPY 或日线不足）");
    else if (s20 >= x20) notWeaker.push(`20 日 ${pct(s20)} ≥ SPY ${pct(x20)}`);
  }
  if (!broad) {
    if (!i.sectorSym) missing.push(`相对板块强弱（${i.sym} 没有板块映射，用 --sector 指定）`);
    else {
      const [s20, x20, x5] = rel(i.sectorBars); sectorRet20 = x20; sectorRet5 = x5;
      if (s20 == null || x20 == null) missing.push(`相对板块 ${i.sectorSym} 强弱（缺数据）`);
      else if (s20 >= x20) notWeaker.push(`20 日 ${pct(s20)} ≥ 板块 ${i.sectorSym} ${pct(x20)}`);
    }
  }
  if (notWeaker.length) add("short_no_relative_weakness", `${i.sym} 没有跑输：${notWeaker.join("；")}（5 日 ${pct(ret5)} vs SPY ${pct(spyRet5)}${i.sectorSym && !broad ? ` / ${i.sectorSym} ${pct(sectorRet5)}` : ""}）→ 空弱不空强，要同时跑输指数和板块（第 7 条）`);
  else if (ret20 != null && (spyRet20 != null || sectorRet20 != null)) info.push(`✅ 相对弱势：20 日 ${pct(ret20)} vs SPY ${pct(spyRet20)}${sectorRet20 != null ? ` / ${i.sectorSym} ${pct(sectorRet20)}` : ""}`);

  // 4) 不追空: big red day, below the prior-day low, or stretched far under MA20; prefer the failed rebound to resistance
  const chase: string[] = [];
  if (dayChgPct != null && dayChgPct <= L.chaseDayDropPct) chase.push(`今天已跌 ${pct(dayChgPct)}（大阴线下面追）`);
  if (prev && spot != null && spot < prev.l) chase.push(`价 ${r2(spot)} 已跌破前日低点 ${r2(prev.l)}`);
  if (stretchAtr != null && stretchAtr >= L.chaseStretchAtr) chase.push(`价低于 MA20 ${r2(stretchAtr)} 个 ATR（≥${L.chaseStretchAtr}，已经趴在地上）`);
  if (!prev || a14 == null) missing.push("追空检查（日线不足）");
  if (chase.length) add("short_chasing", `${chase.join("；")} → 等反弹到阻力没人接再下手（第 4 条 / 纪律 #07）`);
  let failedRebound: boolean | null = null;
  if (b.length >= L.maFast + L.reboundLookback && spot != null && ma20 != null && a14 != null) {
    const w = b.slice(-1 - L.reboundLookback, -1), hi = Math.max(...w.map((x) => x.h));
    const touched = w.some((x, k) => { const m = sma(closes.slice(0, b.length - 1 - L.reboundLookback + k + 1), L.maFast); return m != null && x.h >= m; });
    failedRebound = touched && spot < ma20 && spot <= hi - a14;
    if (failedRebound) info.push(`✅ 反弹碰到 MA20 后回落（近 ${L.reboundLookback} 日高 ${r2(hi)} → ${r2(spot)}）：偏好的做空位置`);
  }

  // 5) 垃圾股也能操死你: OHLC squeeze proxy + the written squeeze check
  const ups = b.slice(-L.squeezeUpDayLookback).map((x, k, arr) => (k && arr[k - 1]!.c > 0 ? (x.c / arr[k - 1]!.c - 1) * 100 : null)).filter((x): x is number => x != null);
  const maxUpDay60 = ups.length ? Math.max(...ups) : null, rvol20 = realizedVol(b);
  if (!broad) {
    const sq: string[] = [];
    if (maxUpDay60 != null && maxUpDay60 >= L.squeezeUpDayPct) sq.push(`近 ${L.squeezeUpDayLookback} 日有单日 ${pct(maxUpDay60)}`);
    if (rvol20 != null && rvol20 >= L.squeezeRvolPct) sq.push(`20 日实现波动率 ${rvol20.toFixed(0)}%`);
    if (sq.length) add("short_squeeze_prone", `${sq.join("；")} → 容易被轧（日线代理，不是空头率数据；第 5 条）`);
    if (!i.squeezeCheck?.trim()) add("short_squeeze_risk_unchecked", `没写轧空检查（空头率/流通盘/Gamma/情绪盘）${i.netGamma != null && i.netGamma < 0 ? "；GEX 现在是负 gamma（放大波动）" : ""} → 用 --squeeze-check "SI x% · float y · gamma … · 情绪 …" 写下来（第 5 条）`);
    else info.push(`轧空检查（你写的）：${i.squeezeCheck.trim()}`);
  }

  // 8) 时间错 = 方向错: the front expiry must outlive the thesis horizon plus being two weeks early
  const exps = (i.expirations ?? []).filter(Boolean).sort(), asOf = i.asOf ?? (last ? day(last.t) : null);
  const frontDte = exps[0] && asOf ? Math.round((Date.parse(exps[0]) - Date.parse(asOf)) / 864e5) : null;
  if (frontDte != null) {
    const h = i.horizonDays && i.horizonDays > 0 ? i.horizonDays : L.defaultHorizonDays, need = h + L.earlyBufferDays, why: string[] = [];
    if (frontDte < need) why.push(`最近到期 ${frontDte} 天 < 论点 ${h} 天 + 早两周缓冲 ${L.earlyBufferDays} 天 = ${need} 天`);
    if (i.timeStopAt && exps[0] && i.timeStopAt > exps[0]) why.push(`时间止损 ${i.timeStopAt} 在到期 ${exps[0]} 之后`);
    if (why.length) add("short_expiry_too_short", `${why.join("；")} → 结构要活到论点兑现那天（第 8 条）`);
  }

  // 2/10) pre-written invalidation must sit ABOVE the entry for a bearish trade
  if (i.invalidationLevel != null && spot != null && i.invalidationLevel <= spot)
    add("short_invalidation_not_above_spot", `论点失效价 ${r2(i.invalidationLevel)} 不在现价 ${r2(spot)} 上方 → 看空的失效位必须在上方（第 2/10 条）`);

  if (missing.length) add("short_data_insufficient", `没能自动检查：${missing.join("；")} → 这几项按手动清单自己判断`);
  return { tags, details, info, manual: SHORT_MANUAL.map((m) => `[ ] ${m.text}（第 ${m.point.join("/")} 条）`),
    metrics: { ret20, ret5, spyRet20, spyRet5, sectorRet20, sectorRet5, ma20, ma50, ma50Prev, atr14: a14, dayChgPct, priorLow: prev?.l ?? null, stretchAtr, maxUpDay60, rvol20, frontDte, failedRebound } };
}

/** plan-card section lines (section 9) */
export function renderShortSection(c: ShortCheck): string[] {
  return [...(c.tags.length ? c.details.map((d) => `- ⚠️ ${d}`) : ["- ✅ 自动项没有提示"]), ...c.info.map((x) => `- ${x}`),
    "- 手动清单（Alpha 推不出，自己勾）：", ...c.manual.map((m) => `  - ${m}`),
    "- _只提示，不阻止。第一阶段看空只用定义风险结构（买 Put / Put 借方价差）；做空股票和 covered put 不启用。_"];
}
