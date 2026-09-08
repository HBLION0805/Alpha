import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute} from 'node:path';
import {assessEventResearch,validateEventResearchPlan} from '../src/engines/options-event-research/OptionsEventResearch.ts';
import {defaultGuidanceSettings} from '../src/engines/options-daily-guidance/OptionsDailyGuidance.ts';
import {paperFingerprint} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {registerEventResearch,readEventResearch,saveEventResearchReport,verifyEventResearch,eventResearchKey,activeEventResearchContracts} from './lib/options-event-research-io.mjs';
import {runGuidanceCommand} from './options-daily-guidance.mjs';
import {collectGuidanceMarket} from './lib/options-guidance-host.mjs';
import {recordGuidanceMarket,readGuidanceResearchFrames} from './lib/options-guidance-io.mjs';
import {eventDraft,eventRequest,eventResearchPage} from '../apps/options-workbench/event-research.js';
import {collectLessons} from '../apps/options-workbench/model.js';
import {startOptionsWorkbench} from './options-workbench.mjs';

let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
const at='2026-09-08T14:00:00.000Z',done='2026-09-10T20:01:00.000Z';
const uuid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const settings=()=>({...defaultGuidanceSettings(),roundTripFeesCents:10,slippageReserveCents:20});
const contract=(n,symbol,type)=>({id:uuid(n),symbol,type,expiry:'2026-09-30',strike:'100',multiplier:100,bidCents:19,askCents:20,tickCents:1,bidSize:20,askSize:20,delta:type==='call'?0.5:-0.5,updatedAt:at,receivedAt:at});
const event=()=>({title:'Producer Price Index',source:'BLS',startDate:'2026-09-10',endDate:'2026-09-10',scheduledAt:'2026-09-10T12:30:00.000Z'});
const plan=()=>({version:'OPTIONS_EVENT_RESEARCH_PLAN_V1',id:'test-event-ppi',title:'Isolated synthetic event test',createdAt:at,event:event(),selectionCapturePath:'data/runtime/options-daily-guidance/captures/2026-09-08/test.json',
  preContract:contract(1,'GLD','call'),postCall:contract(2,'IBIT','call'),postPut:contract(3,'IBIT','put'),settings:settings(),minimumMoveBps:20,
  preEntryAt:'2026-09-09T16:40:00.000Z',preExitAt:'2026-09-09T19:40:00.000Z',postEntryAt:'2026-09-10T13:40:00.000Z',postExitAt:'2026-09-10T19:40:00.000Z'});
function frame(start,{bid=19,ask=20,ibit='100',offset=600000}={}){
  const capturedAt=new Date(Date.parse(start)+offset).toISOString(),sourceAt=new Date(Date.parse(capturedAt)-100).toISOString(),p=plan();
  return {path:'frame-'+capturedAt,origin:'HOST_MARKET_TOOL_RESPONSES',capturedAt,recordedAt:new Date(Date.parse(capturedAt)+1000).toISOString(),
    quotes:[p.preContract,p.postCall,p.postPut].map(q=>({...q,bidCents:bid,askCents:ask,updatedAt:sourceAt,receivedAt:capturedAt})),
    equities:['GLD','IBIT'].map(symbol=>({symbol,price:symbol==='IBIT'?ibit:'400',sourceAt,close:null}))};
}
function frames(){const p=plan();return [frame(p.preEntryAt),frame(p.preExitAt,{bid:24,ask:25}),frame(p.postEntryAt,{ibit:'100.4'}),frame(p.postExitAt,{ibit:'100.5',bid:24,ask:25})];}
const assess=(f=frames(),p=plan(),time=done)=>assessEventResearch(p,f,time);
const mode=(r,name)=>r.comparisons.find(c=>c.mode===name);

