import { createHash } from "node:crypto";
import { canonicalizeDeterministicValue, deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import { OPTIONS_CONTEXT_INTERVALS, type OptionsCandlePolicy } from "../../contracts/OptionsCandlePolicy";
import type { OptionsContextRejectionCode } from "../../contracts/OptionsMarketContext";
import { validateMarketRegimePolicy } from "../market-regime/MarketRegimeEngine";

export class OptionsContextError extends Error {
  public constructor(public readonly code: OptionsContextRejectionCode) {
    super(code);
    this.name = "OptionsContextError";
  }
}
export function requireContext(condition: unknown, code: OptionsContextRejectionCode): asserts condition {
  if (!condition) throw new OptionsContextError(code);
}
export function exactFields(value: unknown, keys: readonly string[], code: OptionsContextRejectionCode = "INVALID_CONTRACT"): asserts value is Record<string, unknown> {
  requireContext(typeof value === "object" && value !== null && !Array.isArray(value), code);
  requireContext(Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)), code);
}
export function freezeContext<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeContext(child);
    Object.freeze(value);
  }
  return value;
}
export function copyContext<T>(value: T): T {
  return freezeContext(JSON.parse(JSON.stringify(value)) as T);
}
export function digestContext(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalizeDeterministicValue(value)).digest("hex")}`;
}
export function fingerprintBody(value: { readonly fingerprint: string }): string {
  const { fingerprint: _fingerprint, ...body } = value;
  return deterministicFingerprint(body);
}
export function validUtc(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
export function validId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u.test(value);
}
export function validateOptionsCandlePolicy(value: unknown): OptionsCandlePolicy {
  const code = "INVALID_POLICY";
  exactFields(value, ["schemaVersion", "policyId", "version", "sessionType", "gridVersion", "pairVersion",
    "annualizationVersion", "periodsPerYear", "atrWindowN", "rvReturnWindowN", "volumeSessionWindowN",
    "lowRelativeVolumeBps", "highRelativeVolumeBps", "maxAgeSeconds", "maxBarsPerSeries", "regimePolicy"], code);
  requireContext(value.schemaVersion === "1.0" && validId(value.policyId) && validId(value.version)
    && value.sessionType === "REGULAR" && value.gridVersion === "REGULAR_OPEN_FULL_WINDOWS_V1"
    && value.pairVersion === "SESSION_LOCAL_INTRADAY_V1"
    && value.annualizationVersion === "REGULAR_SESSION_FIXED_PERIODS_V1", code);
  exactFields(value.periodsPerYear, OPTIONS_CONTEXT_INTERVALS, code);
  exactFields(value.maxAgeSeconds, OPTIONS_CONTEXT_INTERVALS, code);
  const factors = [252, 1512, 6552, 19656];
  for (const [index, interval] of OPTIONS_CONTEXT_INTERVALS.entries()) {
    requireContext(value.periodsPerYear[interval] === factors[index], code);
    const age = value.maxAgeSeconds[interval];
    requireContext(Number.isSafeInteger(age) && Number(age) >= 0 && Number(age) <= 604800, code);
  }
  for (const field of ["atrWindowN", "rvReturnWindowN", "volumeSessionWindowN"] as const) {
    requireContext(Number.isSafeInteger(value[field]) && Number(value[field]) >= 2 && Number(value[field]) <= 10000, code);
  }
  requireContext(Number.isSafeInteger(value.maxBarsPerSeries) && Number(value.maxBarsPerSeries) >= 3
    && Number(value.maxBarsPerSeries) <= 100000, code);
  requireContext(Number.isSafeInteger(value.lowRelativeVolumeBps) && Number.isSafeInteger(value.highRelativeVolumeBps)
    && Number(value.lowRelativeVolumeBps) >= 0 && Number(value.highRelativeVolumeBps) > Number(value.lowRelativeVolumeBps), code);
  requireContext(validateMarketRegimePolicy(value.regimePolicy).valid, code);
  return copyContext(value as unknown as OptionsCandlePolicy);
}
