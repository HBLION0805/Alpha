import assert from 'node:assert/strict';
import {dailyDecisionCards} from './lib/options-decision-card.mjs';
import {decisionCardsPanel} from '../apps/options-workbench/decision-cards.js';
import {startOptionsWorkbench} from './options-workbench.mjs';
import {routeDailyGuidance} from './lib/options-guidance-host.mjs';
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const at='2026-09-17T14:20:00.000Z';
const settings={currentEquityCents:100000,settledCashCents:100000,roundTripFeesCents:null,slippageReserveCents:null,stopLossBps:2000,rewardMultipleMilliR:2000,tradeBudget:{version:'OWNER_ALLOCATION_ONLY_V2',minCents:10000,maxCents:50000}};
function candidate(type='put',ask=172){return {contract:{id:type+ask,symbol:'IBIT',expiry:'2026-10-16',strike:'43',type,multiplier:100,bidCents:ask-3,askCents:ask,updatedAt:at},dte:29,disposition:'NO_TRADE',blockers:['COSTS_UNKNOWN'],plan:{entryLimitCents:ask,stopTriggerCents:138,targetExitCents:null},scenario:{...settings,symbol:'IBIT',strategy:type==='put'?'LONG_PUT':'LONG_CALL',quantity:1,contractMultiplier:100,bidPerShareCents:ask-3,askPerShareCents:ask,minimumPriceTickCents:1,mode:'NORMAL'}};}
function fixture(){return {guidance:{data:{current:{assessedAt:at,marketCapturedAt:at,events:[],settings,assets:[{symbol:'GLD',disposition:'WATCH',blockers:['DIRECTION_NOT_CONFIRMED'],candidates:[]},{symbol:'IBIT',disposition:'WATCH',blockers:['DIRECTION_NOT_CONFIRMED'],candidates:[candidate('call'),candidate(),candidate('put',190)]}]},interpretation:{assessedAt:at,assets:[{symbol:'IBIT',bias:'BEARISH',summary:'Rates pressure',supporting:['Lower price'],opposing:['Possible rebound'],sources:[],eventPlan:'Wait for reaction',invalidation:'Review a reversal'}]}}},focusedNews:{data:{sources:[{id:'fed',status:'OK',observedAt:at,refreshOverdue:false,partial:false},{id:'bea',status:'OK',observedAt:at,refreshOverdue:true,partial:true}]}},snapshotPaper:{data:{observations:{rows:[]}}}};}
await test('unknown global fees stay unknown while a labeled cost example retains WATCH',()=>{const s=fixture(),before=JSON.stringify(s),d=dailyDecisionCards(s),c=d.cards[1];assert.equal(c.action,'WATCH');assert.equal(c.references.length,2);assert.ok(c.references.every(x=>x.contract.type==='put'));assert.equal(c.references[0].plan.targetExitCents,null);assert.ok(c.references[0].costExample.targetPerShareCents>172);assert.equal(c.references[0].costExample.changesDecision,false);assert.equal(JSON.stringify(s),before);assert.equal(d.winProbability,null);});
await test('older-than-capture, future and aged analyses cannot supply a current bias',()=>{for(const stamp of ['2026-09-17T14:19:59.000Z','2026-09-17T14:20:01.000Z','2026-09-15T14:20:00.000Z']){const s=fixture();s.guidance.data.interpretation.assessedAt=stamp;const d=dailyDecisionCards(s);assert.equal(d.reviewCurrent,false);assert.equal(d.cards[1].bias,'INSUFFICIENT_EVIDENCE');assert.deepEqual(d.cards[1].supporting,[]);}});
await test('premium boundaries, crossed sides and outside expiries cannot appear as budget references',()=>{const s=fixture();s.guidance.data.current.assets[1].candidates=[candidate('put',99),candidate('put',501),{...candidate(),dte:2},{...candidate(),contract:{...candidate().contract,bidCents:200}}];assert.equal(dailyDecisionCards(s).cards[1].references.length,0);});
await test('missing cost scenario remains unknown without suppressing quote diagnostics',()=>{const s=fixture();delete s.guidance.data.current.assets[1].candidates[1].scenario;const c=dailyDecisionCards(s).cards[1].references[0];assert.equal(c.costExample,null);assert.deepEqual(c.blockers,['COSTS_UNKNOWN']);});
await test('source partial/overdue evidence survives card display',()=>{const html=decisionCardsPanel({data:dailyDecisionCards(fixture())});assert.ok(html.includes('1 / 2 news sources'));assert.ok(html.includes('1 partial feeds'));assert.ok(html.includes('Net target / share<strong>Unknown'));});
await test('provider prose is escaped and unsafe source links are omitted',()=>{const s=fixture();s.guidance.data.interpretation.assets[0].summary='<img src=x onerror=alert(1)>';s.guidance.data.interpretation.assets[0].sources=[{url:'javascript:alert(1)',title:'unsafe'}];const html=decisionCardsPanel({data:dailyDecisionCards(s)});assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('href="javascript:'));});
await test('source failure and NO_ENTRY never claim milestone or real trade success',()=>{const s=fixture();s.snapshotPaper.data.observations.rows=[{planId:'example',state:'FINALIZED',currentPaperStage:'ENTRY_WINDOW_ENDED',lastAutomaticReport:{processReview:{status:'NO_ENTRY',modeledFills:0}}}];const d=dailyDecisionCards(s);assert.equal(d.paper[0].review.modeledFills,0);assert.equal(d.executionAllowed,false);assert.throws(()=>dailyDecisionCards({}),/DECISION_GUIDANCE_UNAVAILABLE/);});
await test('the actual local server serves the new module under its static allowlist',async()=>{const app=await startOptionsWorkbench({port:0,refreshContext:false});try{const response=await fetch(app.url+'/decision-cards.js');assert.equal(response.status,200);assert.ok((await response.text()).includes('decisionCardsPanel'));}finally{await app.close();}});
await test('dated paper wakes operate in ongoing mode and expire without restoring cancelled slots',()=>{
  for(const time of ['14:20','15:20'])assert.equal(routeDailyGuidance('2026-09-17T'+time+':00Z',{ongoing:true}).marketCapture,true);
  for(const date of ['2026-09-16','2026-09-18'])assert.equal(routeDailyGuidance(date+'T14:20:00Z',{ongoing:true}).marketCapture,false);
  for(const time of ['13:50','16:50','14:19','14:50','16:20'])assert.equal(routeDailyGuidance('2026-09-17T'+time+':00Z',{ongoing:true}).marketCapture,false);
  assert.equal(routeDailyGuidance('2026-09-17T14:20:00Z',{ongoing:true}).closeCapture,false);
});
await test('expiry boundaries distinguish 0DTE, short dates, current scope and missing DTE',()=>{
  const s=fixture(),a=s.guidance.data.current.assets[1];
  a.candidates=[-1,0,1,13,14,45,46,null,undefined,NaN,1.5].map(dte=>({...candidate(),dte}));
  const b=dailyDecisionCards(s).cards[1].buyerEntryBoundary;
  assert.deepEqual(b.expiryCounts,{EXPIRED:1,ZERO_DTE:1,SHORT_DATED_OUTSIDE_SCOPE:2,RESEARCH_14_TO_45:2,LONG_DATED_OUTSIDE_SCOPE:1,UNKNOWN:4});
  assert.equal(b.sampledContractCount,11);assert.equal(b.canConfirmSetup,false);
});
await test('trend, headline assertions, option candles and futures bars cannot confirm an ETF setup',()=>{
  const s=fixture();s.guidance.data.current.assets[1].trend={direction:'UP'};
  s.guidance.data.interpretation.assets[0].summary='Confirmed breakout; 90% chance to double';
  s.barQuality={state:'AVAILABLE',data:{signal:'BREAKOUT',bars:Array(100).fill({instrument:'IBIT option'})}};
  s.futuresBars={symbol:'BTC',status:'QUALIFIED',breakout:true};
  const before=JSON.stringify(s),d=dailyDecisionCards(s),b=d.cards[1].buyerEntryBoundary;
  assert.equal(b.status,'NOT_ASSESSABLE');assert.equal(b.setups.length,3);
  assert.ok(b.setups.every(x=>x.status==='NOT_ASSESSABLE'&&x.winProbability===null&&x.expectedReturn===null));
  assert.equal(b.winProbability,null);assert.equal(b.changesGuidance,false);assert.equal(d.cards[1].action,'WATCH');
  assert.equal(JSON.stringify(s),before);assert.match(b.proxyBoundary,/IBIT bars/);
  assert.match(d.cards[0].buyerEntryBoundary.proxyBoundary,/GLD bars/);
});
await test('empty samples stay unknown about market availability and rendered rules expose gaps',()=>{
  const d=dailyDecisionCards(fixture()),b=d.cards[0].buyerEntryBoundary;
  assert.equal(b.sampledContractCount,0);assert.match(b.expiryCoverage,/not every listed/);
  const html=decisionCardsPanel({data:d});
  for(const phrase of ['Buyer entry rules','Trend breakout','Trend pullback continuation','Key-level pattern resolution','Missing evidence','No win rate or doubling probability'])assert.ok(html.includes(phrase));
  b.setups[0].confirmation='<img src=x onerror=alert(1)>';
  const escaped=decisionCardsPanel({data:d});assert.ok(!escaped.includes('<img'));assert.ok(escaped.includes('&lt;img'));
});
console.log('Options decision-card tests passed: '+passed);
