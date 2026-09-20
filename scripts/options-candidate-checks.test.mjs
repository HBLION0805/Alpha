import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,realpathSync,rmSync,existsSync,mkdirSync,linkSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,relative,isAbsolute} from 'node:path';
import {assessCandidateChecks} from '../src/engines/options-daily-guidance/OptionsCandidateChecks.ts';
import {assessDailyGuidance,defaultGuidanceSettings} from '../src/engines/options-daily-guidance/OptionsDailyGuidance.ts';
import {paperFingerprint} from '../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {candidateChecksView,saveCandidateChecks,readCandidateChecks} from './lib/options-candidate-checks-io.mjs';
import {runCandidateChecksCommand} from './options-candidate-checks.mjs';
import {filterCandidateChecks,candidateChecksPanel,candidateCheckDetail} from '../apps/options-workbench/candidate-checks.js';
import {startOptionsWorkbench} from './options-workbench.mjs';
import {assessEventEntry} from '../src/engines/options-daily-guidance/OptionsEventEntry.ts';
import {conditionDefaults,thesisDefaults,eventEntryDefaults,thesisPlannerPanel,updateThesisDraft} from '../apps/options-workbench/trade-thesis.js';
import {registerDefaults} from '../apps/options-workbench/forms.js';
import {validateManualLedgerCommand,reconcileManualLedger} from '../src/engines/options-manual-ledger/OptionsManualLedger.ts';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
import {eventEntryPlanViews,compareSavedEventPlan} from './lib/options-candidate-checks-io.mjs';

const at='2026-09-08T14:00:00.000Z',uuid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function input(){return {version:'OPTIONS_CANDIDATE_CHECKS_INPUT_V1',sourcePaths:['data/runtime/options-daily-guidance/captures/2026-09-08/2026-09-08T14-00-00-000Z-'+uuid(99)+'.json'],guidance:{
  version:'OPTIONS_DAILY_GUIDANCE_INPUT_V1',at,captureAt:at,captureOrigin:'HOST_MARKET_TOOL_RESPONSES',captureComplete:true,
  quotes:['GLD','IBIT'].map((symbol,i)=>({id:uuid(i+1),symbol,expiry:'2026-09-25',type:'call',strike:'105',multiplier:100,bidCents:19,askCents:20,tickCents:1,bidSize:20,askSize:20,delta:0.5,updatedAt:at,receivedAt:at})),
  equities:['GLD','IBIT'].map(symbol=>({symbol,price:'110',sourceAt:at,close:{date:'2026-09-04',price:'108'}})),
  closeHistory:['GLD','IBIT'].flatMap(symbol=>['2026-08-31','2026-09-01','2026-09-02','2026-09-03','2026-09-04'].map((date,i)=>({symbol,date,price:String([100,101,103,105,108][i])}))),
  events:[],calendarAvailable:true,headlinesAvailable:true,sourceHealth:[],headlines:[],context:{treasury:null,btc:null},
  settings:{...defaultGuidanceSettings(),roundTripFeesCents:10,slippageReserveCents:20},
  analyst:{assessedAt:at,assets:['GLD','IBIT'].map(symbol=>({symbol,bias:'BULLISH',summary:'Isolated fixture, not market evidence',sources:[{url:'https://www.bls.gov/',retrievedAt:at}]}))}
}};}
const row=i=>assessCandidateChecks(i).rows.find(r=>r.contract.symbol==='GLD');
const check=(r,id)=>r.checks.find(c=>c.id===id);
const view=i=>({input:i.guidance,sourcePaths:i.sourcePaths});
async function temp(fn){const root=mkdtempSync(resolve(tmpdir(),'alpha-candidate-test-'));try{await fn(root);}finally{const path=realpathSync(root),rel=relative(realpathSync(tmpdir()),path);if(isAbsolute(rel)||rel.startsWith('..')||!rel.startsWith('alpha-candidate-test-'))throw Error('UNSAFE_TEST_CLEANUP');rmSync(path,{recursive:true,force:true});}}

