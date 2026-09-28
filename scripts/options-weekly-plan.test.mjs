import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync,readFileSync,existsSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {weekForAt,buildWeeklyPlanPreview,validateWeeklyEvent} from '../src/engines/options-weekly-plan/OptionsWeeklyPlan.ts';
import {weeklyPlanView,previewWeeklyPlan,saveWeeklyPlan} from './lib/options-weekly-plan-io.mjs';
import {withReleaseCalendarJournal} from './lib/options-release-calendar-io.mjs';
import {withFomcCalendarJournal} from './lib/options-fomc-calendar-io.mjs';
import {RELEASE_CALENDAR_URL} from '../src/engines/options-release-calendar/BlsReleaseCalendarEngine.ts';
import {FOMC_CALENDAR_URL} from '../src/engines/options-fomc-calendar/FomcCalendarEngine.ts';
import {ownerCapitalShoppingList} from '../src/catalogs/OwnerCapitalShoppingList.ts';
import {runOptionsManualLedgerCommand,readManualLedger} from './options-manual-ledger.mjs';

const at='2026-09-27T16:00:00.000Z',weekStartDate='2026-09-28';
const emptyPlan=()=>({manualEvents:[],newsWatch:[],notes:'',noTradeConditions:[],eventResearchRefs:[]});
const request=(action,plan=emptyPlan(),expectedFingerprint=null,previewFingerprint=null)=>({action,weekStartDate,expectedFingerprint,plan,previewFingerprint});
const temp=async fn=>{const root=mkdtempSync(join(tmpdir(),'alpha-weekly-'));try{return await fn(root);}finally{rmSync(root,{recursive:true,force:true});}};
const missing={state:'MISSING',inputs:null,errorCode:'STORE_MISSING'};
const event=(id='owner-event')=>({eventId:id,category:'EARNINGS',title:'Owner reported earnings date',startAt:'2026-10-01',endAt:null,timezone:'America/New_York',timePrecision:'DATE_ONLY',sourceId:'OWNER_NOTE',sourceRef:null,retrievedAt:null,publishedAt:null,affectedSymbols:['PLD'],affectedThemes:[],notes:'Time unverified',status:'UNVERIFIED',sourceCharacter:'OWNER_DECLARED'});

test('New York weekend selects next week; weekday selects current week',()=>{
  assert.deepEqual(weekForAt('2026-09-26T14:00:00.000Z'),{weekStartDate:'2026-09-28',weekEndDate:'2026-10-02'});
  assert.deepEqual(weekForAt('2026-09-27T14:00:00.000Z'),{weekStartDate:'2026-09-28',weekEndDate:'2026-10-02'});
  assert.deepEqual(weekForAt('2026-09-30T14:00:00.000Z'),{weekStartDate:'2026-09-28',weekEndDate:'2026-10-02'});
});

test('date-only/manual precision, source status, and missing coverage remain explicit',()=>{
  const preview=buildWeeklyPlanPreview({assessedAt:at,bls:missing,fomc:missing,manualEvents:[event()],newsWatch:['Watch geopolitical developments']});
  assert.equal(preview.weekStartDate,weekStartDate);
  assert.equal(preview.events[0].startAt,'2026-10-01');
  assert.equal(preview.events[0].endAt,null);
  assert.equal(preview.events[0].timePrecision,'DATE_ONLY');
  assert.equal(preview.coverage.earningsCoverage,'MISSING_SOURCE');
  assert.equal(preview.coverage.macroDataCoverage,'MISSING_SOURCE');
  assert.equal(preview.coverage.newsRiskCoverage,'MISSING_SOURCE');
  assert.equal(preview.events.some(e=>e.category==='UNSCHEDULED_NEWS_WATCH'),false);
  assert.equal(preview.executionAllowed,false);
  assert.throws(()=>validateWeeklyEvent({...event(),sourceCharacter:'OFFICIAL_SAVED'},true),/WEEKLY_PLAN_SOURCE_CHARACTER/);
  assert.throws(()=>validateWeeklyEvent({...event(),sourceId:''},true),/WEEKLY_PLAN_SOURCE_ID/);
  assert.throws(()=>validateWeeklyEvent({...event(),status:'CONFIRMED'},true),/WEEKLY_PLAN_MANUAL_STATUS/);
  assert.throws(()=>validateWeeklyEvent({...event(),category:'UNSCHEDULED_NEWS_WATCH'},true),/WEEKLY_PLAN_CATEGORY/);
  assert.throws(()=>buildWeeklyPlanPreview({assessedAt:at,bls:missing,fomc:missing,manualEvents:[event(),event()]}),/WEEKLY_PLAN_DUPLICATE_EVENT_ID/);
  const refs=['gld-employment-20261002'];
  const withReference=buildWeeklyPlanPreview({assessedAt:at,bls:missing,fomc:missing,eventResearchRefs:refs});
  assert.deepEqual(withReference.eventResearchRefs,refs);
  assert.deepEqual(refs,['gld-employment-20261002']);
  assert.equal(withReference.executionAllowed,false);
});

