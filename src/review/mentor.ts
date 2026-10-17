/**
 * 导师提醒: mentor material applied in daily use (user feedback 2026-10-17: "don't just add it to the knowledge base").
 *  - brief §0「导师提醒」: 1–3 reminders chosen from real state (events, ledger, regime/leader, verdict, top sin)
 *  - plan card / paper open: every warn tag → mentor rule name + verbatim quote + topic file
 *  - losing close: the four attribution questions + "repeat error" callout (same errorClass / tag / sin in 30 days)
 * Warn-only. Never changes a verdict or blocks anything; the written plan card stays the only hard requirement.
 * Every quote is a verbatim substring of its file (test/mentor.test.ts checks this). Rotation is deterministic by ET day.
 */
import type { JournalEntry } from "../options/journal.ts";
import { fullPnl } from "../options/journal.ts";
import type { MajorEvent } from "../options/psych.ts";
import { LOSS_CLASS_ZH, type LossClass } from "../options/psych.ts";
import { sinCounts, topSin, sinsOf, SINS, type SinId } from "../options/sins.ts";
import { effectiveRules } from "../options/rules.ts";

const P = "knowledge/mentor/psychology/", D = "knowledge/mentor/discipline/";
export interface Quote { text: string; file: string }
export interface MentorRule { id: string; name: string; rule: string; quotes: Quote[] }
const q = (file: string, text: string): Quote => ({ file, text });
const R = (id: string, name: string, rule: string, ...quotes: Quote[]): MentorRule => ({ id, name, rule, quotes });

