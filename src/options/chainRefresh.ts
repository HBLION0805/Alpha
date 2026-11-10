/**
 * Option-chain refresh orchestrator (2026-11-10: the routine fetched only 6 of the 34 `chains --need` names).
 * Node cannot call the Robinhood MCP, so the data source is injected (`ChainSource`): every method takes the tool arguments and
 * returns the tool's JSON output verbatim. READ-ONLY: quotes / chains / instruments only — nothing here places, cancels or
 * modifies orders, and nothing reads ALPACA keys or any secret.
 *
 * Per symbol: expirations (chain metadata) → nearest 3 → instrument pages for those dates (follow `next` until the near-spot
 * window is in hand) → 6 strikes × call/put per expiration → option quotes in batches of <= 20 → data/in/rh-chain/<SYM>.json (raw)
 * → data/in/<sym>-chain.json (normalised). Spot comes from equity-quote batches of <= 20.
 * Calls are serial-or-low concurrency, spaced by `delayMs`, retried with exponential backoff; one symbol failing is recorded and the
 * rest continue.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { chainFromRobinhood, unwrapJson } from "./robinhood.ts";
import { chainFile, chainFreshness } from "./freshness.ts";
import { etDate } from "../macro/nyse.ts";
import { QUOTE_BATCH, chunk, instrumentPage, selectExpirations, selectInstrumentsForQuotes, windowComplete, type OptionInstrument } from "./chainWindow.ts";

export interface InstrumentsRequest { symbol: string; expirationDates?: string[]; cursor?: string; spot?: number }
/** Read-only Robinhood (MCP or equivalent) source. Each method = one tool call; return the tool output verbatim. */
export interface ChainSource {
  /** get_equity_quotes for <= 20 symbols. */
  equityQuotes(symbols: string[]): Promise<unknown>;
  /** get_option_chains (chain metadata with `expiration_dates`) for one symbol. */
  optionChain(symbol: string): Promise<unknown>;
  /** get_option_instruments (chain_symbol, optional comma-joined expiration_dates, optional `next` cursor). `spot` is a hint only. */
  optionInstruments(req: InstrumentsRequest): Promise<unknown>;
  /** get_option_quotes for <= 20 instrument ids. */
  optionQuotes(ids: string[]): Promise<unknown>;
}
export type CallKind = "equityQuotes" | "optionChain" | "optionInstruments" | "optionQuotes";
export type CallCounts = Record<CallKind, number> & { total: number };
const zero = (): CallCounts => ({ equityQuotes: 0, optionChain: 0, optionInstruments: 0, optionQuotes: 0, total: 0 });

export interface RetryOpts { attempts?: number; baseMs?: number; factor?: number; maxMs?: number }
export interface RefreshOpts {
  client: ChainSource;
  /** Caller passes chainRefreshSymbols(loadUniverse(dir)) — all 34. Never restricted here. */
  symbols: string[];
  dir?: string;
  now?: () => Date;
  /** Symbols in flight at once. Default 1, clamped to 1..4. */
  concurrency?: number;
  /** Minimum gap between any two client calls (all workers share it). Default 200ms. */
  delayMs?: number;
  retry?: RetryOpts;
  /** Max instrument pages per symbol. Default 20. */
  maxPages?: number;
  /** Error → retry? Default: everything except errors with `retryable: false`. */
  isTransient?: (e: unknown) => boolean;
  pause?: (ms: number) => Promise<void>;
  clock?: () => number;
  /** Also write <sym>-chain.json after the raw file. Default true. */
  build?: boolean;
}
export interface SymbolReport {
  symbol: string; ok: boolean; error?: string; calls: CallCounts; ms: number;
  spot?: number; expirations: string[]; instruments: number; quoted: number; contracts?: number; buildError?: string; retries: number;
  /** Skipped: no equity quote / spot. */
  noSpot?: boolean;
}
export interface RefreshReport {
  startedAt: string; wallMs: number; concurrency: number; delayMs: number;
  /** Every client invocation (each retry attempt included). */
  totalCalls: number; calls: CallCounts;
  /** Equity-quote batches (shared by up to 20 symbols, so not attributed per symbol). */
  sharedCalls: CallCounts;
  symbols: SymbolReport[];
  ok: string[]; failed: Record<string, string>; noSpot: string[]; buildFailed: Record<string, string>;
}

const realPause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 200);

/** {SYMBOL: last price} from get_equity_quotes output (last_trade_price → extended → mark). */
export function spotsFromEquityQuotes(json: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!x || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    const p = Number(o.last_trade_price ?? o.last_extended_hours_trade_price ?? o.mark_price ?? o.price ?? NaN);
    if (typeof o.symbol === "string" && Number.isFinite(p) && p > 0) out[o.symbol.toUpperCase()] = p;
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v);
  };
  walk(json);
  return out;
}
/** `expiration_dates` from get_option_chains output (any nesting; first array found per chain, merged). */
export function expirationsFromChain(json: unknown): string[] {
  const out = new Set<string>();
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!x || typeof x !== "object") return;
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (k === "expiration_dates" && Array.isArray(v)) v.forEach((d) => typeof d === "string" && out.add(d));
      else if (v && typeof v === "object") walk(v);
    }
  };
  walk(json);
  return [...out].sort();
}

