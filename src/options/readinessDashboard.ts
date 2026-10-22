/**
 * 实盘准备度看板 (user-approved 2026-10-22): generated markdown + JSON, also embedded in the weekly review.
 * Scope "simulated" = mode paper, source ≠ real_practice / mentor_shadow (formal + paper_sim practice). Formal-only count is shown too,
 * because only formal trades count toward the readiness criteria (src/options/readiness.ts).
 */
import { fullPnl, type JournalEntry } from "./journal.ts";
import { expectancy } from "./readiness.ts";
import { entryCapUsd } from "./confidence.ts";

export interface Dashboard { asOf: string; target: number; trades: { simulated: number; formal: number; closed: number; open: number; realPractice: number; macro: number; macroOpen: number; macroPnl: number };
  monthsElapsed: number | null; firstTradeAt: string | null; expectancy: { perTrade: number; winRate: number; total: number; exTop1: number | null; exTop2: number | null; top2SharePct: number | null; dependsOnTop: boolean } | null;
  maxDrawdown: number; capBreaches: { perTrade: Array<{ id: string; loss: number; cap: number }>; daily: Array<{ day: string; loss: number }> };
  discipline: { missingThesis: string[]; missingStop: string[] }; errors: { judgment: number; execution: number; good: number; unclassified: number; ids: Record<string, string[]> } }

const r2 = (x: number) => Math.round(x * 100) / 100;
const etDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const blank = (s?: unknown) => s == null || (typeof s === "string" && (!s.trim() || /not recorded|^n\/a/i.test(s)));

export function buildDashboard(entries: JournalEntry[], capital: number, now = new Date(), o: { target?: number; dailyCapPct?: number } = {}): Dashboard {
  type E = JournalEntry & { thesis?: string; stop?: string; lossReview?: { errorClass?: string }; postMortem?: { classification?: string }; confidence?: { capUsd?: number } };
  const all = entries as E[], P = all.filter((e) => e.mode === "paper");
  const sim = P.filter((e) => e.source !== "real_practice" && e.source !== "mentor_shadow" && e.category !== "macro");
  const closed = sim.filter((e) => e.closedAt && e.pnl != null).sort((a, b) => a.closedAt!.localeCompare(b.closedAt!));
  const first = [...sim].sort((a, b) => a.openedAt.localeCompare(b.openedAt))[0]?.openedAt ?? null;
  const ps = closed.map(fullPnl), total = ps.reduce((a, b) => a + b, 0), sorted = [...ps].sort((a, b) => b - a);
  const exDrop = (k: number) => (ps.length > k ? expectancy(sorted.slice(k)).ev : null);
  const top2 = sorted.slice(0, 2).filter((x) => x > 0).reduce((a, b) => a + b, 0);
  const ex = ps.length ? expectancy(ps) : null;
  let eq = 0, peak = 0, mdd = 0; for (const p of ps) { eq += p; peak = Math.max(peak, eq); mdd = Math.max(mdd, peak - eq); }
  const cap = (e: E) => entryCapUsd(e, capital); // recorded tier, else the trade's own max-loss tier (0.5–2%)
  const perTrade = closed.filter((e) => -fullPnl(e) > cap(e) + 0.005).map((e) => ({ id: e.id, loss: r2(-fullPnl(e)), cap: r2(cap(e)) }));
  const byDay = new Map<string, number>(); for (const e of closed) byDay.set(etDay(e.closedAt!), (byDay.get(etDay(e.closedAt!)) ?? 0) + fullPnl(e));
  const dCap = capital * (o.dailyCapPct ?? 2) / 100;
  const daily = [...byDay].filter(([, v]) => -v > dCap).map(([day, v]) => ({ day, loss: r2(-v) }));
  const err = { judgment: 0, execution: 0, good: 0, unclassified: 0, ids: {} as Record<string, string[]> };
  for (const e of closed) { const c = (e.errorType === "logic" ? "judgment" : e.errorType === "execution" ? "execution" : undefined) ?? (e.lossReview?.errorClass as string | undefined) ?? (e.postMortem?.classification as string | undefined);
    const k = c === "judgment" || c === "logic" ? "judgment" : c === "execution" ? "execution" : c === "good" ? "good" : "unclassified"; err[k]++; (err.ids[k] ??= []).push(e.id); }
  return { asOf: now.toISOString(), target: o.target ?? 30,
    trades: { simulated: sim.length, formal: sim.filter((e) => e.kind !== "practice").length, closed: closed.length, open: sim.length - closed.length, realPractice: P.filter((e) => e.source === "real_practice").length, macro: P.filter((e) => e.source === "mentor_shadow" || e.category === "macro").length, macroOpen: P.filter((e) => (e.source === "mentor_shadow" || e.category === "macro") && !e.closedAt).length, macroPnl: r2(P.filter((e) => (e.source === "mentor_shadow" || e.category === "macro") && e.closedAt && e.pnl != null).reduce((s, e) => s + fullPnl(e), 0)) },
    firstTradeAt: first, monthsElapsed: first ? r2((now.getTime() - Date.parse(first)) / (30.44 * 864e5)) : null,
    expectancy: ex ? { perTrade: r2(ex.ev), winRate: r2(ex.winRate * 100), total: r2(total), exTop1: exDrop(1) == null ? null : r2(exDrop(1)!), exTop2: exDrop(2) == null ? null : r2(exDrop(2)!), top2SharePct: total > 0 ? r2(top2 / total * 100) : null,
      dependsOnTop: total > 0 && (top2 / total > 0.5 || (exDrop(2) ?? 0) <= 0) } : null,
    maxDrawdown: r2(mdd), capBreaches: { perTrade, daily },
    discipline: { missingThesis: sim.filter((e) => blank(e.thesis) && blank((e.view as { magnitudeTime?: string })?.magnitudeTime)).map((e) => e.id), missingStop: sim.filter((e) => blank(e.stop) && blank(e.invalidation) && !(e.exitRules ?? []).some((x) => /stop|止损/i.test(x))).map((e) => e.id) },
    errors: err };
}

