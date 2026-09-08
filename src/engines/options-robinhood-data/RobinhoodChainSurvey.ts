import { createHash } from "node:crypto";
import { freezePaper, paperFingerprint } from "../options-paper/OptionsPaperTradingEngine";
import { btcSourceNanoseconds } from "../options-btc-context/BtcSpotContextEngine";
import { readinessClock } from "../options-readiness/OptionsReadinessEngine";
import { exchangeLocalDate } from "../market-calendar/MarketCalendarValidation";

type Row = Record<string, unknown>;
type Symbol = "GLD" | "IBIT";
function fail(code: string): never { throw Error("CHAIN_SURVEY_" + code); }
const row = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : fail("OBJECT");
const rows = (v: unknown, max = 20000): Row[] => Array.isArray(v) && v.length <= max ? v.map(row) : fail("ARRAY");
const string = (v: unknown): string => typeof v === "string" && v.length <= 12000 ? v : fail("STRING");
const symbol = (v: unknown): Symbol => v === "GLD" || v === "IBIT" ? v : fail("SYMBOL");
const uuid = (v: unknown): string => typeof v === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v) ? v : fail("ID");
const integer = (v: unknown): number => typeof v === "number" && Number.isSafeInteger(v) && !Object.is(v, -0) && v >= 0 && v <= 1e9 ? v : fail("COUNT");
function day(v: unknown): string { const s = string(v); if (!/^\d{4}-\d\d-\d\d$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) fail("DATE"); return s; }
function days(v: unknown): string[] { if (!Array.isArray(v) || v.length > 100) fail("DATES"); const list = v.map(day); if (new Set(list).size !== list.length) fail("DUPLICATE_DATE"); return list; }
function exact(v: Row, keys: string[]) { if (Object.keys(v).sort().join() !== [...keys].sort().join()) fail("FIELDS"); }
function decimal(v: unknown): string | null { return typeof v === "string" && /^\d{1,8}(?:\.\d{1,6})?$/.test(v) ? v : null; }
function units(v: string): bigint { const [a, b = ""] = v.split("."); return BigInt(a!) * 1000000n + BigInt(b.padEnd(6, "0")); }
const count = (v: unknown): number | null => v === undefined || v === null ? null : integer(v);
function nanos(v: unknown): bigint | null { try { return btcSourceNanoseconds(string(v)); } catch { return null; } }
function hostClock(v: unknown): bigint {
  const s = string(v); if (!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d UTC$/.test(s)) fail("RECEIPT_CLOCK");
  const n = nanos(s.replace(" ", "T").replace(" UTC", "Z")); return n === null ? fail("RECEIPT_CLOCK") : n;
}
const localDate = (n: bigint) => exchangeLocalDate(new Date(Number(n / 1000000n)).toISOString(), "America/New_York");
function nextCursor(v: unknown): string | null { if (v === undefined || v === null || v === "") return null; const m = string(v).match(/[?&]cursor=([^&]+)/); if (!m) fail("CURSOR"); try { return decodeURIComponent(m[1]!); } catch { return fail("CURSOR"); } }

/** Strict bounded JSON for local captures, never remote transport or authentication. */
export function parseChainSurveyJson(source: string): unknown {
  if (typeof source !== "string" || new TextEncoder().encode(source).length > 32 * 1024 * 1024) fail("BYTE_LIMIT");
  let value: unknown; try { value = JSON.parse(source); } catch { fail("JSON"); }
  const stack: { object: boolean; key: boolean; names: Set<string> }[] = [];
  for (const m of source.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\],:]|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)) {
    const t = m[0]; if (t === "{" || t === "[") { if (stack.length >= 24) fail("DEPTH"); stack.push({ object: t === "{", key: t === "{", names: new Set() }); }
    else if (t === "}" || t === "]") stack.pop();
    else { const top = stack.at(-1); if (!top?.object) continue; if (t === ",") top.key = true;
      else if (top.key && t.startsWith('"')) { const k = JSON.parse(t) as string; if (top.names.has(k) || ["__proto__", "constructor", "prototype"].includes(k)) fail("JSON_KEY"); top.names.add(k); top.key = false; }
    }
  }
  return value;
}

