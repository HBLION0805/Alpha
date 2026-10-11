import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {readSourceRecord,saveSourceRecord} from './options-source-comparison.mjs';
import {readTechEventReviews,readTechEventReviewVersion} from './options-tech-candidate.mjs';
import {projectTechCandidateTrace} from './options-tech-candidate-trace.mjs';
import {paperFingerprint as fp} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {snapshotNs as ns} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';

const VERSION='TECH36_RESEARCH_REGISTRATION_V1';
const check=(v,c)=>{if(!v)throw Error('TECH_RESEARCH_'+c);};
const exact=(v,keys)=>check(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.split(',').sort().join(),'FIELDS');
const text=(v,max=1000)=>check(typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v),'TEXT');
const id=v=>check(typeof v==='string'&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(v),'ID');
const pathFor=key=>{id(key);return 'data/runtime/options-macro-comparisons/source-techresearch-'+key+'.json';};
const closed={humanReview:{status:'NOT_RECORDED'},ownerConfirmation:{status:'NOT_RECORDED'},evidenceEnvelope:null,
 strategyRequestCreated:false,planSaved:false,paperAdmissionAllowed:false,executionAllowed:false,sourceCalls:0,fills:0,pnl:null};

function validateRequest(r){
 exact(r,'version,id,candidateBinding,evidenceContext,authorship,asOf,holdingFrom,holdingThrough,direction,hypothesis,trialCondition,confirmationCondition,invalidationCondition,exitCondition,sources');
 check(r.version==='TECH36_EXPLICIT_RESEARCH_REQUEST_V1','VERSION');id(r.id);
 exact(r.candidateBinding,'version,runId,scanId,baseReceiptSha256,reviewHeadSha256,traceId,researchRecordId,eventRef');
 id(r.candidateBinding.runId);check(['TEST_FIXTURE','SAVED_SOURCE_RESEARCH'].includes(r.evidenceContext),'CONTEXT');
 exact(r.authorship,'kind,name,sourceRef');check(['ASSISTANT','HUMAN'].includes(r.authorship.kind),'AUTHOR_KIND');text(r.authorship.name,120);text(r.authorship.sourceRef,240);
 exact(r.direction,'fundamental,news');check(Object.values(r.direction).every(d=>['UP','DOWN','NEUTRAL','UNKNOWN'].includes(d)),'DIRECTION');
 for(const k of ['hypothesis','trialCondition','confirmationCondition','invalidationCondition','exitCondition'])text(r[k]);
 check(ns(r.asOf)<=ns(r.holdingFrom)&&ns(r.holdingFrom)<ns(r.holdingThrough),'HOLDING_CLOCK');
 check(Array.isArray(r.sources)&&r.sources.length>0&&r.sources.length<=12,'SOURCES');
 for(const s of r.sources){exact(s,'sha256,blockIndex');check(/^[a-f0-9]{64}$/.test(s.sha256)&&Number.isSafeInteger(s.blockIndex)&&s.blockIndex>=0,'SOURCES');}
 check(new Set(r.sources.map(s=>s.sha256+':'+s.blockIndex)).size===r.sources.length,'SOURCE_DUPLICATE');
 check(Buffer.byteLength(JSON.stringify(r))<=8000,'REQUEST_BOUND');
}

export function techResearchBasis(root,r,at,historical=false){
 validateRequest(r);ns(at);
 const v=historical?readTechEventReviewVersion({root,runId:r.candidateBinding.runId,headSha256:r.candidateBinding.reviewHeadSha256,now:()=>at}):readTechEventReviews({root,runId:r.candidateBinding.runId,now:()=>at});
 const t=projectTechCandidateTrace(v,{at}).traces.find(t=>t.traceId===r.candidateBinding.traceId);check(t,'CANDIDATE_NOT_SELECTED_OR_STALE');
 const binding={version:'TECH36_PLAN_RESEARCH_BINDING_V1',runId:v.runId,scanId:v.scanId,baseReceiptSha256:v.baseReceiptSha256,reviewHeadSha256:v.headSha256,traceId:t.traceId,researchRecordId:t.research.recordId,eventRef:t.eventRef};
 check(fp(binding)===fp(r.candidateBinding),'EXACT_REVIEW_BINDING');
 check((v.mode==='SYNTHETIC_FIXTURE')===(r.evidenceContext==='TEST_FIXTURE'),'FIXTURE_CONTEXT');
 check(ns(v.recordedAt)<=ns(r.asOf)&&ns(r.asOf)<=ns(at)&&ns(at)<=ns(r.holdingFrom),'RESEARCH_CLOCK');
 const event=v.inputs.eventInputs.find(e=>e.symbol===t.symbol&&e.eventId===v.ranking.find(x=>x.symbol===t.symbol)?.eventId);
 const documents=v.inputs.documents.filter(d=>event.documentIds.includes(d.id));
 const sources=r.sources.map(s=>{const d=documents.find(d=>d.sha256===s.sha256&&d.status==='BODY_TEXT_EXTRACTED'&&d.blocks?.some(b=>b.index===s.blockIndex));check(d,'SOURCE_NOT_IN_CANDIDATE_VERSION');check(ns(d.receivedAt)<=ns(r.asOf),'SOURCE_CLOCK');return {...s,publishedAt:d.publishedAt??null,receivedAt:d.receivedAt};});
 return {request:structuredClone(r),candidate:{symbol:t.symbol,binding,reviewRecordedAt:v.recordedAt,sourceCutoff:t.sourceCutoff},sources,
  attribution:{...r.authorship,authority:'DECLARED_AUTHOR_NOT_IDENTITY_AUTHENTICATION'},...structuredClone(closed)};
}