export function renderDashboard(d: Dashboard, h = "##"): string {
  const m = (x: number) => `${x < 0 ? "−" : ""}$${Math.abs(x)}`, x = d.expectancy;
  const bar = (n: number) => "█".repeat(Math.min(30, n)) + "░".repeat(Math.max(0, 30 - n));
  return [`${h} 实盘准备度看板 Readiness dashboard`, `_生成 ${d.asOf.slice(0, 16)}Z · 范围：模拟单（正式 + 模拟练习；不含真实账户练习单 ${d.trades.realPractice} 笔、宏观单 ${d.trades.macro} 笔）_`, "",
    "| 指标 | 数值 |", "|---|---|",
    `| 正式单 vs 目标 | ${d.trades.formal} / ${d.target} \`${bar(d.trades.formal)}\`（全部模拟单 ${d.trades.simulated}：已平 ${d.trades.closed}，持仓 ${d.trades.open}） |`,
    `| 宏观单（单独记账，不计入 30） | ${d.trades.macro} 笔（持仓 ${d.trades.macroOpen}，已平合计 ${m(d.trades.macroPnl)}） |`,
    `| 已过月数 | ${d.monthsElapsed ?? "n/a"}（首笔 ${d.firstTradeAt?.slice(0, 10) ?? "—"}） |`,
    `| 期望值 / 笔 | ${x ? `${m(x.perTrade)}（胜率 ${x.winRate}%，合计 ${m(x.total)}）` : "无已平仓"} |`,
    `| 去掉最大 1 / 2 笔后 | ${x ? `${x.exTop1 == null ? "n/a" : m(x.exTop1)} / ${x.exTop2 == null ? "n/a" : m(x.exTop2)}${x.top2SharePct != null ? `；最大 2 笔占总盈利 ${x.top2SharePct}%` : ""} → ${x.dependsOnTop ? "**依赖少数大赢家**" : "不依赖"}` : "n/a"} |`,
    `| 最大回撤 | ${m(d.maxDrawdown)} |`,
    `| 单笔上限违规 | ${d.capBreaches.perTrade.length ? d.capBreaches.perTrade.map((b) => `${b.id} 亏 $${b.loss} > $${b.cap}`).join("；") : "0"} |`,
    `| 单日上限违规 | ${d.capBreaches.daily.length ? d.capBreaches.daily.map((b) => `${b.day} 亏 $${b.loss}`).join("；") : "0"} |`,
    `| 纪律：缺论点 / 缺止损 | ${d.discipline.missingThesis.length} / ${d.discipline.missingStop.length}${[...d.discipline.missingThesis, ...d.discipline.missingStop].length ? `（${[...new Set([...d.discipline.missingThesis, ...d.discipline.missingStop])].join(", ")}）` : ""} |`,
    `| 判断错 / 执行错 / 做对 / 未归类 | ${d.errors.judgment} / ${d.errors.execution} / ${d.errors.good} / ${d.errors.unclassified} |`, ""].join("\n");
}
