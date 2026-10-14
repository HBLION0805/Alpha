import {projectTechCandidatePlanHandoff} from './options-tech-candidate-plan-handoff.mjs';
import {assessTechPaperFeasibility} from './options-tech-paper-feasibility.mjs';

const code=v=>typeof v==='string'&&/^[A-Z][A-Z0-9_]{0,120}$/.test(v)?v:'UNKNOWN';
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)?v:null;
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(v)?v:null;
const clock=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT[0-9:.]+(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v))?v:null;
const reference=b=>({version:code(b?.version),runId:id(b?.runId),scanId:id(b?.scanId),baseReceiptSha256:digest(b?.baseReceiptSha256),reviewHeadSha256:digest(b?.reviewHeadSha256),traceId:id(b?.traceId),researchRecordId:digest(b?.researchRecordId),eventRef:digest(b?.eventRef)});

/** Only the status reader's fully verified journals reach this projection. A run
 * reference selects diagnostics, never a match: the existing handoff checks all
 * original hashes, candidate IDs, parents, clocks and fixture applicability. */
export function projectSavedTechCandidatePlans(view,{at,savedPlans,inventoryState='NOT_CHECKED'}){
 const plans=(savedPlans??[]).filter(({plan})=>plan.research?.researchPlan?.candidateResearchBinding?.runId===view.runId).map(({plan,receipt})=>{
  const p=plan.provenance,assistant=p.version==='TECH_SPREAD_PLAN_BINDING_V2',paper=plan.mode==='REAL_QUOTE_PAPER';
  const input={version:assistant?'TECH_SPREAD_PLAN_INPUT_V3':paper?'TECH_SPREAD_PLAN_INPUT_V2':'TECH_SPREAD_PLAN_INPUT_V1',mode:paper?'REAL_QUOTE_PAPER':'MOCK_CONTROL',
   ...(paper?{evidenceContext:plan.evidenceContext}:{}),...(assistant?{researchPolicy:p.researchPolicy}:{}),at:p.preflightAt,records:p.records,originals:[{id:'saved-plan-original',...p.original}]};
  const h=projectTechCandidateHandoffView(view,{at,input}),b=plan.research.researchPlan.candidateResearchBinding;
  const reasons=h.checks.map(c=>c.code),linkStatus=h.status==='BOUND_PREVIEW_ONLY'?'EXACT_CURRENT_REVIEW':h.status==='BOUND_ENGINE_BLOCKED'?'EXACT_BINDING_ENGINE_BLOCKED':reasons.includes('CANDIDATE_HANDOFF_FIXTURE_CONTEXT')?'CONTEXT_MISMATCH':b.reviewHeadSha256!==view.headSha256?'STALE_REVIEW':'BINDING_REJECTED';
  const research=assessTechPaperFeasibility({research:plan.research,at:p.preflightAt}).research;
  return {linkStatus,declaredBinding:reference(b),planRef:digest(p.planSha256),journalRef:digest(receipt.sourceRef),journalTipRef:digest(receipt.journalTipRef),locationRef:digest(receipt.locationRef),
   context:code(receipt.evidenceContext),savedAt:clock(receipt.recordedAt),decisionAt:clock(plan.decisionAt),originalPreflightAt:clock(p.preflightAt),
   researchStatus:code(research.status),trialStatus:code(research.trial?.status),confirmationStatus:code(research.confirmation?.status),researchBlockers:(research.blockers??[]).map(code),
   checks:h.checks,engine:h.engine,matchedResearch:h.matchedResearch,paperStatus:code(receipt.paperStatus),modeledOrderCount:receipt.modeledOrderCount,
   currentAdmission:'NOT_EVALUATED',realAcceptance:'NOT_TESTED',executionAllowed:false};
 });
 return {state:savedPlans===undefined?'NOT_CHECKED':['PARTIAL','BLOCKED'].includes(inventoryState)?'UNRESOLVED_INVENTORY':plans.some(p=>p.linkStatus==='EXACT_CURRENT_REVIEW')?'EXACT_SAVED_PLAN':plans.length?'NO_CURRENT_MATCH':'NO_EXACT_SAVED_PLAN',
  inventoryState,plans,scope:'VERIFIED_JOURNALS_IN_THIS_WORKSPACE_ONLY',sourceCalls:0,fileSystemWrites:0};
}

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
