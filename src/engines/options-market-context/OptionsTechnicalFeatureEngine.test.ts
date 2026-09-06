import { BarInterval } from "../../contracts/CanonicalBar";
import { deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import { OPTIONS_CONTEXT_INTERVALS } from "../../contracts/OptionsCandlePolicy";
import { calculateOptionsTechnicalFeatures, integerSqrtFloor } from "./OptionsTechnicalFeatureEngine";
import { buildContextFixture, rebindTestRows } from "./testing/OptionsMarketContextFixtures";
import { accepted, changeBar, equal, harness, runFixture, throws, truth } from "./testing/OptionsContextTestSupport";
import { fingerprintBody } from "./OptionsMarketContextValidation";

const h = harness("Options Technical Features");
const fixture = buildContextFixture();
const result = accepted(runFixture(fixture).result);
h.test("daily Wilder seed and recurrence match independently calculated golden value", () => {
  const features = result.context.timeframes[0]!.features;
  equal(features.trueRanges.map((value) => value.atomicValue), ["20", "510", "510", "1010", "510"]);
  equal(features.atr, {atomicValue: "548", scale: 2});
});
h.test("sample simple-return RV preserves PPB truncation and sample denominator", () => {
  const features = result.context.timeframes[0]!.features;
  equal(features.returnPpb, ["50000000", "47619047", "90909090", "41666666"]);
  equal(features.annualizedVolatilityPpb, "426660930"); equal(features.annualizedVolatilityBps, 4266);
  equal(features.rvWindowReturnCount, 3); equal(features.qualifiedReturnCount, 4);
});
for (const vector of ["normal", "spring", "autumn"] as const) h.test(`${vector}: no intraday session boundary is bridged`, () => {
  const output = accepted(runFixture(buildContextFixture(vector)).result);
  for (const {series, features} of output.context.timeframes.slice(1)) {
    const sessions = new Set(series.sessionIds);
    equal(features.qualifiedReturnCount, series.bars.length - sessions.size);
    for (const [index, bar] of series.bars.entries()) {
      if (index === 0 || series.sessionIds[index] !== series.sessionIds[index - 1]) {
        equal(features.trueRanges[index]!.atomicValue, "20"); truth(!features.returnBarIds.includes(bar.barId));
      }
    }
    equal(features.periodsPerYear, fixture.policy.periodsPerYear[series.interval]);
  }
});
h.test("hour grid excludes the residual half hour and shortens only by full slots", () => {
  const series = result.context.timeframes[1]!.series;
  equal(series.bars.filter((bar) => bar.session.sessionDate === "2026-11-23").length, 6);
  const early = series.bars.filter((bar) => bar.session.sessionDate === "2026-11-27");
  equal(early.length, 3); equal(early[2]!.intervalEnd, "2026-11-27T17:30:00.000Z");
});
h.test("same-slot volume excludes current session and skips absent early-close slot", () => {
  for (const {series, features} of result.context.timeframes.slice(1)) {
    equal(features.volume.relativeVolumeBps, 10000);
    equal(features.volume.category, "WITHIN_BASELINE");
    equal(features.volume.sessionIds, ["session:2026-11-24:regular", "session:2026-11-25:regular"]);
    equal(features.volume.slotId, series.slotIds[series.slotIds.length - 1]);
  }
});
for (const [volume, ratio, category] of [[800,8000,"BELOW_BASELINE"],[1200,12000,"ABOVE_BASELINE"]] as const) {
  h.test(`volume exact threshold ${ratio} is inclusive`, () => {
    const changed = rebindTestRows(changeBar(fixture, BarInterval.OneDay, 4, (bar) => ({...bar,
      value: {...bar.value, volume: {atomicValue: String(volume), scale: 0}}})));
    const features = accepted(runFixture(changed).result).context.timeframes[0]!.features;
    equal(features.volume.relativeVolumeBps, ratio); equal(features.volume.category, category);
  });
}
h.test("mixed decimal scales align exactly before the volume baseline", () => {
  const changed = rebindTestRows(changeBar(fixture, BarInterval.OneDay, 3, (bar) => ({...bar,
    value: {...bar.value, volume: {atomicValue: "100000", scale: 2}}})));
  equal(accepted(runFixture(changed).result).context.timeframes[0]!.features.volume.baseline,
    {atomicValue: "100000", scale: 2});
});
h.test("integer square root rounds down and rejects oversized intermediates", () => {
  for (const [input, expected] of [[0n,0n],[1n,1n],[2n,1n],[15n,3n],[16n,4n],[17n,4n]] as const) equal(String(integerSqrtFloor(input)), String(expected));
  throws(() => integerSqrtFloor(1n << 512n), "NUMERIC_OVERFLOW");
});
h.test("no external ATR state or altered series may bypass fingerprinting", () => {
  const series = result.context.timeframes[0]!.series;
  throws(() => calculateOptionsTechnicalFeatures({...series, fingerprint: "forged"}, fixture.policy), "SOURCE_OR_PROVENANCE_DRIFT");
});
h.test("more bars do not hide too few qualified RV returns", () => {
  const timeframe = result.context.timeframes[1]!;
  const policy = {...fixture.policy, rvReturnWindowN: timeframe.series.bars.length};
  const series = {...timeframe.series, policyFingerprint: deterministicFingerprint(policy)};
  throws(() => calculateOptionsTechnicalFeatures({...series, fingerprint: fingerprintBody(series)}, policy), "INSUFFICIENT_HISTORY");
});
h.test("each timeframe retains its declared fixed annualization factor", () => {
  equal(result.context.timeframes.map(({features}) => features.periodsPerYear), OPTIONS_CONTEXT_INTERVALS.map((interval) => fixture.policy.periodsPerYear[interval]));
});
h.test("negative returns truncate toward zero rather than round down", () => {
  const closes = [12500,12000,11000,10500,10000];
  const rows = {...fixture.rows, P1D: fixture.rows.P1D.map((row,index) => {
    const close = closes[index]!;
    const price = (value: number) => ({atomicValue: String(value), scale: 2});
    return {...row, bar: {...row.bar, value: {...row.bar.value,
      open: price(close), high: price(close+10), low: price(close-10), close: price(close)}}};
  })};
  equal(accepted(runFixture(rebindTestRows({...fixture, rows})).result).context.timeframes[0]!.features.returnPpb,
    ["-40000000","-83333333","-45454545","-47619047"]);
});
h.test("price scale alignment preserves economic ATR without rounding to cents", () => {
  const changed = rebindTestRows(changeBar(fixture, BarInterval.OneDay, 1, (bar) => ({...bar,
    value: {...bar.value, open: {atomicValue: String(BigInt(bar.value.open.atomicValue)*10n), scale: 3}}})));
  // floor(10400/3)=3466; floor((3466*2+10100)/3)=5677; final floor=5484.
  equal(accepted(runFixture(changed).result).context.timeframes[0]!.features.atr, {atomicValue:"5484",scale:3});
});
h.test("oversized aligned input rejects before Market Regime or persistence", () => {
  const changed = rebindTestRows(changeBar(fixture, BarInterval.OneDay, 0, (bar) => ({...bar,
    value: {...bar.value, volume: {atomicValue: String(1n << 256n), scale: 0}}})));
  const output = runFixture(changed).result;
  truth(output.status === "REJECTED"); equal(output.reasonCode,"NUMERIC_OVERFLOW"); equal(output.health.validContextWriteCount,0);
});
h.finish();
