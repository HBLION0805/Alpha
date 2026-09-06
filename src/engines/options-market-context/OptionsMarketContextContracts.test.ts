import { BarInterval } from "../../contracts/CanonicalBar";
import { deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import { MarketDataProviderStatus } from "../../contracts/MarketDataProviderRegistry";
import { OptionsBarSourceAuthorization } from "./OptionsBarSourceAuthorization";
import { fingerprintBody, validateOptionsCandlePolicy } from "./OptionsMarketContextValidation";
import { validateMarketCalendarEvidence } from "../market-calendar/MarketCalendarValidation";
import { buildContextFixture } from "./testing/OptionsMarketContextFixtures";
import { equal, harness, throws, truth } from "./testing/OptionsContextTestSupport";

const h = harness("Options Market Context contracts");
const fixture = buildContextFixture();
h.test("policy is immutable and detached from its input", () => {
  const policy = validateOptionsCandlePolicy(fixture.policy);
  truth(Object.isFrozen(policy)); truth(Object.isFrozen(policy.regimePolicy)); truth(policy !== fixture.policy);
});
for (const field of ["atrWindowN", "rvReturnWindowN", "volumeSessionWindowN"] as const) {
  for (const value of [0, 1, 2.5, Number.MAX_SAFE_INTEGER]) h.test(`${field} rejects ${value}`, () => {
    throws(() => validateOptionsCandlePolicy({...fixture.policy, [field]: value}), "INVALID_POLICY");
  });
}
h.test("undeclared policy fields cannot introduce risk authority", () => {
  throws(() => validateOptionsCandlePolicy({...fixture.policy, automatedExecutionAllowed: true}), "INVALID_POLICY");
});
h.test("annualization cannot drift between fixtures", () => {
  throws(() => validateOptionsCandlePolicy({...fixture.policy, periodsPerYear: {...fixture.policy.periodsPerYear, PT1H: 1260}}), "INVALID_POLICY");
});
h.test("volume thresholds must be strictly ordered", () => {
  throws(() => validateOptionsCandlePolicy({...fixture.policy, highRelativeVolumeBps: 8000}), "INVALID_POLICY");
});
h.test("unknown intervals and extended sessions are rejected", () => {
  throws(() => validateOptionsCandlePolicy({...fixture.policy, sessionType: "EXTENDED"}), "INVALID_POLICY");
  throws(() => validateOptionsCandlePolicy({...fixture.policy, maxAgeSeconds: {...fixture.policy.maxAgeSeconds, PT1M: 3600}}), "INVALID_POLICY");
});
h.test("source snapshot is deep-frozen and uses the existing registry", () => {
  const source = new OptionsBarSourceAuthorization(fixture.binding, fixture.providers);
  source.preauthorize(fixture.asOf);
  truth(Object.isFrozen(source.binding.calendar)); equal(source.adapter.getDescriptor(), fixture.binding.descriptor);
});
for (const field of ["providerSymbol", "mappingVersion", "calendarVersion", "descriptorFingerprint", "registryFingerprint"] as const) {
  h.test(`${field} drift is rejected`, () => {
    throws(() => new OptionsBarSourceAuthorization({...fixture.binding, [field]: "drift"}, fixture.providers));
  });
}
h.test("self-consistent forged mapping still fails recomputation", () => {
  const binding = {...fixture.binding, mappingFingerprint: "fnv1a64:0000000000000000"};
  throws(() => new OptionsBarSourceAuthorization({...binding, fingerprint: fingerprintBody(binding)}, fixture.providers));
});
h.test("disabled and unknown providers fail existing registry composition", () => {
  throws(() => new OptionsBarSourceAuthorization(fixture.binding, []));
  throws(() => new OptionsBarSourceAuthorization(fixture.binding,
    fixture.providers.map((provider) => ({...provider, status: MarketDataProviderStatus.Inactive}))));
});
h.test("single calendar validator works without a fabricated market snapshot", () => {
  truth(validateMarketCalendarEvidence(fixture.binding.calendar, fixture.asOf).valid);
  truth(!validateMarketCalendarEvidence(fixture.binding.calendar, "invalid").valid);
  truth(!validateMarketCalendarEvidence([], fixture.asOf).valid);
});
h.test("calendar evidence alterations fail the existing fingerprint check", () => {
  const calendar = fixture.binding.calendar.map((entry, index) => index === 0 ? {...entry, timezone: "UTC"} : entry);
  truth(!validateMarketCalendarEvidence(calendar, fixture.asOf).valid);
  truth(deterministicFingerprint(calendar) !== fixture.binding.calendarFingerprint);
});
h.test("one-minute timeframe cannot enter the binding", () => {
  const binding = {...fixture.binding, intervals: [BarInterval.OneMinute]};
  throws(() => new OptionsBarSourceAuthorization(binding as unknown as typeof fixture.binding, fixture.providers));
});
h.test("adapter interval capability cannot be narrower than the authorized manifest", () => {
  const descriptor = {...fixture.binding.descriptor, supportedBarIntervals: [BarInterval.OneDay]};
  const binding = {...fixture.binding, descriptor, descriptorFingerprint: deterministicFingerprint(descriptor)};
  throws(() => new OptionsBarSourceAuthorization({...binding, fingerprint: fingerprintBody(binding)}, fixture.providers), "SOURCE_OR_PROVENANCE_DRIFT");
});
h.test("malformed corporate-action evidence fails with a domain rejection", () => {
  const binding = {...fixture.binding, corporateAction: null};
  throws(() => new OptionsBarSourceAuthorization(binding as unknown as typeof fixture.binding, fixture.providers), "UNRESOLVED_CORPORATE_ACTION");
});
h.finish();