export function assessRobinhoodChainSurvey(sourceText: string, assessedAt: string) {
  readinessClock(assessedAt); const assessment = btcSourceNanoseconds(assessedAt), s = row(parseChainSurveyJson(sourceText));
  exact(s, ["version", "scope", "capturedAt", "receiptClockPrecision", "origin", "chains", "instruments", "quotes", "equities", "readOnly", "accountAccessed", "ordersEnabled", "volumeSessionDateProvided", "openInterestAsOfProvided"]);
  if (s.version !== "ROBINHOOD_CHAIN_SURVEY_CAPTURE_V1" || !["HOST_MARKET_TOOL_RESPONSES", "SYNTHETIC_FIXTURE"].includes(string(s.origin)) || s.readOnly !== true || s.accountAccessed !== false || s.ordersEnabled !== false || s.volumeSessionDateProvided !== false || s.openInterestAsOfProvided !== false || s.receiptClockPrecision !== "SECOND") fail("SCOPE");
  const captured = hostClock(s.capturedAt); if (captured > assessment) fail("CAPTURE_AFTER_ASSESSMENT");
  const scope = row(s.scope); exact(scope, ["symbols", "expirationStart", "expirationEnd", "comparisonExpirations"]);
  if (JSON.stringify(scope.symbols) !== '["GLD","IBIT"]') fail("SYMBOL");
  const start = day(scope.expirationStart), end = day(scope.expirationEnd), comparisons = days(scope.comparisonExpirations);
  if (start > end || Date.parse(end) - Date.parse(start) > 31 * 86400000 || comparisons.some(d => d <= end || Date.parse(d) - Date.parse(end) > 7 * 86400000)) fail("DATE_SCOPE");
  function clocks(call: Row) { const requested = hostClock(call.requestedAt), received = hostClock(call.receivedAt); if (requested > received || received > captured) fail("CALL_CLOCK_ORDER"); return { requested, received }; }
  const chains = new Map<string, { symbol: Symbol; dates: string[]; received: bigint }>();
  const chainSymbols = new Set<Symbol>(), issues = new Set<string>();
  for (const c of rows(s.chains, 2)) {
    const sym = symbol(c.symbol), request = row(c.request), clock = clocks(c); exact(request, ["underlying_symbol"]);
    if (request.underlying_symbol !== sym || chainSymbols.has(sym)) fail("CHAIN_REQUEST"); chainSymbols.add(sym);
    const data = row(row(c.response).data); if (data.next) issues.add("CHAIN_PAGINATION_INCOMPLETE");
    for (const ch of rows(data.chains, 8)) { const id = uuid(ch.id); if (symbol(ch.symbol) !== sym || chains.has(id)) fail("CHAIN_IDENTITY"); chains.set(id, { symbol: sym, dates: days(ch.expiration_dates), received: clock.received }); }
  }
  if (chainSymbols.size !== 2) fail("CHAIN_SCOPE_INCOMPLETE");
  const instruments = new Map<string, { id: string; symbol: Symbol; expiry: string; type: string; strike: string; multiplier: string; state: string; tradability: string; instrumentReceivedAt: string }>();
  const chainPages = new Set<string>(), listingComplete = new Map<Symbol, boolean>([["GLD", true], ["IBIT", true]]);
  for (const group of rows(s.instruments, 16)) {
    const sym = symbol(group.symbol), expirations = days(group.expirations), pages = rows(group.pages, 200); if (!pages.length) fail("PAGES_EMPTY");
    const firstRequest = row(pages[0]!.request), state = string(firstRequest.state);
    const chainId = uuid(firstRequest.chain_id), pageKey = chainId + "|" + state, ch = chains.get(chainId);
    if (!ch || ch.symbol !== sym || !["active", "expired"].includes(state) || chainPages.has(pageKey)) fail("INSTRUMENT_CHAIN"); chainPages.add(pageKey);
    const expected = ch.dates.filter(d => d >= start && d <= end || comparisons.includes(d)).sort();
    if (state === "active" ? JSON.stringify([...expirations].sort()) !== JSON.stringify(expected)
      : expirations.length !== 1 || expirations[0] !== localDate(captured) || expirations[0] < start || expirations[0] > end) fail("EXPIRATION_SCOPE");
    let cursor: string | null = null, previousReceipt = ch.received; const seen = new Set<string>();
    for (const [index, p] of pages.entries()) {
      const req = row(p.request); exact(req, ["chain_id", "expiration_dates", "state", ...(index ? ["cursor"] : [])]);
      if (req.chain_id !== chainId || req.expiration_dates !== expirations.join(",") || req.state !== state || index && (cursor === null || req.cursor !== cursor || seen.has(cursor))) fail("PAGE_REQUEST");
      if (cursor) seen.add(cursor); const clock = clocks(p); if (clock.requested < previousReceipt) fail("PAGE_CLOCK_ORDER"); previousReceipt = clock.received;
      const data = row(row(p.response).data); cursor = nextCursor(data.next);
      for (const inst of rows(data.instruments, 100)) {
        const id = uuid(inst.id), expiry = day(inst.expiration_date), strike = decimal(inst.strike_price);
        if (inst.chain_id !== chainId || inst.chain_symbol !== sym || !expirations.includes(expiry) || !strike || units(strike) <= 0n || !["call", "put"].includes(string(inst.type)) || inst.underlying_type !== "equity" || instruments.has(id)) fail("INSTRUMENT_IDENTITY");
        const multiplier = decimal(inst.trade_value_multiplier); if (!multiplier) fail("MULTIPLIER");
        instruments.set(id, { id, symbol: sym, expiry, type: string(inst.type), strike, multiplier, state: string(inst.state), tradability: string(inst.tradability), instrumentReceivedAt: string(p.receivedAt) });
      }
    }
    if (nextCursor(group.next) !== cursor) fail("FINAL_CURSOR");
    if (cursor !== null) { listingComplete.set(sym, false); issues.add(sym + "_INSTRUMENT_PAGINATION_INCOMPLETE"); }
  }
  for (const [id, ch] of chains) if (!chainPages.has(id + "|active") && ch.dates.some(d => d >= start && d <= end || comparisons.includes(d))) { listingComplete.set(ch.symbol, false); issues.add(ch.symbol + "_CHAIN_NOT_ENUMERATED"); }
  if (instruments.size > 20000) fail("CONTRACT_LIMIT");
  const quoteMap = new Map<string, { quote: Row; close: unknown; receivedAt: string; received: bigint }>(), requestedIds = new Set<string>(), quoteSymbols = new Set<Symbol>();
  for (const group of rows(s.quotes, 2)) {
    const sym = symbol(group.symbol); if (quoteSymbols.has(sym)) fail("QUOTE_GROUP_DUPLICATE"); quoteSymbols.add(sym);
    if (integer(group.totalRequested) !== [...instruments.values()].filter(i => i.symbol === sym).length) fail("QUOTE_REQUEST_COUNT");
    for (const b of rows(group.batches, 1000)) {
      if (b.symbol !== sym) fail("QUOTE_SYMBOL"); const req = row(b.request); exact(req, ["instrument_ids"]);
      if (!Array.isArray(req.instrument_ids) || !req.instrument_ids.length || req.instrument_ids.length > 20) fail("QUOTE_BATCH");
      const ids = req.instrument_ids.map(uuid), clock = clocks(b);
      for (const id of ids) { const inst = instruments.get(id); if (!inst || inst.symbol !== sym || requestedIds.has(id)) fail("QUOTE_REQUEST_ID"); if (clock.requested < hostClock(inst.instrumentReceivedAt)) fail("QUOTE_REQUEST_CLOCK"); requestedIds.add(id); }
      const data = row(row(b.response).data);
      for (const result of rows(data.results ?? [], 20)) {
        if (result.quote === null) { issues.add(sym + "_NULL_QUOTE"); continue; }
        const q = row(result.quote), id = uuid(q.instrument_id); if (!ids.includes(id) || quoteMap.has(id)) fail("QUOTE_RESPONSE_ID");
        if (result.close !== undefined && result.close !== null && row(result.close).instrument_id !== id) fail("CLOSE_IDENTITY");
        quoteMap.set(id, { quote: q, close: result.close ?? null, receivedAt: string(b.receivedAt), received: clock.received });
      }
    }
  }
  const quoteComplete = new Map<Symbol, boolean>();
  for (const sym of ["GLD", "IBIT"] as const) { const missing = [...instruments.values()].filter(i => i.symbol === sym && (!requestedIds.has(i.id) || !quoteMap.has(i.id))).length; quoteComplete.set(sym, missing === 0); if (missing) issues.add(sym + "_QUOTES_MISSING"); }
  const allRows = [...instruments.values()].map(inst => {
    const result = quoteMap.get(inst.id), q = result?.quote, clock = nanos(q?.updated_at), quality: string[] = ["VOLUME_SESSION_UNSPECIFIED", "OI_AS_OF_UNSPECIFIED"];
    const bid = decimal(q?.bid_price), ask = decimal(q?.ask_price), mark = decimal(q?.mark_price), volume = q ? count(q.volume) : null, oi = q ? count(q.open_interest) : null;
    const bidSize = q ? count(q.bid_size) : null, askSize = q ? count(q.ask_size) : null;
    if (!q) quality.push("QUOTE_MISSING"); if (clock === null) quality.push("QUOTE_CLOCK_UNKNOWN");
    // Host clocks have only second precision: the final fractional second is unknown.
    if (clock !== null && result && clock >= result.received + 1000000000n) quality.push("QUOTE_AFTER_RECEIPT_SECOND");
    if (clock !== null && assessment - clock > 60000000000n) quality.push("STALE_AT_ASSESSMENT");
    if (clock !== null && clock > assessment) quality.push("QUOTE_AFTER_ASSESSMENT");
    if (!bid || !ask || !mark) quality.push("PRICE_UNKNOWN");
    if (bid && ask && (units(bid) === 0n || units(ask) === 0n)) quality.push("ONE_SIDED_OR_CLOSED_QUOTE");
    if (bid && ask && units(bid) > units(ask)) quality.push("CROSSED_QUOTE");
    if (bidSize === null || askSize === null || bidSize === 0 || askSize === 0) quality.push("DISPLAYED_LIQUIDITY_MISSING");
    if (volume === null) quality.push("VOLUME_UNKNOWN"); if (oi === null) quality.push("OI_UNKNOWN");
    if (units(inst.multiplier) !== 100000000n || inst.state !== "active" || inst.tradability !== "tradable") quality.push("CONTRACT_NOT_STANDARD_ACTIVE_TRADABLE");
    return { ...inst, quoteUpdatedAt: typeof q?.updated_at === "string" ? q.updated_at : null, quoteRefreshDateNewYork: clock === null ? null : localDate(clock),
      receivedAt: result?.receivedAt ?? null, bid, ask, mark, bidSize, askSize, volume, openInterest: oi, previousClose: result?.close ?? null,
      volumeSessionDate: null, openInterestAsOf: null, quality,
      volumeOiRatio: volume !== null && oi !== null && oi > 0 ? { numerator: volume, denominator: oi } : null,
      historicalRelativeVolume: null, causeConfirmed: false, tradeDirection: "UNKNOWN", openingClosingActivity: "UNKNOWN" };
  }).sort((a, b) => a.symbol.localeCompare(b.symbol) || a.expiry.localeCompare(b.expiry) || a.type.localeCompare(b.type) || (units(a.strike) < units(b.strike) ? -1 : units(a.strike) > units(b.strike) ? 1 : a.id.localeCompare(b.id)));
  const key = (r: typeof allRows[number]) => [r.symbol, r.expiry, r.type, r.quoteRefreshDateNewYork].join("|");
  const peers = new Map<string, number[]>();
  for (const r of allRows) if (r.volume !== null && r.volume > 0 && r.quoteRefreshDateNewYork && !r.quality.some(q => q.startsWith("QUOTE_AFTER"))) peers.set(key(r), [...peers.get(key(r)) ?? [], r.volume]);
  const reviewedRows = allRows.map(r => {
    const p = [...peers.get(key(r)) ?? []].sort((a, b) => a - b), mid = Math.floor(p.length / 2);
    const median = p.length ? { numerator: p.length % 2 ? p[mid]! : p[mid - 1]! + p[mid]!, denominator: p.length % 2 ? 1 : 2 } : null;
    const peerEligible = listingComplete.get(r.symbol) && quoteComplete.get(r.symbol) && !issues.has("CHAIN_PAGINATION_INCOMPLETE") && p.length >= 5 && r.quoteRefreshDateNewYork !== null && !r.quality.some(q => q.startsWith("QUOTE_AFTER"));
    const flags: string[] = [];
    if (r.volume !== null && r.volume >= 1000) flags.push("VOLUME_AT_LEAST_1000");
    if (r.volume !== null && r.volume >= 100 && r.openInterest !== null && r.openInterest > 0 && r.volume >= 3 * r.openInterest) flags.push("VOLUME_AT_LEAST_3X_REPORTED_OI");
    if (peerEligible && median && r.volume !== null && r.volume >= 100 && r.volume * median.denominator >= 5 * median.numerator) flags.push("VOLUME_AT_LEAST_5X_POSITIVE_PEER_MEDIAN");
    return { ...r, positivePeerCount: p.length, positivePeerMedian: median, peerScreenEligible: Boolean(peerEligible), activityFlags: flags, reviewCandidate: flags.length > 0,
      possibleExplanations: flags.length ? [r.openInterest !== null && r.volume !== null && r.openInterest > r.volume
        ? "Turnover in an established position pool; hedging or closing is possible, but unproven."
        : "New positioning, repeated turnover, closing or rolling are possible; reported volume does not distinguish them.",
        ...(flags.includes("VOLUME_AT_LEAST_5X_POSITIVE_PEER_MEDIAN") ? ["Activity is concentrated relative to this expiry/side snapshot. Strike liquidity and linked spread legs need investigation."] : [])] : [],
      evidenceNeeded: flags.length ? ["Matched next-session OI and its actual as-of date", "Historical same-contract volume baseline", "Timestamped trade prints, bid/ask context and multi-leg linkage"] : [],
      interpretation: flags.length ? "Activity candidate only; direction, historical abnormality and cause are unconfirmed." : "Below this review filter; not proof of ordinary activity." };
  });
  const expirations = (["GLD", "IBIT"] as const).flatMap(sym => [...new Set([...chains.values()].filter(ch => ch.symbol === sym).flatMap(ch => ch.dates.filter(d => d >= start && d <= end || comparisons.includes(d))).concat(reviewedRows.filter(r => r.symbol === sym).map(r => r.expiry)))].sort().map(expiry => {
    const rs = reviewedRows.filter(r => r.symbol === sym && r.expiry === expiry), strikes = [...new Set(rs.map(r => units(r.strike).toString()))].map(BigInt).sort((a, b) => a < b ? -1 : 1);
    const format = (n: bigint | undefined) => n === undefined ? null : (n / 1000000n).toString() + "." + (n % 1000000n).toString().padStart(6, "0");
    return { symbol: sym, expiry, comparisonOnly: comparisons.includes(expiry), contractCount: rs.length, strikeCount: strikes.length,
      minStrike: format(strikes[0]), maxStrike: format(strikes.at(-1)), calls: rs.filter(r => r.type === "call").length, puts: rs.filter(r => r.type === "put").length,
      quotedContracts: rs.filter(r => r.receivedAt !== null).length, activityCandidates: rs.filter(r => r.reviewCandidate).length,
      reportedVolumeSum: rs.some(r => r.volume === null) ? null : rs.reduce((n, r) => n + r.volume!, 0), listingComplete: listingComplete.get(sym) && !issues.has("CHAIN_PAGINATION_INCOMPLETE"),
      quoteRefreshDates: [...new Set(rs.map(r => r.quoteRefreshDateNewYork))], listingCause: "UNVERIFIED_LISTING_HISTORY_NOT_A_PRICE_FORECAST" };
  }));
  const body = { version: "ROBINHOOD_CHAIN_SURVEY_V1", assessedAt, capturedAt: string(s.capturedAt), origin: string(s.origin), scope,
    sourceSha256: createHash("sha256").update(sourceText).digest("hex"), status: issues.size ? "PARTIAL_CAPTURE_REVIEW" : "CAPTURE_SCOPE_ENUMERATED",
    issues: [...issues].sort(), instrumentCount: instruments.size, quoteCount: quoteMap.size, flaggedCount: reviewedRows.filter(r => r.reviewCandidate).length,
    expirations, rows: reviewedRows, policy: { version: "ACTIVITY_REVIEW_FILTER_V1", absoluteVolume: 1000, relativeMinimumVolume: 100, oiMultiple: 3, positiveMedianMultiple: 5, minimumPositivePeers: 5, retrospectiveDeclaration: true, calibrated: false },
    limitations: ["All prices are source snapshots, not future session prices or fills. Volume/OI clocks are not independently specified.",
      "No historical volume baseline or trade prints: unusual-volume significance, buyer/seller initiation, opening/closing, multi-leg linkage and causes are unknown.",
      "Listed strike ranges are contract availability, not predicted price bounds. Exact listing dates and addition reasons are not supplied.",
      "Peer medians include the candidate and only positive-volume same-expiry/type/quote-date rows. Snapshot clocks can differ within a session.",
      "A source quote and this descriptive filter do not qualify a paper adapter, a trade, a probability or a larger position."],
    sourceAuthenticatedByLocalParser: false, historicalAnomalyConfirmed: false, sourceJournalAppends: 0, futurePricesKnown: false,
    marketReplayAllowed: false, executionAllowed: false, automaticOrdersEnabled: false, winProbability: null };
  return freezePaper({ ...body, reportFingerprint: paperFingerprint(body) });
}
