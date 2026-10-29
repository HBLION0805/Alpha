/**
 * Live-readiness scorecard (user steering 2026-10-14), computed ONLY from the paper-trade journal.
 * All five criteria must pass before real money; then quarter size for ~20 trades, then normal size.
 * Win rate is shown as context only: a low win rate is not failure when losses stay controlled
 * (大佬复盘 mentor-winrate-review) — expectancy and loss caps decide.
 */
import { fullPnl, type JournalEntry } from "./journal.ts";
import { entryCapUsd } from "./confidence.ts";
import { DEFAULT_RULES, type RuleCard } from "./rules.ts";

export interface Criterion { id: string; title: string; pass: boolean; detail: string[]; missing: string[] }
export interface Readiness { ready: boolean; criteria: Criterion[]; stats: Record<string, number | string | null>; practice: { n: number; closed: number; ev: number; total: number; bySource?: Record<string, { n: number; closed: number; total: number }> }; next: string }
export interface ReadinessInput { journal: JournalEntry[]; capital: number; shockDates: string[]; rules?: RuleCard; maxViolations?: number; /** user-approved 2026-10-15: 6% ($300 at $5k) */ maxDrawdownPct?: number; windowDays?: number }

const day = (s: string) => s.slice(0, 10);
const r2 = (x: number) => Math.round(x * 100) / 100;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(day(b)) - Date.parse(day(a))) / 864e5);
const VIOLATION_FROM_MOTIVE = new Set(["share", "entertain", "excitement"]);

export function expectancy(ps: number[]): { winRate: number; avgWin: number; avgLoss: number; ev: number } {
  if (!ps.length) return { winRate: 0, avgWin: 0, avgLoss: 0, ev: 0 };
  const w = ps.filter((x) => x > 0), l = ps.filter((x) => x <= 0);
  const winRate = w.length / ps.length;
  const avgWin = w.length ? w.reduce((s, x) => s + x, 0) / w.length : 0;
  const avgLoss = l.length ? -l.reduce((s, x) => s + x, 0) / l.length : 0;
  return { winRate, avgWin, avgLoss, ev: winRate * avgWin - (1 - winRate) * avgLoss };
}

export function isPremature(e: JournalEntry): boolean {
  if (e.exitKind !== "discretionary" || !e.closedAt) return false;
  return !(e.timeStopAt && day(e.closedAt) >= day(e.timeStopAt));
}

