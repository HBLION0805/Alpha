import { createHash } from "node:crypto";
import { evaluateOptionsRetailFeasibility } from "../options-retail-feasibility/OptionsRetailFeasibilityEngine";
import { ROBINHOOD_DATA_TOOL_NAMES } from "./RobinhoodDataReadinessEngine";

export const ROBINHOOD_CAPTURE_MAX_BYTES = 512 * 1024;
export const ROBINHOOD_CAPTURE_VERSION = "ROBINHOOD_CAPTURE_V1";
type Row = Record<string, unknown>;
type Symbol = "GLD" | "IBIT";
interface Call { tool: string; args: Row; data: Row; requestedAt: string; receivedAt: string }
interface Instrument { id: string; chainId: string; symbol: Symbol; expiry: string; strike: string; type: "call" | "put"; multiplier: string; state: string; tradability: string; ticks: Row; selloutAt: unknown }
function fail(code: string): never { throw new Error(`ROBINHOOD_CAPTURE_${code}`); }
const row = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : fail("INVALID_OBJECT");
const rows = (v: unknown, max: number): Row[] => Array.isArray(v) && v.length <= max ? v.map(row) : fail("INVALID_ROWS");
const text = (v: unknown): string => typeof v === "string" && v.length <= 4096 ? v : fail("INVALID_STRING");
const symbol = (v: unknown): Symbol => v === "GLD" || v === "IBIT" ? v : fail("SYMBOL_OUTSIDE_SCOPE");
const uuid = (v: unknown): string => typeof v === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v) ? v : fail("INVALID_ID");
function keys(v: Row, allowed: string[]) { if (Object.keys(v).some(k => !allowed.includes(k))) fail("UNEXPECTED_FIELD"); }
function day(v: unknown): string {
  const s = text(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) fail("INVALID_DATE");
  return s;
}
function clock(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,9})?(Z|[+-]\d\d:\d\d)$/.exec(v);
  if (!m || +m[2]! > 23 || +m[3]! > 59 || +m[4]! > 59 || !Number.isFinite(Date.parse(v))) return null;
  try { day(m[1]); } catch { return null; }
  return Date.parse(v);
}
function receiptClock(v: unknown): string {
  if (typeof v !== "string" || clock(v) === null || new Date(v).toISOString() !== v) fail("INVALID_CAPTURE_CLOCK");
  return v as string;
}
/** Exact cents only; source marks and Greek decimals are never rounded into quotes. */
function cents(v: unknown): number | null {
  if (typeof v !== "string" || !/^\d{1,8}(?:\.\d{1,6})?$/.test(v)) return null;
  const [whole, frac = ""] = v.split(".");
  if (/[^0]/.test(frac.slice(2))) return null;
  return Number(whole) * 100 + Number(frac.slice(0, 2).padEnd(2, "0"));
}
const size = (v: unknown): number | null => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
function safeTree(v: unknown, depth = 0, count = { n: 0 }): void {
  if (++count.n > 30000 || depth > 16) fail("STRUCTURE_LIMIT");
  if (typeof v === "string" && v.length > 4096) fail("STRING_LIMIT");
  if (v && typeof v === "object") for (const [k, child] of Object.entries(v)) {
    if (/token|password|secret|authorization|cookie|account|orders?|positions?|__proto__|^constructor$|^prototype$/i.test(k) && k !== "can_open_position") fail("FORBIDDEN_DATA_FIELD");
    safeTree(child, depth + 1, count);
  }
}
function parseCall(v: Row, asOf: number): Call {
  keys(v, ["tool", "args", "data", "requestedAt", "receivedAt"]);
  const tool = text(v.tool);
  if (!(ROBINHOOD_DATA_TOOL_NAMES as readonly string[]).includes(tool)) fail("TOOL_OUTSIDE_SCOPE");
  const requestedAt = receiptClock(v.requestedAt), receivedAt = receiptClock(v.receivedAt);
  if (Date.parse(requestedAt) > Date.parse(receivedAt) || Date.parse(receivedAt) > asOf) fail("CAPTURE_CHRONOLOGY");
  const args = row(v.args), data = row(v.data);
  if (tool === "get_equity_quotes") {
    keys(args, ["symbols"]);
    if (!Array.isArray(args.symbols) || args.symbols.length < 1 || args.symbols.length > 2) fail("SYMBOL_OUTSIDE_SCOPE");
    args.symbols.forEach(symbol);
  } else if (tool === "get_option_chains") {
    keys(args, ["underlying_symbol"]); symbol(args.underlying_symbol);
  } else if (tool === "get_option_instruments") {
    keys(args, ["chain_id", "expiration_dates", "strike_price", "type", "state", "tradability", "cursor"]);
    uuid(args.chain_id); day(args.expiration_dates);
    if (args.strike_price !== undefined && cents(args.strike_price) === null) fail("STRIKE_PRECISION");
    if (args.type !== undefined && args.type !== "call" && args.type !== "put") fail("OPTION_TYPE");
    if (args.state !== undefined && args.state !== "active") fail("CONTRACT_STATE");
    if (args.tradability !== undefined && args.tradability !== "tradable") fail("CONTRACT_STATE");
    if (args.cursor !== undefined) text(args.cursor);
  } else {
    keys(args, tool === "get_option_quotes" ? ["instrument_ids"] : ["instrument_ids", "start_time", "end_time", "interval", "bounds"]);
    if (!Array.isArray(args.instrument_ids) || args.instrument_ids.length < 1 || args.instrument_ids.length > 4) fail("CONTRACT_LIMIT");
    args.instrument_ids.forEach(uuid);
    if (new Set(args.instrument_ids).size !== args.instrument_ids.length) fail("DUPLICATE_REQUEST_ID");
    if (tool === "get_option_historicals") {
      const start = clock(args.start_time), end = clock(args.end_time);
      if (start === null || end === null || start >= end || end > Date.parse(requestedAt) || end - start > 24 * 3600000) fail("HISTORY_RANGE");
      if (!["minute", "5minute"].includes(text(args.interval)) || args.bounds !== "regular") fail("HISTORY_SCOPE");
    }
  }
  return { tool, args, data, requestedAt, receivedAt };
}
function freeze<T>(v: T): T { if (v && typeof v === "object") { for (const child of Object.values(v)) freeze(child); Object.freeze(v); } return v; }