export const RULES: Record<string, MentorRule> = Object.fromEntries([
  R("rule_72h", "72 小时原则", "财报、救市、大新闻之后先等 72 小时，让市场消化，再动",
    q(P + "narrative-and-news.md", "七十二小时原则 - 财报，救市，新闻，等72小时再动。"), q(P + "narrative-and-news.md", "The market moves the news. The news does not move the market.")),
  R("pride_after_wins", "骄兵必败 / 赚钱后缩仓", "连续赚钱或大赚一天之后：缩小仓位，最好停一天",
    q(P + "position-sizing-after-wins.md", "骄兵必败。市场最喜欢教育的，就是刚开始觉得自己不会错的人。"), q(P + "position-sizing-after-wins.md", "赚了以后，停一天，休息一下。"),
    q(P + "position-sizing-after-wins.md", "很多人一赚钱，就开始不断放大仓位。"), q(D + "discipline-01-20.md", "你越想继续赢，就越容易失去原来的判断标准。")),
  R("add_to_loser", "补输盘最多一次", "亏损仓最多一次有计划的加仓，而且先等确认信号",
    q(P + "position-sizing-after-wins.md", "交易尽量不要补输盘。我个人最多补一次而且必须先等到确认信号。")),
  R("shrink_when_shaky", "情绪不稳就缩仓", "仓位让你焦虑/睡不着 → 缩小到睡得着",
    q(P + "position-sizing-after-wins.md", "如果你开始情绪不稳定了，你就缩小仓位。缩到你能呼呼睡大觉，开始学基本功。")),
  R("wrath_stop", "暴怒 / 日亏上限：今天结束", "碰到日亏上限就收手离开屏幕，不要想把钱赢回来",
    q(D + "seven-sins.md", "二、暴怒：你不再寻找机会，你只想把钱赢回来。"), q(D + "discipline-01-20.md", "到了这个数字， 今天结束。 不管你觉得下一笔有多好。"),
    q(P + "stop-loss-and-ownership.md", "别把止损出场当成赔钱。"), q(P + "stop-loss-and-ownership.md", "走为上计。")),
  R("chart_logic", "叙事断裂时先问逻辑", "宏观叙事或领先情景变了 → 先问这张图背后的逻辑还成立吗，不找图上的理由",
    q(P + "narrative-and-news.md", "这张图背后的市场逻辑，还成立吗？"), q(P + "narrative-and-news.md", "技术分析是工具，不是真理。"),
    q(P + "narrative-and-news.md", "但问题在于：一旦宏观叙事发生断裂，很多技术指标反而会变成陷阱。")),
  R("short_soft", "做空：柿子挑软的捏", "看空只挑相对弱的（跑输指数/板块），不空强势上涨的股票，不猜顶",
    q(P + "options-call-time-put-price.md", "做空心法：“柿子挑软的捏”。"), q(D + "short-selling.md", "空弱，不空强。"),
    q(D + "short-selling.md", "“涨太多了”从来不是做空理由。 强势股可以比你有钱，也可以比你有耐心。")),
  R("short_chasing", "做空：等反弹再下手", "不追已经跌趴下的，等它反弹喘气时再空",
    q(D + "short-selling.md", "不要人家已经趴在地上了，你才冲过去追空。")),
  R("short_squeeze", "做空：垃圾股也能把你干掉", "高空头率、低流通、Gamma、情绪盘 → 先查轧空风险",
    q(D + "short-selling.md", "垃圾股也是能把你操死的。")),
  R("short_time", "做空：时间错比方向错更危险", "到期要比论点需要的时间长",
    q(D + "short-selling.md", "空头最大的敌人，不一定是方向错，而是时间错。")),
  R("short_invalidation", "做空：别跟市场讲道理", "失效价要写在现价之上，到了就认",
    q(D + "short-selling.md", "市场不欠你一个公道。")),
  R("short_data", "做空：相对弱势要有数据", "没有相对弱势数据，就先别空",
    q(D + "short-selling.md", "Relative weakness 比一句“估值太贵了”有用得多。")),
  R("patience", "少交易 / 现金也是仓位", "NO_TRADE 是合法结果：少交易，提高筛选标准，只做真正有把握的",
    q(P + "patience-and-overtrading.md", "少交易。提高筛选标准。只做自己真正有优势、有把握的机会。"), q(D + "discipline-01-20.md", "现金，本身就是一种仓位。"),
    q(P + "patience-and-overtrading.md", "错过了就错过了，等明天。")),
  R("entry_window", "开盘/收盘一小时", "好的机会多在开盘和收盘一小时；错过就等明天",
    q(P + "patience-and-overtrading.md", "每天只有两个时间段有好的交易机会 - 开盘收盘的一小时。错过了就错过了，等明天。")),
  R("call_time", "Call 要尊重时间", "买 Call：到期要比论点需要的时间长",
    q(P + "options-call-time-put-price.md", "Call 要尊重时间。")),
  R("put_price", "Put 要尊重价格", "买 Put：行权价放在这段时间里现实能到的位置",
    q(P + "options-call-time-put-price.md", "Put 要尊重价格。")),
  R("ticker_magnetism", "Ticker 磁吸症", "盈利变亏损的票又回来做：你是在等那个故事再讲一遍吗？",
    q(P + "conviction-and-independence.md", "于是你开始不断回到那个故事里。")),
  R("wrong_instrument", "工具选错：方向对了期权先死", "短期期权不要去做需要时间兑现的逻辑；远价外先问能不能到",
    q(P + "why-new-members-lose.md", "尤其是用短期期权去做一个需要时间兑现的逻辑，很容易出现：方向最后对了，但期权先死了。")),
  R("oversized", "仓位太大", "单笔最大亏损超上限 → 缩小或换结构",
    q(P + "why-new-members-lose.md", "你的仓位太大。 一笔正常的波动，本来完全可以承受，但因为你仓位过重，稍微回撤一点你就开始慌，最后被迫在最差的位置砍仓。")),
  R("one_leg", "只抄了一条腿", "对冲/价差是一个整体，不要只做其中一条腿",
    q(P + "why-new-members-lose.md", "你只抄了一条腿，没有抄整个交易结构。")),
  R("late_entry", "进场太晚 / 追价", "不在计划区间、没有确认 → 不追",
    q(P + "why-new-members-lose.md", "你进场太晚，追高或者杀跌了。"), q(P + "why-new-members-lose.md", "同一个方向，不同的进场价，完全可以是两笔不同的交易。")),
  R("changed_script", "不断改剧本", "按写好的计划做；计划外的单就是另一笔交易",
    q(P + "why-new-members-lose.md", "你自己在交易过程中不断改剧本。")),
  R("attribution", "亏损先归因", "亏损后先分清：判断错 / 执行错 / 风险管理错 / 正常概率波动",
    q(P + "why-new-members-lose.md", "到底是交易判断错了，执行错了，风险管理错了，还是单纯遇到了正常的概率波动。")),
  R("journal", "记录赚钱但做错的交易", "赚钱的单子也要问是不是做对了",
    q(P + "journal-and-outcome-bias.md", "尤其要记录那些赚钱但做错了的交易。")),
  R("sin_sloth", "七宗罪·懒惰", "该判断、该执行的时候在场；计划先写好", q(D + "seven-sins.md", "一、懒惰：想要交易的回报，却不愿做交易的功课。")),
  R("sin_wrath", "七宗罪·暴怒", "亏损后不报复交易、不加码", q(D + "seven-sins.md", "二、暴怒：你不再寻找机会，你只想把钱赢回来。")),
  R("sin_greed", "七宗罪·贪婪", "到目标就拿钱；不买便宜彩票单", q(D + "seven-sins.md", "三、贪婪：该拿的钱不肯拿，不该省的钱拼命省。")),
  R("sin_envy", "七宗罪·嫉妒", "别人赚钱不是你下单的理由", q(D + "seven-sins.md", "四、嫉妒：别人赚钱，成了你乱下单的理由。")),
  R("sin_gluttony", "七宗罪·暴食", "做完该做的就停；冲动不是指令", q(D + "seven-sins.md", "五、暴食：你对交易的胃口，没有停止的时候。")),
  R("sin_pride", "七宗罪·傲慢", "错了就认，不把可控的亏损拖成灾难", q(D + "seven-sins.md", "六、傲慢：你会犯错，但你永远不肯承认。")),
  R("sin_lust", "七宗罪·色欲", "不为暴富幻想突破上限和原则", q(D + "seven-sins.md", "七、色欲：暴富的幻想，让你开始出卖自己的原则。")),
].map((r) => [r.id, r]));