await test('three counterfactuals use the same frozen endpoints and exact net costs',()=>{
  const r=assess();assert.equal(mode(r,'PRE_ONLY').netReferencePnlCents,370);assert.equal(mode(r,'POST_ONLY').netReferencePnlCents,370);assert.equal(mode(r,'COMBINED').netReferencePnlCents,740);
  assert.equal(mode(r,'COMBINED').acceptedReferences,2);assert.equal(r.phases[0].economics.plannedStopCents,430);assert.equal(r.reaction.moveBps,40);
  assert.equal(r.actualTrades,0);assert.equal(r.winProbability,null);assert.equal(r.executionAllowed,false);assert(r.phases.every(p=>!p.actualFill&&p.stopPath==='UNOBSERVED_BETWEEN_SNAPSHOTS'));
});
await test('PRE loss reduces the same event budget before POST',()=>{const f=frames();f[1].quotes.forEach(q=>{q.bidCents=19;q.askCents=20;});const r=assess(f),c=mode(r,'COMBINED');assert.equal(c.lossConsumedCents,130);assert.equal(c.steps[1].status,'BLOCKED');assert(c.steps[1].blockers.includes('EVENT_LOSS_BUDGET_EXCEEDED'));assert.equal(mode(r,'POST_ONLY').steps[0].status,'ACCEPTED_REFERENCE');});
await test('loss beyond planned stop remains observed endpoint loss rather than a fabricated stop fill',()=>{const f=frames();f[1].quotes.forEach(q=>{q.bidCents=15;q.askCents=16;});const r=assess(f),c=mode(r,'COMBINED');assert.equal(c.netReferencePnlCents,-530);assert.equal(c.remainingEventLossCents,0);assert(r.candidateLessons.some(l=>l.code==='SHARED_EVENT_BUDGET_CONSUMED'));});
await test('gains never increase the shared loss allowance',()=>{const c=mode(assess(),'COMBINED');assert.equal(c.steps[0].remainingEventLossCents,500);assert.equal(c.remainingEventLossCents,500);});
await test('same-day sale proceeds cannot fund the second phase',()=>{const p=plan();p.settings.settledCashCents=2500;const c=mode(assess(frames(),p),'COMBINED');assert.equal(c.steps[0].status,'ACCEPTED_REFERENCE');assert(c.steps[1].blockers.includes('UNSETTLED_PROCEEDS_NOT_REUSED'));});
await test('unresolved PRE does not acquire a fresh combined budget',()=>{const f=frames().filter((_,i)=>i!==1),r=assess(f);assert.equal(mode(r,'COMBINED').status,'INCOMPLETE');assert(mode(r,'COMBINED').steps[1].blockers.includes('PRIOR_PHASE_UNRESOLVED'));assert.equal(r.phases[0].exit.status,'MISSED');});
for(const field of ['roundTripFeesCents','slippageReserveCents'])await test('unknown '+field+' preserves gross but prevents net evidence',()=>{const p=plan();p.settings[field]=null;const r=assess(frames(),p);assert.equal(r.phases[0].grossReferencePnlCents,400);assert.equal(r.phases[0].netReferencePnlCents,null);assert.equal(mode(r,'COMBINED').netReferencePnlCents,null);assert.equal(mode(r,'COMBINED').acceptedReferences,0);});
for(const [amount,side] of [['100.2','call'],['99.8','put'],['100.199999',null],['99.800001',null]])await test('exact reaction boundary '+amount,()=>{const f=frames();f[2].equities[1].price=amount;const r=assess(f);assert.equal(r.reaction.selectedSide,side);if(side===null){assert.equal(r.phases[1].status,'NO_SIGNAL');assert.equal(mode(r,'POST_ONLY').netReferencePnlCents,null);}});
await test('POST uses its own ETF baseline when PRE uses GLD',()=>{const f=frames();f[1].equities[0].price='999';assert.equal(assess(f).reaction.selectedSide,'call');});
await test('a later more profitable entry cannot replace the first usable snapshot',()=>{const f=frames(),later=frame(plan().preEntryAt,{bid:9,ask:10,offset:650000});const r=assess([...f,later]);assert.equal(r.phases[0].entry.frame.path,f[0].path);assert.equal(r.phases[0].grossReferencePnlCents,400);});
await test('unusable first frame is retained as a rejection before the next usable one',()=>{const f=frames(),earlier=frame(plan().preEntryAt,{offset:500000});earlier.quotes[0].askSize=0;const r=assess([...f,earlier]);assert.equal(r.phases[0].entry.rejected,1);assert.equal(r.phases[0].entry.frame.path,f[0].path);});
await test('conflicting simultaneous observations block selection',()=>{const f=frames(),other=structuredClone(f[0]);other.path+='-conflict';other.quotes[0].askCents=21;const r=assess([...f,other]);assert.equal(r.phases[0].entry.status,'CONFLICTING_SNAPSHOT');assert.equal(mode(r,'COMBINED').netReferencePnlCents,null);});
for(const [name,change] of [
  ['old quote',f=>f.quotes[0].updatedAt='2026-09-09T16:00:00.000Z'],
  ['unknown quote clock',f=>f.quotes[0].updatedAt=null],
  ['nanosecond quote after receipt',f=>f.quotes[0].updatedAt=f.capturedAt.replace('.000Z','.000000001Z')],
  ['receipt after capture',f=>f.quotes[0].receivedAt=new Date(Date.parse(f.capturedAt)+1).toISOString()],
  ['zero size',f=>f.quotes[0].askSize=0],['missing size',f=>f.quotes[0].bidSize=null],
  ['crossed market',f=>f.quotes[0].bidCents=21],['zero bid',f=>f.quotes[0].bidCents=0],
  ['unsafe contract arithmetic',f=>{f.quotes[0].bidCents=Number.MAX_SAFE_INTEGER;f.quotes[0].askCents=Number.MAX_SAFE_INTEGER;}],
  ['changed identity',f=>f.quotes[0].strike='101'],['adjusted multiplier',f=>f.quotes[0].multiplier=10],
  ['stale underlying',f=>f.equities[0].sourceAt='2026-09-09T16:00:00.000Z'],
  ['future underlying',f=>f.equities[0].sourceAt=new Date(Date.parse(f.capturedAt)+1).toISOString()],
  ['missing underlying',f=>f.equities[0].price=null],['synthetic source',f=>f.origin='SYNTHETIC_FIXTURE'],
  ['late import',f=>f.recordedAt='2026-09-09T18:00:00.000Z']
])await test(name+' cannot become a reference entry',()=>{const f=frames();change(f[0]);const r=assess(f);assert.equal(r.phases[0].entry.frame,null);assert.equal(mode(r,'COMBINED').netReferencePnlCents,null);});
await test('data recorded after the assessment cannot be used retrospectively',()=>{const f=frames(),r=assess(f,plan(),f[0].capturedAt);assert.equal(r.phases[0].entry.frame,null);assert.equal(r.phases[0].entry.status,'WAITING');});
await test('missed windows stay missed even with later favorable prices',()=>{const f=frames();f[0]=frame(plan().preEntryAt,{offset:1200001,bid:1,ask:2});const r=assess(f);assert.equal(r.phases[0].entry.status,'MISSED');assert(r.candidateLessons.some(l=>l.code==='OBSERVATION_WINDOW_MISSED'));});
await test('blocked entries cannot be labeled as zero-profit validated observations',()=>{const f=frames();f.forEach(x=>x.quotes.forEach(q=>q.delta=0.01));const c=mode(assess(f),'COMBINED');assert.equal(c.status,'NO_ACCEPTED_REFERENCES');assert.equal(c.netReferencePnlCents,null);assert.equal(c.acceptedReferences,0);});
await test('snapshot input is immutable across recomputation',()=>{const p=plan(),f=frames(),before=JSON.stringify({p,f});assess(f,p);assert.equal(JSON.stringify({p,f}),before);});
for(const [name,change,code] of [
  ['past registration',p=>p.createdAt=p.preEntryAt,'WINDOW_ORDER'],
  ['PRE crosses release',p=>p.preExitAt='2026-09-10T12:20:00.000Z','WINDOW_ORDER'],
  ['POST too early',p=>p.postEntryAt='2026-09-10T12:40:00.000Z','WINDOW_ORDER'],
  ['after-hours window',p=>p.postExitAt='2026-09-10T20:00:00.000Z','REGULAR_SESSION'],
  ['date-only event',p=>p.event.scheduledAt=null,'TIMED_FUTURE'],
  ['invalid expiry',p=>p.preContract.expiry='2026-09-31','CONTRACT'],
  ['unrelated SPY',p=>p.preContract.symbol='SPY','CONTRACT'],
  ['mixed POST expirations',p=>p.postPut.expiry='2026-10-02','POST_PAIR'],
  ['zero threshold',p=>p.minimumMoveBps=0,'MOVE_THRESHOLD'],
  ['event outside date',p=>p.event.startDate='2026-09-11','TIMED_FUTURE'],
  ['unknown authority',p=>p.orderAllowed=true,'PLAN_FIELDS']
])await test(name+' is rejected before freezing',()=>{const p=plan();change(p);assert.throws(()=>validateEventResearchPlan(p),new RegExp(code));});
await test('duplicate frame identities and impossible recording order fail closed',()=>{const f=frames();assert.throws(()=>assess([...f,f[0]]),/FRAME/);f[0].recordedAt=at;assert.throws(()=>assess(f),/FRAME/);});

