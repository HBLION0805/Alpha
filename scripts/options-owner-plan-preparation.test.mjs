import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {assessEtfSetup} from '../src/engines/options-daily-guidance/OptionsEtfSetup.ts';
import {assessDailyGuidance} from '../src/engines/options-daily-guidance/OptionsDailyGuidance.ts';
import {dailyDecisionCards} from './lib/options-decision-card.mjs';
import {decisionReadinessProjection} from './lib/options-decision-readiness.mjs';
import {ownerPlanPreparation} from './lib/options-owner-plan-preparation.mjs';
import {prepareOwnerPlanDraft,ownerPlanPanel} from '../apps/options-workbench/owner-plan.js';
import {thesisPlanCommand,conditionDefaults} from '../apps/options-workbench/trade-thesis.js';
import {runOptionsManualLedgerCommand as manual,readManualLedger} from './options-manual-ledger.mjs';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
import {startOptionsWorkbench} from './options-workbench.mjs';
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const at='2026-09-17T14:05:01.000Z',registered='2026-09-17T13:45:00.000Z';
const uuid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const temp=()=>mkdtempSync(join(tmpdir(),'alpha-etf-setup-'));
function cleanup(root){const p=resolve(root);assert.ok(p.startsWith(resolve(tmpdir())+sep)&&p.includes('alpha-etf-setup-'));rmSync(p,{recursive:true,force:true});}
function plan(){return {version:'OPTIONS_ETF_SETUP_PLAN_V1',id:'fixture-only',symbol:'IBIT',side:'BULLISH',setup:'BREAKOUT',activeFrom:'2026-09-17T14:00:00.000Z',timeExit:'2026-09-17T15:00:00.000Z',lower:'42.50',upper:'43.40',invalidation:'42.40',fastBars:3,slowBars:5,bufferBps:10,chaseBps:50,volumeRatioBps:12000,expiryBufferDays:7,targetDeltaBps:5000};}
function bars(){const values=['43.00','43.05','43.10','43.15','43.20','43.455000'];const start=Date.parse('2026-09-17T13:35:00.000Z');return {version:'OPTIONS_ETF_BARS_V1',symbol:'IBIT',intervalMinutes:5,currency:'USD',session:'REGULAR',adjustment:'RAW',volumeUnit:'SHARES',source:'SYNTHETIC_TEST_ONLY',receivedAt:at,windowStart:new Date(start).toISOString(),windowEnd:'2026-09-17T14:05:00.000Z',bars:values.map((v,i)=>({start:new Date(start+i*300000).toISOString(),end:new Date(start+(i+1)*300000).toISOString(),open:v,high:(Number(v)+0.01).toFixed(6),low:(Number(v)-0.01).toFixed(6),close:v,volume:i===5?200:100,complete:true,interpolated:false}))};}
function guidance(){return {version:'OPTIONS_DAILY_GUIDANCE_INPUT_V2',at,captureAt:at,captureOrigin:'HOST_MARKET_TOOL_RESPONSES',captureComplete:true,
 quotes:[{id:uuid(1),symbol:'IBIT',expiry:'2026-10-16',type:'call',strike:'43',multiplier:100,bidCents:145,askCents:150,tickCents:1,bidSize:10,askSize:10,delta:0.5,updatedAt:at,receivedAt:at}],equities:[{symbol:'IBIT',price:'43.455000',sourceAt:at,close:{date:'2026-09-16',price:'43'}}],closeHistory:['2026-09-10','2026-09-11','2026-09-14','2026-09-15','2026-09-16'].map((date,i)=>({symbol:'IBIT',date,price:String(39+i)})),events:[],calendarAvailable:true,headlinesAvailable:true,sourceHealth:[],headlines:[],context:{treasury:null,btc:null},
 settings:{currentEquityCents:100000,settledCashCents:100000,roundTripFeesCents:10,slippageReserveCents:10,stopLossBps:2000,rewardMultipleMilliR:2000,tradeBudget:{version:'OWNER_ALLOCATION_ONLY_V2',minCents:10000,maxCents:50000}},analyst:{assessedAt:at,assets:[{symbol:'IBIT',bias:'BULLISH',summary:'Fixture only',sources:[{url:'https://example.test/',retrievedAt:at}]}]}};}
function input(){return {at,bars:bars(),plan:{registeredAt:registered,value:plan()},guidance:guidance()};}
function later(i,close,{low=Number(close)-0.01,high=Number(close)+0.01}={}){const start=i.bars.windowEnd,end=new Date(Date.parse(start)+300000).toISOString();i.at=new Date(Date.parse(end)+1000).toISOString();i.guidance.at=i.at;i.bars.receivedAt=i.at;i.bars.windowEnd=end;i.bars.bars.push({start,end,open:String(close),close:String(close),low:Number(low).toFixed(6),high:Number(high).toFixed(6),volume:200,complete:true,interpolated:false});}

