/**
 * 交易心理 batch (knowledge/mentor/psychology/*, mentor texts verbatim; mapping is DK 整理) → WARN-ONLY entry tags and review helpers.
 * Nothing here blocks a trade: the written plan card stays the only hard requirement for practice trades.
 * Pure: the journal, earnings rows and flagged major events are passed in. Defaults are DK review thresholds, UNTESTED (see PSYCH_LIMITS).
 *
 * Entry tags (practice opens → warnTags; all own entries → JournalEntry.psychTags):
 *  warn_72h_event                 72 小时原则: opened < 72h after the ticker's earnings or a flagged major event (bailout / big news)
 *  warn_add_to_loser_unconfirmed  补输盘: same symbol+strategy while an open own position on it is losing, with no confirmation note
 *  warn_second_add_to_loser       补输盘最多一次: there is already an add on that losing position
 *  warn_pyramid_add_larger        用已实现利润开下一笔: a follow-on unit after a winner must be smaller (or equal), not larger
 *  warn_size_up_after_wins        连续赚钱后缩小仓位: risk above the recent average after ≥3 straight wins / a big win day
 *  warn_day_after_big_win         赚了以后停一天: first trading day after a big win day
 *  warn_put_strike_unrealistic    Put 要尊重价格: long put strike beyond the target (or > 1 SD move by expiry), unless a declared lottery
 *  info_midday_entry              只有开盘/收盘一小时: opened between 10:30 and 15:00 ET (informational)
 *  info_ticker_magnetism          Ticker 磁吸症: ≥2nd re-entry into a ticker whose winner turned into a loser (informational)
 * Call 要尊重时间 is already enforced by pretrade `time_buffer` (practice: warn_time_buffer) and critique `horizon_short` — not duplicated.
 */
import { fullPnl, type JournalEntry } from "./journal.ts";
import type { EarningsRow } from "./earningsStore.ts";

export const PSYCH_LIMITS = {
  eventHours: 72, streakWins: 3, bigWinDayPct: 1, pyramidLookbackDays: 10, sizeTolerance: 1.0,
  goodWindows: [["09:30", "10:30"], ["15:00", "16:00"]] as Array<[string, string]>, putSdMultiple: 1, defaultIv: 0.35, magnetismReentries: 2,
} as const;
export const PSYCH_TAGS = ["warn_72h_event", "warn_add_to_loser_unconfirmed", "warn_second_add_to_loser", "warn_pyramid_add_larger", "warn_size_up_after_wins",
  "warn_day_after_big_win", "warn_put_strike_unrealistic", "info_midday_entry", "info_ticker_magnetism"] as const;
export type PsychTag = typeof PSYCH_TAGS[number];
export interface MajorEvent { at: string; symbol?: string | null; title: string; series?: string; dateET?: string; timeET?: string; source?: string; tentative?: boolean }
export interface PsychCtx { earnings?: EarningsRow[]; events?: MajorEvent[]; confirm?: string | null; target?: number | null; capital?: number }

const etDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const etHm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" });
const own = (e: JournalEntry) => e.source !== "mentor_shadow";
const t = (iso: string) => Date.parse(iso);
const r2 = (x: number) => Math.round(x * 100) / 100;
/** ET wall-clock → UTC ISO (handles EDT/EST by probing the offset at that instant) */
export function etToIso(day: string, hm: string): string {
  const guess = new Date(`${day}T${hm}:00Z`);
  const off = (new Date(guess.toLocaleString("en-US", { timeZone: "UTC" })).getTime() - new Date(guess.toLocaleString("en-US", { timeZone: "America/New_York" })).getTime()) / 3600_000;
  return new Date(guess.getTime() + off * 3600_000).toISOString();
}
const earningsAt = (r: EarningsRow) => etToIso(r.date, r.timing === "am" ? "09:30" : r.timing === "pm" ? "16:05" : "16:00");
const peakPnl = (e: JournalEntry) => Math.max(...(e.marks ?? []).map((m) => m.pnl), ...(e.tpHits?.length ? [0.01] : []), -Infinity);

