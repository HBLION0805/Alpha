/**
 * Paper trading (PROGRESS.md phase "paper trading"): simulated entries on real data, journaled for the
 * live-readiness scorecard (readiness.ts). Nothing here can place, preview or cancel a real order.
 */
import { preTradeChecks, type Proposal, type PreCheck } from "./pretrade.ts";
import { checkPlanLink } from "./planlink.ts";
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
export interface OpenArgs { kind?: "formal" | "practice"; hedge?: string; hedgeDetail?: string; stopPct?: number; critique?: Critique; ack?: boolean; thesis?: string; invalidation?: string; stop?: string; motive?: Motive; timeStopAt?: string; tp?: string; cardId?: string; card?: PlanCardRef | null; planId?: string; plan?: import("./planlink.ts").PlanItem[]; side?: "long" | "short"; now: Date; rules?: Partial<RuleCard> }
type Leg = NonNullable<JournalEntry["legs"]>[number];
const MULT = 100;
const mult = (l: Leg) => (l.type === "stock" ? 1 : MULT);
/** open SIMULATED positions; real_practice records (real broker trades logged for review) are never marked or counted toward the position cap */
export const openPaper = (j: PaperJournal) => j.entries.filter((e) => e.mode === "paper" && !e.closedAt && e.source !== "real_practice");
const toLog = (e: JournalEntry): TradeLog => ({ id: e.id, openedAt: e.openedAt, closedAt: e.closedAt, pnl: e.pnl, maxLoss: e.maxLoss });

/** Simulated fill: mid if bid/ask given, else the proposal premium. */
const fill = (l: Proposal["legs"][number]) => (l.bid != null && l.ask != null ? (l.bid + l.ask) / 2 : l.premium);

/** the saved pre-trade plan card (data/journal/pending-cards.json) a practice trade must point to */
export interface PlanCardRef { id: string; sym: string; dir: "bull" | "bear"; thesis?: string | null; invalidation?: string | null; trade?: { mechanical?: string | null; invalidationLevel?: number | null; tpKind?: string | null } }
/** HARD requirements for a practice trade: direction, thesis, a stop (mechanical or invalidation) and a take-profit plan. */
export function cardMissing(c: PlanCardRef | null | undefined): string[] {
  if (!c) return ["练习单必须先保存计划卡：npm run card -- … --thesis \"…\" --save，再 paper open --card <id>"];
  const m: string[] = [];
  if (c.dir !== "bull" && c.dir !== "bear") m.push("计划卡缺方向");
  if (!c.thesis?.trim()) m.push("计划卡缺论点（--thesis \"因为…所以…\"）");
  if (!c.trade?.mechanical && c.trade?.invalidationLevel == null && !c.invalidation?.trim()) m.push("计划卡缺止损（机械止损或论点失效价）");
  if (!c.trade?.tpKind) m.push("计划卡缺止盈计划");
  return m.map((x) => `${x}（${c.id}）`);
}
/** Map a strict-mode refusal to a practice warn tag. */
export function warnTag(msg: string): string {
  const id = /^(?:唱反调 (?:BLOCK )?|BLOCK |NO_TRADE )(\w+)/.exec(msg)?.[1]?.toLowerCase();
  if (id) return /otm|far|strike/.test(id) ? "warn_far_otm" : /trend|confirm/.test(id) ? "warn_trend_unconfirmed" : /concurrent|positions/.test(id) ? "warn_position_cap" : /daily/.test(id) ? "warn_daily_cap"
    : /cap|size|loss/.test(id) ? "warn_over_cap" : /plan/.test(id) ? "warn_off_plan" : /hedge/.test(id) ? "warn_no_hedge" : `warn_${id}`;
  if (/计划|plan|进场区间|方向 .* ≠|标的 .* ≠/i.test(msg)) return "warn_off_plan";
  if (/hedge|对冲/i.test(msg)) return "warn_no_hedge";
  if (/硬上限|cap|上限|1%|exceeds/i.test(msg) && !/持仓|concurrent|positions/i.test(msg)) return "warn_over_cap";
  if (/concurrent|持仓数|positions|同时持仓/i.test(msg)) return "warn_position_cap";
  if (/日亏|daily/i.test(msg)) return "warn_daily_cap";
  if (/OTM|价外|far/i.test(msg)) return "warn_far_otm";
  if (/趋势|trend|确认|confirm/i.test(msg)) return "warn_trend_unconfirmed";
  const m = /唱反调 (?:BLOCK )?(\w+)|^(?:BLOCK|NO_TRADE) (\w+)/.exec(msg);
  if (m) return `warn_${(m[1] ?? m[2])!.toLowerCase()}`;
  if (/唱反调有 \d+ 条 WARN/.test(msg)) return "warn_critique";
  return "warn_other";
}

