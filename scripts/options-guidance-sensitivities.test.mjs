import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute} from 'node:path';
import {assessGuidanceSensitivities} from '../src/engines/options-daily-guidance/OptionsGuidanceSensitivities.ts';
import {guidanceView,guidanceSensitivityView,normalizeGuidanceCapture,recordGuidanceMarket,publishGuidance,verifyGuidanceRecord} from './lib/options-guidance-io.mjs';
import {paperFingerprint} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {sensitivitiesPanel,contractSensitivity} from '../apps/options-workbench/sensitivities.js';
import {runGuidanceCommand} from './options-daily-guidance.mjs';
import {startOptionsWorkbench} from './options-workbench.mjs';

let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const at='2026-09-10T14:00:00.000Z',uuid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const quote=()=>({id:uuid(1),symbol:'GLD',expiry:'2026-10-09',strike:'100',type:'call',multiplier:100,quoteReturned:true,sourceAt:at,receivedAt:at,
  greeks:{delta:'0.5',gamma:'0.02',theta:'-0.04',vega:'0.1',implied_volatility:'0.30'}});
const row=(q=quote(),clock=at)=>assessGuidanceSensitivities(clock,[q]).rows[0];
await test('calendar-day theta and percentage-point vega use 100 shares exactly',()=>{
  const r=row();assert.equal(r.impliedVolatilityPercent,'30.00000000');assert.equal(r.scenarios[0].valueChangeUsd,'-4.00000000');assert.equal(r.scenarios[1].valueChangeUsd,'-10.00000000');
});
await test('favorable and adverse illustrations keep delta, half gamma, decay and vega signs',()=>{
  const r=row();assert.equal(r.scenarios[2].valueChangeUsd,'37.00000000');assert.equal(r.scenarios[3].valueChangeUsd,'-43.00000000');
  assert.deepEqual(r.scenarios[2].components,{deltaUsd:'50.00000000',gammaUsd:'1.00000000',timeUsd:'-4.00000000',volatilityUsd:'-10.00000000'});
});
await test('put favorable direction is down, with the same gamma contribution',()=>{
  const q=quote();q.type='put';q.greeks.delta='-0.5';const r=row(q);assert.equal(r.scenarios[2].underlyingChangeUsd,-1);assert.equal(r.scenarios[2].valueChangeUsd,'37.00000000');assert.equal(r.scenarios[3].valueChangeUsd,'-43.00000000');
});
await test('correct direction can have a negative combined value change',()=>{
  const q=quote();q.greeks.theta='-0.6';assert.equal(row(q).scenarios[2].valueChangeUsd,'-19.00000000');
});
await test('valid zero is reported and never converted to missing',()=>{
  const q=quote();q.greeks.gamma='0';q.greeks.theta='-0.00000000';q.greeks.vega='0';const r=row(q);assert.equal(r.scenarios[0].valueChangeUsd,'0.00000000');assert.equal(r.scenarios[2].valueChangeUsd,'50.00000000');assert.equal(r.metrics.theta.status,'REPORTED_MODEL_VALUE');
});
await test('positive theta is retained, not rewritten as negative',()=>{
  const q=quote();q.greeks.theta='0.02';assert.equal(row(q).scenarios[0].valueChangeUsd,'2.00000000');
});
await test('eight-place source values retain exact decimal changes',()=>{
  const q=quote();q.greeks.theta='-0.00000001';q.greeks.gamma='0.00000001';const r=row(q);assert.equal(r.scenarios[0].valueChangeUsd,'-0.00000100');assert.equal(r.scenarios[2].components.gammaUsd,'0.00000050');
});
for(const [name,raw] of [['delta','1.1'],['gamma','-0.01'],['vega','-0.1'],['implied_volatility','-0.1'],['theta','NaN'],['theta','1e-2'],['theta','1000001'],['theta',0.1],['theta','0.123456789']])await test('invalid '+name+' '+raw+' stays unavailable',()=>{
  const q=quote();q.greeks[name]=raw;assert.equal(row(q).metrics[name].status,'INVALID');assert.equal(row(q).metrics[name].value,null);
});
await test('missing gamma blocks combined scenario but not independent time or IV changes',()=>{
  const q=quote();delete q.greeks.gamma;const r=row(q);assert.equal(r.metrics.gamma.status,'MISSING');assert.equal(r.scenarios[0].valueChangeUsd,'-4.00000000');assert.equal(r.scenarios[1].valueChangeUsd,'-10.00000000');assert.equal(r.scenarios[2].valueChangeUsd,null);
});
await test('missing IV level blocks IV shifts but preserves a one-day illustration',()=>{
  const q=quote();q.greeks.implied_volatility=null;const r=row(q);assert.equal(r.scenarios[0].valueChangeUsd,'-4.00000000');assert(r.scenarios[1].blockers.includes('IV_LEVEL_UNAVAILABLE'));
});
await test('IV down cannot cross zero; zero itself is accepted',()=>{
  const q=quote();q.greeks.implied_volatility='0.005';assert(row(q).scenarios[1].blockers.includes('NEGATIVE_IV_SCENARIO'));assert.equal(row(q).scenarios[3].valueChangeUsd,'-43.00000000');q.greeks.implied_volatility='0.01';assert.equal(row(q).scenarios[1].valueChangeUsd,'-10.00000000');q.greeks.implied_volatility='0';assert.equal(row(q).impliedVolatilityPercent,'0.00000000');
});
await test('nonstandard contract blocks all contract-dollar outputs',()=>{
  const q=quote();q.multiplier=10;for(const s of row(q).scenarios){assert.equal(s.valueChangeUsd,null);assert(Object.values(s.components).every(v=>v===null));}
});
await test('missing quote preserves identity and unknown reference',()=>{
  const q=quote();q.quoteReturned=false;q.sourceAt=null;q.receivedAt=null;q.greeks={};const r=row(q);assert.equal(r.referenceStatus,'QUOTE_MISSING');assert.equal(r.id,q.id);assert(r.scenarios.every(s=>s.valueChangeUsd===null));
});
await test('120-second boundary is clock freshness, not Greek timestamp verification',()=>{
  assert.equal(row(quote(),'2026-09-10T14:02:00.000Z').freshness,'WITHIN_120_SECONDS');const r=row(quote(),'2026-09-10T14:02:00.001Z');assert.equal(r.freshness,'STALE');assert.equal(r.referenceStatus,'HISTORICAL_OR_UNTIMED_ILLUSTRATION');assert.equal(r.greekTimestamp,null);
});
await test('nanosecond provider clocks retain original text and support local date derivation',()=>{
  const q=quote();q.sourceAt='2026-09-10T13:59:59.954499727Z';const r=row(q);assert.equal(r.sourceAt,q.sourceAt);assert.equal(r.scenarios[0].valueChangeUsd,'-4.00000000');assert.equal(r.freshness,'WITHIN_120_SECONDS');
});
await test('future source or receipt blocks numeric illustrations',()=>{
  for(const key of ['sourceAt','receivedAt']){const q=quote();q[key]='2026-09-10T14:01:00.000Z';assert(row(q).scenarios.every(s=>s.valueChangeUsd===null));}
});
await test('unknown source clock cannot qualify a day horizon',()=>{
  const q=quote();q.sourceAt=null;const r=row(q);assert.equal(r.freshness,'UNKNOWN');assert.equal(r.scenarios[0].valueChangeUsd,null);assert.equal(r.scenarios[1].valueChangeUsd,'-10.00000000');
});
await test('expiry-day source blocks one-day extension; later review of old Greeks stays historical',()=>{
  const q=quote();q.expiry='2026-09-10';assert(row(q).scenarios[0].blockers.includes('DAY_SHOCK_BEYOND_EXPIRY'));assert.equal(row(q).referenceStatus,'HISTORICAL_OR_UNTIMED_ILLUSTRATION');assert.equal(row(quote(),'2026-10-10T14:00:00.000Z').referenceStatus,'HISTORICAL_OR_UNTIMED_ILLUSTRATION');
});
await test('scope rejects duplicate IDs, excess rows and unrelated symbols',()=>{
  assert.throws(()=>assessGuidanceSensitivities(at,[quote(),quote()]),/SCOPE/);assert.throws(()=>assessGuidanceSensitivities(at,Array.from({length:37},(_,i)=>({...quote(),id:uuid(i)}))),/SCOPE/);assert.throws(()=>row({...quote(),symbol:'SPY'}),/SYMBOL/);
});
await test('no profit probability, option price, order permission or ranking change is produced',()=>{
  const q=quote();q.greeks.chance_of_profit_long='0.99';const before=structuredClone(q),r=assessGuidanceSensitivities(at,[q]);assert.deepEqual(q,before);assert.equal(r.winProbability,null);assert.equal(r.probabilityUsed,false);assert.equal(r.executionAllowed,false);assert.equal(r.rankingChanged,false);assert.equal(r.sourceReads,0);assert(!JSON.stringify(r).includes('chance_of_profit_long'));assert(!Object.hasOwn(r.rows[0].scenarios[0],'optionPrice'));
});

