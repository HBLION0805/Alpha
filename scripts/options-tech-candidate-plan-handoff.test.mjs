import nodeTest,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {TECH36_POOL} from './lib/options-tech-candidate.mjs';
import {projectTechCandidateTrace} from './lib/options-tech-candidate-trace.mjs';
import {projectTechCandidatePlanHandoff,prepareTechCandidatePlanHandoff} from './lib/options-tech-candidate-plan-handoff.mjs';
import {mockSpreadPlanFixture,simulatedAccountSpreadFixture} from './lib/options-tech-spread-plan-fixtures.mjs';
import {ASSISTANT_FACT_POLICY} from './lib/options-tech-assistant-fact-policy.mjs';
import {spreadPlanHash} from './lib/options-tech-spread-plan-binding.mjs';
import {prepareTechSpreadInput} from './lib/options-tech-spread-preparation.mjs';
import {techSpreadPlanCli} from './options-tech-spread-plan.mjs';
import {projectTechCandidateHandoffView} from './lib/options-tech-candidate-handoff-view.mjs';
import {techCandidateHandoffPanel} from '../apps/options-workbench/tech-candidate-handoff.js';
import {techCandidateTracePanel} from '../apps/options-workbench/tech-candidate-trace.js';
import {startTechSpreadPlan} from './lib/options-tech-spread-plan.mjs';
import {mockSpreadEventFromOriginal} from './lib/options-tech-spread-plan-binding.mjs';
import {appendMockSpread,recoverMockSpread} from './lib/options-tech-mock-spread.mjs';
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
