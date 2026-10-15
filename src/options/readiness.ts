/**
 * Live-readiness scorecard (user steering 2026-10-14), computed ONLY from the paper-trade journal.
 * All five criteria must pass before real money; then quarter size for ~20 trades, then normal size.
 * Win rate is shown as context only: a low win rate is not failure when losses stay controlled
 * (大佬复盘 mentor-winrate-review) — expectancy and loss caps decide.
 */
import { fullPnl, type JournalEntry } from "./journal.ts";
import { DEFAULT_RULES, type RuleCard } from "./rules.ts";

export interface Criterion { id: string; title: string; pass: boolean; detail: string[]; missing: string[] }
export interface Readiness { ready: boolean; criteria: Criterion[]; stats: Record<string, number | string | null>; next: string }
export interface ReadinessInput { journal: JournalEntry[]; capital: number; shockDates: string[]; rules?: RuleCard; maxViolations?: number }

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
  const paper = i.journal.filter((e) => e.mode === "paper");
  const closed = paper.filter((e) => e.closedAt && e.pnl != null).sort((a, b) => a.closedAt!.localeCompare(b.closedAt!));
  const C: Criterion[] = [];

  // 1) sample: ≥30 trades over ≥60 days incl. a shock period
  const first = closed[0]?.openedAt, last = closed.at(-1)?.closedAt;
  const span = first && last ? daysBetween(first, last) : 0;
  const shock = new Set(i.shockDates.map(day));
  const shockTrades = closed.filter((e) => { for (let d = new Date(day(e.openedAt)); d.toISOString().slice(0, 10) <= day(e.closedAt!); d.setUTCDate(d.getUTCDate() + 1)) if (shock.has(d.toISOString().slice(0, 10))) return true; return false; });
  C.push({ id: "sample", title: "样本：≥30 笔模拟交易、≥60 天、含至少一个冲击时段", pass: closed.length >= 30 && span >= 60 && shockTrades.length > 0,
    detail: [`已平仓模拟交易 ${closed.length} 笔，跨度 ${span} 天，冲击时段内持仓 ${shockTrades.length} 笔`],
    missing: [...(closed.length < 30 ? [`还差 ${30 - closed.length} 笔`] : []), ...(span < 60 ? [`还差 ${60 - span} 天`] : []), ...(shockTrades.length ? [] : ["没有一笔经历冲击时段（VIX 期限结构倒挂或高影响数据日）"])] });

  // 2) expectancy, robust to the top 2 winners
  const ps = closed.map(fullPnl);
  const ex = expectancy(ps);
  const trimmed = [...ps].sort((a, b) => b - a).slice(Math.min(2, ps.filter((x) => x > 0).length));
  const ex2 = expectancy(trimmed);
  C.push({ id: "expectancy", title: "期望值为正，去掉最大 2 笔盈利后仍为正", pass: ps.length > 0 && ex.ev > 0 && ex2.ev > 0,
    detail: [`期望值 = 胜率×平均盈利 − 败率×平均亏损 = ${r2(ex.winRate * 100)}%×$${r2(ex.avgWin)} − ${r2((1 - ex.winRate) * 100)}%×$${r2(ex.avgLoss)} = $${r2(ex.ev)}/笔`, `去掉最大 2 笔盈利：$${r2(ex2.ev)}/笔`,
      `胜率只作参考：亏损受控时低胜率不等于失败（大佬复盘 mentor-winrate-review）`],
    missing: [...(ex.ev > 0 ? [] : ["期望值不为正"]), ...(ex2.ev > 0 ? [] : ["依赖少数大赢家：去掉最大 2 笔后期望值不为正"])] });

  // 3) loss caps + max drawdown
  const capOf = (e: JournalEntry) => e.capitalAtEntry ?? i.capital;
  const bigLoss = closed.filter((e) => -fullPnl(e) > capOf(e) * R.sellerMaxLossPerTradePct / 100);
  const byDay = new Map<string, number>(); for (const e of closed) byDay.set(day(e.closedAt!), (byDay.get(day(e.closedAt!)) ?? 0) + fullPnl(e));
  const badDays = [...byDay].filter(([, v]) => -v > i.capital * R.dailyLossLimitPct / 100);
  let eq = 0, peak = 0, mdd = 0; for (const p of ps) { eq += p; peak = Math.max(peak, eq); mdd = Math.max(mdd, peak - eq); }
  C.push({ id: "loss_caps", title: `单笔亏损 ≤${R.sellerMaxLossPerTradePct}%，单日亏损 ≤${R.dailyLossLimitPct}%`, pass: closed.length > 0 && !bigLoss.length && !badDays.length,
    detail: [`最大回撤 $${r2(mdd)}（${r2((mdd / i.capital) * 100)}%）`, `最大单笔亏损 $${r2(-Math.min(0, ...ps))}`],
    missing: [...bigLoss.map((e) => `${e.id} ${e.symbol} 亏 $${r2(-fullPnl(e))} > ${R.sellerMaxLossPerTradePct}%`), ...badDays.map(([d, v]) => `${d} 单日亏 $${r2(-v)} > ${R.dailyLossLimitPct}%`)] });

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
  const tagN = new Map<string, number>(); for (const e of losses) for (const t of e.lossReview?.errorTags ?? []) tagN.set(t, (tagN.get(t) ?? 0) + 1);
  const repeated = [...tagN].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  const cls = (c: string) => losses.filter((e) => e.lossReview?.errorClass === c).length;
  C.push({ id: "loss_review", title: "每笔亏损都复盘并归类（判断错误 vs 执行错误）", pass: unrev.length === 0,
    detail: [`亏损 ${losses.length} 笔：判断 ${cls("judgment")} / 执行 ${cls("execution")}`, ...(repeated.length ? [`⚠️ 重复错误：${repeated.map(([t, n]) => `${t}×${n}`).join("、")}`] : [])],
    missing: unrev.map((e) => `${e.id} ${e.symbol} 亏损未复盘`) });

  const ready = C.every((c) => c.pass);
  return { ready, criteria: C, stats: { paperClosed: closed.length, spanDays: span, winRate: r2(ex.winRate), ev: r2(ex.ev), evTrim2: r2(ex2.ev), maxDrawdown: r2(mdd), premature: premature.length, peakConcurrent: peakConc, violations: viol.length },
    next: ready ? "全部通过 → 真钱从 1/4 仓位开始，约 20 笔后再恢复正常仓位（上限不变：单笔 1%、同标的 3%、日亏 2%）。" : "未通过 → 继续模拟交易，不上真钱。" };
}

export function renderReadiness(r: Readiness): string {
  const L = ["# 实盘准备度评分卡 Live-readiness", "", `**结论：${r.ready ? "✅ 可以开始 1/4 仓位实盘" : "🛑 还不能上真钱"}** — ${r.next}`, "", "_只根据模拟交易日志（mode: \"paper\"）计算。胜率仅作参考；期望值和亏损上限说了算。_", ""];
  r.criteria.forEach((c, n) => {
    L.push(`## ${n + 1}. ${c.pass ? "✅" : "❌"} ${c.title}`, ...c.detail.map((d) => `- ${d}`));
    if (c.missing.length) L.push(`- **缺什么：**`, ...c.missing.slice(0, 15).map((m) => `  - ${m}`), ...(c.missing.length > 15 ? [`  - …另 ${c.missing.length - 15} 项`] : []));
    L.push("");
  });
  L.push("> 这些都是我自己的决定。改正，也是我的责任。（大佬复盘）");
  return L.join("\n") + "\n";
}