export function psychEntryTags(e: JournalEntry, all: JournalEntry[], ctx: PsychCtx = {}): { tags: PsychTag[]; details: string[] } {
  const L = PSYCH_LIMITS, tags: PsychTag[] = [], details: string[] = [];
  const add = (x: PsychTag, d: string) => { if (!tags.includes(x)) { tags.push(x); details.push(`心理·${x}：${d}`); } };
  if (!own(e)) return { tags, details };
  const at = t(e.openedAt), sym = e.symbol.toUpperCase(), cap = ctx.capital ?? e.capitalAtEntry ?? 5000;
  const prior = all.filter((x) => own(x) && x.id !== e.id && t(x.openedAt) <= at);

  // 72 小时原则
  const evs = [...(ctx.earnings ?? []).filter((r) => r.symbol.toUpperCase() === sym).map((r) => ({ at: earningsAt(r), title: `${sym} 财报 ${r.date}${r.timing ? ` ${r.timing}` : ""}` })),
    ...(ctx.events ?? []).filter((x) => !x.symbol || x.symbol.toUpperCase() === sym).map((x) => ({ at: x.at, title: x.title }))];
  const hit = evs.filter((x) => t(x.at) <= at && at - t(x.at) < L.eventHours * 3600_000).sort((a, b) => t(b.at) - t(a.at))[0];
  if (hit) add("warn_72h_event", `${hit.title} 之后 ${Math.round((at - t(hit.at)) / 3600_000)} 小时就开仓（< ${L.eventHours} 小时）→ 财报/救市/新闻，等 72 小时再动`);

  // 补输盘 / pyramid: other OWN entries on the same symbol + strategy
  const same = prior.filter((x) => x.symbol.toUpperCase() === sym && x.strategy === e.strategy);
  const openSame = same.filter((x) => !x.closedAt), mark = (x: JournalEntry) => x.marks?.at(-1)?.pnl ?? null;
  const losingOpen = openSame.filter((x) => (mark(x) ?? 0) < 0);
  if (losingOpen.length) {
    const groupPnl = openSame.reduce((s, x) => s + (mark(x) ?? 0), 0);
    if (openSame.length >= 2 && groupPnl < 0) add("warn_second_add_to_loser", `${sym} 已有 ${openSame.length} 笔同结构持仓合计浮亏 $${r2(groupPnl)}，这是第 ${openSame.length} 次补 → 亏损仓最多一次有计划的加仓`);
    if (!ctx.confirm?.trim()) add("warn_add_to_loser_unconfirmed", `${sym} 同结构持仓 ${losingOpen.map((x) => `${x.id} $${mark(x)}`).join("、")} 在亏损，又开一笔但没写确认信号（--confirm "…"）→ 补输盘必须先等确认`);
  } else {
    const unit = same.filter((x) => at - t(x.openedAt) <= L.pyramidLookbackDays * 864e5 && (x.closedAt ? fullPnl(x) > 0 : (mark(x) ?? 0) > 0)).sort((a, b) => t(b.openedAt) - t(a.openedAt))[0];
    if (unit && (e.maxLoss ?? 0) > (unit.maxLoss ?? Infinity) * L.sizeTolerance)
      add("warn_pyramid_add_larger", `跟着盈利单 ${unit.id}（最大亏损 $${unit.maxLoss}）开下一笔，但这笔最大亏损 $${e.maxLoss} 更大 → 后续仓位要更小（1.00 → 0.50 → 0.30 → 0.20）`);
  }

  // 骄兵必败: size after wins / day after a big win
  const closed = prior.filter((x) => x.closedAt && t(x.closedAt) <= at).sort((a, b) => t(a.closedAt!) - t(b.closedAt!));
  let streak = 0; for (let i = closed.length - 1; i >= 0 && fullPnl(closed[i]!) > 0; i--) streak++;
  const today = etDay(e.openedAt), byDay = new Map<string, number>();
  for (const x of closed) { const d = etDay(x.closedAt!); if (d < today) byDay.set(d, (byDay.get(d) ?? 0) + fullPnl(x)); }
  const lastDay = [...byDay.keys()].sort().at(-1), lastDayPnl = lastDay ? byDay.get(lastDay)! : 0, bigDay = lastDayPnl >= cap * L.bigWinDayPct / 100;
  const recent = closed.slice(-5).map((x) => x.maxLoss ?? 0).filter((x) => x > 0), avg = recent.length ? recent.reduce((s, x) => s + x, 0) / recent.length : null;
  if ((streak >= L.streakWins || bigDay) && avg != null && (e.maxLoss ?? 0) > avg * L.sizeTolerance)
    add("warn_size_up_after_wins", `${streak >= L.streakWins ? `连赢 ${streak} 笔` : `${lastDay} 赚了 $${r2(lastDayPnl)}`}后，这笔最大亏损 $${e.maxLoss} > 最近平均 $${r2(avg)} → 连续赚钱以后缩小仓位，不要放大`);
  if (bigDay && lastDay) add("warn_day_after_big_win", `上一个交易日 ${lastDay} 已实现 +$${r2(lastDayPnl)}（≥ ${L.bigWinDayPct}% 本金）→ 赚了以后，停一天`);

  // Put 要尊重价格
  const exp = (e.legs ?? []).filter((l) => l.expiration).map((l) => l.expiration!).sort()[0], spot = e.underlyingAtEntry ?? null;
  const longPuts = (e.legs ?? []).filter((l) => l.type === "put" && l.qty > 0), lottery = /lottery|彩票/i.test(`${e.thesis ?? ""} ${e.strategy}`);
  if (longPuts.length && !lottery && spot != null && exp) {
    const k = Math.max(...longPuts.map((l) => l.strike)), dte = Math.max(1, Math.round((t(exp) - t(today)) / 864e5));
    const iv = longPuts.find((l) => l.strike === k)?.iv ?? L.defaultIv, sdFloor = spot * (1 - L.putSdMultiple * iv * Math.sqrt(dte / 365));
    if (ctx.target != null && k < ctx.target) add("warn_put_strike_unrealistic", `买入 Put 行权价 ${k} 低于你的目标价 ${ctx.target} → 方向对了 Put 也可能归零；行权价放在目标价或以上`);
    else if (ctx.target == null && k < sdFloor) add("warn_put_strike_unrealistic", `买入 Put 行权价 ${k} 低于 ${dte} 天 1 个标准差的下跌位 ${r2(sdFloor)}（现价 ${spot}，IV ${Math.round(iv * 100)}%）→ 这个价格在这个时间里现实吗？（不是彩票单就靠近目标价；或用 --target 写下目标）`);
  }

  // 开盘/收盘一小时
  const hm = etHm(e.openedAt);
  if (!L.goodWindows.some(([a, b]) => hm >= a && hm < b)) add("info_midday_entry", `${hm} ET 开仓：好的机会多在开盘和收盘一小时（${L.goodWindows.map(([a, b]) => `${a}–${b}`).join("、")}），错过就等明天`);

  // Ticker 磁吸症
  const turned = prior.filter((x) => x.symbol.toUpperCase() === sym && x.closedAt && fullPnl(x) <= 0 && peakPnl(x) > 0).sort((a, b) => t(a.closedAt!) - t(b.closedAt!))[0];
  if (turned) {
    const re = prior.filter((x) => x.symbol.toUpperCase() === sym && t(x.openedAt) > t(turned.closedAt!)).length + 1;
    if (re >= L.magnetismReentries) add("info_ticker_magnetism", `${sym} 在 ${turned.id} 里从盈利变成亏损（最高 +$${r2(peakPnl(turned))} → $${r2(fullPnl(turned))}）之后，这是第 ${re} 次回来 → 你在等那个故事再讲一遍吗？`);
  }
  return { tags, details };
}

