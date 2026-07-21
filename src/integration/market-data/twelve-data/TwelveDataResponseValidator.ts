import {
  TwelveDataValidationIssueCode,
  type TwelveDataAdapterIssue,
  type TwelveDataInstrumentMapping,
  type TwelveDataResponseValidationResult,
  type TwelveDataValidatedResponse,
} from "../../../contracts/TwelveDataAdapter";
import type { BarInterval } from "../../../contracts/CanonicalBar";

const DECIMAL = /^\d+(?:\.\d+)?$/u;
const DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u;
const INTERVALS: Readonly<Record<BarInterval, string | undefined>> = Object.freeze({
  PT1M: "1min",
  PT5M: "5min",
  PT15M: "15min",
  PT1H: "1h",
  P1D: undefined,
});

/** Validates the documented time_series shape and the exact reviewed request mapping. */
export function validateTwelveDataResponse(
  payload: unknown,
  mapping: Readonly<TwelveDataInstrumentMapping>,
  interval: BarInterval,
): TwelveDataResponseValidationResult {
  if (!isRecord(payload)) return invalid(issue(TwelveDataValidationIssueCode.InvalidMetadata, "Response root is invalid."));
  if (payload.status === "error") {
    const safeCode = typeof payload.code === "number" || typeof payload.code === "string" ? String(payload.code) : "UNKNOWN";
    return invalid(issue(TwelveDataValidationIssueCode.ProviderError, `Provider returned error ${safeCode}.`));
  }
  if (payload.status !== "ok" || !isRecord(payload.meta) || !Array.isArray(payload.values)) {
    return invalid(issue(TwelveDataValidationIssueCode.InvalidMetadata, "Response metadata or values are missing."));
  }
  const expectedInterval = INTERVALS[interval];
  const meta = payload.meta;
  const blockers: TwelveDataAdapterIssue[] = [];
  if (meta.symbol !== mapping.providerSymbol) blockers.push(issue(TwelveDataValidationIssueCode.ProviderIdentityMismatch, "Response symbol does not match the approved mapping.", "meta.symbol"));
  if (meta.exchange !== mapping.providerExchangeId) blockers.push(issue(TwelveDataValidationIssueCode.ProviderIdentityMismatch, "Response exchange does not match the approved mapping.", "meta.exchange"));
  if (meta.mic_code !== undefined && meta.mic_code !== mapping.providerMic) blockers.push(issue(TwelveDataValidationIssueCode.ProviderIdentityMismatch, "Response MIC does not match the approved mapping.", "meta.mic_code"));
  if (meta.interval !== expectedInterval) blockers.push(issue(TwelveDataValidationIssueCode.InvalidMetadata, "Response interval does not match the request.", "meta.interval"));
  if (meta.currency !== mapping.canonicalInstrument.currency) blockers.push(issue(TwelveDataValidationIssueCode.InvalidMetadata, "Response currency does not match the canonical instrument.", "meta.currency"));
  if (meta.type !== undefined && meta.type !== mapping.providerAssetType) blockers.push(issue(TwelveDataValidationIssueCode.InvalidMetadata, "Response asset type does not match the approved mapping.", "meta.type"));
  if (payload.values.length === 0) blockers.push(issue(TwelveDataValidationIssueCode.InvalidRow, "Response contains no bars.", "values"));

  payload.values.forEach((row, rowIndex) => {
    if (!isRecord(row)) {
      blockers.push(issue(TwelveDataValidationIssueCode.InvalidRow, "Bar row must be an object.", "values", rowIndex));
      return;
    }
    for (const field of ["open", "high", "low", "close", "volume"] as const) {
      if (typeof row[field] !== "string" || !DECIMAL.test(row[field])) {
        blockers.push(issue(TwelveDataValidationIssueCode.InvalidRow, `${field} must be a non-negative decimal string.`, field, rowIndex));
      }
    }
    if (typeof row.datetime !== "string" || !DATETIME.test(row.datetime) || !parseProviderUtc(row.datetime)) {
      blockers.push(issue(TwelveDataValidationIssueCode.AmbiguousTimestamp, "Provider datetime must be an exact UTC wall-clock value.", "datetime", rowIndex));
    }
  });

  if (blockers.length > 0) return deepFreeze({ status: "INVALID", blockers: sortIssues(blockers), warnings: [] });
  const data: TwelveDataValidatedResponse = {
    status: "ok",
    meta: {
      symbol: meta.symbol as string,
      interval: meta.interval as string,
      currency: meta.currency as string,
      exchange: meta.exchange as string,
      ...(typeof meta.mic_code === "string" ? { mic_code: meta.mic_code } : {}),
      ...(typeof meta.exchange_timezone === "string" ? { exchange_timezone: meta.exchange_timezone } : {}),
      ...(typeof meta.type === "string" ? { type: meta.type } : {}),
    },
    values: payload.values.map((row) => ({
      datetime: (row as Record<string, string>).datetime!,
      open: (row as Record<string, string>).open!,
      high: (row as Record<string, string>).high!,
      low: (row as Record<string, string>).low!,
      close: (row as Record<string, string>).close!,
      volume: (row as Record<string, string>).volume!,
    })),
  };
  return deepFreeze({ status: "VALID", data, blockers: [], warnings: [] });
}

export function parseTwelveDataUtcDateTime(value: string): string | undefined {
  return parseProviderUtc(value);
}

function parseProviderUtc(value: string): string | undefined {
  const candidate = `${value.replace(" ", "T")}.000Z`;
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === candidate ? candidate : undefined;
}

function invalid(blocker: TwelveDataAdapterIssue): TwelveDataResponseValidationResult {
  return deepFreeze({ status: "INVALID", blockers: [blocker], warnings: [] });
}

function issue(code: TwelveDataValidationIssueCode, message: string, field?: string, rowIndex?: number): TwelveDataAdapterIssue {
  return { code, message, ...(field === undefined ? {} : { field }), ...(rowIndex === undefined ? {} : { rowIndex }) };
}

function sortIssues(values: readonly TwelveDataAdapterIssue[]): TwelveDataAdapterIssue[] {
  return values.map((value) => ({ ...value })).sort((left, right) =>
    `${left.code}|${String(left.rowIndex ?? -1)}|${left.field ?? ""}`.localeCompare(`${right.code}|${String(right.rowIndex ?? -1)}|${right.field ?? ""}`));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
