import { TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE } from "./TwelveDataContracts";
import {
  TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION,
  type TwelveDataPersonalMulsReferenceLiveOperationInput,
} from "./TwelveDataPersonalMulsReferenceLiveOperation";

export const TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION_FLAG =
  "--confirm-live-reference-diagnostic" as const;
const AUTHORIZATION_DATE_PREFIX = "--authorization-date=";
const REQUEST_FINGERPRINT_PREFIX = "--request-fingerprint=";

export interface TwelveDataPersonalMulsReferenceCommandOptions {
  readonly confirmed: boolean;
  readonly authorizationDateUtc?: string;
  readonly requestFingerprint?: string;
}

export class TwelveDataPersonalMulsReferenceCommandError extends Error {
  public constructor() {
    super("Twelve Data MULS reference command arguments are invalid.");
    this.name = "TwelveDataPersonalMulsReferenceCommandError";
  }
}

export function parseTwelveDataPersonalMulsReferenceCommandArguments(
  args: readonly string[],
): TwelveDataPersonalMulsReferenceCommandOptions {
  if (!Array.isArray(args)) {
    throw new TwelveDataPersonalMulsReferenceCommandError();
  }
  if (args.length === 0) {
    return Object.freeze({ confirmed: false });
  }
  if (args.length !== 3
    || new Set(args).size !== args.length
    || !args.includes(
      TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION_FLAG,
    )) {
    throw new TwelveDataPersonalMulsReferenceCommandError();
  }
  const authorizationDateUtc =
    singlePrefixedArgument(args, AUTHORIZATION_DATE_PREFIX);
  const requestFingerprint =
    singlePrefixedArgument(args, REQUEST_FINGERPRINT_PREFIX);
  if (authorizationDateUtc === undefined
    || requestFingerprint === undefined
    || !isCanonicalDate(authorizationDateUtc)
    || !/^twelve-data-muls-reference:[0-9a-f]{16}$/u
      .test(requestFingerprint)
    || args.some((argument) =>
      argument !== TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION_FLAG
      && !argument.startsWith(AUTHORIZATION_DATE_PREFIX)
      && !argument.startsWith(REQUEST_FINGERPRINT_PREFIX))) {
    throw new TwelveDataPersonalMulsReferenceCommandError();
  }
  return Object.freeze({
    confirmed: true,
    authorizationDateUtc,
    requestFingerprint,
  });
}

export function createTwelveDataPersonalMulsReferenceCommandInput(
  options: Readonly<TwelveDataPersonalMulsReferenceCommandOptions>,
  environment: Readonly<Record<string, string | undefined>>,
): TwelveDataPersonalMulsReferenceLiveOperationInput {
  validateOptions(options);
  return deepFreeze({
    confirmed: options.confirmed,
    ...(options.confirmed
      ? {
          authorization: {
            confirmation:
              TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION,
            operationDateUtc: options.authorizationDateUtc as string,
            requestFingerprint: options.requestFingerprint as string,
          },
        }
      : {}),
    environment: {
      [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]:
        environment[TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE],
    },
  });
}

function validateOptions(
  options: Readonly<TwelveDataPersonalMulsReferenceCommandOptions>,
): void {
  if (!isRecord(options)
    || typeof options.confirmed !== "boolean"
    || Object.keys(options).some((key) =>
      !["authorizationDateUtc", "confirmed", "requestFingerprint"].includes(key))
    || (options.confirmed
      ? typeof options.authorizationDateUtc !== "string"
        || !isCanonicalDate(options.authorizationDateUtc)
        || typeof options.requestFingerprint !== "string"
        || !/^twelve-data-muls-reference:[0-9a-f]{16}$/u
          .test(options.requestFingerprint)
      : options.authorizationDateUtc !== undefined
        || options.requestFingerprint !== undefined)) {
    throw new TwelveDataPersonalMulsReferenceCommandError();
  }
}

function singlePrefixedArgument(
  args: readonly string[],
  prefix: string,
): string | undefined {
  const values = args
    .filter((argument) => argument.startsWith(prefix))
    .map((argument) => argument.slice(prefix.length));
  return values.length === 1 && values[0] !== "" ? values[0] : undefined;
}

function isCanonicalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed)
    && new Date(parsed).toISOString().slice(0, 10) === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}
