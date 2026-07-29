export const
TWELVE_DATA_PERSONAL_MULS_REFERENCE_ERROR_MAX_BODY_CHARACTERS = 4_096;
export const
TWELVE_DATA_PERSONAL_MULS_REFERENCE_ERROR_MAX_MESSAGE_CHARACTERS = 240;

export interface TwelveDataPersonalMulsReferenceProviderErrorDiagnostic {
  readonly status?: "error";
  readonly code?: number;
  readonly message?: string;
  readonly messageTruncated: boolean;
}

export function parseTwelveDataPersonalMulsReferenceProviderError(
  body: string,
  secrets: readonly string[],
): TwelveDataPersonalMulsReferenceProviderErrorDiagnostic | undefined {
  if (typeof body !== "string"
    || body.length === 0
    || body.length >
      TWELVE_DATA_PERSONAL_MULS_REFERENCE_ERROR_MAX_BODY_CHARACTERS
    || !Array.isArray(secrets)
    || secrets.some((secret) => typeof secret !== "string")) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }
  return sanitizeTwelveDataPersonalMulsReferenceProviderError(
    parsed,
    secrets,
  );
}

export function sanitizeTwelveDataPersonalMulsReferenceProviderError(
  value: unknown,
  secrets: readonly string[],
): TwelveDataPersonalMulsReferenceProviderErrorDiagnostic | undefined {
  if (!isRecord(value)
    || !Array.isArray(secrets)
    || secrets.some((secret) => typeof secret !== "string")) {
    return undefined;
  }
  let status: "error" | undefined;
  let code: number | undefined;
  let messageResult:
    Readonly<{ message: string; truncated: boolean }> | undefined;
  try {
    status = value.status === "error" ? "error" : undefined;
    code = typeof value.code === "number"
      && Number.isSafeInteger(value.code)
      && value.code >= 100
      && value.code <= 599
      ? value.code
      : undefined;
    messageResult = typeof value.message === "string"
      ? sanitizeMessage(value.message, secrets)
      : undefined;
  } catch {
    return undefined;
  }
  if (status === undefined
    && code === undefined
    && messageResult === undefined) {
    return undefined;
  }

  return Object.freeze({
    ...(status === undefined ? {} : { status }),
    ...(code === undefined ? {} : { code }),
    ...(messageResult === undefined ? {} : { message: messageResult.message }),
    messageTruncated: messageResult?.truncated ?? false,
  });
}

function sanitizeMessage(
  message: string,
  secrets: readonly string[],
): Readonly<{ message: string; truncated: boolean }> | undefined {
  let sanitized = message;
  for (const secret of [...secrets]
    .filter((value) => value.length > 0)
    .sort((left, right) => right.length - left.length)) {
    sanitized = sanitized.replaceAll(secret, "[REDACTED]");
  }
  sanitized = sanitized
    .replace(
      /\b(?:api[_ -]?key|apikey|authorization)\b\s*[:=]\s*(?:(?:bearer|apikey)\s+)?[^\s,;}"']+/giu,
      "credential=[REDACTED]",
    )
    .replace(/[A-Fa-f0-9]{32}/gu, "[REDACTED]")
    .replace(/[\u0000-\u001F\u007F-\u009F]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (sanitized.length === 0) return undefined;

  const characters = Array.from(sanitized);
  const truncated = characters.length >
    TWELVE_DATA_PERSONAL_MULS_REFERENCE_ERROR_MAX_MESSAGE_CHARACTERS;
  return Object.freeze({
    message: characters.slice(
      0,
      TWELVE_DATA_PERSONAL_MULS_REFERENCE_ERROR_MAX_MESSAGE_CHARACTERS,
    ).join(""),
    truncated,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
