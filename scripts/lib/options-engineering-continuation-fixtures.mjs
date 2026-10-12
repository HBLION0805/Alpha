// TEST_FIXTURE_ONLY. No market calls or real-account writes.
import {engineeringHash as sha,makeSpyEngineeringPlan} from './options-spy-engineering.mjs';
import {extractEquityProbe,assessEquityProbe} from '../options-equity-source-probe.mjs';
const at='2026-10-12T17:00:00.000Z',accountId='paper-spy-fixture-one';
export function stockFixture(capital=100000){
 const f={accountId,currency:'USD',basis:'ISOLATED_SIMULATED_CAPITAL_V1',initialCapitalCents:capital,settledCashCents:capital,reservedCashCents:0,unsettledCashCents:0,additionalDepositsCents:0,borrowingCents:0,initialPositions:[]},rawJson=JSON.stringify(f);
 return makeSpyEngineeringPlan({at,accountId,context:'SYNTHETIC_FIXTURE',protocolSha256:sha('fixture protocol'),fundsEnvelope:{kind:'ACCOUNT_FUNDS',origin:'SIMULATED_ACCOUNT_ASSUMPTION',verdict:'PASS',reviewedAt:'2026-10-12T16:59:00Z',validThrough:'2026-10-12T20:00:00Z',rawJson,sha256:sha(rawJson)}});
}
export function stockEvent(action='ENTRY',change=()=>{}){
 const isEntry=action==='ENTRY',requested=isEntry?'2026-10-12T17:00:09.000Z':'2026-10-12T17:07:12.000Z',received=isEntry?'2026-10-12T17:00:10.000Z':'2026-10-12T17:07:13.000Z',clock=isEntry?'2026-10-12T17:00:08.123456789Z':'2026-10-12T17:07:12.123456789Z';
 const q={symbol:'SPY',bid_price:isEntry?'778.300000':'779.300001',ask_price:isEntry?'778.320000':'779.320001',venue_bid_time:clock,venue_ask_time:clock,state:'active'};
 const item={type:'mcp_tool_call',id:'call-'+action,server:'robinhood_alpha_market_data',tool:'get_equity_quotes',arguments:{symbols:['SPY']},status:'completed',error:null,result:{structuredContent:{data:{results:[{quote:q}]}}}};change(q,item);
 const events=[{observedAt:requested,event:{type:'item.started',item:{...item,result:undefined}}},{observedAt:received,event:{type:'item.completed',item}}],capture=extractEquityProbe(events,'SYNTHETIC_FIXTURE'),runId='mock-'+action.toLowerCase();
 const originals={'intent.json':JSON.stringify({version:'EQUITY_SOURCE_PROBE_INTENT_V1',runId,origin:'SYNTHETIC_FIXTURE',createdAt:requested,tool:'get_equity_quotes',request:{symbols:['SPY']}}),'host-prompt.txt':'fixture only','host.jsonl':events.map(e=>JSON.stringify(e.event)).join('\n')+'\n','host-stderr.txt':'','events.json':JSON.stringify(events),'capture.json':JSON.stringify(capture),'assessment.json':JSON.stringify(assessEquityProbe(capture,received)),'run.json':JSON.stringify({version:'EQUITY_SOURCE_PROBE_RUN_V1',origin:'SYNTHETIC_FIXTURE',runId,processStartedAt:requested,processFinishedAt:received,eventsPersistedAt:received,capturePersistedAt:received,assessmentPersistedAt:received,exitCode:0,error:null,processClosed:true,startedCalls:1})};
 originals['manifest.json']=JSON.stringify({version:'EQUITY_SOURCE_PROBE_MANIFEST_V1',createdAt:received,files:Object.keys(originals).map(name=>({name,sha256:sha(originals[name])}))});const originalsRawJson=JSON.stringify(originals);
 return {id:'fixture-'+action.toLowerCase(),origin:'SYNTHETIC_FIXTURE',quote:{receivedAt:received,action},appliedAt:isEntry?'2026-10-12T17:00:11.000Z':'2026-10-12T17:07:14.000Z',source:{kind:'RETAINED_EQUITY_PROBE',originalsRawJson,sha256:sha(originalsRawJson)}};
}
