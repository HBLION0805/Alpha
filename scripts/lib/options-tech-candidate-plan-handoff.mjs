import {readTechEventReviews} from './options-tech-candidate.mjs';
import {projectTechCandidateTrace} from './options-tech-candidate-trace.mjs';
import {prepareTechSpreadInput} from './options-tech-spread-preparation.mjs';
import {readTechEvidenceRecords} from './options-tech-paper-feasibility.mjs';
import {spreadPlanHash,spreadPaperEvidencePolicy,spreadRecordOriginAllowed} from './options-tech-spread-plan-binding.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {assistantInputPolicy} from './options-tech-assistant-fact-policy.mjs';

const check=(v,c)=>{if(!v)throw Error('CANDIDATE_HANDOFF_'+c);};
const safeCode=e=>/^(?:CANDIDATE_HANDOFF|TECH_CANDIDATE|TECH_TRACE)_[A-Z_]+$/.test(e?.message)?e.message:'CANDIDATE_HANDOFF_INPUT_INVALID';
const binding=(view,t)=>({version:'TECH36_PLAN_RESEARCH_BINDING_V1',runId:view.runId,scanId:view.scanId,baseReceiptSha256:view.baseReceiptSha256,reviewHeadSha256:view.headSha256,traceId:t.traceId,researchRecordId:t.research.recordId,eventRef:t.eventRef});
const exact=(a,b)=>a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).length===Object.keys(b).length&&Object.entries(b).every(([k,v])=>a[k]===v);

/** Projection after source replay. It does not authenticate supplied interpretations,
 * create a request envelope, alter input clocks, or save/admit a plan. */