export function readiness(i: ReadinessInput): Readiness {
  const R = i.rules ?? DEFAULT_RULES, maxV = i.maxViolations ?? 1;
  // practice trades never count toward readiness (shown separately)
  const paper = i.journal.filter((e) => e.mode === "paper" && e.kind !== "practice");
  const practice = i.journal.filter((e) => e.mode === "paper" && e.kind === "practice");
  const pc = practice.filter((e) => e.closedAt && e.pnl != null).map(fullPnl);
  const allClosed = paper.filter((e) => e.closedAt && e.pnl != null).sort((a, b) => a.closedAt!.localeCompare(b.closedAt!));
  // rolling window (2–3 months): only the most recent windowDays (default 90) count
  const W = i.windowDays ?? 90, lastAt = allClosed.at(-1)?.closedAt;
  const closed = lastAt ? allClosed.filter((e) => daysBetween(e.closedAt!, lastAt) <= W) : allClosed;
  const ddLimitPct = i.maxDrawdownPct ?? 6;
  const C: Criterion[] = [];

  // 1) sample: ≥30 trades over ≥60 days incl. a shock period
  const first = closed[0]?.openedAt, last = closed.at(-1)?.closedAt;
  const span = first && last ? daysBetween(first, last) : 0;
  const shock = new Set(i.shockDates.map(day));
  const shockTrades = closed.filter((e) => { for (let d = new Date(day(e.openedAt)); d.toISOString().slice(0, 10) <= day(e.closedAt!); d.setUTCDate(d.getUTCDate() + 1)) if (shock.has(d.toISOString().slice(0, 10))) return true; return false; });
  C.push({ id: "sample", title: "样本：≥30 笔模拟交易、≥60 天、含至少一个冲击时段", pass: closed.length >= 30 && span >= 60 && shockTrades.length > 0,
    detail: [`最近 ${W} 天窗口内已平仓正式模拟交易 ${closed.length} 笔（全部 ${allClosed.length}），跨度 ${span} 天，冲击时段内持仓 ${shockTrades.length} 笔`],
    missing: [...(closed.length < 30 ? [`还差 ${30 - closed.length} 笔`] : []), ...(span < 60 ? [`还差 ${60 - span} 天`] : []), ...(shockTrades.length ? [] : ["没有一笔经历冲击时段（VIX 期限结构倒挂或高影响数据日）"])] });

  // 2) expectancy, robust to the top 2 winners
  const ps = closed.map(fullPnl);
  const ex = expectancy(ps);
  const trimmed = [...ps].sort((a, b) => b - a).slice(Math.min(2, ps.filter((x) => x > 0).length));
  const ex2 = expectancy(trimmed);
  const total = ps.reduce((a, b) => a + b, 0), top2 = [...ps].sort((a, b) => b - a).slice(0, 2).filter((x) => x > 0).reduce((a, b) => a + b, 0);
  const outlier = total > 0 && top2 / total > 0.5;
  C.push({ id: "expectancy", title: "期望值为正，去掉最大 2 笔盈利后仍为正，且最大 2 笔不超过总盈利的 50%", pass: ps.length > 0 && ex.ev > 0 && ex2.ev > 0 && !outlier,
    detail: [`期望值 = 胜率×平均盈利 − 败率×平均亏损 = ${r2(ex.winRate * 100)}%×$${r2(ex.avgWin)} − ${r2((1 - ex.winRate) * 100)}%×$${r2(ex.avgLoss)} = $${r2(ex.ev)}/笔`, `去掉最大 2 笔盈利：$${r2(ex2.ev)}/笔`,
      `最大 2 笔盈利 $${r2(top2)} / 总盈亏 $${r2(total)}${total > 0 ? `（${r2((top2 / total) * 100)}%）` : ""}`,
      `胜率只作参考：亏损受控时低胜率不等于失败（大佬复盘 mentor-winrate-review）`],
    missing: [...(ex.ev > 0 ? [] : ["期望值不为正"]), ...(ex2.ev > 0 ? [] : ["依赖少数大赢家：去掉最大 2 笔后期望值不为正"]), ...(outlier ? ["最大 2 笔盈利超过总盈亏的 50% → 结果靠离群值"] : [])] });

  // 3) loss caps + max drawdown
  const capOf = (e: JournalEntry) => e.capitalAtEntry ?? i.capital;
  const capUsd = (e: JournalEntry) => e.confidence?.capUsd ?? entryCapUsd({ ...e, capitalAtEntry: capOf(e) }, i.capital); // confidence-scaled cap at open (0.5–2%), else rule card
  const bigLoss = closed.filter((e) => -fullPnl(e) > capUsd(e));
  // daily-loss cap: formal trades PLUS mentor_shadow closes on the same days (DECISIONS 2026-10-17). Shadow trades still never
  // count as readiness trades (sample / expectancy / per-trade / drawdown stay formal-only); they only add to a day's loss.
  const first0 = closed[0]?.closedAt, last0 = closed.at(-1)?.closedAt;
  const shadowDays = first0 && last0 ? practice.filter((e) => e.source === "mentor_shadow" && e.closedAt && e.pnl != null && day(e.closedAt) >= day(first0) && day(e.closedAt) <= day(last0)) : [];
  const byDay = new Map<string, number>(); for (const e of [...closed, ...shadowDays]) byDay.set(day(e.closedAt!), (byDay.get(day(e.closedAt!)) ?? 0) + fullPnl(e));
  const badDays = [...byDay].filter(([, v]) => -v > i.capital * R.dailyLossLimitPct / 100);
  let eq = 0, peak = 0, mdd = 0; for (const p of ps) { eq += p; peak = Math.max(peak, eq); mdd = Math.max(mdd, peak - eq); }
  const ddOver = mdd > i.capital * ddLimitPct / 100;
  C.push({ id: "loss_caps", title: `单笔亏损 ≤ 开仓时的置信度上限（权益 0.5–2%，默认 ${R.sellerMaxLossPerTradePct}%），单日亏损 ≤${R.dailyLossLimitPct}%，最大回撤 ≤${ddLimitPct}%`, pass: closed.length > 0 && !bigLoss.length && !badDays.length && !ddOver,
    detail: [`最大回撤 $${r2(mdd)}（${r2((mdd / i.capital) * 100)}%，上限 ${ddLimitPct}% = $${r2(i.capital * ddLimitPct / 100)}）`, `最大单笔亏损 $${r2(-Math.min(0, ...ps))}`],
    missing: [...(ddOver ? [`最大回撤 $${r2(mdd)} > ${ddLimitPct}%`] : []), ...bigLoss.map((e) => `${e.id} ${e.symbol} 亏 $${r2(-fullPnl(e))} > 上限 $${r2(capUsd(e))}`), ...badDays.map(([d, v]) => `${d} 单日亏 $${r2(-v)} > ${R.dailyLossLimitPct}%`)] });

  // 4) discipline: violations ≈ 0; thesis + stop recorded before entry; concurrent cap; premature exits
  const viol = paper.flatMap((e) => [...(e.violations ?? []), ...(e.motive && VIOLATION_FROM_MOTIVE.has(e.motive) ? [`motive_${e.motive}`] : []),
    ...((e.concurrentAtEntry ?? 0) > R.maxConcurrentPositions ? ["over_concurrent_cap"] : [])].map((v) => `${e.id}:${v}`));
  const noPre = paper.filter((e) => !(e.thesisRecordedAt && e.stopRecordedAt && e.thesisRecordedAt <= e.openedAt && e.stopRecordedAt <= e.openedAt));
  const premature = closed.filter(isPremature);
  const peakConc = Math.max(0, ...paper.map((e) => e.concurrentAtEntry ?? 0));
  C.push({ id: "discipline", title: "纪律：违规为零或接近零；每笔进场前已记录论点与止损", pass: viol.length <= maxV && noPre.length === 0,
    detail: [`违规 ${viol.length} 次（允许 ≤${maxV}）`, `同时持仓峰值 ${peakConc}（上限 ${R.maxConcurrentPositions}）`,
      `提前离场 ${premature.length} 笔（失效条件未触发、时间止损未到就主动离场 — 大佬复盘）`],
    missing: [...viol.map((v) => `违规 ${v}`), ...noPre.map((e) => `${e.id} 没有进场前的论点/止损时间戳`)] });

  // 5) every loss reviewed + classified; repeated tags flagged
  const losses = closed.filter((e) => fullPnl(e) <= 0);
  const unrev = losses.filter((e) => !e.lossReview?.errorClass);
  const noPm = closed.filter((e) => !e.postMortem && fullPnl(e) > 0); // wins need a post-mortem too (P1 #7)
  const tagN = new Map<string, number>(); for (const e of losses) for (const t of e.lossReview?.errorTags ?? []) tagN.set(t, (tagN.get(t) ?? 0) + 1);
  const repeated = [...tagN].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  const cls = (c: string) => losses.filter((e) => e.lossReview?.errorClass === c).length;
  const ignored = losses.filter((e) => e.critique?.acked && e.critique.warns > 0);
  const ignoredWins = closed.filter((e) => fullPnl(e) > 0 && e.critique?.acked && e.critique.warns > 0).length;
  C.push({ id: "loss_review", title: "每笔亏损都复盘并归类（判断 / 执行 / 风险管理 / 正常概率波动）", pass: unrev.length === 0 && noPm.length === 0,
    detail: [`亏损 ${losses.length} 笔：判断 ${cls("judgment")} / 执行 ${cls("execution")} / 风险管理 ${cls("risk")} / 正常波动 ${cls("variance")}`, `唱反调：亏损前被 --ack 忽略的警告 ${ignored.length} 笔（盈利 ${ignoredWins} 笔）${ignored.length ? `：${[...new Set(ignored.flatMap((e) => e.critique!.objections.filter((o) => o.severity === "WARN").map((o) => o.id)))].join("、")}` : ""}`,
      ...(repeated.length ? [`⚠️ 重复错误：${repeated.map(([t, n]) => `${t}×${n}`).join("、")}`] : [])],
    missing: [...unrev.map((e) => `${e.id} ${e.symbol} 亏损未复盘`), ...noPm.map((e) => `${e.id} ${e.symbol} 盈利也要复盘（paper review）`)] });

  const ready = C.every((c) => c.pass);
  return { ready, criteria: C, stats: { paperClosed: closed.length, spanDays: span, winRate: r2(ex.winRate), ev: r2(ex.ev), evTrim2: r2(ex2.ev), maxDrawdown: r2(mdd), premature: premature.length, ignoredWarnLosses: ignored.length, peakConcurrent: peakConc, violations: viol.length },
    practice: { n: practice.length, closed: pc.length, ev: r2(expectancy(pc).ev), total: r2(pc.reduce((a, b) => a + b, 0)), bySource: Object.fromEntries((["paper_sim", "real_practice", "mentor_shadow"] as const).map((k) => { const xs = practice.filter((e) => (e.source ?? "paper_sim") === k), c = xs.filter((e) => e.closedAt && e.pnl != null).map(fullPnl); return [k, { n: xs.length, closed: c.length, total: r2(c.reduce((a, b) => a + b, 0)) }]; })) },
    next: ready ? "全部通过 → 真钱从 1/4 仓位开始，约 20 笔后再恢复正常仓位（上限不变：单笔 1%、同标的 3%、日亏 2%）。" : "未通过 → 继续模拟交易，不上真钱。" };
}