export function paperOpen(j: PaperJournal, p: Proposal, a0: OpenArgs): { entry: JournalEntry | null; checks: PreCheck[]; refused: string[] } {
  const refused: string[] = [];
  let a = a0;
  if (a.kind === "practice" && a.card) { // practice: the plan card supplies anything not given on the command line
    const c = a.card, lvl = c.trade?.invalidationLevel;
    a = { ...a, cardId: a.cardId ?? c.id, thesis: a.thesis || c.thesis || undefined, invalidation: a.invalidation || c.invalidation || (lvl != null ? `收盘${c.dir === "bear" ? "站上" : "跌破"} ${lvl}` : undefined),
      stop: a.stop || c.trade?.mechanical || (lvl != null ? `论点失效 ${lvl}` : undefined), motive: a.motive ?? "thesis", tp: a.tp ?? c.trade?.tpKind ?? undefined, side: a.side ?? (c.dir === "bear" ? "short" : "long") };
  }
  for (const k of ["thesis", "invalidation", "stop", "motive"] as const) if (!a[k]?.toString().trim()) refused.push(`缺少 --${k}（开仓前必须写下 thesis / invalidation / stop / motive）`);
  if (a.kind && a.kind !== "formal" && a.kind !== "practice") refused.push(`--kind ${a.kind} 无效：formal | practice`);
  // mandatory risk plan (riskplan.ts): hedge, invalidation, stock −7% stop / option max loss + 30/30, ≤1% hard cap
  let rp = buildRiskPlan(p.legs.map((l) => ({ type: l.type, strike: l.strike, qty: l.qty, premium: fill(l), expiration: l.expiration })),
    { hedge: a.hedge, hedgeDetail: a.hedgeDetail, invalidation: a.invalidation, stopPct: a.stopPct, capital: j.capital, asOf: a.now.toISOString().slice(0, 10), rules: a.rules });
  refused.push(...rp.errors);
  const tp = buildTakeProfit(a.tp, p.legs.map((l) => l.expiration), a.now.toISOString().slice(0, 10));
  refused.push(...tp.errors);
  const spot0 = typeof p.underlyingPrice === "number" ? p.underlyingPrice : p.underlyingPrice[p.symbol] ?? null;
  const etDay = a.now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  refused.push(...checkPlanLink({ kind: a.kind ?? "formal", planId: a.planId, plan: a.plan ?? [], symbol: p.symbol, side: a.side ?? p.discipline?.side ?? "long", spot: spot0, todayEt: etDay }));
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
  // practice: only the saved plan card is HARD; everything else becomes a recorded warn tag
  let warnTags: string[] = [], warnDetails: string[] = [];
  if (a.kind === "practice") {
    const hard = [...cardMissing(a.card), ...(a.card && a.card.sym.toUpperCase() !== p.symbol.toUpperCase() ? [`计划卡标的 ${a.card.sym} ≠ ${p.symbol}`] : []),
      ...refused.filter((x) => /最大亏损未定义|maxLoss|--kind .* 无效/.test(x))];
    if (hard.length) return { entry: null, checks, refused: hard };
    warnDetails = refused.filter((x) => !/^缺少 --(thesis|invalidation|stop|motive|tp)|缺少止盈|--tp/.test(x));
    warnTags = [...new Set(warnDetails.map(warnTag))];
    if (!rp.plan) { const r2 = buildRiskPlan(p.legs.map((l) => ({ type: l.type, strike: l.strike, qty: l.qty, premium: fill(l), expiration: l.expiration })),
      { hedge: p.legs.some((l) => l.type !== "stock" && l.qty < 0) ? "built_in_spread" : "direct", hedgeDetail: a.hedgeDetail || "练习单：未写对冲", invalidation: a.invalidation, stopPct: a.stopPct ?? 7, capital: j.capital, asOf: a.now.toISOString().slice(0, 10), rules: a.rules }); rp = { ...r2, plan: r2.draft ?? null }; }
    if (!rp.plan || !tp.plan) return { entry: null, checks, refused: [...(rp.plan ? [] : ["无法建立风险计划（最大亏损未定义？）"]), ...(tp.plan ? [] : tp.errors)] };
    refused.length = 0;
  } else if (refused.length || blocked) return { entry: null, checks, refused };
  const legs: Leg[] = p.legs.map((l) => ({ underlying: l.underlying ?? p.symbol, type: l.type, strike: l.strike, qty: l.qty, premium: Number(fill(l).toFixed(4)), expiration: l.expiration, iv: l.iv }));
  const an = analyze(legs as never);
  const now = a.now.toISOString();
  const spot = typeof p.underlyingPrice === "number" ? p.underlyingPrice : p.underlyingPrice[p.symbol];
  const entry: JournalEntry = {
    id: `P${String(j.entries.length + 1).padStart(3, "0")}`, mode: "paper", openedAt: now, symbol: p.symbol, strategy: p.strategy,
    thesis: a.thesis, stop: a.stop, invalidation: a.invalidation!, thesisRecordedAt: now, stopRecordedAt: now, motive: a.motive, timeStopAt: a.timeStopAt,
    view: { direction: a.thesis!, volatility: "n/a (paper)" }, ivRank: null, greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 }, expectedMove: null,
    structureRationale: p.strategy, maxLoss: rp.plan!.maxLoss, kind: a.kind ?? "formal", riskPlan: rp.plan!, exitRules: [`stop: ${a.stop}`, `invalidation: ${a.invalidation}`, ...(rp.plan!.stock ? [`mechanical stop ${rp.plan!.stock.stopPrice} (−${rp.plan!.stock.stopPct}%)`] : []), ...(rp.plan!.option ? [`30/30: ${rp.plan!.option.rule3030Date} or value ≤ $${rp.plan!.option.loss30Value}`] : []), rp.plan!.rule, renderTakeProfit(tp.plan!), ...(a.timeStopAt ? [`time stop: ${a.timeStopAt}`] : [])],
    takeProfit: tp.plan!, tpHits: [], ...(a.planId ? { planId: a.planId } : {}), ...(a.cardId ? { cardId: a.cardId } : {}), capitalAtEntry: j.capital, concurrentAtEntry: open.length + 1, legs, underlyingAtEntry: spot, marks: [],
    critique: a.critique ? { ...a.critique, acked: a.critique.warns > 0 } : undefined,
    ...(warnTags.length ? { warnTags, warnDetails, violations: warnTags.includes("warn_over_cap") ? ["exceeds_1pct_cap"] : [] } : {}),
  };
  return { entry, checks, refused };
}

