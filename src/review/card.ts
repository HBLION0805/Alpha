/**
 * 入场前计划卡 (pre-trade plan card). Pure: every input is fetched by src/cli/card.ts and passed in; missing data
 * is reported as missing, never filled in. Reuses planlink (§2.1), scenarios, riskplan (30/30 + STOP_RULE),
 * tpplan (分批止盈), gex, levels, calendar/OpEx, earnings, critique (唱反调) and postmortem (past mistakes).
 */
import { dailyRiskCapPct, newRiskOpened } from "../options/riskCap.ts";
import { mentorForTags, liquidityThemeLines, oilSqueezeLines, deadCatCardLines, mentorLevelCardLines, stockProtectionLines } from "./mentor.ts";
import type { MarketPhase } from "../macro/marketPhase.ts";
import type { LevelEntry } from "../macro/mentorLevels.ts";
import { SCENARIOS } from "../macro/scenarios.ts";
import { STOP_RULE } from "../options/riskplan.ts";
import { buildTakeProfit, renderTakeProfit } from "../options/tpplan.ts";
import { analyze } from "../options/payoff.ts";
import { critique, type Critique } from "./critique.ts";
import { pastMistakes } from "../options/postmortem.ts";
import { openPaper } from "../options/paper.ts";
import type { PlanItem } from "../options/planlink.ts";
import type { GexOut } from "../options/gex.ts";
import type { RefLevels } from "../levels.ts";
import type { CalendarEvent } from "../ingest/officialCalendar.ts";
import { countsTowardDailyCap, type JournalEntry } from "../options/journal.ts";
import type { YBar } from "../adapters/yahoo.ts";
import { fmtEarnings, type EarningsRow } from "../options/earningsStore.ts";
import { inBlackout, type FedCache } from "../ingest/fedSpeakers.ts";
import { shortEntryChecks, renderShortSection, type ShortInput } from "../options/shortside.ts";
import { paperEquity, tradeCap, capLabel, dayCapUsd, type Tier, type TradeCap } from "../options/confidence.ts";
import { renderScenariosWithMenu } from "../options/hedgeMenu.ts";
import { runScenarios, planFromResult, type ELeg, type ScenarioPlan } from "../options/scenarioEngine.ts";
import { atr14, keyLevels } from "../options/scenarioCtx.ts";
import type { Bar } from "../levels.ts";

export type Dir = "bull" | "bear";
export interface Quote { type: "call" | "put"; strike: number; expiration: string; bid: number | null; ask: number | null; src: string }
export interface CardLeg { type: "call" | "put"; strike: number; qty: number; expiration: string; bid: number | null; ask: number | null; mid: number | null; src: string }
export interface CardInput {
  now: Date; sym: string; dir: Dir; structure?: string; legs?: Array<{ qty: number; type: "call" | "put"; strike: number }>; exp?: string;
  spot: number | null; bars: YBar[]; levels: RefLevels | null; quotes: Quote[];
  brief: { generatedAt: string; leader: string | null; verdict: string | null; reasons?: string[]; plan?: PlanItem[]; oilVix?: { fast: boolean; driver: string; vix: string } | null; deadCat?: { wti?: number | null; mentorLevels?: { date: string; levels: Array<{ id: string; value: number | null; above: boolean | null; final: boolean }> } | null } | null } | null;
  gex: GexOut | null; calendar: CalendarEvent[]; earnings: Array<{ symbol: string; date: string; timing: string | null }> | null;
  /** next report from earningsStore: undefined = never looked up, null = none upcoming */ earningsNext?: EarningsRow | null; fed?: FedCache | null;
  journal: JournalEntry[]; capital: number; thesis?: string; invalidation?: string;
  /** risk already held by today's saved, unopened cards (src/review/orderBlock.ts reservedRiskUsd) — counts as new risk */ reservedUsd?: number;
  /** bearish cards: benchmark bars + the written squeeze check for the 做空清单 (src/options/shortside.ts); absent = reported as missing */
  /** today's 大佬 daily levels entry (knowledge/mentor/market-calls/levels.json), loaded by cli/card.ts; info only */
  mentorLevels?: LevelEntry | null;
  /** confidence tier → per-trade cap 0.5–2% of live paper equity (src/options/confidence.ts); macro alignment comes from the brief, technical from --tech-entry */
  confidence?: { tier?: Tier; technical?: boolean };
  /** Robinhood option quotes (data/in/rh-option-quotes.json, read-only) for hedge-candidate pricing; BS fallback */ optionQuotes?: import("../options/hedgeMenu.ts").RhQuote[];
  /** 大佬 levels.json entries (all dates) for scenario targets */ mentorAll?: LevelEntry[];
  /** stock long cards: shares held (covered call needs >= 100) and the market phase (src/macro/marketPhase.ts); info only */
  shares?: number | null; marketPhase?: MarketPhase | null;
  short?: Pick<ShortInput, "spyBars" | "sectorSym" | "sectorBars" | "squeezeCheck" | "horizonDays">;
}
export type Status = "ok" | "warn" | "fail" | "missing";
export interface Section { n: number; title: string; status: Status; lines: string[] }
export interface Card { id: string; createdAt: string; sym: string; dir: Dir; verdict: "formal" | "practice" | "practice_warn" | "no"; verdictText: string; failing: string[]; warnTags?: string[]; planMissing?: string[]; sections: Section[];
  /** per-trade cap used by this card + the engine's scenario plan (paper open --card stores it as the written plan) */
  confidence?: { tier: Tier; pct: number; capUsd: number; equity: number; downgraded: boolean }; scenarioPlan?: ScenarioPlan | null;
  /** bearish cards only: 做空清单 warn tags (kept even on a formal verdict) + manual items */ shortTags?: string[]; shortManual?: string[];
  /** thesis mentions liquidity / pivot / rotation themes → the mentor's verbatim reminders (src/review/mentor.ts liquidityThemeLines); shown on any verdict, info only */ macroTheme?: string[];
  trade: { legs: CardLeg[]; exp: string | null; contracts: number; perContractMaxLoss: number | null; maxLoss: number | null; planId: string | null; tpKind: string | null; invalidationLevel: number | null; mechanical: string | null } }

