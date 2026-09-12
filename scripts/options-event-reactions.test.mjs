import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,realpathSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {assessEventReactions} from '../src/engines/options-daily-guidance/OptionsEventReaction.ts';
import {eventReactionPanel} from '../apps/options-workbench/event-reactions.js';
import {eventReactionView} from './lib/options-event-reaction-io.mjs';
import {readGuidanceResearchFrames} from './lib/options-guidance-io.mjs';
import {seedPositionWatch} from './lib/options-position-watch-fixtures.mjs';
import {withReleaseCalendarJournal} from './lib/options-release-calendar-io.mjs';
import {withFomcCalendarJournal} from './lib/options-fomc-calendar-io.mjs';
import {RELEASE_CALENDAR_URL} from '../src/engines/options-release-calendar/BlsReleaseCalendarEngine.ts';
import {FOMC_CALENDAR_URL} from '../src/engines/options-fomc-calendar/FomcCalendarEngine.ts';
import {runGuidanceCommand} from './options-daily-guidance.mjs';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
import {startOptionsWorkbench} from './options-workbench.mjs';

let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const eventAt='2026-09-10T12:30:00.000Z',at='2026-09-10T15:00:00.000Z';
const time=sec=>new Date(Date.parse(eventAt)+sec*1000).toISOString();
const event=()=>({key:'ppi',title:'Producer Price Index',source:'BLS',startDate:'2026-09-10',endDate:'2026-09-10',scheduledAt:eventAt,status:'UNSPECIFIED',calendarReceivedAt:time(-86400)});
const frame=(sec,gld='100.00',ibit='50.00')=>({path:'capture-'+sec,origin:'HOST_MARKET_TOOL_RESPONSES',recordedAt:time(sec+2),capturedAt:time(sec+1),equityReceivedAt:time(sec),
  equities:[{symbol:'GLD',price:gld,sourceAt:time(sec)},{symbol:'IBIT',price:ibit,sourceAt:time(sec)}]});