const writeAtomic = (path: string, text: string) => { writeFileSync(path + ".tmp", text); renameSync(path + ".tmp", path); };

export interface RawChainFile { symbol: string; spot: number; fetchedAt: string; instruments: unknown[]; quotes: unknown[] }
/** dir/rh-chain/<SYM>.json in the routine's raw shape (pages verbatim). */
export function writeRawChain(dir: string, raw: RawChainFile): string {
  mkdirSync(`${dir}/rh-chain`, { recursive: true });
  const p = `${dir}/rh-chain/${raw.symbol}.json`;
  writeAtomic(p, JSON.stringify(raw));
  return p;
}

/** dir/rh-chain/<SYM>.json → dir/<sym>-chain.json (same as `chains --build`). Throws on a bad file; `stale` = raw >1 trading day old. */
export function buildChainFromRaw(dir: string, sym: string, now: Date = new Date()): { contracts: number; stale: boolean; out: string } {
  const raw = `${dir}/rh-chain/${sym}.json`;
  const r = unwrapJson(readFileSync(raw, "utf8")) as Partial<RawChainFile>;
  const stale = rawStale(dir, sym, now, r);
  if (!(Number(r.spot) > 0)) throw new Error("spot missing");
  const ch = chainFromRobinhood(r.instruments ?? [], r.quotes ?? [], sym, Number(r.spot), r.fetchedAt);
  if (!ch.contracts.length) throw new Error("no contracts joined (instruments × quotes)");
  const out = chainFile(sym, dir);
  mkdirSync(dir, { recursive: true });
  writeAtomic(out, JSON.stringify(ch, null, 1));
  return { contracts: ch.contracts.length, stale, out };
}
/** Raw file older than 1 trading day (fetchedAt, else mtime). */
export function rawStale(dir: string, sym: string, now: Date = new Date(), parsed?: Partial<RawChainFile>): boolean {
  const raw = `${dir}/rh-chain/${sym}.json`;
  const r = parsed ?? (unwrapJson(readFileSync(raw, "utf8")) as Partial<RawChainFile>);
  return chainFreshness(r.fetchedAt ?? statSync(raw).mtime.toISOString(), etDate(now)).stale;
}
export const rawExists = (dir: string, sym: string) => existsSync(`${dir}/rh-chain/${sym}.json`);

