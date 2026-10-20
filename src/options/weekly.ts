/**
 * Weekly review (Friday after close): `npm run review -- --week`. Pure: journal + readiness in, Chinese markdown out.
 * Sections: 正式 / 模拟练习 / 真实账户练习 / 大佬影子单 · readiness 进度 · 错误标签周对周 · 教训 · 大佬对照 · 下周 3 个重点（由数据推出）.
 */
import { fullPnl, type JournalEntry } from "./journal.ts";
import type { Readiness } from "./readiness.ts";
import { mentorCompare } from "./postmortem.ts";
import { sinSection, SINS, type SinRow } from "./sins.ts";
import { confidenceSection } from "./psych.ts";

export type Cat = "formal" | "practice" | "real" | "mentor";
export const catOf = (e: JournalEntry): Cat => e.source === "real_practice" ? "real" : e.source === "mentor_shadow" ? "mentor" : e.kind === "practice" ? "practice" : "formal";
const CAT_NAME: Record<Cat, string> = { formal: "正式模拟单（计入实盘准备度）", practice: "模拟练习单（不计入）", real: "真实账户练习单（真钱，不计入模拟上限与准备度）", mentor: "大佬影子单（只做对照）" };
const etDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const r2 = (x: number) => Math.round(x * 100) / 100;
const money = (x: number) => `${x < 0 ? "−" : ""}$${Math.abs(r2(x))}`;
export const tagsOf = (e: JournalEntry) => [...new Set([...(e.lossReview?.errorTags ?? []), ...(e.postMortem && /judgment|execution/.test(e.postMortem.classification) ? e.postMortem.tags : []),
  ...(e.violations ?? []).filter((v) => v === "no_pre_written_plan")])];
const isCap = (v: string) => /cap/.test(v);

/** Concrete fix for a repeated tag (Chinese, actionable). */
const FIX: Record<string, string> = {
  no_pre_written_plan: "每笔开仓前先跑 `npm run card -- … --save`，写好论点、两个止损和分批止盈，再开仓（用 --card 关联）",
  position_over_cap: "开仓前看计划卡第 6 节：单笔最大亏损 ≤ 卡上写的置信度上限（权益 0.5–2%，默认 1%）；超了就换更窄/更便宜的价差或不做",
  strikes_too_far_otm: "短期（≤10 天）顺势单，买入腿放在平值附近，不买远价外",
  no_pre_set_take_profit: "开仓时把分批止盈写死（计划卡第 5 节），到价就执行",
  bad_entry_timing: "等盘前计划里的入场区间/确认信号，不追开盘第一波",
  bad_entry_price: "用限价单挂在中间价附近，不用市价单追价",
  market_reaction_misread: "数据/新闻后先看市场是否确认（简报“市场未确认头条”），再决定方向",
};

export interface WeeklyInput { entries: JournalEntry[]; capital: number; from: string; to: string; readiness: Readiness; ddLimitPct?: number;
  /** 影子跟踪 (src/shadow/engine.ts shadowReport) — info only, separate virtual ledger; omitted → section skipped */
  shadowLines?: string[] }
export interface Weekly { md: string; focus: string[]; tagsThis: Array<[string, number]>; tagsPrev: Array<[string, number]>; sinTop: SinRow | null; sinsWeek: SinRow[] }