function stateFor(i=input()){
  const current=assessDailyGuidance(i.guidance),note={...i.guidance.analyst,
    assets:i.guidance.analyst.assets.map(a=>({...a,supporting:[],opposing:[],invalidation:'Fixture only',eventPlan:'Fixture only'}))};
  const s={loadedAt:i.at,guidance:{data:{current,interpretation:note,input:i.guidance}},
    manual:{data:{trades:[],planRecords:[]}},etfSetup:{data:{assets:[assessEtfSetup(structuredClone(i))]}}};
  s.decisionCards={data:dailyDecisionCards(s)};s.decisionReadiness={data:decisionReadinessProjection(s)};return s;
}
const row=s=>ownerPlanPreparation(s).rows.find(r=>r.symbol==='IBIT');
await test('actual deterministic research match reaches pending Owner preparation, never trade qualification',()=>{
  const s=stateFor(),before=JSON.stringify(s),r=row(s);
  assert.equal(r.research.status,'RULE_MATCH_OBSERVED');assert.equal(r.gates.researchMatchCurrent,true);
  assert.equal(r.gates.sourceQualified,false);assert.equal(r.gates.etfQuoteFresh,true);assert.equal(r.gates.optionQuoteFresh,true);
  assert.equal(r.gates.spreadAndSizeClear,true);assert.equal(r.gates.declaredCostsKnown,true);
  assert(r.blockers.includes('IMPORTED_SOURCE_NOT_AUTHENTICATED'));assert(r.blockers.includes('QUALIFIED_ENTRY_SOURCE_NOT_CONNECTED'));
  assert.equal(r.executionAllowed,false);assert.equal(r.autoSave,false);assert.equal(r.autoFreeze,false);
  assert.equal(JSON.stringify(s),before);
});
await test('unknown costs remain blocked even with a modeled fee profile',()=>{
  const i=input();i.guidance.settings.roundTripFeesCents=null;const r=row(stateFor(i));
  assert.equal(r.gates.declaredCostsKnown,false);assert(r.blockers.includes('COSTS_UNKNOWN'));assert.equal(r.brokerFeesConfirmed,false);
});
await test('missing current cost and quote fields cannot pass by absent blocker codes',()=>{
  const s=stateFor();delete s.guidance.data.current.settings.roundTripFeesCents;
  const q=s.decisionCards.data.cards.find(c=>c.symbol==='IBIT').references[0].contract;
  q.askSize=null;q.updatedAt=null;s.decisionCards.data.cards.find(c=>c.symbol==='IBIT').price.price=null;
  const r=row(s);assert.equal(r.gates.etfQuoteFresh,false);assert.equal(r.gates.optionQuoteFresh,false);
  assert.equal(r.gates.spreadAndSizeClear,false);assert.equal(r.gates.declaredCostsKnown,false);
});
await test('stale quotes and stale completed bars lose current status without changing original evidence',()=>{
  const i=input();i.at='2026-09-17T14:11:01.000Z';i.guidance.at=i.at;const r=row(stateFor(i));
  assert.equal(r.research.status,'RULE_MATCH_OBSERVED');assert.equal(r.gates.researchMatchCurrent,false);
  assert.equal(r.gates.etfQuoteFresh,false);assert.equal(r.gates.optionQuoteFresh,false);
  assert(r.blockers.includes('ETF_BARS_NOT_FRESH'));assert(r.blockers.includes('OPTION_QUOTE_NOT_FRESH'));
});
await test('future clocks and assessment mismatch never become current',()=>{
  for(const change of [
    s=>s.loadedAt='2026-09-17T14:04:59.000Z',
    s=>s.etfSetup.data.assets[0].triggerAt='2026-09-17T15:00:00.000Z',
    s=>s.etfSetup.data.assets[0].assessedAt='2026-09-17T14:06:00.000Z',
    s=>s.etfSetup.data.assets[0].source.receivedAt='2026-09-17T15:00:00.000Z'
  ]){const s=stateFor();change(s);assert.equal(row(s).gates.researchMatchCurrent,false);}
  const s=stateFor();s.decisionCards.data.analysisAt='2026-09-17T15:00:00.000Z';
  const r=row(s);assert.equal(r.gates.attributedReviewCurrent,false);assert(r.blockers.includes('EVIDENCE_CLOCK_MISSING_OR_FUTURE'));
});
await test('capture, contract and direction mismatch remain explicit blockers',()=>{
  const s=stateFor();s.decisionCards.data.marketCapturedAt='2026-09-17T15:00:00.000Z';
  assert(row(s).blockers.includes('EVIDENCE_CLOCK_MISSING_OR_FUTURE'));
  for(const change of [
    s=>s.etfSetup.data.assets[0].rows[0].contract.id=uuid(9),
    s=>s.etfSetup.data.assets[0].plan.side='BEARISH',
    s=>s.etfSetup.data.assets[0].rows[0].contract.updatedAt='2026-09-17T14:04:00.000Z'
  ]){const t=stateFor();change(t);assert.equal(row(t).gates.researchMatchCurrent,false);}
  const t=stateFor();t.decisionCards.data.cards.find(c=>c.symbol==='IBIT').bias='BEARISH';
  assert(row(t).blockers.includes('ANALYSIS_TREND_CONTRACT_DIRECTION_MISMATCH'));
});
await test('missing setup or attributed review stays missing, not inferred from a trend',()=>{
  const s=stateFor();s.etfSetup={state:'MISSING'};s.decisionCards.data.reviewCurrent=false;
  const r=row(s);assert.equal(r.gates.researchMatchCurrent,false);assert.equal(r.gates.attributedReviewCurrent,false);
  assert(r.blockers.includes('ETF_SETUP_EVIDENCE_UNAVAILABLE'));assert(r.blockers.includes('ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD'));
});
await test('new draft copies exact identity and lineage but no invented numeric plan or confirmation',()=>{
  const r=row(stateFor()),d=prepareOwnerPlanDraft(r,'synthetic-owner-draft');
  assert.equal(d.thesisFields.symbol,'IBIT');assert.equal(d.thesisFields.optionType,'CALL');
  assert.equal(d.thesisFields.strikeUsd,r.contract.strike);assert.match(d.thesisFields.thesis,/Capture/);
  for(const key of ['declaredAt','maxEntryDebitUsd','plannedRiskUsd','targetNetProfitUsd','stopPremiumUsd','entryDeadlineAt','timeExitAt'])
    assert.equal(d.thesisFields[key],'',key);
  assert.equal(d.thesisDraft.conditions.length,0);assert.equal(d.thesisDraft.eventEntry,undefined);
  const c=thesisPlanCommand(d,'DRAFT','synthetic-owner-request');assert.equal(c.type,'SAVE_PLAN_DRAFT');assert(!c.plan);
});
await test('prepared draft saves and recovers through existing ledger with no frozen plan or fill',()=>{
  const root=temp();try{
    const ledgerId='synthetic-owner-plan',options={workspaceRoot:root,ledgerId,now:()=>at};
    manual(['--create',ledgerId],options);const service=createWorkbenchData(options);
    const d=prepareOwnerPlanDraft(row(stateFor()),'synthetic-owner-draft');
    const p=service.preview(thesisPlanCommand(d,'DRAFT','synthetic-owner-request'));
    service.save({command:p.command,expectedHeadSha256:p.headSha256});
    const report=readManualLedger(root,ledgerId,()=>at).report;assert.equal(report.trades.length,0);
    const s=stateFor();s.manual={data:report};const r=row(s);
    assert.equal(r.savedPlan.tradeId,'synthetic-owner-draft');assert.equal(r.savedPlan.complete,false);
    assert(r.savedPlan.missing.includes('PLAN_STOPPREMIUMUSD_MISSING_OR_INVALID'));
    assert.throws(()=>thesisPlanCommand(d,'PREVIEW','synthetic-preview'));
  }finally{cleanup(root);}
});
await test('ambiguous, future and frozen draft identities never silently select a plan',()=>{
  const d=prepareOwnerPlanDraft(row(stateFor()),'synthetic-owner-draft');
  const record={savedAt:at,command:thesisPlanCommand(d,'DRAFT','synthetic-owner-request')};
  const s=stateFor();s.manual.data.planRecords=[record,{...record,command:{...record.command,tradeId:'second-draft'}}];
  assert(row(s).savedPlan.missing.includes('MULTIPLE_MATCHING_OWNER_DRAFTS'));
  s.manual.data.planRecords=[{...record,savedAt:'2026-09-17T15:00:00.000Z'}];assert.equal(row(s).savedPlan.tradeId,null);
  s.manual.data.planRecords=[record];s.manual.data.trades=[{tradeId:record.command.tradeId}];assert.equal(row(s).savedPlan.tradeId,null);
});
await test('saved numeric checklist rejects future declaration and a stop above maximum debit',()=>{
  const d=prepareOwnerPlanDraft(row(stateFor()),'synthetic-owner-draft');
  Object.assign(d.thesisFields,{declaredAt:'2026-09-17T14:06:00.000Z',maxContracts:'1',maxEntryDebitUsd:'150',
    plannedRiskUsd:'30',targetNetProfitUsd:'60',stopPremiumUsd:'2',entryDeadlineAt:'2026-09-17T14:30:00.000Z',timeExitAt:'2026-09-17T15:00:00.000Z'});
  const s=stateFor();s.manual.data.planRecords=[{savedAt:at,command:thesisPlanCommand(d,'DRAFT','synthetic-owner-request')}];
  const r=row(s);assert(r.savedPlan.missing.includes('PLAN_DECLARATION_MISSING_OR_FUTURE'));
  assert(r.savedPlan.missing.includes('PLAN_STOP_NOT_BELOW_MAX_ENTRY_DEBIT'));assert.equal(r.gates.numericPlanFieldsPresent,false);
});
await test('UI escapes evidence and renders every blocker and no automatic freeze action',()=>{
  const d=ownerPlanPreparation(stateFor());d.rows[0].blockers.push('<script>alert(1)</script>');
  const html=ownerPlanPanel({data:d});assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));
  assert(html.includes('data-owner-plan='));assert(html.includes('No declaration time'));
  assert(html.includes('QUALIFIED_ENTRY_SOURCE_NOT_CONNECTED'));
});
await test('new browser module is served by the existing workbench',async()=>{
  const app=await startOptionsWorkbench({port:0,refreshContext:false});
  try{const response=await fetch(app.url+'/owner-plan.js');assert.equal(response.status,200);
    assert.match(await response.text(),/prepareOwnerPlanDraft/);
  }finally{await app.close();}
});

