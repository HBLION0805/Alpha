/**
 * Paper trading (PROGRESS.md phase "paper trading"): simulated entries on real data, journaled for the
 * live-readiness scorecard (readiness.ts). Nothing here can place, preview or cancel a real order.
 */
import { preTradeChecks, type Proposal, type PreCheck } from "./pretrade.ts";
import { buildTakeProfit, renderTakeProfit } from "./tpplan.ts";
import { effectiveRules, type RuleCard } from "./rules.ts";
import { analyze } from "./payoff.ts";
import { bs, impliedVol, yearFrac } from "./bs.ts";
import type { JournalEntry } from "./journal.ts";
import type { Motive, TradeLog } from "./discipline.ts";
import type { Chain } from "./chain.ts";
import { buildRiskPlan } from "./riskplan.ts";
import type { Critique } from "../review/critique.ts";

export interface PaperJournal { capital: number; entries: JournalEntry[] }
export interface OpenArgs { kind?: "formal" | "practice"; hedge?: string; hedgeDetail?: string; stopPct?: number; critique?: Critique; ack?: boolean; thesis?: string; invalidation?: string; stop?: string; motive?: Motive; timeStopAt?: string; tp?: string; now: Date; rules?: Partial<RuleCard> }
type Leg = NonNullable<JournalEntry["legs"]>[number];
const MULT = 100;
const mult = (l: Leg) => (l.type === "stock" ? 1 : MULT);
/** open SIMULATED positions; real_practice records (real broker trades logged for review) are never marked or counted toward the position cap */
export const openPaper = (j: PaperJournal) => j.entries.filter((e) => e.mode === "paper" && !e.closedAt && e.source !== "real_practice");
const toLog = (e: JournalEntry): TradeLog => ({ id: e.id, openedAt: e.openedAt, closedAt: e.closedAt, pnl: e.pnl, maxLoss: e.maxLoss });

/** Simulated fill: mid if bid/ask given, else the proposal premium. */
const fill = (l: Proposal["legs"][number]) => (l.bid != null && l.ask != null ? (l.bid + l.ask) / 2 : l.premium);

export function paperOpen(j: PaperJournal, p: Proposal, a: OpenArgs): { entry: JournalEntry | null; checks: PreCheck[]; refused: string[] } {
  const refused: string[] = [];
  for (const k of ["thesis", "invalidation", "stop", "motive"] as const) if (!a[k]?.toString().trim()) refused.push(`缺少 --${k}（开仓前必须写下 thesis / invalidation / stop / motive）`);
  if (a.kind && a.kind !== "formal" && a.kind !== "practice") refused.push(`--kind ${a.kind} 无效：formal | practice`);
  // mandatory risk plan (riskplan.ts): hedge, invalidation, stock −7% stop / option max loss + 30/30, ≤1% hard cap
  const rp = buildRiskPlan(p.legs.map((l) => ({ type: l.type, strike: l.strike, qty: l.qty, premium: fill(l), expiration: l.expiration })),
    { hedge: a.hedge, hedgeDetail: a.hedgeDetail, invalidation: a.invalidation, stopPct: a.stopPct, capital: j.capital, asOf: a.now.toISOString().slice(0, 10), rules: a.rules });
  refused.push(...rp.errors);
  const tp = buildTakeProfit(a.tp, p.legs.map((l) => l.expiration), a.now.toISOString().slice(0, 10));
  refused.push(...tp.errors);
  // 唱反调: BLOCK refuses; WARNs need an explicit --ack
  if (!a.critique) refused.push("缺少唱反调 critique（src/review/critique.ts）");
  else {
    for (const o of a.critique.objections.filter((o) => o.severity === "BLOCK")) refused.push(`唱反调 BLOCK ${o.id}: ${o.text}`);
    if (a.critique.warns && !a.ack) refused.push(`唱反调有 ${a.critique.warns} 条 WARN → 逐条想过后加 --ack 继续`);
  }
  const R = effectiveRules(a.rules);
  const open = openPaper(j);
  const asOf = a.now.toISOString().slice(0, 10);
  const prop: Proposal = { ...p, asOf: p.asOf ?? asOf, capital: j.capital,
    thesisRecord: { thesis: a.thesis ?? "", invalidation: a.invalidation ?? "", recordedAt: a.now.toISOString() },
    discipline: { ...(p.discipline ?? {}), motive: a.motive, openPositions: open.length, journal: j.entries.filter((e) => e.mode === "paper").map(toLog), todayEt: asOf,
      openPnlToday: p.discipline?.openPnlToday ?? open.reduce((s, e) => s + (e.marks?.at(-1)?.pnl ?? 0), 0) } };
  const { checks, blocked } = preTradeChecks(prop, R);
  for (const c of checks) if (c.severity === "BLOCK" || c.severity === "NO_TRADE") refused.push(`${c.severity} ${c.id}: ${c.detail}`);
  if (refused.length || blocked) return { entry: null, checks, refused };
  const legs: Leg[] = p.legs.map((l) => ({ underlying: l.underlying ?? p.symbol, type: l.type, strike: l.strike, qty: l.qty, premium: Number(fill(l).toFixed(4)), expiration: l.expiration, iv: l.iv }));
  const an = analyze(legs as never);
  const now = a.now.toISOString();
  const spot = typeof p.underlyingPrice === "number" ? p.underlyingPrice : p.underlyingPrice[p.symbol];
  const entry: JournalEntry = {
    id: `P${String(j.entries.length + 1).padStart(3, "0")}`, mode: "paper", openedAt: now, symbol: p.symbol, strategy: p.strategy,
    thesis: a.thesis, stop: a.stop, invalidation: a.invalidation!, thesisRecordedAt: now, stopRecordedAt: now, motive: a.motive, timeStopAt: a.timeStopAt,
    view: { direction: a.thesis!, volatility: "n/a (paper)" }, ivRank: null, greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 }, expectedMove: null,
    structureRationale: p.strategy, maxLoss: rp.plan!.maxLoss, kind: a.kind ?? "formal", riskPlan: rp.plan!, exitRules: [`stop: ${a.stop}`, `invalidation: ${a.invalidation}`, ...(rp.plan!.stock ? [`mechanical stop ${rp.plan!.stock.stopPrice} (−${rp.plan!.stock.stopPct}%)`] : []), ...(rp.plan!.option ? [`30/30: ${rp.plan!.option.rule3030Date} or value ≤ $${rp.plan!.option.loss30Value}`] : []), rp.plan!.rule, renderTakeProfit(tp.plan!), ...(a.timeStopAt ? [`time stop: ${a.timeStopAt}`] : [])],
    takeProfit: tp.plan!, tpHits: [], capitalAtEntry: j.capital, concurrentAtEntry: open.length + 1, legs, underlyingAtEntry: spot, marks: [],
    critique: a.critique ? { ...a.critique, acked: a.critique.warns > 0 } : undefined,
  };
  return { entry, checks, refused };
}

