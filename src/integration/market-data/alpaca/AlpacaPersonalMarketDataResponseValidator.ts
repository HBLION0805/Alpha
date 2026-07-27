import {
  AlpacaPersonalIssueCode,
  AlpacaPersonalRequestKind,
  AlpacaPersonalResponseStatus,
  type AlpacaPersonalIssue,
  type AlpacaPersonalValidatedBar,
  type AlpacaPersonalValidatedQuote,
  type AlpacaPersonalValidatedResponse,
} from "./AlpacaPersonalMarketDataContracts";

const MAX_RESPONSE_CHARACTERS = 1_000_000;

export function validateAlpacaPersonalMarketDataResponse(
  body: unknown,
  kind: AlpacaPersonalRequestKind,
  expectedSymbols: readonly string[],
): AlpacaPersonalValidatedResponse {
  const parsed = parse(body);
  if (parsed.issue !== undefined) return rejected(kind, [parsed.issue]);
  const payload = parsed.payload!;
  if (isRecord(payload) && ("code" in payload || "message" in payload)) {
    return rejected(kind, [issue(AlpacaPersonalIssueCode.ProviderError, "$", "Provider returned an error envelope.")]);
  }
  return kind === AlpacaPersonalRequestKind.LatestQuotes
    ? validateQuotes(payload, expectedSymbols)
    : validateBars(payload, expectedSymbols);
}

function validateQuotes(payload: unknown, expectedSymbols: readonly string[]): AlpacaPersonalValidatedResponse {
  if (!isRecord(payload) || !isRecord(payload.quotes) || Object.keys(payload).some((key) => key !== "quotes")) {
    return rejected(AlpacaPersonalRequestKind.LatestQuotes, [issue(AlpacaPersonalIssueCode.InvalidQuote, "$", "Latest-quotes envelope is invalid.")]);
  }
  const blockers = exactSymbolIssues(payload.quotes, expectedSymbols);
  const quotes: AlpacaPersonalValidatedQuote[] = [];
  for (const symbol of expectedSymbols) {
    const value = payload.quotes[symbol];
    if (!isRecord(value)
      || !exactKeys(value, ["ap", "as", "ax", "bp", "bs", "bx", "c", "t", "z"])
      || !positiveNumber(value.ap) || !nonNegativeInteger(value.as)
      || !positiveNumber(value.bp) || !nonNegativeInteger(value.bs)
      || Number(value.bp) > Number(value.ap)
      || !shortCode(value.ax) || !shortCode(value.bx) || !shortCode(value.z)
      || !Array.isArray(value.c) || !value.c.every(shortCode)
      || !isProviderTimestamp(value.t)) {
      blockers.push(issue(AlpacaPersonalIssueCode.InvalidQuote, `quotes.${symbol}`, "Quote fields, prices, sizes, conditions, or timestamp are invalid."));
      continue;
    }
    quotes.push({
      symbol,
      timestamp: value.t,
      askPrice: decimal(value.ap),
      askSizeRoundLots: String(value.as),
      bidPrice: decimal(value.bp),
      bidSizeRoundLots: String(value.bs),
      askExchange: value.ax,
      bidExchange: value.bx,
      tape: value.z,
      conditions: [...value.c],
    });
  }
  return blockers.length > 0 ? rejected(AlpacaPersonalRequestKind.LatestQuotes, blockers) : accepted(
    AlpacaPersonalRequestKind.LatestQuotes, quotes, [],
  );
}