export interface PriceSource { spot(sym: string): Promise<number | null>; chains: Chain[] }
/** Robinhood-chain mark (mark, else mid) when the contract is in a saved chain; otherwise Black-Scholes on the
 *  Yahoo spot with the IV implied by the entry fill. Each leg reports its source. */
export async function paperMark(e: JournalEntry, src: PriceSource, now: Date): Promise<NonNullable<JournalEntry["marks"]>[number]> {
  const asOf = now.toISOString().slice(0, 10);
  if ((e.legs ?? []).some((l) => l.premium == null)) throw new Error("entry price unknown (backfill from broker orders first)");
  let value = 0, spot0: number | null = null, estimated = false; const sources: string[] = [];
  for (const l of e.legs ?? []) {
    const u = l.underlying ?? e.symbol;
    const S = await src.spot(u); if (u === e.symbol) spot0 = S;
    if (l.type === "stock") { if (S == null) throw new Error(`no spot for ${u}`); value += l.qty * S; sources.push(`${u} stock yahoo`); continue; }
    const c = src.chains.find((ch) => ch.symbol === u)?.contracts.find((k) => k.type === l.type && k.strike === l.strike && k.expiration === l.expiration);
    const rh = c ? c.mark ?? (c.bid != null && c.ask != null ? (c.bid + c.ask) / 2 : null) : null;
    if (rh != null) { value += l.qty * rh * MULT; sources.push(`${u} ${l.strike}${l.type[0]} robinhood ${rh}`); continue; }
    if (S == null || !l.expiration) throw new Error(`no price for ${u} ${l.strike}${l.type[0]}`);
    const T = Math.max(yearFrac(asOf, l.expiration), 0);
    const ivSrc = legIv(e, l, c?.iv ?? null, S);
    const px = T > 0 ? bs({ S, K: l.strike, T, sigma: ivSrc.iv, right: l.type }).price : Math.max(0, l.type === "call" ? S - l.strike : l.strike - S);
    estimated = true;
    value += l.qty * px * MULT; sources.push(`${u} ${l.strike}${l.type[0]} BS估算(yahoo spot ${S}, iv ${ivSrc.iv.toFixed(3)} ${ivSrc.from}) ${px.toFixed(2)}`);
  }
  const cost = (e.legs ?? []).reduce((s, l) => s + l.qty * l.premium * mult(l), 0);
  return { at: now.toISOString(), value: Math.round(value * 100) / 100, pnl: Math.round((value - cost) * 100) / 100, spot: spot0, sources, estimated };
}

