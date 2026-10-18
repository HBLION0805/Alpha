/**
 * 股市七宗罪 behaviour checklist (knowledge/mentor/discipline/seven-sins.md, mentor article verbatim; mapping is DK 整理).
 * Every closed trade can carry behaviour-sin tags:
 *  - manual: `npm run paper -- sin --id <id> --sin wrath,greed --note "…"` (stored in JournalEntry.behaviorSins, by "manual")
 *  - auto:   derived ONLY from what the ledger actually records (autoSins below); always a candidate to confirm at review.
 * Warn-only: nothing here blocks a trade. Mentor-shadow trades are never tagged (the mentor's decision, not the user's behaviour).
 */
import type { JournalEntry } from "./journal.ts";
import { effectiveRules, type RuleCard } from "./rules.ts";

export type SinId = "sloth" | "wrath" | "greed" | "envy" | "gluttony" | "pride" | "lust";
export interface SinTag { sin: SinId; by: "auto" | "manual"; reason: string; at?: string }
/** stored form: removed = the user rejected an auto candidate at review (kept so it is not re-derived) */
export type StoredSin = SinTag & { removed?: boolean };
export const SIN_IDS: SinId[] = ["sloth", "wrath", "greed", "envy", "gluttony", "pride", "lust"];
export const SINS: Record<SinId, { zh: string; question: string; fix: string }> = {
  sloth: { zh: "懒惰", question: "开仓前做功课了吗（宏观、新闻、计划卡）？关键时段我在场吗？", fix: "每笔先跑 `npm run card -- … --save` 写好论点/两个止损/分批止盈；开盘前看简报；不在场的时段不做需要及时执行的单" },
  wrath: { zh: "暴怒", question: "这笔是在找机会，还是想把刚亏的钱赢回来？", fix: "亏损平仓后当天先停 30 分钟、重新跑计划卡再决定；到了日亏上限今天结束；亏损后不加大仓位" },
  greed: { zh: "贪婪", question: "到了计划止盈还不走？买的是“便宜彩票”吗？", fix: "止盈到价就执行（计划卡第 5 节）；不买每张 < $0.25 的短期彩票单，买入腿放在平值附近" },
  envy: { zh: "嫉妒", question: "我是因为别人赚钱、怕错过才追进去的吗？", fix: "只在计划进场区间内开仓；别人的盈利不是你的入场信号" },
  gluttony: { zh: "暴食", question: "冲动和下单之间有没有停顿？今天是不是做太多了？", fix: "每天最多 3 笔；做完计划内的单就收手；不在亏损仓位上补仓" },
  pride: { zh: "傲慢", question: "我承认错误了吗？止损动过吗？复盘里是不是在怪别人？", fix: "止损写死不移动；复盘只写自己的决定（判断/执行），不写别人" },
  lust: { zh: "色欲", question: "为了快速暴富，有没有违背自己的原则（仓位上限、风控）？", fix: "单笔最大亏损 ≤ 1%（$50）；超了就换更窄的价差或不做" },
};
/** review thresholds (not trading rules; changing them changes only what gets flagged) */
export const SIN_LIMITS = { lotteryPremium: 0.25, lotteryMaxDte: 7, maxOpensPerDay: 3, wrathWindowMin: 60 };

const etDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const etTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" });
const own = (e: JournalEntry) => e.source !== "mentor_shadow";
const t = (iso: string) => Date.parse(iso);

