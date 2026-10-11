import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {readSourceRecord,saveSourceRecord} from './options-source-comparison.mjs';
import {techResearchBasis,recoverTechResearchRegistration} from './options-tech-research-registration.mjs';
import {prepareTechSpreadInput} from './options-tech-spread-preparation.mjs';
import {assessTechPaperFeasibility} from './options-tech-paper-feasibility.mjs';
import {spreadPlanHash} from './options-tech-spread-plan-binding.mjs';
import {paperFingerprint as fp} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {snapshotNs as ns} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';

const REV='TECH36_ASSISTANT_REVISION_V1',REQ='TECH36_ASSISTANT_PREPARATION_REQUEST_V1';
const check=(v,c)=>{if(!v)throw Error('TECH_ASSISTANT_'+c);};
const exact=(v,k)=>check(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===k.split(',').sort().join(),'FIELDS');
const id=v=>check(typeof v==='string'&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(v),'ID');
const pathFor=v=>{id(v);return 'data/runtime/options-macro-comparisons/source-techresearch-'+v+'.json';};
const authority={origin:'ASSISTANT_RESEARCH',capability:'DIAGNOSTIC_PREPARATION_ONLY',humanReview:'NOT_RECORDED',ownerConfirmation:'NOT_RECORDED',researchPass:false,quoteAdmissionAllowed:false,paperAdmissionAllowed:false,executionAllowed:false,sourceCalls:0,fills:0,pnl:null};
const ref=r=>({id:r.id,fingerprint:r.fingerprint});
function validate(q){
 check(q?.version===REV||q?.version===REQ,'VERSION');
 exact(q,q.version===REV?'version,id,parent,request,reason':'version,id,parent,purpose');id(q.id);
 exact(q.parent,'id,fingerprint');id(q.parent.id);check(q.id!==q.parent.id&&/^sha256:[a-f0-9]{64}$/.test(q.parent.fingerprint),'PARENT');
 const t=q.version===REV?q.reason:q.purpose;check(typeof t==='string'&&t.trim()&&t.length<=1000&&!/[\u0000-\u001f]/.test(t),'TEXT');
 check(Buffer.byteLength(JSON.stringify(q))<=10000,'BOUND');
}
function replay(root,recordId,at,seen=new Set()){
 check(!seen.has(recordId)&&seen.size<16,'CHAIN_BOUND');seen.add(recordId);
 const r=readSourceRecord(root,pathFor(recordId));
 check(r.kind==='techresearch'&&r.id===recordId&&ns(r.savedAt)<=ns(at),'RECORD');
 if(r.payload.version==='TECH36_RESEARCH_REGISTRATION_V1'){
  const original=recoverTechResearchRegistration({root,id:recordId,now:()=>at});
  check(original.payload.request.authorship.kind==='ASSISTANT','AUTHOR');return original;
 }
 const q=r.payload.input;validate(q);check(q.id===r.id,'RECORD');
 const parent=replay(root,q.parent.id,at,seen);
 check(fp(r.payload)===fp(build(root,q,parent,r.savedAt,true)),'REPLAY');return r;
}
function build(root,q,parent,at,historical=false){
 validate(q);check(parent.fingerprint===q.parent.fingerprint,'PARENT_HASH');
 check(ns(parent.savedAt)<ns(at),'FORWARD_CLOCK');
 const isRoot=parent.payload.version==='TECH36_RESEARCH_REGISTRATION_V1';
 check(isRoot||parent.payload.version===REV,'PARENT_TYPE');
 const depth=isRoot?1:parent.payload.depth+1;check(depth<16,'CHAIN_BOUND');
 const common={version:q.version,input:structuredClone(q),depth,root:isRoot?ref(parent):parent.payload.root,recordedAt:at,clockBasis:'SERVICE_SAVE_CLOCK_NOT_PROOF_OF_FIRST_THOUGHT',...authority};
 if(q.version===REQ){check(!isRoot,'REVISION_REQUIRED');return {...common,researchId:parent.id,researchSha256:spreadPlanHash(JSON.stringify(project(parent))),requestedAt:at};}
 check(q.request.id===q.id&&q.request.authorship.kind==='ASSISTANT','AUTHOR_OR_ID');
 const prior=isRoot?parent.payload.request:parent.payload.input.request;
 check(fp(q.request.candidateBinding)===fp(prior.candidateBinding),'CANDIDATE_CHANGED');
 check(ns(q.request.asOf)>ns(parent.savedAt),'CONTENT_CLOCK');
 const b=techResearchBasis(root,q.request,at,historical);
 return {...common,basis:b,registeredAt:at};
}
// The input cutoff is retained in basis.request.asOf. Both new assessment and
// new registration use this revision's actual save clock, never the old plan's.
function project(r){
 const b=r.payload.basis,q=b.request,at=r.savedAt,dir=x=>['UP','DOWN'].includes(x)?x:'UNKNOWN';
 const facet={status:'UNKNOWN',validFrom:at,validThrough:at,evidence:[]};
 return {version:'THREE_FACET_INPUT_V1',symbol:b.candidate.symbol,instrumentType:'EQUITY',asOf:at,holdingFrom:q.holdingFrom,holdingThrough:q.holdingThrough,
  fundamental:{...facet,direction:dir(q.direction.fundamental),basis:'COMPANY',directionBasis:'UNKNOWN',directionRationale:q.hypothesis,reassessedNewsIds:[],evidence:b.sources.map(s=>({id:s.sha256+':'+s.blockIndex,kind:'FUNDAMENTAL',source:s.sha256+':'+s.blockIndex,publishedAt:s.publishedAt,receivedAt:s.receivedAt,reviewedAt:at}))},
  news:{...facet,direction:dir(q.direction.news),assumptionImpact:'UNKNOWN',materialChanges:[],trigger:q.confirmationCondition,triggerState:'UNKNOWN'},technical:null,
  risk:Object.fromEntries(['capital','maximumLoss','liquidity','gap','correlation','exit'].map(k=>[k,{state:'UNKNOWN',evidence:[]}])),
  researchPlan:{id:r.id,registeredAt:at,sourceIds:q.sources.map(s=>s.sha256+':'+s.blockIndex),candidateResearchBinding:q.candidateBinding,hypothesis:q.hypothesis,triggerCondition:q.trialCondition,confirmationCondition:q.confirmationCondition,invalidationCondition:q.invalidationCondition,exitCondition:q.exitCondition}};
}
export function recoverAssistantResearch({root,id:recordId,now=()=>new Date().toISOString()}){
 const r=replay(root,recordId,now());check([REV,REQ].includes(r.payload.version),'TYPE');return {...r,fileSystemWrites:0};
}
export function previewAssistantResearch({root,input,now=()=>new Date().toISOString()}){
 validate(input);const at=now(),parent=replay(root,input.parent.id,at),p=build(root,input,parent,at);
 // Preview excludes its tentative service clock. Save validates and assigns a
 // new actual clock; callers cannot request or approve a historical save time.
 return {version:'TECH36_ASSISTANT_APPEND_PREVIEW_V1',previewFingerprint:fp({input,parent:ref(parent)}),parent:ref(parent),depth:p.depth,...authority,fileSystemWrites:0};
}
export function appendAssistantResearch({root,input,previewFingerprint,now=()=>new Date().toISOString()}){
 validate(input);const at=now();
 if(existsSync(resolve(root,pathFor(input.id)))){
  const old=recoverAssistantResearch({root,id:input.id,now:()=>at});
  check(fp(old.payload.input)===fp(input)&&previewFingerprint===fp({input,parent:input.parent}),'RETRY_CHANGED');return {...old,alreadyRecorded:true};
 }
 const p=previewAssistantResearch({root,input,now:()=>at});check(p.previewFingerprint===previewFingerprint,'PREVIEW_CHANGED');
 const parent=replay(root,input.parent.id,at),body=build(root,input,parent,at);
 saveSourceRecord(root,'techresearch',input.id,body,at);
 return {...recoverAssistantResearch({root,id:input.id,now:()=>at}),fileSystemWrites:1,alreadyRecorded:false};
}
export function prepareAssistantResearch({root,id:recordId,now=()=>new Date().toISOString()}){
 const at=now(),r=recoverAssistantResearch({root,id:recordId,now:()=>at});check(r.payload.version===REQ,'REQUEST_REQUIRED');
 const revision=replay(root,r.payload.input.parent.id,at),research=project(revision),q=revision.payload.input.request;
 const request={id:r.id,researchId:revision.id,researchSha256:r.payload.researchSha256,parentIds:[q.candidateBinding.traceId,q.candidateBinding.researchRecordId,revision.id],requestedAt:r.savedAt,decisionAt:null,accountId:null,structure:null,quantity:null,conditions:{entry:q.trialCondition,confirmation:q.confirmationCondition,exit:q.exitCondition,invalidation:q.invalidationCondition}};
 const envelope=(kind,data,clock)=>{const rawJson=JSON.stringify(data);return {kind,origin:'ASSISTANT_RESEARCH',source:'DECLARED_ASSISTANT_RESEARCH',reviewedBy:'ASSISTANT_NOT_OWNER',observedAt:clock,receivedAt:clock,reviewedAt:clock,validThrough:null,verdict:'UNRESOLVED',rawJson,sha256:spreadPlanHash(rawJson)};};
 const records=[envelope('RESEARCH',research,revision.savedAt),envelope('STRATEGY_REQUEST',request,r.savedAt)];
 return {version:'TECH36_ASSISTANT_PREPARATION_V1',status:'ACCEPTED_FOR_DIAGNOSTICS_ONLY',evidenceContext:q.evidenceContext,assessedAt:at,revision:ref(revision),requestRecord:ref(r),research,diagnosticRequest:request,
  independentResearchAssessment:assessTechPaperFeasibility({research,at}),
  originalPreparation:prepareTechSpreadInput({version:'TECH_SPREAD_PLAN_INPUT_V1',mode:'REAL_SAVED_SOURCE_REPLAY',at,records}),
  executionOriginAccepted:false,originalRequestAccepted:false,validity:'UNKNOWN_ZERO_DURATION_PLACEHOLDERS_NOT_HOLDING_WINDOW_COVERAGE',...authority,fileSystemWrites:0};
}
