import type { OwnerAuthorizationVerifier } from "../../../contracts/PersonalDailyScanLiveReadonly";
import type { AlpacaBarsLimitQualificationOperation } from "../../../contracts/AlpacaBarsLimitQualification";
import {
  createAlpacaBarsLimitQualificationTestOperationInternal,
  type AlpacaBarsLimitQualificationRawTransport,
} from "../AlpacaBarsLimitQualification";

/** Test-only dependency seam. It is deliberately absent from product barrels. */
export function createAlpacaBarsLimitQualificationTestOperation(input: {
  readonly authorizationVerifier: OwnerAuthorizationVerifier;
  readonly rawTransport: AlpacaBarsLimitQualificationRawTransport;
}): AlpacaBarsLimitQualificationOperation {
  return createAlpacaBarsLimitQualificationTestOperationInternal({
    authorizationVerifier: input.authorizationVerifier,
    rawTransport: input.rawTransport,
  });
}
