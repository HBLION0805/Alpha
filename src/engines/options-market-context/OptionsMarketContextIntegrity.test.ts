import { BarInterval } from "../../contracts/CanonicalBar";
import type { OptionsMarketContext, OptionsTimeframeContext } from "../../contracts/OptionsMarketContext";
import { InMemoryOptionsMarketContextRepository } from "../../repositories/InMemoryOptionsMarketContextRepository";
import { createCanonicalBar } from "../canonical-bar/CanonicalBar";
import { OptionsBarSourceAuthorization } from "./OptionsBarSourceAuthorization";
import { qualifyOptionsCandleSeries } from "./OptionsCandleSeriesIntegrityEngine";
import { composeOptionsMarketContext } from "./OptionsMultiTimeframeContextEngine";
import { fingerprintBody } from "./OptionsMarketContextValidation";
import { buildContextFixture } from "./testing/OptionsMarketContextFixtures";
import { accepted, equal, harness, runFixture, throws, truth } from "./testing/OptionsContextTestSupport";

const h = harness("Options Market Context integrity");
const fixture = buildContextFixture();
const output = accepted(runFixture(fixture).result);
const context = output.context;

function authorizedDaily() {
  const source = new OptionsBarSourceAuthorization(fixture.binding, fixture.providers);
  const bars = source.adapter.normalizeFixture(fixture.rows.P1D);
  source.preauthorize(fixture.asOf);
  source.authorize(BarInterval.OneDay, fixture.rows.P1D, bars);
  return {source, bars};
}

h.test("source-issued batches qualify and are immutable before qualification", () => {
  const {source, bars} = authorizedDaily();
  truth(Object.isFrozen(bars));
  truth(Object.isFrozen(bars[0]!.value));
  const series = qualifyOptionsCandleSeries(bars, BarInterval.OneDay, source.binding, fixture.policy, fixture.asOf);
  truth(Object.isFrozen(series));
  equal(series.bars, context.timeframes[0]!.series.bars);
});

h.test("matching raw and canonical hashes do not authorize an unissued batch", () => {
  const {source, bars} = authorizedDaily();
  throws(() => qualifyOptionsCandleSeries([...bars], BarInterval.OneDay, source.binding, fixture.policy, fixture.asOf),
    "SOURCE_OR_PROVENANCE_DRIFT");
});

h.test("source authority is bound to the exact immutable fixture binding", () => {
  const {source, bars} = authorizedDaily();
  throws(() => qualifyOptionsCandleSeries(bars, BarInterval.OneDay, {...source.binding}, fixture.policy, fixture.asOf),
    "SOURCE_OR_PROVENANCE_DRIFT");
});

h.test("direct qualification rechecks the source effective window", () => {
  const {source, bars} = authorizedDaily();
  throws(() => qualifyOptionsCandleSeries(bars, BarInterval.OneDay, source.binding, fixture.policy,
    "2026-12-31T21:02:00.000Z"), "SOURCE_OR_PROVENANCE_DRIFT");
});

for (const kind of ["numeric", "instrument", "provenance"] as const) {
  h.test(`a ${kind} substitution cannot inherit authorization from an unchanged raw manifest`, () => {
    const source = new OptionsBarSourceAuthorization(fixture.binding, fixture.providers);
    const bars = fixture.rows.P1D.map(({bar}) => createCanonicalBar(kind === "numeric"
      ? {...bar, value: {...bar.value, volume: {atomicValue: "1001", scale: 0}}}
      : kind === "instrument"
        ? {...bar, instrument: {...bar.instrument, instrumentId: "instrument:00000000000000000000000003", displaySymbol: "GLD"}}
        : {...bar, source: {...bar.source, sourceReference: "fixture:substituted-source"}}));
    throws(() => source.authorize(BarInterval.OneDay, fixture.rows.P1D, bars), "SOURCE_OR_PROVENANCE_DRIFT");
    throws(() => qualifyOptionsCandleSeries(bars, BarInterval.OneDay, source.binding, fixture.policy, fixture.asOf),
      "SOURCE_OR_PROVENANCE_DRIFT");
  });
}