function payload(b,at){
 const r=b.request;
 return {version:VERSION,...b,registeredAt:at,registrationClockBasis:'SERVICE_SAVE_CLOCK_NOT_PROOF_OF_FIRST_THOUGHT',
  researchPayloadDraft:{version:'THREE_FACET_INPUT_V1',symbol:b.candidate.symbol,instrumentType:'EQUITY',asOf:r.asOf,holdingFrom:r.holdingFrom,holdingThrough:r.holdingThrough,
   fundamental:{direction:r.direction.fundamental,status:'UNKNOWN'},news:{direction:r.direction.news,status:'UNKNOWN'},
   researchPlan:{id:r.id,registeredAt:at,sourceIds:r.sources.map(s=>s.sha256+':'+s.blockIndex),candidateResearchBinding:r.candidateBinding,
    hypothesis:r.hypothesis,triggerCondition:r.trialCondition,confirmationCondition:r.confirmationCondition,invalidationCondition:r.invalidationCondition,exitCondition:r.exitCondition}},
  handoffStatus:'UNREVIEWED_RESEARCH_DRAFT_NO_EVIDENCE_ENVELOPE',registrationAuthority:'RESEARCH_ONLY_NOT_OWNER_APPROVAL_OR_TRADING_PERMISSION'};
}

/** Read-only preview. No registration clock is accepted from request data. */
export function previewTechResearchRegistration({root,request,now=()=>new Date().toISOString()}){
 const at=now(),b=techResearchBasis(root,request,at);return {version:'TECH36_RESEARCH_REGISTRATION_PREVIEW_V1',assessedAt:at,previewFingerprint:fp(b),basis:b,fileSystemWrites:0,...structuredClone(closed)};
}

/** Recovery uses the exact historical review and retained originals; latest
 * review/ranking cannot relink a saved registration. Never repairs corrupt data. */
export function recoverTechResearchRegistration({root,id:recordId,now=()=>new Date().toISOString()}){
 const r=readSourceRecord(root,pathFor(recordId)),at=now();
 check(r.kind==='techresearch'&&r.id===recordId&&r.payload.version===VERSION&&r.payload.request.id===recordId&&ns(r.savedAt)<=ns(at),'RECORD_INTEGRITY');
 const b=techResearchBasis(root,r.payload.request,r.savedAt,true);
 check(fp(r.payload)===fp(payload(b,r.savedAt)),'RECORD_REPLAY');
 return {...r,previewFingerprint:fp(b),recovery:'EXACT_HISTORICAL_REVIEW_AND_RECORD_REPLAY',fileSystemWrites:0};
}

/** Explicit engineering registration uses the existing bounded comparison store.
 * It never records human review or Owner confirmation and creates no envelope. */
export function registerTechResearch({root,request,previewFingerprint,now=()=>new Date().toISOString()}){
 validateRequest(request);const at=now();ns(at);
 const retry=()=>{const old=recoverTechResearchRegistration({root,id:request.id,now:()=>at});check(fp(old.payload.request)===fp(request)&&old.previewFingerprint===previewFingerprint,'RETRY_CHANGED');return {...old,alreadyRecorded:true};};
 if(existsSync(resolve(root,pathFor(request.id))))return retry();
 const p=previewTechResearchRegistration({root,request,now:()=>at});check(p.previewFingerprint===previewFingerprint,'PREVIEW_CHANGED');
 // Repeat the original-reader check before the exclusive write. There is no
 // cross-store atomic lock and no claim of source identity authentication.
 check(previewTechResearchRegistration({root,request,now:()=>at}).previewFingerprint===previewFingerprint,'PREVIEW_CHANGED');
 let saved;try{saved=saveSourceRecord(root,'techresearch',request.id,payload(p.basis,at),at);}catch(e){if(e.message==='MACRO_SOURCE_RETRY_CHANGED')return retry();throw e;}
 return {...recoverTechResearchRegistration({root,id:request.id,now:()=>at}),alreadyRecorded:saved.alreadyRecorded===true,fileSystemWrites:saved.alreadyRecorded?0:1};
}
