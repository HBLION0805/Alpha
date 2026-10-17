/**
 * Review report (plan P2 #9): per-trade cards and a period summary.
 * Output: data/out/review-YYYY-MM-DD.md (`npm run review`; `--week` = last 7 days).
 */
import type { JournalEntry } from "./journal.ts";
import { mentorCompare, needsPostMortem } from "./postmortem.ts";
import { effectiveRules } from "./rules.ts";
import { sinsOf, SINS } from "./sins.ts";
const KIND = (e: JournalEntry) => e.source === "real_practice" ? "真实账户练习" : e.source === "mentor_shadow" ? "大佬影子单" : e.kind === "practice" ? "模拟练习" : "正式";
const etDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const legsStr = (e: JournalEntry) => (e.legs ?? []).map((l) => `${l.qty > 0 ? "+" : ""}${l.qty} ${l.strike}${l.type === "stock" ? "" : l.type[0]!.toUpperCase()}${l.expiration ? ` ${l.expiration.slice(5)}` : ""}`).join(" / ");
export function tradeCard(e: JournalEntry, all: JournalEntry[] = [e]): string[] {
  const m = e.marks?.at(-1), pnl = e.closedAt ? e.pnl : m?.pnl;
  const L = [`### ${e.symbol} ${e.strategy} · ${KIND(e)} · \`${e.id}\``,
    `- 结构：${legsStr(e)} · 开仓 ${e.openedAt.slice(0, 10)} · 开仓价 ${e.entryPrice ?? "未知"}${e.entryPriceSource ? `（${e.entryPriceSource}）` : ""} · 最大亏损 ${e.maxLoss ?? "未知"}`,
    `- 结果：${e.closedAt ? `已平仓 ${etDay(e.closedAt)}（${e.exitKind ?? "?"}${e.settlement ? `，结算 ${JSON.stringify(e.settlement.prices)}` : ""}）` : "持仓中"} · P&L ${pnl == null ? "未知" : `$${pnl}`}${!e.closedAt && m?.estimated ? "（估算）" : ""}`,
    `- 计划 vs 实际：论点 ${e.thesis ? "有" : "无"} · 失效 ${e.invalidation && !/^n\/a/.test(e.invalidation) ? e.invalidation : "无"} · 止损 ${e.stop ?? "无"} · 止盈计划 ${e.takeProfit ? e.takeProfit.kind : "无"}${e.tpHits?.length ? `（触发 ${e.tpHits.join(",")}）` : ""}`,
    `- 违规/超限：${(e.violations ?? []).join("、") || "无"}`];
  const sn = sinsOf(e, all);
  if (e.source !== "mentor_shadow") L.push(`- 七宗罪：${sn.length ? sn.map((x) => `${SINS[x.sin].zh}${x.by === "auto" ? "（自动候选）" : ""}：${x.reason}`).join("；") : "无"}`);
  if (e.postMortem) L.push(`- 复盘：${e.postMortem.classification}${e.postMortem.tags.length ? `（${e.postMortem.tags.join("、")}）` : ""} · 教训：${e.postMortem.lesson}`);
  else if (e.lossReview) L.push(`- 复盘：${e.lossReview.errorClass}（${e.lossReview.errorTags.join("、")}）${e.lesson ? ` · 教训：${e.lesson}` : ""}`);
  else if (e.closedAt) L.push("- 复盘：⚠️ 未写（npm run paper -- review --id … --class … --lesson …）");
  if (e.source === "mentor_shadow") L.push(...mentorCompare(e));
  return L;
}
export function renderReview(entries: JournalEntry[], capital: number, from: string, to: string): string {
  const R = effectiveRules(), perDay = capital * R.dailyLossLimitPct / 100;
  const inRange = (iso?: string) => !!iso && etDay(iso) >= from && etDay(iso) <= to;
  const xs = entries.filter((e) => inRange(e.openedAt) || inRange(e.closedAt) || !e.closedAt);
  const sim = xs.filter((e) => e.source !== "real_practice");
  const realized = sim.filter((e) => inRange(e.closedAt)).reduce((s, e) => s + (e.pnl ?? 0), 0);
  const unreal = sim.filter((e) => !e.closedAt).reduce((s, e) => s + (e.marks?.at(-1)?.pnl ?? 0), 0);
  const realAcct = xs.filter((e) => e.source === "real_practice" && inRange(e.closedAt)).reduce((s, e) => s + (e.pnl ?? 0), 0);
  const tagN = new Map<string, number>();
  for (const e of entries) for (const t of new Set([...(e.lossReview?.errorTags ?? []), ...(e.postMortem?.tags ?? [])])) tagN.set(t, (tagN.get(t) ?? 0) + 1);
  const breaches = xs.filter((e) => (e.violations ?? []).some((v) => /cap/.test(v)));
  const formalClosed = entries.filter((e) => e.kind !== "practice" && e.mode === "paper" && e.closedAt).length;
  return [`# 交易复盘 ${from}${from === to ? "" : ` → ${to}`}`, "",
    "## 汇总",
    `- 模拟（正式+练习+影子）：已实现 $${Math.round(realized * 100) / 100} · 未实现 $${Math.round(unreal * 100) / 100}（日亏上限 $${perDay}）`,
    `- 真实账户练习单已实现：$${Math.round(realAcct * 100) / 100}（不计入模拟上限与 readiness）`,
    `- 超限：${breaches.length} 笔${breaches.length ? `（${breaches.map((e) => `${e.symbol}:${(e.violations ?? []).filter((v) => /cap/.test(v)).join("/")}`).join("、")}）` : ""}`,
    `- 重复错误：${[...tagN].filter(([, n]) => n >= 2).map(([t, n]) => `${t}×${n}`).join("、") || "无"}${[...tagN].filter(([, n]) => n === 1).length ? ` · 单次：${[...tagN].filter(([, n]) => n === 1).map(([t]) => t).join("、")}` : ""}`,
    `- 待复盘：${entries.filter(needsPostMortem).filter((e) => !e.lossReview).map((e) => e.id).join("、") || "无"}`,
    `- Readiness 进度：正式 ${formalClosed}/30`, "",
    "## 逐笔", "", ...xs.flatMap((e) => [...tradeCard(e, entries), ""])].join("\n");
}