export function weeklyReport(i: WeeklyInput): Weekly {
  const { entries: E, from, to, readiness: R } = i, dd = i.ddLimitPct ?? 6;
  const prevFrom = new Date(Date.parse(from) - 7 * 864e5).toISOString().slice(0, 10), prevTo = new Date(Date.parse(from) - 864e5).toISOString().slice(0, 10);
  const inW = (iso: string | undefined, a: string, b: string) => !!iso && etDay(iso) >= a && etDay(iso) <= b;
  const week = E.filter((e) => inW(e.openedAt, from, to) || inW(e.closedAt, from, to) || !e.closedAt);
  const L: string[] = [`# 每周复盘 ${from} → ${to}`, "", "_周五收盘后看。数据全部来自交易日志；缺的就写“缺”，不补。_", ""];

  // 1) overview
  L.push("## 一、本周概览");
  for (const c of ["formal", "practice", "real", "mentor"] as Cat[]) {
    const xs = week.filter((e) => catOf(e) === c), closed = xs.filter((e) => inW(e.closedAt, from, to)), open = xs.filter((e) => !e.closedAt);
    const realized = closed.reduce((s, e) => s + fullPnl(e), 0), unreal = open.reduce((s, e) => s + (e.marks?.at(-1)?.pnl ?? 0), 0);
    const w = closed.filter((e) => fullPnl(e) > 0).length;
    L.push(`- ${CAT_NAME[c]}：本周开 ${xs.filter((e) => inW(e.openedAt, from, to)).length} 笔 · 平 ${closed.length} 笔（赢 ${w} / 亏 ${closed.length - w}）· 已实现 ${money(realized)} · 持仓 ${open.length} 笔，未实现 ${open.some((e) => !e.marks?.length) ? "部分缺报价" : money(unreal)}`);
  }
  L.push("");

  // 2) per-category trade lines
  const line = (e: JournalEntry) => { const p = e.closedAt ? fullPnl(e) : e.marks?.at(-1)?.pnl; return `- ${e.symbol} ${e.strategy} \`${e.id}\` · ${e.openedAt.slice(5, 10)}→${e.closedAt ? etDay(e.closedAt).slice(5) : "持仓"} · ${p == null ? "P&L 缺" : money(p)}${!e.closedAt && e.marks?.at(-1)?.estimated ? "（估算）" : ""}${tagsOf(e).length ? ` · 标签 ${tagsOf(e).join("、")}` : ""}${(e.violations ?? []).some(isCap) ? " · ⚠️超限" : ""}`; };
  const secN = ["二", "三", "四", "五"];
  (["formal", "practice", "real", "mentor"] as Cat[]).forEach((c, k) => {
    const xs = week.filter((e) => catOf(e) === c);
    L.push(`## ${secN[k]}、${CAT_NAME[c]}`, ...(xs.length ? xs.map(line) : ["- 本周没有"]));
    if (c === "mentor" && xs.length) { L.push("", "**我们的影子单 vs 大佬实际结果：**"); for (const e of xs) L.push(`- ${e.symbol} \`${e.id}\``, ...mentorCompare(e).map((x) => `  ${x}`)); }
    L.push("");
  });

  // 3) readiness
  const S = R.stats, crit = (id: string) => R.criteria.find((c) => c.id === id)!;
  const own = (e: JournalEntry) => catOf(e) !== "mentor";
  const capWeek = week.filter((e) => own(e) && inW(e.openedAt, from, to) && (e.violations ?? []).some(isCap)), capAll = E.filter((e) => own(e) && (e.violations ?? []).some(isCap));
  const capMentor = week.filter((e) => !own(e) && (e.violations ?? []).some(isCap)).length;
  const noPreAll = E.filter((e) => (e.violations ?? []).includes("no_pre_written_plan") || (e.postMortem?.tags ?? []).includes("no_pre_written_plan")).length;
  const noPreWeek = week.filter((e) => inW(e.openedAt, from, to) && (e.violations ?? []).includes("no_pre_written_plan")).length;
  const sampleOk = crit("sample").detail.join(""), shockYes = !crit("sample").missing.some((m) => /冲击/.test(m)) && Number(S.paperClosed) > 0;
  L.push("## 六、实盘准备度进度（只算正式模拟单）",
    `- 结论：${R.ready ? "✅ 全部通过" : "🛑 还不能上真钱"}`,
    `- 正式样本：${S.paperClosed}/30 笔 · 跨度 ${S.spanDays}/60 天 · 冲击时段：${shockYes ? "是" : "否"}`,
    `- 期望值：${S.ev == null ? "缺" : money(Number(S.ev))}/笔 · 去掉最大 2 笔盈利后 ${money(Number(S.evTrim2 ?? 0))}/笔 · 胜率 ${Math.round(Number(S.winRate ?? 0) * 100)}%（只作参考）`,
    `- 最大回撤：${money(Number(S.maxDrawdown ?? 0))} / 上限 ${dd}% = ${money(i.capital * dd / 100)}（${r2(Number(S.maxDrawdown ?? 0) / (i.capital * dd / 100) * 100)}% 已用）`,
    `- 超限（单笔/仓位上限，你自己的单）：本周 ${capWeek.length} 笔 · 累计 ${capAll.length} 笔${capWeek.length ? `（${capWeek.map((e) => e.symbol).join("、")}）` : ""}${capMentor ? ` · 另：大佬影子单按 Alpha 上限超限 ${capMentor} 笔（大佬的仓位，不算你的违规）` : ""}`,
    `- 纪律违规：正式单 ${S.violations} 次 · 没有事先写好计划（no_pre_written_plan）：本周 ${noPreWeek} 笔 · 累计 ${noPreAll} 笔（所有类别）`,
    `- _${sampleOk}_`, "");

  // 4) tags week over week
  const count = (a: string, b: string) => { const m = new Map<string, number>(); for (const e of E.filter((x) => inW(x.closedAt ?? x.openedAt, a, b))) for (const t of tagsOf(e)) m.set(t, (m.get(t) ?? 0) + 1); return [...m].sort((x, y) => y[1] - x[1]); };
  const tw = count(from, to), tp = count(prevFrom, prevTo), pm = new Map(tp);
  L.push("## 七、错误标签：本周 vs 上周", ...(tw.length || tp.length ? [...new Set([...tw.map(([t]) => t), ...tp.map(([t]) => t)])].map((t) => {
    const a = tw.find(([x]) => x === t)?.[1] ?? 0, b = pm.get(t) ?? 0; return `- ${t}：本周 ${a} · 上周 ${b} ${a > b ? "↑ 变多" : a < b ? "↓ 变少" : "→ 持平"}${a >= 2 ? " · ⚠️ 本周重复" : ""}`; }) : ["- 两周都没有错误标签"]), "");

  // 5) lessons
  const les = E.filter((e) => inW(e.closedAt, from, to) && (e.postMortem?.lesson || e.lesson)).map((e) => `- ${e.symbol}（${catOf(e) === "real" ? "真实" : catOf(e) === "mentor" ? "影子" : catOf(e) === "practice" ? "练习" : "正式"}）：${e.postMortem?.lesson ?? e.lesson}`);
  const unrev = E.filter((e) => e.closedAt && !e.postMortem && !e.lossReview);
  L.push("## 八、本周教训", ...(les.length ? les : ["- 本周平仓的单子没有写教训"]), ...(unrev.length ? [`- ⚠️ 还没复盘：${unrev.map((e) => e.id).join("、")}`] : []), "");

  // 5b) 门槛校准 (biweekly): did trades opened despite a warning do worse?
  L.push("## 八之二、门槛校准（双周，练习单的提示标签）", ...calibration(E, to).lines, "");

  // 5c) 七宗罪 behaviour checklist (knowledge/mentor/discipline/seven-sins.md): counts per sin; most frequent (30 days) = next month's focus
  const sins = sinSection(E, from, to, i.capital);
  L.push("## 八之三、七宗罪（行为自检）", ...sins.lines, "");

  // 5d) 交易信心比率 (knowledge/mentor/psychology/patience-and-overtrading.md): successes / failures, week + 30 days
  L.push("## 八之四、交易信心（成功 ÷ 失败）", ...confidenceSection(E, from, to), "");
  if (i.shadowLines?.length) L.push("## 八之五、影子跟踪（回测假设 A / B，向前样本外，只做观察）", ...i.shadowLines, "");

  // 6) focus (data-derived, priority order, max 3)
  const F: string[] = [];
  for (const [t, n] of tw) if (F.length < 2 && FIX[t] && n >= 1) F.push(`${t}（本周 ${n} 次）→ ${FIX[t]}`);
  if (capWeek.length && !F.some((f) => f.startsWith("position_over_cap"))) F.push(`本周 ${capWeek.length} 笔超限 → ${FIX.position_over_cap}`);
  if (Number(S.paperClosed) < 30) F.push(`正式样本 ${S.paperClosed}/30：下周每个交易日最多 1 笔正式单，只做计划卡 ✅ 的；练习单不算进度`);
  if (unrev.length) F.push(`补复盘 ${unrev.length} 笔（npm run paper -- review --id …）`);
  const noMentor = week.filter((e) => catOf(e) === "mentor" && e.closedAt && !e.mentorOutcome);
  if (noMentor.length) F.push(`记录大佬实际结果 ${noMentor.length} 笔（paper mentor --id … --result …）`);
  if (Number(S.maxDrawdown ?? 0) > i.capital * dd / 200) F.push(`回撤已用超过一半 → 下周单笔风险减半到 $25`);
  const focus = F.slice(0, 3);
  L.push("## 九、下周 3 个重点（由本周数据推出）", ...(focus.length ? focus.map((f, k) => `${k + 1}. ${f}`) : ["- 数据不足以推出重点"]),
    ...(sins.top ? [`- 下个月行为重点（七宗罪，近 30 天最多）：${SINS[sins.top.sin].zh} ${sins.top.sin} ×${sins.top.total}`] : []), "");
  return { md: L.join("\n"), focus, tagsThis: tw, tagsPrev: tp, sinTop: sins.top, sinsWeek: sins.week };
}

