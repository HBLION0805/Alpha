import nodeTest,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {TECH36_POOL,prepareTechResearchInputs,appendTechEventReview,readTechEventReviews} from './lib/options-tech-candidate.mjs';
import {projectTechCandidateTrace} from './lib/options-tech-candidate-trace.mjs';
import {projectTechCandidatePlanHandoff,prepareTechCandidatePlanHandoff} from './lib/options-tech-candidate-plan-handoff.mjs';
import {mockSpreadPlanFixture,simulatedAccountSpreadFixture} from './lib/options-tech-spread-plan-fixtures.mjs';
import {ASSISTANT_FACT_POLICY} from './lib/options-tech-assistant-fact-policy.mjs';
import {spreadPlanHash} from './lib/options-tech-spread-plan-binding.mjs';
import {prepareTechSpreadInput} from './lib/options-tech-spread-preparation.mjs';
import {techSpreadPlanCli} from './options-tech-spread-plan.mjs';
import {projectTechCandidateHandoffView,projectSavedTechCandidatePlans} from './lib/options-tech-candidate-handoff-view.mjs';
import {techCandidateHandoffPanel} from '../apps/options-workbench/tech-candidate-handoff.js';
import {techCandidateTracePanel} from '../apps/options-workbench/tech-candidate-trace.js';
import {startTechSpreadPlan} from './lib/options-tech-spread-plan.mjs';
import {mockSpreadEventFromOriginal} from './lib/options-tech-spread-plan-binding.mjs';
import {appendMockSpread,recoverMockSpread,startMockSpread} from './lib/options-tech-mock-spread.mjs';
import {boundSpreadPlanHash} from './lib/options-tech-spread-plan-binding.mjs';
import {startOptionsWorkbench} from './options-workbench.mjs';
import {readTechStatus} from './lib/options-tech-status.mjs';

let total=0,passed=0;const test=(name,fn)=>{total++;nodeTest(name,async()=>{await fn();passed++;});};
after(()=>console.log(`Candidate plan handoff: ${passed}/${total} tests passed.`));

