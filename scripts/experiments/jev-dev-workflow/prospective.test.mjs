import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {HARD_GATES,SERVED_MODEL,hash} from './decision.mjs';
import {prospectiveInference,prospectiveRequest} from './prospective-client.mjs';
import {openPhase,metrics,POLICY} from './prospective.mjs';

const input=(n=1,type='OWNER_GATE')=>({caseId:'isolated-'+n,episodeId:'episode-'+n,decisionType:type,sanitizedState:'Isolated test-only ambiguous local decision number '+n,hardSafetyFlags:[],deterministicResolution:null,independenceBasis:'Independent isolated fixture; never a production sample.',newRealDecision:true,preDecisionOnly:true});
const answer=(choice='CONTINUE',cost=0.0000042)=>({id:'gen-dec-isolated',model:SERVED_MODEL,provider:'TypeSafe',answers:{decision:{type:'choice',choice,confidence:0.7}},usage:{input_tokens:100,output_tokens:10,cost}});
const reply=a=>new Response(JSON.stringify(a),{status:200});
async function setup(t,fetcher=async()=>reply(answer()),overrides={}){
  const root=mkdtempSync(join(tmpdir(),'alpha-jev-phase2-test-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  let time=Date.now(),calls=0;
  const phase=openPhase(root,{key:'unit-test-only',clock:()=>new Date(time+=1000).toISOString(),fetcher:async(...args)=>{calls++;return fetcher(...args);},...overrides});
  await phase.init();return {root,phase,calls:()=>calls};
}
const action=(decision='CONTINUE',asked=false)=>({actualCodexDecision:decision,ownerInterruptionMade:asked,basis:'Actual independent workflow action, isolated test only.'});
const gold=(label='CONTINUE')=>({goldLabel:label,verified:true,verifiedOutcome:'Subsequent isolated verification established this result.',goldBasis:'Isolated test evidence after action; not a real episode.'});

test('phase starts empty and init/report/recovery make zero external calls',async t=>{
  const {phase,root,calls}=await setup(t);const before=readFileSync(join(root,'phase.json'),'utf8');await phase.init();
  const r=phase.report();assert.equal(r.decisionPoints,0);assert.equal(r.api.calls,0);assert.equal(r.owner.accuracy,null);assert.equal(r.disposition,null);assert.equal(calls(),0);assert.equal(readFileSync(join(root,'phase.json'),'utf8'),before);
});
test('state is persisted before request, gold and actual actions never enter the request',async t=>{
  let root,seen;const setupResult=await setup(t,async(url,options)=>{seen=JSON.parse(options.body);assert(readFileSync(join(root,'isolated-1.input.json'),'utf8'));assert(!readdirSync(root).some(f=>f.includes('.gold-')||f.endsWith('.action.json')));assert.equal(options.redirect,'error');return reply(answer());});
  root=setupResult.root;const {phase}=setupResult;const captured=await phase.capture(input());
  assert.equal(captured.status,'SHADOW_RECEIPT_SAVED');assert.equal(captured.decision,undefined);
  assert.deepEqual(Object.keys(seen.state),['developmentState']);assert.equal(seen.model,'typesafe/jev-1.13');assert.equal(seen.provider.allow_fallbacks,false);assert(Object.hasOwn(seen.questions.decision.criteria,'UNKNOWN'));
  for(const text of ['isolated-1','episode-1','independenceBasis','actualCodexDecision','goldLabel'])assert(!JSON.stringify(seen).includes(text));
  assert.equal(phase.review('isolated-1').receipt,undefined);
  assert.equal(phase.report().owner.ownerInterruptionsActuallyMade,null);
  await assert.rejects(()=>phase.label('isolated-1',gold()),/ACTUAL_ACTION_REQUIRED/);
  await phase.action('isolated-1',action());await phase.label('isolated-1',gold());
  const restored=openPhase(root).review('isolated-1');assert.equal(restored.gold.goldLabel,'CONTINUE');assert.equal(restored.receipt.result.executionAllowed,false);
});
test('all hard gates and deterministic resolutions skip Jev, even with missing key',async t=>{
  const {phase,calls}=await setup(t,undefined,{key:''});
  for(const gate of HARD_GATES){assert.equal((await phase.capture({...input(),hardSafetyFlags:[gate]})).status,'DETERMINISTIC_SKIP');let n=0;const r=await prospectiveInference({...input(),hardSafetyFlag:gate},{key:'test-only',fetcher:()=>n++});assert.equal(r.requestMade,false);assert.equal(n,0);assert.equal(r.decision,'ASK_OWNER');}
  assert.equal((await phase.capture({...input(),deterministicResolution:{decision:'CONTINUE',basis:'Explicit policy and machine-readable flags establish the answer.'}})).requestMade,false);
  assert.equal(calls(),0);assert.equal(phase.report().decisionPoints,0);
});
test('disallowed families, historical cases, gold contamination and secret/path inputs make no calls',async t=>{
  const {phase,calls}=await setup(t);const old=JSON.parse(readFileSync(new URL('./cases.json',import.meta.url))).cases[0];
  const rejected=[{...input(),decisionType:'ROUTING'},{...input(),goldLabel:'CONTINUE'},{...input(),actualCodexDecision:'CONTINUE'},{...input(),sanitizedState:old.sanitizedState},{...input(),sanitizedState:'unit-test-only'},{...input(),caseId:'unit-test-only'},{...input(),sanitizedState:'Read C:/Users/private/source.txt'},{...input(),preDecisionOnly:false},{...input(),hardSafetyFlags:['UNKNOWN_FLAG']}];
  for(const candidate of rejected)await assert.rejects(()=>phase.capture(candidate));assert.equal(calls(),0);assert.equal(phase.report().decisionPoints,0);
});
test('duplicate cases/states and third point in one episode cannot consume requests',async t=>{
  const {phase,calls}=await setup(t);await phase.capture(input());
  await assert.rejects(()=>phase.capture(input()),/DUPLICATE_CASE/);
  await assert.rejects(()=>phase.capture({...input(2),sanitizedState:input().sanitizedState}),/DUPLICATE_STATE/);
  await phase.capture({...input(2),episodeId:input().episodeId});
  await assert.rejects(()=>phase.capture({...input(3),episodeId:input().episodeId}),/EPISODE_LIMIT/);assert.equal(calls(),2);
});
test('exclusive lock prevents a concurrent second request',async t=>{
  let release,entered;const started=new Promise(resolve=>entered=resolve);const wait=new Promise(resolve=>release=resolve);
  const {phase,calls}=await setup(t,async()=>{entered();await wait;return reply(answer());});
  const first=phase.capture(input());await started;
  await assert.rejects(()=>phase.capture(input(2)),/EXPERIMENT_BUSY/);release();await first;assert.equal(calls(),1);
});
test('reported budget exhaustion stops further sampling without increasing the limit',async t=>{
  const {phase,calls}=await setup(t,async()=>reply(answer('CONTINUE',POLICY.maxReportedCostUsd)));
  await phase.capture(input());assert.equal(phase.report().collectionStatus,'BUDGET_STOP');
  await assert.rejects(()=>phase.capture(input(2)),/BUDGET_STOP/);assert.equal(calls(),1);
});
test('50-point phase cap is independent of target or gold availability',async t=>{
  const {phase,root,calls}=await setup(t);await phase.capture(input());
  const first=JSON.parse(readFileSync(join(root,'isolated-1.input.json'))),receipt=JSON.parse(readFileSync(join(root,'isolated-1.receipt.json')));
  for(let n=2;n<=50;n++){const record={...first,...input(n)};writeFileSync(join(root,record.caseId+'.input.json'),JSON.stringify(record));writeFileSync(join(root,record.caseId+'.receipt.json'),JSON.stringify({...receipt,caseId:record.caseId,inputHash:hash(record)}));}
  assert.equal(phase.report().collectionStatus,'SAMPLE_CAP_REACHED');await assert.rejects(()=>phase.capture(input(51)),/SAMPLE_CAP_REACHED/);assert.equal(calls(),1);
});
test('unresolved receipt fails closed with unknown call count/cost and no retry',async t=>{
  const {phase,root,calls}=await setup(t);writeFileSync(join(root,'isolated-1.input.json'),JSON.stringify({...input(),decisionTimestamp:new Date().toISOString()}));
  const report=phase.report();assert.equal(report.collectionStatus,'INCOMPLETE_RECEIPT_NO_RETRY');assert.equal(report.api.calls,null);assert.equal(report.api.reportedCostUsd,null);
  await assert.rejects(()=>phase.capture(input(2)),/INCOMPLETE_RECEIPT/);assert.equal(calls(),0);
});
test('auth, malformed response, model mismatch, rate limit and missing cost stop without retries',async t=>{
  const variants=[()=>new Response('do not retain private provider text',{status:401}),()=>new Response('bad JSON',{status:200}),()=>reply({...answer(),model:'typesafe/jev-latest'}),()=>new Response('limited',{status:429}),()=>reply(answer('CONTINUE',null))];
  for(const make of variants){const {phase,calls,root}=await setup(t,async()=>make());await phase.capture(input());await assert.rejects(()=>phase.capture(input(2)),/FAILURE_STOP/);assert.equal(calls(),1);const r=phase.review('isolated-1');assert.equal(r.receipt,undefined);const saved=readFileSync(join(root,'isolated-1.receipt.json'),'utf8');assert(!saved.includes('do not retain'));assert(!saved.includes('limited'));assert.equal(JSON.parse(saved).result.decision,'UNKNOWN');}
});
test('timeout and secret-bearing response never leak or automatically retry',async t=>{
  const timed=await setup(t,async()=>new Promise(()=>{}),{timeoutMs:5});await timed.phase.capture(input());assert.equal(timed.phase.report().api.failureCounts.TIMEOUT_OR_RESPONSE_BOUND,1);assert.equal(timed.calls(),1);
  const secret=await setup(t,async()=>reply({...answer(),extra:'unit-test-only'}));await secret.phase.capture(input());assert.equal(secret.phase.report().api.failureCounts.SECRET_IN_RESPONSE,1);assert(!readFileSync(join(secret.root,'isolated-1.receipt.json'),'utf8').includes('unit-test-only'));
});
test('OWNER_GATE UNKNOWN is a valid abstention, never converted to CONTINUE',async t=>{
  const {phase}=await setup(t,async()=>reply({...answer('UNKNOWN'),answers:{decision:{type:'choice',choice:'UNKNOWN',probabilities:{CONTINUE:0.1,ASK_OWNER:0.2,UNKNOWN:0.7}}}}));
  await phase.capture(input());await phase.action('isolated-1',action('ASK_OWNER',true));await phase.label('isolated-1',gold('ASK_OWNER'));
  const r=phase.report();assert.equal(r.owner.unknown,1);assert.equal(r.owner.falseContinue.count,0);assert.equal(r.owner.wouldHaveAvoidedInterruptions,0);assert.equal(r.actualWorkflowActionsByJev,0);
});
test('gold follows actual action; corrections append and original evidence remains',async t=>{
  const {phase,root}=await setup(t);await phase.capture(input());await phase.action('isolated-1',action());await phase.label('isolated-1',gold());
  const before=readFileSync(join(root,'isolated-1.gold-1.json'),'utf8');
  await assert.rejects(()=>phase.action('isolated-1',action()),/ACTION_ALREADY/);
  await assert.rejects(()=>phase.label('isolated-1',gold('ASK_OWNER')),/CORRECTION_REASON/);
  await phase.label('isolated-1',{...gold('ASK_OWNER'),correctionReason:'Later independent evidence corrects the isolated provisional interpretation.'});
  assert.equal(readFileSync(join(root,'isolated-1.gold-1.json'),'utf8'),before);assert.equal(phase.review('isolated-1').gold.supersedes,hash(JSON.parse(before)));
  await assert.rejects(()=>phase.label('isolated-1',{...gold('UNKNOWN'),correctionReason:'Review remains unresolved.'}),/UNRESOLVED/);
  const old=JSON.parse(before);old.goldBasis='Changed old evidence';writeFileSync(join(root,'isolated-1.gold-1.json'),JSON.stringify(old));assert.throws(()=>phase.report(),/GOLD_HISTORY_MISMATCH/);
});
test('case clocks cannot be backdated and modified input cannot rebind later results',async t=>{
  const fixed=await setup(t,undefined,{clock:()=> '2026-01-01T00:00:00.000Z'});await fixed.phase.capture(input());await assert.rejects(()=>fixed.phase.action('isolated-1',action()),/ACTION_MUST_FOLLOW/);
  const {phase,root}=await setup(t);await phase.capture(input());const path=join(root,'isolated-1.input.json'),record=JSON.parse(readFileSync(path));record.sanitizedState='Changed isolated state';writeFileSync(path,JSON.stringify(record));assert.throws(()=>phase.report(),/INPUT_RECEIPT_MISMATCH/);
});
test('Owner counterfactuals distinguish safe avoided interruptions from missed required decisions',()=>{
  const row=(n,actual,asked,predicted,goldLabel)=>({input:input(n),receipt:{result:{requestMade:true,httpStatus:200,servedModel:SERVED_MODEL,decision:predicted,latencyMs:n,usage:{inputTokens:10,outputTokens:1,costUsd:0.001}}},action:{actualCodexDecision:actual,ownerInterruptionMade:asked},gold:{goldLabel,verified:true}});
  const r=metrics([row(1,'ASK_OWNER',true,'CONTINUE','CONTINUE'),row(2,'ASK_OWNER',true,'CONTINUE','ASK_OWNER'),row(3,'CONTINUE',false,'ASK_OWNER','CONTINUE'),row(4,'CONTINUE',false,'ASK_OWNER','ASK_OWNER')]);
  assert.equal(r.owner.ownerInterruptionsActuallyMade,2);assert.equal(r.owner.wouldHaveAvoidedInterruptions,2);assert.equal(r.owner.verifiedUnnecessaryInterruptionsWouldAvoid,1);assert.equal(r.owner.verifiedRequiredInterruptionsWouldMiss,1);assert.equal(r.owner.wouldHaveAddedInterruptions,2);assert.equal(r.owner.verifiedUnnecessaryInterruptionsWouldAdd,1);
  assert.equal(r.owner.falseContinue.rate,0.5);assert.equal(r.owner.falseAskOwner.rate,0.5);assert.equal(r.disposition,null);
});
test('triage matrix, unresolved gold and failed requests stay separate; sufficient samples support p95',()=>{
  const rows=Array.from({length:30},(_,i)=>({input:input(i+1,'TRIAGE'),receipt:{result:{requestMade:true,httpStatus:200,servedModel:SERVED_MODEL,decision:i===0?'UNKNOWN':'TEST_ASSUMPTION',latencyMs:i+1,usage:{inputTokens:10,outputTokens:1,costUsd:0.001}}},gold:{goldLabel:'TEST_ASSUMPTION',verified:true}}));
  rows[1].gold={goldLabel:'UNKNOWN',verified:false};const r=metrics(rows);assert.equal(r.triage.evaluatedWithVerifiedGold,29);assert.equal(r.triage.confusionMatrix.TEST_ASSUMPTION.UNKNOWN,1);assert.equal(r.triage.unknown,1);assert.equal(r.triage.perClassAccuracy.CODE_REGRESSION.accuracy,null);assert.equal(r.api.p95SuccessfulLatencyMs,29);assert.equal(r.api.medianSuccessfulLatencyMs,15.5);
});
test('public request constructor contains only whitelisted pre-decision state',()=>{
  const request=prospectiveRequest({...input(),goldLabel:'LEAK_GOLD',verifiedOutcome:'LEAK_OUTCOME',actualCodexDecision:'LEAK_ACTION'});
  assert(!JSON.stringify(request).includes('LEAK'));assert.throws(()=>prospectiveRequest(input(1,'DOCUMENTATION')));
});