async function temp(fn){const root=mkdtempSync(join(tmpdir(),'alpha-event-test-'));try{await fn(root);}finally{const full=realpathSync(root),rel=relative(realpathSync(tmpdir()),full);if(isAbsolute(rel)||rel.startsWith('..')||!rel.startsWith('alpha-event-test-'))throw Error('UNSAFE_TEST_CLEANUP');rmSync(full,{recursive:true,force:true});}}
async function seed(root){
  const captureAt=new Date(Date.now()-60000).toISOString();
  let releaseDay=new Date(Date.now()+7*86400000);
  while([0,6].includes(releaseDay.getUTCDay()))releaseDay=new Date(releaseDay.getTime()+86400000);
  const date=releaseDay.toISOString().slice(0,10),expiry=new Date(releaseDay.getTime()+21*86400000).toISOString().slice(0,10);
  let priorDay=new Date(releaseDay.getTime()-86400000);
  while([0,6].includes(priorDay.getUTCDay()))priorDay=new Date(priorDay.getTime()-86400000);
  const prior=priorDay.toISOString().slice(0,10),calendarEvent={...event(),startDate:date,endDate:date,scheduledAt:date+'T12:30:00.000Z'};
  let n=10;const instruments=new Map();
  const raw=await collectGuidanceMarket({clock:async()=>captureAt,call:async(tool,request)=>{
    if(tool==='get_equity_quotes')return {data:{results:['GLD','IBIT'].map(symbol=>({quote:{symbol,last_trade_price:'100',venue_last_trade_time:captureAt,last_non_reg_trade_price:null,venue_last_non_reg_trade_time:null},close:null}))}};
    if(tool==='get_option_chains')return {data:{chains:[{id:uuid(request.underlying_symbol==='GLD'?1:2),symbol:request.underlying_symbol,expiration_dates:[expiry]}]}};
    if(tool==='get_option_instruments'){const symbol=request.chain_id===uuid(1)?'GLD':'IBIT',list=['call','put'].map(type=>({id:uuid(n++),chain_id:request.chain_id,chain_symbol:symbol,expiration_date:expiry,type,strike_price:'100',state:'active',tradability:'tradable',underlying_type:'equity',trade_value_multiplier:'100',min_ticks:{above_tick:'0.05',below_tick:'0.01',cutoff_price:'3.00'}}));list.forEach(q=>instruments.set(q.id,q));return {data:{instruments:list,next:null}};}
    if(tool==='get_option_quotes')return {data:{results:request.instrument_ids.map(id=>({quote:{instrument_id:id,bid_price:'0.19',ask_price:'0.20',bid_size:20,ask_size:20,delta:instruments.get(id).type==='call'?'0.5':'-0.5',updated_at:captureAt}}))}};
    throw Error('DISALLOWED_TEST_TOOL');
  }});
  writeFileSync(join(root,'synthetic-input.json'),JSON.stringify(raw));const path=recordGuidanceMarket(root,'synthetic-input.json'),s=readGuidanceResearchFrames(root)[0],p=plan();
  const request={id:p.id,title:p.title,eventKey:eventResearchKey(calendarEvent),capturePath:path,settings:settings(),preContractId:s.quotes.find(q=>q.symbol==='GLD'&&q.type==='call').id,postCallId:s.quotes.find(q=>q.symbol==='IBIT'&&q.type==='call').id,postPutId:s.quotes.find(q=>q.symbol==='IBIT'&&q.type==='put').id,preEntryAt:prior+'T16:40:00.000Z',preExitAt:prior+'T19:40:00.000Z',postEntryAt:date+'T14:40:00.000Z',postExitAt:date+'T19:40:00.000Z',minimumMoveBps:20};
  return {request,guidance:{input:{calendarAvailable:true,settings:settings(),events:[calendarEvent]}}};
}
await test('empty desk reads without creating files',()=>temp(root=>{const before=readdirSync(root);assert.equal(readEventResearch(root).studies.length,0);assert.deepEqual(readdirSync(root),before);}));
await test('research recovery does not silently inherit the guidance display sixty-day cutoff',()=>temp(async root=>{const {request}=await seed(root),bytes=readFileSync(join(root,request.capturePath));for(let n=1;n<=61;n++){const date=new Date(Date.parse(at)-n*86400000).toISOString().slice(0,10),dir=join(root,'data/runtime/options-daily-guidance/captures',date);mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'copied-test-evidence.json'),bytes);}assert.equal(readGuidanceResearchFrames(root).length,62);}));
await test('registration is exclusive, idempotent and prospectively timed',()=>temp(async root=>{const {request,guidance}=await seed(root),r=registerEventResearch(root,request,guidance);assert.equal(r.alreadyRecorded,false);assert.equal(registerEventResearch(root,request,guidance).alreadyRecorded,true);assert.throws(()=>registerEventResearch(root,{...request,title:'Different'},guidance),/REQUEST_CONFLICT/);const desk=readEventResearch(root);assert.equal(desk.studies.length,1);assert.equal(desk.studies[0].phases[0].entry.status,'WAITING');assert.equal(verifyEventResearch(root,r.path).status,'VERIFIED');}));
await test('settings and missing calendar cannot silently change a frozen hypothesis',()=>temp(async root=>{const {request,guidance}=await seed(root);assert.throws(()=>registerEventResearch(root,{...request,settings:{...settings(),roundTripFeesCents:50}},guidance),/SETTINGS_CHANGED/);assert.throws(()=>registerEventResearch(root,request,{input:{...guidance.input,calendarAvailable:false}}),/CALENDAR_UNAVAILABLE/);}));
await test('saved report recovers from its own copied evidence without the source capture',()=>temp(async root=>{const {request,guidance}=await seed(root);registerEventResearch(root,request,guidance);const r=saveEventResearchReport(root,request.id);writeFileSync(join(root,request.capturePath),'{}');assert.equal(verifyEventResearch(root,r.path).status,'VERIFIED');assert.throws(()=>readEventResearch(root));}));
await test('checksum damage and rehashed inconsistent registration linkage are detected',()=>temp(async root=>{const {request,guidance}=await seed(root),r=registerEventResearch(root,request,guidance),path=join(root,r.path),saved=JSON.parse(readFileSync(path,'utf8'));saved.plan.title='Tampered';writeFileSync(path,JSON.stringify(saved));assert.throws(()=>verifyEventResearch(root,r.path),/INTEGRITY/);const {fingerprint,...body}=saved;writeFileSync(path,JSON.stringify({...body,fingerprint:paperFingerprint(body)}));assert.throws(()=>verifyEventResearch(root,r.path),/REGISTRATION_LINKAGE/);}));
await test('report output is independently recomputed even with a recalculated envelope',()=>temp(async root=>{const {request,guidance}=await seed(root);registerEventResearch(root,request,guidance);const r=saveEventResearchReport(root,request.id),saved=JSON.parse(readFileSync(join(root,r.path),'utf8'));saved.report.actualTrades=1;const {fingerprint,...body}=saved;writeFileSync(join(root,r.path),JSON.stringify({...body,fingerprint:paperFingerprint(body)}));assert.throws(()=>verifyEventResearch(root,r.path),/RECOMPUTE/);}));
await test('record paths cannot traverse the event store',()=>temp(root=>{assert.throws(()=>verifyEventResearch(root,'data/runtime/options-event-research/../escape.json'),/RECORD_PATH/);}));
await test('verified active identities are embedded in Host source and expire after the final window',()=>temp(async root=>{const {request,guidance}=await seed(root);registerEventResearch(root,request,guidance);assert.equal(activeEventResearchContracts(root).length,3);const result=await runGuidanceCommand(['--host-source'],{workspaceRoot:root});assert.equal(result.trackedContracts,3);assert(result.source.includes(request.preContractId));assert.equal(typeof new Function('return ('+result.source+');')(),'function');assert.equal(activeEventResearchContracts(root,new Date(Date.parse(request.postExitAt)+1200001).toISOString()).length,0);}));

