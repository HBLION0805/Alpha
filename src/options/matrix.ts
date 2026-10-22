/**
 * Strategy selection matrix — transcribed from the options course 第14章 14.4 and 附录 D.1
 * (knowledge/courses/options/15-第14章-系统与流程.md, 21-附录D-四份模板.md).
 * Owner's risk-first filter on top: defined-risk only. Naked short options and short straddles/strangles are never
 * emitted (13.3: "本课不建议个人做"); covered call / cash-secured put appear only as `optional`.
 * "不做" cells return NO_TRADE (D.1 第七步：默认输出是"不做").
 */
export type Direction = "bull" | "bear" | "neutral" | "big_move" | "hedge";
export type IvLevel = "HIGH" | "MID" | "LOW";
export interface Candidate { structure: string; zh: string; why: string; definedRisk: true; optional?: boolean; requires?: string; strikes?: string; expiry?: string; cite: string }

/** 14.5 执行价与到期日规则汇总 */
export const STRIKE_EXPIRY: Record<string, { strikes: string; expiry: string }> = {
  long_call: { strikes: "Delta 0.30–0.70（看涨低 IV 格：0.50–0.70）", expiry: "时间窗口 + 1 个月" },
  long_put: { strikes: "Delta 0.30–0.70", expiry: "时间窗口 + 1 个月" },
  bull_call_debit_spread: { strikes: "买入腿 Delta 0.50–0.60，卖出腿在预期幅度上沿", expiry: "时间窗口 + 2–4 周" },
  bear_put_debit_spread: { strikes: "买入腿 Delta 0.50–0.60，卖出腿在预期幅度上沿", expiry: "时间窗口 + 2–4 周" },
  put_debit_spread_hedge: { strikes: "买入腿 Delta 0.50–0.60，卖出腿在预期幅度上沿", expiry: "时间窗口 + 2–4 周" },
  leaps_call: { strikes: "Delta 0.70–0.80", expiry: "12–24 个月" },
  pmcc: { strikes: "LEAPS Delta 0.70–0.80 + 卖近月", expiry: "12–24 个月 / 30–45 天" },
  covered_call: { strikes: "Delta 0.20–0.30", expiry: "30–45 天" },
  cash_secured_put: { strikes: "Delta 0.20–0.30", expiry: "30–45 天" },
  bull_put_credit_spread: { strikes: "卖出腿 Delta 0.16–0.30，宽 5–10", expiry: "30–45 天" },
  bear_call_credit_spread: { strikes: "卖出腿 Delta 0.16–0.30，宽 5–10", expiry: "30–45 天" },
  iron_condor: { strikes: "卖出腿 Delta 0.10–0.20，翼宽 5–10", expiry: "30–45 天" },
  iron_fly: { strikes: "卖平值，两侧翼", expiry: "30–45 天" },
  calendar: { strikes: "平值或略偏向观点方向", expiry: "卖近月（含事件）、买远月（+30–60 天）" },
  long_straddle: { strikes: "平值", expiry: "事件后最近到期，或 30–60 天（无事件）" },
  long_strangle: { strikes: "两侧价外", expiry: "事件后最近到期，或 30–60 天（无事件）" },
  reverse_iron_condor: { strikes: "买入腿近平值，卖出翼在外", expiry: "事件后最近到期" },
  protective_put: { strikes: "价外 10%–20%", expiry: "3–6 个月，到期前 1 个月滚动" },
  collar: { strikes: "看跌价外 10%，看涨价外 8%–15%", expiry: "按季度" },
  vix_call: { strikes: "—", expiry: "2–3 月" },
};

const C = (structure: string, zh: string, why: string, extra: Partial<Candidate> = {}): Candidate => ({ structure, zh, why, definedRisk: true, cite: "期权课 14.4 / 附录 D.1", ...STRIKE_EXPIRY[structure], ...extra });
const NO = (why: string): Candidate => C("NO_TRADE", "不做", why);

const CELLS: Record<Direction, Record<IvLevel, Candidate[]>> = {
  bull: {
    LOW: [C("long_call", "买入看涨（Δ0.5–0.7）", "低 IV：买凸性便宜，最大亏损 = 权利金"), C("leaps_call", "LEAPS", "股票替代，Theta 低")],
    MID: [C("bull_call_debit_spread", "看涨借记价差", "剥掉 Vega/Theta，封顶收益"), C("pmcc", "PMCC", "对角价差作为备兑替代")],
    HIGH: [C("bull_put_credit_spread", "看跌信用价差", "高 IV：卖贵的权利金，带保护翼；按最大亏损定仓位"),
      C("cash_secured_put", "现金担保卖沽", "只在愿意持有的价格", { optional: true, requires: "行权价×100 现金全额备付" }),
      C("covered_call", "备兑（若持股）", "只对已持有的股票", { optional: true, requires: "每张 100 股" })],
  },
  bear: {
    LOW: [C("long_put", "买入看跌", "低 IV：买凸性便宜"), C("bear_put_debit_spread", "看跌借记价差", "降低成本与 Vega")],
    MID: [C("bear_put_debit_spread", "看跌借记价差", "剥掉 Vega/Theta")],
    HIGH: [C("bear_call_credit_spread", "看涨信用价差", "高 IV：卖贵的权利金，带保护翼")],
  },
  neutral: {
    LOW: [NO("中性 × 低 IV：不做（或日历做多远月 Vega）"), C("calendar", "日历", "做多远月 Vega")],
    MID: [C("iron_condor", "小仓位铁鹰", "定义风险的卖波动率，仓位减小")],
    HIGH: [C("iron_condor", "铁鹰", "定义风险的卖波动率"), C("iron_fly", "铁蝶", "精确目标，Theta 大")],
  },
  big_move: {
    LOW: [C("long_straddle", "买入跨式", "赌大动，亏损 = 净付"), C("long_strangle", "买入宽跨式", "更便宜，需要更大的动")],
    MID: [C("reverse_iron_condor", "反向铁鹰", "赌大于定价的变动，亏损封顶")],
    HIGH: [NO("大动 × 高 IV：不做（有事件则日历）")],
  },
  hedge: {
    LOW: [C("protective_put", "保护性看跌", "IV 低时买保护"), C("vix_call", "VIX 看涨", "崩盘中反应更猛；注意期限结构成本")],
    MID: [C("put_debit_spread_hedge", "看跌价差", "降低成本、限定保护范围")],
    HIGH: [C("collar", "领口", "用卖看涨支付看跌；放弃上涨", { requires: "持股" }), C("put_debit_spread_hedge", "看跌价差", "高 IV 时卖出腿抵消成本")],
  },
};

