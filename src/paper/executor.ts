/** Intraday plan executor (item 4) for the Alpaca PAPER account. Pure: clock, broker http and 5-minute bars are injected.
 *  Reads a premarket plan md (盘前计划书 tables), confirms each candidate's trigger on 5m bars after the 09:30–09:45 opening
 *  range, sizes by a fixed $ risk per trade inside the day's remaining cap (riskCap.ts), submits ONE bracket per symbol/side/day
 *  with a deterministic client_order_id, logs fills as formal paper-ledger entries, stops new entries at 15:20 and flattens at 15:45.
 *  Idempotent: the state file + client_order_id lookup mean a rerun every few minutes never double-submits. Dry-run sends only GETs. */
import type { AlpacaHttp, AlpacaOrder, AlpacaPosition, Bar5, BarsFetcher } from "../adapters/alpacaPaper.ts";
import { etMinutes, flatten, hhmm, type FlattenResult } from "./flatten.ts";
import { dailyRiskCapUsd, newRiskOpened } from "../options/riskCap.ts";
import type { JournalEntry } from "../options/journal.ts";

export type Side = "short" | "long";
export interface Candidate { symbol: string; side: Side; group: string; rule: string; premarket: number | null; zone: { low: number; high: number } | null; breakLevel: number | null; orBreak: boolean;
  stop: number | null; stopText: string; target1: number | null; target2: number | null; skip?: string }
export interface PlanParse { date: string | null; candidates: Candidate[] }

export const ENTRY_FROM = "09:45", NO_NEW_FROM = "15:20", FLATTEN_AT = "15:45";
export const RISK_PER_TRADE = { min: 25, max: 100, default: 50 };

const num = (s: string) => Number(s);
/** drop （…）/(…) notes and M/D dates so only price levels remain */
const clean = (s: string) => s.replace(/（[^）]*）|\([^)]*\)/g, " ").replace(/(?<![\d.])\d{1,2}\/\d{1,2}(?![\d.])/g, " ");
const firstNum = (s: string) => { const m = /\d+(?:\.\d+)?/.exec(clean(s)); return m ? num(m[0]) : null; };
const range = (s: string) => { const r = /(\d+(?:\.\d+)?)\s*[-–~]\s*(\d+(?:\.\d+)?)/.exec(s); if (r) { const a = num(r[1]!), b = num(r[2]!); return { low: Math.min(a, b), high: Math.max(a, b) }; }
  const x = /\d+(?:\.\d+)?/.exec(s); return x ? { low: num(x[0]), high: num(x[0]) } : null; };

/** trigger cell → rules. Short: 反弹(至) X[-Y] 失败 = zone; 跌破 X = level; 开盘区间低 = OR break. Long mirror: 回落/回踩 X-Y 守住/企稳; 突破/站上 X; 开盘区间高. */
export function parseTrigger(cell: string, side: Side): Pick<Candidate, "zone" | "breakLevel" | "orBreak"> {
  const out: Pick<Candidate, "zone" | "breakLevel" | "orBreak"> = { zone: null, breakLevel: null, orBreak: false };
  for (const part of clean(cell).split(/[/／]/)) {
    if (side === "short" ? /开盘区间低/.test(part) : /开盘区间高/.test(part)) out.orBreak = true;
    else if (side === "short" ? /(反弹|回升)/.test(part) && /失败/.test(part) : /(回落|回踩|回调)/.test(part) && /(守住|企稳|不破)/.test(part)) out.zone ??= range(part);
    else if (side === "short" ? /跌破/.test(part) : /(突破|站上)/.test(part)) out.breakLevel ??= firstNum(part);
  }
  return out;
}