export function projectTechCandidatePlanHandoff(view,input,{at}){
 const out={version:'TECH36_PLAN_HANDOFF_PREVIEW_V1',assessedAt:at,status:'BLOCKED',checks:[],candidateBindings:[],selectedCandidate:null,preparation:null,
  inputSha256:spreadPlanHash(input??null),sourceVerification:'CALLER_SUPPLIED_VIEW',bindingAuthority:'EXACT_DECLARED_LINEAGE_NOT_SEMANTIC_OR_SOURCE_AUTHENTICATION',
  sourceCalls:0,fileSystemWrites:0,planSaved:false,requestEnvelopeCreated:false,executionAllowed:false,paperAdmissionAllowed:false,fills:0,pnl:null};
 try{
  const scan=projectTechCandidateTrace(view,{at});
  check(typeof view.runId==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(view.runId),'RUN_ID');
  out.candidateBindings=scan.traces.map(t=>({symbol:t.symbol,binding:binding(view,t),reviewRecordedAt:t.reviewRecordedAt,sourceCutoff:t.sourceCutoff,gaps:t.admission.blockers,missingPlanInputs:t.preparation.diagnostics,courseAssessment:t.courseAssessment}));
  check(scan.traces.length>0,'NO_SELECTED_CANDIDATE');
  check(input&&snapshotNs(input.at)<=snapshotNs(at),'ASSESSMENT_CLOCK');
  check(Array.isArray(input.records)&&input.records.length<=8,'RECORD_BOUND');
  const assistant=assistantInputPolicy(input);
  const take=kind=>{
   const rows=input.records.filter(r=>r?.kind===kind);check(rows.length===1,kind+'_MISSING_OR_DUPLICATE');const r=rows[0];
   check(typeof r.rawJson==='string'&&(assistant&&kind==='RESEARCH'?r.rawJson.length<=262144:Buffer.byteLength(r.rawJson)<=65536)&&spreadPlanHash(r.rawJson)===r.sha256,kind+'_HASH');
   const payload=parseChainSurveyJson(r.rawJson);check(payload&&typeof payload==='object'&&!Array.isArray(payload),kind+'_BODY');return {record:r,payload};
  };
  const research=take('RESEARCH'),request=take('STRATEGY_REQUEST'),b=research.payload.researchPlan?.candidateResearchBinding;
  check(b,'BINDING_MISSING');
  const t=scan.traces.find(t=>t.traceId===b.traceId);check(t,'CANDIDATE_NOT_SELECTED_OR_STALE');
  check(exact(b,binding(view,t)),'EXACT_REVIEW_BINDING');
  check(research.payload.symbol===t.symbol,'RESEARCH_SYMBOL');
  check(typeof research.payload.researchPlan?.id==='string'&&research.payload.researchPlan.id.trim().length>0&&research.payload.researchPlan.id.length<=2000&&request.payload.researchId===research.payload.researchPlan.id&&request.payload.researchSha256===research.record.sha256,'REQUEST_RESEARCH_BINDING');
  check(Array.isArray(request.payload.parentIds)&&request.payload.parentIds.includes(t.traceId)&&request.payload.parentIds.includes(t.research.recordId),'REQUEST_PARENT_BINDING');
  const paper=input.mode==='REAL_QUOTE_PAPER',policy=paper?spreadPaperEvidencePolicy(input.evidenceContext):{fixture:input.mode==='MOCK_CONTROL'};
  // Use the same explicit V3 policy as preparation; never widen legacy origins.
  if(assistant)policy.assistantResearch=true;
  check(paper||['MOCK_CONTROL','REAL_SAVED_SOURCE_REPLAY'].includes(input.mode),'INPUT_MODE');
  check(policy.fixture===(view.mode==='SYNTHETIC_FIXTURE'),'FIXTURE_CONTEXT');
  check([research.record,request.record].every(r=>spreadRecordOriginAllowed(policy,r)),'RECORD_ORIGIN');
  const decision=snapshotNs(request.payload.decisionAt),registered=snapshotNs(research.payload.researchPlan.registeredAt),review=snapshotNs(view.recordedAt);
  const researchAsOf=snapshotNs(research.payload.asOf);
  check(review<=researchAsOf&&researchAsOf<=registered&&review<=registered&&registered<=decision,'RESEARCH_AFTER_REVIEW_BEFORE_DECISION');
  check(registered<=snapshotNs(research.record.observedAt)&&snapshotNs(research.record.reviewedAt)<=snapshotNs(request.record.observedAt),'ENVELOPE_AFTER_PARENT');
  const validated=readTechEvidenceRecords({inputs:[research.record,request.record],kinds:['RESEARCH','STRATEGY_REQUEST'],now:snapshotNs(input.at),decision,validThrough:snapshotNs(request.payload.timeExitAt),simulatedAccount:policy.simulatedAccount,assistantContext:assistant?input.evidenceContext:null});
  check(!validated.blockers.length,'EVIDENCE_CLOCKS');
  out.selectedCandidate={symbol:t.symbol,binding:b,reviewRecordedAt:view.recordedAt,declaredResearchId:research.payload.researchPlan.id,researchSha256:research.record.sha256,requestSha256:request.record.sha256,decisionAt:request.payload.decisionAt};
  out.checks.push({code:'EXACT_CANDIDATE_RESEARCH_REQUEST_BINDING',status:'PASS'});
  // Pass the original input unchanged. The course assessment remains a separate
  // research check, never a substitute for original quote/account/risk gates.
  out.preparation=prepareTechSpreadInput(input);
  out.status=['MOCK_PLAN_READY','REAL_QUOTE_PAPER_PLAN_READY'].includes(out.preparation.enginePreview.status)?'BOUND_PREVIEW_ONLY':'BOUND_ENGINE_BLOCKED';
  return out;
 }catch(e){out.checks.push({code:safeCode(e),status:'BLOCKED'});return out;}
}

/** Read only the named existing research run; never select a different candidate
 * or append a review. A changed head during preview fails closed. */
export function prepareTechCandidatePlanHandoff({root,runId,input,now=()=>new Date().toISOString()}){
 const at=now();let view;
 try{view=readTechEventReviews({root,runId,now:()=>at});}
 catch(e){return {version:'TECH36_PLAN_HANDOFF_PREVIEW_V1',assessedAt:at,status:'BLOCKED',checks:[{code:safeCode(e),status:'BLOCKED'}],sourceVerification:'FAILED',candidateBindings:[],selectedCandidate:null,preparation:null,sourceCalls:0,fileSystemWrites:0,planSaved:false,requestEnvelopeCreated:false,executionAllowed:false,paperAdmissionAllowed:false,fills:0,pnl:null};}
 const result=projectTechCandidatePlanHandoff(view,input,{at});
 try{const after=readTechEventReviews({root,runId,now:()=>at});check(after.baseReceiptSha256===view.baseReceiptSha256&&after.headSha256===view.headSha256,'SOURCE_CHANGED_DURING_PREVIEW');}
 catch(e){return {...result,status:'BLOCKED',sourceVerification:'FAILED',selectedCandidate:null,preparation:null,checks:[...result.checks,{code:safeCode(e),status:'BLOCKED'}]};}
 return {...result,sourceVerification:'SAVED_ORIGINAL_AND_REVIEW_REPLAY'};
}