const note=(sec=-300)=>({path:'note-'+sec,assessedAt:time(sec),recordedAt:time(sec+1),assets:['GLD','IBIT'].map(symbol=>({symbol,bias:'BULLISH',summary:'General outlook, not an event-specific thesis.',sources:[{retrievedAt:time(sec-1)}]}))});
const input=()=>({at,origin:'HOST_MARKET_TOOL_RESPONSES',events:[event()],frames:[frame(-600),frame(900,'101','49'),frame(4800,'99','51')],notes:[note()]});
const asset=(i=input(),index=0)=>assessEventReactions(i).events[0].assets[index];
const window=(i=input(),n=0)=>asset(i).windows[n];
await test('both ETFs show exact signed observations and fixed-window sample times',()=>{
  const r=assessEventReactions(input()),g=r.events[0].assets[0],b=r.events[0].assets[1];
  assert.equal(g.windows[0].priceChangeUsd,'1.000000');assert.equal(g.windows[0].percentChange,'1.00');assert.equal(g.windows[1].priceChangeUsd,'-1.000000');
  assert.equal(b.windows[0].percentChange,'-2.00');assert.equal(b.windows[1].percentChange,'2.00');assert.equal(g.windows[0].postOffsetSeconds,900);assert.equal(g.windows[0].sampleGapSeconds,1500);
  assert.equal(g.windows[0].priorBiasComparison,'SAME_DIRECTION_ONLY');assert.equal(g.windows[1].priorBiasComparison,'OPPOSITE_DIRECTION_ONLY');assert.equal(g.hypothesisStatus,'NOT_TESTED');assert.equal(r.events[0].cause,'NOT_ESTABLISHED');
});
await test('zero movement is a real zero, missing movement stays null',()=>{
  const i=input();i.frames=[frame(-600),frame(600)];assert.equal(window(i).priceChangeUsd,'0.000000');assert.equal(window(i).direction,'UNCHANGED');
  i.frames=[frame(-600)];assert.equal(window(i).priceChangeUsd,null);assert.equal(window(i).direction,'UNKNOWN');
});
await test('micro-dollar arithmetic does not lose sub-cent changes or return negative zero',()=>{
  const i=input();i.frames=[frame(-600,'100.000001'),frame(600,'100')];assert.equal(window(i).priceChangeUsd,'-0.000001');assert.equal(window(i).percentChange,'0.00');
  i.frames=[frame(-600,'0.000001'),frame(600,'0.000002')];assert.equal(window(i).percentChange,'100.00');
});
await test('windows select latest source observation, not highest price or input order',()=>{
  const i=input();i.frames=[frame(1700,'98'),frame(100,'110'),frame(-600)];assert.equal(window(i).priceChangeUsd,'-2.000000');assert.equal(window(i).postOffsetSeconds,1700);
});
await test('source nanoseconds at event instant are not falsely rounded to PRE or POST',()=>{
  const i=input(),p=frame(1,'101');p.equities[0].sourceAt='2026-09-10T12:30:00.000000001Z';i.frames=[frame(-600),p];assert.equal(window(i).postOffsetSeconds,1e-9);
  p.equities[0].sourceAt=eventAt;assert.equal(window(i).post,null);
});
await test('exact horizon is included; one nanosecond beyond belongs only to later window',()=>{
  const i=input(),p=frame(1801,'101');p.equities[0].sourceAt=time(1800);i.frames=[frame(-600),p];assert.equal(window(i).priceChangeUsd,'1.000000');
  p.equities[0].sourceAt='2026-09-10T13:00:00.000000001Z';assert.equal(window(i).post,null);assert.equal(window(i,1).priceChangeUsd,'1.000000');
});
await test('PRE must be completely saved before the event even if source price is earlier',()=>{
  const i=input();i.frames[0].recordedAt=eventAt;assert.equal(asset(i).baseline,null);assert.equal(window(i).missingReason,'PRE_EVENT_OBSERVATION_MISSING');
});
await test('source freshness uses actual equity receipt, not full capture completion',()=>{
  const i=input();i.frames[0].capturedAt=time(-300);i.frames[0].recordedAt=time(-299);assert(asset(i).baseline);
  i.frames[0].equityReceivedAt=time(-479);assert.equal(asset(i).baseline,null);assert.equal(assessEventReactions(i).exclusions.STALE_AT_EQUITY_RECEIPT,2);
});
await test('freshness boundary at 120 seconds passes; future source is excluded',()=>{
  const i=input();i.frames[0].equityReceivedAt=time(-480);i.frames[0].capturedAt=time(-479);i.frames[0].recordedAt=time(-478);assert(asset(i).baseline);
  i.frames[0].equities[0].sourceAt=time(-479);assert.equal(asset(i).baseline,null);
});
await test('future recorded data and notes cannot backfill a past assessment',()=>{
  const i=input();i.at=time(300);i.notes=[note(500)];const a=asset(i);assert.equal(a.windows[0].state,'WINDOW_OPEN');assert.equal(a.windows[0].post,null);assert.equal(a.priorView,null);
});
await test('latest loaded event view is retrospective when calendar was received later',()=>{
  const i=input();i.events[0].calendarReceivedAt=time(5000);assert.equal(assessEventReactions(i).events[0].calendarTiming,'RETROSPECTIVE_CALENDAR_CONTEXT');
  i.events[0].calendarReceivedAt=time(10000);assert.throws(()=>assessEventReactions(i),/FUTURE_CALENDAR/);
});
await test('latest post note cannot replace a valid pre-event note',()=>{
  const i=input();i.notes=[note(300),note(-900),note(-300)];i.notes[0].assets[0].bias='BEARISH';assert.equal(asset(i).priorView.path,'note--300');
  i.notes=[{...note(-300),recordedAt:time(1)}];assert.equal(asset(i).priorView,null);
});
await test('unattributed, stale, future-source and invalid-order notes are excluded',()=>{
  for(const mutate of [n=>n.assets[0].sources=[],n=>n.assets[0].sources[0].retrievedAt=time(10),n=>n.recordedAt=time(-900)]){
    const i=input();mutate(i.notes[0]);assert.equal(asset(i).priorView,null);
  }
  const i=input();i.notes=[note(-86401)];assert.equal(asset(i).priorView,null);
});
await test('date-only, cancelled and tentative events have no timed comparison',()=>{
  for(const status of ['CANCELLED','TENTATIVE']){const i=input();i.events[0].status=status;assert.equal(window(i).missingReason,status);assert.equal(window(i).comparisonAvailable,false);}
  const i=input();i.events[0].scheduledAt=null;i.events[0].source='FOMC';assert.equal(window(i).missingReason,'DATE_ONLY');assert.equal(asset(i).priorView,null);
});
await test('event not yet passed stays waiting without future samples',()=>{
  const i=input();i.at=time(-100);i.events[0].calendarReceivedAt=time(-86400);assert.equal(window(i).state,'WAITING_FOR_EVENT');assert.equal(window(i).missingReason,'EVENT_NOT_YET_PASSED');
});
await test('wide baseline is labeled and older than 24h is excluded',()=>{
  const i=input();i.frames[0]=frame(-80000);assert.equal(asset(i).baselineCoverage,'WIDE_OR_OVERNIGHT_BASELINE');
  i.frames[0]=frame(-86401);assert.equal(asset(i).baseline,null);
});
await test('equal source observations deduplicate using earliest saved receipt',()=>{
  const i=input(),p=structuredClone(i.frames[0]);p.path='later-copy';p.recordedAt=time(50);p.equities[0].price='100.000000';i.frames.push(p);
  assert.equal(asset(i).baseline.path,'capture--600');assert.equal(assessEventReactions(i).observations.duplicates,2);
});
await test('contradictory same-instant prices block the affected ETF and window',()=>{
  const i=input(),p=structuredClone(i.frames[2]);p.path='contradiction';p.equities[0].price='111';i.frames.push(p);
  assert.equal(window(i).comparisonAvailable,true);assert.equal(window(i,1).missingReason,'CONFLICTING_SOURCE_PRICES');assert.equal(asset(i,1).windows[1].comparisonAvailable,true);
  const q=structuredClone(i.frames[0]);q.path='pre-conflict';q.equities[0].price='98';i.frames.push(q);assert.equal(window(i).missingReason,'CONFLICTING_SOURCE_PRICES');
});
await test('wrong origins, incomplete clocks and missing prices stay explicit',()=>{
  for(const mutate of [p=>p.origin='SYNTHETIC_FIXTURE',p=>p.equityReceivedAt=null,p=>p.recordedAt=time(-900),p=>p.equities[0].price=null,p=>p.equities[0].sourceAt=null,p=>p.equities.push(p.equities[0])]){
    const i=input();mutate(i.frames[0]);assert.equal(asset(i).baseline,null);assert(Object.keys(assessEventReactions(i).exclusions).length);
  }
});
await test('explicit synthetic mode never consumes HOST frames',()=>{
  const i=input();i.origin='SYNTHETIC_FIXTURE';assert.equal(asset(i).baseline,null);i.frames.forEach(f=>f.origin='SYNTHETIC_FIXTURE');assert.equal(window(i).comparisonAvailable,true);
});
await test('current reading of late-saved post data retains late-storage disclosure',()=>{
  const i=input();i.frames[1].recordedAt=time(5000);assert.equal(window(i).postSavedAfterWindow,true);
  i.at=time(1900);assert.equal(window(i).post,null);
});
await test('other timed and date-only events are confounders without an event-effect claim',()=>{
  const i=input();i.events.push({...event(),key:'second',title:'Other event',scheduledAt:time(3600)}, {...event(),key:'dates',scheduledAt:null,source:'FOMC'});
  const r=assessEventReactions(i);assert.equal(r.events[0].confounders.length,2);assert.equal(r.actualReleaseValues,null);assert.equal(r.winProbability,null);assert.equal(r.executionAllowed,false);assert.equal(r.guidanceChanged,false);
});
await test('input stays untouched and invalid identities or clocks fail explicitly',()=>{
  const i=input(),before=JSON.stringify(i);assessEventReactions(i);assert.equal(JSON.stringify(i),before);
  i.events.push(event());assert.throws(()=>assessEventReactions(i),/DUPLICATE_EVENT/);i.events.pop();i.events[0].scheduledAt='not-a-clock';assert.throws(()=>assessEventReactions(i),/EVENT_CLOCK/);
  i.events[0]=event();i.events[0].startDate='2026-02-30';assert.throws(()=>assessEventReactions(i),/EVENT/);
});
await test('UI mirrors numerical and missing states and safely escapes all source text',()=>{
  const i=input();i.events[0].title='<script>event</script>';i.notes[0].assets[0].summary='<img src=x>';const r=assessEventReactions(i),html=eventReactionPanel({data:r});
  assert(html.includes('$1.00 / 1.00%'));assert(html.includes('Hypothesis not tested'));assert(html.includes('&lt;script&gt;'));assert(html.includes('&lt;img'));assert(!html.includes('<script>'));assert(!html.includes('<img'));
  assert(eventReactionPanel({error:'<script>error</script>'}).includes('&lt;script&gt;'));assert(!html.includes('data-order'));
});
async function temporary(fn){const dir=mkdtempSync(join(tmpdir(),'alpha-position-watch-reaction-test-'));try{await fn(dir);}finally{const rel=relative(realpathSync(tmpdir()),realpathSync(dir));if(isAbsolute(rel)||rel.startsWith('..')||!rel.startsWith('alpha-position-watch-reaction-test-'))throw Error('UNSAFE_TEST_CLEANUP');rmSync(dir,{recursive:true,force:true});}}
function hashes(root){const out={};const walk=path=>{for(const e of readdirSync(path,{withFileTypes:true})){const file=join(path,e.name);if(e.isDirectory())walk(file);else out[relative(root,file)]=createHash('sha256').update(readFileSync(file)).digest('hex');}};walk(root);return out;}
const calendarAt='2026-09-07T08:00:00.000Z';
async function calendars(root){for(const [reader,url,fixture] of [[withReleaseCalendarJournal,RELEASE_CALENDAR_URL,'options-release-calendar/calendar.synthetic.ics'],[withFomcCalendarJournal,FOMC_CALENDAR_URL,'options-fomc-calendar/calendar.synthetic.html']])await reader(root,s=>s.append({requestedAt:calendarAt,receivedAt:calendarAt,url,sourceText:readFileSync(resolve(import.meta.dirname,'../fixtures',fixture),'utf8'),errorCode:null},calendarAt),calendarAt);}
await test('local adapter retains past BLS and date-only FOMC without changing journals',()=>temporary(async root=>{
  await calendars(root);await seedPositionWatch(root);const before=hashes(root),legacy=readGuidanceResearchFrames(root),r=await eventReactionView(root,'2026-09-12T15:00:00.000Z');
  assert(r.events.some(e=>e.title==='Producer Price Index'));assert(r.events.some(e=>e.title==='Consumer Price Index'));assert(r.events.some(e=>e.timingState==='DATE_ONLY'));
  assert.equal(r.observations.eligibleUnique,0);assert.equal(r.exclusions.WRONG_ORIGIN,1);assert.equal(r.sources.BLS.refreshOverdue,true);
  const extended=readGuidanceResearchFrames(root,{includeEquityReceipt:true});assert(extended[0].equityReceivedAt);assert(!Object.hasOwn(legacy[0],'equityReceivedAt'));assert.deepEqual(readGuidanceResearchFrames(root),legacy);assert.deepEqual(hashes(root),before);
}));
await test('calendar failure and corruption preserve bytes and do not revive old successful dates',()=>temporary(async root=>{
  await calendars(root);await withReleaseCalendarJournal(root,s=>s.append({requestedAt:at,receivedAt:at,url:RELEASE_CALENDAR_URL,sourceText:null,errorCode:'HTTP_STATUS'},at),at);
  let r=await eventReactionView(root,at);assert.equal(r.sources.BLS.status,'FAILED');assert(!r.events.some(e=>e.source==='BLS'));assert(r.events.some(e=>e.source==='FOMC'));
  const file=join(root,'data/runtime/options-fomc-calendar/retrievals.ndjson');writeFileSync(file,'PRIVATE_INVALID_SOURCE');r=await eventReactionView(root,at);assert.equal(r.sources.FOMC.error,'RECOVERY_FAILED');assert(!JSON.stringify(r).includes('PRIVATE'));assert.equal(readFileSync(file,'utf8'),'PRIVATE_INVALID_SOURCE');
}));
await test('missing stores remain empty without creating files or source requests',()=>temporary(async root=>{
  const r=await eventReactionView(root,at);assert.equal(r.events.length,0);assert.equal(r.sources.BLS.state,'MISSING');assert.equal(r.sources.FOMC.state,'MISSING');assert.deepEqual(readdirSync(root),[]);
}));
await test('workbench and Host CLI share the same local view without changing original guidance',()=>temporary(async root=>{
  await calendars(root);const before=hashes(root),options={workspaceRoot:root,now:()=>at};const state=await createWorkbenchData(options).state(),cli=await runGuidanceCommand(['--event-reactions'],options),host=await runGuidanceCommand(['--host-brief'],options);
  assert.deepEqual(cli,state.eventReactions);assert.deepEqual(host.eventReactions,cli);assert.equal(state.guidance.data.current.assets[0].disposition,'WATCH');assert.deepEqual(hashes(root),before);
}));
await test('the local server serves the new module and state without a write or source refresh',()=>temporary(async root=>{
  await calendars(root);const before=hashes(root),app=await startOptionsWorkbench({workspaceRoot:root,port:0,refreshContext:false,now:()=>at});
  try{const module=await fetch(app.url+'/event-reactions.js');assert.equal(module.status,200);assert((await module.text()).includes('export function eventReactionPanel'));
    const response=await fetch(app.url+'/api/state'),state=await response.json();assert.equal(state.eventReactions.state,'AVAILABLE');assert.equal(state.backgroundContextRefreshEnabled,false);
    assert.equal(state.eventReactions.data.executionAllowed,false);assert.deepEqual(hashes(root),before);
  }finally{await app.close();}
}));
console.log(`${passed}/${passed} tests passed.`);