const at='2026-10-09T15:30:20.000Z';
function view(){
 const ranking=TECH36_POOL.map((symbol,i)=>({symbol,category:i===0?'SELECTED':'MISSING_DATA',coreScore:i===0?7:null,valuation:null,eventId:i===0?'fixture-event':null}));
 return {version:'TECH36_EVENT_REVIEW_VIEW_V1',runId:'fixture-research',scanId:'alpha-tech36-fixture',baseReceiptSha256:'a'.repeat(64),headSha256:'b'.repeat(64),recordedAt:'2026-10-09T14:14:00.000Z',mode:'SYNTHETIC_FIXTURE',ranking,
  inputs:{scanId:'alpha-tech36-fixture',sourceCutoff:'2026-10-09T14:00:00.000Z',companies:ranking.map(r=>({symbol:r.symbol,inheritedRanking:structuredClone(r)})),eventInputs:[{symbol:'AAPL',eventId:'fixture-event',documentIds:['fixture-doc'],coverageStatus:'ATTRIBUTED_VERIFIED_SCOPE',issues:[],researchInput:{status:'CITED_MATERIAL_READY_FOR_REVIEW',fundamental:{direction:'UNKNOWN'},news:{direction:'UNKNOWN'},technical:{status:'NOT_ASSESSED'},consensusSurprise:{status:'UNKNOWN'},holdingWindow:null,optionExpiry:null,trialCondition:null,confirmationCondition:null,invalidationCondition:null}}],documents:[{id:'fixture-doc',eventId:'fixture-event',symbols:['AAPL'],sha256:'c'.repeat(64),status:'BODY_TEXT_EXTRACTED',blocks:[],publishedAt:null,receivedAt:'2026-10-09T13:59:00.000Z',filingAcceptedAt:null}]}};
}
function edit(input,kind,fn){const r=input.records.find(r=>r.kind===kind),p=JSON.parse(r.rawJson);fn(p);r.rawJson=JSON.stringify(p);r.sha256=spreadPlanHash(r.rawJson);if(kind==='RESEARCH')edit(input,'STRATEGY_REQUEST',p=>p.researchSha256=r.sha256);}
async function fixture(structure){
 const {input}=await mockSpreadPlanFixture(structure),v=view(),t=projectTechCandidateTrace(v,{at}).traces[0];
 const b={version:'TECH36_PLAN_RESEARCH_BINDING_V1',runId:v.runId,scanId:v.scanId,baseReceiptSha256:v.baseReceiptSha256,reviewHeadSha256:v.headSha256,traceId:t.traceId,researchRecordId:t.research.recordId,eventRef:t.eventRef};
 edit(input,'RESEARCH',p=>p.researchPlan.candidateResearchBinding=b);edit(input,'STRATEGY_REQUEST',p=>p.parentIds.push(t.traceId,t.research.recordId));return {v,input,b};
}
const preview=f=>projectTechCandidatePlanHandoff(f.v,f.input,{at});
// A real saved/replayed source chain, containing synthetic data only. No mocked reader.
async function savedStartFixture(root){
 const f=await assistantFixture(),source=join(root,'source'),runId='fixture-research';
 const put=(path,value)=>{const p=join(root,path);fs.mkdirSync(join(p,'..'),{recursive:true});const text=typeof value==='string'?value:JSON.stringify(value);fs.writeFileSync(p,text);return spreadPlanHash(text);};
 const policy={version:'ALPHA_TECH36_DISCOVERY_V1.1',scanId:'alpha-tech36-fixture',pool:[...TECH36_POOL],frozenAt:'2026-10-09T12:00:00Z',cutoffAt:'2026-10-09T14:00:00Z',lookbackStart:'2026-10-01T12:00:00Z'};
 put('source/policy.sha256',put('source/policy.json',policy));
 put('source/events.json',[{eventId:'fixture-event',symbols:['AAPL']}]);
 const bodySha=put('source/body.html','<html><body><p>Synthetic AAPL reviewed material only.</p></body></html>');
 const receipt={eventId:'fixture-event',symbol:'AAPL',sourceId:'SEC_SUBMISSIONS',status:'SUCCESS',attempted:true,rawPath:'body.html',sha256:bodySha,url:'https://example.test/fixture',startedAt:'2026-10-09T13:00:00Z',receivedAt:'2026-10-09T13:00:01Z'};
 put('source/http-receipts.json',[receipt]);put('source/originals.json',[receipt]);
 fs.mkdirSync(join(root,'data/runtime/options-workbench-development'),{recursive:true});
 prepareTechResearchInputs({root,sourceRoot:source,runId,now:()=> '2026-10-09T14:13:00Z'});
 const append=(id,clock)=>{
  const v=readTechEventReviews({root,runId,now:()=>clock});
  put('review.json',{version:'TECH36_EVENT_REVIEW_REQUEST_V1',requestId:id,parent:{scanId:v.scanId,baseReceiptSha256:v.baseReceiptSha256,revisionSha256:v.headSha256},symbol:'AAPL',eventId:'fixture-event',mode:'SYNTHETIC_FIXTURE',evidence:[],links:[],review:{originalVerified:true,companyEventVerified:true,materialityReviewed:true,materialConflict:false,dimensions:{impact:3,catalyst:2,evidence:3,valuation:null},fact:'Synthetic fact',analysis:'Synthetic review',nextEvidence:'Independent later evidence',eventWindow:null,citations:[{sha256:bodySha,blockIndex:0}]}});
  appendTechEventReview({root,runId,requestPath:join(root,'review.json'),now:()=>clock});
 };
 append('fixture-review','2026-10-09T14:14:00Z');
 const v=readTechEventReviews({root,runId,now:()=>at}),t=projectTechCandidateTrace(v,{at}).traces[0];
 edit(f.input,'RESEARCH',p=>p.researchPlan.candidateResearchBinding={version:'TECH36_PLAN_RESEARCH_BINDING_V1',runId,scanId:v.scanId,baseReceiptSha256:v.baseReceiptSha256,reviewHeadSha256:v.headSha256,traceId:t.traceId,researchRecordId:t.research.recordId,eventRef:t.eventRef});
 edit(f.input,'STRATEGY_REQUEST',p=>p.parentIds.push(t.traceId,t.research.recordId));
 const original=f.input.originals[0];put('quote.json',original.rawJson);
 const save=()=>put('input.json',{...f.input,originals:f.input.originals.map(o=>({id:o.id,path:'quote.json',sha256:o.sha256}))});
 const start=()=>techSpreadPlanCli(['--start','input.json','--run-id','paper-sim-fixture-account'],{root,now:()=>at});
 return {...f,save,start,append,put};
}
function fileSnapshot(root){return fs.readdirSync(root,{recursive:true,withFileTypes:true}).map(e=>{const p=join(e.parentPath,e.name);return [p,e.isDirectory()?'DIRECTORY':spreadPlanHash(fs.readFileSync(p,'utf8'))];}).sort((a,b)=>a[0].localeCompare(b[0]));}
async function withSavedStart(fn){const root=fs.mkdtempSync(join(tmpdir(),'alpha-handoff-start-'));try{await fn(root,await savedStartFixture(root));}finally{assert(resolve(root).startsWith(resolve(tmpdir())+sep));fs.rmSync(root,{recursive:true});}}
test('CLI start verifies the saved V3 candidate then saves a fixture plan without entry',()=>withSavedStart((root,f)=>{
 f.save();const p=f.start();assert.equal(p.status,'REAL_QUOTE_PAPER_PLAN_READY',JSON.stringify(p.checks));assert.equal(p.testFixtureOnly,true);assert.equal(p.entryAutomaticallyAppended,false);
 assert.equal(p.candidateHandoff.status,'BOUND_PREVIEW_ONLY');assert.equal(p.candidateHandoff.sourceVerification,'SAVED_ORIGINAL_AND_REVIEW_REPLAY');assert.equal(p.candidateHandoff.selectedCandidate.binding.runId,'fixture-research');
 const recovered=recoverMockSpread({root,runId:'paper-sim-fixture-account',asOf:f.input.at});assert.equal(recovered.events.length,0);assert.equal(recovered.report.orders.length,0);assert.equal(recovered.report.status,'NO_ENTRY');
}));
test('CLI start rejects a superseded saved review head without any write',()=>withSavedStart((root,f)=>{
 f.save();f.append('fixture-second-review','2026-10-09T14:14:01Z');const before=fileSnapshot(root),r=f.start();assert.equal(r.status,'BLOCKED');assert(r.checks.some(c=>/CANDIDATE_NOT_SELECTED_OR_STALE|EXACT_REVIEW_BINDING/.test(c.code)));assert.deepEqual(fileSnapshot(root),before);
}));
for(const [label,change] of [
 ['missing contract',f=>f.input.records=f.input.records.filter(r=>r.kind!=='CONTRACT')],
 ['unreviewed research',f=>f.input.records.find(r=>r.kind==='RESEARCH').verdict='UNKNOWN'],
 ['missing quote',f=>f.input.originals=[]],
 ['wrong source hash',f=>f.input.records.find(r=>r.kind==='RESEARCH').sha256='0'.repeat(64)],
 ['missing research run',f=>edit(f.input,'RESEARCH',p=>p.researchPlan.candidateResearchBinding.runId='missing-run')],
 ['null declared binding',f=>edit(f.input,'RESEARCH',p=>p.researchPlan.candidateResearchBinding=null)],
 ['unsafe research run',f=>edit(f.input,'RESEARCH',p=>p.researchPlan.candidateResearchBinding.runId='../other')],
])test('CLI bound start '+label+' leaves all files unchanged',()=>withSavedStart((root,f)=>{
 change(f);f.save();const before=fileSnapshot(root);let r;try{r=f.start();}catch(e){assert.match(e.message,/SPREAD_PLAN_ORIGINAL_COUNT|CANDIDATE_HANDOFF_RUN_ID/);}if(r){assert(['BLOCKED','BOUND_ENGINE_BLOCKED'].includes(r.status));assert.equal(r.planSaved,false);}assert.deepEqual(fileSnapshot(root),before);
}));
test('CLI start retains the unbound V3 plan-only entry and rejects malformed research without writing',()=>withSavedStart((root,f)=>{
 edit(f.input,'RESEARCH',p=>delete p.researchPlan.candidateResearchBinding);f.save();const r=f.start();assert.equal(r.status,'REAL_QUOTE_PAPER_PLAN_READY');assert.equal(r.candidateHandoff,undefined);assert.equal(r.entryAutomaticallyAppended,false);assert.equal(recoverMockSpread({root,runId:'paper-sim-fixture-account',asOf:f.input.at}).events.length,0);
 f.input.records.find(r=>r.kind==='RESEARCH').rawJson='{';f.save();const before=fileSnapshot(root);assert.equal(f.start().status,'BLOCKED');assert.deepEqual(fileSnapshot(root),before);
}));
const webStatus=root=>readTechStatus({root,at:new Date().toISOString()});
const savedLinks=s=>s.researchDetails.traceScans[0].planHandoff.savedPlans;
test('web exact saved candidate links the verified plan and same independent Paper lifecycle without writes',()=>withSavedStart((root,f)=>{
 f.save();const p=f.start(),before=fileSnapshot(root),s=webStatus(root),links=savedLinks(s),link=links.plans[0];
 assert.equal(links.state,'EXACT_SAVED_PLAN');assert.equal(link.linkStatus,'EXACT_CURRENT_REVIEW');assert.equal(link.context,'TEST_FIXTURE_SIMULATED_ACCOUNT');assert.equal(link.planRef,p.plan.provenance.planSha256);assert.equal(link.planRef,s.records[0].planRef);assert.equal(link.journalRef,s.records[0].sourceRef);assert.equal(link.declaredBinding.traceId,p.candidateHandoff.selectedCandidate.binding.traceId);assert.equal(link.paperStatus,'NO_ENTRY');assert.equal(link.modeledOrderCount,0);assert.deepEqual(fileSnapshot(root),before);
 appendMockSpread({root,runId:'paper-sim-fixture-account',event:p.entryEvent});assert.equal(savedLinks(webStatus(root)).plans[0].paperStatus,'OPEN_UNRESOLVED');
 const event=mockSpreadEventFromOriginal({plan:p.plan,original:f.exitOriginal,id:'paper-web-independent-exit',at:f.exitAt});appendMockSpread({root,runId:'paper-sim-fixture-account',event});
 const closedBefore=fileSnapshot(root),closed=webStatus(root),last=savedLinks(closed).plans[0];assert.equal(last.paperStatus,'CLOSED_MODELED');assert.equal(last.modeledOrderCount,2);assert.equal(last.journalTipRef,closed.records[0].journalTipRef);assert.notEqual(last.journalTipRef,link.journalTipRef);assert.equal(last.currentAdmission,'NOT_EVALUATED');assert.equal(last.realAcceptance,'NOT_TESTED');assert.deepEqual(fileSnapshot(root),closedBefore);
 const json=JSON.stringify(closed.researchDetails),html=techCandidateHandoffPanel(closed.researchDetails.traceScans[0].planHandoff);assert(!/"(?:rawJson|factSources|accountId|settledCashCents)":/.test(JSON.stringify(savedLinks(closed))));assert(!/paper-sim-fixture-account|Synthetic AAPL reviewed material/.test(json));assert(html.includes('精确关联 · 当前审核版本'));assert(html.includes('CLOSED_MODELED'));assert(html.includes('TEST_FIXTURE_SIMULATED_ACCOUNT'));assert(!/<form|<button|<input/.test(html));
}));
test('web old review head retains a historical plan but never associates it to the new candidate',()=>withSavedStart((root,f)=>{
 f.save();f.start();f.append('fixture-later-head','2026-10-09T14:14:01Z');const before=fileSnapshot(root),s=webStatus(root),links=savedLinks(s);assert.equal(links.state,'NO_CURRENT_MATCH');assert.equal(links.plans[0].linkStatus,'STALE_REVIEW');assert.equal(links.plans[0].matchedResearch,null);assert.equal(links.plans[0].paperStatus,'NO_ENTRY');assert.deepEqual(fileSnapshot(root),before);assert(techCandidateHandoffPanel(s.researchDetails.traceScans[0].planHandoff).includes('旧审核头 · 不关联当前候选'));
}));
for(const key of ['scanId','baseReceiptSha256','traceId','researchRecordId','eventRef'])test('web same ticker cannot rescue mismatched '+key,()=>withSavedStart((root,f)=>{
 edit(f.input,'RESEARCH',p=>p.researchPlan.candidateResearchBinding[key]='a'.repeat(64));const p=startTechSpreadPlan({root,runId:'paper-sim-fixture-account',input:f.input});assert.equal(p.status,'REAL_QUOTE_PAPER_PLAN_READY');const before=fileSnapshot(root),links=savedLinks(webStatus(root));assert.equal(links.state,'NO_CURRENT_MATCH');assert.equal(links.plans[0].linkStatus,'BINDING_REJECTED');assert.equal(links.plans[0].matchedResearch,null);assert.deepEqual(fileSnapshot(root),before);
}));
test('web no saved plan and unrelated research run stay explicitly missing without ticker fallback',()=>withSavedStart((root,f)=>{
 assert.equal(savedLinks(webStatus(root)).state,'NO_EXACT_SAVED_PLAN');edit(f.input,'RESEARCH',p=>p.researchPlan.candidateResearchBinding.runId='other-research-run');startTechSpreadPlan({root,runId:'paper-sim-fixture-account',input:f.input});const s=webStatus(root);assert.equal(s.records.length,1);assert.equal(savedLinks(s).state,'NO_EXACT_SAVED_PLAN');assert.equal(savedLinks(s).plans.length,0);
}));
test('web corrupt journal drops prior success and reports unresolved inventory without attributing corrupt bytes',()=>withSavedStart((root,f)=>{
 f.save();f.start();assert.equal(savedLinks(webStatus(root)).state,'EXACT_SAVED_PLAN');f.put('data/runtime/options-workbench-development/paper-sim-fixture-account/start.json','{"private":"DO_NOT_DISPLAY"');const before=fileSnapshot(root),s=webStatus(root);assert.equal(s.state,'PARTIAL');assert.equal(savedLinks(s).state,'UNRESOLVED_INVENTORY');assert.equal(savedLinks(s).plans.length,0);assert(!JSON.stringify(s).includes('DO_NOT_DISPLAY'));assert.deepEqual(fileSnapshot(root),before);
}));
test('web fixture plan cannot borrow a real saved review context',()=>withSavedStart((root,f)=>{
 f.save();const p=f.start(),s=webStatus(root),v=readTechEventReviews({root,runId:'fixture-research',now:()=>at});v.mode='SAVED_SOURCE_REVIEW';const links=projectSavedTechCandidatePlans(v,{at,savedPlans:[{plan:p.plan,receipt:s.records[0]}],inventoryState:'AVAILABLE'});assert.equal(links.state,'NO_CURRENT_MATCH');assert.equal(links.plans[0].linkStatus,'CONTEXT_MISMATCH');assert.equal(links.plans[0].context,'TEST_FIXTURE_SIMULATED_ACCOUNT');assert.equal(links.plans[0].matchedResearch,null);
}));
test('web hash-valid saved WAIT research remains engine-blocked rather than becoming a qualified plan',()=>withSavedStart((root,f)=>{
 f.save();const p=prepareTechSpreadInput(f.input);assert.equal(p.enginePreview.status,'REAL_QUOTE_PAPER_PLAN_READY');
 const ready=startTechSpreadPlan({root:fs.mkdtempSync(join(root,'isolated-')),runId:'paper-sim-fixture-account',input:f.input}).plan;
 const record=ready.provenance.records.find(r=>r.kind==='RESEARCH'),research=JSON.parse(record.rawJson);research.fundamental.direction='UNKNOWN';record.rawJson=JSON.stringify(research);record.sha256=spreadPlanHash(record.rawJson);ready.research=research;ready.provenance.researchSha256=record.sha256;
 const request=ready.provenance.records.find(r=>r.kind==='STRATEGY_REQUEST'),body=JSON.parse(request.rawJson);body.researchSha256=record.sha256;request.rawJson=JSON.stringify(body);request.sha256=spreadPlanHash(request.rawJson);ready.provenance.planSha256=boundSpreadPlanHash(ready);
 startMockSpread({root,runId:'paper-sim-fixture-account',input:ready});const before=fileSnapshot(root),s=webStatus(root),link=savedLinks(s).plans[0];assert.equal(link.linkStatus,'EXACT_BINDING_ENGINE_BLOCKED');assert.equal(link.engine.status,'BLOCKED');assert.notEqual(link.trialStatus,'PRE_CONFIRMATION_RESEARCH_CANDIDATE');assert.equal(link.confirmationStatus,'WAIT');assert.equal(link.paperStatus,'NO_ENTRY');assert.deepEqual(fileSnapshot(root),before);
}));
test('existing HTTP endpoints publish only the safe exact plan association',()=>withSavedStart(async(root,f)=>{
 f.save();f.start();const app=await startOptionsWorkbench({workspaceRoot:root,port:0,refreshContext:false});try{const before=fileSnapshot(root),s=await(await fetch(app.url+'/api/tech-status')).json(),state=await(await fetch(app.url+'/api/state')).json();assert.equal(savedLinks(s).state,'EXACT_SAVED_PLAN');assert.equal(savedLinks(state.techResearch).plans[0].planRef,savedLinks(s).plans[0].planRef);assert(!/"(?:rawJson|accountId|factSources)":/.test(JSON.stringify(savedLinks(s))));assert(!JSON.stringify(s.researchDetails).includes("paper-sim-fixture-account"));assert.deepEqual(fileSnapshot(root),before);}finally{await app.close();}
}));
async function assistantFixture(structure){
 const f=await simulatedAccountSpreadFixture(structure),v=view(),t=projectTechCandidateTrace(v,{at}).traces[0];
 f.v=v;f.input.version='TECH_SPREAD_PLAN_INPUT_V3';f.input.researchPolicy=ASSISTANT_FACT_POLICY;
 edit(f.input,'RESEARCH',p=>{
  p.version='THREE_FACET_INPUT_V2';
  p.researchPlan.candidateResearchBinding={version:'TECH36_PLAN_RESEARCH_BINDING_V1',runId:v.runId,scanId:v.scanId,baseReceiptSha256:v.baseReceiptSha256,reviewHeadSha256:v.headSha256,traceId:t.traceId,researchRecordId:t.research.recordId,eventRef:t.eventRef};
  const receipt={version:'SAVED_WEB_RESEARCH_RECEIPT_V1',requestedAt:'2026-10-09T12:59:59Z',receivedAt:'2026-10-09T13:00:01Z',clockBasis:'LOCAL_TOOL_RETURN_OBSERVED_NOT_PROVIDER_HTTP',result:'Fixture source (https://example.test/facts)\nFixture attributed revenue and outlook, not real evidence.'},rawJson=JSON.stringify(receipt),facts=[];
  for(const e of [...p.fundamental.evidence,...p.news.evidence]){e.source='https://example.test/facts';e.publishedAt=null;e.receivedAt=receipt.receivedAt;e.factId=e.id;facts.push({id:e.id,originalId:'fixture-source',source:e.source,quotedText:'Fixture attributed revenue and outlook, not real evidence.',extractedBy:'ASSISTANT',attribution:'PUBLISHER_CLAIM',purpose:'ORDINARY_FACT',availableNoLaterThan:receipt.receivedAt,publication:{precision:'UNKNOWN'}});}
  p.factSources={version:ASSISTANT_FACT_POLICY,context:f.input.evidenceContext,accountId:'paper-sim-fixture-account',originals:[{id:'fixture-source',origin:'SYNTHETIC_FIXTURE',rawJson,sha256:spreadPlanHash(rawJson)}],facts};
 });
 f.input.records.find(r=>r.kind==='RESEARCH').origin='ASSISTANT_RESEARCH';f.input.records.find(r=>r.kind==='STRATEGY_REQUEST').origin='SYSTEM_PAPER_REQUEST';
 edit(f.input,'STRATEGY_REQUEST',p=>{p.researchPolicy=ASSISTANT_FACT_POLICY;p.parentIds.push(t.traceId,t.research.recordId);});return f;
}
for(const structure of ['BULL_CALL_DEBIT','BEAR_PUT_DEBIT'])test('V3 '+structure+' exact candidate uses the same existing assistant policy as direct preparation',async()=>{
 const f=await assistantFixture(structure),before=JSON.stringify(f.input),direct=prepareTechSpreadInput(f.input);
 assert.equal(direct.enginePreview.status,'REAL_QUOTE_PAPER_PLAN_READY');
 const r=preview(f);assert.equal(r.status,'BOUND_PREVIEW_ONLY',JSON.stringify(r.checks));assert.deepEqual(r.preparation,direct);assert.equal(JSON.stringify(f.input),before);assert.equal(r.planSaved,false);assert.equal(r.fills,0);
});
for(const version of ['TECH_SPREAD_PLAN_INPUT_V1','TECH_SPREAD_PLAN_INPUT_V2'])test(version+' candidate route still rejects assistant origins',async()=>{const f=await assistantFixture();f.input.version=version;blocked(preview(f),'CANDIDATE_HANDOFF_RECORD_ORIGIN');});
test('V3 policy must be explicit and restricted to the existing simulated scope',async()=>{
 for(const change of [f=>delete f.input.researchPolicy,f=>f.input.evidenceContext='TEST_FIXTURE',f=>f.input.mode='MOCK_CONTROL']){const f=await assistantFixture();change(f);const r=preview(f);assert.equal(r.status,'BLOCKED');assert.equal(r.preparation,null);}
});
test('V3 candidate source context and exact head are still required',async()=>{
 let f=await assistantFixture();f.v.mode='SAVED_SOURCE_REVIEW';blocked(preview(f),'CANDIDATE_HANDOFF_FIXTURE_CONTEXT');
 f=await assistantFixture();edit(f.input,'RESEARCH',p=>p.researchPlan.candidateResearchBinding.reviewHeadSha256='f'.repeat(64));blocked(preview(f),'CANDIDATE_HANDOFF_EXACT_REVIEW_BINDING');
 f=await assistantFixture();f.v.ranking[0].category=f.v.inputs.companies[0].inheritedRanking.category='REJECTED';blocked(preview(f),'CANDIDATE_HANDOFF_NO_SELECTED_CANDIDATE');
});
test('V3 candidate still rejects future research and UNKNOWN envelope verdict',async()=>{
 let f=await assistantFixture();f.input.records.find(r=>r.kind==='RESEARCH').reviewedAt='2026-10-09T14:16:00.000000001Z';blocked(preview(f),'CANDIDATE_HANDOFF_ENVELOPE_AFTER_PARENT');
 f=await assistantFixture();f.input.records.find(r=>r.kind==='RESEARCH').verdict='UNKNOWN';blocked(preview(f),'CANDIDATE_HANDOFF_EVIDENCE_CLOCKS');
});
test('V3 forged original and source attribution fail before preparation',async()=>{
 for(const change of [p=>p.factSources.originals[0].rawJson+=' ',p=>p.factSources.facts[0].source='https://other.example/facts']){const f=await assistantFixture();edit(f.input,'RESEARCH',change);const r=preview(f);assert.equal(r.status,'BLOCKED');assert.equal(r.preparation,null);}
});
test('V3 handoff preserves WAIT, missing contract, quote and exact-event blockers',async()=>{
 for(const change of [f=>edit(f.input,'RESEARCH',p=>p.fundamental.direction='UNKNOWN'),f=>f.input.records=f.input.records.filter(r=>r.kind!=='CONTRACT'),f=>f.input.originals=[],f=>edit(f.input,'RESEARCH',p=>p.factSources.facts[0].purpose='EXACT_EVENT')]){
  const f=await assistantFixture();change(f);const direct=prepareTechSpreadInput(f.input),r=preview(f);assert.equal(direct.enginePreview.status,'BLOCKED');assert.equal(r.status,'BOUND_ENGINE_BLOCKED');assert.deepEqual(r.preparation,direct);assert.equal(r.planSaved,false);assert.equal(r.fills,0);
 }
});
test('V3 research uses the existing 262144 character envelope bound, legacy and request bounds stay unchanged',async()=>{
 const f=await assistantFixture(),r=f.input.records.find(r=>r.kind==='RESEARCH');r.rawJson=r.rawJson.padEnd(262144,' ');r.sha256=spreadPlanHash(r.rawJson);edit(f.input,'STRATEGY_REQUEST',p=>p.researchSha256=r.sha256);
 assert.equal(prepareTechSpreadInput(f.input).enginePreview.status,'REAL_QUOTE_PAPER_PLAN_READY');assert.equal(preview(f).status,'BOUND_PREVIEW_ONLY');
 r.rawJson+=' ';r.sha256=spreadPlanHash(r.rawJson);edit(f.input,'STRATEGY_REQUEST',p=>p.researchSha256=r.sha256);blocked(preview(f),'CANDIDATE_HANDOFF_RESEARCH_HASH');
 const old=await fixture(),o=old.input.records.find(r=>r.kind==='RESEARCH');o.rawJson=o.rawJson.padEnd(65537,' ');o.sha256=spreadPlanHash(o.rawJson);edit(old.input,'STRATEGY_REQUEST',p=>p.researchSha256=o.sha256);blocked(preview(old),'CANDIDATE_HANDOFF_RESEARCH_HASH');
 const q=await assistantFixture(),request=q.input.records.find(r=>r.kind==='STRATEGY_REQUEST');request.rawJson=request.rawJson.padEnd(65537,' ');request.sha256=spreadPlanHash(request.rawJson);blocked(preview(q),'CANDIDATE_HANDOFF_STRATEGY_REQUEST_HASH');
});
test('V3 bound fixture saves unchanged plan, retains missing exit, and website reader replays the same later closure',async()=>{
 const root=fs.mkdtempSync(join(tmpdir(),'alpha-handoff-lifecycle-'));
 try{
  const f=await assistantFixture(),runId='paper-sim-fixture-account';assert.equal(preview(f).status,'BOUND_PREVIEW_ONLY');
  const p=startTechSpreadPlan({root,runId,input:f.input});assert.equal(p.status,'REAL_QUOTE_PAPER_PLAN_READY');assert.equal(p.testFixtureOnly,true);assert.equal(p.entryAutomaticallyAppended,false);
  assert.equal(recoverMockSpread({root,runId,asOf:f.input.at}).report.status,'NO_ENTRY');
  assert.equal(appendMockSpread({root,runId,event:p.entryEvent}).status,'OPEN_UNRESOLVED');
  const pending=recoverMockSpread({root,runId,asOf:f.exitAt}).report;assert.equal(pending.status,'OPEN_UNRESOLVED');assert.equal(pending.position.pendingExit,'TIME_EXIT');assert.equal(pending.account.netPnlCents,null);
  const event=mockSpreadEventFromOriginal({plan:p.plan,original:f.exitOriginal,id:'paper-fixture-independent-exit',at:f.exitAt}),closed=appendMockSpread({root,runId,event});assert.equal(closed.status,'CLOSED_MODELED');assert.equal(closed.orders.length,2);assert.equal(closed.account.unsettledAvailableForEntry,false);assert(closed.account.unsettledProceedsCents>0);
  assert.deepEqual(recoverMockSpread({root,runId,asOf:f.exitAt}).report,closed);
  const path=join(root,'data/runtime/options-workbench-development',runId),snapshot=()=>fs.readdirSync(path).sort().map(n=>[n,spreadPlanHash(fs.readFileSync(join(path,n),'utf8'))]),before=snapshot();
  const web=readTechStatus({root,at:new Date().toISOString()});assert.equal(web.state,'AVAILABLE');assert.equal(web.records.length,1);assert.equal(web.records[0].paperStatus,closed.status);assert.equal(web.records[0].modeledOrderCount,closed.orders.length);assert.equal(web.records[0].evidenceContext,'TEST_FIXTURE_SIMULATED_ACCOUNT');assert.equal(web.records[0].authority,'VERIFIED_JOURNAL_REPLAY_NOT_SOURCE_AUTHENTICATION');assert.equal(web.records[0].realAcceptance,'NOT_TESTED');assert.equal(web.fileSystemWrites,0);assert.deepEqual(snapshot(),before);
 }finally{assert(resolve(root).startsWith(resolve(tmpdir())+sep));fs.rmSync(root,{recursive:true});}
});
test('web missing input retains exact original bindings and separate assessment clock',()=>{const v=view(),before=JSON.stringify(v),r=projectTechCandidateHandoffView(v,{at});assert.equal(r.status,'BLOCKED');assert.equal(r.assessedAt,at);assert.equal(r.candidates[0].reviewRecordedAt,v.recordedAt);assert.equal(r.candidates[0].binding.reviewHeadSha256,v.headSha256);assert.equal(r.candidates[0].binding.runId,v.runId);assert.equal(r.checks[0].code,'CANDIDATE_HANDOFF_RESEARCH_MISSING_OR_DUPLICATE');assert.equal(r.engine,null);assert.equal(r.matchedResearch,null);assert.equal(r.inputScope,'THIS_REVIEW_ONLY_NO_BOUND_PLAN_INPUT_CHANNEL');assert.equal(JSON.stringify(v),before);});
for(const structure of ['BULL_CALL_DEBIT','BEAR_PUT_DEBIT'])test('web complete isolated '+structure+' stays fixture preview with zero fills',async()=>{const f=await fixture(structure),r=projectTechCandidateHandoffView(f.v,{at,input:f.input});assert.equal(r.status,'BOUND_PREVIEW_ONLY');assert.equal(r.context,'TEST_FIXTURE');assert.equal(r.engine.status,preview(f).preparation.enginePreview.status);assert.equal(r.paperAdmissionAllowed,false);assert.equal(r.planSaved,false);assert.equal(r.fills,0);assert.equal(r.pnl,null);const html=techCandidateHandoffPanel(r);assert(html.includes('隔离显式输入检查'));assert(html.includes('Paper NOT_RUN'));});
test('web stale review rejects without symbol fallback or displaying a matched record',async()=>{const f=await fixture();edit(f.input,'RESEARCH',p=>p.researchPlan.candidateResearchBinding.reviewHeadSha256='f'.repeat(64));const r=projectTechCandidateHandoffView(f.v,{at,input:f.input});assert.equal(r.status,'BLOCKED');assert.equal(r.checks[0].code,'CANDIDATE_HANDOFF_EXACT_REVIEW_BINDING');assert.equal(r.matchedResearch,null);assert(techCandidateHandoffPanel(r).includes('审核版本不一致'));});
test('web real saved review does not gain fixture success or raw original data',()=>{const v=view();v.mode='SAVED_SOURCE_REVIEW';v.inputs.documents[0].blocks=[{text:'PRIVATE_BODY'}];const r=projectTechCandidateHandoffView(v,{at});assert.equal(r.context,'SAVED_REVIEW_REPLAY_NOT_CURRENT_MARKET');assert.equal(r.status,'BLOCKED');assert(!JSON.stringify(r).includes('PRIVATE_BODY'));assert.equal(r.sourceCalls,0);assert.equal(r.fileSystemWrites,0);});
test('web fixture/real mismatch remains rejected by unchanged handoff engine',async()=>{const f=await fixture();f.v.mode='SAVED_SOURCE_REVIEW';const r=projectTechCandidateHandoffView(f.v,{at,input:f.input});assert.equal(r.status,'BLOCKED');assert(r.checks.some(c=>c.code==='CANDIDATE_HANDOFF_FIXTURE_CONTEXT'));assert.equal(r.engine,null);});
test('web allowlist excludes research prose account payloads and raw envelope fields',async()=>{const f=await fixture();edit(f.input,'RESEARCH',p=>{p.privateExtra='PRIVATE_SECRET';p.researchPlan.id='C:/private/secret';});edit(f.input,'STRATEGY_REQUEST',p=>p.researchId='C:/private/secret');const r=projectTechCandidateHandoffView(f.v,{at,input:f.input});assert.equal(r.status,'BOUND_PREVIEW_ONLY');assert.equal(r.matchedResearch.declaredResearchId,null);assert(!/PRIVATE_SECRET|C:\//.test(JSON.stringify(r)));});
test('web panel escapes all dynamic values and provides no forms actions or sources',()=>{const r=projectTechCandidateHandoffView(view(),{at});r.candidates[0].binding.runId='<img src=x onerror=alert(1)>';const html=techCandidateHandoffPanel(r);assert(html.includes('&lt;img'));assert(!/<img|<script|<form|<button|<input|href=/.test(html));assert(html.includes('NOT_RUN（交接检查先停止）'));assert(html.includes('不是新的研究、决策或报价时间'));});
test('existing trace panel includes the handoff alongside original research and course assessment',()=>{const v=view(),s=projectTechCandidateTrace(v,{at});s.planHandoff=projectTechCandidateHandoffView(v,{at});const html=techCandidateTracePanel([s]);assert.equal(html.split('候选 → 方案交接诊断').length-1,1);assert(html.includes(s.planHandoff.candidates[0].binding.researchRecordId));assert(html.includes('原文研究'));assert(html.includes('CANDIDATE_HANDOFF_RESEARCH_MISSING_OR_DUPLICATE'));});
test('unavailable web result remains explicitly unrun rather than successful',()=>{assert(techCandidateHandoffPanel(null).includes('诊断未运行'));});
function blocked(r,code){assert.equal(r.status,'BLOCKED');assert(r.checks.some(c=>c.code===code));assert.equal(r.preparation,null);assert.equal(r.planSaved,false);assert.equal(r.paperAdmissionAllowed,false);}
for(const structure of ['BULL_CALL_DEBIT','BEAR_PUT_DEBIT'])test(structure+' exact fixture binding calls unchanged engine without fills',async()=>{const f=await fixture(structure),before=JSON.stringify(f),r=preview(f);assert.equal(r.status,'BOUND_PREVIEW_ONLY');assert.equal(r.preparation.enginePreview.status,'MOCK_PLAN_READY');assert.deepEqual(r.preparation,prepareTechSpreadInput(f.input));assert.equal(JSON.stringify(f),before);assert.equal(r.fills,0);assert.equal(r.pnl,null);assert.equal(r.executionAllowed,false);assert.equal(r.sourceVerification,'CALLER_SUPPLIED_VIEW');assert.equal(r.candidateBindings[0].courseAssessment.status,'INSUFFICIENT_EVIDENCE');});
test('empty real input exposes exact binding and genuine gaps without research fabrication',()=>{const v=view();v.mode='SAVED_SOURCE_REVIEW';const r=projectTechCandidatePlanHandoff(v,{at,records:[],originals:[]},{at});blocked(r,'CANDIDATE_HANDOFF_RESEARCH_MISSING_OR_DUPLICATE');assert(r.candidateBindings[0].gaps.includes('DIRECTIONAL_PLAN_NOT_BOUND'));assert.equal(r.candidateBindings[0].missingPlanInputs.length,8);assert.equal(r.selectedCandidate,null);});
for(const key of ['version','runId','scanId','baseReceiptSha256','reviewHeadSha256','researchRecordId','eventRef'])test('different '+key+' cannot bind even with rehashed research/request',async()=>{const f=await fixture();edit(f.input,'RESEARCH',p=>p.researchPlan.candidateResearchBinding[key]='wrong');blocked(preview(f),'CANDIDATE_HANDOFF_EXACT_REVIEW_BINDING');});
test('same ticker with changed review head rejects old candidate',async()=>{const f=await fixture();f.v.headSha256='d'.repeat(64);blocked(preview(f),'CANDIDATE_HANDOFF_CANDIDATE_NOT_SELECTED_OR_STALE');});
test('unselected candidate cannot fall back to another selected ticker',async()=>{const f=await fixture();f.v.ranking[0].category='REJECTED';f.v.inputs.companies[0].inheritedRanking.category='REJECTED';blocked(preview(f),'CANDIDATE_HANDOFF_NO_SELECTED_CANDIDATE');});
test('binding requires exact keys and cannot smuggle authority',async()=>{const f=await fixture();edit(f.input,'RESEARCH',p=>p.researchPlan.candidateResearchBinding.executionAllowed=true);blocked(preview(f),'CANDIDATE_HANDOFF_EXACT_REVIEW_BINDING');});
test('missing binding does not auto-copy the proposed candidate',async()=>{const f=await fixture();edit(f.input,'RESEARCH',p=>delete p.researchPlan.candidateResearchBinding);blocked(preview(f),'CANDIDATE_HANDOFF_BINDING_MISSING');});
test('unbound symbol and parent identity both reject',async()=>{let f=await fixture();edit(f.input,'RESEARCH',p=>p.symbol='TSM');blocked(preview(f),'CANDIDATE_HANDOFF_RESEARCH_SYMBOL');f=await fixture();edit(f.input,'STRATEGY_REQUEST',p=>p.parentIds=[]);blocked(preview(f),'CANDIDATE_HANDOFF_REQUEST_PARENT_BINDING');});
test('request must hash and name the exact research payload',async()=>{const f=await fixture();edit(f.input,'STRATEGY_REQUEST',p=>p.researchSha256='d'.repeat(64));blocked(preview(f),'CANDIDATE_HANDOFF_REQUEST_RESEARCH_BINDING');});
test('two missing research IDs are not a valid identity match',async()=>{const f=await fixture();edit(f.input,'RESEARCH',p=>delete p.researchPlan.id);edit(f.input,'STRATEGY_REQUEST',p=>delete p.researchId);blocked(preview(f),'CANDIDATE_HANDOFF_REQUEST_RESEARCH_BINDING');});
test('changed research bytes and duplicated envelopes fail before engine',async()=>{let f=await fixture();f.input.records.find(r=>r.kind==='RESEARCH').rawJson+=' ';blocked(preview(f),'CANDIDATE_HANDOFF_RESEARCH_HASH');f=await fixture();f.input.records=f.input.records.filter(r=>r.kind!=='COST_MODEL');f.input.records.push(f.input.records.find(r=>r.kind==='RESEARCH'));blocked(preview(f),'CANDIDATE_HANDOFF_RESEARCH_MISSING_OR_DUPLICATE');});
test('registered research cannot precede available reviewed source by one ns',async()=>{const f=await fixture();edit(f.input,'RESEARCH',p=>p.researchPlan.registeredAt='2026-10-09T14:13:59.999999999Z');blocked(preview(f),'CANDIDATE_HANDOFF_RESEARCH_AFTER_REVIEW_BEFORE_DECISION');});
test('later research cannot retrospectively join an earlier decision',async()=>{const f=await fixture();edit(f.input,'RESEARCH',p=>p.researchPlan.registeredAt='2026-10-09T15:29:59.000000001Z');blocked(preview(f),'CANDIDATE_HANDOFF_RESEARCH_AFTER_REVIEW_BEFORE_DECISION');});
test('old envelope cannot carry newly bound research without preserving real clocks',async()=>{const f=await fixture();f.input.records.find(r=>r.kind==='RESEARCH').observedAt='2026-10-09T14:13:59.999999999Z';blocked(preview(f),'CANDIDATE_HANDOFF_ENVELOPE_AFTER_PARENT');});
test('reviewed research cannot contain future registration even with all hashes recomputed',async()=>{const f=await fixture();edit(f.input,'RESEARCH',p=>{p.asOf=p.researchPlan.registeredAt='2026-10-09T14:17:00.000Z';});Object.assign(f.input.records.find(r=>r.kind==='STRATEGY_REQUEST'),{observedAt:'2026-10-09T14:18:00.000Z',receivedAt:'2026-10-09T14:18:00.000Z',reviewedAt:'2026-10-09T14:18:00.000Z'});blocked(preview(f),'CANDIDATE_HANDOFF_ENVELOPE_AFTER_PARENT');});
test('request cannot predate availability of its referenced reviewed research',async()=>{const f=await fixture();f.input.records.find(r=>r.kind==='RESEARCH').reviewedAt='2026-10-09T14:16:00.000000001Z';blocked(preview(f),'CANDIDATE_HANDOFF_ENVELOPE_AFTER_PARENT');});
test('research asOf cannot be later than the declared registration',async()=>{const f=await fixture();edit(f.input,'RESEARCH',p=>p.asOf='2026-10-09T14:16:00.000000001Z');blocked(preview(f),'CANDIDATE_HANDOFF_RESEARCH_AFTER_REVIEW_BEFORE_DECISION');});
test('future assessment and unreviewed research envelope reject',async()=>{let f=await fixture();f.input.at='2026-10-09T15:30:20.000000001Z';blocked(preview(f),'CANDIDATE_HANDOFF_ASSESSMENT_CLOCK');f=await fixture();f.input.records.find(r=>r.kind==='RESEARCH').verdict='UNKNOWN';blocked(preview(f),'CANDIDATE_HANDOFF_EVIDENCE_CLOCKS');});
test('fixture review cannot join attributed real inputs or vice versa',async()=>{let f=await fixture();f.v.mode='SAVED_SOURCE_REVIEW';blocked(preview(f),'CANDIDATE_HANDOFF_FIXTURE_CONTEXT');f=await fixture();f.input.mode='REAL_SAVED_SOURCE_REPLAY';blocked(preview(f),'CANDIDATE_HANDOFF_FIXTURE_CONTEXT');});
test('exact lineage never repairs unknown cost or missing quote',async()=>{let f=await fixture();edit(f.input,'COST_MODEL',p=>p.legs[0].entryFeeCents=null);let r=preview(f);assert.equal(r.status,'BOUND_ENGINE_BLOCKED');assert.equal(r.preparation.enginePreview.status,'BLOCKED');f=await fixture();f.input.originals=[];r=preview(f);assert.equal(r.status,'BOUND_ENGINE_BLOCKED');assert(r.preparation.enginePreview.checks.some(c=>c.code==='ONE_COMPLETE_BATCH_REQUIRED'));assert.equal(r.paperAdmissionAllowed,false);});
test('named missing stored run fails closed with zero writes and no fallback',()=>{const root=fs.mkdtempSync(join(tmpdir(),'alpha-handoff-test-'));try{const r=prepareTechCandidatePlanHandoff({root,runId:'absent',input:{},now:()=>at});assert.equal(r.status,'BLOCKED');assert.equal(r.sourceVerification,'FAILED');assert.deepEqual(fs.readdirSync(root),[]);assert.equal(r.fileSystemWrites,0);}finally{fs.rmdirSync(root);}});
test('CLI documents explicit new entry and rejects incomplete arguments',()=>{assert(techSpreadPlanCli(['--help']).help.includes('--prepare-from-candidate'));assert.throws(()=>techSpreadPlanCli(['--prepare-from-candidate','input']),/ARGUMENTS/);});
