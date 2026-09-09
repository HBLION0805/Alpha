import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,realpathSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute} from 'node:path';
import {GOLD_REVIEW_AREAS,GOLD_REVIEW_PROFILES,goldFrameworkCatalog} from '../src/engines/options-drivers/OptionsGoldFramework.ts';
import {OPTIONS_DRIVER_FACTORS} from '../src/engines/options-drivers/OptionsDriverCatalog.ts';
import {goldFrameworkView} from './lib/options-gold-framework.mjs';
import {goldFrameworkPanel} from '../apps/options-workbench/gold-framework.js';
import {classifyFocusedHeadline} from '../src/engines/options-drivers/OptionsFocusedNews.ts';
import {startOptionsWorkbench} from './options-workbench.mjs';
import {runGuidanceCommand} from './options-daily-guidance.mjs';

let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const at='2026-09-09T18:00:00.000Z',available=data=>({state:'AVAILABLE',data});
const source=()=>({treasury:available({latestRetrieval:{status:'OK',receivedAt:'2026-09-09T13:00:00.000Z',url:'https://home.treasury.gov/'},currentRow:{sourceDate:'2026-09-08',ratesBps:{10:212}},currentDateLagDays:1})});
const lead=(extra={})=>({sourceId:'fed',itemId:'a',link:'https://example.com/gold',headline:'Gold and Treasury buybacks',origin:'PUBLIC_FEED',assets:['GLD','IBIT'],observedAt:at,publishedAt:at,...extra});
const row=(v,id)=>v.areas.find(a=>a.id===id);
async function temp(fn){const root=mkdtempSync(join(tmpdir(),'alpha-gold-framework-'));try{await fn(root);}finally{const path=realpathSync(root),rel=relative(realpathSync(tmpdir()),path);if(isAbsolute(rel)||rel.startsWith('..')||!rel.startsWith('alpha-gold-framework-'))throw Error('UNSAFE_TEST_CLEANUP');rmSync(path,{recursive:true,force:true});}}

