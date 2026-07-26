import {
  ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
  type AlpacaCredentialDiagnostic,
  type AlpacaHttpTransport,
  type AlpacaPersonalDryRunInput,
} from "./AlpacaPersonalMarketDataContracts";
import { loadAlpacaCredentials } from "./AlpacaCredentials";
import { AlpacaHttpsTransport } from "./AlpacaHttpsTransport";
import { planAlpacaPersonalMarketDataDryRun } from "./AlpacaPersonalMarketDataPlanner";

export interface AlpacaTransportDryRunInput {
  readonly plan: AlpacaPersonalDryRunInput;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly transport?: AlpacaHttpTransport;
}

export interface AlpacaTransportDryRunSummary {
  readonly notice: "DRY RUN ONLY — NO TRADING OR DECISION AUTHORIZATION";
  readonly mode: "DRY_RUN";
  readonly providerId: typeof ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID;
  readonly feed: "iex";
  readonly coverage: "SINGLE_VENUE";
  readonly symbolCount: 12;
  readonly requestBudget: 5;
  readonly validatedRequests: 5;
  readonly credential: AlpacaCredentialDiagnostic;
  readonly transportReady: true;
  readonly networkRequests: 0;
  readonly persistenceWrites: 0;
  readonly liveExecutionAuthorized: false;
  readonly warnings: readonly string[];
}

export function runAlpacaTransportDryRun(
  input: Readonly<AlpacaTransportDryRunInput>,
): AlpacaTransportDryRunSummary {
  const credentials = loadAlpacaCredentials(input.environment);
  const plan = planAlpacaPersonalMarketDataDryRun(input.plan);
  const transport = input.transport ?? new AlpacaHttpsTransport();
  const plannedRequests = plan["requests"];
  for (const request of plannedRequests) transport.assertReady(request);
  return deepFreeze({
    notice: "DRY RUN ONLY — NO TRADING OR DECISION AUTHORIZATION",
    mode: "DRY_RUN",
    providerId: ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
    feed: "iex",
    coverage: "SINGLE_VENUE",
    symbolCount: 12,
    requestBudget: 5,
    validatedRequests: 5,
    credential: credentials.toRedactedDiagnostic(),
    transportReady: true,
    networkRequests: 0,
    persistenceWrites: 0,
    liveExecutionAuthorized: false,
    warnings: [
      "No network request was made.",
      "IEX remains single-venue evidence and is not NBBO or consolidated volume.",
    ],
  });
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
