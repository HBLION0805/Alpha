import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXED_UNIVERSE } from "../src/macro/universe.ts";
import { chainRefreshSymbols } from "../src/options/freshness.ts";
import { parseChain } from "../src/options/chain.ts";
import { selectExpirations, selectStrikesNearSpot, selectInstrumentsForQuotes, windowComplete, instrumentPage, QUOTE_BATCH, type OptionInstrument } from "../src/options/chainWindow.ts";
import { refreshOptionChains, summarizeRefresh, spotsFromEquityQuotes, expirationsFromChain, type ChainSource, type InstrumentsRequest } from "../src/options/chainRefresh.ts";

const ALL34 = "SPY QQQ IWM DIA RSP TLT IEF SHY UUP HYG LQD USO UCO GLD CPER SMH XLK XLE XLF XLI XLB XLY XLP XLV XLU XLRE XLC IYT JETS EWY FXI KWEB LEN KRE".split(" ");
const MISSING_1110 = "DIA RSP SHY LQD UCO CPER XLK XLE XLF XLI XLB XLY XLU XLRE XLC IYT JETS EWY FXI KWEB LEN KRE".split(" ");
const STALE_1110 = "IEF UUP HYG SMH XLP XLV".split(" ");
const FRESH_1110 = "SPY QQQ IWM TLT GLD USO".split(" ");
const MEGA = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "GOOG", "META", "AVGO", "TSLA"];
const NOW = new Date("2026-11-10T12:38:00Z"), TODAY = "2026-11-10";

test("refresh list: exactly the 34 optionable universe names (22 missing + 6 stale on 11-10 included, no GLDM, no mega-caps)", () => {
  const s = chainRefreshSymbols([...FIXED_UNIVERSE]);
  assert.deepEqual(s, ALL34);
  assert.equal(s.length, 34);
  assert.deepEqual(s.slice(0, 3), ["SPY", "QQQ", "IWM"]);
  for (const x of [...MISSING_1110, ...STALE_1110, ...FRESH_1110]) assert.ok(s.includes(x), x);
  assert.equal(MISSING_1110.length + STALE_1110.length + FRESH_1110.length, 34);
  assert.ok(!s.includes("GLDM"));
  for (const m of MEGA) assert.ok(!s.includes(m), m);
});