async function trackingFixture(tracked,{alter=false}={}){
  const expiryList=['2026-09-22','2026-09-25','2026-10-06','2026-10-20'],instruments=new Map(),requests=[];
  const capture=await collectGuidanceMarket({clock:async()=>at,trackedContracts:tracked,call:async(tool,request)=>{
    requests.push({tool,request});
    if(tool==='get_equity_quotes')return {data:{results:['GLD','IBIT'].map(symbol=>({quote:{symbol,last_trade_price:'106',venue_last_trade_time:at},close:null}))}};
    if(tool==='get_option_chains')return {data:{chains:[{id:uuid(request.underlying_symbol==='GLD'?1:2),symbol:request.underlying_symbol,expiration_dates:expiryList}]}};
    if(tool==='get_option_instruments'){const symbol=request.chain_id===uuid(1)?'GLD':'IBIT',list=request.expiration_dates.split(',').flatMap(expiry=>['call','put'].flatMap((type,t)=>Array.from({length:8},(_,k)=>({id:uuid((symbol==='GLD'?1000:2000)+expiryList.indexOf(expiry)*100+t*10+k),chain_id:request.chain_id,chain_symbol:symbol,expiration_date:expiry,type,strike_price:String(100+k+(alter?1:0)),state:'active',tradability:'tradable',underlying_type:'equity',trade_value_multiplier:'100',min_ticks:{above_tick:'0.05',below_tick:'0.01',cutoff_price:'3.00'}}))));list.forEach(q=>instruments.set(q.id,q));return {data:{instruments:list,next:null}};}
    if(tool==='get_option_quotes')return {data:{results:request.instrument_ids.map(id=>({quote:{instrument_id:id,bid_price:'0.19',ask_price:'0.20',bid_size:20,ask_size:20,delta:instruments.get(id).type==='call'?'0.5':'-0.5',updated_at:at}}))}};
    throw Error('UNAUTHORIZED_TEST_TOOL');
  }});return {capture,requests};
}
const trackedContract=()=>({...contract(1100,'GLD','call'),expiry:'2026-09-25'});
await test('tracked expiry and distant strike survive rolling nearest-strike selection inside original bounds',async()=>{const c=trackedContract(),{capture,requests}=await trackingFixture([c]);assert(capture.selectedIds.includes(c.id));assert.equal(capture.selectedIds[0],c.id);assert(capture.selectedIds.length<=36);assert(capture.calls<=24);assert(requests.some(r=>r.tool==='get_option_instruments'&&r.request.expiration_dates.includes(c.expiry)));assert.equal(capture.failures.length,0);});
await test('changed live instrument metadata cannot silently substitute a frozen contract',async()=>{const c=trackedContract(),{capture}=await trackingFixture([c],{alter:true});assert(!capture.selectedIds.includes(c.id));assert(capture.failures.some(f=>f.code==='TRACKED_CONTRACT_UNAVAILABLE'));});
await test('tracked input cannot expand beyond six identities or add SPY',async()=>{await assert.rejects(()=>trackingFixture(Array.from({length:7},(_,i)=>({...trackedContract(),id:uuid(1100+i)}))),/TRACKED_CONTRACTS/);await assert.rejects(()=>trackingFixture([{...trackedContract(),symbol:'SPY'}]),/TRACKED_CONTRACTS/);});
await test('new endpoint enforces local session and saves only a research snapshot',()=>temp(async root=>{const {request,guidance}=await seed(root);registerEventResearch(root,request,guidance);const app=await startOptionsWorkbench({workspaceRoot:root,port:0});try{const body=JSON.stringify({action:'SAVE_REPORT',id:request.id}),denied=await fetch(app.url+'/api/event-research',{method:'POST',headers:{'Content-Type':'application/json'},body});assert.equal(denied.status,403);const state=await(await fetch(app.url+'/api/state')).json();assert.equal(state.eventResearch.data.studies.length,1);const saved=await fetch(app.url+'/api/event-research',{method:'POST',headers:{'Content-Type':'application/json',Origin:app.url,'X-Alpha-Session':state.session},body});assert.equal(saved.status,200);assert.equal((await saved.json()).executionAllowed,false);assert.equal((await fetch(app.url+'/event-research.js')).status,200);}finally{await app.close();}}));

