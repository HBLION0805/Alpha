import {
  EVENT_ANALYZER_CANDLE_SERIES_SCHEMA_VERSION,
  EVENT_ANALYZER_INSTRUMENT_ID,
  EVENT_ANALYZER_MAX_ATOMIC_DIGITS,
  EVENT_ANALYZER_SCHEMA_VERSION,
  EventAnalyzerCandleInterval,
  EventAnalyzerEventType,
  EventContractSide,
  RecentMomentumClassification,
  type EventAnalyzerCandleSeries,
  type EventAnalyzerFixedDecimal,
  type EventAnalyzerInput,
  type EventAnalyzerOneMinuteCandle,
} from "../../contracts/EventAnalyzer";
import { EventAnalyzerEngine } from "./EventAnalyzerEngine";

const DECIMAL = /^(?:0|[1-9]\d*)(?:\.(\d{1,8}))?$/u;
const CONTRACT_PRICE = /^(?:0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$/u;
const SERIES_KEYS = ["schemaVersion", "interval", "timestampSemantics", "eventId", "instrumentId", "asOfTime", "provenance", "candles"] as const;
const PROVENANCE_KEYS = ["sourceId", "sourceRecordId", "observationId"] as const;
const CANDLE_KEYS = ["timestamp", "open", "high", "low", "close", "volume"] as const;

export type EventAnalyzerCandleFileLoader = (path: string) => unknown;
export const EVENT_ANALYZER_USAGE = "Usage: npm run event-analyzer -- --event-id=<id> --observation-time=<UTC> --current-price-source-id=<id> --current-price-source-record-id=<id> --current-price-observation-id=<id> --target-price=<BTC> --current-price=<BTC> --remaining-seconds=<1..900> --contract-side=<YES|NO|UP|DOWN> --market-price=<0..1> [--momentum=<UP|FLAT|DOWN>] [--candles-file=<local-json>]";
export const EVENT_ANALYZER_HELP = `${EVENT_ANALYZER_USAGE}\n\nStructured PT1M candle evidence is required for BUY or HOLD. Legacy --momentum-only analysis remains available but returns NO_TRADE. Candle JSON uses { schemaVersion, interval, asOfTime, candles: [{ timestamp, open, high, low, close, volume }] }.`;

export function parseEventAnalyzerArguments(args: readonly string[], loadCandles?: EventAnalyzerCandleFileLoader): EventAnalyzerInput {
  const required = ["--event-id=", "--observation-time=", "--current-price-source-id=", "--current-price-source-record-id=", "--current-price-observation-id=", "--target-price=", "--current-price=", "--remaining-seconds=", "--contract-side=", "--market-price="] as const;
  const optional = ["--momentum=", "--candles-file="] as const;
  const allowed = [...required, ...optional];
  if (args.some((argument) => !allowed.some((prefix) => argument.startsWith(prefix)))) throw new Error(EVENT_ANALYZER_USAGE);
  for (const prefix of required) single(args, prefix);
  const targetPrice = parsePositiveDecimal(single(args, "--target-price="), "target price");
  const currentPrice = parsePositiveDecimal(single(args, "--current-price="), "current price");
  const remainingText = single(args, "--remaining-seconds=");
  if (!/^\d+$/u.test(remainingText)) throw new Error("Remaining seconds must be a positive integer.");
  const contractSide = single(args, "--contract-side=") as EventContractSide;
  const marketPriceBasisPoints = parseContractPrice(single(args, "--market-price="));
  const momentumText = optionalSingle(args, "--momentum=");
  const candlePath = optionalSingle(args, "--candles-file=");
  if (momentumText === undefined && candlePath === undefined) throw new Error("Supply --candles-file for structured evidence or --momentum for legacy coarse analysis.");
  if (candlePath !== undefined && loadCandles === undefined) throw new Error("A local candle-file loader is required when --candles-file is supplied.");
  return {
    schemaVersion: EVENT_ANALYZER_SCHEMA_VERSION,
    eventType: EventAnalyzerEventType.BtcFifteenMinute,
    eventId: single(args, "--event-id="),
    instrumentId: EVENT_ANALYZER_INSTRUMENT_ID,
    observationTime: single(args, "--observation-time="),
    currentPriceSourceId: single(args, "--current-price-source-id="),
    currentPriceSourceRecordId: single(args, "--current-price-source-record-id="),
    currentPriceObservationId: single(args, "--current-price-observation-id="),
    contractSide,
    targetPrice,
    currentPrice,
    marketPriceBasisPoints,
    remainingSeconds: Number(remainingText),
    ...(momentumText === undefined ? {} : { recentMomentum: momentumText as RecentMomentumClassification }),
    ...(candlePath === undefined ? {} : { candleSeries: parseEventAnalyzerCandleFile((loadCandles as EventAnalyzerCandleFileLoader)(candlePath)) }),
  };
}

export function parseEventAnalyzerCandleFile(value: unknown): EventAnalyzerCandleSeries {
  if (!isRecord(value) || !Array.isArray(value.candles)) throw new Error("Candle file must contain an object with a candles array.");
  assertExactKeys(value, SERIES_KEYS, "candle file");
  if (!isRecord(value.provenance)) throw new Error("Candle file must contain bounded provenance.");
  assertExactKeys(value.provenance, PROVENANCE_KEYS, "candle provenance");
  const candles: EventAnalyzerOneMinuteCandle[] = value.candles.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.timestamp !== "string") throw new Error(`Candle ${String(index)} must contain a timestamp and OHLCV fields.`);
    assertExactKeys(entry, CANDLE_KEYS, `candle ${String(index)}`);
    return {
      timestamp: entry.timestamp,
      open: parseFileDecimal(entry.open, `candle ${String(index)} open`),
      high: parseFileDecimal(entry.high, `candle ${String(index)} high`),
      low: parseFileDecimal(entry.low, `candle ${String(index)} low`),
      close: parseFileDecimal(entry.close, `candle ${String(index)} close`),
      volume: entry.volume === null ? null : parseNonNegativeFileDecimal(entry.volume, `candle ${String(index)} volume`),
    };
  });
  return deepFreeze({
    schemaVersion: value.schemaVersion as typeof EVENT_ANALYZER_CANDLE_SERIES_SCHEMA_VERSION,
    interval: value.interval as EventAnalyzerCandleInterval.OneMinute,
    timestampSemantics: value.timestampSemantics as "INTERVAL_START",
    eventId: typeof value.eventId === "string" ? value.eventId : "",
    instrumentId: value.instrumentId as typeof EVENT_ANALYZER_INSTRUMENT_ID,
    asOfTime: typeof value.asOfTime === "string" ? value.asOfTime : "",
    provenance: isRecord(value.provenance) ? {
      sourceId: typeof value.provenance.sourceId === "string" ? value.provenance.sourceId : "",
      sourceRecordId: typeof value.provenance.sourceRecordId === "string" ? value.provenance.sourceRecordId : "",
      observationId: typeof value.provenance.observationId === "string" ? value.provenance.observationId : "",
    } : { sourceId: "", sourceRecordId: "", observationId: "" },
    candles,
  });
}