/** Refresh every symbol. Never throws because one symbol failed; the report says what happened. */
export async function refreshOptionChains(o: RefreshOpts): Promise<RefreshReport> {
  const dir = o.dir ?? "data/in", now = o.now ?? (() => new Date()), pause = o.pause ?? realPause, clock = o.clock ?? Date.now;
  const concurrency = Math.max(1, Math.min(4, Math.floor(o.concurrency ?? 1))), delayMs = Math.max(0, o.delayMs ?? 200);
  const attempts = Math.max(1, o.retry?.attempts ?? 3), baseMs = o.retry?.baseMs ?? 500, factor = o.retry?.factor ?? 2, maxMs = o.retry?.maxMs ?? 8000;
  const isTransient = o.isTransient ?? ((e: unknown) => (e as { retryable?: boolean } | null)?.retryable !== false);
  const maxPages = Math.max(1, o.maxPages ?? 20), build = o.build ?? true;
  const symbols = [...new Set(o.symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const t0 = clock(), startedAt = now().toISOString(), today = etDate(now());
  const all = zero(), shared = zero();

  // shared throttle: at least delayMs between the starts of any two client calls
  let gate: Promise<void> = Promise.resolve(), lastAt = -Infinity;
  const throttle = () => {
    const turn = gate.then(async () => { const wait = lastAt + delayMs - clock(); if (wait > 0) await pause(wait); lastAt = clock(); });
    gate = turn; return turn;
  };
  /** One client call with throttle + retry; every attempt counts. */
  const call = async <T>(kind: CallKind, counts: CallCounts, fn: () => Promise<T>, onRetry?: () => void): Promise<T> => {
    for (let a = 1; ; a++) {
      await throttle();
      counts[kind]++; counts.total++; all[kind]++; all.total++;
      try { return await fn(); } catch (e) {
        if (a >= attempts || !isTransient(e)) throw e;
        onRetry?.();
        await pause(Math.min(maxMs, baseMs * factor ** (a - 1)));
      }
    }
  };

  // 1) spots, <= 20 symbols per equity-quote call; a failed batch only costs those symbols their spot
  const spots: Record<string, number> = {}, spotErr: Record<string, string> = {};
  for (const batch of chunk(symbols, QUOTE_BATCH)) {
    try { Object.assign(spots, spotsFromEquityQuotes(await call("equityQuotes", shared, () => o.client.equityQuotes(batch)))); }
    catch (e) { for (const s of batch) spotErr[s] = `equity quotes failed: ${msg(e)}`; }
  }

  const reports: SymbolReport[] = new Array(symbols.length);
  const one = async (symbol: string): Promise<SymbolReport> => {
    const s0 = clock(), calls = zero();
    const r: SymbolReport = { symbol, ok: false, calls, ms: 0, expirations: [], instruments: 0, quoted: 0, retries: 0 };
    const bump = () => { r.retries++; };
    try {
      const spot = spots[symbol];
      if (!(spot! > 0)) throw Object.assign(new Error(spotErr[symbol] ?? "no spot (equity quote missing)"), { noSpot: true });
      r.spot = spot;
      const exps = selectExpirations(expirationsFromChain(await call("optionChain", calls, () => o.client.optionChain(symbol), bump)), today);
      if (!exps.length) throw new Error(`no expirations >= ${today}`);
      r.expirations = exps;
      const pages: unknown[] = [], seen: OptionInstrument[] = [];
      let cursor: string | undefined;
      for (let p = 0; p < maxPages; p++) {
        const req: InstrumentsRequest = { symbol, expirationDates: exps, spot, ...(cursor ? { cursor } : {}) };
        const page = await call("optionInstruments", calls, () => o.client.optionInstruments(req), bump);
        pages.push(page);
        const { instruments, next } = instrumentPage(page);
        seen.push(...instruments.filter((i) => exps.includes(i.expiration_date)));
        if (!next || windowComplete(seen, spot!, exps)) break;
        cursor = next;
      }
      const pick = selectInstrumentsForQuotes(seen, spot!, today);
      r.instruments = pick.length;
      if (!pick.length) throw new Error("no instruments near spot for selected expirations");
      const quotes: unknown[] = [];
      for (const ids of chunk(pick.map((i) => i.id), QUOTE_BATCH)) quotes.push(await call("optionQuotes", calls, () => o.client.optionQuotes(ids), bump));
      r.quoted = pick.length;
      writeRawChain(dir, { symbol, spot: spot!, fetchedAt: now().toISOString(), instruments: pages, quotes });
      r.ok = true;
      if (build) {
        try { r.contracts = buildChainFromRaw(dir, symbol, now()).contracts; } catch (e) { r.buildError = msg(e); }
      }
    } catch (e) {
      r.error = msg(e);
      if ((e as { noSpot?: boolean }).noSpot) r.noSpot = true;
    }
    r.ms = clock() - s0;
    return r;
  };

  let next = 0;
  const worker = async () => { while (next < symbols.length) { const i = next++; reports[i] = await one(symbols[i]!); } };
  await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, worker));

  const failed: Record<string, string> = {}, buildFailed: Record<string, string> = {}, noSpot: string[] = [], ok: string[] = [];
  for (const r of reports) {
    if (r.ok) ok.push(r.symbol);
    else if (r.noSpot) noSpot.push(r.symbol);
    else failed[r.symbol] = r.error ?? "unknown error";
    if (r.buildError) buildFailed[r.symbol] = r.buildError;
  }
  return { startedAt, wallMs: clock() - t0, concurrency, delayMs, totalCalls: all.total, calls: all, sharedCalls: shared, symbols: reports, ok, failed, noSpot, buildFailed };
}

const fmtCalls = (c: CallCounts) => `报价 ${c.equityQuotes} · 链 ${c.optionChain} · 合约页 ${c.optionInstruments} · 期权报价 ${c.optionQuotes}`;
/** stderr lines, `[chains]` prefix, one line per problem kind (same spirit as summarizeBuild). */
export function summarizeRefresh(r: RefreshReport): string[] {
  const n = r.symbols.length, f = Object.entries(r.failed), b = Object.entries(r.buildFailed);
  const out = [`[chains] refresh ${r.ok.length}/${n} 成功 · ${f.length} 失败 · ${r.noSpot.length} 无现价 · 用时 ${(r.wallMs / 1000).toFixed(1)}s · 调用 ${r.totalCalls} 次（${fmtCalls(r.calls)}）· 并发 ${r.concurrency} · 间隔 ${r.delayMs}ms`];
  if (f.length) out.push(`[chains] ${f.length}/${n} refresh failed: ${f.map(([s, e]) => `${s} (${e}; ${r.symbols.find((x) => x.symbol === s)?.calls.total ?? 0} calls)`).join("; ")}`);
  if (r.noSpot.length) out.push(`[chains] ${r.noSpot.length}/${n} 无现价 skipped: ${r.noSpot.map((s) => `${s} (${r.symbols.find((x) => x.symbol === s)?.error})`).join("; ")}`);
  if (b.length) out.push(`[chains] ${b.length}/${n} build failed: ${b.map(([s, e]) => `${s} (${e})`).join("; ")}`);
  const retried = r.symbols.filter((x) => x.retries);
  if (retried.length) out.push(`[chains] retried: ${retried.map((x) => `${x.symbol}×${x.retries}`).join(",")}`);
  out.push(`[chains] 每标的调用（另有共享报价 ${r.sharedCalls.total}）: ${r.symbols.map((x) => `${x.symbol} ${x.calls.total}`).join(", ")}`);
  return out;
}