async function temp(fn){const root=mkdtempSync(join(tmpdir(),'alpha-sensitivity-test-'));try{await fn(root);}finally{const full=realpathSync(root),rel=relative(realpathSync(tmpdir()),full);if(isAbsolute(rel)||rel.startsWith('..')||!rel.startsWith('alpha-sensitivity-test-'))throw Error('UNSAFE_TEST_CLEANUP');rmSync(full,{recursive:true,force:true});}}
function capture(){
  const receipt=(tool,request,data)=>({tool,request,requestedAt:at,receivedAt:at,response:{data}});
  return {version:'OPTIONS_GUIDANCE_MARKET_CAPTURE_V1',origin:'SYNTHETIC_FIXTURE',startedAt:at,capturedAt:at,calls:3,
    receipts:[receipt('get_option_chains',{underlying_symbol:'GLD'},{chains:[{id:uuid(8),symbol:'GLD',expiration_dates:['2026-10-09']}]}),
      receipt('get_option_instruments',{chain_id:uuid(8),expiration_dates:'2026-10-09',state:'active'},{instruments:[1,2].map(n=>({id:uuid(n),chain_id:uuid(8),chain_symbol:'GLD',expiration_date:'2026-10-09',type:'call',strike_price:'100',underlying_type:'equity',state:'active',tradability:'tradable',trade_value_multiplier:'100',min_ticks:{above_tick:'0.05',below_tick:'0.01',cutoff_price:'3'}}))}),
      receipt('get_option_quotes',{instrument_ids:[uuid(1),uuid(2)]},{results:[{quote:{instrument_id:uuid(1),bid_price:'1.90',ask_price:'2.00',bid_size:5,ask_size:5,updated_at:at,...quote().greeks}}]})],
    failures:[],selectedIds:[uuid(1),uuid(2)],selection:'Synthetic sensitivity test only',accountAccessed:false,executionAllowed:false};
}
function saved(root){const input=capture(),file=join(root,'input.json');writeFileSync(file,JSON.stringify(input));const path=recordGuidanceMarket(root,'input.json');return {input,path,view:guidanceView(root,{loadedAt:new Date().toISOString()})};}
await test('verified source adapter retains raw values, missing selected IDs and original fingerprints',()=>temp(root=>{
  const {input,path,view}=saved(root),before=readFileSync(join(root,path)),fingerprint=paperFingerprint(view),r=guidanceSensitivityView(root,view);
  assert.equal(r.coverage.selected,2);assert.equal(r.coverage.returned,1);assert.equal(r.coverage.allMetricsReported,1);assert.equal(r.captureOrigin,'SYNTHETIC_FIXTURE');assert.equal(r.inputFingerprint,paperFingerprint(input));assert.equal(r.rows[0].metrics.theta.raw,'-0.04');assert.equal(r.rows[1].referenceStatus,'QUOTE_MISSING');assert.equal(paperFingerprint(view),fingerprint);assert.deepEqual(readFileSync(join(root,path)),before);assert.equal(verifyGuidanceRecord(root,path).status,'VERIFIED');
  const noGreeks=structuredClone(input);for(const result of noGreeks.receipts[2].response.data.results)for(const k of ['gamma','theta','vega','implied_volatility'])delete result.quote[k];assert.deepEqual(normalizeGuidanceCapture(input),normalizeGuidanceCapture(noGreeks));
}));
await test('tampered supplemental raw field is rejected even when canonical normalization would ignore it',()=>temp(root=>{
  const {path,view}=saved(root),r=JSON.parse(readFileSync(join(root,path),'utf8'));r.input.receipts[2].response.data.results[0].quote.theta='-0.01';writeFileSync(join(root,path),JSON.stringify(r));assert.throws(()=>guidanceSensitivityView(root,view),/INTEGRITY/);
}));
await test('canonical report mismatch and selected source mismatch fail separately',()=>temp(root=>{
  const {path,view}=saved(root);view.input.captureAt='2026-09-09T14:00:00.000Z';assert.throws(()=>guidanceSensitivityView(root,view),/CAPTURE_MISMATCH/);const v=guidanceView(root,{loadedAt:new Date().toISOString()});v.input.quotes[0].askCents=999;assert.throws(()=>guidanceSensitivityView(root,v),/CAPTURE_MISMATCH/);
  const r=JSON.parse(readFileSync(join(root,path),'utf8'));r.report.quotes[0].askCents=300;r.reportFingerprint=paperFingerprint(r.report);writeFileSync(join(root,path),JSON.stringify(r));assert.throws(()=>guidanceSensitivityView(root,v),/CAPTURE_RECOMPUTE/);
}));
await test('issued reports remain reproducible after reading supplemental source data',()=>temp(root=>{
  const {view}=saved(root),path=publishGuidance(root,{loadedAt:new Date().toISOString()}),before=readFileSync(join(root,path));guidanceSensitivityView(root,view);assert.equal(verifyGuidanceRecord(root,path).status,'VERIFIED');assert.deepEqual(readFileSync(join(root,path)),before);
}));
await test('empty or unavailable guidance does not invent source evidence',()=>temp(root=>{
  assert.equal(guidanceSensitivityView(root,guidanceView(root,{loadedAt:at})).coverage.selected,0);assert.throws(()=>guidanceSensitivityView(root,null),/UNAVAILABLE/);
}));
await test('UI exposes IV percent, clocks, missing values, before-cost components and escaped text',()=>{
  const d=assessGuidanceSensitivities(at,[quote(),{...quote(),id:uuid(2),quoteReturned:false,greeks:{}}]);d.rows[0].strike='<script>alert(1)</script>';const html=sensitivitiesPanel({data:d})+contractSensitivity(d.rows[0]);assert(html.includes('30%'));assert(html.includes('Unknown'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(html.includes('Independent Greek timestamps remain unknown'));assert(html.includes('Direction $50.00'));assert(html.includes('Time -$4.00'));assert(html.includes('No future option price'));assert(contractSensitivity(d.rows[0]).includes('calendar day'));assert(sensitivitiesPanel({error:'GUIDANCE_RECORD_INTEGRITY'}).includes('unavailable'));
});
await test('CLI, Host brief and protected local UI state expose the separate view without publishing',()=>temp(async root=>{
  const {path}=saved(root),before=readFileSync(join(root,path));const r=await runGuidanceCommand(['--sensitivities'],{workspaceRoot:root});assert.equal(r.state,'AVAILABLE');assert.equal(r.data.coverage.selected,2);
  const host=await runGuidanceCommand(['--host-brief'],{workspaceRoot:root});assert.equal(host.optionSensitivities.data.coverage.returned,1);
  const app=await startOptionsWorkbench({workspaceRoot:root,port:0});try{const state=await(await fetch(app.url+'/api/state')).json();assert.equal(state.guidanceSensitivities.data.coverage.selected,2);assert.equal((await fetch(app.url+'/sensitivities.js')).status,200);}finally{await app.close();}assert.deepEqual(readFileSync(join(root,path)),before);
}));
console.log(`${passed}/${passed} tests passed.`);