/** Sins derivable from ledger data alone. `all` = the whole journal (needed for same-day context). */
export function autoSins(e: JournalEntry, all: JournalEntry[], rules?: Partial<RuleCard>, capital = 5000): SinTag[] {
  if (!own(e)) return [];
  const out: SinTag[] = [], add = (sin: SinId, reason: string) => { if (!out.some((x) => x.sin === sin)) out.push({ sin, by: "auto", reason }); };
  const v = e.violations ?? [];
  // 懒惰: no plan written before entry
  if (v.includes("no_pre_written_plan") || /^not recorded/i.test(e.thesis ?? "")) add("sloth", "开仓前没有写好计划（no_pre_written_plan）");
  // 暴怒: opened the same ET day after one of your own losing closes; after the daily cap was already breached; bigger size after a loss
  const day = etDay(e.openedAt), peers = all.filter((x) => own(x) && x.id !== e.id);
  const lossesBefore = peers.filter((x) => x.closedAt && etDay(x.closedAt) === day && t(x.closedAt) < t(e.openedAt) && (x.pnl ?? 0) < 0).sort((a, b) => t(a.closedAt!) - t(b.closedAt!));
  // daily-cap breach: every trade closed earlier that day now INCLUDING mentor_shadow (DECISIONS 2026-10-17). real_practice was already
  // counted here before (unlike breach.ts / brief) — left unchanged, flagged as an open question in DECISIONS.
  const perDay = capital * effectiveRules(rules).dailyLossLimitPct / 100;
  const realized = all.filter((x) => x.id !== e.id && x.closedAt && etDay(x.closedAt) === day && t(x.closedAt) < t(e.openedAt)).reduce((s, x) => s + (x.pnl ?? 0), 0);
  const breached = -realized > perDay;
  if (lossesBefore.length || breached) {
    const last = lossesBefore.at(-1), mins = last ? Math.round((t(e.openedAt) - t(last.closedAt!)) / 60000) : Infinity;
    const same = lossesBefore.filter((x) => x.symbol === e.symbol).at(-1), bigger = !!last && (e.maxLoss ?? 0) > (last.maxLoss ?? Infinity);
    const why = [breached ? `当天已实现 $${Math.round(realized * 100) / 100}（含大佬影子单）已超日亏上限 $${perDay} 后仍开新单` : "",
      last && mins <= SIN_LIMITS.wrathWindowMin ? `亏损平仓 ${last.symbol} $${last.pnl}（${etTime(last.closedAt!)} ET）后 ${mins} 分钟就开仓` : "",
      same ? `同一标的 ${same.symbol} 刚亏 $${same.pnl}（${etTime(same.closedAt!)} ET）后再开` : "",
      bigger ? `亏损后仓位变大（最大亏损 $${e.maxLoss} > 上一笔亏损单 $${last!.maxLoss}）` : ""].filter(Boolean);
    if (why.length) add("wrath", why.join("；"));
  }
  // 贪婪: cheap short-dated lottery option; take-profit alert fired but closed at a loss
  const optLegs = (e.legs ?? []).filter((l) => l.type !== "stock" && l.premium != null), unit = Math.min(...optLegs.map((l) => Math.abs(l.qty)));
  const debit = e.entryPrice ?? (optLegs.length ? Math.round(optLegs.reduce((s, l) => s + l.qty * l.premium, 0) / unit * 100) / 100 : null), exp = (e.legs ?? []).map((l) => l.expiration).filter(Boolean).sort()[0];
  const dte = exp ? Math.round((Date.parse(exp) - Date.parse(day)) / 864e5) : null, isOpt = (e.legs ?? []).some((l) => l.type !== "stock");
  if (isOpt && debit != null && debit > 0 && debit < SIN_LIMITS.lotteryPremium && dte != null && dte <= SIN_LIMITS.lotteryMaxDte)
    add("greed", `便宜彩票单：每张净成本 $${debit} < $${SIN_LIMITS.lotteryPremium}，开仓时距到期 ${dte} 天`);
  if ((e.tpHits ?? []).length && e.closedAt && (e.pnl ?? 0) < 0) add("greed", `止盈提醒已触发（${e.tpHits!.join(",")}）但最后亏损 $${e.pnl} 平仓（利润吐回）`);
  // 嫉妒: chasing outside the planned entry range
  if (v.includes("chasing")) add("envy", "违规 chasing（追价）");
  else if (e.entryRange && e.underlyingAtEntry != null && (e.underlyingAtEntry < e.entryRange.low || e.underlyingAtEntry > e.entryRange.high))
    add("envy", `开仓价 ${e.underlyingAtEntry} 在计划进场区间 ${e.entryRange.low}–${e.entryRange.high} 之外（追价）`);
  // 暴食: more than N own opens that ET day (this trade is #N+1 or later); adding to a loser
  const dayOpens = [...all.filter((x) => x.id !== e.id), e].filter((x) => own(x) && etDay(x.openedAt) === day).sort((a, b) => t(a.openedAt) - t(b.openedAt) || a.id.localeCompare(b.id));
  const k = dayOpens.findIndex((x) => x.id === e.id) + 1;
  if (k > SIN_LIMITS.maxOpensPerDay) add("gluttony", `当天第 ${k} 笔开仓（当天共 ${dayOpens.length} 笔 > ${SIN_LIMITS.maxOpensPerDay}）`);
  if (v.includes("unplanned_add")) add("gluttony", "违规 unplanned_add（计划外加仓）");
  // 傲慢: hesitated about the stop twice and still closed at a loss (纪律 #13: second hesitation → exit)
  const hs = (e.hesitations ?? []).filter((h) => h.about === "stop").length;
  if (hs >= 2 && e.closedAt && (e.pnl ?? 0) < 0) add("pride", `止损犹豫 ${hs} 次仍未离场，最后亏损 $${e.pnl}`);
  // 色欲: over your own size caps
  const cap = v.filter((x) => /exceeds_1pct_cap|position_over_cap|open_loss_over_cap/.test(x)).concat(e.lossReview?.errorTags.includes("position_over_cap") ? ["position_over_cap"] : []);
  if (cap.length) add("lust", `超出仓位上限（${[...new Set(cap)].join("、")}，最大亏损 $${e.maxLoss}）`);
  return out;
}