/** warn / info tag → mentor rule (unknown tags get no quote rather than a guessed one) */
export const TAG_RULE: Record<string, string> = {
  warn_72h_event: "rule_72h", warn_add_to_loser_unconfirmed: "add_to_loser", warn_second_add_to_loser: "add_to_loser",
  warn_pyramid_add_larger: "pride_after_wins", warn_size_up_after_wins: "pride_after_wins", warn_day_after_big_win: "pride_after_wins",
  warn_put_strike_unrealistic: "put_price", info_midday_entry: "entry_window", info_ticker_magnetism: "ticker_magnetism",
  warn_time_buffer: "call_time", warn_horizon_short: "call_time",
  warn_over_cap: "oversized", warn_position_cap: "sin_gluttony", warn_daily_cap: "wrath_stop", warn_no_hedge: "one_leg", warn_far_otm: "wrong_instrument", warn_no_fit: "wrong_instrument",
  warn_off_plan: "changed_script", warn_out_of_zone: "late_entry", warn_trend_unconfirmed: "late_entry", warn_no_plan: "changed_script",
  warn_sin_wrath: "sin_wrath", warn_sin_gluttony: "sin_gluttony", warn_sin_greed: "sin_greed", warn_sin_sloth: "sin_sloth", warn_sin_envy: "sin_envy", warn_sin_pride: "sin_pride", warn_sin_lust: "sin_lust",
  short_vs_strength: "short_soft", short_no_relative_weakness: "short_soft", short_chasing: "short_chasing", short_squeeze_prone: "short_squeeze", short_squeeze_risk_unchecked: "short_squeeze",
  short_expiry_too_short: "short_time", short_invalidation_not_above_spot: "short_invalidation", short_data_insufficient: "short_data",
};

const etDay = (d: Date | string) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
export const dayIndex = (now: Date) => Math.floor(Date.parse(etDay(now) + "T00:00:00Z") / 864e5);
/** deterministic rotation: a different quote each ET day (offset per rule so two rules don't move in lockstep) */
export function pickQuote(r: MentorRule, now: Date, salt = 0): Quote {
  const k = [...r.id].reduce((s, c) => s + c.charCodeAt(0), 0);
  return r.quotes[(dayIndex(now) + k + salt) % r.quotes.length]!;
}
export const mentorLine = (r: MentorRule, quote: Quote, why?: string) => `**${r.name}**：${r.rule}${why ? `（${why}）` : ""} · 「${quote.text}」 → [${quote.file.replace(/^knowledge\/mentor\//, "")}](${quote.file})`;

