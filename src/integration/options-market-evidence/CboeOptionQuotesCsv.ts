import type { CboeOptionQuoteRow } from "../../contracts/OptionsMarketEvidence";

// Cboe Option Quotes Specification v1.1, reviewed 2026-09-06.
// This parser reads local files, not the Cboe delayed dashboard.
const REQUIRED_HEADERS = ["underlying_symbol", "quote_datetime", "root", "expiration", "strike", "option_type", "open", "high", "low", "close", "trade_volume", "bid_size", "bid", "ask_size", "ask", "underlying_bid", "underlying_ask"] as const;
const OPTIONAL_HEADERS = ["implied_underlying_price", "active_underlying_price", "implied_volatility", "delta", "gamma", "theta", "vega", "rho", "open_interest"] as const;
const ALLOWED_HEADERS = new Set<string>([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS]);
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_ROWS = 10_000;
const MAX_CELL_LENGTH = 400;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const ET = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", calendar: "iso8601", numberingSystem: "latn", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const ROW_KEYS = ["underlyingSymbol", "root", "optionType", "expirationDate", "strikeCents", "contractKey", "quoteDatetimeEt", "snapshotAt", "bidCents", "askCents", "bidSizeContracts", "askSizeContracts", "underlyingBidCents", "underlyingAskCents", "impliedVolatility", "delta", "gamma", "theta", "vega", "rho", "openInterest"] as const;

function fail(code: string): never { throw new Error(code); }

function records(csv: string): string[][] {
  if (typeof csv !== "string" || new TextEncoder().encode(csv).length > MAX_BYTES) fail("CBOE_CSV_BYTE_LIMIT");
  const text = csv.startsWith("\uFEFF") ? csv.slice(1) : csv;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) fail("CBOE_CSV_CONTROL_CHARACTER");
  const result: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, closedQuote = false;
  const addCharacter = (character: string) => {
    cell += character;
    if (cell.length > MAX_CELL_LENGTH) fail("CBOE_CSV_CELL_LIMIT");
  };
  const endCell = () => {
    row.push(cell); cell = ""; closedQuote = false;
    if (row.length > ALLOWED_HEADERS.size) fail("CBOE_CSV_COLUMN_LIMIT");
  };
  const endRow = () => {
    endCell(); result.push(row); row = [];
    if (result.length > MAX_ROWS + 1) fail("CBOE_CSV_ROW_LIMIT");
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') { addCharacter('"'); index += 1; }
        else { quoted = false; closedQuote = true; }
      } else { addCharacter(character); }
      continue;
    }
    if (closedQuote && character !== "," && character !== "\r" && character !== "\n") fail("CBOE_CSV_AFTER_QUOTE");
    if (character === '"') {
      if (cell.length !== 0) fail("CBOE_CSV_UNEXPECTED_QUOTE");
      quoted = true;
    } else if (character === ",") { endCell(); }
    else if (character === "\r" || character === "\n") {
      if (character === "\r") {
        if (text[index + 1] !== "\n") fail("CBOE_CSV_LINE_ENDING");
        index += 1;
      }
      endRow();
    } else { addCharacter(character); }
  }
  if (quoted) fail("CBOE_CSV_UNTERMINATED_QUOTE");
  if (cell.length > 0 || row.length > 0 || closedQuote) endRow();
  return result;
}

function date(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) fail("CBOE_INVALID_DATE");
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) fail("CBOE_INVALID_DATE");
  return value;
}

