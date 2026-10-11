import {projectTechCandidatePlanHandoff} from './options-tech-candidate-plan-handoff.mjs';

const code=v=>typeof v==='string'&&/^[A-Z][A-Z0-9_]{0,120}$/.test(v)?v:'UNKNOWN';
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)?v:null;
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(v)?v:null;
const clock=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT[0-9:.]+(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v))?v:null;
const reference=b=>({version:code(b?.version),runId:id(b?.runId),scanId:id(b?.scanId),baseReceiptSha256:digest(b?.baseReceiptSha256),reviewHeadSha256:digest(b?.reviewHeadSha256),traceId:id(b?.traceId),researchRecordId:digest(b?.researchRecordId),eventRef:digest(b?.eventRef)});

/** Used only after the existing bounded reader verifies the original review.
 * The web inventory has no bound-plan input channel. Do not discover unrelated
 * plan files by ticker or turn the empty diagnostic input into a saved record.
 * Explicit input is for isolated engineering checks of this pure projection. */
export function projectTechCandidateHandoffView(view,{at,input}={}){
 const supplied=input!==undefined;
 const result=projectTechCandidatePlanHandoff(view,input??{version:'TECH_SPREAD_PLAN_INPUT_V1',mode:view.mode==='SYNTHETIC_FIXTURE'?'MOCK_CONTROL':'REAL_SAVED_SOURCE_REPLAY',at,records:[],originals:[]},{at});
 return {version:'TECH36_PLAN_HANDOFF_WEB_V1',status:code(result.status),assessedAt:clock(result.assessedAt),
  context:view.mode==='SYNTHETIC_FIXTURE'?'TEST_FIXTURE':'SAVED_REVIEW_REPLAY_NOT_CURRENT_MARKET',
  inputScope:supplied?'EXPLICIT_ISOLATED_INPUT':'THIS_REVIEW_ONLY_NO_BOUND_PLAN_INPUT_CHANNEL',
  checks:result.checks.map(c=>({code:code(c.code),status:code(c.status)})),
  candidates:result.candidateBindings.map(c=>({symbol:code(c.symbol),binding:reference(c.binding),reviewRecordedAt:clock(c.reviewRecordedAt),sourceCutoff:clock(c.sourceCutoff),gaps:c.gaps.map(code),
   missingPlanInputs:c.missingPlanInputs.map(d=>({kind:code(d.kind),state:code(d.state),missingFields:d.missingFields.filter(x=>typeof x==='string'&&/^[a-zA-Z0-9_.\[\]-]{1,200}$/.test(x))}))})),
  matchedResearch:result.selectedCandidate?{declaredResearchId:id(result.selectedCandidate.declaredResearchId),researchSha256:digest(result.selectedCandidate.researchSha256),requestSha256:digest(result.selectedCandidate.requestSha256),decisionAt:clock(result.selectedCandidate.decisionAt)}:null,
  engine:result.preparation?{status:code(result.preparation.enginePreview.status),checks:result.preparation.enginePreview.checks.map(c=>({code:code(c.code),status:code(c.status)}))}:null,
  sourceCalls:0,fileSystemWrites:0,planSaved:false,paperAdmissionAllowed:false,executionAllowed:false,fills:0,pnl:null};
}