export function runEventAnalyzerConsole(args: readonly string[], loadCandles?: EventAnalyzerCandleFileLoader): string { return JSON.stringify(new EventAnalyzerEngine().analyze(parseEventAnalyzerArguments(args, loadCandles)), null, 2); }

function single(args: readonly string[], prefix: string): string { const values = args.filter((argument) => argument.startsWith(prefix)).map((argument) => argument.slice(prefix.length)); if (values.length !== 1 || values[0] === "") throw new Error(EVENT_ANALYZER_USAGE); return values[0] as string; }
function optionalSingle(args: readonly string[], prefix: string): string | undefined { const values = args.filter((argument) => argument.startsWith(prefix)).map((argument) => argument.slice(prefix.length)); if (values.length > 1 || values[0] === "") throw new Error(EVENT_ANALYZER_USAGE); return values[0]; }
function parseFileDecimal(value: unknown, label: string): EventAnalyzerFixedDecimal { if (typeof value !== "string") throw new Error(`${label} must be a decimal string.`); return parsePositiveDecimal(value, label); }
function parseNonNegativeFileDecimal(value: unknown, label: string): EventAnalyzerFixedDecimal { if (typeof value !== "string") throw new Error(`${label} must be a decimal string or null.`); const parsed = parseDecimal(value, label); if (BigInt(parsed.atomicValue) < 0n) throw new Error(`${label} cannot be negative.`); return parsed; }
function parsePositiveDecimal(value: string, label: string): EventAnalyzerFixedDecimal { const parsed = parseDecimal(value, label); if (BigInt(parsed.atomicValue) <= 0n) throw new Error(`${label} must be greater than zero.`); return parsed; }
function parseDecimal(value: string, label: string): EventAnalyzerFixedDecimal { const match = DECIMAL.exec(value); if (match === null) throw new Error(`${label} must be a non-negative decimal with at most eight fractional digits.`); const fraction = match[1] ?? ""; const atomicValue = `${value.split(".")[0] ?? ""}${fraction}`; if (atomicValue.length > EVENT_ANALYZER_MAX_ATOMIC_DIGITS) throw new Error(`${label} exceeds the ${String(EVENT_ANALYZER_MAX_ATOMIC_DIGITS)}-digit atomic bound.`); return Object.freeze({ atomicValue, scale: fraction.length }); }
function parseContractPrice(value: string): number { if (!CONTRACT_PRICE.test(value)) throw new Error("Market price must be an exact decimal between 0 and 1 with at most four fractional digits."); const [whole = "0", fraction = ""] = value.split("."); const result = Number(BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, "0"))); if (result <= 0 || result >= 10_000) throw new Error("Market price must be strictly between 0 and 1."); return result; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function assertExactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void { const unknown = Object.keys(value).filter((key) => !allowed.includes(key)).sort(); if (unknown.length > 0) throw new Error(`${label} contains undeclared fields: ${unknown.join(", ")}.`); }
function deepFreeze<T>(value: T): T { if (typeof value === "object" && value !== null && !Object.isFrozen(value)) { Object.freeze(value); for (const nested of Object.values(value)) deepFreeze(nested); } return value; }
