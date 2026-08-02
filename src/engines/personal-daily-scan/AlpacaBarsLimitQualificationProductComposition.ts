import type { AlpacaBarsLimitQualificationOperation } from "../../contracts/AlpacaBarsLimitQualification";
import { AlpacaBarsLimitQualificationHttpsTransport } from "../../integration/market-data/alpaca/AlpacaBarsLimitQualificationHttpsTransport";
import { createAlpacaBarsLimitQualificationAuthorizationVerifier } from "./PersonalDailyScanLiveReadonlyPreflight";
import { createAlpacaBarsLimitQualificationInternalOperation } from "./AlpacaBarsLimitQualification";

/**
 * The only product entry. It accepts no caller-controlled authority, key,
 * verifier, credential loader, or Transport. Until a separately approved
 * product trust-root configuration exists it fails closed before credentials.
 */
export function createAlpacaBarsLimitQualificationProductOperation(): AlpacaBarsLimitQualificationOperation {
  return createAlpacaBarsLimitQualificationInternalOperation({
    authorizationVerifier: createAlpacaBarsLimitQualificationAuthorizationVerifier(undefined),
    rawTransport: new AlpacaBarsLimitQualificationHttpsTransport(),
    responseOrigin: "REAL_HTTPS",
  });
}
