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
console.log(passed+'/'+passed+' tests passed.');