/** Sane per-leg IV for the Black-Scholes fallback: quote IV → leg IV → IV implied by a real (≥$0.05) entry premium → 30%.
 *  Always clamped to [10%, 200%]. Never solve IV from a 0/placeholder premium (that produced 3–7% IVs → overstated P&L). */
export const IV_MIN = 0.10, IV_MAX = 2.0, IV_DEFAULT = 0.30;
export function legIv(e: JournalEntry, l: Leg, quoteIv: number | null, S: number): { iv: number; from: string } {
  const clamp = (x: number) => Math.min(IV_MAX, Math.max(IV_MIN, x));
  if (quoteIv != null && quoteIv > 0) return { iv: clamp(quoteIv), from: "quote" };
  if (l.iv != null && l.iv > 0) return { iv: clamp(l.iv), from: "leg" };
  if (l.premium >= 0.05 && l.expiration) {
    const T0 = Math.max(yearFrac(e.openedAt.slice(0, 10), l.expiration), 1 / 365);
    const v = impliedVol(l.premium, { S: e.underlyingAtEntry ?? S, K: l.strike, T: T0, right: l.type as "call" | "put" });
    if (v != null && v >= IV_MIN && v <= IV_MAX) return { iv: v, from: "entry-implied" };
  }
  return { iv: IV_DEFAULT, from: "default" };
}
/** data/in/rh-option-quotes.json (read-only Robinhood get_option_quotes joined to strikes) → chains for paperMark. */
export function chainsFromQuotes(f: { fetchedAt: string; quotes: Array<{ underlying: string; type: "call" | "put"; strike: number; expiration: string; mark: number | null; bid: number | null; ask: number | null; iv: number | null }> }): Chain[] {
  const by = new Map<string, Chain>();
  for (const q of f.quotes) {
    const ch = by.get(q.underlying) ?? { symbol: q.underlying, underlyingPrice: NaN, asOf: f.fetchedAt, contracts: [], source: "robinhood quotes" };
    ch.contracts.push({ expiration: q.expiration, strike: q.strike, type: q.type, bid: q.bid, ask: q.ask, mark: q.mark, iv: q.iv, delta: null, gamma: null, theta: null, vega: null });
    by.set(q.underlying, ch);
  }
  return [...by.values()];
}

/** one mark per trade per ET day: a later run the same day replaces that day's mark */
export function upsertMark(e: JournalEntry, m: NonNullable<JournalEntry["marks"]>[number]): void {
  const d = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  e.marks ??= [];
  const i = e.marks.findIndex((x) => d(x.at) === d(m.at));
  if (i >= 0) e.marks.splice(i, 1);
  e.marks.push(m); e.marks.sort((a, b) => a.at.localeCompare(b.at));
}

export interface CloseArgs { exitKind?: JournalEntry["exitKind"]; pnl?: number; commissions?: number; errorClass?: "judgment" | "execution"; errorTags?: string[]; violations?: string[]; lesson?: string; now: Date }
const KINDS = ["invalidation", "time_stop", "take_profit", "max_loss", "discretionary", "expiry", "weekend_rule"];
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