/** legacy violations → warn tags, so pre-2026-10-15 trades also count */
export const warnTagsOf = (e: JournalEntry) => [...new Set([...(e.warnTags ?? []), ...(e.violations ?? []).flatMap((v) => /cap/.test(v) ? ["warn_over_cap"] : v === "no_pre_written_plan" ? ["warn_no_plan"] : [])])];
export interface CalRow { tag: string; n: number; closed: number; winRate: number | null; avgPnl: number | null; avgLoss: number | null; rec: "promote" | "keep" | "drop" | "insufficient" }
export function calibration(E: JournalEntry[], to: string, opts: { days?: number; minN?: number } = {}): { ok: boolean; rows: CalRow[]; lines: string[] } {
  const days = opts.days ?? 14, minN = opts.minN ?? 10;
  const own = E.filter((e) => e.source !== "mentor_shadow");
  const first = own.map((e) => etDay(e.openedAt)).sort()[0];
  const span = first ? Math.round((Date.parse(to) - Date.parse(first)) / 864e5) : 0;
  if (span < days) return { ok: false, rows: [], lines: [`- 数据不足：日志只覆盖 ${span} 天（需要 ≥${days} 天）→ 下次双周复盘再算。现在只记录提示标签，不改规则。`] };
  const from = new Date(Date.parse(to) - (days - 1) * 864e5).toISOString().slice(0, 10);
  const win = own.filter((e) => etDay(e.openedAt) >= from && etDay(e.openedAt) <= to);
  const stat = (xs: JournalEntry[]) => { const c = xs.filter((e) => e.closedAt && e.pnl != null).map(fullPnl); const l = c.filter((x) => x <= 0);
    return { closed: c.length, winRate: c.length ? c.filter((x) => x > 0).length / c.length : null, avgPnl: c.length ? r2(c.reduce((a, b) => a + b, 0) / c.length) : null, avgLoss: l.length ? r2(l.reduce((a, b) => a + b, 0) / l.length) : null }; };
  const tags = [...new Set(win.flatMap(warnTagsOf))].sort();
  const rows: CalRow[] = tags.map((tag) => {
    const w = win.filter((e) => warnTagsOf(e).includes(tag)), wo = win.filter((e) => !warnTagsOf(e).includes(tag)), a = stat(w), b = stat(wo);
    let rec: CalRow["rec"] = "insufficient";
    if (a.closed >= minN && a.avgPnl != null) rec = b.avgPnl != null && b.closed >= 3 && a.avgPnl < b.avgPnl && (a.winRate ?? 0) <= (b.winRate ?? 0) - 0.1 ? "promote" : b.avgPnl != null && a.avgPnl >= b.avgPnl ? "drop" : "keep";
    return { tag, n: w.length, ...a, rec };
  });
  const REC = { promote: "⬆️ 升级为硬规则（带提示的单明显更差）", keep: "保持提示", drop: "⬇️ 可考虑取消（带提示的单不比其他差）", insufficient: `样本不足（已平仓 <${minN}）→ 保持提示` };
  const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`), $ = (x: number | null) => (x == null ? "—" : money(x));
  const base = stat(win.filter((e) => !warnTagsOf(e).length));
  return { ok: true, rows, lines: [`- 窗口 ${from} → ${to}（${win.length} 笔，自己的单；不含大佬影子单）· 无提示的单：已平 ${base.closed} 笔，胜率 ${pct(base.winRate)}，平均 ${$(base.avgPnl)}`,
    ...(rows.length ? ["", "| 提示标签 | 带着它开仓 | 已平仓 | 胜率 | 平均盈亏 | 平均亏损 | 建议 |", "|---|---|---|---|---|---|---|",
      ...rows.map((r) => `| ${r.tag} | ${r.n} | ${r.closed} | ${pct(r.winRate)} | ${$(r.avgPnl)} | ${$(r.avgLoss)} | ${REC[r.rec]} |`)] : ["- 窗口内没有带提示标签的单"]),
    `- _样本说明：每个标签至少 ${minN} 笔已平仓才给升级/取消建议；小样本里的胜率差异多半是运气。任何升级都要你确认后才改规则。_`] };
}
