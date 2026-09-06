import type { CanonicalBarInput } from "../../contracts/CanonicalBar";
import { createCanonicalBar } from "../../engines/canonical-bar/CanonicalBar";
import { exactFields, requireContext, validId } from "../../engines/options-market-context/OptionsMarketContextValidation";

export interface OptionsRawFixtureBar {
  readonly providerSymbol: string;
  readonly bar: CanonicalBarInput;
}
export function parseOptionsRawFixture(value: unknown): readonly OptionsRawFixtureBar[] {
  requireContext(Array.isArray(value) && value.length > 0 && value.length <= 100000, "INVALID_CONTRACT");
  for (const row of value) {
    exactFields(row, ["providerSymbol", "bar"], "SOURCE_OR_PROVENANCE_DRIFT");
    requireContext(validId(row.providerSymbol), "SOURCE_OR_PROVENANCE_DRIFT");
    const fields = ["schemaVersion", "instrument", "interval", "intervalStart", "intervalEnd", "observationTime",
      "receivedAt", "normalizedAt", "value", "currency", "quantityUnit", "status", "session", "adjustment", "quality", "source"];
    if (row.bar && typeof row.bar === "object" && "providerPublishedAt" in row.bar) fields.push("providerPublishedAt");
    exactFields(row.bar, fields);
    const instrumentFields = ["schemaVersion", "instrumentId", "metadataVersion", "displaySymbol", "displayName", "assetClass",
      "instrumentType", "status", "currency", "effectiveFrom"];
    if (row.bar.instrument && typeof row.bar.instrument === "object") {
      if ("exchange" in row.bar.instrument) instrumentFields.push("exchange");
      if ("timezone" in row.bar.instrument) instrumentFields.push("timezone");
    }
    exactFields(row.bar.instrument, instrumentFields);
    exactFields(row.bar.value, ["open", "high", "low", "close", "volume"]);
    for (const decimal of Object.values(row.bar.value)) exactFields(decimal, ["atomicValue", "scale"]);
    exactFields(row.bar.session, ["sessionType", "sessionDate", "timezone"]);
    exactFields(row.bar.source, ["providerId", "adapterId", "adapterVersion", "sourceReference", "contentIntegrityReference"]);
    exactFields(row.bar.quality, ["policyId", "policyVersion", "evaluatedAt", "maxAgeSeconds", "freshness", "deliveryTiming", "marketCoverage", "derivation", "reasonCodes"]);
    // Canonical Bar remains the only numeric, OHLC, lifecycle and timestamp validator.
    createCanonicalBar(row.bar);
  }
  return value as readonly OptionsRawFixtureBar[];
}
