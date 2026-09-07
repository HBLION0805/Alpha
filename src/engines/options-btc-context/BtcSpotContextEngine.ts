import { createHash } from "node:crypto";
import { canonicalizeDeterministicValue } from "../../contracts/DeterministicFingerprint";

export const BTC_CONTEXT_VERSION = "COINBASE_BTC_SPOT_CONTEXT_V1";
export const BTC_CONTEXT_URL = "https://api.exchange.coinbase.com/products/BTC-USD/book?level=1";
export const BTC_CONTEXT_MAX_BYTES = 16384;
export const BTC_CONTEXT_ERRORS = ["NETWORK_FAILED", "DEADLINE_EXCEEDED", "HTTP_STATUS", "CONTENT_TYPE", "BODY_TOO_LARGE", "BODY_MISSING", "INVALID_UTF8", "SOURCE_SCHEMA"] as const;
type SourceError = typeof BTC_CONTEXT_ERRORS[number];
export interface BtcContextInput { requestedAt: string; receivedAt: string; url: string; sourceText: string | null; errorCode: SourceError | null }
interface BookSide { priceUsd: string; sizeBtc: string; orderCount: number }
interface Book { sequence: number; sourceTime: string | null; auctionMode: boolean | null; auctionDetailsPresent: boolean; bid: BookSide | null; ask: BookSide | null }
function fail(code: string): never { throw Error("BTC_CONTEXT_" + code); }
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
export const btcContextSha = (text: string): string => createHash("sha256").update(text).digest("hex");
export const btcContextFingerprint = (value: unknown): string => btcContextSha(canonicalizeDeterministicValue(value));
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
export function btcContextClock(value: string): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail("CLOCK");
}
/** Source nanoseconds are retained exactly; Date is used only for whole seconds. */
export function btcSourceNanoseconds(value: string): bigint {
  const match = typeof value === "string" ? /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(value) : null;
  if (!match) fail("SOURCE_CLOCK");
  const base = match![1]! + ".000Z";
  btcContextClock(base);
  return BigInt(Date.parse(base)) * 1000000n + BigInt((match![2] ?? "").padEnd(9, "0"));
}
function decimal(value: bigint, digits = 8): string {
  const negative = value < 0n, text = (negative ? -value : value).toString().padStart(digits + 1, "0");
  const fraction = text.slice(-digits).replace(/0+$/, "");
  return (negative ? "-" : "") + text.slice(0, -digits) + (fraction ? "." + fraction : "");
}
function units(value: unknown): bigint {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,11})(?:\.\d{1,8})?$/.test(value)) fail("DECIMAL");
  const [whole, fraction = ""] = (value as string).split(".");
  return BigInt(whole!) * 100000000n + BigInt(fraction.padEnd(8, "0"));
}
/** Small bounded JSON parser rejects duplicate keys before JSON.parse could hide them. */
function parseSource(text: string): unknown {
  let at = 0, nodes = 0;
  const space = () => { while (at < text.length && /[\x20\t\r\n]/.test(text[at]!)) at++; };
  const string = (): string => {
    const match = /^"(?:[^"\\\x00-\x1f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/.exec(text.slice(at));
    if (!match) fail("JSON_STRING");
    at += match![0].length;
    const value: string = JSON.parse(match![0]);
    if (/[\uD800-\uDFFF]/u.test(value)) fail("JSON_STRING");
    return value;
  };
  const read = (depth: number): unknown => {
    if (depth > 6 || ++nodes > 128) fail("JSON_LIMIT");
    space(); const first = text[at];
    if (first === '"') return string();
    if (first === "{" || first === "[") {
      const isObject = first === "{", closing = isObject ? "}" : "]";
      at++; space(); const record: Record<string, unknown> = Object.create(null), array: unknown[] = [];
      if (text[at] === closing) { at++; return isObject ? record : array; }
      while (true) {
        if (isObject) {
          const key = string(); space();
          if (Object.hasOwn(record, key)) fail("JSON_DUPLICATE_KEY");
          if (text[at++] !== ":") fail("JSON_STRUCTURE");
          record[key] = read(depth + 1);
        } else array.push(read(depth + 1));
        space(); const separator = text[at++];
        if (separator === closing) break;
        if (separator !== ",") fail("JSON_STRUCTURE");
        space();
      }
      return isObject ? record : array;
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));
    if (!token) fail("JSON_VALUE");
    const value: unknown = JSON.parse(token![0]);
    if (typeof value === "number" && (!/^-?(?:0|[1-9]\d*)$/.test(token![0]) || !Number.isSafeInteger(value))) fail("JSON_INTEGER");
    at += token![0].length; return value;
  };
  const value = read(0); space(); if (at !== text.length) fail("JSON_TRAILING"); return value;
}
function side(value: unknown): BookSide | null {
  if (!Array.isArray(value) || value.length > 1) fail("LEVEL_ONE");
  if (!value.length) return null;
  const level: unknown = value[0];
  if (!Array.isArray(level) || level.length !== 3 || !Number.isSafeInteger(level[2]) || level[2] < 0) fail("LEVEL_SHAPE");
  return { priceUsd: decimal(units(level[0])), sizeBtc: decimal(units(level[1])), orderCount: level[2] as number };
}
function bookFrom(text: string): Book {
  if (typeof text !== "string" || text.length > BTC_CONTEXT_MAX_BYTES || /[\uD800-\uDFFF]/u.test(text) || new TextEncoder().encode(text).byteLength > BTC_CONTEXT_MAX_BYTES) fail("BODY_TOO_LARGE");
  const raw = parseSource(text);
  if (!object(raw) || Object.keys(raw).some(key => !["sequence", "bids", "asks", "time", "auction_mode", "auction"].includes(key)) || !Number.isSafeInteger(raw.sequence) || (raw.sequence as number) < 0) fail("BOOK_SHAPE");
  const time = raw.time ?? null;
  if (time !== null) { if (typeof time !== "string") fail("SOURCE_CLOCK"); btcSourceNanoseconds(time as string); }
  const auction = raw.auction_mode ?? null;
  if (auction !== null && typeof auction !== "boolean") fail("AUCTION_SHAPE");
  if (raw.auction !== undefined && raw.auction !== null && !object(raw.auction)) fail("AUCTION_SHAPE");
  return { sequence: raw.sequence as number, sourceTime: time as string | null, auctionMode: auction as boolean | null,
    auctionDetailsPresent: raw.auction !== undefined && raw.auction !== null, bid: side(raw.bids), ask: side(raw.asks) };
}
export function assessBtcContext(input: BtcContextInput) {
  if (!object(input) || Object.keys(input).sort().join() !== "errorCode,receivedAt,requestedAt,sourceText,url" || input.url !== BTC_CONTEXT_URL) fail("INPUT_SCOPE");
  btcContextClock(input.requestedAt); btcContextClock(input.receivedAt);
  if (input.receivedAt < input.requestedAt) fail("CLOCK_ROLLBACK");
  if (input.errorCode !== null && !BTC_CONTEXT_ERRORS.includes(input.errorCode)) fail("ERROR_CODE");
  if ((input.sourceText === null) !== (input.errorCode !== null)) fail("SOURCE_ERROR_SHAPE");
  const book = input.sourceText === null ? null : bookFrom(input.sourceText);
  const issues: string[] = [];
  let sourceAgeAtReceiptNs: string | null = null, midpointUsd: string | null = null, spreadUsd: string | null = null;
  if (book) {
    if (book.sourceTime === null) issues.push("SOURCE_TIME_UNKNOWN");
    else {
      const age = btcSourceNanoseconds(input.receivedAt) - btcSourceNanoseconds(book.sourceTime);
      sourceAgeAtReceiptNs = age.toString();
      if (age < 0n) issues.push("SOURCE_TIME_AFTER_RECEIPT");
      else if (age > 10000000000n) issues.push("SOURCE_STALE_AT_RECEIPT");
    }
    if (book.auctionMode === null) issues.push("AUCTION_STATE_UNKNOWN");
    else if (book.auctionMode) issues.push("AUCTION_INDICATIVE");
    if (book.auctionDetailsPresent) issues.push("AUCTION_DETAILS_PRESENT");
    for (const [name, value] of [["BID", book.bid], ["ASK", book.ask]] as const) {
      if (value === null) issues.push(name + "_MISSING");
      else if (units(value.priceUsd) === 0n || units(value.sizeBtc) === 0n || value.orderCount === 0) issues.push(name + "_ZERO_LIQUIDITY");
    }
    if (book.bid && book.ask) {
      const bid = units(book.bid.priceUsd), ask = units(book.ask.priceUsd);
      spreadUsd = decimal(ask - bid); midpointUsd = decimal((ask + bid) * 5n, 9);
      if (ask <= bid) issues.push("LOCKED_OR_CROSSED_BOOK");
    }
  }
  return freeze({ version: BTC_CONTEXT_VERSION, source: "COINBASE_EXCHANGE", product: "BTC-USD", contextFor: ["IBIT"],
    requestedAt: input.requestedAt, receivedAt: input.receivedAt, firstObservedAt: input.receivedAt,
    sourceSha256: input.sourceText === null ? null : btcContextSha(input.sourceText), errorCode: input.errorCode,
    status: book === null ? "FAILED" : issues.length ? "UNUSABLE_CONTEXT" : "OBSERVED_CONTEXT", book, issues,
    sourceAgeAtReceiptNs, midpointUsd, spreadUsd, usableAtReceipt: book !== null && issues.length === 0,
    independentSideClocksKnown: false, sourceAuthenticatedByParser: false, executionAllowed: false } as const);
}
export function reportBtcContext(inputs: readonly BtcContextInput[], assessedAt: string) {
  btcContextClock(assessedAt);
  if (!Array.isArray(inputs) || inputs.length > 1000) fail("HISTORY_LIMIT");
  const assessments = inputs.map(assessBtcContext);
  let previousReceipt: string | null = null;
  for (const item of assessments) {
    if (item.receivedAt > assessedAt || previousReceipt !== null && item.requestedAt < previousReceipt) fail("HISTORY_CLOCK");
    previousReceipt = item.receivedAt;
  }
  const latest = assessments.at(-1) ?? null, prior = assessments.at(-2) ?? null;
  const lastKnown = [...assessments].reverse().find(value => value.usableAtReceipt) ?? null;
  let ageNowNs: string | null = null;
  if (latest?.book?.sourceTime) ageNowNs = (btcSourceNanoseconds(assessedAt) - btcSourceNanoseconds(latest.book.sourceTime)).toString();
  const comparisonIssues: string[] = [];
  let midpointChangeUsd: string | null = null, sourceIntervalNs: string | null = null, receiptIntervalMs: number | null = null;
  if (!prior || !latest) comparisonIssues.push("TWO_OBSERVATIONS_REQUIRED");
  else if (!prior.usableAtReceipt || !latest.usableAtReceipt) comparisonIssues.push("CONSECUTIVE_USABLE_OBSERVATIONS_REQUIRED");
  else {
    const first = prior.book!, last = latest.book!;
    const interval = btcSourceNanoseconds(last.sourceTime!) - btcSourceNanoseconds(first.sourceTime!);
    if (interval <= 0n) comparisonIssues.push("SOURCE_TIME_NOT_INCREASING");
    if (last.sequence <= first.sequence) comparisonIssues.push("SEQUENCE_NOT_INCREASING");
    if (!comparisonIssues.length) {
      const midpointTwice = (book: Book) => units(book.bid!.priceUsd) + units(book.ask!.priceUsd);
      midpointChangeUsd = decimal((midpointTwice(last) - midpointTwice(first)) * 5n, 9);
      sourceIntervalNs = interval.toString(); receiptIntervalMs = Date.parse(latest.receivedAt) - Date.parse(prior.receivedAt);
    }
  }
  return freeze({ version: BTC_CONTEXT_VERSION, assessedAt, retrievalCount: inputs.length, latestRetrieval: latest,
    usableAtReceiptCount: assessments.filter(value => value.usableAtReceipt).length,
    lastKnownObservation: lastKnown === null ? null : { ...lastKnown, fromLatestRetrieval: lastKnown === latest },
    ageNowNs, displayFresh: latest?.usableAtReceipt === true && ageNowNs !== null && BigInt(ageNowNs) >= 0n && BigInt(ageNowNs) <= 60000000000n,
    comparison: { basis: "CONSECUTIVE_SAVED_OBSERVATIONS", issues: comparisonIssues, midpointChangeUsd, sourceIntervalNs, receiptIntervalMs },
    healthChange: latest === null ? "NO_HISTORY" : prior === null ? "FIRST_OBSERVATION" :
      btcContextFingerprint({ status: latest.status, errorCode: latest.errorCode, issues: latest.issues }) === btcContextFingerprint({ status: prior.status, errorCode: prior.errorCode, issues: prior.issues }) ? "UNCHANGED" : "CHANGED",
    continuousCoverage: false, ibitPriceConversionAvailable: false, winProbability: null, strategySignal: null, replayAllowed: false, executionAllowed: false } as const);
}
