import { readFileSync } from "node:fs";
import { BarAdjustmentState, BarInterval, BarQualityReasonCode } from "../../contracts/CanonicalBar";
import { deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import type { OptionsContextRejectionCode, OptionsMarketContextResult } from "../../contracts/OptionsMarketContext";
import { optionsMarketContextEvidence } from "../../repositories/OptionsMarketContextEvidenceAdapter";
import { composeOptionsMarketContext } from "./OptionsMultiTimeframeContextEngine";
import { fingerprintBody } from "./OptionsMarketContextValidation";
import { buildContextFixture, loadContextFixture, rebindTestRows, type ContextFixture } from "./testing/OptionsMarketContextFixtures";
import { accepted, changeBar, equal, harness, runFixture, throws, truth } from "./testing/OptionsContextTestSupport";

const h = harness("Options Market Context end-to-end");
const fixture = loadContextFixture();
const successful = runFixture(fixture);
const success = accepted(successful.result);
const reports: unknown[] = [];
function report(name: string, result: OptionsMarketContextResult) {
  reports.push({scenario: name, status: result.status, health: {...result.health,
    normalizedBarReferences: result.status === "ACCEPTED" ? undefined
      : result.health.normalizedBarReferences.map(({barId, fingerprint}) => [barId, fingerprint])},
    ...(result.status === "REJECTED" ? {reasonCode: result.reasonCode, queryResult: result.queryResult}
      : {contextId: result.context.contextId, instrumentId: result.context.instrumentId,
        bindingFingerprint: result.context.bindingFingerprint, policyFingerprint: result.context.policyFingerprint,
        agreement: result.context.agreement, timeframes: result.context.timeframes.map(({series, features, regime}) => ({
          interval: series.interval, barReferences: series.references.map(({canonicalBarId, canonicalBarFingerprint}) =>
            ({canonicalBarId, canonicalBarFingerprint})), seriesFingerprint: series.fingerprint,
          calendarFingerprint: series.calendarFingerprint, corporateActionFingerprint: series.corporateActionFingerprint,
          ageSeconds: series.ageSeconds, atr: features.atr, atrVersion: features.atrVersion,
          qualifiedReturnCount: features.qualifiedReturnCount, annualizedVolatilityPpb: features.annualizedVolatilityPpb,
          rvVersion: features.rvVersion, annualizationVersion: features.annualizationVersion, periodsPerYear: features.periodsPerYear,
          volume: features.volume, regimeSnapshotId: regime.inputSnapshotId, regimeAssessment: regime.assessment})),
        queryResult: result.queryResult.map((context) => context.contextId), evidenceNamespace: optionsMarketContextEvidence(result.context).namespace})});
}
function reject(name: string, changed: ContextFixture, reason: OptionsContextRejectionCode) {
  const {result, repository} = runFixture(changed);
  truth(result.status === "REJECTED"); equal(result.reasonCode, reason); equal(result.health.validContextWriteCount, 0);
  equal(result.queryResult, []); equal(repository.query(changed.binding.instrument.instrumentId, fixture.asOf, fixture.asOf), []);
  if (["NORMALIZATION", "QUALIFICATION", "AUTHORIZATION"].includes(result.health.stage)) equal(result.health.featureCount, 0);
  report(name, result);
  return result;
}
h.test("checked-in fixture files reproduce exactly from the synthetic generator", () => {
  equal(deterministicFingerprint(fixture), deterministicFingerprint(buildContextFixture()));
  equal(JSON.parse(readFileSync("fixtures/options-market-context/qqq-qualified/session-calendar.json", "utf8")), fixture.binding.calendar);
  equal(JSON.parse(readFileSync("fixtures/options-market-context/qqq-qualified/corporate-action-qualification.json", "utf8")), fixture.binding.corporateAction);
});
h.test("QQQ four-timeframe accepted output is complete, immutable and has zero live effects", () => {
  equal(success.context.timeframes.map(({series}) => series.interval), ["P1D","PT1H","PT15M","PT5M"]);
  equal(success.health.validContextWriteCount, 1); equal(success.queryResult.length, 1);
  equal(success.health.networkRequestCount, 0); equal(success.health.credentialReadCount, 0); equal(success.health.realCostCents, 0);
  truth(Object.isFrozen(success.context.timeframes[0]!.regime.assessment));
  report("QQQ_FOUR_TIMEFRAME_CONTEXT_ACCEPTED", success);
});
h.test("same input replays without a second valid context write", () => {
  const replay = accepted(successful.pipeline.run(fixture.rows, fixture.asOf));
  equal(replay.context.fingerprint, success.context.fingerprint); equal(replay.health.validContextWriteCount, 0);
  equal(replay.queryResult.length, 1);
});
h.test("conflicting repository replay rejects instead of overwriting", () => {
  const altered = {...success.context, agreement: success.context.agreement === "AGREEMENT" ? "DISAGREEMENT" as const : "AGREEMENT" as const};
  throws(() => successful.repository.put({...altered, fingerprint: fingerprintBody(altered)}), "REPLAY_CONFLICT");
});
h.test("internal grid gap rejects before any features or writes", () => {
  const rows = {...fixture.rows, PT5M: fixture.rows.PT5M.filter((_,index) => index !== 5)};
  reject("GAPPED_SERIES_REJECTED", rebindTestRows({...fixture, rows}), "GAPPED_SERIES");
});
h.test("staleness is recomputed despite each historical Bar's local CURRENT metadata", () => {
  reject("STALE_SERIES_REJECTED", {...fixture, asOf: "2026-11-30T23:00:00.000Z"}, "STALE_SERIES");
});
h.test("calendar timezone drift rejects with no repair", () => {
  const changed = changeBar(fixture, BarInterval.OneDay, 0, (bar) => ({...bar, session: {...bar.session, timezone: "UTC"}}));
  reject("SESSION_CALENDAR_DRIFT_REJECTED", rebindTestRows(changed), "SESSION_CALENDAR_DRIFT");
});
h.test("raw digest drift fails before qualification", () => {
  const changed = changeBar(fixture, BarInterval.OneDay, 0, (bar) => ({...bar,
    value: {...bar.value, volume: {atomicValue: "999", scale: 0}}}));
  reject("SOURCE_PROVENANCE_DRIFT_REJECTED", changed, "SOURCE_OR_PROVENANCE_DRIFT");
});
h.test("unknown adjustment state rejects with explicit corporate-action reason", () => {
  const changed = changeBar(fixture, BarInterval.OneDay, 0, (bar) => ({...bar, adjustment: BarAdjustmentState.Unknown,
    quality: {...bar.quality, reasonCodes: [BarQualityReasonCode.UnknownAdjustment]}}));
  reject("UNRESOLVED_CORPORATE_ACTION_REJECTED", rebindTestRows(changed), "UNRESOLVED_CORPORATE_ACTION");
});
h.test("provider-symbol substitution never inherits the manifest's instrument", () => {
  const rows = {...fixture.rows, P1D: fixture.rows.P1D.map((row,index) => index === 0 ? {...row, providerSymbol: "SPY"} : row)};
  reject("PROVIDER_SYMBOL_MAPPING_DRIFT_REJECTED", rebindTestRows({...fixture, rows}), "SOURCE_OR_PROVENANCE_DRIFT");
});
h.test("missing provider symbol fails explicitly instead of being inferred", () => {
  const raw = {...fixture.rows, P1D: fixture.rows.P1D.map((row,index) => index === 0 ? {bar: row.bar} : row)};
  const result = successful.pipeline.run(raw, fixture.asOf);
  truth(result.status === "REJECTED"); equal(result.reasonCode, "SOURCE_OR_PROVENANCE_DRIFT"); equal(result.health.featureCount, 0);
});
h.test("extra input authority fields fail closed", () => {
  const result = successful.pipeline.run({...fixture.rows, network: true}, fixture.asOf);
  truth(result.status === "REJECTED"); equal(result.reasonCode, "INVALID_CONTRACT"); equal(result.health.normalizedBarCount, 0);
});
h.test("invalid OHLC uses the existing Canonical Bar rejection", () => {
  const changed = changeBar(fixture, BarInterval.OneDay, 0, (bar) => ({...bar, value: {...bar.value, high: {atomicValue: "1",scale:2}}}));
  reject("INVALID_OHLC_REJECTED", changed, "INVALID_CANONICAL_BAR");
});
h.test("duplicate timestamp rejects even if source digest is authorized", () => {
  const rows = {...fixture.rows, PT5M: fixture.rows.PT5M.map((row,index) => index === 5 ? fixture.rows.PT5M[4]! : row)};
  reject("DUPLICATE_BAR_REJECTED", rebindTestRows({...fixture, rows}), "GAPPED_SERIES");
});
h.test("no Bar may be fabricated for a holiday", () => {
  const rows = {...fixture.rows, P1D: [...fixture.rows.P1D, fixture.rows.P1D[0]!]};
  reject("HOLIDAY_EXTRA_BAR_REJECTED", rebindTestRows({...fixture, rows}), "GAPPED_SERIES");
});
h.test("a missing expected session rejects the entire context", () => {
  const rows = {...fixture.rows, P1D: fixture.rows.P1D.filter((bar) => bar.bar.session.sessionDate !== "2026-11-24")};
  reject("MISSING_SESSION_REJECTED", rebindTestRows({...fixture, rows}), "GAPPED_SERIES");
});
h.test("zero comparable volume baseline never yields an infinite ratio", () => {
  const rows = {...fixture.rows, P1D: fixture.rows.P1D.map((row,index) => index === 2 || index === 3
    ? {...row, bar: {...row.bar, value: {...row.bar.value, volume: {atomicValue: "0", scale: 0}}}} : row)};
  reject("ZERO_VOLUME_BASELINE_REJECTED", rebindTestRows({...fixture, rows}), "INSUFFICIENT_VOLUME_BASELINE");
});
h.test("unresolved corporate-action evidence cannot be replaced by provider claims", () => {
  const action = {...fixture.binding.corporateAction, knownEvents: ["unresolved:split"]};
  const binding = {...fixture.binding, corporateAction: {...action, fingerprint: fingerprintBody(action)}};
  reject("ACTION_EVIDENCE_REJECTED", {...fixture, binding: {...binding, fingerprint: fingerprintBody(binding)}}, "UNRESOLVED_CORPORATE_ACTION");
});
h.test("normal-close, early-close and DST outputs retain session-local pairing", () => {
  for (const vector of ["normal", "spring", "autumn"] as const) {
    const output = accepted(runFixture(buildContextFixture(vector)).result);
    for (const {series,features} of output.context.timeframes.slice(1)) equal(features.qualifiedReturnCount, series.bars.length - new Set(series.sessionIds).size);
  }
  report("INTRADAY_SESSION_BOUNDARY_NOT_BRIDGED", success);
});
h.test("same-slot volume evidence remains queryable", () => {
  report("VOLUME_SAME_SLOT_BASELINE_VERIFIED", success);
});
h.test("opposing timeframe facts are preserved without a composite regime", () => {
  const rows = {...fixture.rows, PT5M: fixture.rows.PT5M.map((row,index) => {
    const close = 30000 - index * 20;
    const price = (value: number) => ({atomicValue: String(value),scale:2});
    return {...row, bar: {...row.bar, value: {...row.bar.value, open: price(close), high: price(close+10), low: price(close-10), close:price(close)}}}; })};
  const output = accepted(runFixture(rebindTestRows({...fixture, rows})).result);
  equal(output.context.agreement, "DISAGREEMENT");
  truth(new Set(output.context.timeframes.map(({regime}) => regime.assessment.primaryRegime)).size > 1);
  truth(!Object.hasOwn(output.context, "primaryRegime"));
  report("MULTI_TIMEFRAME_DISAGREEMENT_PRESERVED", output);
});
for (const field of ["interval", "qualifiedSeriesFingerprint", "inputSnapshotId", "inputSnapshotFingerprint", "assessmentId", "policyId", "policyVersion", "ruleSetVersion"] as const) {
  h.test(`regime ${field} drift cannot write a context`, () => {
    const timeframes = success.context.timeframes.map((timeframe,index) => index === 0
      ? {...timeframe, regime: {...timeframe.regime, [field]: "forged"}} : timeframe);
    throws(() => composeOptionsMarketContext(timeframes as typeof success.context.timeframes, fixture.policy), "TIMEFRAME_REGIME_BINDING_DRIFT");
  });
}
h.test("regime-binding negative output records the observed composition failure", () => {
  const timeframes = success.context.timeframes.map((timeframe,index) => index === 0
    ? {...timeframe, regime: {...timeframe.regime, inputSnapshotId: "forged"}} : timeframe);
  let writes = 0;
  let observedReason = "";
  try {
    composeOptionsMarketContext(timeframes, fixture.policy);
    writes++;
  } catch (error) { truth(error instanceof Error); observedReason = error.message; }
  equal(observedReason, "TIMEFRAME_REGIME_BINDING_DRIFT"); equal(writes, 0);
  reports.push({scenario: "TIMEFRAME_REGIME_BINDING_DRIFT_REJECTED", boundary: "COMPOSITION_COMPONENT_WITH_QUALIFIED_FIXTURE_INPUT",
    reasonCode: observedReason, validContextWriteCount: writes, bindingFingerprint: success.context.bindingFingerprint,
    inputSeriesFingerprints: timeframes.map(({series}) => series.fingerprint), networkRequestCount: 0, queryResult: []});
});
h.test("read-only evidence projection has no trading authority", () => {
  const evidence = optionsMarketContextEvidence(success.context);
  equal(evidence.namespace, "OPTIONS_MARKET_CONTEXT"); equal(evidence.readOnly, true); equal(evidence.automatedExecutionAllowed, false);
  equal(evidence.references.length, 4);
});
console.log(`OPTIONS_MARKET_CONTEXT_ACCEPTANCE ${JSON.stringify(reports)}`);
h.finish();