test("chains --need prints all 34, not a 6-name shortcut; --refresh without a source exits 2 and prints need + policy", () => {
  const d = mkdtempSync(join(tmpdir(), "chains-need-"));
  try {
    const out = execFileSync(process.execPath, ["src/cli/chains.ts", "--need", "--in", d], { encoding: "utf8" }).trim();
    assert.deepEqual(out.split(","), ALL34);
    const env = { ...process.env }; delete env.ALPHA_CHAIN_SOURCE;
    const r = spawnSync(process.execPath, ["src/cli/chains.ts", "--refresh", "--in", d], { encoding: "utf8", env });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /只读 Robinhood 数据源/);
    assert.match(r.stderr, new RegExp(`need \\(34\\): ${ALL34.join(",")}`));
    assert.match(r.stderr, /最近 3 个到期日.*6 个行权价/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("selectExpirations: nearest 3 >= today, dailies and weeklies, fewer than 3, soft 60-day cap", () => {
  assert.deepEqual(selectExpirations(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"], TODAY), ["2026-11-10", "2026-11-11", "2026-11-12"], "SPY dailies 0/1/2 DTE");
  assert.deepEqual(selectExpirations(["2026-12-18", "2026-11-27", "2026-11-13", "2026-11-20", "2026-11-06"], TODAY), ["2026-11-13", "2026-11-20", "2026-11-27"], "TLT weeklies, unsorted input");
  assert.deepEqual(selectExpirations(["2026-11-20", "2026-12-18"], TODAY), ["2026-11-20", "2026-12-18"], "2 is OK");
  assert.deepEqual(selectExpirations(["2026-11-20"], TODAY), ["2026-11-20"], "1 is OK");
  assert.deepEqual(selectExpirations(["2026-11-06", "2026-11-09"], TODAY), [], "only past dates");
  assert.deepEqual(selectExpirations([], TODAY), []);
  assert.deepEqual(selectExpirations(["2026-11-20", "2026-11-20", "bad"], TODAY), ["2026-11-20"], "deduped, junk ignored");
  assert.deepEqual(selectExpirations(["2026-11-20", "2026-12-18", "2027-03-19"], TODAY), ["2026-11-20", "2026-12-18"], "3rd beyond 60d dropped");
  assert.deepEqual(selectExpirations(["2026-11-20", "2027-01-15", "2027-03-19"], TODAY), ["2026-11-20", "2027-01-15", "2027-03-19"], "only 1 inside cap → nearest 3 anyway");
  assert.deepEqual(selectExpirations(["2027-01-15", "2027-03-19", "2027-06-18", "2027-09-17"], TODAY), ["2027-01-15", "2027-03-19", "2027-06-18"], "nothing inside cap → nearest 3");
  for (const d of selectExpirations(["2026-11-09", "2026-11-10", "2026-11-11"], TODAY)) assert.ok(d >= TODAY);
});

test("selectStrikesNearSpot: 3 below + 3 at/above; fill from the other side; sparse / empty safe", () => {
  const spy = Array.from({ length: 49 }, (_, i) => 731 + i);
  assert.deepEqual(selectStrikesNearSpot(spy, 752.89), [750, 751, 752, 753, 754, 755]);
  const tlt = Array.from({ length: 17 }, (_, i) => 78.5 + i * 0.5);
  assert.deepEqual(selectStrikesNearSpot(tlt, 81.879), [80.5, 81, 81.5, 82, 82.5, 83]);
  assert.deepEqual(selectStrikesNearSpot([750, 751, 752, 753], 752), [750, 751, 752, 753], "at-the-money counts as at/above; fewer than 6 → all");
  assert.deepEqual(selectStrikesNearSpot([100, 101, 102, 103, 104, 105, 106, 107], 101.5), [100, 101, 102, 103, 104, 105], "1 below → 5 above");
  assert.deepEqual(selectStrikesNearSpot([90, 91, 92, 93, 94, 95, 96, 97], 96.5), [92, 93, 94, 95, 96, 97], "1 above → 5 below");
  assert.deepEqual(selectStrikesNearSpot([100, 101, 102], 50), [100, 101, 102], "all above");
  assert.deepEqual(selectStrikesNearSpot([5, 3, 3, 4], 10), [3, 4, 5], "unique, sorted");
  assert.deepEqual(selectStrikesNearSpot([], 100), []);
  assert.deepEqual(selectStrikesNearSpot([100], 100), [100]);
  assert.deepEqual(selectStrikesNearSpot([100, 101], NaN), []);
  assert.deepEqual(selectStrikesNearSpot([100, 101], 0), []);
});

// ---- mock Robinhood source -------------------------------------------------------------------------------------------------
const STEP: Record<string, number> = { TLT: 0.5, IEF: 0.5, SHY: 0.5, UUP: 0.5 };
const spotOf = (s: string) => 20 + (s.charCodeAt(0) * 7 + (s.charCodeAt(1) || 0) * 3 + s.length) % 400 + 0.37;
const DAILY = new Set(["SPY", "QQQ", "IWM"]);
const expsOf = (s: string) => (DAILY.has(s) ? ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-20"] : ["2026-11-06", "2026-11-13", "2026-11-20", "2026-11-27", "2026-12-18"]);
function instrumentsOf(s: string, exps: string[]): OptionInstrument[] {
  const spot = spotOf(s), step = STEP[s] ?? 1, base = Math.round(spot / step) * step, out: OptionInstrument[] = [];
  for (let k = -40; k <= 40; k++) for (const e of exps) for (const t of ["call", "put"] as const) {
    const strike = +(base + k * step).toFixed(2);
    out.push({ id: `${s}-${e}-${strike}-${t}`, expiration_date: e, strike_price: strike.toFixed(4), type: t, state: "active", chain_symbol: s });
  }
  return out; // ascending strike, like Robinhood with an expiration_dates filter
}
interface Log { kind: string; symbol?: string; arg: unknown; start: number; end: number }
function mockSource(opts: { fail?: Record<string, number | "always">; noSpot?: string[]; hooks?: { inFlight: Set<string>; maxInFlight: number } } = {}) {
  const log: Log[] = [], left = { ...opts.fail };
  let tick = 0;
  const run = async <T>(kind: string, symbol: string | undefined, arg: unknown, fn: () => T): Promise<T> => {
    const e: Log = { kind, symbol, arg, start: tick++, end: -1 }; log.push(e);
    const h = opts.hooks;
    if (h && symbol) { h.inFlight.add(symbol); h.maxInFlight = Math.max(h.maxInFlight, h.inFlight.size); }
    await new Promise((r) => setImmediate(r));
    e.end = tick++;
    if (h && symbol) h.inFlight.delete(symbol);
    const f = symbol ? left[symbol] : undefined;
    if (f === "always") throw new Error(`${symbol} 503 upstream`);
    if (typeof f === "number" && f > 0) { left[symbol!] = f - 1; throw new Error(`${symbol} 429 rate limited`); }
    return fn();
  };
  const client: ChainSource = {
    equityQuotes: (syms) => run("equityQuotes", undefined, syms, () => {
      assert.ok(syms.length <= 20, "equity batch <= 20");
      return { data: { results: syms.filter((s) => !opts.noSpot?.includes(s)).map((s) => ({ symbol: s, last_trade_price: spotOf(s).toFixed(4) })) } };
    }),
    optionChain: (s) => run("optionChain", s, s, () => ({ data: { results: [{ symbol: s, expiration_dates: expsOf(s) }] } })),
    optionInstruments: (req: InstrumentsRequest) => run("optionInstruments", req.symbol, req, () => {
      const all = instrumentsOf(req.symbol, (req.expirationDates ?? expsOf(req.symbol)).filter((e) => expsOf(req.symbol).includes(e)));
      const at = req.cursor ? Number(req.cursor) : 0, page = all.slice(at, at + 100);
      return { data: { instruments: page, next: at + 100 < all.length ? String(at + 100) : null } };
    }),
    optionQuotes: (ids) => run("optionQuotes", ids[0]!.split("-")[0], ids, () => {
      assert.ok(ids.length <= QUOTE_BATCH, "option quote batch <= 20");
      return { data: { results: ids.map((id) => ({ quote: { instrument_id: id, bid_price: "1.00", ask_price: "1.10", mark_price: "1.05", implied_volatility: "0.2", open_interest: 10, volume: 5, updated_at: "2026-11-10T12:38:00Z" } })) } };
    }),
  };
  return { client, log };
}
const base = (client: ChainSource, dir: string) => ({ client, dir, now: () => NOW, delayMs: 0, pause: async () => {}, retry: { baseMs: 1 } });

test("helpers: spot / expirations / instrument page parsing (both MCP shapes)", () => {
  assert.deepEqual(spotsFromEquityQuotes({ data: { results: [{ symbol: "spy", last_trade_price: "752.89" }, { symbol: "TLT", mark_price: "81.879" }, { symbol: "X", last_trade_price: null }] } }), { SPY: 752.89, TLT: 81.879 });
  assert.deepEqual(expirationsFromChain({ results: [{ expiration_dates: ["2026-11-13", "2026-11-12"] }] }), ["2026-11-12", "2026-11-13"]);
  assert.deepEqual(instrumentPage({ instruments: [], next: "abc" }), { instruments: [], next: "abc" });
  assert.equal(instrumentPage({ data: { instruments: [{ id: "a" }], next: null } }).instruments.length, 1);
  assert.equal(instrumentPage(null).next, null);
});

test("window: 6 strikes × 2 rights × 3 expiries = 36 instruments; complete only on ascending pages", () => {
  const ins = instrumentsOf("SPY", ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]), spot = spotOf("SPY");
  const pick = selectInstrumentsForQuotes(ins, spot, TODAY);
  assert.equal(pick.length, 36);
  assert.deepEqual([...new Set(pick.map((i) => i.expiration_date))], ["2026-11-10", "2026-11-11", "2026-11-12"]);
  const ks = [...new Set(pick.map((i) => Number(i.strike_price)))];
  assert.equal(ks.length, 6); assert.equal(ks.filter((k) => k < spot).length, 3);
  const exps = ["2026-11-10", "2026-11-11", "2026-11-12"], sub = ins.filter((i) => exps.includes(i.expiration_date));
  assert.equal(windowComplete(sub, spot, exps), true);
  assert.equal(windowComplete(sub.filter((i) => Number(i.strike_price) < spot + 2), spot, exps), false, "not enough above yet");
  assert.equal(windowComplete([...sub].reverse(), spot, exps), false, "unordered pages are never trusted");
});

test("orchestrator: all 34 refreshed, raw + chain written, call accounting per client invocation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "chains-refresh-"));
  try {
    const { client, log } = mockSource();
    const r = await refreshOptionChains({ ...base(client, dir), symbols: chainRefreshSymbols([...FIXED_UNIVERSE]) });
    assert.deepEqual(r.ok, ALL34);
    assert.deepEqual(r.failed, {}); assert.deepEqual(r.noSpot, []); assert.deepEqual(r.buildFailed, {});
    assert.equal(r.totalCalls, log.length, "every client invocation counted once");
    assert.equal(r.sharedCalls.equityQuotes, 2, "34 symbols → 2 equity batches (<=20)");
    assert.equal(r.calls.optionChain, 34);
    assert.equal(r.totalCalls, r.sharedCalls.total + r.symbols.reduce((a, s) => a + s.calls.total, 0));
    for (const k of ["optionChain", "optionInstruments", "optionQuotes"] as const) assert.equal(r.calls[k], log.filter((l) => l.kind === k).length, k);
    for (const s of ALL34) {
      const raw = JSON.parse(readFileSync(join(dir, "rh-chain", `${s}.json`), "utf8"));
      assert.deepEqual(Object.keys(raw), ["symbol", "spot", "fetchedAt", "instruments", "quotes"]);
      assert.equal(raw.fetchedAt, NOW.toISOString());
      const ch = parseChain(JSON.parse(readFileSync(join(dir, `${s.toLowerCase()}-chain.json`), "utf8")));
      assert.equal(ch.contracts.length, 36, s);
      assert.ok(ch.contracts.every((c) => c.expiration >= TODAY), s);
      const rep = r.symbols.find((x) => x.symbol === s)!;
      assert.equal(rep.calls.optionQuotes, 2, `${s}: 36 ids → 2 batches`);
      assert.equal(rep.calls.optionChain, 1);
      assert.ok(rep.calls.optionInstruments >= 1);
    }
    assert.deepEqual(r.symbols.find((x) => x.symbol === "SPY")!.expirations, ["2026-11-10", "2026-11-11", "2026-11-12"]);
    assert.deepEqual(r.symbols.find((x) => x.symbol === "TLT")!.expirations, ["2026-11-13", "2026-11-20", "2026-11-27"]);
    const tlt = parseChain(JSON.parse(readFileSync(join(dir, "tlt-chain.json"), "utf8")));
    assert.ok(tlt.contracts.some((c) => c.strike % 1 === 0.5), "0.5 strike increments kept");
    // early stop: SPY window is complete before the chain is exhausted (3 exps × 81 strikes × 2 = 486 → 5 pages)
    assert.ok(r.symbols.find((x) => x.symbol === "SPY")!.calls.optionInstruments < 5);
    const lines = summarizeRefresh(r);
    assert.match(lines[0]!, /^\[chains\] refresh 34\/34 成功 · 0 失败 · 0 无现价 · 用时 .*调用 \d+ 次/);
    assert.match(lines.at(-1)!, /每标的调用.*SPY \d+, QQQ \d+.*KRE \d+/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("orchestrator: mid-list failures isolated, transient error retried with backoff, no-spot skipped", async () => {
  const dir = mkdtempSync(join(tmpdir(), "chains-refresh-"));
  try {
    const { client } = mockSource({ fail: { XLF: "always", KWEB: "always", TLT: 2 }, noSpot: ["CPER"] });
    const waits: number[] = [];
    const r = await refreshOptionChains({ ...base(client, dir), symbols: ALL34, pause: async (ms) => { waits.push(ms); }, retry: { attempts: 3, baseMs: 100 } });
    assert.deepEqual(Object.keys(r.failed).sort(), ["KWEB", "XLF"]);
    assert.match(r.failed.XLF!, /503/);
    assert.deepEqual(r.noSpot, ["CPER"]);
    assert.equal(r.ok.length, 31);
    assert.ok(r.ok.includes("TLT") && r.ok.includes("XLI") && r.ok.includes("LEN") && r.ok.includes("KRE"), "names after the failures still refreshed");
    assert.equal(r.symbols.find((x) => x.symbol === "TLT")!.retries, 2);
    assert.equal(r.symbols.find((x) => x.symbol === "XLF")!.calls.total, 3, "3 attempts, each counted");
    assert.deepEqual(waits.filter((w) => w >= 100), [100, 200, 100, 200, 100, 200], "exponential backoff per failing call");
    for (const s of ["XLF", "KWEB", "CPER"]) { assert.ok(!existsSync(join(dir, "rh-chain", `${s}.json`)), s); }
    assert.ok(existsSync(join(dir, "xli-chain.json")) && existsSync(join(dir, "tlt-chain.json")));
    const lines = summarizeRefresh(r).join("\n");
    assert.match(lines, /2\/34 refresh failed: XLF \(XLF 503 upstream; 3 calls\); KWEB/);
    assert.match(lines, /1\/34 无现价 skipped: CPER/);
    assert.match(lines, /retried: TLT×2/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("orchestrator: non-transient error not retried; build failure isolated; equity batch failure → no spot", async () => {
  const dir = mkdtempSync(join(tmpdir(), "chains-refresh-"));
  try {
    const { client } = mockSource();
    let n = 0;
    const c2: ChainSource = { ...client,
      optionChain: (s) => (s === "QQQ" ? Promise.reject(Object.assign(new Error("chain not found"), { retryable: false })) : client.optionChain(s)),
      optionQuotes: (ids) => (ids[0]!.startsWith("IWM") ? Promise.resolve({ data: { results: [] } }) : client.optionQuotes(ids)),
      equityQuotes: (syms) => (n++ === 0 ? client.equityQuotes(syms) : Promise.reject(new Error("timeout"))) };
    const syms = [...ALL34.slice(0, 20), "KRE", "LEN"];
    const r = await refreshOptionChains({ ...base(c2, dir), symbols: syms });
    assert.equal(r.symbols.find((x) => x.symbol === "QQQ")!.calls.optionChain, 1);
    assert.deepEqual(Object.keys(r.failed), ["QQQ"]);
    assert.match(r.buildFailed.IWM!, /no contracts joined/);
    assert.ok(r.ok.includes("IWM"), "raw written even when build fails");
    assert.deepEqual(r.noSpot, ["KRE", "LEN"]);
    assert.equal(r.sharedCalls.equityQuotes, 1 + 3, "second batch retried 3 times");
    assert.ok(existsSync(join(dir, "spy-chain.json")));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("orchestrator: concurrency 1 never overlaps symbols; concurrency 2 does; delay spaces every call", async () => {
  for (const [c, expectMax] of [[1, 1], [2, 2]] as const) {
    const dir = mkdtempSync(join(tmpdir(), "chains-refresh-"));
    try {
      const hooks = { inFlight: new Set<string>(), maxInFlight: 0 };
      const { client } = mockSource({ hooks });
      const r = await refreshOptionChains({ ...base(client, dir), symbols: ALL34.slice(0, 6), concurrency: c });
      assert.equal(r.ok.length, 6);
      assert.equal(hooks.maxInFlight, expectMax, `concurrency ${c}`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  const dir = mkdtempSync(join(tmpdir(), "chains-refresh-"));
  try {
    let t = 0; const starts: number[] = [];
    const { client } = mockSource();
    const timed: ChainSource = Object.fromEntries(Object.entries(client).map(([k, f]) => [k, (a: never) => { starts.push(t); return (f as (x: never) => Promise<unknown>)(a); }])) as unknown as ChainSource;
    const r = await refreshOptionChains({ ...base(timed, dir), symbols: ["SPY", "TLT"], concurrency: 4, delayMs: 250, clock: () => t, pause: async (ms) => { t += ms; } });
    assert.equal(starts.length, r.totalCalls);
    for (let i = 1; i < starts.length; i++) assert.ok(starts[i]! - starts[i - 1]! >= 250, `call ${i} spaced`);
    assert.ok(r.wallMs >= 250 * (r.totalCalls - 1));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CLI --refresh drives the same path through a --source module (mock, temp dir only)", () => {
  const dir = mkdtempSync(join(tmpdir(), "chains-cli-"));
  try {
    const mod = join(dir, "source.mjs");
    writeFileSync(mod, `export function createChainSource() {
  const exps = ["2026-11-13", "2026-11-20", "2026-11-27"];
  return {
    equityQuotes: async (s) => ({ results: s.map((symbol) => ({ symbol, last_trade_price: "100.3" })) }),
    optionChain: async () => ({ expiration_dates: exps }),
    optionInstruments: async ({ symbol, expirationDates }) => ({ instruments: [98, 99, 100, 101, 102, 103, 104].flatMap((k) => expirationDates.flatMap((e) => ["call", "put"].map((t) => ({ id: symbol + e + k + t, expiration_date: e, strike_price: k + ".0000", type: t, state: "active" })))), next: null }),
    optionQuotes: async (ids) => ({ results: ids.map((instrument_id) => ({ quote: { instrument_id, mark_price: "1" } })) }),
  };
}`);
    const r = spawnSync(process.execPath, ["src/cli/chains.ts", "--refresh", "--in", dir, "--source", mod, "--delay", "0"], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /# 期权链刷新状态（34 个标的/);
    assert.equal((r.stdout.match(/✅/g) ?? []).length, 34);
    assert.match(r.stderr, /\[chains\] refresh 34\/34 成功/);
    assert.match(r.stderr, /每标的调用.*KRE \d+/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