test('validated saved calendar histories preserve BLS clock and FOMC date-only range',async()=>temp(async root=>{
  const blsText=readFileSync('fixtures/options-release-calendar/calendar.synthetic.ics','utf8').replaceAll('20260910T083000','20260929T083000').replaceAll('20260911T083000','20261002T083000');
  const fomcText=readFileSync('fixtures/options-fomc-calendar/calendar.synthetic.html','utf8').replace('September</strong>','September</strong>').replace('15-16*','29-30*');
  await withReleaseCalendarJournal(root,s=>s.append({requestedAt:'2026-09-25T12:00:00.000Z',receivedAt:'2026-09-25T12:00:01.000Z',url:RELEASE_CALENDAR_URL,sourceText:blsText,errorCode:null},'2026-09-25T12:00:01.000Z'),'2026-09-25T12:00:01.000Z');
  await withFomcCalendarJournal(root,s=>s.append({requestedAt:'2026-09-25T12:00:02.000Z',receivedAt:'2026-09-25T12:00:03.000Z',url:FOMC_CALENDAR_URL,sourceText:fomcText,errorCode:null},'2026-09-25T12:00:03.000Z'),'2026-09-25T12:00:03.000Z');
  const before=ownerCapitalShoppingList(),view=await weeklyPlanView(root,at),after=ownerCapitalShoppingList();
  assert.deepEqual(after,before);
  const bls=view.preview.events.find(e=>e.sourceId==='BLS_PUBLIC_RELEASE_CALENDAR');
  const fomc=view.preview.events.find(e=>e.sourceId==='FEDERAL_RESERVE_PUBLIC_MEETING_CALENDAR');
  assert.equal(bls.timePrecision,'EXACT_TIME');assert.equal(bls.retrievedAt,'2026-09-25T12:00:01.000Z');assert.equal(bls.publishedAt,null);
  assert.equal(fomc.timePrecision,'DATE_RANGE');assert.equal(fomc.startAt,'2026-09-29');assert.equal(fomc.endAt,'2026-09-30');assert.equal(fomc.publishedAt,null);
  assert.equal(view.preview.coverage.earningsCoverage,'MISSING_SOURCE');
  const cancelledText=blsText.replace('SUMMARY:Producer Price Index','STATUS:CANCELLED\r\nSUMMARY:Producer Price Index');
  const cancelled=buildWeeklyPlanPreview({assessedAt:at,bls:{state:'AVAILABLE',inputs:[{requestedAt:'2026-09-25T12:00:00.000Z',receivedAt:'2026-09-25T12:00:01.000Z',url:RELEASE_CALENDAR_URL,sourceText:cancelledText,errorCode:null}],errorCode:null},fomc:missing});
  const cancelledEvent=cancelled.events.find(e=>e.title==='Producer Price Index');
  assert.equal(cancelledEvent.status,'CANCELLED');
  assert.equal(cancelled.daily.find(d=>d.date==='2026-09-29').beforeMarket.includes(cancelledEvent.eventId),false);
  assert.equal(existsSync(join(root,'data/runtime/options-weekly-plan')),false);
}));