await test('projection retains original decisions economics and fingerprints without mutation',()=>{
  const i=input(),before=JSON.stringify(i),original=assessDailyGuidance(i.guidance),r=assessCandidateChecks(i),c=r.rows[0];
  assert.equal(JSON.stringify(i),before);assert.equal(r.originalGuidanceFingerprint,paperFingerprint(original));
  assert.equal(c.disposition,'CONDITIONAL_RESEARCH');assert.deepEqual(c.economics,original.assets[0].candidates[0].feasibility.economics);
  assert.equal(c.plan.netRiskCents,430);assert.equal(c.plan.netTargetCents,870);
  assert(c.checks.every(x=>x.status==='PASS'));assert.equal(c.paperAdapterQualified,false);assert.equal(r.qualification.status,'NOT_ESTABLISHED');assert.equal(r.executionAllowed,false);assert.equal(r.winProbability,null);
});
await test('affordable premium can fail both the planned loss and full-premium caps',()=>{
  const i=input();Object.assign(i.guidance.quotes[0],{bidCents:44,askCents:47});const r=row(i);
  assert.equal(r.premiumWithinBudget,true);assert.equal(check(r,'allocation').status,'PASS');assert.equal(check(r,'loss').status,'BLOCKED');assert.equal(check(r,'stress').status,'BLOCKED');assert.equal(r.disposition,'NO_TRADE');
});
await test('unknown costs keep all-in budget risk cash and reward unknown without hiding premium',()=>{
  const i=input();i.guidance.settings.roundTripFeesCents=null;const r=row(i);
  assert.equal(r.premiumWithinBudget,true);assert.equal(r.economics.premiumCents,2000);assert.equal(r.plan.netRiskCents,null);
  for(const id of ['costs','allocation','loss','stress','reward','cash'])assert.equal(check(r,id).status,'UNKNOWN',id);
});
await test('known premium excess remains blocked even when costs are unknown',()=>{
  const i=input();i.guidance.settings.roundTripFeesCents=null;Object.assign(i.guidance.quotes[0],{bidCents:99,askCents:100});const r=row(i);
  assert.equal(r.premiumWithinBudget,false);assert.equal(check(r,'allocation').status,'BLOCKED');assert.equal(check(r,'stress').status,'BLOCKED');
});
await test('explicit zero costs remain a declaration and do not qualify source execution',()=>{
  const i=input();Object.assign(i.guidance.settings,{roundTripFeesCents:0,slippageReserveCents:0});const r=row(i);
  assert.equal(check(r,'costs').status,'PASS');assert.equal(r.plan.netRiskCents,400);assert.equal(r.paperAdapterQualified,false);
});
await test('spread friction consumes a small declared stop and is not concealed by affordability',()=>{
  const i=input();Object.assign(i.guidance.quotes[0],{bidCents:15,askCents:20});const r=row(i);
  assert(r.originalBlockers.includes('STOP_BUDGET_NOT_EXECUTABLE'));assert.equal(check(r,'loss').status,'BLOCKED');assert.equal(check(r,'spread').status,'BLOCKED');
});
for(const [name,mutate,id,status] of [
  ['missing ask',i=>i.quotes[0].askCents=null,'spread','UNKNOWN'],
  ['missing size',i=>i.quotes[0].bidSize=null,'size','UNKNOWN'],
  ['zero size',i=>i.quotes[0].bidSize=0,'size','BLOCKED'],
  ['missing delta',i=>i.quotes[0].delta=null,'delta','UNKNOWN'],
  ['far out-of-money delta',i=>i.quotes[0].delta=0.03,'delta','BLOCKED'],
  ['missing quote time',i=>i.quotes[0].updatedAt=null,'clocks','UNKNOWN'],
  ['old quote',i=>i.quotes[0].updatedAt='2026-09-04T20:00:00.000Z','clocks','BLOCKED'],
  ['future quote',i=>i.quotes[0].updatedAt='2026-09-08T14:00:00.999Z','clocks','BLOCKED'],
  ['insufficient closes',i=>i.closeHistory=[],'direction','UNKNOWN'],
  ['opposing analyst',i=>i.analyst.assets[0].bias='BEARISH','direction','BLOCKED'],
  ['missing calendar',i=>i.calendarAvailable=false,'events','UNKNOWN'],
  ['event wait',i=>i.events=[{title:'Producer Price Index',source:'BLS',startDate:'2026-09-09',endDate:'2026-09-09',scheduledAt:'2026-09-09T12:30:00.000Z'}],'events','BLOCKED'],
  ['outside regular session',i=>i.at='2026-09-08T22:00:00.000Z','session','BLOCKED'],
  ['partial source',i=>i.captureComplete=false,'capture','BLOCKED'],
  ['unverified origin',i=>i.captureOrigin='SYNTHETIC_FIXTURE','capture','BLOCKED'],
  ['near expiry',i=>i.quotes[0].expiry='2026-09-09','contract','BLOCKED'],
  ['declared cash shortfall',i=>i.settings.settledCashCents=1000,'cash','BLOCKED'],
])await test(name+' remains visible and all original reasons survive',()=>{
  const i=input();mutate(i.guidance);const r=row(i);assert.equal(check(r,id).status,status);assert.equal(r.disposition,'NO_TRADE');
  const original=assessDailyGuidance(i.guidance).assets[0].candidates[0].blockers;
  assert.deepEqual([...new Set(r.checks.flatMap(c=>c.reasons))].sort(),[...original].sort());
});
await test('empty and missing-price samples have no invented affordable candidates',()=>{
  const i=input();i.guidance.quotes=[];let r=assessCandidateChecks(i);assert.equal(r.counts.sampled,0);assert.equal(r.counts.conditionalResearch,0);
  const j=input();j.guidance.quotes.forEach(q=>q.askCents=null);r=assessCandidateChecks(j);assert.equal(r.counts.premiumUnknown,2);assert.equal(r.counts.premiumWithinBudget,0);
});
await test('lineage paths cannot be replaced by traversal or arbitrary files',()=>{
  for(const path of ['../escape','data/runtime/options-daily-guidance/captures/2026-09-08/../x.json','C:/outside.json']){const i=input();i.sourcePaths=[path];assert.throws(()=>assessCandidateChecks(i),/INPUT/);}
});
await test('saved checks independently recover when live inputs and assumptions change',()=>temp(root=>{
  const i=input(),r=saveCandidateChecks(root,view(i)),bytes=readFileSync(resolve(root,r.path));
  i.guidance.settings.roundTripFeesCents=999;assert.equal(readCandidateChecks(root,r.path).report.rows[0].plan.netRiskCents,430);
  const isolated=resolve(root,'recovery');mkdirSync(resolve(isolated,'data/runtime/options-candidate-checks'),{recursive:true});writeFileSync(resolve(isolated,r.path),bytes);
  assert.equal(readCandidateChecks(isolated,r.path).reportFingerprint,r.reportFingerprint);assert(readFileSync(resolve(root,r.path)).equals(bytes));
}));
await test('new saves are exclusive and prior snapshots retain assessment clocks',()=>temp(root=>{
  const a=saveCandidateChecks(root,view(input())),b=saveCandidateChecks(root,view(input()));assert.notEqual(a.path,b.path);assert.equal(a.assessedAt,at);
  assert.equal(candidateChecksView(root,view(input()),new Date().toISOString()).history.length,2);
}));
await test('tampering is rejected even when the altered output hash is recalculated',()=>temp(root=>{
  const saved=saveCandidateChecks(root,view(input())),path=resolve(root,saved.path),r=JSON.parse(readFileSync(path,'utf8'));
  r.report.rows[0].paperAdapterQualified=true;writeFileSync(path,JSON.stringify(r));assert.throws(()=>readCandidateChecks(root,saved.path),/INTEGRITY/);
  r.reportFingerprint=paperFingerprint(r.report);writeFileSync(path,JSON.stringify(r));assert.throws(()=>readCandidateChecks(root,saved.path),/RECOMPUTE/);
  assert.throws(()=>candidateChecksView(root,view(input()),new Date().toISOString()),/RECOMPUTE/);
}));
await test('future assessment and recording clocks cannot be backdated into evidence',()=>temp(root=>{
  const i=input();i.guidance.at='2099-01-01T14:00:00.000Z';assert.throws(()=>saveCandidateChecks(root,view(i)),/FUTURE/);
  const s=saveCandidateChecks(root,view(input()));assert.throws(()=>readCandidateChecks(root,s.path,at),/FUTURE/);
}));
await test('path escapes hard links junctions and partial artifacts fail closed',()=>temp(root=>{
  const s=saveCandidateChecks(root,view(input()));assert.throws(()=>readCandidateChecks(root,'../escape'),/PATH/);
  linkSync(resolve(root,s.path),resolve(root,'duplicate.json'));assert.throws(()=>readCandidateChecks(root,s.path));
  const other=resolve(root,'other'),target=resolve(root,'target');mkdirSync(other);mkdirSync(target);symlinkSync(target,resolve(other,'data'),process.platform==='win32'?'junction':'dir');assert.throws(()=>candidateChecksView(other,view(input()),new Date().toISOString()),/DIRECTORY/);
  writeFileSync(resolve(root,'data/runtime/options-candidate-checks/partial.tmp'),'{}');assert.throws(()=>candidateChecksView(root,view(input()),new Date().toISOString()),/CATALOG_ENTRY/);
}));
await test('CLI verification reconstructs saved checks without original source stores',()=>temp(async root=>{
  const saved=saveCandidateChecks(root,view(input()));const r=await runCandidateChecksCommand(['--verify',saved.path],{workspaceRoot:root});assert.equal(r.status,'VERIFIED');assert.equal(r.counts.sampled,2);
  for(const args of [[],['--fetch'],['--report','extra'],['--verify']])await assert.rejects(()=>runCandidateChecksCommand(args,{workspaceRoot:root}),/ARGUMENTS/);
}));
await test('frontend filters preserve all rows and separate premium budget from risk',()=>{
  const i=input();Object.assign(i.guidance.quotes[0],{askCents:100,bidCents:99});const r=assessCandidateChecks(i);
  assert.equal(filterCandidateChecks(r.rows,{budget:'within'}).length,1);assert.equal(filterCandidateChecks(r.rows,{asset:'GLD',budget:'within'}).length,0);assert.equal(r.rows.length,2);
  const html=candidateChecksPanel({data:{current:r,history:[]}},{candidateCheckFilter:{asset:'GLD',budget:'within'}});assert(html.includes('No candidates match'));assert(html.includes('Showing 0 / 2'));assert(html.includes('Source qualification remains open'));
});
await test('frontend escapes source content displays clocks and protects unsaved costs',()=>{
  const r=assessCandidateChecks(input());r.rows[0].contract.strike='<img src=x onerror=alert(1)>';
  const html=candidateCheckDetail(r.rows[0],r);assert(!html.includes('<img'));assert(html.includes('&lt;img'));assert(html.includes('Receipt'));assert(html.includes('Full-premium stress'));assert(html.includes(r.rows[0].contract.updatedAt));assert(html.includes(r.assessedAt));
  const panel=candidateChecksPanel({data:{current:r,history:[]}},{guidanceSettingsDraft:{roundTripFeesCents:'1.25'}});assert(panel.includes('id="save-candidate-checks" disabled'));assert(panel.includes('unsaved planning assumptions'));
});
await test('GET is read-only and only protected explicit saves append check snapshots',()=>temp(async root=>{
  const app=await startOptionsWorkbench({workspaceRoot:root,port:0});try{
    const state=await(await fetch(app.url+'/api/state')).json();assert.equal(state.candidateChecks.state,'AVAILABLE');assert(!existsSync(resolve(root,'data/runtime/options-candidate-checks')));
    assert.equal((await fetch(app.url+'/candidate-checks.js')).status,200);
    const request=body=>({method:'POST',headers:{'Content-Type':'application/json',Origin:app.url,'X-Alpha-Session':state.session},body:JSON.stringify(body)});
    assert.equal((await fetch(app.url+'/api/candidate-checks',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
    assert.equal((await fetch(app.url+'/api/candidate-checks',request({accountAccess:true}))).status,409);
    const response=await fetch(app.url+'/api/candidate-checks',request({}));assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.executionAllowed,false);assert.equal(readCandidateChecks(root,saved.path).report.counts.sampled,0);
    const bytes=readFileSync(resolve(root,saved.path));const after=await(await fetch(app.url+'/api/state')).json();assert.equal(after.candidateChecks.data.history.length,1);assert(readFileSync(resolve(root,saved.path)).equals(bytes));
    assert.equal((await fetch(app.url+'/api/order',request({}))).status,404);assert.equal(state.accountAccessed,false);
  }finally{await app.close();}
}));
await test('browser request wrapper permits snapshots and preserves session and timeout handling',async()=>{
  const priorFetch=globalThis.fetch,priorLocation=globalThis.location;let seen;
  globalThis.location={origin:'http://127.0.0.1:4173'};
  globalThis.fetch=async(path,options)=>{seen={path,options};return {ok:true,json:async()=>path==='/api/state'?{session:'test-candidate-session'}:{status:'SAVED_AND_VERIFIED'}};};
  try{
    const {request}=await import('../apps/options-workbench/api.js');await request('/api/state');
    assert.equal((await request('/api/candidate-checks',{})).status,'SAVED_AND_VERIFIED');
    assert.equal(seen.path,'/api/candidate-checks');assert.equal(seen.options.method,'POST');assert.equal(seen.options.headers['X-Alpha-Session'],'test-candidate-session');
    await assert.rejects(()=>request('/api/orders',{}),/Unsupported/);
    globalThis.fetch=async()=>{const e=Error('timeout');e.name='AbortError';throw e;};
    await assert.rejects(()=>request('/api/candidate-checks',{}),/check Saved check snapshots before saving again/);
  }finally{globalThis.fetch=priorFetch;if(priorLocation===undefined)delete globalThis.location;else globalThis.location=priorLocation;}
});
function preEventInput(){
  const i=input(),g=i.guidance,release='2026-09-09T12:30:00.000Z',registeredAt='2026-09-08T13:40:00.000Z';
  const condition={...conditionDefaults('OWNER_CONFIRMED','owner'),basis:'Synthetic pre-entry premise',checkAt:release,missingAction:'Verify original release manually',eventKey:'BLS:synthetic-event',releaseAt:release,source:'https://www.bls.gov/test',invalidation:'Owner verifies the specified prerequisite was rejected'};
  const t={...thesisDefaults(),tradeDate:'2026-09-08',realizationStartAt:release,realizationEndAt:'2026-09-09T19:30:00.000Z',nextCheckAt:'2026-09-08T19:00:00.000Z',holdThroughEvent:'YES',manualFallback:'Owner checks original release; unavailable bid requires manual broker review, no assumed fill',conditions:[condition],eventEntry:{...eventEntryDefaults(),phase:'PRE_EVENT',conditionId:'owner',calendarVerifiedAt:'2026-09-08T13:35:00.000Z',calendarSource:'https://www.bls.gov/test-calendar',expectationStatus:'UNAVAILABLE',expectationBasis:'Synthetic absence of reliable consensus, not replaced by a prior actual',differenceBasis:'Synthetic independent premise and cited evidence',supportingScenario:'Support',neutralScenario:'Mixed or inline',reverseScenario:'Contrary result',counterexample:'Correct direction but IV repricing consumes the premium',reviewer:'Owner performs source and option checks',gapRiskAccepted:true,closedMarketRiskAccepted:true}};
  const plan={declaredAt:registeredAt,maxContracts:1,maxEntryDebitUsd:'21',plannedRiskUsd:'5',targetNetProfitUsd:'9',stopPremiumUsd:'0.16',entryDeadlineAt:'2026-09-08T19:50:00.000Z',timeExitAt:'2026-09-09T19:50:00.000Z',thesis:'Synthetic independent thesis',invalidation:t};
  const event={title:'Employment Situation',source:'BLS',startDate:'2026-09-09',endDate:'2026-09-09',scheduledAt:release};g.events=[event];
  g.eventPlan={key:'frozen:synthetic-event-plan',version:paperFingerprint(plan),kind:'FROZEN',symbol:'GLD',plan,contract:{symbol:'GLD',expiry:'2026-09-25',optionType:'CALL',strikeUsd:'105',multiplier:100},registeredAt,openedAt:null,calendar:[{key:condition.eventKey,title:event.title,source:'BLS',scheduledAt:release,receivedAt:'2026-09-08T13:00:00.000Z'}]};
  return i;
}
await test('legacy no-mode and explicit post-event keep the original event wait and recovery fingerprint',async()=>temp(root=>{
  const i=preEventInput();delete i.guidance.eventPlan;const original=assessDailyGuidance(i.guidance);assert(row(i).originalBlockers.includes('MAJOR_EVENT_WAIT'));
  const r=saveCandidateChecks(root,view(i));assert.equal(readCandidateChecks(root,r.path).report.originalGuidanceFingerprint,paperFingerprint(original));
  const legacy=preEventInput();delete legacy.guidance.eventPlan.plan.invalidation.eventEntry;legacy.guidance.eventPlan.version=paperFingerprint(legacy.guidance.eventPlan.plan);assert(row(legacy).originalBlockers.includes('MAJOR_EVENT_WAIT'));
  const post=preEventInput();post.guidance.eventPlan.plan.invalidation.eventEntry.phase='POST_EVENT';assert(row(post).originalBlockers.includes('MAJOR_EVENT_WAIT'));assert.match(check(row(post),'events').explanation,/post-event confirmation/);
  post.guidance.at='2026-09-09T14:00:00.000Z';assert(!row(post).originalBlockers.includes('MAJOR_EVENT_WAIT'));
}));
await test('incomplete pre-event research replaces a universal wait with exact missing confirmations, never eligibility',()=>{
  const i=preEventInput(),ctx=i.guidance.eventPlan;ctx.kind='DRAFT';ctx.contract=null;ctx.plan.timeExitAt=null;ctx.plan.invalidation.eventEntry.gapRiskAccepted=false;ctx.plan.invalidation.eventEntry.reviewer='';
  const r=assessCandidateChecks(i);assert.equal(r.eventEntry.eligible,false);assert.equal(r.rows[0].disposition,'NO_TRADE');
  for(const reason of ['PRE_EVENT_PLAN_INCOMPLETE','EVENT_RISK_NOT_CONFIRMED','MAX_EXIT_NOT_DEFINED','MONITORING_CONTINGENCY_MISSING','CONTRACT_NOT_SELECTED'])assert(r.eventEntry.blockers.includes(reason),reason);
  assert(!r.rows[0].originalBlockers.includes('MAJOR_EVENT_WAIT'));assert(r.rows[1].originalBlockers.includes('MAJOR_EVENT_WAIT'));
  delete ctx.plan.invalidation.eventEntry;assert.equal(assessCandidateChecks(i).eventEntry.researchApproach,'PRE_EVENT');assert(assessCandidateChecks(i).eventEntry.blockers.includes('PRE_EVENT_MODE_NOT_CONFIRMED'));
  ctx.plan.entryDeadlineAt=null;const missingDeadline=assessCandidateChecks(i).eventEntry;assert(missingDeadline.blockers.includes('ENTRY_DEADLINE_NOT_DEFINED'));assert(!missingDeadline.blockers.includes('PRE_EVENT_ENTRY_WINDOW_CLOSED'));
});
await test('frozen prospective pre-event plan uses original candidate checks with explicit retained gap exposure',()=>{
  const i=preEventInput(),p=i.guidance.eventPlan;
  validateManualLedgerCommand({type:'REGISTER_TRADE',requestId:'synthetic-register',tradeId:'synthetic-event-plan',contract:p.contract,plan:p.plan,activityReference:null},p.registeredAt);
  const r=assessCandidateChecks(i);assert.equal(r.eventEntry.eligible,true);assert.equal(r.rows[0].disposition,'CONDITIONAL_RESEARCH');assert(r.rows[1].originalBlockers.includes('MAJOR_EVENT_WAIT'));
  assert.match(check(r.rows[0],'events').explanation,/No stop execution is possible while the option market is closed/);assert.equal(r.executionAllowed,false);
  const e=structuredClone(i);delete e.guidance.eventPlan;e.guidance.events=[];assert.deepEqual(r.rows[0].economics,row(e).economics);
});
await test('calendar changes, missing coverage, future receipts and retrospective declarations fail closed',()=>{
  for(const [change,code] of [
    [i=>i.guidance.eventPlan.calendar[0].scheduledAt='2026-09-10T12:30:00.000Z','EVENT_TIME_CHANGED_OR_UNKNOWN'],
    [i=>i.guidance.calendarAvailable=false,'EVENT_CALENDAR_UNAVAILABLE'],
    [i=>i.guidance.eventPlan.calendar=[],'EVENT_CALENDAR_UNAVAILABLE'],
    [i=>i.guidance.eventPlan.calendar[0].receivedAt='2026-09-08T14:01:00.000Z','EVENT_CALENDAR_CLOCK_UNVERIFIED'],
    [i=>i.guidance.eventPlan.registeredAt='2026-09-09T13:00:00.000Z','PRE_EVENT_RECORDED_AFTER_RELEASE'],
    [i=>i.guidance.eventPlan.openedAt='2026-09-08T13:30:00.000Z','PRE_EVENT_NOT_SAVED_BEFORE_ENTRY_AND_RELEASE'],
    [i=>i.guidance.eventPlan.version='sha256:'+'0'.repeat(64),'PLAN_VERSION_MISMATCH']]){
      const i=preEventInput();change(i);const r=assessCandidateChecks(i);assert.equal(r.eventEntry.eligible,false);assert(r.eventEntry.blockers.includes(code),code);assert.equal(r.rows[0].disposition,'NO_TRADE');
  }
});
await test('an event-specific exception never waives another event, identity, costs or missing quote',()=>{
  const i=preEventInput();i.guidance.events.push({...i.guidance.events[0],title:'Consumer Price Index'});assert(row(i).originalBlockers.includes('MAJOR_EVENT_WAIT'));
  const wrong=preEventInput();wrong.guidance.quotes[0].strike='106';assert(row(wrong).originalBlockers.includes('EVENT_PLAN_CONTRACT_MISMATCH'));
  const missing=preEventInput();missing.guidance.quotes=[];assert.equal(assessCandidateChecks(missing).rows.length,0);
  for(const change of [i=>i.guidance.quotes[0].updatedAt='2026-09-08T13:00:00.000Z',i=>i.guidance.settings.roundTripFeesCents=null]){const x=preEventInput();change(x);assert.equal(row(x).disposition,'NO_TRADE');}
});
await test('risk acceptance and saved rationale are required at freeze, drafts remain saveable',()=>{
  const i=preEventInput(),p=i.guidance.eventPlan,e=p.plan.invalidation.eventEntry;e.gapRiskAccepted=false;
  const command={type:'REGISTER_TRADE',requestId:'synthetic-register',tradeId:'synthetic-event-plan',contract:p.contract,plan:p.plan,activityReference:null};
  assert.throws(()=>validateManualLedgerCommand(command,p.registeredAt),/PRE_EVENT_PLAN_INCOMPLETE/);
  validateManualLedgerCommand({type:'SAVE_PLAN_DRAFT',requestId:'synthetic-draft',tradeId:'synthetic-event-plan',draft:{fields:registerDefaults(),thesis:p.plan.invalidation}},p.registeredAt);
  e.gapRiskAccepted=true;e.differenceBasis='';assert.throws(()=>validateManualLedgerCommand(command,p.registeredAt),/PRE_EVENT_PLAN_INCOMPLETE/);
});
await test('new frozen entry confirmations recover immutably and feed the existing saved-plan comparison path',async()=>temp(async root=>{
  const i=preEventInput(),p=i.guidance.eventPlan,service=createWorkbenchData({workspaceRoot:root,now:()=>p.registeredAt});service.initialize();
  const command={type:'REGISTER_TRADE',requestId:'synthetic-freeze',tradeId:'synthetic-event-plan',contract:p.contract,plan:p.plan,activityReference:null};
  const preview=service.preview(command);service.save({command,expectedHeadSha256:preview.headSha256});
  const state=await createWorkbenchData({workspaceRoot:root,now:()=>at}).state(),trade=state.manual.data.trades[0];assert.equal(paperFingerprint(trade.plan),p.version);assert.equal(trade.openContracts,0);
  assert.equal(state.eventEntryPlans.data[0].eligible,false);assert(state.eventEntryPlans.data[0].blockers.includes('EVENT_CALENDAR_UNAVAILABLE'));
  state.guidance={data:view(i)};state.calendar={data:{groups:[{dateOnlyEntries:[],scheduledTimeEntries:[{...i.guidance.events[0],sourceKey:'synthetic-event'}]}],sources:{bls:{lastKnownReceivedAt:p.calendar[0].receivedAt}}}};
  const plans=eventEntryPlanViews(state);assert.equal(plans[0].eligible,true);
  const result=compareSavedEventPlan(state,plans[0].planKey,plans[0].planVersion);assert.equal(result.current.rows[0].disposition,'CONDITIONAL_RESEARCH');assert.equal(result.current.eventEntry.planVersion,p.version);
  const changed={...command,requestId:'overwrite-plan',plan:{...command.plan,stopPremiumUsd:'0.01'}};assert.throws(()=>service.preview(changed),/TRADE_ID_OR_BOUND/);
}));
await test('saved-plan service, page and API preserve missing reasons and reject caller-made authority',async()=>temp(async root=>{
  const service=createWorkbenchData({workspaceRoot:root,now:()=>at});service.initialize();
  const t=preEventInput().guidance.eventPlan.plan.invalidation,draft={type:'SAVE_PLAN_DRAFT',requestId:'synthetic-draft',tradeId:'synthetic-event-plan',draft:{fields:{...registerDefaults(),tradeId:'synthetic-event-plan'},thesis:t}};
  const preview=service.preview(draft);service.save({command:draft,expectedHeadSha256:preview.headSha256});
  const app=await startOptionsWorkbench({workspaceRoot:root,port:0,now:()=>at});try{
    const state=await(await fetch(app.url+'/api/state')).json(),p=state.eventEntryPlans.data[0];assert.equal(p.researchApproach,'PRE_EVENT');
    const body={action:'PREVIEW_PLAN',planKey:p.planKey,planVersion:p.planVersion},headers={Origin:app.url,'Content-Type':'application/json','X-Alpha-Session':state.session};
    const response=await fetch(app.url+'/api/candidate-checks',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(response.status,200);const result=await response.json();assert.deepEqual(result.current.eventEntry.blockers,p.blockers);
    const html=candidateChecksPanel(state.candidateChecks,{eventCandidateReport:result},state.eventEntryPlans);for(const reason of p.blockers)assert(html.includes(reason));assert(html.includes('Pre-event anticipation'));
    const pending=candidateChecksPanel(state.candidateChecks,{eventCandidatePending:true},state.eventEntryPlans);assert(pending.includes('" disabled>Check saved plan:'));assert(pending.includes('Checking saved plan against local evidence'));
    assert.equal((await fetch(app.url+'/api/candidate-checks',{method:'POST',headers,body:JSON.stringify({...body,eligible:true})})).status,409);
    assert.equal((await fetch(app.url+'/api/candidate-checks',{method:'POST',headers,body:JSON.stringify({...body,planVersion:'sha256:'+'0'.repeat(64)})})).status,409);
    const after=await createWorkbenchData({workspaceRoot:root,now:()=>at}).state();assert.equal(after.manual.data.trades.length,0);assert.equal(after.manual.data.planRecords.length,1);assert.equal(after.eventEntryPlans.data[0].planVersion,p.planVersion);assert(!existsSync(resolve(root,'data/runtime/options-candidate-checks')));
    const ui={thesisFields:draft.draft.fields,thesisDraft:draft.draft.thesis};const form=thesisPlannerPanel(after,ui);assert(form.includes('Event approach'));assert(form.includes('No automatic opening monitoring'));assert(form.includes('name="entry.gapRiskAccepted" checked'));
    updateThesisDraft(ui,'entry.gapRiskAccepted',false);assert.equal(ui.thesisDraft.eventEntry.gapRiskAccepted,false);
  }finally{await app.close();}
}));
console.log(passed+'/'+passed+' tests passed.');