h.test("a self-rehashed series cannot become qualified through composition", () => {
  const first = context.timeframes[0]!;
  const changed = {...first.series, ageSeconds: 0};
  const timeframes = [{...first, series: {...changed, fingerprint: fingerprintBody(changed)}}, ...context.timeframes.slice(1)];
  throws(() => composeOptionsMarketContext(timeframes, fixture.policy), "SOURCE_OR_PROVENANCE_DRIFT");
});

const featureChanges = {
  atr: {...context.timeframes[0]!.features, atr: {atomicValue: "0", scale: 2}},
  volatility: {...context.timeframes[0]!.features, annualizedVolatilityPpb: "0", annualizedVolatilityBps: 0},
  returns: {...context.timeframes[0]!.features, returnPpb: []},
  volume: {...context.timeframes[0]!.features, volume: {...context.timeframes[0]!.features.volume, relativeVolumeBps: 99999}},
  authority: {...context.timeframes[0]!.features, tradeApproved: true},
};
for (const [name, features] of Object.entries(featureChanges)) {
  h.test(`${name} substitution is rejected despite unchanged provenance fingerprints`, () => {
    const timeframes = context.timeframes.map((timeframe, index) => index === 0 ? {...timeframe, features} : timeframe);
    throws(() => composeOptionsMarketContext(timeframes, fixture.policy), "SOURCE_OR_PROVENANCE_DRIFT");
  });
}

h.test("missing or sparse timeframe objects yield bounded contract rejections", () => {
  throws(() => composeOptionsMarketContext(new Array(4) as OptionsTimeframeContext[], fixture.policy), "INVALID_CONTRACT");
});

h.test("composer-issued context supports insert, query, and idempotent replay", () => {
  const repository = new InMemoryOptionsMarketContextRepository();
  equal(repository.put(context), "INSERTED");
  const queried = repository.query(context.instrumentId, context.asOf, context.asOf);
  equal(queried.length, 1);
  equal(repository.put(queried[0]!), "REPLAY");
  truth(Object.isFrozen(queried));
  truth(Object.isFrozen(queried[0]!.timeframes));
  truth(Object.isFrozen(queried[0]!.timeframes[0]!.features.volume));
});

h.test("equivalent serialized or spread-cloned context has no write capability", () => {
  for (const clone of [{...context}, JSON.parse(JSON.stringify(context)) as OptionsMarketContext]) {
    const repository = new InMemoryOptionsMarketContextRepository();
    throws(() => repository.put(clone), "INVALID_CONTRACT");
    equal(repository.query(context.instrumentId, context.asOf, context.asOf), []);
  }
});

h.test("self-rehashed altered features cannot enter a fresh repository", () => {
  const timeframes = context.timeframes.map((timeframe, index) => index === 0
    ? {...timeframe, features: featureChanges.atr} : timeframe);
  const changed = {...context, timeframes};
  throws(() => new InMemoryOptionsMarketContextRepository().put({...changed, fingerprint: fingerprintBody(changed)}),
    "INVALID_CONTRACT");
});

h.test("invalid schema, identity, and empty timeframes cannot be legitimized by a self-hash", () => {
  const changed = {...context, schemaVersion: "9.9", instrumentId: "not-an-instrument", timeframes: []};
  const forged = {...changed, fingerprint: fingerprintBody(changed)} as unknown as OptionsMarketContext;
  throws(() => new InMemoryOptionsMarketContextRepository().put(forged), "INVALID_CONTRACT");
});

h.test("a conflicting replay still preserves the original context", () => {
  const repository = new InMemoryOptionsMarketContextRepository();
  repository.put(context);
  const changed = {...context, agreement: context.agreement === "AGREEMENT" ? "DISAGREEMENT" as const : "AGREEMENT" as const};
  throws(() => repository.put({...changed, fingerprint: fingerprintBody(changed)}), "REPLAY_CONFLICT");
  equal(repository.query(context.instrumentId, context.asOf, context.asOf)[0]!.fingerprint, context.fingerprint);
});

h.finish();