// ---------- review ----------
export const LOSS_CLASSES = ["judgment", "execution", "risk", "variance"] as const;
export type LossClass = typeof LOSS_CLASSES[number];
export const LOSS_CLASS_ZH: Record<LossClass, string> = { judgment: "判断错", execution: "执行错", risk: "风险管理错", variance: "正常概率波动" };
/** suggested loss tags from 为什么新人会亏钱 (free text still allowed) */
export const LOSS_TAGS = ["late_entry", "oversized", "ignored_follow_up", "copied_one_leg", "wrong_instrument", "changed_script", "mentor_wrong"] as const;
export const JOURNAL_QUESTIONS: Array<[keyof NonNullable<JournalEntry["tradeJournal"]>, string]> = [
  ["why", "我为什么入场？"], ["thesis", "当时的 Thesis 是什么？"], ["right", "什么地方判断对了？"], ["wrong", "什么地方判断错了？"], ["violated", "有没有违反自己的纪律？"], ["redo", "如果重新来一次，我会怎么做？"]];
/** 赚钱但做错了: confirmed flag, else an auto candidate when a winner carried violations / warn tags */
export function profitableButWrong(e: JournalEntry): { flag: boolean; by: "manual" | "auto" | null; why: string } {
  if (!e.closedAt || fullPnl(e) <= 0) return { flag: false, by: null, why: "" };
  if (e.profitableButWrong != null) return { flag: e.profitableButWrong, by: "manual", why: e.profitableButWrong ? "你确认：赚钱但做错了" : "你确认：做对了" };
  const why = [...(e.violations ?? []), ...(e.warnTags ?? []).filter((x) => !x.startsWith("info_"))];
  return why.length ? { flag: true, by: "auto", why: `盈利但带着 ${why.join("、")}（候选，复盘时确认）` } : { flag: false, by: null, why: "" };
}