/** Structures that must never be suggested regardless of inputs (owner rule + 期权课 13.3). */
export const FORBIDDEN = ["naked_call", "naked_put", "short_straddle", "short_strangle", "ratio_spread_uncovered"] as const;

/** 附录 D.1 第四步：事件叠加 */
function eventOverlay(d: Direction, iv: IvLevel, base: Candidate[]): { candidates: Candidate[]; note: string } {
  const cite = "期权课 附录 D.1 第四步 / 14.4 事件叠加";
  if (d === "bull" || d === "bear") {
    const spreads = base.filter((c) => /spread|pmcc/.test(c.structure));
    const fallback = d === "bull" ? C("bull_call_debit_spread", "看涨借记价差", "事件前用价差剥 Vega", { cite }) : C("bear_put_debit_spread", "看跌借记价差", "事件前用价差剥 Vega", { cite });
    return { candidates: spreads.length ? spreads : [fallback], note: "事件在到期前：看涨/看跌用价差剥掉 Vega，或用事件后到期/事件后入场；事件前不买单腿、不卖单腿。" };
  }
  if (d === "neutral") return { candidates: [C("iron_condor", "事件后立即到期的铁鹰", "翼在历史最大变动之外", { cite }), C("calendar", "日历", "卖含事件的近月 IV", { cite })], note: "中性 + 事件：事件后立即到期的铁鹰（翼在历史最大变动之外）或日历。" };
  if (d === "big_move") return { candidates: iv === "HIGH" ? [C("calendar", "日历", "高 IV 有事件则日历", { cite })] : [C("long_straddle", "事件后到期的跨式", "在 IV 抬升前买入", { cite }), C("reverse_iron_condor", "反向铁鹰", "限亏的大动", { cite })], note: "大动 + 事件：事件后到期的跨式，在 IV 抬升前买入；或反向铁鹰。" };
  return { candidates: base, note: "对冲：事件不改变结构选择。" };
}

export interface Liquidity { openInterest: number | null; bidAskPct: number | null }
export function selectStrategies(direction: Direction, iv: IvLevel | "UNKNOWN", event: boolean, liq?: Liquidity): { candidates: Candidate[]; notes: string[]; noTrade: boolean } {
  const notes: string[] = [];
  if (iv === "UNKNOWN") return { candidates: [NO("IV 环境未知 → 不做（附录 D.1 第七步）")], notes: ["IV 环境匹配不了 → 默认输出\"不做\"。"], noTrade: true };
  let cands = CELLS[direction][iv];
  if (event) { const o = eventOverlay(direction, iv, cands); cands = o.candidates; notes.push(o.note); }
  if (liq && ((liq.openInterest != null && liq.openInterest < 1000) || (liq.bidAskPct != null && liq.bidAskPct > 10))) {
    notes.push(`流动性例外（OI < 1000 或价差 > 10%）：只做单腿或不做（附录 D.1 第五步）。OI ${liq.openInterest ?? "—"}，价差 ${liq.bidAskPct ?? "—"}%`);
    cands = cands.filter((c) => /^long_(call|put)$/.test(c.structure));
    if (!cands.length) cands = [NO("流动性不足")];
  }
  cands = cands.filter((c) => !(FORBIDDEN as readonly string[]).includes(c.structure));
  // 大佬复盘 HYG/IWM/TLT/TQQQ（knowledge/mentor/reviews/REVIEW_HYG_IWM_TLT_TQQQ.md）"以后我会调整什么 2"：减少 Credit Spread 频率。
  // Credit spreads are kept but ranked last, and near-ATM short legs are blocked by the pre-trade check.
  const isCredit = (c: Candidate) => /credit_spread|iron_condor|iron_fly/.test(c.structure);
  if (cands.some(isCredit)) {
    cands = [...cands.filter((c) => !isCredit(c)), ...cands.filter(isCredit).map((c) => ({ ...c, why: `${c.why} · 降级：卖出腿须远离平值（|Δ| ≤ 0.30），需书面指派预案（大佬复盘 HYG/TLT）` }))];
    notes.push("Credit spread / 铁鹰 降级排序：近平值卖出腿被指派是 HYG/TLT 复盘的核心教训；先考虑借记结构。");
  }
  notes.push("第六步：核对结构在方向/时间/波动率上的符号（附录 B）是否就是三句话想要的；不是就换。");
  notes.push("Risk-first: 先写最大亏损和失效价位再选执行价；NO_TRADE 是有效结果。");
  return { candidates: cands, notes, noTrade: cands.every((c) => c.structure === "NO_TRADE") };
}
