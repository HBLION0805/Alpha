/**
 * Deterministic local change-detection fingerprint. FNV-1a is deliberately
 * not a cryptographic signature, tamper-proof seal, or provider attestation.
 */
export function canonicalizeDeterministicValue(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map(canonicalizeDeterministicValue).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalizeDeterministicValue((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}

export function deterministicFingerprint(value: unknown): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(
    canonicalizeDeterministicValue(value),
  )) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}