export function renderReadiness(r: Readiness): string {
  const L = ["# 实盘准备度评分卡 Live-readiness", "", `**结论：${r.ready ? "✅ 可以开始 1/4 仓位实盘" : "🛑 还不能上真钱"}** — ${r.next}`, "", "_只根据正式模拟交易（mode: \"paper\", kind: formal）计算。胜率仅作参考；期望值和亏损上限说了算。_", ""];
  r.criteria.forEach((c, n) => {
    L.push(`## ${n + 1}. ${c.pass ? "✅" : "❌"} ${c.title}`, ...c.detail.map((d) => `- ${d}`));
    if (c.missing.length) L.push(`- **缺什么：**`, ...c.missing.slice(0, 15).map((m) => `  - ${m}`), ...(c.missing.length > 15 ? [`  - …另 ${c.missing.length - 15} 项`] : []));
    L.push("");
  });
  L.push(`## 练习单（kind: practice，不计入以上任何统计）`, `- ${r.practice.n} 笔（已平仓 ${r.practice.closed}）· 期望值 $${r.practice.ev}/笔 · 合计 $${r.practice.total}`,
    ...Object.entries(r.practice.bySource ?? {}).map(([k, v]) => `  - ${({ paper_sim: "模拟练习", real_practice: "真实账户练习", mentor_shadow: "大佬影子单" } as Record<string, string>)[k]}：${v.n} 笔（已平仓 ${v.closed}）· 合计 $${v.total}`), "");
  L.push("> 这些都是我自己的决定。改正，也是我的责任。（大佬复盘）");
  return L.join("\n") + "\n";
}