export interface PriceSource { spot(sym: string): Promise<number | null>; chains: Chain[] }
/** Robinhood-chain mark (mark, else mid) when the contract is in a saved chain; otherwise Black-Scholes on the
 *  Yahoo spot with the IV implied by the entry fill. Each leg reports its source. */
export async function paperMark(e: JournalEntry, src: PriceSource, now: Date): Promise<NonNullable<JournalEntry["marks"]>[number]> {
  const asOf = now.toISOString().slice(0, 10);
  let value = 0, spot0: number | null = null; const sources: string[] = [];
  for (const l of e.legs ?? []) {
    const u = l.underlying ?? e.symbol;
    const S = await src.spot(u); if (u === e.symbol) spot0 = S;
    if (l.type === "stock") { if (S == null) throw new Error(`no spot for ${u}`); value += l.qty * S; sources.push(`${u} stock yahoo`); continue; }
    const c = src.chains.find((ch) => ch.symbol === u)?.contracts.find((k) => k.type === l.type && k.strike === l.strike && k.expiration === l.expiration);
    const rh = c ? c.mark ?? (c.bid != null && c.ask != null ? (c.bid + c.ask) / 2 : null) : null;
    if (rh != null) { value += l.qty * rh * MULT; sources.push(`${u} ${l.strike}${l.type[0]} robinhood ${rh}`); continue; }
    if (S == null || !l.expiration) throw new Error(`no price for ${u} ${l.strike}${l.type[0]}`);
    const T = Math.max(yearFrac(asOf, l.expiration), 0);
    const T0 = Math.max(yearFrac(e.openedAt.slice(0, 10), l.expiration), 1 / 365);
    const iv = l.iv ?? impliedVol(l.premium, { S: e.underlyingAtEntry ?? S, K: l.strike, T: T0, right: l.type }) ?? 0.25;
    const px = T > 0 ? bs({ S, K: l.strike, T, sigma: iv, right: l.type }).price : Math.max(0, l.type === "call" ? S - l.strike : l.strike - S);
    value += l.qty * px * MULT; sources.push(`${u} ${l.strike}${l.type[0]} BS(yahoo spot ${S}, iv ${iv.toFixed(3)}) ${px.toFixed(2)}`);
  }
  const cost = (e.legs ?? []).reduce((s, l) => s + l.qty * l.premium * mult(l), 0);
  return { at: now.toISOString(), value: Math.round(value * 100) / 100, pnl: Math.round((value - cost) * 100) / 100, spot: spot0, sources };
}

export interface CloseArgs { exitKind?: JournalEntry["exitKind"]; pnl?: number; commissions?: number; errorClass?: "judgment" | "execution"; errorTags?: string[]; violations?: string[]; lesson?: string; now: Date }
const KINDS = ["invalidation", "time_stop", "take_profit", "max_loss", "discretionary"];
export function paperClose(e: JournalEntry, a: CloseArgs): { entry: JournalEntry | null; refused: string[] } {
  const refused: string[] = [];
  if (e.closedAt) refused.push(`${e.id} 已平仓`);
  if (!a.exitKind || !KINDS.includes(a.exitKind)) refused.push(`缺少 --exit-kind（${KINDS.join(" | ")}）`);
  const pnl = a.pnl ?? e.marks?.at(-1)?.pnl;
  if (pnl == null) refused.push("缺少 --pnl，且没有可用的 mark（先运行 paper mark）");
  if (pnl != null && pnl <= 0 && (!a.errorClass || !a.errorTags?.length)) refused.push("亏损必须复盘：--error-class judgment|execution 和 --error-tags tag1,tag2");
  if (refused.length) return { entry: null, refused };
  const closed: JournalEntry = { ...e, closedAt: a.now.toISOString(), pnl: pnl!, commissions: a.commissions ?? 0, exitKind: a.exitKind, exitReason: a.exitKind,
    violations: [...(e.violations ?? []), ...(a.violations ?? [])], lesson: a.lesson,
    ...(pnl! <= 0 ? { lossReview: { at: a.now.toISOString(), errorClass: a.errorClass!, errorTags: a.errorTags!, note: a.lesson } } : {}) };
  return { entry: closed, refused };
}