function easternTimestamp(value: unknown): { quoteDatetimeEt: string; snapshotAt: string } {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) fail("CBOE_INVALID_ET_TIMESTAMP");
  date(value.slice(0, 10));
  const hour = Number(value.slice(11, 13)), minute = Number(value.slice(14, 16)), second = Number(value.slice(17, 19));
  if (hour > 23 || minute > 59 || second > 59) fail("CBOE_INVALID_ET_TIMESTAMP");
  const localAsUtc = Date.parse(`${value.replace(" ", "T")}.000Z`);
  // Eastern standard/daylight offsets are candidates, not an assumed season.
  // Intl's IANA rules must round-trip the exact local timestamp. This rejects
  // both the missing spring hour and the duplicated autumn hour.
  const candidates = [4, 5].map((hours) => localAsUtc + hours * 3_600_000).filter((candidate) => {
    const parts = Object.fromEntries(ET.formatToParts(candidate).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}` === value;
  });
  if (candidates.length !== 1) fail("CBOE_AMBIGUOUS_OR_NONEXISTENT_ET_TIMESTAMP");
  return { quoteDatetimeEt: value, snapshotAt: new Date(candidates[0]!).toISOString() };
}

function cents(value: string): number | null {
  if (value === "") return null;
  if (!/^(0|[1-9]\d{0,13})(?:\.\d{1,18})?$/.test(value)) fail("CBOE_INVALID_MONEY");
  const [whole, fractional = ""] = value.split(".");
  if (/[1-9]/.test(fractional.slice(2))) fail("CBOE_SUBCENT_MONEY");
  const parsed = BigInt(whole!) * 100n + BigInt(fractional.slice(0, 2).padEnd(2, "0"));
  if (parsed > MAX_SAFE) fail("CBOE_UNSAFE_MONEY");
  return Number(parsed);
}

function count(value: string): number | null {
  if (value === "") return null;
  if (!/^(0|[1-9]\d{0,15})$/.test(value)) fail("CBOE_INVALID_COUNT");
  const parsed = BigInt(value);
  if (parsed > MAX_SAFE) fail("CBOE_UNSAFE_COUNT");
  return Number(parsed);
}

function decimal(value: string, field: string): string | null {
  if (value === "") return null;
  if (!/^-?(0|[1-9]\d{0,8})(?:\.\d{1,18})?$/.test(value)) fail("CBOE_INVALID_ANALYTIC");
  const numeric = Number(value);
  if ((field === "implied_volatility" || field === "gamma" || field === "vega") && numeric < 0) fail("CBOE_INVALID_ANALYTIC");
  const [unsignedWhole, unsignedFraction = ""] = value.replace(/^-/, "").split(".");
  if (field === "delta" && (BigInt(unsignedWhole!) > 1n || (unsignedWhole === "1" && /[1-9]/.test(unsignedFraction)))) fail("CBOE_INVALID_ANALYTIC");
  const normalized = value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value;
  if (numeric === 0) return field === "implied_volatility" ? null : "0";
  return normalized;
}

function integerOrNull(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) fail("CBOE_INVALID_NORMALIZED_INTEGER");
  return value;
}

function analyticsOrNull(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value === "" || decimal(value, field) !== value) fail("CBOE_INVALID_NORMALIZED_ANALYTIC");
  return value;
}

function validateMarkets(bid: number | null, ask: number | null): void {
  if (bid !== null && ask !== null && bid > ask) fail("CBOE_CROSSED_MARKET");
}

/** Rechecks normalized journal content without elevating source provenance. */
export function validateCboeOptionQuoteRow(input: unknown): CboeOptionQuoteRow {
  if (typeof input !== "object" || input === null || Array.isArray(input)) fail("CBOE_INVALID_NORMALIZED_ROW");
  const record = input as Record<string, unknown>;
  if (Object.keys(record).length !== ROW_KEYS.length || ROW_KEYS.some((key) => !Object.hasOwn(record, key))) fail("CBOE_INVALID_NORMALIZED_FIELDS");
  if (record.underlyingSymbol !== "GLD" && record.underlyingSymbol !== "IBIT") fail("CBOE_INVALID_UNDERLYING");
  if (typeof record.root !== "string" || !/^[A-Z][A-Z0-9.]{0,19}$/.test(record.root)) fail("CBOE_INVALID_ROOT");
  if (record.optionType !== "CALL" && record.optionType !== "PUT") fail("CBOE_INVALID_OPTION_TYPE");
  const expirationDate = date(record.expirationDate);
  const strikeCents = integerOrNull(record.strikeCents);
  if (strikeCents === null || strikeCents === 0) fail("CBOE_INVALID_STRIKE");
  const contractKey = `${record.root}:${expirationDate}:${record.optionType}:${strikeCents}`;
  if (record.contractKey !== contractKey) fail("CBOE_CONTRACT_IDENTITY_MISMATCH");
  const timestamp = easternTimestamp(record.quoteDatetimeEt);
  if (timestamp.snapshotAt !== record.snapshotAt) fail("CBOE_TIMESTAMP_MISMATCH");
  const result: CboeOptionQuoteRow = {
    underlyingSymbol: record.underlyingSymbol, root: record.root, optionType: record.optionType,
    expirationDate, strikeCents, contractKey, ...timestamp,
    bidCents: integerOrNull(record.bidCents), askCents: integerOrNull(record.askCents),
    bidSizeContracts: integerOrNull(record.bidSizeContracts), askSizeContracts: integerOrNull(record.askSizeContracts),
    underlyingBidCents: integerOrNull(record.underlyingBidCents), underlyingAskCents: integerOrNull(record.underlyingAskCents),
    impliedVolatility: analyticsOrNull(record.impliedVolatility, "implied_volatility"),
    delta: analyticsOrNull(record.delta, "delta"), gamma: analyticsOrNull(record.gamma, "gamma"),
    theta: analyticsOrNull(record.theta, "theta"), vega: analyticsOrNull(record.vega, "vega"),
    rho: analyticsOrNull(record.rho, "rho"), openInterest: integerOrNull(record.openInterest),
  };
  validateMarkets(result.bidCents, result.askCents);
  validateMarkets(result.underlyingBidCents, result.underlyingAskCents);
  return Object.freeze(result);
}

export function parseCboeOptionQuotesCsv(csv: string): { readonly rows: readonly CboeOptionQuoteRow[]; readonly nonTargetRowCount: number; readonly duplicateRowCount: number } {
  const allRecords = records(csv);
  const headers = allRecords.shift();
  if (!headers || headers.length === 0 || new Set(headers).size !== headers.length || headers.some((header) => !ALLOWED_HEADERS.has(header)) || REQUIRED_HEADERS.some((header) => !headers.includes(header))) fail("CBOE_INVALID_HEADERS");
  const rows: CboeOptionQuoteRow[] = [], indexed = new Map<string, string>();
  let nonTargetRowCount = 0, duplicateRowCount = 0;
  for (const cells of allRecords) {
    if (cells.length !== headers.length) fail("CBOE_CSV_ROW_WIDTH");
    const values = Object.fromEntries(headers.map((header, index) => [header, cells[index]!]));
    const underlying = values.underlying_symbol!;
    if (!/^\^?[A-Z][A-Z0-9./-]{0,19}$/.test(underlying)) fail("CBOE_INVALID_UNDERLYING");
    if (underlying !== "GLD" && underlying !== "IBIT") { nonTargetRowCount += 1; continue; }
    const timestamp = easternTimestamp(values.quote_datetime);
    const expirationDate = date(values.expiration);
    const strikeCents = cents(values.strike!);
    const optionType = values.option_type === "C" ? "CALL" : values.option_type === "P" ? "PUT" : fail("CBOE_INVALID_OPTION_TYPE");
    const root = values.root!;
    const ohlc = [values.open!, values.high!, values.low!, values.close!].map(cents);
    const [open, high, low, close] = ohlc;
    if (high !== null && high !== undefined && low !== null && low !== undefined && high < low) fail("CBOE_INCONSISTENT_OHLC");
    if (high !== null && high !== undefined && low !== null && low !== undefined && [open, close].some((price) => price !== null && price !== undefined && price !== 0 && (price < low || price > high))) fail("CBOE_INCONSISTENT_OHLC");
    const intervalTradeVolume = count(values.trade_volume!);
    const deprecatedUnderlyingPrice = cents(values.implied_underlying_price ?? "");
    const activeUnderlyingPrice = cents(values.active_underlying_price ?? "");
    const row = validateCboeOptionQuoteRow({
      underlyingSymbol: underlying, root, expirationDate, strikeCents, optionType,
      contractKey: `${root}:${expirationDate}:${optionType}:${strikeCents}`, ...timestamp,
      bidCents: cents(values.bid!), askCents: cents(values.ask!),
      bidSizeContracts: count(values.bid_size!), askSizeContracts: count(values.ask_size!),
      underlyingBidCents: cents(values.underlying_bid!), underlyingAskCents: cents(values.underlying_ask!),
      impliedVolatility: decimal(values.implied_volatility ?? "", "implied_volatility"),
      delta: decimal(values.delta ?? "", "delta"), gamma: decimal(values.gamma ?? "", "gamma"),
      theta: decimal(values.theta ?? "", "theta"), vega: decimal(values.vega ?? "", "vega"),
      rho: decimal(values.rho ?? "", "rho"), openInterest: count(values.open_interest ?? ""),
    });
    // All documented economic inputs participate in duplicate detection, even
    // values that this quote-evidence version does not retain for replay. A
    // conflicting interval trade or model input must not be called a duplicate.
    const key = `${row.contractKey}:${row.snapshotAt}`;
    const serialized = JSON.stringify({ row, intervalOhlcCents: ohlc, intervalTradeVolume, deprecatedUnderlyingPrice, activeUnderlyingPrice });
    const previous = indexed.get(key);
    if (previous !== undefined) {
      if (previous !== serialized) fail("CBOE_CONFLICTING_SNAPSHOT");
      duplicateRowCount += 1;
    } else { indexed.set(key, serialized); rows.push(row); }
  }
  return Object.freeze({ rows: Object.freeze(rows), nonTargetRowCount, duplicateRowCount });
}
