import { equal, harness, throws, truth } from "../../engines/options-market-context/testing/OptionsContextTestSupport";
import { parseCboeOptionQuotesCsv, validateCboeOptionQuoteRow } from "./CboeOptionQuotesCsv";

const h = harness("Cboe Option Quotes CSV");
const basic = {
  underlying_symbol: "GLD", quote_datetime: "2026-09-04 10:00:00", root: "GLD", expiration: "2026-09-25", strike: "400.00", option_type: "C",
  open: "0.20", high: "0.22", low: "0.19", close: "0.21", trade_volume: "10", bid_size: "5", bid: "0.20", ask_size: "8", ask: "0.22", underlying_bid: "400.00", underlying_ask: "400.02",
};
const analytics = { implied_underlying_price: "0", active_underlying_price: "400.01", implied_volatility: "0.2500", delta: "0.400", gamma: "0.020", theta: "-0.010", vega: "0.090", rho: "0.001", open_interest: "30" };
function csv(changes: Record<string, string> = {}, extra: Record<string, string> = {}): string {
  const row = { ...basic, ...extra, ...changes };
  return `${Object.keys(row).join(",")}\n${Object.values(row).join(",")}\n`;
}
function row(changes: Record<string, string> = {}, extra: Record<string, string> = {}) { return parseCboeOptionQuotesCsv(csv(changes, extra)).rows[0]!; }
const normalized = row();

