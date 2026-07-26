import { BarInterval } from "../../../contracts/CanonicalBar";
import {
  ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE,
  ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE,
  type AlpacaPersonalDailyBarBoundary,
  type AlpacaPersonalDryRunInput,
  type AlpacaPersonalNormalizationPolicy,
} from "./AlpacaPersonalMarketDataContracts";
import type { AlpacaLiveReadSmokeInput } from "./AlpacaPersonalMarketDataLiveSmoke";
import { ALPACA_PERSONAL_EXACT_SYMBOLS } from "./AlpacaPersonalMarketDataPlanner";

const CONFIRMATION_FLAG = "--confirm-alpaca-live-read" as const;
const REQUIRED_VALUE_FLAGS = Object.freeze([
  "--session-date",
  "--daily-start",
  "--session-open",
  "--session-close",
] as const);
const DAY_MS = 86_400_000;
const CLOSURE_BUFFER_SECONDS = 60;

export interface AlpacaLiveReadCommandOptions {
  readonly confirmed: boolean;
  readonly sessionDate: string;
  readonly dailyStart: string;
  readonly sessionOpen: string;
  readonly sessionClose: string;
}

export class AlpacaLiveReadCommandError extends Error {
  public constructor() {
    super("Alpaca live-read command arguments are invalid.");
    this.name = "AlpacaLiveReadCommandError";
  }
}

export function parseAlpacaLiveReadCommandArguments(
  args: readonly string[],
): AlpacaLiveReadCommandOptions {
  const values = new Map<string, string>();
  let confirmations = 0;
  for (const argument of args) {
    if (argument === CONFIRMATION_FLAG) {
      confirmations += 1;
      continue;
    }
    const separator = argument.indexOf("=");
    const name = separator < 0 ? argument : argument.slice(0, separator);
    const value = separator < 0 ? "" : argument.slice(separator + 1);
    if (!REQUIRED_VALUE_FLAGS.includes(name as typeof REQUIRED_VALUE_FLAGS[number])
      || values.has(name) || value.length === 0) throw new AlpacaLiveReadCommandError();
    values.set(name, value);
  }
  if (confirmations > 1 || values.size !== REQUIRED_VALUE_FLAGS.length) {
    throw new AlpacaLiveReadCommandError();
  }
  const options = {
    confirmed: confirmations === 1,
    sessionDate: values.get("--session-date")!,
    dailyStart: values.get("--daily-start")!,
    sessionOpen: values.get("--session-open")!,
    sessionClose: values.get("--session-close")!,
  };
  validateOptions(options);
  return deepFreeze(options);
}

export function createAlpacaLiveReadSmokeInput(
  options: Readonly<AlpacaLiveReadCommandOptions>,
  environment: Readonly<Record<string, string | undefined>>,
  clock?: { now(): string },
): AlpacaLiveReadSmokeInput {
  validateOptions(options);
  const plannedAt = clock?.now() ?? new Date().toISOString();
  validateCompletedSession(options, plannedAt);
  const dailyWindowEnd = new Date(Date.parse(options.dailyStart) + DAY_MS).toISOString();
  const plan: AlpacaPersonalDryRunInput = {
    planId: `personal-alpaca:live-read-smoke:${options.sessionDate}`,
    symbols: ALPACA_PERSONAL_EXACT_SYMBOLS,
    plannedAt,
    windows: [
      { interval: BarInterval.OneDay, startTime: options.dailyStart, endTime: dailyWindowEnd, maxRecords: 100 },
      { interval: BarInterval.OneHour, startTime: options.sessionOpen, endTime: options.sessionClose, maxRecords: 200 },
      { interval: BarInterval.FifteenMinutes, startTime: options.sessionOpen, endTime: options.sessionClose, maxRecords: 500 },
      { interval: BarInterval.FiveMinutes, startTime: options.sessionOpen, endTime: options.sessionClose, maxRecords: 1_000 },
    ],
  };
  const policy: AlpacaPersonalNormalizationPolicy = {
    policyId: "alpaca-personal:live-read-normalization:1",
    version: "1.0",
    closureBufferSeconds: CLOSURE_BUFFER_SECONDS,
    quoteMaxAgeSeconds: 120,
    barMaxAgeSeconds: {
      [BarInterval.OneMinute]: 604_800,
      [BarInterval.FiveMinutes]: 259_200,
      [BarInterval.FifteenMinutes]: 259_200,
      [BarInterval.OneHour]: 259_200,
      [BarInterval.OneDay]: 604_800,
    },
    roundLotSize: 100,
  };
  const dailyBoundaries: readonly AlpacaPersonalDailyBarBoundary[] =
    ALPACA_PERSONAL_EXACT_SYMBOLS.map((symbol) => ({
      symbol,
      intervalStart: options.dailyStart,
      intervalEnd: options.sessionClose,
      sessionDate: options.sessionDate,
    }));
  const credentialEnvironment = {
    [ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE]: environment[ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE],
    [ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE]: environment[ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE],
  };
  return deepFreeze({
    confirmed: options.confirmed,
    plan,
    policy,
    dailyBoundaries,
    environment: credentialEnvironment,
    ...(clock === undefined ? {} : { clock }),
  });
}

function validateOptions(options: Readonly<AlpacaLiveReadCommandOptions>): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(options.sessionDate)
    || !isTimestamp(options.dailyStart)
    || !isTimestamp(options.sessionOpen)
    || !isTimestamp(options.sessionClose)
    || options.dailyStart.slice(0, 10) !== options.sessionDate) {
    throw new AlpacaLiveReadCommandError();
  }
  const start = Date.parse(options.dailyStart);
  const open = Date.parse(options.sessionOpen);
  const close = Date.parse(options.sessionClose);
  if (start > open || open >= close || close >= start + DAY_MS
    || close - open < 3_600_000 || close - open > 43_200_000) {
    throw new AlpacaLiveReadCommandError();
  }
}

function validateCompletedSession(
  options: Readonly<AlpacaLiveReadCommandOptions>,
  plannedAt: string,
): void {
  if (!isTimestamp(plannedAt)) throw new AlpacaLiveReadCommandError();
  const closureThreshold = Date.parse(plannedAt) - CLOSURE_BUFFER_SECONDS * 1_000;
  if (Date.parse(options.sessionClose) > closureThreshold) {
    throw new AlpacaLiveReadCommandError();
  }
}

function isTimestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
