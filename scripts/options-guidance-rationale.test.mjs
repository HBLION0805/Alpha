import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute} from 'node:path';
import {explainDailyGuidance} from '../src/engines/options-daily-guidance/OptionsGuidanceRationale.ts';
import {assessDailyGuidance,defaultGuidanceSettings} from '../src/engines/options-daily-guidance/OptionsDailyGuidance.ts';
import {paperFingerprint} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {guidanceView,publishGuidance,saveGuidanceSettings,explainIssuedGuidance,verifyGuidanceRecord} from './lib/options-guidance-io.mjs';
import {runGuidanceCommand} from './options-daily-guidance.mjs';
import {contractRationale,rationaleDimensions,guidancePage} from '../apps/options-workbench/guidance.js';

let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const at='2026-09-10T14:00:00.000Z',id='00000000-0000-0000-0000-000000000001';
const issuedAt='2026-09-08T14:00:00.000Z';
const input=()=>({version:'OPTIONS_DAILY_GUIDANCE_INPUT_V1',at,captureAt:at,captureOrigin:'HOST_MARKET_TOOL_RESPONSES',captureComplete:true,
  quotes:[{id,symbol:'GLD',expiry:'2026-10-09',type:'call',strike:'100',multiplier:100,bidCents:195,askCents:200,tickCents:1,bidSize:10,askSize:10,delta:0.5,updatedAt:at,receivedAt:at}],
  equities:[{symbol:'GLD',price:'99',sourceAt:at,close:{date:'2026-09-09',price:'98'}}],closeHistory:[],events:[],calendarAvailable:true,headlinesAvailable:true,headlines:[],sourceHealth:[],context:{treasury:null,btc:null},settings:{...defaultGuidanceSettings(),roundTripFeesCents:50,slippageReserveCents:50}});