const ICON: Record<Status, string> = { ok: "✅", warn: "🟡", fail: "🛑", missing: "❔" };
const r2 = (x: number) => Math.round(x * 100) / 100;
const etDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const COL: Record<string, string> = { SPY: "SPX", QQQ: "NDX", IWM: "RUT", TLT: "TLT", GLD: "黄金", GDX: "黄金", UUP: "DXY", IBIT: "BTC" };
const mid = (q?: Quote) => (q && q.bid != null && q.ask != null && q.ask > 0 ? r2((q.bid + q.ask) / 2) : null);

export function priceLegs(legs: Array<{ qty: number; type: "call" | "put"; strike: number }>, exp: string, quotes: Quote[]): CardLeg[] {
  return legs.map((l) => { const q = quotes.find((x) => x.type === l.type && x.strike === l.strike && x.expiration === exp);
    return { ...l, expiration: exp, bid: q?.bid ?? null, ask: q?.ask ?? null, mid: mid(q), src: q?.src ?? "无报价" }; });
}
/** per-contract max loss in $ (null = undefined risk or missing price) */
export function perContractLoss(legs: CardLeg[]): number | null {
  if (legs.some((l) => l.mid == null)) return null;
  const an = analyze(legs.map((l) => ({ type: l.type, strike: l.strike, qty: l.qty, premium: l.mid!, expiration: l.expiration })) as never);
  return an.maxLoss == null ? null : r2(Math.abs(an.maxLoss));
}
/** debit vertical candidates around ATM that fit the budget (long leg near ATM, shorter widths first) */
export function suggestVerticals(dir: Dir, spot: number, exp: string, quotes: Quote[], budget: number): Array<{ legs: CardLeg[]; loss: number; contracts: number }> {
  const type = dir === "bear" ? "put" : "call";
  const ks = [...new Set(quotes.filter((q) => q.type === type && q.expiration === exp && mid(q) != null).map((q) => q.strike))].sort((a, b) => a - b);
  if (!ks.length) return [];
  const atm = ks.reduce((a, b) => (Math.abs(b - spot) < Math.abs(a - spot) ? b : a));
  const i0 = ks.indexOf(atm), out: Array<{ legs: CardLeg[]; loss: number; contracts: number }> = [];
  for (const shift of [0, 1, 2, 3, 4]) { // long at ATM, then up to 4 strikes OTM
    const li = dir === "bear" ? i0 - shift : i0 + shift; if (li < 0 || li >= ks.length) continue;
    for (let w = 1; w <= 4; w++) {
      const si = dir === "bear" ? li - w : li + w; if (si < 0 || si >= ks.length) break;
      const legs = priceLegs([{ qty: 1, type, strike: ks[li]! }, { qty: -1, type, strike: ks[si]! }], exp, quotes);
      const loss = perContractLoss(legs);
      if (loss != null && loss > 0 && (budget <= 0 ? true : loss <= budget)) out.push({ legs, loss, contracts: budget > 0 ? Math.floor(budget / loss) : 0 });
    }
  }
  return out.sort((a, b) => Math.abs(a.legs[0]!.strike - spot) - Math.abs(b.legs[0]!.strike - spot) || b.loss - a.loss).slice(0, 3);
}
export function dailyBudget(journal: JournalEntry[], capital: number, now: Date, perDayPct?: number, reservedUsd = 0): { used: number; remaining: number; newRisk: number; newRiskRemaining: number } {
  const today = etDay(now), dated = dailyRiskCapPct(today, capital), pct = perDayPct != null ? Math.min(perDayPct, dated) : dated, sim = journal.filter((e) => e.mode === "paper" && countsTowardDailyCap(e)); // incl. mentor_shadow (DECISIONS 2026-10-17)
  const pnl = sim.filter((e) => e.closedAt && etDay(new Date(e.closedAt)) === today).reduce((s, e) => s + (e.pnl ?? 0), 0)
    + sim.filter((e) => !e.closedAt).reduce((s, e) => s + (e.marks?.at(-1)?.pnl ?? 0), 0);
  const used = Math.max(0, -pnl);
  const newRisk = newRiskOpened(sim, today).usd + Math.max(0, reservedUsd); // + max loss held by today's saved, not-yet-opened cards (orderBlock.ts) // user rule 2026-10-29: NEW risk opened today counts against the same cap
  return { used: r2(used), remaining: r2(Math.max(0, capital * pct / 100 - used)), newRisk: r2(newRisk), newRiskRemaining: r2(Math.max(0, capital * pct / 100 - newRisk)) };
}
const legStr = (l: CardLeg[]) => l.map((x) => `${x.qty > 0 ? "买" : "卖"} ${x.strike}${x.type === "put" ? "P" : "C"}（${x.mid ?? "无价"}${x.mid != null ? `，${x.src}` : ""}）`).join(" / ");

