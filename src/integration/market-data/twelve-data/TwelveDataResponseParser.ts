import {
  TwelveDataValidationIssueCode,
  type TwelveDataAdapterIssue,
  type TwelveDataParsedResponse,
} from "../../../contracts/TwelveDataAdapter";

const MAX_RESPONSE_BYTES = 2_000_000;

/** Parses bounded JSON only. It performs no provider-field inference or repair. */
export function parseTwelveDataResponse(body: unknown): TwelveDataParsedResponse {
  if (typeof body !== "string" || body.length === 0 || body.length > MAX_RESPONSE_BYTES) {
    return rejected("Response body is absent or exceeds the bounded parser limit.");
  }
  try {
    const payload: unknown = JSON.parse(body);
    if (!isRecord(payload)) return rejected("Response root must be an object.");
    return deepFreeze({ status: "PARSED", payload: clone(payload), blockers: [] });
  } catch {
    return rejected("Response body is not valid JSON.");
  }
}

function rejected(message: string): TwelveDataParsedResponse {
  const blocker: TwelveDataAdapterIssue = {
    code: TwelveDataValidationIssueCode.MalformedJson,
    message,
  };
  return deepFreeze({ status: "REJECTED", blockers: [blocker] });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)])) as T;
  return value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
