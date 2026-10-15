/**
 * 唱反调 devil's-advocate critique — deterministic, no LLM. Runs before every `paper open` (user-approved 2026-10-14).
 * Each objection cites a catalog item (knowledge/catalog.json) or mentor source. BLOCK only where an existing hard
 * rule already exists (48h event window, motive, per-underlying 3%); everything else is WARN and needs --ack.
 */
import { pastMistakes } from "../options/postmortem.ts";
import type { Proposal } from "../options/pretrade.ts";
import type { JournalEntry } from "../options/journal.ts";
import { analyze, pnlAtExpiry } from "../options/payoff.ts";
import { daysTo } from "../options/bs.ts";
import { DEFAULT_RULES } from "../options/rules.ts";
import { SCENARIOS, type ScenarioId } from "../macro/scenarios.ts";
import { upcomingHighImpact } from "../macro/risk.ts";
import type { CalendarEvent } from "../ingest/officialCalendar.ts";
import type { YBar } from "../adapters/yahoo.ts";

export interface Objection { id: string; severity: "BLOCK" | "WARN"; text: string; cite: string }
export interface Critique { at: string; objections: Objection[]; blocks: number; warns: number; acked?: boolean }
export interface CritiqueInput {
  proposal: Proposal; side: "long" | "short"; thesis: string; invalidation: string; stop: string; motive?: string;
  leader?: ScenarioId | null; verdict?: string | null; verdictReasons?: string[]; futuresGapPct?: number | null;
  open: JournalEntry[]; history?: JournalEntry[]; bars?: YBar[]; calendar?: CalendarEvent[]; now: Date; capital: number;
}

/** underlying → scenario direction column (scenarios.ts dirs); single stocks proxied by SPX. */
const ASSET: Record<string, string> = { SPY: "SPX", SPX: "SPX", ES: "SPX", VOO: "SPX", QQQ: "NDX", NDX: "NDX", TQQQ: "NDX", IWM: "RUT", RUT: "RUT", TLT: "TLT", IEF: "TLT", UUP: "DXY", GLD: "黄金", IAU: "黄金", IBIT: "BTC", "BTC-USD": "BTC" };
/** coarse correlation groups for stacking */
const GROUP: Record<string, string> = { SPY: "equity", QQQ: "equity", IWM: "equity", TQQQ: "equity", DIA: "equity", TLT: "rates", IEF: "rates", HYG: "credit", GLD: "gold" };
const grp = (s: string) => GROUP[s] ?? "equity";
/** direction = payoff slope around the strikes (works for verticals where net option count is 0) */
function slopeSide(legs: Array<{ type: "call" | "put" | "stock"; strike: number; qty: number; premium: number }>, ref?: number): "long" | "short" {
  const ks = legs.filter((l) => l.type !== "stock").map((l) => l.strike);
  const c = ref ?? (ks.length ? ks.reduce((s, k) => s + k, 0) / ks.length : 100);
  return pnlAtExpiry(legs as never, c * 1.15) >= pnlAtExpiry(legs as never, c * 0.85) ? "long" : "short";
}
const sideOf = (e: JournalEntry): "long" | "short" => slopeSide(e.legs ?? [], e.underlyingAtEntry);
const nums = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).map(Number);