export function buildCard(i: CardInput): Card {
  const S: Section[] = [], failing: string[] = [];
  const today = etDay(i.now), side = i.dir === "bear" ? "short" : "long";
  // per-trade cap = confidence tier × live paper equity (user 2026-10-20); high/highest need macro + scenario plan + technical aligned
  const sc0 = i.brief?.leader ? SCENARIOS.find((s) => s.id === i.brief!.leader) : null, d0 = sc0 ? (sc0.dirs as Record<string, string>)[COL[i.sym] ?? "SPX"] : null;
  const equity = paperEquity(i.journal, i.capital), cap: TradeCap = tradeCap(equity, i.confidence?.tier, { macro: d0 === (i.dir === "bear" ? "↓" : "↑"), technical: i.confidence?.technical, scenarioPlan: i.exp != null && i.spot != null });
  const perTrade = cap.usd;
  const id = `card-${today}-${i.sym}-${i.dir}-${i.now.getTime().toString(36)}`;
  const exp = i.exp ?? null;
  const budget = dailyBudget(i.journal, equity, i.now, undefined, i.reservedUsd ?? 0), allowed = Math.min(perTrade, budget.remaining, budget.newRiskRemaining);

  // legs: user-specified, else suggest a debit vertical
  let legs: CardLeg[] = [], suggested = false;
  const sugg = exp && i.spot != null && allowed > 0 ? suggestVerticals(i.dir, i.spot, exp, i.quotes, allowed) : [];
  if (i.legs?.length && exp) legs = priceLegs(i.legs, exp, i.quotes);
  else if (sugg.length) { legs = sugg[0]!.legs; suggested = true; }
  const per = legs.length ? perContractLoss(legs) : null;
  const contracts = per && per > 0 ? Math.floor(allowed / per) : 0;

  // 1) plan
  const fresh = i.brief && i.now.getTime() - Date.parse(i.brief.generatedAt) < 12 * 3600_000;
  const match = fresh ? (i.brief!.plan ?? []).find((p) => p.ticker === i.sym && p.side === side && p.id.startsWith(today)) : undefined;
  S.push({ n: 1, title: "是否在今天盘前计划", status: !fresh ? "missing" : match ? "ok" : "warn", lines: !fresh ? ["- 没有 12 小时内的简报（npm run brief）→ 无法确认计划 → 只能练习"]
    : match ? [`- ✅ 匹配计划 \`${match.id}\`：进场区间 ${match.entryZone[0]}–${match.entryZone[1]}，触发：${match.trigger}`, `- 现价 ${i.spot ?? "未知"}${i.spot != null && (i.spot < match.entryZone[0] || i.spot > match.entryZone[1]) ? " **不在进场区间（不追）**" : ""}`]
    : [`- 今日计划（§2.1）里没有 ${i.sym} ${i.dir === "bear" ? "看空" : "看多"}（计划：${(i.brief!.plan ?? []).map((p) => p.id).join("、") || "无，今日 NO_TRADE"}）→ **只能作为练习单**`] });
  const inZone = match && i.spot != null && i.spot >= match.entryZone[0] && i.spot <= match.entryZone[1];

  // 2) macro
  const sc = i.brief?.leader ? SCENARIOS.find((s) => s.id === i.brief!.leader) : null;
  const col = COL[i.sym] ?? "SPX", d = sc ? (sc.dirs as Record<string, string>)[col] : null;
  const agree = d == null ? null : d === "↓" ? i.dir === "bear" : d === "↑" ? i.dir === "bull" : null;
  S.push({ n: 2, title: "宏观逻辑", status: !i.brief ? "missing" : agree === false ? "warn" : agree ? "ok" : "warn",
    lines: !i.brief ? ["- 简报缺失 → 领先情景未知"] : [`- 领先情景：${sc ? sc.name : "无单一领先情景"}；简报结论 ${i.brief.verdict ?? "?"}`,
      `- ${col}${COL[i.sym] ? "" : "（个股按 SPX 近似）"} 方向 ${d ?? "?"} vs 你的 ${i.dir === "bear" ? "看空" : "看多"} → ${agree == null ? "情景不给方向（↕/→）：宏观不支持也不反对" : agree ? "一致" : "**相反**：需要特别理由"}`] });

  // 3) hedge
  const shorts = legs.filter((l) => l.qty < 0), longs = legs.filter((l) => l.qty > 0);
  const naked = shorts.some((s) => !longs.some((l) => l.type === s.type && Math.abs(l.qty) >= Math.abs(s.qty)));
  const hedge: Status = !legs.length ? "missing" : naked ? "fail" : shorts.length ? "ok" : "warn";
  S.push({ n: 3, title: "对冲方式", status: hedge, lines: [!legs.length ? "- 没有可定价的结构 → 无法判断" : naked ? "- 🛑 有裸卖腿 → 风险无限，不做" : shorts.length ? "- 价差本身就是对冲（built_in_spread）：最大亏损已锁定" : "- 单腿买方：风险有限，但没有对冲腿（可接受作练习；正式单建议改价差）"] });
  if (hedge === "fail") failing.push("对冲：裸卖");

  // 4) two stops
  const L = i.levels, sp = i.spot;
  const above = L && sp != null ? [L.priorDay?.h, L.week?.h, L.sma.ma20, L.sma.ma50, ...L.pivots.filter((p) => p.kind === "swing_high").map((p) => p.price)].filter((x): x is number => x != null && x > sp).sort((a, b) => a - b) : [];
  const below = L && sp != null ? [L.priorDay?.l, L.week?.l, L.sma.ma20, L.sma.ma50, ...L.pivots.filter((p) => p.kind === "swing_low").map((p) => p.price)].filter((x): x is number => x != null && x < sp).sort((a, b) => b - a) : [];
  const userInv = i.invalidation ? Number((i.invalidation.match(/\d+(\.\d+)?/) ?? [])[0]) : NaN;
  const invLevel = Number.isFinite(userInv) ? userInv : (i.dir === "bear" ? above[0] : below[0]) ?? null;
  const dte = exp ? Math.max(1, Math.round((Date.parse(exp) - Date.parse(today)) / 864e5)) : null;
  const d3030 = dte ? new Date(Date.parse(today) + Math.round(dte * 0.3) * 864e5).toISOString().slice(0, 10) : null;
  const debit = per;
  const mech = debit != null && d3030 ? `30/30：${d3030} 前未按预期走，或价差价值跌到 $${r2(debit * 0.7)}（−30%）→ 离场；最大亏损 $${debit}/张` : null;
  S.push({ n: 4, title: "两个止损", status: invLevel != null && mech ? (Number.isFinite(userInv) ? "ok" : "warn") : "missing", lines: [
    `- 机械止损：${mech ?? "缺少价格或到期日 → 无法计算"}`,
    `- 论点失效价位：${invLevel != null ? `${i.sym} 收盘${i.dir === "bear" ? "站上" : "跌破"} ${r2(invLevel)}${Number.isFinite(userInv) ? "（你给的）" : "（建议：最近" + (i.dir === "bear" ? "上方阻力" : "下方支撑") + "，需你确认）"}` : "缺少价位数据"}`,
    `- 规则：${STOP_RULE}`] });

  // 5) TP
  const tp = exp ? buildTakeProfit(dte != null && dte <= 14 ? "short_dated" : "narrative", [exp], today) : null;
  S.push({ n: 5, title: "分批止盈", status: tp?.plan ? "ok" : "missing", lines: tp?.plan ? [`- ${renderTakeProfit(tp.plan)}`, "- 暴利（短时间 +80% 以上）：先止盈 ≥90%，Runner ≤10%（windfall）"] : ["- 缺少到期日 → 无法给出"] });

  // 6) max loss vs budget
  const s6: string[] = [`- ${capLabel(cap)}；今日已用 $${budget.used}，日内剩余 $${budget.remaining}；今日已开新风险 $${budget.newRisk}${i.reservedUsd ? `（含待开仓卡预留 $${r2(i.reservedUsd)}）` : ""}，新风险剩余 $${budget.newRiskRemaining}（日上限 ${dailyRiskCapPct(i.now, equity)}% = $${dayCapUsd(equity, i.now)}）→ 本笔最多 $${r2(allowed)}`];
  let st6: Status = "ok";
  if (!legs.length) { st6 = "fail"; s6.push(exp ? `- 🛑 在 $${r2(allowed)} 内找不到 ${exp} 的定义风险价差（或无报价）→ 不可能按规则做` : "- 缺少到期日 --exp"); failing.push("最大亏损：无可行结构"); }
  else if (per == null) { st6 = naked ? "fail" : "missing"; s6.push(`- 结构 ${legStr(legs)}：${naked ? "风险无限" : "缺少报价 → 最大亏损未知"}`); if (!naked) failing.push("最大亏损：缺报价"); }
  else {
    s6.push(`- 结构：${legStr(legs)}${suggested ? "（Alpha 建议）" : ""} · 每张最大亏损 $${per}`);
    if (contracts >= 1) s6.push(`- ✅ 可做 ${contracts} 张，合计最大亏损 $${r2(per * contracts)}`);
    else {
      st6 = "fail"; failing.push(`最大亏损 $${per}/张 > 可用 $${r2(allowed)}`);
      s6.push(`- 🛑 1 张就超限（$${per} > $${r2(allowed)}）`);
      if (sugg.length) s6.push(`- 符合上限的替代：${sugg.map((x) => `${legStr(x.legs)} = $${x.loss}/张 ×${x.contracts}`).join("；")}`);
      else s6.push("- 同到期日内没有符合上限的价差 → 这笔按 Alpha 规则不可能做");
    }
    const lg = legs.find((l) => l.qty > 0);
    const otm = i.spot != null && lg ? (i.dir === "bear" ? i.spot - lg.strike : lg.strike - i.spot) / i.spot * 100 : null;
    if (otm != null && otm > 3 && dte != null && dte <= 10) { s6.push(`- ⚠️ 买入腿价外 ${otm.toFixed(1)}%、只剩 ${dte} 天：需要大幅快速波动（过去教训 strikes_too_far_otm：短期顺势单买入腿要靠近平值）`); if (st6 === "ok") st6 = "warn"; }
  }
  if (!legs.length && exp && i.spot != null) {
    const all = suggestVerticals(i.dir, i.spot, exp, i.quotes, 0), d0 = all.length ? Math.abs(all[0]!.legs[0]!.strike - i.spot) : 0;
    const atm = all.filter((x) => Math.abs(x.legs[0]!.strike - i.spot!) === d0).sort((a, b) => a.loss - b.loss)[0];
    if (atm) s6.push(`- 参考：最接近平值的价差 ${legStr(atm.legs)} = $${atm.loss}/张 > $${r2(allowed)}`);
  }
  S.push({ n: 6, title: "最大亏损与仓位", status: st6, lines: s6 });

  // 7) timing aids
  const s7: string[] = [];
  const g = i.gex;
  if (g?.ok) s7.push(`- GEX：${g.net >= 0 ? "正 gamma（压波动）" : "负 gamma（放大波动）"} 净 ${g.net >= 0 ? "+" : "−"}$${Math.abs(g.net / 1e6).toFixed(0)}M/1%；翻转位 ${g.flip?.toFixed(2) ?? "—"}，Call 墙 ${g.callWall ?? "—"}，Put 墙 ${g.putWall ?? "—"}，最大痛点 ${g.maxPain ?? "—"}（${g.nextExpiry}）`);
  else s7.push(`- GEX：不可用（${g && !g.ok ? g.error : "未获取"}）`);
  if (L) s7.push(`- 价位：前日 H/L ${L.priorDay ? `${r2(L.priorDay.h)}/${r2(L.priorDay.l)}` : "—"} · 本周 H/L ${L.week ? `${r2(L.week.h)}/${r2(L.week.l)}` : "—"} · MA20/50/200 ${[L.sma.ma20, L.sma.ma50, L.sma.ma200].map((x) => (x == null ? "—" : r2(x))).join("/")}${L.fib ? ` · FIB ${L.fib.levels.map((f) => `${f.ratio}=${r2(f.price)}`).join(" ")}` : ""}`);
  else s7.push("- 价位：缺少日线数据");
  const hmNow = Number(i.now.toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" }).replace(":", ""));
  const evs = exp ? i.calendar.filter((e) => e.date <= exp && (e.date > today || (e.date === today && Number(e.timeEt.replace(":", "")) >= hmNow))) : [];
  const majorEvs = evs.filter((e) => e.tier !== 2), minorEvs = evs.filter((e) => e.tier === 2); // tier-2 (claims etc.) listed, never a warn
  s7.push(`- 到期前事件：${majorEvs.length ? majorEvs.map((e) => `${e.date} ${e.title}`).join("；") : exp ? "无（官方日历）" : "缺少到期日"}`);
  if (minorEvs.length) s7.push(`- 到期前次要数据（只列出，不算风险）：${minorEvs.map((e) => `${e.date.slice(5)} ${e.title.split(" ")[0]}`).join("；")}`);
  // Fed speakers + blackout inside the holding window
  let fedRisk = false;
  if (i.fed === undefined || i.fed === null) s7.push("- 美联储讲话：不可用（没有 data/in/fed-speakers.json，运行 npm run fedspeak）");
  else if (exp) {
    const sp = i.fed.speeches.filter((x) => x.date <= exp && (x.date > today || (x.date === today && (x.timeEt == null || Number(x.timeEt.replace(":", "")) >= hmNow))));
    s7.push(`- 美联储讲话（到期前）：${sp.length ? sp.map((x) => `${x.date} ${x.timeEt ?? "?"} ${x.role === "Board" ? "" : `${x.role} `}${x.speaker}${x.voter ? "（票委）" : ""}：${x.topic || "主题未公布"}${x.sourceKind === "secondary" ? "［二手］" : ""}${x.suspicious ? " ⚠️静默期内，可疑" : ""}`).join("；") : "无"}；${i.fed.coverage?.length ? `覆盖 理事会+12 家地区联储（不可用：${i.fed.coverage.filter((c) => c.official.startsWith("unavailable") && !c.secondary.startsWith("ok")).map((c) => c.bank).join("、") || "无"}）` : "地区联储主席未覆盖"}`);
    const bl = i.fed.blackouts.filter((b) => b.to > today && b.from <= exp);
    for (const b of bl) s7.push(`- 🔇 FOMC 静默期 ${b.from}～${b.to}（不含）${inBlackout(today, [b]) ? "：现在就在静默期" : ""}`);
    fedRisk = sp.some((x) => x.voter);
  }
  // earnings: risk item when inside expiry
  let erRisk = false;
  const en = i.earningsNext;
  if (en === undefined) s7.push(`- 财报：❔ 未知（${i.sym} 没查过；运行 routine 刷新 data/in/earnings-by-symbol.json）`);
  else if (en === null) s7.push("- 财报：Robinhood 未返回即将到来的财报");
  else { erRisk = !!exp && en.date <= exp; s7.push(`- 财报：${fmtEarnings(en)}${erRisk ? " 🛑 **在到期前 → 财报事件风险（IV crush / 跳空）**" : "（不在到期前）"}`); }
  S.push({ n: 7, title: "时机参考（只看节奏，不定方向）", status: majorEvs.some((e) => e.kind !== "OPEX") || erRisk || fedRisk ? "warn" : en === undefined ? "missing" : "ok", lines: s7 });
  const riskItems: string[] = [];
  if (erRisk && en) riskItems.push(`⚠️ 财报 ${fmtEarnings(en)} 在到期前：持仓会穿过财报（跳空 + IV crush），要么到期选在财报前，要么明确这是财报单`);
  if (fedRisk) riskItems.push("⚠️ 到期前有票委讲话：可能改变利率预期");

  // 8) devil's advocate + past mistakes
  let cr: Critique | null = null;
  if (legs.length && per != null && sp != null && exp) {
    try {
      cr = critique({ proposal: { symbol: i.sym, strategy: i.structure ?? "vertical", asOf: today, underlyingPrice: sp, thesisHorizonDays: Math.max(1, Math.round((dte ?? 7) * 0.6)), capital: i.capital, buyingPower: i.capital,
        legs: legs.map((l) => ({ type: l.type, strike: l.strike, qty: l.qty * Math.max(1, contracts), premium: l.mid!, expiration: l.expiration, bid: l.bid, ask: l.ask })) } as never,
        side, thesis: i.thesis ?? "", invalidation: invLevel != null ? String(r2(invLevel)) : "", stop: mech ?? "", motive: "thesis", leader: (i.brief?.leader ?? null) as never, verdict: i.brief?.verdict ?? null, verdictReasons: i.brief?.reasons ?? [],
        open: openPaper({ capital: i.capital, entries: i.journal.filter((e) => e.source !== "mentor_shadow") }), history: i.journal, bars: i.bars, calendar: i.calendar, now: i.now, capital: i.capital });
    } catch { cr = null; }
  }
  const pm = pastMistakes(i.journal, i.sym);
  const s8 = cr ? cr.objections.map((o) => `- ${o.severity === "BLOCK" ? "🛑" : "⚠️"} ${o.text}`) : ["- 无法运行唱反调（缺结构/价格）"];
  if (!i.thesis) s8.unshift("- ❔ 你还没写论点（--thesis \"因为…所以…\"）");
  s8.push(...riskItems.map((x) => `- ${x}`));
  if (pm.tags.length && !cr) s8.push(`- 重复错误：${pm.tags.map(([t, n]) => `${t}×${n}`).join("、")}`);
  S.push({ n: 8, title: "反方意见 + 过去的错误", status: cr?.blocks ? "fail" : (cr?.warns || !i.thesis || riskItems.length) ? "warn" : cr ? "ok" : "missing", lines: s8 });
  if (cr?.blocks) failing.push(...cr.objections.filter((o) => o.severity === "BLOCK").map((o) => `唱反调 ${o.id}`));

  // 9) 做空清单 (bearish only; warn-only — never changes the verdict)
  const shortChk = i.dir === "bear" ? shortEntryChecks({ sym: i.sym, bars: i.bars, spot: i.spot, expirations: exp ? [exp] : [], asOf: today, invalidationLevel: invLevel, netGamma: g?.ok ? g.net : null, ...(i.short ?? {}) }) : null;
  if (shortChk) S.push({ n: 9, title: "做空清单（大佬 做空学，只提示）", status: shortChk.tags.length ? "warn" : "ok", lines: renderShortSection(shortChk) });

  // practice philosophy (2026-10-15): only the written plan is hard; everything else is a recorded warning
  const planMissing = [...(!i.thesis?.trim() ? ["论点"] : []), ...(mech == null && invLevel == null && !i.invalidation?.trim() ? ["止损（机械或论点失效）"] : []), ...(!tp?.plan ? ["止盈计划"] : []), ...(naked ? ["定义风险（裸卖）"] : [])];
  const otmWarn = S.find((s) => s.n === 6)?.lines.some((l) => /价外/.test(l));
  const warnTags = [...new Set([...failing.map((f) => /最大亏损 \$|超限/.test(f) ? "warn_over_cap" : /无可行结构|缺报价/.test(f) ? "warn_no_fit" : /对冲/.test(f) ? "warn_no_hedge" : /^唱反调 (\w+)/.test(f) ? `warn_${/^唱反调 (\w+)/.exec(f)![1]!.toLowerCase()}` : "warn_other"),
    ...(!match ? ["warn_off_plan"] : []), ...(match && !inZone ? ["warn_out_of_zone"] : []), ...(otmWarn ? ["warn_far_otm"] : []), ...(shortChk?.tags ?? [])])];
  const formal = failing.length === 0 && !!match && !!inZone && hedge === "ok" && S.every((s) => s.status !== "missing");
  // 10) 情景推演 (display only): P&L at expiry + mid-point under 大跌/慢跌/横盘/上涨, one hedge suggestion within the cap
  let scenarioPlan: ScenarioPlan | null = null;
  if (legs.length && exp && i.spot != null && legs.every((l) => l.mid != null)) {
    const q = Math.max(1, contracts), el: ELeg[] = legs.map((l) => ({ type: l.type, strike: l.strike, qty: l.qty * q, premium: l.mid!, expiration: l.expiration }));
    const inp = { legs: el, spot: i.spot, asOf: i.now.toISOString(), iv: null, atr: atr14(i.bars), levels: keyLevels(i.sym, i.spot, i.bars as unknown as Bar[], i.mentorAll ?? (i.mentorLevels ? [i.mentorLevels] : [])), capUsd: r2(allowed), label: `${i.sym} ×${q}` };
    scenarioPlan = planFromResult(runScenarios(inp), i.now.toISOString(), "card");
    S.push({ n: 10, title: "情景推演（先列情景，再看每个情景怎么处理；只显示）", status: "ok", lines: renderScenariosWithMenu(inp, i.optionQuotes ?? [], i.sym) });
  } else S.push({ n: 10, title: "情景推演", status: "missing", lines: ["- 结构没有完整报价 → 无法推演；开仓前要自己写下大跌/慢跌/横盘/上涨各自怎么做（paper open --scenarios）"] });
  const verdict: Card["verdict"] = planMissing.length ? "no" : formal ? "formal" : failing.length || otmWarn ? "practice_warn" : "practice";
  const verdictText = verdict === "no" ? "🛑 不做（练习也不行：计划没写全）" : verdict === "formal" ? "✅ 可做（正式）" : verdict === "practice_warn" ? "🟢 可练习（有提示）" : "🟡 仅练习";
  if (verdict === "no") failing.unshift(...planMissing.map((m) => `计划缺：${m}`));
  return { id, createdAt: i.now.toISOString(), sym: i.sym, dir: i.dir, verdict, verdictText, failing, warnTags: verdict === "formal" ? [] : warnTags, planMissing, sections: S,
    ...(shortChk ? { shortTags: shortChk.tags, shortManual: shortChk.manual } : {}),
    ...(() => { const fresh = i.brief && i.now.getTime() - Date.parse(i.brief.generatedAt) < 24 * 3600_000;
      const m = [...liquidityThemeLines(i.thesis), ...oilSqueezeLines(i.sym, i.thesis, fresh ? i.brief!.oilVix : null), ...deadCatCardLines(i.sym, i.dir, i.thesis, fresh ? i.brief!.deadCat : null), ...mentorLevelCardLines(i.sym, i.dir, i.thesis, i.mentorLevels, fresh ? i.brief!.deadCat?.mentorLevels : null), ...stockProtectionLines(i.dir, i.structure, i.shares, i.marketPhase)]; return m.length ? { macroTheme: m } : {}; })(),
    confidence: { tier: cap.tier, pct: cap.pct, capUsd: cap.usd, equity: cap.equity, downgraded: cap.downgraded }, scenarioPlan,
    trade: { legs, exp, contracts, perContractMaxLoss: per, maxLoss: per != null ? r2(per * contracts) : null, planId: match?.id ?? null, tpKind: tp?.plan?.kind ?? null, invalidationLevel: invLevel != null ? r2(invLevel) : null, mechanical: mech } };
}
export function renderCard(c: Card, spot: number | null, exp: string | null): string {
  return [`# 入场前计划卡：${c.sym} ${c.dir === "bear" ? "看空" : "看多"}${exp ? ` · 到期 ${exp}` : ""}`, "",
    `**结论：${c.verdictText}**${c.failing.length ? ` — ${c.verdict === "no" ? "不通过" : "正式单不通过 / 练习提示"}：${c.failing.join("；")}` : ""}`,
    ...(c.verdict !== "formal" && c.warnTags?.length ? [`- 练习提示标签（开仓后记录在交易上，用于门槛校准）：${c.warnTags.join("、")}`] : []),
    ...(() => { const t = [...(c.verdict !== "formal" ? c.warnTags ?? [] : []), ...(c.shortTags ?? [])]; return t.length ? ["", "**导师怎么说（每个提示对应的原文，只提醒）：**", ...mentorForTags(t, new Date(c.createdAt))] : []; })(),
    ...(c.macroTheme?.length ? ["", "**导师怎么说（宏观论点 / 原油冲击，只提醒）：**", ...c.macroTheme] : []), "",
    `- 卡片 id：\`${c.id}\` · 现价 ${spot ?? "未知"} · ${new Date(c.createdAt).toLocaleString("zh-CN", { timeZone: "America/New_York", hour12: false })} ET`, "",
    ...c.sections.flatMap((s) => [`## ${s.n}. ${ICON[s.status]} ${s.title}`, ...s.lines, ""]),
    "_只做定义风险；NO_TRADE 是合法结果。数据缺失处已标注，未做任何填补。_"].join("\n");
}