function validateBars(payload: unknown, expectedSymbols: readonly string[]): AlpacaPersonalValidatedResponse {
  if (!isRecord(payload)
    || !isRecord(payload.bars)
    || !exactKeys(payload, ["bars", "next_page_token"])
    || !(payload.next_page_token === null || typeof payload.next_page_token === "string")) {
    return rejected(AlpacaPersonalRequestKind.Bars, [issue(AlpacaPersonalIssueCode.InvalidBar, "$", "Bars envelope is invalid.")]);
  }
  if (typeof payload.next_page_token === "string" && payload.next_page_token.length > 0) {
    return rejected(AlpacaPersonalRequestKind.Bars, [issue(AlpacaPersonalIssueCode.PaginationForbidden, "next_page_token", "Bounded MVP response must fit one page; automatic pagination is forbidden.")]);
  }
  const blockers = exactSymbolIssues(payload.bars, expectedSymbols);
  const bars: AlpacaPersonalValidatedBar[] = [];
  for (const symbol of expectedSymbols) {
    const rows = payload.bars[symbol];
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 1_000) {
      blockers.push(issue(AlpacaPersonalIssueCode.InvalidBar, `bars.${symbol}`, "Each symbol requires 1 to 1,000 bounded bars."));
      continue;
    }
    let previous = -Infinity;
    rows.forEach((row, index) => {
      if (!isRecord(row)
        || !exactKeys(row, ["c", "h", "l", "n", "o", "t", "v", "vw"])
        || !positiveNumber(row.o) || !positiveNumber(row.h) || !positiveNumber(row.l) || !positiveNumber(row.c)
        || Number(row.l) > Math.min(Number(row.o), Number(row.c))
        || Number(row.h) < Math.max(Number(row.o), Number(row.c))
        || !nonNegativeInteger(row.v) || !nonNegativeInteger(row.n)
        || !positiveNumber(row.vw) || !isProviderTimestamp(row.t)
        || Date.parse(String(row.t)) <= previous) {
        blockers.push(issue(AlpacaPersonalIssueCode.InvalidBar, `bars.${symbol}[${index}]`, "Bar fields, OHLC relationship, quantities, or chronology are invalid."));
        return;
      }
      previous = Date.parse(row.t);
      bars.push({
        symbol,
        timestamp: row.t,
        open: decimal(row.o),
        high: decimal(row.h),
        low: decimal(row.l),
        close: decimal(row.c),
        volume: String(row.v),
        tradeCount: String(row.n),
        vwap: decimal(row.vw),
      });
    });
  }
  return blockers.length > 0 ? rejected(AlpacaPersonalRequestKind.Bars, blockers) : accepted(
    AlpacaPersonalRequestKind.Bars, [], bars,
  );
}

function exactSymbolIssues(value: Record<string, unknown>, expectedSymbols: readonly string[]): AlpacaPersonalIssue[] {
  const issues: AlpacaPersonalIssue[] = [];
  for (const symbol of Object.keys(value)) {
    if (!expectedSymbols.includes(symbol)) issues.push(issue(AlpacaPersonalIssueCode.UnexpectedSymbol, symbol, "Provider returned an undeclared symbol."));
  }
  for (const symbol of expectedSymbols) {
    if (!(symbol in value)) issues.push(issue(AlpacaPersonalIssueCode.MissingSymbol, symbol, "Provider omitted a required symbol."));
  }
  return issues;
}

function parse(body: unknown): { readonly payload?: unknown; readonly issue?: AlpacaPersonalIssue } {
  if (typeof body !== "string" || body.length === 0 || body.length > MAX_RESPONSE_CHARACTERS) {
    return { issue: issue(AlpacaPersonalIssueCode.MalformedJson, "$", "Response is absent or exceeds the parser bound.") };
  }
  try {
    return { payload: JSON.parse(body) as unknown };
  } catch {
    return { issue: issue(AlpacaPersonalIssueCode.MalformedJson, "$", "Response is not valid JSON.") };
  }
}

function accepted(
  kind: AlpacaPersonalRequestKind,
  quotes: readonly AlpacaPersonalValidatedQuote[],
  bars: readonly AlpacaPersonalValidatedBar[],
): AlpacaPersonalValidatedResponse {
  return deepFreeze({ status: AlpacaPersonalResponseStatus.Valid, kind, quotes, bars, blockers: [], coverage: "SINGLE_VENUE", feed: "iex" });
}

function rejected(kind: AlpacaPersonalRequestKind, blockers: readonly AlpacaPersonalIssue[]): AlpacaPersonalValidatedResponse {
  return deepFreeze({
    status: AlpacaPersonalResponseStatus.Rejected,
    kind,
    quotes: [],
    bars: [],
    blockers: [...blockers].sort((left, right) => `${left.field}:${left.code}`.localeCompare(`${right.field}:${right.code}`)),
    coverage: "SINGLE_VENUE",
    feed: "iex",
  });
}

function issue(code: AlpacaPersonalIssueCode, field: string, message: string): AlpacaPersonalIssue {
  return { code, field, message };
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function positiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && Number.isSafeInteger(value * 1_000_000_000);
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function shortCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z0-9]{1,8}$/u.test(value);
}

function isProviderTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u.test(value)
    && Number.isFinite(Date.parse(value));
}

function decimal(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(9).replace(/0+$/u, "").replace(/\.$/u, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