const uiState=()=>({loadedAt:at,guidance:{data:{input:{quotes:[plan().preContract,plan().postCall,plan().postPut],settings:settings(),events:[event()]},current:{events:[{...event(),major:true}],marketCapturedAt:at},sourcePaths:[plan().selectionCapturePath]}},eventResearch:{state:'AVAILABLE',data:{studies:[assess()]}}});
await test('frontend defaults align with existing market observations without changing a schedule',()=>{const d=eventDraft(uiState(),'test-draft'),r=eventRequest(d);assert.equal(r.preEntryAt,plan().preEntryAt);assert.equal(r.preExitAt,plan().preExitAt);assert.equal(r.postEntryAt,plan().postEntryAt);assert.equal(r.postExitAt,plan().postExitAt);});
await test('frontend escapes source text and preserves edited research drafts',()=>{const s=uiState(),ui={};s.eventResearch.data.studies[0].plan.title='<img src=x onerror=alert(1)>';eventResearchPage(s,ui);ui.eventDraft.title='Retain my draft';const html=eventResearchPage(s,ui);assert(!html.includes('<img'));assert(html.includes('&lt;img'));assert(html.includes('Retain my draft'));assert(html.includes('PRE_ONLY')||html.includes('Pre Only'));});
await test('event process lessons appear in the existing mistake notebook as candidates',()=>{const s=uiState();s.manual={};s.outcomes={};s.activity={};const lessons=collectLessons(s);assert(lessons.some(l=>l.origin==='Event phase research'&&l.status==='CANDIDATE'));assert(lessons.every(l=>l.marketCause==='UNKNOWN'));});
console.log(passed+'/'+passed+' tests passed.');