/** Stored tags (manual + backfilled) merged with live auto-derivation; one tag per sin, manual wins. */
export function sinsOf(e: JournalEntry, all: JournalEntry[], rules?: Partial<RuleCard>, capital?: number): SinTag[] {
  if (!own(e)) return [];
  const stored = (e.behaviorSins ?? []).filter((s) => !s.removed);
  const removed = new Set((e.behaviorSins ?? []).filter((s) => s.removed).map((s) => s.sin));
  const out: SinTag[] = stored.filter((s) => s.by === "manual").map(({ sin, by, reason, at }) => ({ sin, by, reason, at }));
  for (const s of [...stored.filter((s) => s.by === "auto"), ...autoSins(e, all, rules, capital)]) if (!removed.has(s.sin) && !out.some((x) => x.sin === s.sin)) out.push({ sin: s.sin, by: "auto", reason: s.reason, ...(s.at ? { at: s.at } : {}) });
  return out.sort((a, b) => SIN_IDS.indexOf(a.sin) - SIN_IDS.indexOf(b.sin));
}

/** Practice-open warn tags (warn-only): sins that can be known AT entry. Lust is already warn_over_cap; sloth can't happen (plan card is hard). */
export function entrySinWarnTags(e: JournalEntry, all: JournalEntry[], rules?: Partial<RuleCard>, capital?: number): { tags: string[]; details: string[] } {
  const xs = autoSins(e, all, rules, capital).filter((s) => s.sin === "wrath" || s.sin === "gluttony" || s.sin === "greed");
  return { tags: xs.map((s) => `warn_sin_${s.sin}`), details: xs.map((s) => `七宗罪·${SINS[s.sin].zh}：${s.reason}`) };
}

export interface SinRow { sin: SinId; auto: number; manual: number; total: number; ids: string[] }
/** Count trades per sin (each trade counts once per sin) among own trades closed in [from, to] (ET days). */
export function sinCounts(E: JournalEntry[], from: string, to: string, capital?: number): SinRow[] {
  const xs = E.filter((e) => own(e) && e.closedAt && etDay(e.closedAt) >= from && etDay(e.closedAt) <= to);
  return SIN_IDS.map((sin) => {
    const hit = xs.map((e) => ({ e, s: sinsOf(e, E, undefined, capital).find((x) => x.sin === sin) })).filter((x) => x.s);
    const manual = hit.filter((x) => x.s!.by === "manual").length;
    return { sin, auto: hit.length - manual, manual, total: hit.length, ids: hit.map((x) => x.e.id) };
  });
}
/** Most frequent sin = next month's focus (ties: more manually confirmed, then article order). */
export function topSin(rows: SinRow[]): SinRow | null {
  const r = [...rows].filter((x) => x.total > 0).sort((a, b) => b.total - a.total || b.manual - a.manual || SIN_IDS.indexOf(a.sin) - SIN_IDS.indexOf(b.sin));
  return r[0] ?? null;
}

export function sinSection(E: JournalEntry[], from: string, to: string, capital?: number): { lines: string[]; top: SinRow | null; week: SinRow[]; month: SinRow[] } {
  const mFrom = new Date(Date.parse(to) - 29 * 864e5).toISOString().slice(0, 10);
  const week = sinCounts(E, from, to, capital), month = sinCounts(E, mFrom, to, capital), top = topSin(month);
  const lines = ["_每笔平仓后的行为自检（knowledge/mentor/discipline/seven-sins.md）。自动 = 交易日志推出的候选，复盘时确认或删掉；手动 = 你自己打的标签。大佬影子单不算。_", "",
    "| 罪 | 本周（自动/手动） | 近 30 天 | 复盘问题 |", "|---|---|---|---|",
    ...week.map((w, k) => { const m = month[k]!; return `| ${SINS[w.sin].zh} ${w.sin} | ${w.total}（${w.auto}/${w.manual}） | ${m.total} | ${SINS[w.sin].question} |`; }), "",
    top ? `- 🎯 **下个月重点：${SINS[top.sin].zh}（${top.sin}）** — 近 30 天 ${top.total} 笔（${top.ids.join("、")}）→ ${SINS[top.sin].fix}` : "- 近 30 天没有七宗罪标签",
    "- 手动打标签：`npm run paper -- sin --id <id> --sin wrath,pride --note \"…\"`（删掉自动候选：`--remove greed`）· 推不出的（不在场、FOMO、移动止损、怪别人、违背原则）只能手动标。",
    "- _只提示，不阻止：七宗罪标签不会变成硬规则；练习单开仓时能推出的写成 warn_sin_* 提示。_"];
  return { lines, top, week, month };
}
