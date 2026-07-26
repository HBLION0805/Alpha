import { env as processEnvironment } from "node:process";
import {
  ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE,
  ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE,
  AlpacaPersonalIssueCode,
  type AlpacaCredentialDiagnostic,
  type AlpacaCredentials,
} from "./AlpacaPersonalMarketDataContracts";

const SECRET = /^[\x21-\x7e]{8,512}$/u;

export class AlpacaConfigurationError extends Error {
  public constructor(public readonly safeCode: AlpacaPersonalIssueCode) {
    super(`Alpaca configuration failed: ${safeCode}.`);
    this.name = "AlpacaConfigurationError";
  }
}

class RedactedAlpacaCredentials implements AlpacaCredentials {
  readonly #keyId: string;
  readonly #secretKey: string;

  public constructor(keyId: string, secretKey: string) {
    this.#keyId = keyId;
    this.#secretKey = secretKey;
    Object.freeze(this);
  }

  public revealForTransport(): Readonly<{ readonly keyId: string; readonly secretKey: string }> {
    return Object.freeze({ keyId: this.#keyId, secretKey: this.#secretKey });
  }

  public toRedactedDiagnostic(): AlpacaCredentialDiagnostic {
    return deepFreeze({
      environmentVariables: [
        ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE,
        ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE,
      ],
      configured: true,
      values: ["[REDACTED]", "[REDACTED]"],
    });
  }

  public toJSON(): AlpacaCredentialDiagnostic {
    return this.toRedactedDiagnostic();
  }

  public toString(): string {
    return `${ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE}=[REDACTED],${ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE}=[REDACTED]`;
  }
}

export function loadAlpacaCredentials(
  environment: Readonly<Record<string, string | undefined>> = processEnvironment,
): AlpacaCredentials {
  const keyId = environment[ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE];
  const secretKey = environment[ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE];
  if (typeof keyId !== "string" || !SECRET.test(keyId)
    || typeof secretKey !== "string" || !SECRET.test(secretKey)
    || keyId === secretKey) {
    throw new AlpacaConfigurationError(AlpacaPersonalIssueCode.InvalidInput);
  }
  return new RedactedAlpacaCredentials(keyId, secretKey);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