const contract=i=>explainDailyGuidance(i).assets[0].contracts[0];
await test('call threshold includes premium; reserve costs counted once per 100 shares',()=>{
  const c=contract(input());assert.equal(c.terminal.grossBreakEvenUsd,'102.000000');assert.equal(c.terminal.reservedCostBreakEvenUsd,'102.010000');assert.equal(c.terminal.grossMoveFromReferencePercent,'3.03');assert.equal(c.referenceIntrinsicPerShareUsd,'0.000000');assert.equal(c.referenceExtrinsicPerShareUsd,'2.000000');assert.equal(c.moneyness,'OUT_OF_THE_MONEY');
});
await test('put thresholds subtract premium and costs; downside move is signed',()=>{
  const i=input();Object.assign(i.quotes[0],{type:'put',delta:-0.5,strike:'105'});i.equities[0].price='108';const c=contract(i);assert.equal(c.terminal.grossBreakEvenUsd,'103.000000');assert.equal(c.terminal.reservedCostBreakEvenUsd,'102.990000');assert.equal(c.terminal.grossMoveFromReferencePercent,'-4.63');
});
await test('fractional strikes retain exact microdollar precision',()=>{
  const i=input();i.quotes[0].strike='100.123456';assert.equal(contract(i).terminal.reservedCostBreakEvenUsd,'102.133456');
});
await test('in-the-money reference splits premium into intrinsic and extrinsic',()=>{
  const i=input();i.quotes[0].strike='95';i.quotes[0].askCents=502;i.equities[0].price='100';const c=contract(i);assert.equal(c.moneyness,'IN_THE_MONEY');assert.equal(c.referenceIntrinsicPerShareUsd,'5.000000');assert.equal(c.referenceExtrinsicPerShareUsd,'0.020000');
});
await test('negative reference extrinsic is a visible data concern, never clipped to zero',()=>{
  const i=input();i.quotes[0].strike='95';const c=contract(i);assert.equal(c.referenceExtrinsicPerShareUsd,'-2.000000');assert.equal(c.referenceAnomaly,'ASK_BELOW_REFERENCE_INTRINSIC_RECHECK_CLOCKS_AND_QUOTES');
});
for(const key of ['roundTripFeesCents','slippageReserveCents'])await test('unknown '+key+' preserves gross threshold and unknown reserved threshold',()=>{
  const i=input();i.settings[key]=null;const c=contract(i);assert.equal(c.terminal.grossBreakEvenUsd,'102.000000');assert.equal(c.terminal.reservedCostBreakEvenUsd,null);assert.equal(c.terminal.reservedCostState,'COSTS_UNKNOWN');assert.equal(explainDailyGuidance(i).assets[0].dimensions[5].status,'COSTS_UNKNOWN');
});
await test('put premium above strike has no nonnegative expiry breakeven',()=>{
  const i=input();Object.assign(i.quotes[0],{type:'put',strike:'1',delta:-0.5});const c=contract(i);assert.equal(c.terminal.grossState,'NO_NONNEGATIVE_BREAK_EVEN');assert.equal(c.terminal.grossBreakEvenUsd,null);assert.equal(c.terminal.reservedCostState,'NO_NONNEGATIVE_BREAK_EVEN');assert.equal(c.terminal.grossMoveFromReferencePercent,null);
});
await test('zero put breakeven remains attainable at zero; positive reserve removes it',()=>{
  const i=input();Object.assign(i.quotes[0],{type:'put',strike:'2',delta:-0.5});const c=contract(i);assert.equal(c.terminal.grossBreakEvenUsd,'0.000000');assert.equal(c.terminal.reservedCostState,'NO_NONNEGATIVE_BREAK_EVEN');
});
await test('nonstandard multiplier cannot borrow standard-contract reserve arithmetic',()=>{
  const i=input();i.quotes[0].multiplier=10;assert.equal(contract(i).terminal.grossState,'UNAVAILABLE');
});
await test('missing ask cannot become a zero-cost option',()=>{
  const i=input();i.quotes[0].askCents=null;const c=contract(i);assert.equal(c.terminal.grossBreakEvenUsd,null);assert.equal(c.referenceExtrinsicPerShareUsd,null);assert.equal(c.referencePricesComparable,false);
});
await test('stale underlying keeps reference numbers without a live comparison claim',()=>{
  const i=input();i.equities[0].sourceAt='2026-09-09T20:00:00.000Z';const r=explainDailyGuidance(i);assert.equal(r.assets[0].reference.freshness,'STALE');assert.equal(r.assets[0].contracts[0].referencePricesComparable,false);assert.equal(r.assets[0].contracts[0].terminal.grossBreakEvenUsd,'102.000000');
});
await test('future quote remains visibly future with its original no-trade blocker',()=>{
  const i=input();i.quotes[0].updatedAt='2026-09-10T14:01:00.000Z';const c=contract(i);assert.equal(c.quoteFreshness,'FUTURE');assert(c.blockers.includes('OPTION_QUOTE_NOT_FRESH'));assert.equal(c.referencePricesComparable,false);
});
await test('absent underlying never produces a percentage or false moneyness',()=>{
  const i=input();i.equities=[];const c=contract(i);assert.equal(c.moneyness,'UNKNOWN');assert.equal(c.terminal.grossMoveFromReferencePercent,null);assert.equal(c.referencePricesComparable,false);
});
const event=(title,startDate,endDate,scheduledAt=null)=>({title,source:title==='FOMC'?'FOMC':'BLS',startDate,endDate,scheduledAt});
await test('known released event is excluded from future expiry exposure at its release instant',()=>{
  const i=input();i.events=[event('Producer Price Index','2026-09-10','2026-09-10',at),event('Consumer Price Index','2026-09-11','2026-09-11','2026-09-11T12:30:00.000Z')];const c=contract(i);assert.equal(c.expiryEvents.length,1);assert.equal(c.expiryEvents[0].title,'Consumer Price Index');assert(c.blockers.includes('MAJOR_EVENT_WAIT'));
});
await test('date-only FOMC preserves uncertainty on the current date',()=>{
  const i=input();i.events=[event('FOMC','2026-09-10','2026-09-10')];const c=contract(i);assert.equal(c.expiryEvents[0].timing,'DATE_ONLY_RELEASE_TIME_UNKNOWN');assert.equal(c.expiryEvents[0].scheduledAt,null);
});
await test('expiry-day and overlapping multiday events do not imply a qualified release-before-close',()=>{
  const i=input();i.events=[event('FOMC','2026-10-08','2026-10-10'),event('Consumer Price Index','2026-10-09','2026-10-09','2026-10-09T12:30:00.000Z'),event('Producer Price Index','2026-10-12','2026-10-12')];const events=contract(i).expiryEvents;assert.equal(events.length,2);assert.equal(events[0].overlap,'EXTENDS_BEYOND_EXPIRY');assert.equal(events[1].overlap,'EXPIRY_DAY_TIME_NOT_QUALIFIED');
});
await test('unavailable calendars remain incomplete even with entries',()=>{
  const i=input();i.calendarAvailable=false;i.events=[event('FOMC','2026-09-15','2026-09-16')];const c=contract(i);assert.equal(c.calendarCoverageAvailable,false);assert(contractRationale(c).includes('Calendar coverage is incomplete'));
});
await test('original input, report fingerprints, ranking and economics are unchanged',()=>{
  const i=input(),before=paperFingerprint(i),original=assessDailyGuidance(i),r=explainDailyGuidance(i);assert.equal(paperFingerprint(i),before);assert.equal(r.originalReportFingerprint,paperFingerprint(original));assert.equal(r.rankingChanged,false);assert.deepEqual(r.assets[0].contracts[0].originalEconomics,original.assets[0].candidates[0].feasibility.economics);assert.equal(r.assets[0].contracts[0].disposition,original.assets[0].candidates[0].disposition);assert.equal(r.executionAllowed,false);
});
await test('all six dimensions retain forecast, IV, path and time-exit gaps',()=>{
  const r=explainDailyGuidance(input()),a=r.assets[0],c=a.contracts[0];assert.deepEqual(a.dimensions.map(d=>d.id),['DIRECTION','MAGNITUDE','TIME','VOLATILITY','PATH','RISK']);assert.equal(c.expectedEtfPriceRange,null);assert.equal(c.preExpiryPriceForecast,null);assert.equal(c.timeExitAt,null);assert.equal(r.winProbability,null);
});
await test('expired analyst note is not described as current',()=>{
  const i=input();i.analyst={assessedAt:'2026-09-08T14:00:00.000Z',assets:[{symbol:'GLD',bias:'BULLISH',summary:'old',sources:[{url:'https://www.bls.gov/',retrievedAt:'2026-09-08T14:00:00.000Z'}]}]};assert(explainDailyGuidance(i).assets[0].dimensions[0].explanation.includes('No current attributed'));
});
await test('a recent note still needs reassessment after a newer market capture',()=>{
  const i=input();i.analyst={assessedAt:'2026-09-10T13:59:00.000Z',assets:[{symbol:'GLD',bias:'BULLISH',summary:'before capture',sources:[{url:'https://www.bls.gov/',retrievedAt:'2026-09-10T13:59:00.000Z'}]}]};const a=explainDailyGuidance(i).assets[0];assert.equal(a.analystReview.status,'NEWER_MARKET_EVIDENCE_NEEDS_REVIEW');assert(a.dimensions[0].explanation.includes('predates newer market evidence'));
});
await test('renderer escapes event and dimension text; expiry thresholds are not sold as targets',()=>{
  const i=input();i.events=[event('<img src=x> Consumer Price Index','2026-09-11','2026-09-11')];const r=explainDailyGuidance(i);r.assets[0].dimensions[0].explanation='<script>bad</script>';const html=contractRationale(r.assets[0].contracts[0])+rationaleDimensions(r.assets[0]);assert(!html.includes('<img'));assert(html.includes('&lt;img'));assert(!html.includes('<script>'));assert(html.includes('Pre-expiry ETF target: unestablished'));assert(!html.includes('data-order'));
});
await test('daily page shows the same rationale and original no-trade decision',()=>{
  const i=input(),r=explainDailyGuidance(i),html=guidancePage({loadedAt:at,guidance:{data:{current:assessDailyGuidance(i),rationale:r,history:[],interpretation:null}}});assert(html.includes('Six-dimension decision check'));assert(html.includes('Expiry-only breakeven'));assert(html.includes('No Trade'));
});
async function temp(fn){const root=mkdtempSync(join(tmpdir(),'alpha-rationale-test-'));try{await fn(root);}finally{const real=realpathSync(root),rel=relative(realpathSync(tmpdir()),real);if(isAbsolute(rel)||rel.startsWith('..')||!rel.startsWith('alpha-rationale-test-'))throw Error('UNSAFE_TEST_CLEANUP');rmSync(real,{recursive:true,force:true});}}
await test('historical explanation uses frozen inputs, not later settings or current time',()=>temp(async root=>{
  const state={loadedAt:issuedAt,headlines:{data:null},calendar:{data:null}},path=publishGuidance(root,state),before=readFileSync(join(root,path));saveGuidanceSettings(root,{...defaultGuidanceSettings(),roundTripFeesCents:10,slippageReserveCents:20});const r=explainIssuedGuidance(root,path);assert.equal(r.rationale.assessedAt,issuedAt);assert.equal(r.rationale.assets[0].dimensions[5].status,'COSTS_UNKNOWN');assert.equal(r.authority,'LATER_EXPLANATION_OF_FROZEN_INPUTS_NOT_ORIGINAL_ISSUED_TEXT');assert.equal(verifyGuidanceRecord(root,path).status,'VERIFIED');assert.deepEqual(readFileSync(join(root,path)),before);assert.equal((await runGuidanceCommand(['--explain-report',path],{workspaceRoot:root})).inputFingerprint,r.inputFingerprint);
}));
await test('historical explanation rejects corrupted original reports',()=>temp(root=>{
  const path=publishGuidance(root,{loadedAt:issuedAt}),p=join(root,path),r=JSON.parse(readFileSync(p,'utf8'));r.report.executionAllowed=true;writeFileSync(p,JSON.stringify(r));assert.throws(()=>explainIssuedGuidance(root,path),/INTEGRITY/);
}));
await test('empty stores expose explicit dimensions without inventing contracts',()=>temp(root=>{
  const v=guidanceView(root,{loadedAt:at});assert.equal(v.rationale.assets.length,2);assert.equal(v.rationale.assets[0].contracts.length,0);assert.equal(v.rationale.assets[0].dimensions[0].status,'UNCONFIRMED');
}));
console.log(`${passed}/${passed} tests passed.`);