/** 盘前计划书 md → candidates (rows marked 不建议交易, sections 不做空/仅观察, 无数据 stop or target1, or no readable trigger are kept with `skip`) */
export function parsePlan(md: string): PlanParse {
  const date = /(\d{4}-\d{2}-\d{2})/.exec(md.split("\n").find((l) => l.startsWith("#")) ?? "")?.[1] ?? null;
  const out: Candidate[] = [];
  let group = "", col: Record<string, number> | null = null, side: Side = "short";
  for (const line of md.split("\n")) {
    if (/^#{2,}\s/.test(line)) { group = line.replace(/^#+\s*/, "").trim(); col = null; continue; }
    if (!line.trim().startsWith("|")) { if (line.trim()) col = null; continue; }
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    if (cells.includes("代码")) { const f = (re: RegExp) => cells.findIndex((c) => re.test(c));
      col = { sym: f(/代码/), pre: f(/盘前/), trig: f(/触发/), t1: f(/目标1/), t2: f(/目标2/), stop: f(/止损|失效/), time: f(/时间/) };
      side = /做多/.test(cells[col.trig!] ?? "") ? "long" : "short"; continue; }
    if (!col || col.sym! < 0 || col.trig! < 0 || col.stop! < 0) continue;
    const at = (k: string) => (col![k]! >= 0 ? cells[col![k]!] ?? "" : "");
    const symbol = at("sym").replace(/\*/g, "").trim().toUpperCase(); if (!/^[A-Z.]{1,6}$/.test(symbol)) continue;
    const rule = at("trig"), stopText = at("stop"), t1 = at("t1");
    const c: Candidate = { symbol, side, group, rule, premarket: firstNum(at("pre")), ...parseTrigger(rule, side), stop: /^无数据/.test(stopText) ? null : firstNum(stopText), stopText,
      target1: /^无数据/.test(t1) ? null : firstNum(t1), target2: /^无数据/.test(at("t2")) ? null : firstNum(at("t2")) };
    c.skip = /不建议交易/.test(line) ? "不建议交易" : /不做空|仅观察/.test(group) ? `分组不交易：${group}` : c.stop == null ? "止损无数据" : c.target1 == null ? "目标1无数据"
      : !c.zone && c.breakLevel == null && !c.orBreak ? "无可识别触发规则" : undefined;
    if (!c.skip) delete c.skip;
    out.push(c);
  }
  return { date, candidates: out };
}

export const etDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
export const clientOrderId = (day: string, sym: string, side: Side) => `alpha-${day.replace(/-/g, "")}-${sym.toUpperCase()}-${side}`;

export interface Trigger { at: string; price: number; how: string }
/** Opening range = 5m bars starting 09:30–09:40 ET. Only COMPLETED bars count. Short: first post-OR 5m close < OR low / < 跌破 level,
 *  or rally into the zone (high ≥ zone low, from 09:30 on) then a 5m close back below zone low. A close at/above the stop first = 失效. Long mirrored. */
export function confirmTrigger(c: Candidate, bars: Bar5[], now: Date): { trigger: Trigger | null; or: { high: number; low: number } | null; last: Bar5 | null; invalidated?: string } {
  const day = etDay(now), done = bars.filter((b) => etDay(new Date(b.t)) === day && Date.parse(b.t) + 5 * 60_000 <= now.getTime()).sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  const m = (b: Bar5) => etMinutes(new Date(b.t)), from = hhmm(ENTRY_FROM);
  const orBars = done.filter((b) => m(b) >= 570 && m(b) < from), or = orBars.length ? { high: Math.max(...orBars.map((b) => b.h)), low: Math.min(...orBars.map((b) => b.l)) } : null;
  const sh = c.side === "short", beyond = (x: number, lvl: number) => (sh ? x < lvl : x > lvl), against = (x: number, lvl: number) => (sh ? x >= lvl : x <= lvl);
  const touches = (b: Bar5) => !!c.zone && (sh ? b.h >= c.zone.low : b.l <= c.zone.high);
  let touched = orBars.some(touches);
  for (const b of done.filter((b) => m(b) >= from)) {
    if (c.stop != null && against(b.c, c.stop)) return { trigger: null, or, last: done.at(-1) ?? null, invalidated: `5m 收盘 ${b.c} 越过止损 ${c.stop}` };
    touched ||= touches(b);
    const how = c.orBreak && or && beyond(b.c, sh ? or.low : or.high) ? `5m 收盘${sh ? "跌破开盘区间低" : "突破开盘区间高"} ${sh ? or.low : or.high}`
      : c.breakLevel != null && beyond(b.c, c.breakLevel) ? `5m 收盘${sh ? "跌破" : "突破"} ${c.breakLevel}`
      : c.zone && touched && beyond(b.c, sh ? c.zone.low : c.zone.high) ? `${sh ? "反弹至" : "回落至"} ${c.zone.low}-${c.zone.high} 失败，5m 收盘 ${b.c}` : null;
    if (how) return { trigger: { at: b.t, price: b.c, how }, or, last: done.at(-1) ?? null };
  }
  return { trigger: null, or, last: done.at(-1) ?? null };
}

/** shares = floor(risk / |entry − stop|); risk clamped to $25–$100 */
export function sizePosition(entry: number, stop: number, riskPerTrade: number) {
  const risk = Math.min(RISK_PER_TRADE.max, Math.max(RISK_PER_TRADE.min, riskPerTrade)), perShare = Math.abs(entry - stop);
  const shares = perShare > 0 ? Math.floor(risk / perShare + 1e-9) : 0;
  return { shares, perShare: Math.round(perShare * 100) / 100, riskUsd: Math.round(shares * perShare * 100) / 100, riskPerTrade: risk };
}

export interface OpenedItem { ticker: string; side: Side; shares: number; entry: number; stop: number; target1: number | null; riskUsd: number; orderId: string | null; openedAtET: string; ledgerId: string | null;
  status: string; clientOrderId?: string; trigger?: string; fillPrice?: number; filledQty?: number; filledAt?: string }
export interface IntradayState { date: string; riskCapUsd: number; riskUsedUsd: number; opened: OpenedItem[]; closed: unknown[]; watch: unknown[]; plan?: string; lastRunAt?: string; flattenedAt?: string }
export const emptyState = (date: string, cap: number): IntradayState => ({ date, riskCapUsd: cap, riskUsedUsd: 0, opened: [], closed: [], watch: [] });

export interface ExecAction { symbol?: string; action: "noop" | "skip" | "wait" | "submit" | "exists" | "fill" | "release" | "flatten" | "error"; status?: number | "dry-run"; detail: string }
export interface ExecResult { mode: "dry-run" | "live-paper"; phase: "too_early" | "entry" | "cutoff" | "flatten" | "stale_plan"; day: string; capUsd: number; usedUsd: number; actions: ExecAction[]; state: IntradayState;
  ledgerAdds: JournalEntry[]; flatten?: FlattenResult; persist: boolean }
export interface ExecOpts { http: AlpacaHttp; bars: BarsFetcher; now: Date; plan: PlanParse; planPath?: string; state: IntradayState | null; ledger: JournalEntry[]; equity: number;
  riskPerTrade?: number; entryType?: "limit" | "market"; dryRun: boolean; pause?: (ms: number) => Promise<void> }

const r2 = (x: number) => Math.round(x * 100) / 100;
const etStamp = (d: Date) => d.toLocaleString("sv-SE", { timeZone: "America/New_York" });
const DEAD = ["canceled", "expired", "rejected"];

/** formal paper-ledger entry for an executed (filled) bracket — same shape as the hand-logged 10/30 IWM short */
export function ledgerEntry(o: OpenedItem, c: Pick<Candidate, "rule" | "stopText" | "target2"> | undefined, day: string, planPath: string | undefined, at: string): JournalEntry {
  const qty = o.filledQty ?? o.shares, px = o.fillPrice ?? o.entry, sh = o.side === "short", maxLoss = r2(qty * Math.abs(px - o.stop));
  return { id: `${o.ticker.toLowerCase()}-stock-${o.side}-${day}-paper`, mode: "paper", kind: "formal", source: "paper_sim", openedAt: at, symbol: o.ticker, strategy: `stock_${o.side}`,
    thesis: `盘前计划 ${planPath ?? ""} ${o.ticker} ${sh ? "做空" : "做多"}：${c?.rule ?? ""}；触发 ${o.trigger ?? ""}`.trim(), stop: `${sh ? ">" : "<"}${o.stop}（Alpaca 括号单止损）`,
    invalidation: c?.stopText || `${sh ? ">" : "<"}${o.stop}`, thesisRecordedAt: at, stopRecordedAt: at, motive: "thesis",
    view: { direction: sh ? "bearish" : "bullish", volatility: "n/a (paper)" }, ivRank: null, greeks: { delta: 0, gamma: 0, theta: 0, vega: 0 }, expectedMove: null,
    structureRationale: `Alpaca paper bracket ${o.clientOrderId ?? ""} (order ${o.orderId ?? "?"})`, maxLoss,
    exitRules: [`stop: ${o.stop}`, ...(o.target1 != null ? [`take profit T1: ${o.target1}`] : []), ...(c?.target2 != null ? [`T2 (ref): ${c.target2}`] : []), `flatten ${FLATTEN_AT} ET`],
    legs: [{ underlying: o.ticker, type: "stock", strike: px, qty: sh ? -qty : qty, premium: px }], underlyingAtEntry: px, entryPrice: px, entryPriceSource: o.fillPrice != null ? "broker" : "unknown",
    timeStopAt: `${day}T${FLATTEN_AT}`, marks: [] } as JournalEntry;
}

export async function executePlan(o: ExecOpts): Promise<ExecResult> {
  const mode = o.dryRun ? "dry-run" : "live-paper", day = etDay(o.now), min = etMinutes(o.now), actions: ExecAction[] = [], ledgerAdds: JournalEntry[] = [];
  const capUsd = dailyRiskCapUsd(day, o.equity);
  const state: IntradayState = structuredClone(o.state && o.state.date === day ? o.state : emptyState(day, capUsd));
  state.opened ??= []; state.closed ??= []; state.watch ??= [];
  state.riskCapUsd = capUsd;
  // risk already opened today in the ledger by hand (not via this state file) counts too
  const mine = new Set(state.opened.map((x) => x.ledgerId).filter(Boolean));
  const outside = () => newRiskOpened(o.ledger.filter((e) => !mine.has(e.id) && !ledgerAdds.some((a) => a.id === e.id)), day).usd;
  const used = () => r2(state.riskUsedUsd + outside());
  const done = (phase: ExecResult["phase"], fl?: FlattenResult): ExecResult => { if (!o.dryRun) state.lastRunAt = o.now.toISOString();
    return { mode, phase, day, capUsd, usedUsd: used(), actions, state, ledgerAdds, flatten: fl, persist: !o.dryRun && phase !== "too_early" }; };
  if (min < hhmm(ENTRY_FROM)) { actions.push({ action: "noop", detail: `${ENTRY_FROM} ET 前不动手` }); return done("too_early"); }
  const cands = o.plan.candidates, bySym = (s: string, side: Side) => cands.find((c) => c.symbol === s && c.side === side);
  if (o.planPath) state.plan = o.planPath;

  // 1) sync our submitted brackets: filled → formal ledger entry; died unfilled → release reserved risk
  for (const it of state.opened.filter((x) => x.clientOrderId && x.status === "submitted")) {
    const r = await o.http("GET", `orders:by_client_order_id?client_order_id=${encodeURIComponent(it.clientOrderId!)}`);
    if (r.status !== 200 || !r.body) { actions.push({ symbol: it.ticker, action: "error", status: r.status, detail: `查询订单 ${it.clientOrderId} 失败` }); continue; }
    const ord = r.body as AlpacaOrder, fq = Number(ord.filled_qty ?? 0), fp = Number(ord.filled_avg_price ?? NaN);
    if (fq > 0 && Number.isFinite(fp) && (ord.status === "filled" || DEAD.includes(ord.status ?? ""))) {
      const before = it.riskUsd; Object.assign(it, { status: "filled", fillPrice: fp, filledQty: fq, filledAt: ord.filled_at ?? o.now.toISOString(), riskUsd: r2(fq * Math.abs(fp - it.stop)) });
      state.riskUsedUsd = r2(state.riskUsedUsd - before + it.riskUsd);
      const e = ledgerEntry(it, bySym(it.ticker, it.side), day, o.planPath ?? state.plan, it.filledAt!);
      it.ledgerId = e.id;
      if (!o.ledger.some((x) => x.id === e.id)) ledgerAdds.push(e);
      actions.push({ symbol: it.ticker, action: "fill", detail: `${it.side} ${fq} @ ${fp} → 正式账本 ${e.id}（风险 $${it.riskUsd}）` });
    } else if (DEAD.includes(ord.status ?? "")) {
      state.riskUsedUsd = r2(state.riskUsedUsd - it.riskUsd); it.status = ord.status!;
      actions.push({ symbol: it.ticker, action: "release", detail: `${it.clientOrderId} ${ord.status} 未成交 → 释放风险 $${it.riskUsd}` });
    }
  }

  // 2) 15:45 → flatten (cancel bracket legs, close positions) for plan + opened symbols
  if (min >= hhmm(FLATTEN_AT)) {
    const symbols = [...new Set([...state.opened.map((x) => x.ticker), ...cands.filter((c) => !c.skip).map((c) => c.symbol)])];
    const fl = await flatten({ http: o.http, now: o.now, before: FLATTEN_AT, leadMin: 0, symbols, dryRun: o.dryRun, pause: o.pause });
    actions.push({ action: "flatten", status: o.dryRun ? "dry-run" : fl.ok ? 200 : 500, detail: `${FLATTEN_AT} 平仓 [${symbols.join(",")}] ok=${fl.ok} 剩余持仓 [${fl.remainingPositions.join(", ")}]` });
    if (!o.dryRun) { for (const it of state.opened.filter((x) => x.status === "filled" || x.status === "submitted")) { state.closed.push({ ticker: it.ticker, side: it.side, via: `flatten ${FLATTEN_AT}`, at: o.now.toISOString(), ledgerId: it.ledgerId }); it.status = "flattened"; }
      if (fl.ok) state.flattenedAt ??= o.now.toISOString(); }
    return done("flatten", fl);
  }
  if (min >= hhmm(NO_NEW_FROM)) { actions.push({ action: "noop", detail: `${NO_NEW_FROM} ET 后不开新仓` }); return done("cutoff"); }
  if (o.plan.date && o.plan.date !== day) { actions.push({ action: "skip", detail: `计划日期 ${o.plan.date} ≠ 今日 ${day}，不开仓` }); return done("stale_plan"); }

  // 3) entries
  let positions: AlpacaPosition[] | null = null;
  const start = `${day}T13:00:00Z`, end = o.now.toISOString(), riskPer = o.riskPerTrade ?? RISK_PER_TRADE.default;
  for (const c of cands) {
    const say = (action: ExecAction["action"], detail: string, status?: ExecAction["status"]) => actions.push({ symbol: c.symbol, action, detail, ...(status != null ? { status } : {}) });
    if (c.skip) { say("skip", c.skip); continue; }
    const prior = state.opened.find((x) => x.ticker === c.symbol && x.side === c.side);
    if (prior) { say("skip", `今日已下单（${prior.status}${prior.orderId ? " " + prior.orderId : ""}），每标的每日一单`); continue; }
    let bars: Bar5[];
    try { bars = await o.bars(c.symbol, start, end); } catch (e) { say("error", `5m K线获取失败：${(e as Error).message}`); continue; }
    const t = confirmTrigger(c, bars, o.now);
    if (t.invalidated) { say("skip", `已失效：${t.invalidated}`); continue; }
    if (!t.trigger || !t.last) { say("wait", `未触发（${c.rule}）${t.or ? ` OR ${t.or.low}-${t.or.high}` : ""}`); continue; }
    const sh = c.side === "short", entry = t.last.c, stop = c.stop!, tp = c.target1!;
    if (sh ? entry >= stop : entry <= stop) { say("skip", `现价 ${entry} 已越过止损 ${stop}`); continue; }
    if (sh ? entry <= tp : entry >= tp) { say("skip", `现价 ${entry} 已到目标1 ${tp}，不追`); continue; }
    const sz = sizePosition(entry, stop, riskPer), remaining = r2(capUsd - used());
    if (sz.shares < 1) { say("skip", `每股风险 $${sz.perShare} > 单笔风险 $${sz.riskPerTrade} → 0 股`); continue; }
    if (sz.riskUsd > remaining + 0.005) { say("skip", `风险 $${sz.riskUsd} > 当日剩余额度 $${remaining}（上限 $${capUsd}）`); continue; }
    const cid = clientOrderId(day, c.symbol, c.side);
    const ex = await o.http("GET", `orders:by_client_order_id?client_order_id=${encodeURIComponent(cid)}`);
    const record = (orderId: string | null, status: string) => { state.opened.push({ ticker: c.symbol, side: c.side, shares: sz.shares, entry, stop, target1: tp, riskUsd: sz.riskUsd, orderId, openedAtET: etStamp(o.now),
      ledgerId: null, status, clientOrderId: cid, trigger: t.trigger!.how }); state.riskUsedUsd = r2(state.riskUsedUsd + sz.riskUsd); };
    if (ex.status === 200 && ex.body) { const ord = ex.body as AlpacaOrder; if (!o.dryRun) record(ord.id, "submitted"); say("exists", `${cid} 已在 Alpaca（${ord.status}）→ 不重复下单`); continue; }
    if (ex.status !== 404) { say("error", `查询 ${cid} HTTP ${ex.status}，本轮不下单`, ex.status); continue; }
    positions ??= await (async () => { const r = await o.http("GET", "positions"); return r.status === 200 && Array.isArray(r.body) ? (r.body as AlpacaPosition[]) : []; })();
    if (positions.some((p) => p.symbol === c.symbol)) { say("skip", `已有 ${c.symbol} 持仓，不叠加`); continue; }
    const px = (x: number) => x.toFixed(2), body = { symbol: c.symbol, qty: String(sz.shares), side: sh ? "sell" : "buy", type: o.entryType ?? "limit", time_in_force: "day",
      ...((o.entryType ?? "limit") === "limit" ? { limit_price: px(entry) } : {}), order_class: "bracket", take_profit: { limit_price: px(tp) }, stop_loss: { stop_price: px(stop) }, client_order_id: cid };
    const desc = `${body.side} ${sz.shares} ${c.symbol} ${body.type}${body.type === "limit" ? " @" + px(entry) : ""} TP ${px(tp)} SL ${px(stop)} 风险 $${sz.riskUsd} [${t.trigger.how}] ${cid}`;
    if (o.dryRun) { state.riskUsedUsd = r2(state.riskUsedUsd + sz.riskUsd); say("submit", desc, "dry-run"); continue; } // reserve locally so the dry-run shows the cap effect; never persisted
    const r = await o.http("POST", "orders", body);
    if (r.status === 200 || r.status === 201) { record((r.body as AlpacaOrder | null)?.id ?? null, "submitted"); say("submit", desc, r.status); }
    else if (r.status === 422 && /client_order_id/i.test(JSON.stringify(r.body))) { record(null, "submitted"); say("exists", `${cid} 重复 client_order_id → 视为已下单`, r.status); }
    else say("error", `下单失败 HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`, r.status);
  }
  return done("entry");
}
