import type { OwnerAuthorizationVerifier } from "../../../contracts/PersonalDailyScanLiveReadonly";
import type {
  LiveReadonlyProviderSemanticsEvidence,
  PersonalDailyScanLiveReadonlyOperation,
} from "../../../contracts/PersonalDailyScanLiveReadonlyMarketScope";
import {
  createPersonalDailyScanLiveReadonlyInternalOperation,
  type LiveReadonlyInternalRawTransport,
} from "../PersonalDailyScanLiveReadonlyMarketScope";

/** Test-only dependency seam. This module is never exported by a product barrel. */
export function createPersonalDailyScanLiveReadonlyTestOperation(input: {
  readonly ownerAuthorizationVerifier: OwnerAuthorizationVerifier;
  readonly providerSemanticsEvidence: LiveReadonlyProviderSemanticsEvidence;
  readonly rawTransport: LiveReadonlyInternalRawTransport;
}): PersonalDailyScanLiveReadonlyOperation {
  return createPersonalDailyScanLiveReadonlyInternalOperation({
    ownerAuthorizationVerifier: input.ownerAuthorizationVerifier,
    providerSemanticsAuthority: Object.freeze({
      getProviderSemanticsEvidence: (): LiveReadonlyProviderSemanticsEvidence => input.providerSemanticsEvidence,
    }),
    rawTransport: input.rawTransport,
  });
}
