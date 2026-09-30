import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {verifyGuidanceRecord} from './options-guidance-io.mjs';
import {explainDailyGuidance} from '../../src/engines/options-daily-guidance/OptionsGuidanceRationale.ts';
import {assessOptionsCapitalPolicy} from '../../src/engines/options-retail-feasibility/OptionsCapitalPolicy.ts';
import {dailyDecisionCards} from './options-decision-card.mjs';
import {predictionEvidenceCandidate} from './options-prediction-evidence.mjs';

const VERSION='OPTIONS_DECISION_EVIDENCE_PROJECTION_V1';
const BASE='data/runtime/options-decision-evidence';
const PE_BASE='data/runtime/options-prediction-evidence';
const fail=code=>{throw Error('DECISION_EVIDENCE_'+code);};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const canonical=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const parse=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));
const content=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!['identity','path','status'].includes(key)));
const guidancePath=(path,kind)=>typeof path==='string'&&new RegExp(`^data/runtime/options-daily-guidance/${kind}/\\d{4}-\\d{2}-\\d{2}/[A-Za-z0-9-]+\\.json$`).test(path);
const transientPredictionErrors=new Set(['PREDICTION_EVIDENCE_NO_PUBLISHED_GUIDANCE','PREDICTION_EVIDENCE_STALE_OR_MISMATCHED_EVIDENCE','PREDICTION_EVIDENCE_MISSING_CURRENT_EVIDENCE']);

function readGuidance(root,path,kind){
  if(!guidancePath(path,kind))fail('UNSAFE_REFERENCE');
  if(verifyGuidanceRecord(root,path).status!=='VERIFIED')fail('REFERENCE_INVALID');
  const value=parse(io.readBytes(root,path,8*1024*1024));
  if(value.kind!==kind||!canonical(value).equals(io.readBytes(root,path,8*1024*1024)))fail('REFERENCE_ENCODING');
  return value;
}
function readPrediction(root,provided){
  const path=provided?.path;
  if(typeof path!=='string'||!new RegExp(`^${PE_BASE}/[a-f0-9]{64}\\.json$`).test(path))fail('UNSAFE_PREDICTION_PATH');
  const bytes=io.readBytes(root,path,1024*1024),value=parse(bytes);
  if(!bytes.equals(canonical(value))||value.path!==path||value.version!=='OPTIONS_PREDICTION_EVIDENCE_PROJECTION_V1'||
    value.identity!==hash(content(value))||value.identity!==provided.identity||
    JSON.stringify(value)!==JSON.stringify(Object.fromEntries(Object.entries(provided).filter(([k])=>k!=='status'))))fail('PREDICTION_INTEGRITY');
  return value;
}
function boundInputs(root,provided){
  const pe=readPrediction(root,provided),p=pe.provenance;
  if(pe.kind!=='PREDICTION_EVIDENCE_CANDIDATE'||pe.authority!=='READ_ONLY_PROJECTION_NOT_CANONICAL_PREDICTION_LOG'||
    pe.canonicalPredictionEligible!==false||pe.executionAllowed!==false||pe.eventFacts?.version!=='OPTIONS_EVENT_FACTS_PROJECTION_V1'||
    !['sourceReads','marketCalls','externalModelCalls','accountCalls','positionCalls','orderCalls'].every(k=>pe[k]===0))fail('PREDICTION_AUTHORITY');
  const report=readGuidance(root,p?.report?.path,'reports');
  const capture=readGuidance(root,p?.capture?.path,'captures');
  const analysis=readGuidance(root,p?.analysis?.path,'analysis');
  if(report.inputFingerprint!==p.report.inputFingerprint||report.reportFingerprint!==p.report.reportFingerprint||report.recordedAt!==p.report.issuedAt||
    capture.inputFingerprint!==p.capture.inputFingerprint||capture.reportFingerprint!==p.capture.reportFingerprint||capture.report.capturedAt!==p.capture.capturedAt||
    analysis.inputFingerprint!==p.analysis.inputFingerprint||analysis.input.assessedAt!==p.analysis.assessedAt||
    report.input.captureAt!==capture.report.capturedAt||report.input.captureOrigin!==capture.report.origin||
    report.input.analyst?.path!==p.analysis.path||report.input.analyst?.assessedAt!==analysis.input.assessedAt||
    paperFingerprint(report.input.analyst?.assets)!==paperFingerprint(analysis.input.assets)||
    paperFingerprint(report.input.equities)!==paperFingerprint(capture.report.equities)||
    capture.report.quotes.some(q=>paperFingerprint(report.input.quotes.find(x=>x.id===q.id))!==paperFingerprint(q))||
    report.input.at<capture.recordedAt||report.input.at<analysis.recordedAt||analysis.input.assessedAt<capture.report.capturedAt)fail('BINDING_MISMATCH');
  if(pe.candidates?.length!==2||pe.candidates[0].symbol!=='GLD'||pe.candidates[1].symbol!=='IBIT'||
    analysis.input.assets?.length!==2||!['GLD','IBIT'].every(symbol=>analysis.input.assets.some(a=>a.symbol===symbol)))fail('SCOPE');
  for(const candidate of pe.candidates){
    const asset=analysis.input.assets.find(a=>a.symbol===candidate.symbol);
    if(JSON.stringify(candidate)!==JSON.stringify(predictionEvidenceCandidate(asset)))fail('PREDICTION_SCOPE');
  }
  return {pe,report,capture,analysis};
}
const artifactPath=(pe,report)=>`${BASE}/${hash([pe.path,pe.identity,pe.provenance.report.path,report.inputFingerprint,report.reportFingerprint])}.json`;