h.test("source contract identity and Eastern summer time normalize exactly", () => {
  equal(normalized.contractKey, "GLD:2026-09-25:CALL:40000");
  equal(normalized.snapshotAt, "2026-09-04T14:00:00.000Z");
  equal(normalized.quoteDatetimeEt, "2026-09-04 10:00:00");
  equal(normalized.bidCents, 20); equal(normalized.askSizeContracts, 8);
  equal(normalized.impliedVolatility, null); equal(normalized.openInterest, null);
});
h.test("IBIT put and adjusted target root remain distinct evidence identities", () => {
  const value = row({ underlying_symbol: "IBIT", root: "IBIT1", option_type: "P", strike: "55.50" });
  equal(value.contractKey, "IBIT1:2026-09-25:PUT:5550"); equal(value.underlyingSymbol, "IBIT");
});
h.test("winter time uses Eastern standard offset", () => { equal(row({ quote_datetime: "2026-01-05 09:30:00" }).snapshotAt, "2026-01-05T14:30:00.000Z"); });
for (const [local, utc] of [["2026-03-08 01:59:59", "2026-03-08T06:59:59.000Z"], ["2026-03-08 03:00:00", "2026-03-08T07:00:00.000Z"], ["2026-11-01 00:59:59", "2026-11-01T04:59:59.000Z"], ["2026-11-01 02:00:00", "2026-11-01T07:00:00.000Z"]]) {
  h.test(`DST boundary ${local} preserves its unique instant`, () => { equal(row({ quote_datetime: local! }).snapshotAt, utc); });
}
for (const local of ["2026-03-08 02:00:00", "2026-03-08 02:59:59", "2026-11-01 01:00:00", "2026-11-01 01:59:59"]) {
  h.test(`ambiguous or absent local time ${local} rejects`, () => { throws(() => row({ quote_datetime: local }), "CBOE_AMBIGUOUS_OR_NONEXISTENT_ET_TIMESTAMP"); });
}
h.test("calendar validation accepts leap date and rejects normalization of invalid dates", () => {
  equal(row({ quote_datetime: "2024-02-29 10:00:00", expiration: "2024-03-15" }).snapshotAt, "2024-02-29T15:00:00.000Z");
  for (const date of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01"]) throws(() => row({ expiration: date }), "CBOE_INVALID_DATE");
});
h.test("timestamp rejects timezone suffix, omitted seconds, and invalid time components", () => {
  for (const value of ["2026-09-04T10:00:00Z", "2026-09-04 10:00", "2026-09-04 24:00:00", "2026-09-04 10:60:00", "2026-09-04 10:00:60"]) throws(() => row({ quote_datetime: value }), "CBOE_INVALID_ET_TIMESTAMP");
});
h.test("quoted cells BOM and CRLF are accepted with arbitrary documented header order", () => {
  const entries = Object.entries(basic).reverse();
  const encoded = `\uFEFF${entries.map(([key]) => `"${key}"`).join(",")}\r\n${entries.map(([, value]) => `"${value}"`).join(",")}\r\n`;
  equal(parseCboeOptionQuotesCsv(encoded).rows[0], normalized);
});
h.test("optional analytics normalize exact decimals and retain signs", () => {
  const value = row({}, analytics);
  equal([value.impliedVolatility, value.delta, value.gamma, value.theta, value.vega, value.rho, value.openInterest], ["0.25", "0.4", "0.02", "-0.01", "0.09", "0.001", 30]);
});
h.test("source IV zero and empty fields never invent confidence or liquidity", () => {
  const value = row({ bid: "", ask: "", bid_size: "", ask_size: "", underlying_bid: "", underlying_ask: "" }, { implied_volatility: "0.0000", delta: "-0.0" });
  equal([value.bidCents, value.askCents, value.bidSizeContracts, value.askSizeContracts, value.underlyingBidCents, value.underlyingAskCents, value.impliedVolatility], [null, null, null, null, null, null, null]);
  equal(value.delta, "0");
});
h.test("zero known quote size remains zero and is distinct from unknown", () => { equal(row({ bid_size: "0", ask_size: "" }).bidSizeContracts, 0); });
h.test("extra zero fractional money digits normalize without rounding", () => { equal(row({ ask: "0.22000", strike: "400.000" }), normalized); });
for (const field of ["strike", "bid", "ask", "underlying_bid", "underlying_ask", "open", "high", "low", "close"]) {
  h.test(`sub-cent ${field} rejects`, () => { throws(() => row({ [field]: "0.221" }), "CBOE_SUBCENT_MONEY"); });
}
h.test("prices reject coercion, scientific notation, signs, whitespace and unsafe integers", () => {
  for (const value of ["NaN", "Infinity", "1e2", "+1", "-1", " 0.20", "0.20 ", "01.00"]) throws(() => row({ bid: value }), "CBOE_INVALID_MONEY");
  throws(() => row({ ask: "90071992547409.92" }), "CBOE_UNSAFE_MONEY");
});
h.test("counts reject fractional, negative and unsafe values", () => {
  for (const value of ["1.5", "-1", "1e2", "NaN"]) throws(() => row({ bid_size: value }), "CBOE_INVALID_COUNT");
  throws(() => row({ bid_size: "9007199254740992" }), "CBOE_UNSAFE_COUNT");
});
h.test("analytic domains and exact delta boundary reject invalid input", () => {
  for (const extra of [{ implied_volatility: "-0.1" }, { gamma: "-0.1" }, { vega: "-0.1" }, { delta: "1.000000000000000001" }, { delta: "-1.000000000000000001" }, { theta: "NaN" }]) throws(() => row({}, extra), "CBOE_INVALID_ANALYTIC");
  equal(row({}, { delta: "-1.000" }).delta, "-1");
});
h.test("unknown or duplicate headers reject", () => {
  throws(() => parseCboeOptionQuotesCsv(csv({}, { approved: "true" })), "CBOE_INVALID_HEADERS");
  throws(() => parseCboeOptionQuotesCsv(csv().replace("ask_size", "bid_size")), "CBOE_INVALID_HEADERS");
});
h.test("all documented base columns are mandatory", () => {
  for (const removed of Object.keys(basic)) {
    const entries = Object.entries(basic).filter(([key]) => key !== removed);
    throws(() => parseCboeOptionQuotesCsv(`${entries.map(([key]) => key).join(",")}\n${entries.map(([, value]) => value).join(",")}`), "CBOE_INVALID_HEADERS");
  }
});
h.test("row width and truncated quotes reject", () => {
  throws(() => parseCboeOptionQuotesCsv(csv().replace(",400.02\n", "\n")), "CBOE_CSV_ROW_WIDTH");
  throws(() => parseCboeOptionQuotesCsv(`${csv()}"unterminated`), "CBOE_CSV_UNTERMINATED_QUOTE");
});
h.test("embedded quotes are RFC4180-parsed but invalid for numeric data", () => {
  throws(() => parseCboeOptionQuotesCsv(csv().replace(",0.20,8,", ',"0.2""0",8,')), "CBOE_INVALID_MONEY");
  throws(() => parseCboeOptionQuotesCsv(csv().replace(",0.20,8,", ',"0.20"x,8,')), "CBOE_CSV_AFTER_QUOTE");
});
h.test("bare quotes, control bytes and lone CR reject", () => {
  throws(() => parseCboeOptionQuotesCsv(csv().replace(",0.20,8,", ',0."20,8,')), "CBOE_CSV_UNEXPECTED_QUOTE");
  throws(() => parseCboeOptionQuotesCsv(`${csv()}\0`), "CBOE_CSV_CONTROL_CHARACTER");
  throws(() => parseCboeOptionQuotesCsv(csv().replace(/\n/g, "\r")), "CBOE_CSV_LINE_ENDING");
});
h.test("row, cell and byte limits reject without truncation", () => {
  const [header, data] = csv().trimEnd().split("\n");
  throws(() => parseCboeOptionQuotesCsv(`${header}\n${`${data}\n`.repeat(10_001)}`), "CBOE_CSV_ROW_LIMIT");
  throws(() => parseCboeOptionQuotesCsv(`"${"a".repeat(401)}"`), "CBOE_CSV_CELL_LIMIT");
  throws(() => parseCboeOptionQuotesCsv("a".repeat(4 * 1024 * 1024 + 1)), "CBOE_CSV_BYTE_LIMIT");
});
h.test("safe non-target symbols are counted without becoming trade inputs", () => {
  const report = parseCboeOptionQuotesCsv(csv({ underlying_symbol: "^SPX", root: "SPX" }));
  equal(report.rows, []); equal(report.nonTargetRowCount, 1);
  throws(() => row({ underlying_symbol: "=GLD" }), "CBOE_INVALID_UNDERLYING");
});
h.test("malformed target identities reject", () => {
  throws(() => row({ root: "GLD:evil" }), "CBOE_INVALID_ROOT");
  throws(() => row({ option_type: "CALL" }), "CBOE_INVALID_OPTION_TYPE");
  throws(() => row({ strike: "0" }), "CBOE_INVALID_STRIKE");
});
h.test("crossed options and underlying markets reject", () => {
  throws(() => row({ bid: "0.23" }), "CBOE_CROSSED_MARKET");
  throws(() => row({ underlying_bid: "400.03" }), "CBOE_CROSSED_MARKET");
});
h.test("inconsistent interval OHLC rejects without claiming its trade path", () => {
  throws(() => row({ high: "0.18" }), "CBOE_INCONSISTENT_OHLC");
  throws(() => row({ close: "0.25" }), "CBOE_INCONSISTENT_OHLC");
  truth(row({ open: "0", high: "0", low: "0", close: "0", trade_volume: "0" }));
});
h.test("identical economic snapshots dedupe across decimal encodings", () => {
  const first = csv({}, analytics), second = csv({ ask: "0.2200" }, { ...analytics, delta: "0.40" }).split("\n")[1];
  const report = parseCboeOptionQuotesCsv(`${first}${second}\n`);
  equal(report.rows.length, 1); equal(report.duplicateRowCount, 1);
});
h.test("same contract timestamp with changed quote or size is a conflict", () => {
  for (const change of [{ ask: "0.23" }, { bid_size: "6" }]) {
    throws(() => parseCboeOptionQuotesCsv(`${csv()}${csv(change).split("\n")[1]}\n`), "CBOE_CONFLICTING_SNAPSHOT");
  }
});
h.test("conflicting valid interval OHLC or volume cannot disappear in quote-only dedupe", () => {
  for (const change of [{ open: "0.21" }, { high: "0.23" }, { low: "0.18" }, { close: "0.20" }, { trade_volume: "999" }]) {
    throws(() => parseCboeOptionQuotesCsv(`${csv()}${csv(change).split("\n")[1]}\n`), "CBOE_CONFLICTING_SNAPSHOT");
  }
});
h.test("model underlying price revisions conflict even though these fields are not retained", () => {
  for (const change of [{ active_underlying_price: "400.02" }, { implied_underlying_price: "400.01" }]) {
    throws(() => parseCboeOptionQuotesCsv(`${csv({}, analytics)}${csv(change, analytics).split("\n")[1]}\n`), "CBOE_CONFLICTING_SNAPSHOT");
  }
});
h.test("discarded economic fields normalize decimal encodings for exact duplicates", () => {
  const first = csv({}, analytics);
  const second = csv({ open: "0.2000", high: "0.2200", low: "0.1900", close: "0.21000", implied_underlying_price: "0.0000", active_underlying_price: "400.01000" }, analytics).split("\n")[1];
  const report = parseCboeOptionQuotesCsv(`${first}${second}\n`);
  equal(report.rows.length, 1); equal(report.duplicateRowCount, 1);
  equal(Object.hasOwn(report.rows[0]!, "intervalTradeVolume"), false);
  equal(Object.hasOwn(report.rows[0]!, "activeUnderlyingPrice"), false);
});
h.test("distinct snapshot times retain observations in original order", () => {
  const report = parseCboeOptionQuotesCsv(`${csv()}${csv({ quote_datetime: "2026-09-04 10:01:00" }).split("\n")[1]}\n`);
  equal(report.rows.length, 2); equal(report.rows[1]!.snapshotAt, "2026-09-04T14:01:00.000Z");
});
h.test("normalization and rehydration are immutable and equivalent", () => {
  const report = parseCboeOptionQuotesCsv(csv());
  equal(validateCboeOptionQuoteRow(JSON.parse(JSON.stringify(normalized))), normalized);
  truth(Object.isFrozen(report) && Object.isFrozen(report.rows) && Object.isFrozen(normalized));
});
h.test("rehydration rejects authority fields, missing fields and identity mismatch", () => {
  throws(() => validateCboeOptionQuoteRow({ ...normalized, verified: true }), "CBOE_INVALID_NORMALIZED_FIELDS");
  const { snapshotAt: ignored, ...missing } = normalized; void ignored;
  throws(() => validateCboeOptionQuoteRow(missing), "CBOE_INVALID_NORMALIZED_FIELDS");
  throws(() => validateCboeOptionQuoteRow({ ...normalized, contractKey: "IBIT:2026-09-25:CALL:40000" }), "CBOE_CONTRACT_IDENTITY_MISMATCH");
});
h.test("rehydration recomputes time and validates finite integers and canonical analytics", () => {
  throws(() => validateCboeOptionQuoteRow({ ...normalized, snapshotAt: "2026-09-04T15:00:00.000Z" }), "CBOE_TIMESTAMP_MISMATCH");
  for (const bidCents of ["20", NaN, Infinity, 20.1, -1, -0]) throws(() => validateCboeOptionQuoteRow({ ...normalized, bidCents }), "CBOE_INVALID_NORMALIZED_INTEGER");
  throws(() => validateCboeOptionQuoteRow({ ...normalized, impliedVolatility: "0" }), "CBOE_INVALID_NORMALIZED_ANALYTIC");
  throws(() => validateCboeOptionQuoteRow({ ...normalized, delta: "0.400" }), "CBOE_INVALID_NORMALIZED_ANALYTIC");
});
h.finish();
