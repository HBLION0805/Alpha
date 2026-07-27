import {
  ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE,
  ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE,
} from "./AlpacaPersonalMarketDataContracts";
import type { AlpacaPersonalAssetMetadataDiagnosticInput } from "./AlpacaPersonalAssetMetadataDiagnostic";

export const ALPACA_PERSONAL_MULS_ASSET_CONFIRMATION_FLAG = "--confirm-muls-asset-metadata-read" as const;

export interface AlpacaPersonalAssetMetadataCommandOptions {
  readonly confirmed: boolean;
}

export class AlpacaPersonalAssetMetadataCommandError extends Error {
  public constructor() {
    super("Alpaca MULS asset-metadata command arguments are invalid.");
    this.name = "AlpacaPersonalAssetMetadataCommandError";
  }
}

export function parseAlpacaPersonalAssetMetadataCommandArguments(
  args: readonly string[],
): AlpacaPersonalAssetMetadataCommandOptions {
  if (!Array.isArray(args)
    || (args.length !== 0
      && (args.length !== 1 || args[0] !== ALPACA_PERSONAL_MULS_ASSET_CONFIRMATION_FLAG))) {
    throw new AlpacaPersonalAssetMetadataCommandError();
  }
  return Object.freeze({ confirmed: args.length === 1 });
}

export function createAlpacaPersonalAssetMetadataCommandInput(
  options: Readonly<AlpacaPersonalAssetMetadataCommandOptions>,
  environment: Readonly<Record<string, string | undefined>>,
): AlpacaPersonalAssetMetadataDiagnosticInput {
  if (!isRecord(options) || typeof options.confirmed !== "boolean"
    || Object.keys(options).some((key) => key !== "confirmed")) {
    throw new AlpacaPersonalAssetMetadataCommandError();
  }
  return deepFreeze({
    confirmed: options.confirmed,
    environment: {
      [ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE]: environment[ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE],
      [ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE]: environment[ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE],
    },
  });
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
