import type {
  LiveReadonlyPreflightInput,
} from "../../contracts/PersonalDailyScanLiveReadonly";
import type {
  LiveReadonlyMarketScopeResult,
  PersonalDailyScanLiveReadonlyOperation,
} from "../../contracts/PersonalDailyScanLiveReadonlyMarketScope";
import { createOwnerAuthorizationVerifier } from "./PersonalDailyScanLiveReadonlyPreflight";
import {
  createPersonalDailyScanLiveReadonlyInternalOperation,
  PersonalDailyScanLiveReadonlyTransportError,
  unprovenAlpacaProviderSemanticsEvidence,
} from "./PersonalDailyScanLiveReadonlyMarketScope";

/**
 * The only product composition root. It accepts no business/runtime
 * dependencies. D2 has no deployed external trust-root configuration and no
 * D3 Transport, so the product remains fail-closed before either boundary.
 */
export function createPersonalDailyScanLiveReadonlyProductOperation(): PersonalDailyScanLiveReadonlyOperation {
  const internal = createPersonalDailyScanLiveReadonlyInternalOperation({
    ownerAuthorizationVerifier: createOwnerAuthorizationVerifier(undefined),
    providerSemanticsAuthority: Object.freeze({
      getProviderSemanticsEvidence: unprovenAlpacaProviderSemanticsEvidence,
    }),
    rawTransport: Object.freeze({
      async dispatchOnce(): Promise<never> {
        throw new PersonalDailyScanLiveReadonlyTransportError("PARSE_FAILURE");
      },
    }),
  });
  return Object.freeze({
    run(input: LiveReadonlyPreflightInput): Promise<LiveReadonlyMarketScopeResult> {
      return internal.run(input);
    },
  });
}