export function decisionEvidenceCandidate(card,peCandidate){
  if(card.symbol!==peCandidate.symbol)fail('CARD_SCOPE');
  const blockers=[...new Set([...peCandidate.blockingReasons,'NO_CONFIRMED_ENTRY_TRIGGER','NO_CONFIGURED_NUMERIC_EXITS','BROKER_FEES_UNCONFIRMED',...(!card.reviewCurrent?['ATTRIBUTED_ANALYSIS_NOT_CURRENT']:[])])];
  return {symbol:card.symbol,decision:'NO_TRADE',issuedDisposition:card.action,hostBias:peCandidate.hostBias,
    decisionReason:'NO_FROZEN_PLAN_OR_OWNER_AUTHORITY_FOR_CONDITIONAL_PREDICTION',
    directionCandidate:peCandidate.directionCandidate,conditionalWatch:{entryCondition:card.entryCondition,
      attributedInvalidation:card.invalidation,summary:card.summary,supporting:card.supporting,opposing:card.opposing,
      sources:card.sources,eventPlan:card.eventPlan,reviewCurrent:card.reviewCurrent??null},
    originalBlockers:card.blockers,blockingReasons:blockers,priceObservation:card.price,trendObservation:card.trend,
    referenceContracts:card.references.map(({contract,disposition,blockers,plan,costExample,rationale})=>({contract,disposition,blockers,
      illustrativePlan:plan,illustrativeCostExample:costExample,rationale,chosenTrade:false})),
    noContractReason:card.noContractReason,confirmedEntryTrigger:null,numericEntry:null,numericStop:null,numericTarget:null,
    risk:{approvedRiskCents:null,plannedRiskCents:null,fullPremiumExposureCents:null,confirmedStop:null},
    target:{approvedNetTargetCents:null,confirmedTarget:null},
    exactTimeExit:null,frozenPlan:null,selectedContract:null,fill:null,confidence:null,forecastHorizon:null,winProbability:null,
    brokerFeesConfirmed:false,executionAllowed:false,canonicalDecisionEligible:false,canonicalPredictionEligible:false,ownerAuthorityRequired:true};
}
function project(root,provided){
  const {pe,report}=boundInputs(root,provided);
  const input=report.input;
  const pinned={guidance:{data:{current:report.report,input,interpretation:input.analyst,rationale:explainDailyGuidance(input)}},
    focusedNews:{data:{sources:(input.sourceHealth??[]).map(s=>({id:s.id,status:s.status,observedAt:s.receivedAt,refreshOverdue:null,partial:null}))}}};
  const cards=dailyDecisionCards(pinned);
  if(cards.cards.length!==2||cards.cards[0].symbol!=='GLD'||cards.cards[1].symbol!=='IBIT')fail('CARD_SCOPE');
  const payload={version:VERSION,kind:'DECISION_EVIDENCE_CANDIDATE',authority:'READ_ONLY_PROJECTION_NOT_CANONICAL_DECISION',
    provenance:{predictionEvidence:{path:pe.path,identity:pe.identity},report:pe.provenance.report,capture:pe.provenance.capture,analysis:pe.provenance.analysis},
    eventFacts:pe.eventFacts,issuedAt:report.recordedAt,assessedAt:input.at,capitalPolicy:assessOptionsCapitalPolicy(input.settings),
    sourceHealth:cards.sourceHealth,candidates:cards.cards.map((card,i)=>decisionEvidenceCandidate({...card,reviewCurrent:cards.reviewCurrent},pe.candidates[i])),
    canonicalDecisionEligible:false,canonicalPredictionEligible:false,ownerAuthorityRequired:true,executionAllowed:false,
    sourceReads:0,marketCalls:0,externalModelCalls:0,accountCalls:0,positionCalls:0,orderCalls:0};
  return {...payload,identity:hash(payload),path:artifactPath(pe,report)};
}
export function validateDecisionEvidence(value,pe){
  if(!pe?.provenance?.report)fail('PREDICTION_BINDING');
  if(value?.version!==VERSION||value.kind!=='DECISION_EVIDENCE_CANDIDATE'||value.identity!==hash(content(value))||
    value.path!==artifactPath(pe,{inputFingerprint:pe.provenance.report.inputFingerprint,reportFingerprint:pe.provenance.report.reportFingerprint})||
    value.provenance?.predictionEvidence?.path!==pe?.path||value.provenance.predictionEvidence.identity!==pe.identity||
    JSON.stringify(value.provenance.report)!==JSON.stringify(pe.provenance.report)||
    JSON.stringify(value.provenance.capture)!==JSON.stringify(pe.provenance.capture)||
    JSON.stringify(value.provenance.analysis)!==JSON.stringify(pe.provenance.analysis)||
    JSON.stringify(value.eventFacts)!==JSON.stringify(pe.eventFacts)||
    value.canonicalDecisionEligible!==false||value.canonicalPredictionEligible!==false||value.ownerAuthorityRequired!==true||value.executionAllowed!==false||
    !['sourceReads','marketCalls','externalModelCalls','accountCalls','positionCalls','orderCalls'].every(k=>value[k]===0)||
    value.candidates?.length!==2||value.candidates[0].symbol!=='GLD'||value.candidates[1].symbol!=='IBIT')fail('VALIDATION');
  for(let i=0;i<2;i++){
    const c=value.candidates[i],p=pe.candidates[i];
    if(c.decision!=='NO_TRADE'||c.decisionReason!=='NO_FROZEN_PLAN_OR_OWNER_AUTHORITY_FOR_CONDITIONAL_PREDICTION'||
      c.risk?.approvedRiskCents!==null||c.risk.plannedRiskCents!==null||c.risk.fullPremiumExposureCents!==null||c.risk.confirmedStop!==null||
      c.target?.approvedNetTargetCents!==null||c.target.confirmedTarget!==null||
      c.hostBias!==p.hostBias||c.directionCandidate!==p.directionCandidate||
      c.executionAllowed!==false||c.canonicalDecisionEligible!==false||c.canonicalPredictionEligible!==false||c.ownerAuthorityRequired!==true||
      c.confidence!==null||c.forecastHorizon!==null||c.winProbability!==null||c.frozenPlan!==null||c.selectedContract!==null||c.fill!==null||
      c.confirmedEntryTrigger!==null||c.numericEntry!==null||c.numericStop!==null||c.numericTarget!==null||c.exactTimeExit!==null||
      c.brokerFeesConfirmed!==false||!['NO_FORECAST_HORIZON','NO_FROZEN_PLAN','OWNER_AUTHORITY_REQUIRED','NO_CONFIRMED_ENTRY_TRIGGER','NO_CONFIGURED_NUMERIC_EXITS','BROKER_FEES_UNCONFIRMED'].every(b=>c.blockingReasons.includes(b))||
      (['MIXED','INSUFFICIENT_EVIDENCE'].includes(c.hostBias)&&c.directionCandidate!==null)||
      c.referenceContracts.some(r=>r.chosenTrade!==false||r.illustrativeCostExample!==null&&r.illustrativeCostExample?.brokerFeesConfirmed!==false))fail('CANDIDATE_VALIDATION');
  }
  return {status:'VERIFIED',identity:value.identity,path:value.path,candidateCount:2,executionAllowed:false};
}
function verifyStored(root,path,pe,expected){
  if(typeof path!=='string'||!new RegExp(`^${BASE}/[a-f0-9]{64}\\.json$`).test(path))fail('UNSAFE_ARTIFACT_PATH');
  const bytes=io.readBytes(root,path,1024*1024),value=parse(bytes);
  if(!bytes.equals(canonical(value))||value.path!==path||JSON.stringify(value)!==JSON.stringify(expected))fail('ARTIFACT_INTEGRITY');
  validateDecisionEvidence(value,pe);
  return value;
}
export function verifyDecisionEvidenceArtifact(root,pe){
  const expected=project(root,pe);
  return verifyStored(root,expected.path,pe,expected);
}
export function materializeDecisionEvidence(root,pe){
  const expected=project(root,pe);
  io.directory(root,BASE);
  if(existsSync(resolve(root,expected.path)))return {...verifyStored(root,expected.path,pe,expected),status:'ALREADY_MATERIALIZED'};
  validateDecisionEvidence(expected,pe);
  io.writeExclusive(root,expected.path,canonical(expected));
  return {...verifyStored(root,expected.path,pe,expected),status:'MATERIALIZED'};
}
export function decisionEvidenceView(root,state){
  const dependency=state.predictionEvidence;
  if(dependency?.state==='MISSING'||dependency?.state==='BLOCKED'&&!transientPredictionErrors.has(dependency.error))fail('PREDICTION_DEPENDENCY_BLOCKED');
  const pe=dependency?.data;
  if(dependency?.state!=='AVAILABLE'||pe?.status==='NOT_MATERIALIZED'||!pe?.path){
    const reason=pe?.status==='NOT_MATERIALIZED'?'PREDICTION_EVIDENCE_NOT_MATERIALIZED':
      dependency?.error==='PREDICTION_EVIDENCE_NO_PUBLISHED_GUIDANCE'?'PREDICTION_EVIDENCE_UNAVAILABLE':dependency?.error??'PREDICTION_EVIDENCE_UNAVAILABLE';
    return {version:VERSION,status:'NOT_MATERIALIZED',reason,executionAllowed:false};
  }
  const expected=project(root,pe);
  if(!existsSync(resolve(root,expected.path)))return {version:VERSION,status:'NOT_MATERIALIZED',reason:'CURRENT_PREDICTION_EVIDENCE_HAS_NO_DECISION_ARTIFACT',predictionEvidenceIdentity:pe.identity,executionAllowed:false};
  return {...verifyStored(root,expected.path,pe,expected),status:'MATERIALIZED'};
}
