import {assessCourseFramework,courseDirectionFromFacets} from '../../apps/options-workbench/course-framework.mjs';
import {createHash} from 'node:crypto';
import {TECH36_POOL} from './options-tech-candidate.mjs';
import {prepareTechSpreadInput} from './options-tech-spread-preparation.mjs';

const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const check=(v,c)=>{if(!v)throw Error('TECH_TRACE_'+c);};
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const clock=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v));
/** Called only after the original source/review reader has replayed hashes and ranking.
 * No symbol-only joins, new ranking, forecast, record envelope or trading permission. */
export function projectTechCandidateTrace(view,{at,summarize=()=>null}){
 check(view?.version==='TECH36_EVENT_REVIEW_VIEW_V1'&&digest(view.baseReceiptSha256)&&digest(view.headSha256),'VIEW');
 check(clock(at)&&clock(view.recordedAt)&&Date.parse(at)>=Date.parse(view.recordedAt),'CLOCK');
 const i=view.inputs,ranking=view.ranking;
 check(i?.scanId===view.scanId&&Array.isArray(ranking)&&ranking.length===36&&new Set(ranking.map(r=>r.symbol)).size===36&&TECH36_POOL.every(s=>ranking.some(r=>r.symbol===s)),'FIXED_POOL');
 check(Array.isArray(i.companies)&&i.companies.length===36&&TECH36_POOL.every(s=>i.companies.filter(c=>c.symbol===s).length===1),'FIXED_POOL');
 check(ranking.every(r=>JSON.stringify(r)===JSON.stringify(i.companies.find(c=>c.symbol===r.symbol).inheritedRanking)),'RANK_BINDING');
 check(['SAVED_SOURCE_REVIEW','SYNTHETIC_FIXTURE'].includes(view.mode),'MODE');
 const selected=ranking.filter(r=>r.category==='SELECTED');check(selected.length<=5,'FOCUS');
 const scanTraceId='tech36-scan-'+hash([view.scanId,view.baseReceiptSha256,view.headSha256]);
 // No implicit account choice and no supplied strategy/quote records. This is an
 // inventory of THIS verified event-review snapshot, not a search for other plans.
 const preparation=prepareTechSpreadInput({version:'TECH_SPREAD_PLAN_INPUT_V1',mode:'REAL_SAVED_SOURCE_REPLAY',at,records:[],originals:[]});
 const traces=selected.map(r=>{
  const events=i.eventInputs.filter(e=>e.symbol===r.symbol&&e.eventId===r.eventId);check(events.length===1,'SELECTED_EVENT');
  const e=events[0],docs=i.documents.filter(d=>e.documentIds.includes(d.id));
  check(new Set(docs.map(d=>d.id)).size===docs.length&&docs.length===e.documentIds.length&&docs.every(d=>d.eventId===e.eventId&&d.symbols.includes(e.symbol)&&digest(d.sha256)),'DOCUMENT_BINDING');
  const traceId='tech36-candidate-'+hash([view.scanId,view.baseReceiptSha256,view.headSha256,r.symbol,r.eventId]);
  const eventRef=hash([view.scanId,r.eventId]);
  const p=e.researchInput;
  const gaps=['DIRECTIONAL_PLAN_NOT_BOUND','TECHNICAL_EVIDENCE_NOT_BOUND','STRATEGY_REQUEST_NOT_BOUND','EXACT_CONTRACT_SELECTION_NOT_BOUND','POST_DECISION_QUOTE_NOT_BOUND',
   ...(p?.consensusSurprise?.status==='UNKNOWN'?['PRE_EVENT_COMPARABLE_CONSENSUS_UNKNOWN']:[]),...(e.coverageStatus!=='ATTRIBUTED_VERIFIED_SCOPE'?['ORIGINAL_REVIEW_UNRESOLVED']:[]),...e.issues];
  return {traceId,scanTraceId,symbol:r.symbol,eventRef,scanId:view.scanId,baseReceiptSha256:view.baseReceiptSha256,reviewHeadSha256:view.headSha256,
   rank:ranking.indexOf(r)+1,score:r.coreScore,valuation:r.valuation??null,sourceCutoff:i.sourceCutoff,reviewRecordedAt:view.recordedAt,
   evidenceContext:view.mode==='SYNTHETIC_FIXTURE'?'TEST_FIXTURE':'SAVED_ORIGINAL_REPLAY_NOT_NEW_SCAN',
   original:{status:docs.some(d=>d.status==='BODY_TEXT_EXTRACTED')?'BODY_AVAILABLE':'BODY_UNKNOWN',coverageStatus:e.coverageStatus,
    documents:docs.map(d=>({sha256:d.sha256,status:d.status,publishedAt:d.publishedAt,receivedAt:d.receivedAt,filingAcceptedAt:d.filingAcceptedAt,blockCount:d.blocks?.length??0}))},
   research:{recordId:createHash('sha256').update(view.headSha256+'|'+i.eventInputs.indexOf(e)).digest('hex'),reviewedAt:clock(e.savedReview?.reviewedAt)&&Date.parse(e.savedReview.reviewedAt)<=Date.parse(view.recordedAt)?e.savedReview.reviewedAt:null,interpretation:summarize(e.savedReview?.interpretation),nextEvidence:summarize(e.savedReview?.nextEvidence),eventWindow:summarize(e.savedReview?.eventWindow),status:p.status,sourceRef:view.headSha256,eventRef,fundamentalDirection:p.fundamental.direction,newsDirection:p.news.direction,technicalStatus:p.technical.status,
    consensusStatus:p.consensusSurprise.status,holdingWindow:p.holdingWindow,optionExpiry:p.optionExpiry,trialCondition:p.trialCondition,confirmationCondition:p.confirmationCondition,invalidationCondition:p.invalidationCondition,
    authority:'ATTRIBUTED_ORIGINAL_RESEARCH_NOT_NEW_PREDICTION'},
   courseAssessment:assessCourseFramework({direction:courseDirectionFromFacets(p.fundamental?.direction,p.news?.direction),thesisRef:summarize(e.savedReview?.interpretation),entry:summarize(p.confirmationCondition),invalidation:summarize(p.invalidationCondition)}),
   preparation:{status:'BLOCKED_MISSING_BOUND_PLAN_INPUTS',scope:'THIS_EVENT_REVIEW_SNAPSHOT_ONLY',supportedStructure:'EXISTING_TWO_LEG_CDS_PDS_ENGINE_ONLY',structureSelected:null,accountBasis:'UNSELECTED',
    requestDraft:preparation.requestDraft,diagnostics:preparation.diagnostics.map(d=>({kind:d.kind,state:d.state,missingFields:d.missingFields})),enginePreview:preparation.enginePreview},
   admission:{status:'NOT_ADMITTED',blockers:gaps,quoteStatus:'NOT_BOUND_TO_THIS_TRACE',paperStatus:'NOT_RUN',fills:0,pnl:null},
   stageLinks:['SCAN','ORIGINAL_RESEARCH','PLAN_PREPARATION','ADMISSION'].map(stage=>({stage,traceId,eventRef,reviewHeadSha256:view.headSha256})),
   executionAllowed:false,paperAdmissionAllowed:false,planSaved:false};
 });
 return {version:'TECH36_CANDIDATE_TRACE_V1',scanTraceId,scanId:view.scanId,baseReceiptSha256:view.baseReceiptSha256,reviewHeadSha256:view.headSha256,recordedAt:view.recordedAt,
  checkedAt:at,mode:view.mode,state:selected.length?'SELECTED_RESEARCH_WITH_EXPLICIT_PLAN_REJECTION':'NO_SELECTED_EVENT',
  selectionAuthority:'EXISTING_VERIFIED_FIXED36_RANKING',ranking:ranking.map((r,index)=>({symbol:r.symbol,rank:index+1,category:r.category,score:r.coreScore,valuation:r.valuation??null,eventRef:r.eventId?hash([view.scanId,r.eventId]):null})),traces,
  sourceCalls:0,fileSystemWrites:0,newScan:false,newPrediction:false,fullPoolOpportunityScreenComplete:false,executionAllowed:false,paperAdmissionAllowed:false,
  limitations:['The existing source/review clocks and ranking are replayed; this is not a new autonomous market scan.',
   'No unbound plan, quote or account record is joined by symbol; missing here does not mean absent elsewhere.',
   'The current spread preparation engine checks empty bound inputs; no strategy, account assumptions or decision time is synthesized.']};
}
