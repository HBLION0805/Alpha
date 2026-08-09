import { NewsLatencyState, NewsObservationStatus, NewsSourceTier } from "../../contracts/OptionsNewsDomain";
import { NewsTransportMode } from "../../contracts/OptionsNewsProvider";
import { independenceKeys } from "../../engines/options-news/OptionsNewsProcessing";
import { adapters, equal, fixture, registry, request, TestHarness, throws, trueValue } from "../../engines/options-news/OptionsNewsTestSupport";
import { StaticNewsFixtureTransport } from "./NewsTransports";

const h=new TestHarness(); const all=adapters();
const fixtures: Readonly<Record<string,unknown>>={"provider:sec-edgar":fixture("sec-edgar.json"),"provider:federal-reserve":fixture("federal-reserve.json"),"provider:finnhub":fixture("finnhub-reuters.json"),"provider:alpha-vantage":fixture("alpha-vantage-reuters.json")};
const transport=new StaticNewsFixtureTransport(fixtures);
const cases=[
  ["sec",all.sec!,"source:sec-edgar",NewsSourceTier.Tier0,"SEC_FILING"],
  ["fed",all.fed!,"source:federal-reserve",NewsSourceTier.Tier0,"FOMC_RATE_DECISION"],
  ["finnhub",all.finnhub!,"source:finnhub-reuters",NewsSourceTier.Tier1,"CORPORATE_NEWS"],
  ["alpha vantage",all.alphaVantage!,"source:alpha-vantage-reuters",NewsSourceTier.Tier1,"CORPORATE_NEWS"],
] as const;
for (const [label,adapter,sourceId,tier,eventType] of cases) {
  h.test(`${label} builds a fixture-only request`,()=>{const built=adapter.buildRequest(request(sourceId));equal(built.mode,NewsTransportMode.Fixture,"mode");equal(built.networkEnabled,false,"network");equal(built.credentialsRequired,false,"credentials");});
  h.test(`${label} normalizes its strict fixture schema`,()=>{const records=adapter.normalize(transport.execute(adapter.buildRequest(request(sourceId))),request(sourceId));equal(records.length,1,"records");equal(records[0]!.sourceTier,tier,"tier");equal(records[0]!.eventTypeCandidate,eventType,"event type");});
  h.test(`${label} preserves provenance and zero simulated cost`,()=>{const record=adapter.normalize(transport.execute(adapter.buildRequest(request(sourceId))),request(sourceId))[0]!;trueValue(record.rawPayloadReference.includes("sha256="),"hash provenance");equal(record.cost.actualMinorUnits,0,"cost");equal(record.cost.simulated,true,"simulated");});
}
h.test("SEC primary document fingerprint is present",()=>trueValue(all.sec!.normalize(fixtures["provider:sec-edgar"],request("source:sec-edgar"))[0]!.primaryDocumentFingerprint!==null,"SEC primary"));
h.test("Federal Reserve primary document fingerprint is present",()=>trueValue(all.fed!.normalize(fixtures["provider:federal-reserve"],request("source:federal-reserve"))[0]!.primaryDocumentFingerprint!==null,"Fed primary"));
h.test("wire articles do not invent a primary document",()=>equal(all.finnhub!.normalize(fixtures["provider:finnhub"],request("source:finnhub-reuters"))[0]!.primaryDocumentFingerprint,null,"primary"));
h.test("Finnhub and Alpha Vantage Reuters observations share independence",()=>{const a=all.finnhub!.normalize(fixtures["provider:finnhub"],request("source:finnhub-reuters"))[0]!;const b=all.alphaVantage!.normalize(fixtures["provider:alpha-vantage"],request("source:alpha-vantage-reuters"))[0]!;equal(independenceKeys([a,b]).length,1,"independent sources");});
h.test("provider receipt latency is measured from supplied timestamps",()=>equal(all.sec!.normalize(fixtures["provider:sec-edgar"],request("source:sec-edgar"))[0]!.latency.state,NewsLatencyState.Measured,"latency"));
h.test("observation state is explicit",()=>equal(all.fed!.normalize(fixtures["provider:federal-reserve"],request("source:federal-reserve"))[0]!.observationStatus,NewsObservationStatus.Unique,"status"));
h.test("raw schema rejects unknown root fields",()=>throws(()=>all.sec!.normalize({...fixtures["provider:sec-edgar"] as object,extra:true},request("source:sec-edgar")),"UNKNOWN_OR_MISSING"));
h.test("raw schema rejects unknown item fields",()=>{const raw=structuredClone(fixtures["provider:sec-edgar"]) as {filings:Array<Record<string,unknown>>};raw.filings[0]!.extra=true;throws(()=>all.sec!.normalize(raw,request("source:sec-edgar")),"UNKNOWN_OR_MISSING");});
h.test("raw schema rejects publisher drift",()=>{const raw=structuredClone(fixtures["provider:sec-edgar"]) as {filings:Array<Record<string,unknown>>};raw.filings[0]!.publisher="publisher:other";throws(()=>all.sec!.normalize(raw,request("source:sec-edgar")),"INVALID_RAW_RESPONSE");});
h.test("request source must match adapter registry source",()=>throws(()=>all.sec!.buildRequest(request("source:wrong")),"INVALID_PROVIDER_REQUEST"));
h.test("live-disabled mode cannot build a callable request",()=>throws(()=>all.sec!.buildRequest(request("source:sec-edgar"),NewsTransportMode.LiveDisabled),"NETWORK_BLOCKED"));
h.test("fixture transport rejects dry-run requests",()=>throws(()=>transport.execute(all.sec!.buildRequest(request("source:sec-edgar"),NewsTransportMode.DryRun)),"FIXTURE_TRANSPORT_BOUNDARY"));
h.test("registry keeps live credential requirements separate from fixture",()=>equal(registry.get("source:finnhub-reuters").credentialsRequiredForLive,true,"live credentials"));
h.run("Options News fixture adapters");