export function critique(i: CritiqueInput): Critique {
  const O: Objection[] = [];
  const add = (id: string, severity: Objection["severity"], text: string, cite: string) => O.push({ id, severity, text, cite });
  const p = i.proposal, sym = p.symbol;
  const spot = typeof p.underlyingPrice === "number" ? p.underlyingPrice : p.underlyingPrice[sym]!;

  // 1) scenario / signals vs direction
  const sc = i.leader ? SCENARIOS.find((s) => s.id === i.leader) : null;
  const col = ASSET[sym] ?? "SPX";
  if (i.leader === null) add("scenario", "WARN", "当前没有单一领先情景（信号并列）→ 方向本身不清楚，你凭什么选这一边？", "catalog: expectations / scenarios.ts");
  else if (sc) {
    const d = (sc.dirs as Record<string, string>)[col];
    if ((d === "↑" && i.side === "short") || (d === "↓" && i.side === "long"))
      add("scenario", "WARN", `领先情景「${sc.name}」对 ${col}${ASSET[sym] ? "" : "（个股按 SPX 近似）"} 的方向是 ${d}，你做的是${i.side === "long" ? "多" : "空"}：和宏观主线相反，需要更强的独立理由`, `catalog: expectations, ${sc.catalog.join(", ")}`);
  }
  if (i.verdict == null) add("brief_missing", "WARN", "没有 12 小时内的每日简报（npm run brief）→ 情景与宏观方向未经检查", "catalog: research, expectations");
  if (i.verdict === "NO_TRADE") add("brief_verdict", "WARN", `今日简报结论 NO_TRADE：${(i.verdictReasons ?? []).slice(0, 3).join("；")}。模拟交易可以练习，但要写清楚为什么今天例外`, "catalog: patience, psych-rule-exception-discipline");

  // 2) vague invalidation / stop
  const vague = (s: string) => !/\d/.test(s);
  if (vague(i.invalidation)) add("invalidation_vague", "WARN", `失效条件「${i.invalidation}」没有价格、水平或时间 → 到时候无法客观判断，容易给仓位重新编理由`, "catalog: thesis-stop; mentor-stop-loss（理由消失就走）");
  if (vague(i.stop)) add("stop_vague", "WARN", `止损「${i.stop}」没有具体数字`, "catalog: technical-stop, time-stop");

  // 3) stop at an obvious level
  const b20 = (i.bars ?? []).slice(-21, -1);
  const hi20 = b20.length ? Math.max(...b20.map((b) => b.h)) : null, lo20 = b20.length ? Math.min(...b20.map((b) => b.l)) : null;
  const prev = i.bars?.at(-2);
  for (const n of nums(i.stop).filter((n) => n > spot * 0.5 && n < spot * 1.5)) {
    const step = spot >= 200 ? 10 : spot >= 50 ? 5 : 1;
    const levels: Array<[string, number | null | undefined]> = [["20 日高点", hi20], ["20 日低点", lo20], ["前日高点", prev?.h], ["前日低点", prev?.l]];
    const near = levels.filter(([, v]) => v != null && Math.abs(n / v! - 1) <= 0.003).map(([k, v]) => `${k} ${v!.toFixed(2)}`);
    if (Math.abs(n / step - Math.round(n / step)) < 1e-9) near.unshift(`整数关口 ${n}`);
    if (near.length) add("stop_obvious", "WARN", `止损 ${n} 正好在显眼位置（${near.join("、")}）→ 人人都看得到，容易被扫；考虑用论点失效或时间止损，而不是这个价位`, "catalog: stop-hunting, technical-stop");
  }

  // 4) stacking with open paper positions
  const same = i.open.filter((e) => e.symbol === sym);
  const corr = i.open.filter((e) => e.symbol !== sym && grp(e.symbol) === grp(sym) && sideOf(e) === i.side);
  const ml = Math.abs(analyze(p.legs as never).maxLoss ?? 0);
  const sameRisk = same.reduce((s, e) => s + (e.maxLoss || 0), 0) + ml;
  if (sameRisk > i.capital * DEFAULT_RULES.perUnderlyingMaxLossPct / 100) add("stack_underlying", "BLOCK", `${sym} 合计最大亏损 $${sameRisk.toFixed(0)} > 同标的上限 ${DEFAULT_RULES.perUnderlyingMaxLossPct}%`, "期权课 13.3 集中度 / rules.perUnderlyingMaxLossPct");
  else if (same.length) add("stack_underlying", "WARN", `已经有 ${same.length} 笔 ${sym} 模拟仓位：这是新论点，还是在原论点上加仓？加仓最多 1 次且须论点被重新确认`, "catalog: adding; rules.ADD_RULE");
  if (corr.length) add("stack_correlated", "WARN", `同方向相关仓位：${corr.map((e) => e.symbol).join("、")}（${grp(sym)}）→ 实际上是同一个赌注，合计风险看共同赌注 ${DEFAULT_RULES.commonBetMaxLossPct}%`, "catalog: size, max-concurrent-positions");

  // 5) FOMO
  if (i.futuresGapPct != null && Math.abs(i.futuresGapPct) >= 1.5) add("fomo_gap", "WARN", `期货跳空 ${i.futuresGapPct > 1.5 ? i.futuresGapPct.toFixed(1) + "%" : "≥1.5%"}：开盘不追，等确认`, "mentor-premarket（premarket.ts 期货跳空 ≥1.5%）");
  const last = i.bars?.at(-1);
  if (last && b20.length >= 15) {
    const avgV = b20.reduce((s, b) => s + b.v, 0) / b20.length, rv = avgV ? last.v / avgV : null;
    const chaseUp = i.side === "long" && hi20 != null && spot >= hi20 * 0.995, chaseDn = i.side === "short" && lo20 != null && spot <= lo20 * 1.005;
    if ((chaseUp || chaseDn) && rv != null && rv < 1) add("fomo_breakout", "WARN", `在 20 日${chaseUp ? "高点" : "低点"}附近追${chaseUp ? "多" : "空"}，但成交量只有 20 日均量的 ${rv.toFixed(2)} 倍 → 低量突破可疑`, "catalog: volume-confirmation, psych-breakout-clock; 纪律 #07 不要追高");
  }

  // 6) 48h high-impact event (existing hard rule)
  const ev = upcomingHighImpact(i.calendar ?? [], i.now);
  if (ev.length) add("event_48h", "BLOCK", `48 小时内高影响事件：${ev.map((e) => `${e.kind} ${e.date} ${e.timeEt}`).join("、")} → 不开新仓`, "risk.ts EVENT_WINDOW 48h / catalog: overnight");

  // 7) EV / risk-reward
  const an = analyze(p.legs as never);
  if (an.maxGain != null && an.maxLoss != null && an.maxLoss < 0) {
    const rr = an.maxGain / -an.maxLoss;
    if (p.pAssumed != null) { const ev2 = p.pAssumed * an.maxGain - (1 - p.pAssumed) * -an.maxLoss; if (ev2 <= 0) add("ev", "WARN", `按你假设的胜率 ${p.pAssumed}，期望值 $${ev2.toFixed(0)} ≤ 0`, "catalog: quality; 期权课 14.9 期望值"); }
    else if (rr < 1) add("rr", "WARN", `最大盈利/最大亏损 = ${rr.toFixed(2)} < 1，且没有给出胜率假设 → 无法说明这笔有正期望`, "catalog: quality, cost");
  }

  // 8) motive / thesis strength
  if (i.motive && i.motive !== "thesis") add("motive", "BLOCK", `动机「${i.motive}」：不为分享、娱乐或刺激开仓`, "catalog: psych-no-performance-trades; mentor-winrate-review");
  if (i.thesis.trim().length < 12 || !/(因为|所以|→|->|导致|because|so |driv|if |如果)/i.test(i.thesis)) add("thesis_weak", "WARN", `论点「${i.thesis}」太短或没有因果机制（什么 → 导致什么 → 为什么是这个标的）`, "catalog: mechanisms, research");

  // 9) horizon vs DTE
  const exps = p.legs.filter((l) => l.type !== "stock" && l.expiration).map((l) => daysTo(p.asOf, l.expiration!));
  if (exps.length) {
    const front = Math.min(...exps);
    if (front < p.thesisHorizonDays + 7) add("horizon_short", "WARN", `最近到期 ${front.toFixed(0)} 天，论点需要 ${p.thesisHorizonDays} 天：早一周都会输给时间`, "catalog: horizons, time-stop; 复盘 HYG 以后我会调整什么 4");
    else if (front > p.thesisHorizonDays * 4 && front > 60) add("horizon_long", "WARN", `到期 ${front.toFixed(0)} 天远长于论点 ${p.thesisHorizonDays} 天：多付了时间价值，或者论点期限没想清楚`, "catalog: horizons, cost");
  }
  // past mistakes (postmortem.ts): repeated error tags and lessons on this symbol → WARN
  if (i.history?.length) {
    const pm = pastMistakes(i.history, sym);
    if (pm.tags.length) add("past_mistakes", "WARN", `上次同类错误：${pm.tags.map(([t, n]) => `${t}×${n}`).join("、")} → 这笔怎么避免？`, "postmortem.ts / readiness loss_review");
    if (pm.sameSymbol.length) add("past_lessons", "WARN", `${sym} 以前的教训：${pm.sameSymbol.join("；")}`, "postmortem.ts");
  }
  return { at: i.now.toISOString(), objections: O, blocks: O.filter((o) => o.severity === "BLOCK").length, warns: O.filter((o) => o.severity === "WARN").length };
}

export function renderCritique(c: Critique): string {
  if (!c.objections.length) return "### 唱反调 Devil's advocate\n- 没有找到反对意见（这不代表这笔交易是对的）\n";
  return ["### 唱反调 Devil's advocate", ...c.objections.map((o) => `- ${o.severity === "BLOCK" ? "⛔ BLOCK" : "⚠️ WARN"} ${o.text}（${o.cite}）`),
    "", c.blocks ? "⛔ 有 BLOCK：不能开仓。" : c.warns ? "⚠️ 有 WARN：确认你已经逐条想过，再加 --ack 继续。" : ""].join("\n") + "\n";
}

/** direction on the underlying: discipline.side if given, else the sign of the option legs' exposure */
export function proposalSide(p: Proposal): "long" | "short" {
  if (p.discipline?.side) return p.discipline.side;
  return slopeSide(p.legs, typeof p.underlyingPrice === "number" ? p.underlyingPrice : p.underlyingPrice[p.symbol]);
}