/** The local file is a declaration of prior calls, never proof of a live connection. */
export function assessRobinhoodCapture(inputText: string, assessedAt: string) {
  if (typeof inputText !== "string" || new TextEncoder().encode(inputText).byteLength > ROBINHOOD_CAPTURE_MAX_BYTES) fail("BYTE_LIMIT");
  const asOf = Date.parse(receiptClock(assessedAt));
  let parsed: unknown;
  try { parsed = JSON.parse(inputText); } catch { fail("INVALID_JSON"); }
  safeTree(parsed);
  const input = row(parsed); keys(input, ["schemaVersion", "captureId", "declaredOrigin", "calls"]);
  if (input.schemaVersion !== "1.0" || typeof input.captureId !== "string" || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(input.captureId)) fail("INVALID_ENVELOPE");
  if (!["OWNER_AUTHORIZED_MCP_CAPTURE", "SYNTHETIC"].includes(text(input.declaredOrigin))) fail("INVALID_ORIGIN");
  const calls = rows(input.calls, 12).map(v => parseCall(v, asOf));
  if (calls.length === 0) fail("EMPTY_CAPTURE");
  const issues = new Set<string>();
  const chains = new Map<string, { symbol: Symbol; expiries: string[]; multiplier: string }>();
  for (const c of calls.filter(c => c.tool === "get_option_chains")) {
    if (c.data.next) issues.add("CHAIN_RESPONSE_PAGINATED");
    for (const chain of rows(c.data.chains, 4)) {
      const id = uuid(chain.id), sym = symbol(chain.symbol);
      if (sym !== c.args.underlying_symbol) fail("CHAIN_REQUEST_MISMATCH");
      if (chains.has(id)) fail("DUPLICATE_CHAIN");
      if (!Array.isArray(chain.expiration_dates) || chain.expiration_dates.length > 200) fail("EXPIRY_LIMIT");
      chains.set(id, { symbol: sym, expiries: chain.expiration_dates.map(day), multiplier: text(chain.trade_value_multiplier) });
      if (chain.cash_component !== null) issues.add("ADJUSTED_CHAIN_DELIVERABLE_UNVERIFIED");
      if (rows(chain.underlying_instruments, 4).some(u => !u.symbol)) issues.add("UNDERLYING_SYMBOL_LINK_INCOMPLETE");
    }
  }
  const instruments = new Map<string, Instrument>();
  for (const c of calls.filter(c => c.tool === "get_option_instruments")) {
    if (c.data.next) issues.add("INSTRUMENT_RESPONSE_PAGINATED");
    for (const v of rows(c.data.instruments, 4)) {
      const id = uuid(v.id), chainId = uuid(v.chain_id), chain = chains.get(chainId);
      const sym = symbol(v.chain_symbol), expiry = day(v.expiration_date), strike = text(v.strike_price);
      if (instruments.has(id)) fail("DUPLICATE_INSTRUMENT");
      if (!chain || chainId !== c.args.chain_id || sym !== chain.symbol || !chain.expiries.includes(expiry) || expiry !== c.args.expiration_dates) fail("CONTRACT_CHAIN_MISMATCH");
      if (v.type !== "call" && v.type !== "put") fail("OPTION_TYPE");
      if (cents(strike) === null || (c.args.strike_price !== undefined && cents(strike) !== cents(c.args.strike_price)) || (c.args.type !== undefined && v.type !== c.args.type)) fail("INSTRUMENT_FILTER_MISMATCH");
      if (v.trade_value_multiplier !== chain.multiplier && cents(v.trade_value_multiplier) !== cents(chain.multiplier)) fail("MULTIPLIER_MISMATCH");
      if (v.underlying_type !== "equity") fail("UNDERLYING_TYPE");
      instruments.set(id, { id, chainId, symbol: sym, expiry, strike, type: v.type, multiplier: text(v.trade_value_multiplier), state: text(v.state), tradability: text(v.tradability), ticks: row(v.min_ticks), selloutAt: v.sellout_datetime });
    }
  }
  if (instruments.size < 1 || instruments.size > 4) fail("CONTRACT_LIMIT");
  const requestedIds = (c: Call): string[] => (c.args.instrument_ids as string[]).map(id => { if (!instruments.has(id)) fail("REQUEST_ID_NOT_LINKED"); return id; });
  const quotes = [];
  for (const c of calls.filter(c => c.tool === "get_option_quotes")) {
    const requested = requestedIds(c), seen = new Set<string>();
    for (const r of rows(c.data.results, 4)) {
      if (r.quote === null) { issues.add("MISSING_OPTION_QUOTE"); continue; }
      const q = row(r.quote), id = uuid(q.instrument_id), inst = instruments.get(id);
      if (!inst || !requested.includes(id) || seen.has(id)) fail("QUOTE_IDENTITY_MISMATCH");
      seen.add(id);
      const blockers: string[] = [], sourceMs = clock(q.updated_at), receiptMs = Date.parse(c.receivedAt);
      const bid = cents(q.bid_price), ask = cents(q.ask_price), bidSize = size(q.bid_size), askSize = size(q.ask_size);
      if (sourceMs === null) blockers.push("QUOTE_CLOCK_UNKNOWN");
      else {
        if (sourceMs > receiptMs) blockers.push("QUOTE_CLOCK_IN_FUTURE");
        if (receiptMs - sourceMs > 60000) blockers.push("STALE_ON_RECEIPT");
        if (asOf - sourceMs > 60000) blockers.push("STALE_AT_ASSESSMENT");
      }
      if (bid === null || ask === null) blockers.push("QUOTE_SIDES_OR_CENT_PRECISION_UNAVAILABLE");
      else if (bid <= 0 || ask <= 0) blockers.push("ZERO_QUOTE_SIDE");
      else if (bid > ask) blockers.push("CROSSED_QUOTE");
      if (bidSize === null || askSize === null) blockers.push("SIZE_UNKNOWN");
      else if (bidSize === 0 || askSize === 0) blockers.push("ZERO_DISPLAYED_SIZE");
      if (inst.state !== "active" || inst.tradability !== "tradable") blockers.push("CONTRACT_NOT_ACTIVE_TRADABLE");
      if (cents(inst.multiplier) !== 10000) blockers.push("NONSTANDARD_MULTIPLIER");
      const cutoff = cents(inst.ticks.cutoff_price), below = cents(inst.ticks.below_tick), above = cents(inst.ticks.above_tick);
      const tickAt = (price: number) => cutoff !== null && below !== null && above !== null ? (price >= cutoff ? above : below) : null;
      const bidTick = bid === null ? null : tickAt(bid), askTick = ask === null ? null : tickAt(ask);
      if (!bidTick || !askTick || bid === null || ask === null || bid % bidTick !== 0 || ask % askTick !== 0) blockers.push("PRICE_TICK_UNVERIFIED");
      let closeDate: string | null = null;
      if (r.close != null) {
        const close = row(r.close);
        if (close.instrument_id !== id || close.symbol !== inst.symbol) fail("CLOSE_IDENTITY_MISMATCH");
        closeDate = close.date === null ? null : day(close.date);
        if (close.interpolated === true) blockers.push("PRIOR_CLOSE_INTERPOLATED");
      } else blockers.push("OFFICIAL_PRIOR_CLOSE_UNAVAILABLE");
      const budget = bid !== null && ask !== null && ask > 0 && bid <= ask && bidTick && askTick && cents(inst.multiplier) === 10000
        ? evaluateOptionsRetailFeasibility({ symbol: inst.symbol, strategy: inst.type === "call" ? "LONG_CALL" : "LONG_PUT", currentEquityCents: 100000, settledCashCents: 100000, quantity: 1, contractMultiplier: 100,
          bidPerShareCents: bid, askPerShareCents: ask, minimumPriceTickCents: Math.min(bidTick, askTick), roundTripFeesCents: null, slippageReserveCents: null, mode: "NORMAL", stopLossBps: 2000, rewardMultipleMilliR: 2000 }) : null;
      const e = budget?.economics;
      if (e && e.premiumCents > e.applicableAllocationBudgetCents) blockers.push("PREMIUM_ALONE_EXCEEDS_ALLOCATION");
      if (e && e.premiumCents > e.legacyNormalMaxLossCents) blockers.push("PREMIUM_ALONE_EXCEEDS_STRESS_CAP");
      quotes.push({ instrumentId: id, symbol: inst.symbol, expiry: inst.expiry, type: inst.type, strike: inst.strike, multiplier: inst.multiplier,
        sourceQuoteAt: typeof q.updated_at === "string" ? q.updated_at : null, receivedAt: c.receivedAt,
        ageAtReceiptMs: sourceMs === null ? null : receiptMs - sourceMs, ageAtAssessmentMs: sourceMs === null ? null : asOf - sourceMs,
        bidPerUnitCents: bid, askPerUnitCents: ask, bidSize, askSize, volume: size(q.volume), openInterest: size(q.open_interest), closeDate,
        markPrice: typeof q.mark_price === "string" ? q.mark_price : null, providerExpiryProfitProbability: typeof q.chance_of_profit_long === "string" ? q.chance_of_profit_long : null,
        oneContractPremiumCents: e?.premiumCents ?? null, oneContractSpreadCents: bid !== null && ask !== null && bid <= ask && cents(inst.multiplier) === 10000 ? (ask - bid) * 100 : null,
        budgetScenario: budget, blockers });
    }
    if (seen.size !== requested.length) issues.add("REQUESTED_OPTION_QUOTE_MISSING");
  }
  if (quotes.length === 0) issues.add("NO_OPTION_QUOTES");
  for (const id of instruments.keys()) if (!quotes.some(q => q.instrumentId === id)) issues.add("CONTRACT_WITHOUT_QUOTE");
  const histories = [];
  for (const c of calls.filter(c => c.tool === "get_option_historicals")) {
    const requested = requestedIds(c), seen = new Set<string>();
    if (c.data.not_found != null) {
      if (!Array.isArray(c.data.not_found) || c.data.not_found.some(id => !requested.includes(uuid(id)))) fail("HISTORY_NOT_FOUND_MISMATCH");
      if (c.data.not_found.length) issues.add("HISTORICAL_IDS_NOT_FOUND");
    }
    for (const h of rows(c.data.results, 4)) {
      const id = uuid(h.instrument_id), inst = instruments.get(id);
      if (!inst || !requested.includes(id) || seen.has(id)) fail("HISTORY_IDENTITY_MISMATCH");
      if (Array.isArray(c.data.not_found) && c.data.not_found.includes(id)) fail("HISTORY_FOUND_NOT_FOUND_CONFLICT");
      seen.add(id);
      const expectedOcc = inst.symbol.padEnd(6) + inst.expiry.replaceAll("-", "").slice(2) + (inst.type === "call" ? "C" : "P") + String(cents(inst.strike)! * 10).padStart(8, "0");
      if (h.symbol !== inst.symbol || h.occ_symbol !== expectedOcc || h.bounds !== c.args.bounds || h.interval !== c.args.interval) fail("HISTORY_CONTRACT_OR_INTERVAL_MISMATCH");
      const bars = rows(h.bars, 1500), intervalMs = h.interval === "minute" ? 60000 : 300000;
      const problems = new Set<string>(), start = clock(c.args.start_time)!, end = clock(c.args.end_time)!;
      let previous: number | null = null, interpolated = 0, observed = 0, unknown = 0;
      for (const b of bars) {
        const t = clock(b.begins_at);
        if (t === null || t < start || t >= end || t + intervalMs > end || t % intervalMs !== 0 || (previous !== null && t <= previous)) fail("BAR_CLOCK_OR_ORDER");
        if (previous !== null && t - previous !== intervalMs) problems.add("BAR_GAPS");
        previous = t;
        if (b.session !== "reg") fail("BAR_SESSION");
        const prices = [b.open_price, b.high_price, b.low_price, b.close_price].map(v => {
          if (typeof v !== "string" || !/^\d{1,8}(?:\.\d{1,6})?$/.test(v)) fail("BAR_PRICE");
          const [whole, fractional = ""] = (v as string).split("."); return BigInt(whole!) * 1000000n + BigInt(fractional.padEnd(6, "0"));
        });
        const [open, high, low, close] = prices as [bigint, bigint, bigint, bigint];
        if (low <= 0n || high < low || open < low || open > high || close < low || close > high) fail("BAR_OHLC");
        if (b.interpolated === true) interpolated++;
        else if (b.interpolated === false) observed++;
        else if (b.interpolated === undefined) unknown++;
        else fail("BAR_INTERPOLATION_FLAG");
      }
      if (!bars.length) problems.add("EMPTY_HISTORY");
      if (interpolated > 0) problems.add("INTERPOLATED_BARS_EXCLUDED");
      if (interpolated === bars.length && bars.length > 0) problems.add("ALL_BARS_INTERPOLATED");
      if (unknown > 0) problems.add("BAR_INTERPOLATION_UNKNOWN");
      if (bars.length !== (end - start) / intervalMs) problems.add("REQUESTED_WINDOW_INCOMPLETE");
      histories.push({ instrumentId: id, symbol: inst.symbol, occSymbol: expectedOcc, interval: h.interval, startAt: c.args.start_time, endAt: c.args.end_time,
        receivedAt: c.receivedAt, barCount: bars.length, explicitNonInterpolatedCount: observed, interpolatedCount: interpolated, unknownInterpolationCount: unknown,
        historicalBidAskAvailable: false, historicalSizesAvailable: false, barVolumeAvailable: false, blockers: [...problems, "OHLC_IS_NOT_EXECUTION_QUOTE_HISTORY"] });
    }
    if (seen.size !== requested.length) issues.add("REQUESTED_HISTORY_MISSING");
  }
  if (histories.length === 0) issues.add("NO_HISTORICAL_RESPONSES");
  const equities = [];
  for (const c of calls.filter(c => c.tool === "get_equity_quotes")) {
    const seen = new Set<string>();
    for (const r of rows(c.data.results, 2)) {
      if (r.quote === null) { issues.add("UNDERLYING_QUOTE_MISSING"); continue; }
      const q = row(r.quote), sym = symbol(q.symbol);
      if (!(c.args.symbols as string[]).includes(sym) || seen.has(sym)) fail("EQUITY_IDENTITY_MISMATCH");
      seen.add(sym);
      const times = [clock(q.venue_bid_time), clock(q.venue_ask_time)];
      const blockers = times.some(t => t === null || t > Date.parse(c.receivedAt) || asOf - t > 60000) ? ["UNDERLYING_QUOTE_CLOCK_UNUSABLE"] : [];
      if (q.state !== "active" || q.has_traded !== true) blockers.push("UNDERLYING_NOT_ACTIVE_TRADED");
      const bid = cents(q.bid_price), ask = cents(q.ask_price);
      if (bid === null || ask === null || bid <= 0 || ask <= 0 || bid > ask) blockers.push("UNDERLYING_QUOTE_SIDES_UNUSABLE");
      if (r.close != null && row(r.close).symbol !== sym) fail("EQUITY_CLOSE_IDENTITY_MISMATCH");
      equities.push({ symbol: sym, bidAt: typeof q.venue_bid_time === "string" ? q.venue_bid_time : null, askAt: typeof q.venue_ask_time === "string" ? q.venue_ask_time : null, receivedAt: c.receivedAt, blockers });
    }
    if (seen.size !== (c.args.symbols as string[]).length) issues.add("REQUESTED_UNDERLYING_MISSING");
  }
  const candidateLessons = [
    { code: "SOURCE_TIME_BEFORE_RECEIPT_TIME", rule: "A recent receipt does not refresh an old quote; retain both clocks." },
    { code: "INTERPOLATION_IS_NOT_ACTIVITY", rule: "Exclude interpolated bars; never substitute OHLC for bid/ask and sizes." },
    { code: "MULTIPLIER_BEFORE_AFFORDABILITY", rule: "Use one whole contract and the stated multiplier before comparing budgets; costs remain additional." },
    { code: "EXPIRY_MODEL_IS_NOT_PATH_WIN_RATE", rule: "Provider expiry-profit estimates do not calibrate target-before-stop probability or unlock larger size." },
  ];
  return freeze({ schemaVersion: "1.0", engineVersion: ROBINHOOD_CAPTURE_VERSION, captureId: input.captureId as string,
    declaredOrigin: input.declaredOrigin as string, source: "ROBINHOOD_MCP_STRUCTURED_DATA", sourceSha256: createHash("sha256").update(inputText, "utf8").digest("hex"),
    assessedAt, declarationAuthenticatedByParser: false, callCount: calls.length, contractCount: instruments.size,
    status: "NO_REPLAY", executionAllowed: false, tradeCount: 0, winProbability: null,
    freshnessDiagnosticMs: 60000, quotes, histories, equities, captureIssues: [...issues],
    blockers: ["SOURCE_EXPORT_IS_A_LOCAL_DECLARATION", "SIDE_AND_SIZE_EVENT_CLOCKS_UNVERIFIED", "UNDERLYING_OPTION_ALIGNMENT_UNVERIFIED", "CONTRACT_DELIVERABLE_AND_CALENDAR_UNVERIFIED", "ENTITLEMENT_RETENTION_TERMS_UNVERIFIED", "COSTS_AND_ACCOUNT_RULES_UNVERIFIED", "REPLAY_ADAPTER_NOT_IMPLEMENTED"],
    candidateLessons: candidateLessons.map(v => ({ ...v, status: "CANDIDATE_DATA_QUALITY_RULE", tradeOutcome: null, strategyChangeAllowed: false })),
    assumptions: ["USD 1,000 and settled cash are hypothetical budget inputs, not an account lookup.", "20% stop and 2R are existing research choices; unknown costs are never zero.", "A sampled quote is not a fill. Only the requested contracts and historical window were checked.", "The parser cannot prove MCP authentication or historical availability from an exported file."] });
}