/** 交易信心 = 按系统正确执行的交易 / 有明显错误的交易 (logic, timing, execution or risk). Variance losses count as neither. */
export function confidenceRatio(E: JournalEntry[], from: string, to: string): { successes: number; failures: number; neutral: number; ratio: number | null; failIds: string[] } {
  const xs = E.filter((e) => own(e) && e.closedAt && etDay(e.closedAt) >= from && etDay(e.closedAt) <= to);
  let s = 0, n = 0; const fail: string[] = [];
  for (const e of xs) {
    const cls = e.lossReview?.errorClass, pbw = profitableButWrong(e);
    const bad = (e.violations ?? []).length > 0 || cls === "judgment" || cls === "execution" || cls === "risk" || pbw.flag;
    if (bad) fail.push(e.id); else if (cls === "variance" || fullPnl(e) > 0) s++; else n++;
  }
  return { successes: s, failures: fail.length, neutral: n, ratio: fail.length ? r2(s / fail.length) : null, failIds: fail };
}
export function confidenceSection(E: JournalEntry[], from: string, to: string): string[] {
  const m = new Date(Date.parse(to) - 29 * 864e5).toISOString().slice(0, 10), w = confidenceRatio(E, from, to), d = confidenceRatio(E, m, to);
  const fmt = (c: ReturnType<typeof confidenceRatio>) => `${c.successes} / ${c.failures} = ${c.ratio ?? (c.successes ? "∞（没有失败）" : "—")}${c.neutral ? `（另有 ${c.neutral} 笔亏损未归类，不计）` : ""}`;
  return ["_信心 = 按系统、逻辑和纪律正确执行的交易 ÷ 有明显错误的交易（违规、判断/执行/风险管理错、赚钱但做错）。正常概率波动的亏损不算失败（knowledge/mentor/psychology/patience-and-overtrading.md）。_",
    `- 本周：${fmt(w)}`, `- 近 30 天：${fmt(d)}${d.failIds.length ? ` · 失败：${d.failIds.join("、")}` : ""}`,
    "- 提高信心最容易的路：降低分母——少交易、提高筛选标准、只做真正有把握的机会。"];
}
