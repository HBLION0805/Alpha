import type { OptionContract, OptionQuote, OptionQuoteQualification } from "../../contracts/OptionsContractQuote";

// Input bounds prevent accidental unbounded arithmetic in downstream local simulation.
const MAX_PRICE_CENTS = 100_000_000;
// The maximum price * displayed size * multiplier also stays within safe integer cents.
const MAX_SIZE_CONTRACTS = 100_000;
const CONTRACT_FIELDS = ["contractId", "symbol", "optionType", "strikePriceCents", "expiryDate", "multiplier", "minimumPriceTickCents", "deliverable", "exerciseStyle"];
const QUOTE_FIELDS = ["quoteId", "contractId", "observedAt", "receivedAt", "bidPerShareCents", "askPerShareCents", "bidSizeContracts", "askSizeContracts", "underlyingPriceCents", "sourceId", "origin", "session", "ivBps", "deltaBps"];
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,159}$/u;
const LOCAL_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function exactRecord(input: unknown, fields: readonly string[], kind: string): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error(`INVALID_${kind}`);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(input);
  if (keys.length !== fields.length || keys.some((key) => typeof key !== "string" || !fields.includes(key))
      || fields.some((key) => !Object.hasOwn(descriptors, key) || !Object.hasOwn(descriptors[key]!, "value"))) {
    throw new Error(`INVALID_${kind}_FIELDS`);
  }
  return input as Record<string, unknown>;
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= minimum && value <= maximum;
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function date(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

/** Copies scalar fields into a frozen snapshot; never normalizes an invalid identity. */
export function validateOptionContract(input: unknown): OptionContract {
  const value = exactRecord(input, CONTRACT_FIELDS, "OPTION_CONTRACT");
  if ((value.symbol !== "GLD" && value.symbol !== "IBIT")
      || (value.optionType !== "CALL" && value.optionType !== "PUT")
      || !integer(value.strikePriceCents, 1, MAX_PRICE_CENTS) || !date(value.expiryDate)
      || value.multiplier !== 100 || !integer(value.minimumPriceTickCents, 1, 100)
      || value.deliverable !== "STANDARD_100_SHARES_USD" || value.exerciseStyle !== "AMERICAN") {
    throw new Error("INVALID_OPTION_CONTRACT");
  }
  const contractId = `${value.symbol}:${value.expiryDate}:${value.optionType}:${value.strikePriceCents}`;
  if (value.contractId !== contractId) throw new Error("OPTION_CONTRACT_ID_MISMATCH");
  return Object.freeze({
    contractId, symbol: value.symbol, optionType: value.optionType,
    strikePriceCents: value.strikePriceCents, expiryDate: value.expiryDate,
    multiplier: 100, minimumPriceTickCents: value.minimumPriceTickCents,
    deliverable: "STANDARD_100_SHARES_USD", exerciseStyle: "AMERICAN",
  });
}

/** Validates structure without an as-of clock; historical/future data may be stored but not used early. */
export function validateOptionQuote(input: unknown, contractInput: OptionContract): OptionQuote {
  const contract = validateOptionContract(contractInput);
  const value = exactRecord(input, QUOTE_FIELDS, "OPTION_QUOTE");
  if (typeof value.quoteId !== "string" || !IDENTIFIER.test(value.quoteId)
      || !timestamp(value.observedAt) || !timestamp(value.receivedAt)
      || !integer(value.bidPerShareCents, 0, MAX_PRICE_CENTS)
      || !integer(value.askPerShareCents, 1, MAX_PRICE_CENTS)
      || !integer(value.bidSizeContracts, 0, MAX_SIZE_CONTRACTS)
      || !integer(value.askSizeContracts, 0, MAX_SIZE_CONTRACTS)
      || !integer(value.underlyingPriceCents, 1, MAX_PRICE_CENTS)
      || typeof value.sourceId !== "string" || !IDENTIFIER.test(value.sourceId)
      || (value.origin !== "SYNTHETIC_FIXTURE" && value.origin !== "UNVERIFIED_IMPORT")
      || (value.session !== "REGULAR" && value.session !== "CLOSED")
      || (value.ivBps !== null && !integer(value.ivBps, 0, 1_000_000))
      || (value.deltaBps !== null && !integer(value.deltaBps, -10_000, 10_000))) {
    throw new Error("INVALID_OPTION_QUOTE");
  }
  if (value.contractId !== contract.contractId) throw new Error("OPTION_QUOTE_CONTRACT_MISMATCH");
  if (value.receivedAt < value.observedAt) throw new Error("OPTION_QUOTE_TIME_ORDER_INVALID");
  if (value.bidPerShareCents > value.askPerShareCents) throw new Error("OPTION_QUOTE_CROSSED_MARKET");
  if (value.bidPerShareCents % contract.minimumPriceTickCents !== 0
      || value.askPerShareCents % contract.minimumPriceTickCents !== 0) throw new Error("OPTION_QUOTE_OFF_TICK");
  const sourcePrefix = value.origin === "SYNTHETIC_FIXTURE" ? "synthetic:" : "import:";
  if (!value.sourceId.startsWith(sourcePrefix) || value.sourceId.length === sourcePrefix.length) {
    throw new Error("OPTION_QUOTE_SOURCE_ORIGIN_MISMATCH");
  }
  if (value.deltaBps !== null && ((contract.optionType === "CALL" && value.deltaBps < 0)
      || (contract.optionType === "PUT" && value.deltaBps > 0))) throw new Error("OPTION_QUOTE_DELTA_SIGN_INVALID");
  return Object.freeze({
    quoteId: value.quoteId, contractId: contract.contractId,
    observedAt: value.observedAt, receivedAt: value.receivedAt,
    bidPerShareCents: value.bidPerShareCents, askPerShareCents: value.askPerShareCents,
    bidSizeContracts: value.bidSizeContracts, askSizeContracts: value.askSizeContracts,
    underlyingPriceCents: value.underlyingPriceCents, sourceId: value.sourceId,
    origin: value.origin, session: value.session, ivBps: value.ivBps, deltaBps: value.deltaBps,
  });
}

function localSession(value: string): { date: string; regularWindow: boolean; seconds: number } {
  const fields = Object.fromEntries(LOCAL_TIME.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  const seconds = Number(fields.hour) * 3600 + Number(fields.minute) * 60 + Number(fields.second);
  return {
    date: `${fields.year!.padStart(4, "0")}-${fields.month}-${fields.day}`,
    regularWindow: !["Sat", "Sun"].includes(fields.weekday!) && seconds >= 9 * 3600 + 30 * 60 && seconds < 16 * 3600,
    seconds,
  };
}

/**
 * Conservative local-simulation window only: weekdays 09:30 <= ET < 16:00.
 * No verified holiday/early-close calendar or actual exchange session is available.
 * Zero displayed size is retained here; each fill must check its relevant side separately.
 */
export function qualifyOptionQuote(quoteInput: OptionQuote, contractInput: OptionContract, asOf: string): OptionQuoteQualification {
  if (!timestamp(asOf)) throw new Error("INVALID_OPTION_QUOTE_AS_OF");
  const contract = validateOptionContract(contractInput);
  const quote = validateOptionQuote(quoteInput, contract);
  const current = localSession(asOf);
  const observed = localSession(quote.observedAt);
  const reasons: string[] = [];
  if (quote.receivedAt > asOf) reasons.push("OPTION_QUOTE_NOT_YET_RECEIVED");
  if (quote.observedAt > asOf) reasons.push("OPTION_QUOTE_OBSERVED_IN_FUTURE");
  if (Date.parse(asOf) - Date.parse(quote.observedAt) > 60_000) reasons.push("OPTION_QUOTE_STALE");
  if (quote.session !== "REGULAR") reasons.push("OPTION_QUOTE_SESSION_CLOSED");
  if (!observed.regularWindow || !current.regularWindow) reasons.push("OPTION_QUOTE_OUTSIDE_REGULAR_WINDOW");
  if (current.date > contract.expiryDate || (current.date === contract.expiryDate && current.seconds >= 16 * 3600)) {
    reasons.push("OPTION_CONTRACT_EXPIRED");
  }
  return Object.freeze({ eligible: reasons.length === 0, reasons: Object.freeze(reasons) });
}