await test('explicit Owner completion previews and freezes only through the existing ledger with no fill',()=>{
  const root=temp();try{
    const ledgerId='synthetic-owner-freeze',options={workspaceRoot:root,ledgerId,now:()=>at};
    manual(['--create',ledgerId],options);const service=createWorkbenchData(options);
    const d=prepareOwnerPlanDraft(row(stateFor()),'synthetic-owner-completed');
    Object.assign(d.thesisFields,{declaredAt:at,maxContracts:'1',maxEntryDebitUsd:'160',plannedRiskUsd:'35',
      targetNetProfitUsd:'70',stopPremiumUsd:'1.20',entryDeadlineAt:'2026-09-17T14:20:00.000Z',timeExitAt:'2026-09-17T15:00:00.000Z'});
    Object.assign(d.thesisDraft,{tradeDate:'2026-09-17',realizationStartAt:'2026-09-17T14:10:00.000Z',
      realizationEndAt:'2026-09-17T14:40:00.000Z',nextCheckAt:'2026-09-17T14:30:00.000Z',holdThroughEvent:'NO',
      manualFallback:'Synthetic test only: manually check missing source evidence',conditions:[
        {...conditionDefaults('PRICE','price'),basis:'Synthetic declared invalidation',
          checkAt:'2026-09-17T14:30:00.000Z',missingAction:'Manual verification',target:'ETF',
          comparator:'AT_OR_BELOW',threshold:'42',confirmation:'TOUCH'}
      ]});
    const draft=service.preview(thesisPlanCommand(d,'DRAFT','synthetic-complete-draft'));
    service.save({command:draft.command,expectedHeadSha256:draft.headSha256});
    const preview=service.preview(thesisPlanCommand(d,'PREVIEW','synthetic-owner-confirm'));
    assert.equal(readManualLedger(root,ledgerId,()=>at).report.trades.length,0);
    service.save({command:preview.command,expectedHeadSha256:preview.headSha256});
    const report=readManualLedger(root,ledgerId,()=>at).report;assert.equal(report.trades.length,1);
    assert.equal(report.trades[0].effectiveFills.length,0);assert.equal(report.trades[0].plan.stopPremiumUsd,'1.20');
  }finally{cleanup(root);}
});


await test('nanosecond source clocks remain known and submillisecond future receipts fail closed',()=>{
  const s=stateFor(),card=s.decisionCards.data.cards.find(c=>c.symbol==='IBIT'),q=card.references[0].contract;
  q.updatedAt='2026-09-17T14:05:00.999999999Z';card.price.sourceAt=q.updatedAt;
  let r=row(s);assert.equal(r.gates.sourceClocksKnown,true);assert.equal(r.gates.optionQuoteFresh,true);assert.equal(r.gates.etfQuoteFresh,true);
  q.updatedAt='2026-09-17T14:05:01.000000001Z';card.price.sourceAt=q.updatedAt;
  r=row(s);assert.equal(r.gates.sourceClocksKnown,false);assert.equal(r.gates.optionQuoteFresh,false);assert.equal(r.gates.etfQuoteFresh,false);
});
await test('a recent analysis timestamp cannot hide the original attributed-analysis blocker',()=>{
  const s=stateFor();s.decisionCards.data.cards.find(c=>c.symbol==='IBIT').blockers.push('ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD');
  const r=row(s);assert.equal(r.gates.attributedReviewCurrent,false);assert(r.blockers.includes('ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD'));
});

console.log('owner plan preparation: '+passed+'/'+passed+' tests passed.');
