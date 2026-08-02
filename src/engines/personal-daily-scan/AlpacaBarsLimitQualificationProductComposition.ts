import type { AlpacaBarsLimitQualificationOperation } from "../../contracts/AlpacaBarsLimitQualification";
import { createAlpacaBarsLimitQualificationFixedProductOperation } from "./AlpacaBarsLimitQualification";

/**
 * The only product entry. It accepts no caller-controlled authority, key,
 * verifier, credential loader, or Transport. Until a separately approved
 * product trust-root configuration exists it fails closed before credentials.
 */
export function createAlpacaBarsLimitQualificationProductOperation(): AlpacaBarsLimitQualificationOperation {
  return createAlpacaBarsLimitQualificationFixedProductOperation();
}