/** plan card / paper open: one line per fired tag (dedup by rule; tags sharing a rule are listed together) */
export function mentorForTags(tags: string[], now: Date): string[] {
  const by = new Map<string, string[]>(), none: string[] = [];
  for (const t of [...new Set(tags)]) { const id = TAG_RULE[t]; if (id && RULES[id]) by.set(id, [...(by.get(id) ?? []), t]); else none.push(t); }
  return [...[...by].map(([id, ts]) => `- ${ts.map((t) => `\`${t}\``).join(" ")} → ${mentorLine(RULES[id]!, pickQuote(RULES[id]!, now))}`),
    ...(none.length ? [`- ${none.map((t) => `\`${t}\``).join(" ")}：没有对应的导师原文（只记录，用于门槛校准）`] : [])];
}

// ---------- brief: context-selected reminders ----------
export interface ReminderState {
  now: Date; verdict: string; leader: string | null; previousLeader?: string | null; leaderChanged?: boolean;
  regime?: string | null; previousRegime?: string | null; events: MajorEvent[]; journal: JournalEntry[]; capital: number;
}
export interface Reminder { id: string; why: string; line: string }
const BEAR = new Set(["hawkish", "risk_off"]);
const own = (e: JournalEntry) => e.source !== "mentor_shadow";
export function selectReminders(s: ReminderState, cap = 3): Reminder[] {
  const out: Array<{ id: string; why: string }> = [], now = s.now.getTime(), today = etDay(s.now);
  // 1) major event within 72h (either side)
  const ev = s.events.map((e) => ({ e, dt: Date.parse(e.at) - now })).filter((x) => Math.abs(x.dt) < 72 * 3600_000).sort((a, b) => Math.abs(a.dt) - Math.abs(b.dt))[0];
  if (ev) out.push({ id: "rule_72h", why: `${ev.e.title} ${ev.dt >= 0 ? `还有 ${Math.round(ev.dt / 3600_000)} 小时` : `已过去 ${Math.round(-ev.dt / 3600_000)} 小时`}` });
  // ledger: own closed trades
  const closed = s.journal.filter((e) => own(e) && e.closedAt && Date.parse(e.closedAt) <= now).sort((a, b) => a.closedAt!.localeCompare(b.closedAt!));
  const byDay = new Map<string, number>(); for (const e of closed) { const d = etDay(e.closedAt!); if (e.source !== "real_practice") byDay.set(d, (byDay.get(d) ?? 0) + fullPnl(e)); }
  const recentDays = [...byDay.keys()].filter((d) => d <= today && Date.parse(today) - Date.parse(d) <= 3 * 864e5).sort();
  // 3) loss limit breached in the last 3 calendar days (checked before wins: stop and walk away beats size advice)
  const perDay = s.capital * effectiveRules().dailyLossLimitPct / 100;
  const breach = recentDays.filter((d) => byDay.get(d)! <= -perDay).at(-1);
  // 2) winning streak ≥3 / ≥1% day recently
  let streak = 0; for (let i = closed.length - 1; i >= 0 && fullPnl(closed[i]!) > 0; i--) streak++;
  const big = recentDays.filter((d) => byDay.get(d)! >= s.capital * 0.01).at(-1);
  if (streak >= 3 || big) out.push({ id: "pride_after_wins", why: streak >= 3 ? `连赢 ${streak} 笔` : `${big} 已实现 +$${Math.round(byDay.get(big!)! * 100) / 100}（≥1% 本金）` });
  if (breach) out.push({ id: "wrath_stop", why: `${breach} 已实现 $${Math.round(byDay.get(breach)! * 100) / 100}，触发日亏上限 $${perDay}` });
  // 4) narrative regime change / leader flip
  const regimeFlip = s.previousRegime && s.regime && s.previousRegime !== s.regime, leaderFlip = s.leaderChanged || (s.previousLeader !== undefined && s.previousLeader !== s.leader);
  if (regimeFlip || leaderFlip) out.push({ id: "chart_logic", why: [regimeFlip ? `宏观状态 ${s.previousRegime} → ${s.regime}` : "", leaderFlip ? `领先情景 ${s.previousLeader ?? "无"} → ${s.leader ?? "无"}` : ""].filter(Boolean).join("；") });
  // 5) bearish leader
  if (s.leader && BEAR.has(s.leader)) out.push({ id: "short_soft", why: `领先情景 ${s.leader}（偏空）` });
  // 6) NO_TRADE day
  if (s.verdict === "NO_TRADE") out.push({ id: "patience", why: "今天 NO_TRADE" });
  // 7) most frequent sin (30 days, same count the weekly review uses) → this month's focus
  const top = topSin(sinCounts(s.journal, new Date(now - 29 * 864e5).toISOString().slice(0, 10), today, s.capital));
  if (top) out.push({ id: `sin_${top.sin}`, why: `近 30 天最多：${SINS[top.sin as SinId].zh} ×${top.total} → 本月行为重点` });
  // order: wrath first if breached (most urgent), then the listed order; cap
  const ordered = [...out.filter((x) => x.id === "wrath_stop"), ...out.filter((x) => x.id !== "wrath_stop")].slice(0, cap);
  const used = new Set<string>();
  return ordered.map((x, k) => { let qt = pickQuote(RULES[x.id]!, s.now, k); if (used.has(qt.text)) qt = pickQuote(RULES[x.id]!, s.now, k + 1); used.add(qt.text); return { ...x, line: mentorLine(RULES[x.id]!, qt, x.why) }; });
}
export function reminderSection(s: ReminderState): string[] {
  const xs = selectReminders(s);
  const fallback = xs.length ? [] : (() => { const ids = ["journal", "patience", "shrink_when_shaky", "attribution"], r = RULES[ids[dayIndex(s.now) % ids.length]!]!; return [`- ${mentorLine(r, pickQuote(r, s.now), "今天没有触发条件，轮换提醒")}`]; })();
  return ["## 1.1 导师提醒", "_按今天的真实状态挑选（事件 72 小时 / 模拟账本 / 情景切换 / 结论 / 七宗罪），最多 3 条；只提醒，不改变结论。_", "", ...xs.map((x) => `- ${x.line}`), ...fallback, ""];
}

// ---------- losing close: attribution questions + repeat-error callout ----------
export const ATTRIBUTION_QUESTIONS: Array<[LossClass, string]> = [
  ["judgment", "判断错了吗？（论点/方向/时机的判断本身错了）"], ["execution", "执行错了吗？（追价、没按计划进出、改剧本）"],
  ["risk", "风险管理错了吗？（仓位太大、止损没设/没执行、工具或到期选错）"], ["variance", "还是按计划执行、只是正常的概率波动？"]];
export interface LossPrompt { at: string; questions: string[]; repeats: string[] }
export function lossPrompt(e: JournalEntry, all: JournalEntry[], now: Date, capital?: number): LossPrompt | null {
  if (!e.closedAt || fullPnl(e) > 0 || !own(e)) return null;
  const from = now.getTime() - 30 * 864e5;
  const prior = all.filter((x) => x.id !== e.id && own(x) && x.closedAt && Date.parse(x.closedAt) >= from && Date.parse(x.closedAt) <= now.getTime());
  const repeats: string[] = [], cls = e.lossReview?.errorClass;
  if (cls) { const n = prior.filter((x) => x.lossReview?.errorClass === cls); if (n.length) repeats.push(`错误类型 ${cls}（${LOSS_CLASS_ZH[cls as LossClass] ?? cls}）30 天内第 ${n.length + 1} 次：${n.map((x) => x.id).join("、")}`); }
  for (const t of e.lossReview?.errorTags ?? []) { const n = prior.filter((x) => (x.lossReview?.errorTags ?? []).includes(t)); if (n.length) repeats.push(`错误标签 ${t} 30 天内第 ${n.length + 1} 次：${n.map((x) => x.id).join("、")}`); }
  const mine = sinsOf(e, all, undefined, capital).map((x) => x.sin);
  for (const sn of [...new Set(mine)]) { const n = prior.filter((x) => sinsOf(x, all, undefined, capital).some((y) => y.sin === sn)); if (n.length) repeats.push(`七宗罪 ${SINS[sn].zh}（${sn}）30 天内第 ${n.length + 1} 次：${n.map((x) => x.id).join("、")}`); }
  return { at: now.toISOString(), questions: ATTRIBUTION_QUESTIONS.map(([c, t]) => `${cls === c ? "☑" : "☐"} ${c}：${t}`), repeats };
}
export function renderLossPrompt(p: LossPrompt, now: Date): string[] {
  const r = RULES.attribution!;
  return [`🧭 亏损归因（只提醒）：${mentorLine(r, pickQuote(r, now))}`, ...p.questions.map((x) => `  ${x}`),
    ...(p.repeats.length ? [`🔁 重复错误：`, ...p.repeats.map((x) => `  - ${x}`)] : [])];
}