await test('all screenshot areas retained exactly once and seven overlays explicit',()=>{assert.deepEqual(GOLD_REVIEW_AREAS.filter(a=>a.screenshotArea!==null).map(a=>a.screenshotArea),Array.from({length:14},(_,i)=>i+1));assert.equal(GOLD_REVIEW_AREAS.filter(a=>a.screenshotArea===null).length,7);assert.equal(new Set(GOLD_REVIEW_AREAS.map(a=>a.id)).size,21);});
await test('crosswalk uses original gold-relevant families and reviewed references',()=>{const refs=goldFrameworkCatalog().references;for(const a of GOLD_REVIEW_AREAS){assert(a.familyIds.length);for(const id of a.familyIds)assert(OPTIONS_DRIVER_FACTORS.find(f=>f.id===id)?.assets.includes('GLD'));for(const ref of a.references)assert(refs.some(r=>r.id===ref&&r.url.startsWith('https://')));}});
await test('original catalog remains 16 families and 94 indicators',()=>{assert.deepEqual(goldFrameworkCatalog().originalCatalog,{families:16,indicators:94});assert(Object.isFrozen(GOLD_REVIEW_AREAS[0].addedChecks));assert.throws(()=>GOLD_REVIEW_AREAS[0].addedChecks.push('changed'));});
await test('each regime is a distinct declared review order with valid identities',()=>{assert.equal(GOLD_REVIEW_PROFILES.length,5);for(const p of GOLD_REVIEW_PROFILES){assert.equal(new Set(p.order).size,p.order.length);assert(p.order.every(id=>GOLD_REVIEW_AREAS.some(a=>a.id===id)));}assert.equal(goldFrameworkCatalog().currentRegime,'UNDETERMINED');assert.equal(goldFrameworkCatalog().calibratedProbability,null);});
await test('empty evidence cannot produce numerical coverage or a directional vote',()=>{const v=goldFrameworkView({},at);assert.equal(v.counts.partialNumericalAreas,0);assert(v.areas.every(a=>a.numericEvidence===null&&a.direction==='UNDETERMINED'));assert.equal(v.executionAllowed,false);});
await test('one daily real-yield observation is not live nominal yields or full rates coverage',()=>{const v=goldFrameworkView(source(),at),r=row(v,'real_rates');assert.equal(r.numericalCoverage,'PARTIAL_DAILY_REAL_YIELD');assert.equal(r.numericEvidence.tenYearRealYieldBps,212);assert.equal(r.numericEvidence.sourceDate,'2026-09-08');assert.equal(v.counts.partialNumericalAreas,1);assert.equal(row(v,'dollar').numericEvidence,null);});
await test('old source date remains visible even on a newly retrieved feed',()=>{const s=source();s.treasury.data.currentRow.sourceDate='2026-08-28';s.treasury.data.currentDateLagDays=12;const r=row(goldFrameworkView(s,at),'real_rates');assert.equal(r.numericEvidence.sourceDateLagDays,12);assert.equal(r.numericEvidence.freshness,'SOURCE_DATE_AND_RECEIPT_ONLY');});
for(const [name,mutate] of [
  ['failed component',s=>s.treasury.state='BLOCKED'],
  ['failed latest retrieval',s=>s.treasury.data.latestRetrieval.status='FAILED'],
  ['future receipt',s=>s.treasury.data.latestRetrieval.receivedAt='2026-09-10T13:00:00.000Z'],
  ['future row',s=>s.treasury.data.currentRow.sourceDate='2026-09-10'],
  ['missing 10Y',s=>s.treasury.data.currentRow.ratesBps[10]=null],
  ['invalid receipt',s=>s.treasury.data.latestRetrieval.receivedAt='yesterday'],
])await test(name+' cannot masquerade as numerical coverage',()=>{const s=source();mutate(s);assert.equal(goldFrameworkView(s,at).counts.partialNumericalAreas,0);});
await test('future receipt and synthetic leads are excluded',()=>{const s={focusedNews:available({items:[lead({origin:'MANUAL_SCENARIO'}),lead({observedAt:'2026-09-10T13:00:00.000Z'})]})};assert(goldFrameworkView(s,at).areas.every(a=>a.headlineLeadCount===0));});
await test('failed reader does not leak retained source data as current leads',()=>{const s={focusedNews:{state:'BLOCKED',data:{items:[lead()]}}};assert.equal(row(goldFrameworkView(s,at),'treasury_supply').headlineLeadCount,0);});
await test('repeated link stays one unverified lead within each area',()=>{const v=goldFrameworkView({focusedNews:available({items:[lead(),lead({itemId:'other'})]})},at),r=row(v,'treasury_supply');assert.equal(r.headlineLeadCount,1);assert.equal(r.headlineLeads[0].verifiedFact,false);assert.equal(r.numericEvidence,null);});
await test('old and future publication clocks remain explicit',()=>{for(const [date,status] of [['2026-09-01T18:00:00.000Z','STALE'],['2026-09-10T18:00:00.000Z','UNKNOWN_OR_FUTURE_PUBLICATION'],[null,'UNKNOWN_OR_FUTURE_PUBLICATION']]){const v=goldFrameworkView({focusedNews:available({items:[lead({publishedAt:date})]})},at);assert.equal(row(v,'treasury_supply').headlineLeads[0].freshness,status);}});
await test('projection cannot mutate original input or imply current market time',()=>{const s={...source(),guidance:available({current:{marketCapturedAt:'2026-09-10T18:00:00.000Z'}})},before=JSON.stringify(s);const v=goldFrameworkView(s,at);assert.equal(JSON.stringify(s),before);assert.equal(v.partialContext.marketCapturedAt,null);});
await test('calendar is schedule context only and future clocks are excluded',()=>{const s={calendar:available({sources:{bls:{state:'AVAILABLE',latestReceivedAt:at,refreshOverdue:false},fomc:{state:'AVAILABLE',latestReceivedAt:'2026-09-10T18:00:00.000Z'}}})};const v=goldFrameworkView(s,at);assert.equal(v.partialContext.calendarSources.length,1);assert.equal(v.partialContext.calendarSources[0].scope,'SCHEDULE_ONLY_NOT_ACTUAL_OR_CONSENSUS');});
for(const title of ['Treasury buybacks support liquidity','Quarterly refunding increases issuance','ADP employment revised','ISM services beats forecasts','Jobless claims move higher','CME margin requirements increase','Repo rates rise after settlement','Credit spreads widen'])await test('focused scope includes '+title,()=>{const r=classifyFocusedHeadline(title);assert(r.assets.includes('GLD'));assert.equal(r.verifiedFact,false);assert.equal(r.direction,'UNDETERMINED');});
for(const title of ['Nvidia profit margin expands','Apple buys back shares','Goldman Sachs raises chip forecast'])await test('unrelated title remains excluded: '+title,()=>assert.equal(classifyFocusedHeadline(title).scope,'OUT_OF_SCOPE'));
await test('UI escapes source text and never renders unsafe links',()=>{const v=goldFrameworkView({focusedNews:available({items:[lead({headline:'Gold <img src=x onerror=alert(1)>',link:'javascript:alert(1)'})]})},at);const html=goldFrameworkPanel(available(v));assert(html.includes('&lt;img'));assert(!html.includes('<img'));assert(!html.includes('href="javascript:'));assert(html.includes('not fitted weights'));assert(html.includes('No matching saved title'));});
await test('API and Host expose framework without storing a synthetic record or refreshing sources',()=>temp(async root=>{const server=await startOptionsWorkbench({workspaceRoot:root,port:0,now:()=>at});try{const response=await fetch(server.url+'/api/state'),state=await response.json();assert.equal(state.goldFramework.state,'AVAILABLE');assert.equal(state.goldFramework.data.counts.screenshotAreas,14);assert.equal((await fetch(server.url+'/gold-framework.js')).status,200);assert.equal((await fetch(server.url+'/api/gold-framework',{method:'POST',body:'{}'})).status,404);const brief=await runGuidanceCommand(['--host-brief'],{workspaceRoot:root,now:()=>at});assert.equal(brief.goldFramework.version,'OPTIONS_GOLD_FRAMEWORK_V1');assert.deepEqual(readdirSync(root),[]);}finally{await server.close();}}));
await test('context export and frontend module are wired',()=>{assert(readFileSync('apps/options-workbench/app.js','utf8').includes('goldFramework:state.goldFramework'));assert(readFileSync('apps/options-workbench/focused-news.js','utf8').includes('goldFrameworkPanel(s.goldFramework)'));});
console.log(passed+'/'+passed+' tests passed.');