test('preview is durable-read-only; review and amendment retain original and reject stale writes',async()=>temp(async root=>{
  const fetchBefore=globalThis.fetch;let fetchCalls=0;
  globalThis.fetch=()=>{fetchCalls++;throw Error('unexpected network call');};
  try{
  const base=await weeklyPlanView(root,at);
  assert.equal(base.status,'NOT_ESTABLISHED');assert.equal(base.preview.coverage.earningsCoverage,'MISSING_SOURCE');
  const edited={...emptyPlan(),manualEvents:[event()],newsWatch:['Watch sanctions'],notes:'Review missing earnings coverage',noTradeConditions:['Wait for source-backed event details']};
  const firstPreview=await previewWeeklyPlan(root,request('PREVIEW',edited),at);
  assert.equal(existsSync(join(root,'data/runtime')),false);
  const first=await saveWeeklyPlan(root,request('REVIEW',edited,null,firstPreview.fingerprint),'2026-09-27T16:00:01.000Z');
  assert.equal(first.revision,1);assert.equal(first.state,'REVIEWED');
  const afterFirst=await weeklyPlanView(root,at);
  assert.equal(afterFirst.status,'INCOMPLETE_COVERAGE');assert.equal(afterFirst.latest.requestPlan.notes,edited.notes);
  assert.equal(afterFirst.latest.plan.events[0].sourceCharacter,'OWNER_DECLARED');
  const bytes=readFileSync(resolve(root,first.path));
  const amended={...edited,notes:'Source still missing; keep waiting'};
  const secondPreview=await previewWeeklyPlan(root,request('PREVIEW',amended,first.fingerprint),at);
  const second=await saveWeeklyPlan(root,request('AMEND',amended,first.fingerprint,secondPreview.fingerprint),'2026-09-27T16:00:02.000Z');
  assert.equal(second.revision,2);assert.equal(second.state,'AMENDMENT');
  assert(readFileSync(resolve(root,first.path)).equals(bytes));
  const final=await weeklyPlanView(root,at);
  assert.equal(final.latest.previousFingerprint,first.fingerprint);
  assert.equal(final.revisions.length,2);
  await assert.rejects(saveWeeklyPlan(root,request('AMEND',amended,first.fingerprint,secondPreview.fingerprint),at),/WEEKLY_PLAN_STALE_REVISION/);
  await assert.rejects(saveWeeklyPlan(root,request('AMEND',amended,second.fingerprint,'0'.repeat(64)),at),/WEEKLY_PLAN_PREVIEW_CHANGED/);
  await assert.rejects(previewWeeklyPlan(root,{...request('PREVIEW'),weekStartDate:'2026-09-21'},at),/WEEKLY_PLAN_TARGET_WEEK/);
  assert.equal(readdirSync(join(root,'data/runtime/options-weekly-plan',weekStartDate)).length,2);
  assert.equal(fetchCalls,0);
  }finally{globalThis.fetch=fetchBefore;}
}));

test('exact saved employment draft links to its original ledger event without mutation',async()=>temp(async root=>{
  const ledgerId='weekly-reference-ledger',created='2026-09-20T00:00:00.000Z',saved='2026-09-20T00:01:00.000Z';
  runOptionsManualLedgerCommand(['--create',ledgerId],{workspaceRoot:root,now:()=>created});
  const command={type:'SAVE_PLAN_DRAFT',requestId:'weekly-draft-one',tradeId:'gld-employment-20261002',draft:{fields:{tradeId:'gld-employment-20261002'},thesis:{version:'OPTIONS_TRADE_THESIS_V1',template:'CUSTOM',decisionId:'employment-draft',tradeDate:'2026-10-01',realizationStartAt:'2026-10-02T12:30:00.000Z',realizationEndAt:'',nextCheckAt:'',holdThroughEvent:'',manualFallback:'',conditions:[]}}};
  writeFileSync(join(root,'draft.json'),JSON.stringify(command));
  runOptionsManualLedgerCommand(['--append',ledgerId,'draft.json'],{workspaceRoot:root,now:()=>saved});
  const before=readManualLedger(root,ledgerId,()=>at),original=before.files.map(f=>({path:f.path,bytes:Buffer.from(f.bytes)}));
  const view=await weeklyPlanView(root,at,ledgerId);
  assert.deepEqual(view.preview.eventResearchRefs,['gld-employment-20261002']);
  assert.equal(view.preview.referenceEvidence[0].kind,'MANUAL_PLAN_DRAFT');
  assert.equal(view.preview.referenceEvidence[0].sourcePath,'data/runtime/options-manual-ledger/'+ledgerId+'/000001.json');
  assert.equal(view.preview.referenceEvidence[0].savedAt,saved);
  assert.equal(view.preview.executionAllowed,false);
  const explicit=await previewWeeklyPlan(root,request('PREVIEW',{...emptyPlan(),eventResearchRefs:['gld-employment-20261002']}),at,ledgerId);
  assert.deepEqual(explicit.eventResearchRefs,['gld-employment-20261002']);
  await assert.rejects(previewWeeklyPlan(root,request('PREVIEW',{...emptyPlan(),eventResearchRefs:['unknown-case']}),at,ledgerId),/WEEKLY_PLAN_EVENT_RESEARCH_REFERENCE_MISSING/);
  const after=readManualLedger(root,ledgerId,()=>at);
  assert.equal(after.headSha256,before.headSha256);
  for(const f of original)assert(readFileSync(resolve(root,f.path)).equals(f.bytes));
  assert.equal(existsSync(join(root,'data/runtime/options-weekly-plan')),false);
  const revised=structuredClone(command);
  revised.requestId='weekly-draft-two';revised.draft.thesis.realizationStartAt='';
  writeFileSync(join(root,'draft-v2.json'),JSON.stringify(revised));
  runOptionsManualLedgerCommand(['--append',ledgerId,'draft-v2.json'],{workspaceRoot:root,now:()=> '2026-09-20T00:02:00.000Z'});
  const afterRevision=await weeklyPlanView(root,at,ledgerId);
  assert.deepEqual(afterRevision.preview.eventResearchRefs,[]);
}));
