import {existsSync,openSync,closeSync,unlinkSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {paperFingerprint as fp} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {snapshotNs as ns} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {manualUsdUnits,validateManualLedgerCommand} from '../../src/engines/options-manual-ledger/OptionsManualLedger.ts';
import {assessTradeThesis,validateThesisOwnerEvidence} from '../../src/engines/options-manual-ledger/OptionsTradeThesis.ts';
import {PredictionLog} from '../../src/engines/prediction-log/PredictionLog.ts';
import {createPredictionId} from '../../src/contracts/PredictionValidation.ts';
import {LocalNdjsonPredictionLogRepository} from '../../src/repositories/LocalNdjsonPredictionLogRepository.ts';
import {AlphaJournal} from '../../src/engines/alpha-journal/AlphaJournal.ts';
import {LocalNdjsonAlphaJournalRepository} from '../../src/repositories/LocalNdjsonAlphaJournalRepository.ts';
import {createAlphaJournalEntryId} from '../../src/contracts/AlphaJournalValidation.ts';
import {readManualLedger} from '../options-manual-ledger.mjs';
import {readSourceRecord,saveSourceRecord,sourceRecordFiles,sourceComparisonRecords,verifySourceHandoff} from './options-source-comparison.mjs';
import {verifyNewPlanExpectation} from './options-market-expectation-io.mjs';
import {verifyNewPlanScenario} from './options-scenario-research.mjs';

import {assessContractFit} from '../../src/engines/options-retail-feasibility/OptionsScenarioResearch.ts';

// Options adapter only. The ledger, Prediction Log and Alpha Journal remain the authorities.
const BASE='data/runtime/options-macro-comparisons/',PRED='data/runtime/prediction-log',JOURNAL='data/runtime/alpha-journal';
const fail=c=>{throw Error('WORKBENCH_EVIDENCE_'+c);};
const id=v=>{if(typeof v!=='string'||!/^[a-z0-9][a-z0-9-]{2,79}$/.test(v))fail('ID');return v;};
const text=(v,max=1500)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f]/.test(v))fail('TEXT');return v;};
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==keys.split(',').sort().join())fail('FIELDS');};
const key=(kind,v)=>kind+'-'+fp(v).slice(7,47);
const recordPath=(kind,v)=>BASE+'source-'+kind+'-'+v+'.json';
const planBasis=c=>{const plan=structuredClone(c.plan);delete plan.predictionEvidence;return fp({tradeId:c.tradeId,contract:c.contract,plan,activityReference:c.activityReference??null});};
const safeRead=(root,path)=>{try{const st=lstatSync(resolve(root,path));if(!st.isFile()||st.isSymbolicLink())fail('UNSAFE_STORE');return io.readBytes(root,path,32*1024*1024);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
function predictionRepo(root,ledgerId,write=false){
  id(ledgerId);const path=PRED+'/'+ledgerId+'.ndjson',bytes=safeRead(root,path);
  if(bytes&&bytes.toString().split('\n').length>1001)fail('STORE_BOUND');
  if(write&&bytes&&bytes.toString().split('\n').length>990)fail('STORE_BOUND');
  return new LocalNdjsonPredictionLogRepository(resolve(root,path));
}
function journalRepo(root,ledgerId,write=false){
  id(ledgerId);const bytes=safeRead(root,JOURNAL+'/'+ledgerId+'.ndjson');
  if(!bytes&&!write)return null;
  if(bytes&&bytes.toString().split('\n').length>(write?990:1001))fail('STORE_BOUND');
  if(write)io.directory(root,JOURNAL);
  return new LocalNdjsonAlphaJournalRepository(resolve(root,JOURNAL),ledgerId);
}
function exclusive(root,ledgerId,operation){
  io.directory(root,PRED);const path=resolve(root,PRED,id(ledgerId)+'.lock');let fd;
  try{fd=openSync(path,'wx');}catch{fail('STORE_BUSY');}
  try{return operation();}finally{closeSync(fd);unlinkSync(path);}
}
const references=r=>({path:r.path,fingerprint:r.fingerprint,savedAt:r.savedAt});
function checkProspective(c,report,at){
  const t=c.plan?.invalidation;if(!t)fail('THESIS_REQUIRED');
  if(ns(at)>=ns(t.realizationStartAt)||ns(at)>=ns(t.realizationEndAt)||!c.plan.entryDeadlineAt||ns(at)>=ns(c.plan.entryDeadlineAt))fail('PRE_ENTRY_PREDICTION_UNAVAILABLE');
  if(t.conditions.some(x=>x.releaseAt&&ns(x.releaseAt)<=ns(at)))fail('RESULT_WINDOW_ALREADY_OPEN');
  // Even a later void/correction cannot make a known historical entry prospective again.
  if((report.events??[]).some(e=>e.command.tradeId===c.tradeId&&['RECORD_FILL','CORRECT_FILL'].includes(e.command.type)))fail('PRE_ENTRY_PREDICTION_UNAVAILABLE');
  if(report.trades.some(t=>t.tradeId===c.tradeId&&t.contractsBought>0))fail('PRE_ENTRY_PREDICTION_UNAVAILABLE');
}
export function preparePredictionEvidence(root,ledgerId,command,forecast,state,at){
  if(command?.type!=='REGISTER_TRADE'||!command.plan||command.plan.predictionEvidence)fail('NEW_PLAN_REQUIRED');
  validateManualLedgerCommand(command,at);exact(forecast,'direction,catalyst,assumptions,owner');
  if(!['UP','DOWN','NEUTRAL','RANGE_BOUND'].includes(forecast.direction))fail('DIRECTION_REQUIRED');
  text(forecast.catalyst);text(forecast.assumptions);text(forecast.owner,100);
  const raw=readManualLedger(root,ledgerId,()=>at),report={...raw.report,events:raw.input.events};
  if(report.trades.some(t=>t.tradeId===command.tradeId))fail('FROZEN_PLAN_IMMUTABLE');
  checkProspective(command,report,at);
  verifyNewPlanExpectation(root,ledgerId,command,at);verifyNewPlanScenario(root,ledgerId,command,at);
  const previousPath=recordPath('prediction',key('intent',{ledgerId,requestId:command.requestId}));
  if(existsSync(resolve(root,previousPath))){const old=readSourceRecord(root,previousPath);if(old.payload.basePlanFingerprint!==planBasis(command)||fp(old.payload.forecast)!==fp(forecast))fail('INTENT_CONFLICT');return {command:{...command,plan:{...command.plan,predictionEvidence:{path:old.path,fingerprint:old.fingerprint}}},predictionPreview:{...old.payload,intent:references(old),statement:command.plan.thesis},executionAllowed:false};}
  const t=command.plan.invalidation,scenario=t.scenarioSet?readSourceRecord(root,t.scenarioSet.path):null;
  const expectation=t.expectationSnapshot?readSourceRecord(root,t.expectationSnapshot.path):null;
  const comparisons=sourceComparisonRecords(root,ledgerId,at).records.filter(r=>r.kind==='saved'&&(r.path===expectation?.payload.request?.comparisonPath||r.payload.assessment.bindings.some(b=>b.tradeId===command.tradeId))).map(references);
  const candidate=state.candidateChecks?.data?.current?.rows.find(r=>r.contract.id===scenario?.payload.selectedQuote?.id);
  const fit=scenario?assessContractFit({at,context:{key:scenario.payload.request.planKey,version:scenario.payload.request.planVersion,kind:'DRAFT',tradeId:command.tradeId,plan:command.plan,contract:command.contract,registeredAt:at},quote:scenario.payload.selectedQuote,sensitivity:state.guidanceSensitivities?.data?.rows.find(r=>r.id===scenario.payload.selectedQuote?.id),settings:state.guidance?.data?.input?.settings,originalBlockers:candidate?.originalBlockers??['GUIDANCE_UNAVAILABLE'],quantity:scenario.payload.request.quantity}):null;
  const payload={version:'OPTIONS_PREDICTION_INTENT_V1',ledgerId,tradeId:command.tradeId,basePlanFingerprint:planBasis(command),forecast,
    thesisVersion:fp(t),expectation:expectation?references(expectation):null,scenario:scenario?references(scenario):null,sourceComparisons:comparisons,
    contractFit:fit,contractFitFingerprint:fit?fp(fit):null,strategyVersion:null,strategyStatus:'UNAVAILABLE_NO_OPTIONS_STRATEGY_VERSION_LINK',
    confidence:null,confidenceProvenance:'NOT_RECORDED_NO_CALIBRATION_INFERRED',horizonStartAt:t.realizationStartAt,horizonEndAt:t.realizationEndAt,
    eventApproach:t.eventEntry?.phase??'NOT_CONFIGURED',events:t.conditions.filter(c=>c.eventKey).map(c=>({conditionId:c.id,eventKey:c.eventKey,releaseAt:c.releaseAt})),
    invalidationReference:{decisionId:t.decisionId,thesisFingerprint:fp(t)},sourceClocks:[expectation,scenario].filter(Boolean).map(references),
    evidenceClocks:{expectations:(expectation?.payload.request.rows??[]).flatMap(row=>row.forecasts.map(f=>({metric:row.subject.metric,forecastId:f.id,publishedAt:f.publishedAt,receivedAt:f.receivedAt}))),
      selectedQuote:scenario?.payload.selectedQuote?{sourceAt:scenario.payload.selectedQuote.updatedAt,receivedAt:scenario.payload.selectedQuote.receivedAt}:null}};
  const r=saveSourceRecord(root,'prediction',key('intent',{ledgerId,requestId:command.requestId}),payload,at);
  return {command:{...command,plan:{...command.plan,predictionEvidence:{path:r.path,fingerprint:r.fingerprint}}},predictionPreview:{...payload,intent:references(r),statement:command.plan.thesis},executionAllowed:false};
}
export function verifyPredictionIntent(root,ledgerId,c,at){
  const ref=c.plan?.predictionEvidence;if(!ref)return null;
  const r=readSourceRecord(root,ref.path),p=r.payload;
  if(r.kind!=='prediction'||r.fingerprint!==ref.fingerprint||p.version!=='OPTIONS_PREDICTION_INTENT_V1'||p.ledgerId!==ledgerId||p.tradeId!==c.tradeId||p.basePlanFingerprint!==planBasis(c)||ns(r.savedAt)>ns(at))fail('INTENT_CONFLICT');
  for(const link of [...p.sourceClocks,...p.sourceComparisons]){const source=readSourceRecord(root,link.path);if(source.fingerprint!==link.fingerprint||source.savedAt!==link.savedAt||ns(source.savedAt)>ns(r.savedAt))fail('REFERENCE_CHANGED');}
  return r;
}
function predictionSnapshot(trade,intent){
  const p=intent.payload,refs=[...p.sourceComparisons,...[p.expectation,p.scenario].filter(Boolean)];
  return {manualOrigin:{kind:'OWNER_CONFIRMED_OPTIONS_PLAN',planId:trade.tradeId,planFingerprint:trade.planFingerprint,intentReference:intent.path},
    createdAt:trade.registeredAt,predictionType:'ETF',market:'US',ticker:trade.contract.symbol,category:'ETF',statement:trade.plan.thesis,
    expectedDirection:p.forecast.direction,confidence:null,expectedTimeHorizon:p.horizonStartAt+' / '+p.horizonEndAt,expectedCatalyst:p.forecast.catalyst,
    evidence:{supportingEvidence:[p.forecast.assumptions,'Original invalidation: '+p.invalidationReference.thesisFingerprint],
      researchReferences:refs.map(r=>({researchId:r.fingerprint,researchVersion:r.fingerprint})),journalReferences:[],auditReferences:[{auditId:intent.fingerprint,traceId:intent.path},{auditId:trade.planFingerprint}],strategyReferences:[],tradeReferences:[{tradeId:trade.tradeId}],reviewReferences:[]},
    version:{predictionVersion:'options-evidence-v1',schemaVersion:'1.0'},strategy:null,decisionSnapshot:null,owner:p.forecast.owner,aiVersion:null,reviewRequired:true};
}
function linkContext(root,ledgerId,tradeId,at){
  const raw=readManualLedger(root,ledgerId,()=>at),report={...raw.report,events:raw.input.events},trade=report.trades.find(t=>t.tradeId===tradeId);
  if(!trade?.plan?.predictionEvidence)fail('PRE_ENTRY_PREDICTION_UNAVAILABLE');
  const c=raw.input.events.find(e=>e.command.type==='REGISTER_TRADE'&&e.command.tradeId===tradeId).command,intent=verifyPredictionIntent(root,ledgerId,c,at),snapshot=predictionSnapshot(trade,intent);
  const repo=predictionRepo(root,ledgerId),predictionId=createPredictionId(snapshot),prediction=repo.getById(predictionId);
  if(repo.query().some(p=>p.manualOrigin?.planId===tradeId&&p.predictionId!==predictionId))fail('PREDICTION_CONFLICT');
  return {raw,report,trade,c,intent,snapshot,repo,predictionId,prediction};
}
export function resumePredictionEvidence(root,ledgerId,tradeId,at){
  return exclusive(root,ledgerId,()=>{
    const x=linkContext(root,ledgerId,tradeId,at);
    if(x.prediction?.lockedAt)return {predictionId:x.predictionId,status:x.prediction.status,alreadyRecorded:true,executionAllowed:false};
    checkProspective(x.c,x.report,at);predictionRepo(root,ledgerId,true);
    const log=new PredictionLog(x.repo,{now:()=>at});let p=x.prediction??log.createDraft(x.snapshot);
    if(p.status==='DRAFT')p=log.submit(p.predictionId,at,'Owner Confirm & Freeze; exact immutable plan reference.');
    if(p.status==='SUBMITTED')p=log.lock(p.predictionId,at,'Recorded before reported entry and original outcome window; no trading permission.');
    return {predictionId:p.predictionId,status:p.status,lockedAt:p.lockedAt,executionAllowed:false};
  });
}
export function finishFrozenPrediction(root,ledgerId,command,at){
  if(command.type!=='REGISTER_TRADE'||!command.plan?.predictionEvidence)return null;
  try{return resumePredictionEvidence(root,ledgerId,command.tradeId,at);}catch(e){return {status:'PREDICTION_EVIDENCE_PENDING',reason:e.message,tradeId:command.tradeId,executionAllowed:false};}
}
export function tradeEvidence(trade){
  // Read the existing cent/micro-dollar ledger result; never recalculate option economics here.
  const net=trade.closedTradeNetPnlUsd;
  const profitability=trade.contractsBought===0?'NOT_APPLICABLE':trade.status!=='CLOSED'||net===null?'INDETERMINATE':manualUsdUnits(net.startsWith('-')?net.slice(1):net)===0n?'BREAK_EVEN':net.startsWith('-')?'UNPROFITABLE':'PROFITABLE';
  return {authority:'OPTIONS_MANUAL_LEDGER_REPORT_V1',tradeId:trade.tradeId,reviewId:'manual-review:'+fp({plan:trade.planFingerprint,fills:trade.effectiveFills}).slice(7),
    execution:trade.contractsBought===0?'NO_TRADE':trade.status,profitability,netPnlUsd:trade.status==='CLOSED'?net:null,
    status:trade.status==='CLOSED'?'COMPLETE':trade.contractsBought===0?'NOT_APPLICABLE':'PENDING',
    reportedOnly:true,planTiming:trade.planTiming,candidateLessons:trade.candidateLessons.map(({recordedAt,...diagnostic})=>diagnostic),causalStatus:'NOT_ESTABLISHED',approvedKnowledge:false,
    executionFingerprint:fp(trade.effectiveFills),costKnown:net!==null,stopTargetPathKnown:trade.stopTargetPathKnown};
}
export function predictionTradeMatrix(accuracy,profitability){
  if(!['ACCURATE','INACCURATE'].includes(accuracy)||!['PROFITABLE','UNPROFITABLE'].includes(profitability))return 'MIXED_OR_UNSCORABLE';
  return 'PREDICTION_'+(accuracy==='ACCURATE'?'CORRECT':'INCORRECT')+' + TRADE_'+profitability;
}
function transitionRecovery(repo,p,status,at,referenceId){
  repo.appendHistory({historyId:p.predictionId+':history:'+(p.history.length+1),predictionId:p.predictionId,sequence:p.history.length+1,fromStatus:p.status,toStatus:status,occurredAt:at,reason:'Resume already saved evidence; original snapshot unchanged.',referenceId},at);
}
function outcomeDraft(root,x,r,at){
  exact(r,'id,tradeId,kind,symbol,source,sourceAt,receivedAt,actualDirection,result,eventEvidence');id(r.id);text(r.result);text(r.source,2048);
  if(!x.prediction?.lockedAt)fail('LOCK_REQUIRED');
  if(x.trade.openedAt&&ns(x.trade.openedAt)<=ns(x.prediction.lockedAt))fail('PRE_ENTRY_PREDICTION_UNAVAILABLE');
  if(ns(at)<ns(x.intent.payload.horizonEndAt))fail('HORIZON_PENDING');
  if(r.symbol!==x.trade.contract.symbol||!['OWNER_QUALITATIVE','EVENT_NUMERIC'].includes(r.kind)||!['UP','DOWN','NEUTRAL','RANGE_BOUND','UNKNOWN'].includes(r.actualDirection))fail('OUTCOME_IDENTITY');
  if(ns(r.sourceAt)>ns(r.receivedAt)||ns(r.receivedAt)>ns(at)||ns(r.sourceAt)<ns(x.prediction.lockedAt))fail('OUTCOME_CLOCK');
  let factCheck=null;
  if(r.kind==='EVENT_NUMERIC'){
    const e={...r.eventEvidence,savedAt:at,confirmation:'OWNER_CONFIRMED'};validateThesisOwnerEvidence(e,at);
    if(e.source!==r.source||e.sourceAt!==r.sourceAt||e.receivedAt!==r.receivedAt)fail('OUTCOME_CLOCK');
    if(e.comparisonRef)verifySourceHandoff(root,{plan:x.trade.plan},e,at);
    const c=x.trade.plan.invalidation.conditions.find(c=>c.id===e.conditionId&&c.kind==='EVENT_NUMERIC');if(!c)fail('OUTCOME_CONDITION');
    factCheck=assessTradeThesis(x.trade,{origin:x.report.origin,attentionReasons:[],checks:{time:'NOT_DUE',stop:'UNKNOWN',target:'UNKNOWN'}},at,[e],{price:null,bars:null,gaps:[]}).checks.find(c=>c.id===e.conditionId);
    if(!factCheck||['UNKNOWN','PENDING'].includes(factCheck.status))fail('OUTCOME_FACT_UNQUALIFIED');
  }else{if(r.eventEvidence!==null||ns(r.sourceAt)<ns(x.intent.payload.horizonEndAt))fail('OUTCOME_HORIZON_EVIDENCE');}
  return {request:r,predictionId:x.predictionId,planFingerprint:x.trade.planFingerprint,factCheck,attribution:'OWNER_CONFIRMED_NOT_MACHINE_VERIFIED',forecastScope:x.prediction.expectedTimeHorizon};
}
function reviewDraft(x,r){
  exact(r,'id,tradeId,accuracy,rationale');id(r.id);text(r.rationale);
  if(!x.repo.getOutcome(x.predictionId))fail('OUTCOME_REQUIRED');
  if(x.trade.openedAt&&ns(x.trade.openedAt)<=ns(x.prediction.lockedAt))fail('PRE_ENTRY_PREDICTION_UNAVAILABLE');
  if(!['ACCURATE','INACCURATE','PARTIALLY_ACCURATE','INDETERMINATE'].includes(r.accuracy))fail('ACCURACY');
  if(x.repo.getOutcome(x.predictionId).actualDirection==='UNKNOWN'&&r.accuracy!=='INDETERMINATE')fail('UNSCORABLE_OUTCOME');
  return {request:r,predictionId:x.predictionId,execution:tradeEvidence(x.trade),ledgerHead:x.raw.headSha256,attribution:'OWNER_REVIEW_NOT_CAUSAL_PROOF'};
}
const journalRef=(referenceId,recordType,version)=>({referenceId,recordType,resolution:'RESOLVED',...(version?{version}:{})});
function journalDraft(x,r,at){
  exact(r,'id,tradeId,interpretation,assumptions,uncertainty,rationale,planAdherence,followUp,attribution');id(r.id);
  for(const k of ['interpretation','assumptions','uncertainty','rationale','planAdherence','followUp'])text(r[k]);
  if(!['PREDICTION','RESEARCH','INSTRUMENT_SELECTION','EXECUTION','RISK_MANAGEMENT','MARKET_REGIME','UNEXPECTED_EVENT','BEHAVIOR','LUCK','UNKNOWN'].includes(r.attribution))fail('ATTRIBUTION');
  const review=x.repo.getReview(x.predictionId),execution=tradeEvidence(x.trade);
  if(!review||x.prediction.status!=='REVIEWED'||x.trade.status!=='CLOSED')fail('CLOSED_AND_REVIEWED_REQUIRED');
  const predictionRef=journalRef(x.predictionId,'PREDICTION'),p=x.intent.payload;
  const snapshot={schemaVersion:'1.0',createdAt:at,eventTimestamp:x.trade.lastExecutionAt,entryType:'POST_TRADE_REVIEW',title:'Options post-trade review: '+x.trade.tradeId,
    content:{factualObservations:['Owner-reported ledger: '+execution.execution+'; net P&L '+(execution.netPnlUsd??'UNKNOWN')+' USD.','Owner-reviewed prediction: '+review.accuracy+'.','Plan adherence evidence: '+x.trade.planTiming+'; stop/target path UNKNOWN.'],
      interpretation:r.interpretation,assumptions:[r.assumptions],uncertainty:r.uncertainty,decisionRationale:r.rationale,plannedAction:r.followUp,actualActionReference:execution.reviewId,expectedOutcome:x.prediction.statement,riskNotes:[r.planAdherence,'Candidate attribution only: '+r.attribution+'; causal status NOT_ESTABLISHED.']},
    market:'US',ticker:x.trade.contract.symbol,tags:['options','post-trade-review'],ownerReference:x.prediction.owner,authorType:'OWNER',privacyLevel:'LOCAL_ONLY',retention:'PERMANENT',
    evidence:{predictions:[predictionRef],research:x.prediction.evidence.researchReferences.map(v=>journalRef(v.researchId,'RESEARCH',v.researchVersion)),decisions:[journalRef(x.trade.planFingerprint,'DECISION')],trades:[journalRef(x.trade.tradeId,'TRADE')],strategies:[],portfolios:[],audits:[journalRef(review.reviewId,'AUDIT'),journalRef(execution.reviewId,'AUDIT'),journalRef(x.intent.fingerprint,'AUDIT')],journalEntries:[],developmentValidations:[]},
    context:{capturedAt:at,prediction:predictionRef,policyVersions:{optionsEvidence:'v1'},sourceDataTimestamps:{prediction:x.prediction.createdAt,review:review.completedAt},ownerDecisionState:'EXPLICIT_POST_TRADE_REVIEW'},
    correlationId:x.trade.tradeId,traceId:'options-review:'+r.id,metadata:{approvedKnowledge:false,causalStatus:'NOT_ESTABLISHED',candidateAttribution:r.attribution,strategyVersion:p.strategyVersion,executionFingerprint:execution.executionFingerprint,predictionReviewId:review.reviewId}};
  return {request:r,predictionId:x.predictionId,ledgerHead:x.raw.headSha256,snapshot};
}
export function evidenceAction(root,ledgerId,body,at){
  exact(body,'action,request,previewFingerprint,ownerConfirmed');const {action,request:r}=body;
  if(action==='RESUME'){exact(r,'tradeId');return resumePredictionEvidence(root,ledgerId,r.tradeId,at);}
  const kind=action.endsWith('_OUTCOME')?'outcome':action.endsWith('_REVIEW')?'review':action.endsWith('_JOURNAL')?'journal':null;
  if(!kind||!['PREVIEW_'+kind.toUpperCase(),'SAVE_'+kind.toUpperCase()].includes(action))fail('ACTION');
  return exclusive(root,ledgerId,()=>{
    const x=linkContext(root,ledgerId,r.tradeId,at),path=recordPath(kind,key(kind,{ledgerId,id:r.id}));
    const old=existsSync(resolve(root,path))?readSourceRecord(root,path):null;
    if(old&&(fp(old.payload.request)!==fp(r)||old.payload.predictionId!==x.predictionId))fail('RETRY_CONFLICT');
    const draft=old?.payload??(kind==='outcome'?outcomeDraft(root,x,r,at):kind==='review'?reviewDraft(x,r):journalDraft(x,r,at));
    // Preview has no authority or write; explicit save retains an intent for interrupted-write recovery.
    const stable=kind==='journal'?{...draft,snapshot:{...draft.snapshot,createdAt:null,context:{...draft.snapshot.context,capturedAt:null}}}:draft;
    const previewFingerprint=fp(stable);
    if(action.startsWith('PREVIEW_'))return {draft,previewFingerprint,executionAllowed:false};
    if(body.ownerConfirmed!==true)fail('OWNER_CONFIRMATION_REQUIRED');
    if(body.previewFingerprint!==previewFingerprint)fail('PREVIEW_CHANGED');
    const saved=old??saveSourceRecord(root,kind,key(kind,{ledgerId,id:r.id}),draft,at),now=saved.savedAt;
    predictionRepo(root,ledgerId,true);const log=new PredictionLog(x.repo,{now:()=>at});
    if(kind==='outcome'){
      const value={outcomeId:saved.fingerprint,predictionId:x.predictionId,knownAt:now,marketTimestamp:r.sourceAt,actualDirection:r.actualDirection,actualResult:r.result,evidenceReferences:[{auditId:saved.fingerprint,traceId:saved.path}]};
      const previous=x.repo.getOutcome(x.predictionId);if(previous&&fp(previous)!==fp(value))fail('OUTCOME_IMMUTABLE');
      if(!previous)log.recordOutcome(value);else if(x.prediction.status==='LOCKED')transitionRecovery(x.repo,x.prediction,'OUTCOME_KNOWN',value.knownAt,value.outcomeId);
    }else if(kind==='review'){
      const previous=x.repo.getReview(x.predictionId),outcome=x.repo.getOutcome(x.predictionId);
      const review={reviewId:saved.fingerprint,predictionId:x.predictionId,outcomeId:outcome.outcomeId,startedAt:now,completedAt:now,reviewer:x.prediction.owner,status:'COMPLETED',accuracy:r.accuracy,profitability:saved.payload.execution.profitability,
        result:{ACCURATE:'VALIDATED',INACCURATE:'INVALIDATED',PARTIALLY_ACCURATE:'PARTIALLY_VALIDATED',INDETERMINATE:'INCONCLUSIVE'}[r.accuracy],score:null,accuracyRationale:r.rationale,profitabilityRationale:'Independent Owner-reported ledger result at '+saved.payload.ledgerHead+'; later corrections remain separate.',lessonReferences:[]};
      if(previous&&fp(previous)!==fp(review))fail('REVIEW_IMMUTABLE');
      if(!previous){if(!x.repo.getReviewStart(x.predictionId))log.beginReview({reviewId:review.reviewId,predictionId:x.predictionId,outcomeId:outcome.outcomeId,startedAt:now,reviewer:review.reviewer,status:'STARTED'});log.completeReview(review);}
      else if(x.prediction.status==='OUTCOME_KNOWN')transitionRecovery(x.repo,x.prediction,'REVIEWED',review.completedAt,review.reviewId);
    }else{
      const repo=journalRepo(root,ledgerId,true),entryId=createAlphaJournalEntryId(saved.payload.snapshot);
      if(!repo.getById(entryId)){
        if(saved.payload.ledgerHead!==x.raw.headSha256)fail('LEDGER_CHANGED_REVIEW_AGAIN');
        new AlphaJournal(repo,{now:()=>at}).finalize(saved.payload.snapshot);
      }
    }
    return {path:saved.path,fingerprint:saved.fingerprint,predictionId:x.predictionId,alreadyRecorded:!!old,executionAllowed:false};
  });
}
export function evidenceLoopView(root,ledgerId,report,at){
  if(!report)return {rows:[],drafts:[],executionAllowed:false};
  const repo=predictionRepo(root,ledgerId),journal=journalRepo(root,ledgerId),records=[];
  for(const f of sourceRecordFiles(root).filter(f=>/^source-(outcome|review|journal)-/.test(f))){const r=readSourceRecord(root,BASE+f);if(ns(r.savedAt)<=ns(at))records.push(r);}
  const rows=report.trades.map(trade=>{
    const base={tradeId:trade.tradeId,planStatus:trade.plan?'FROZEN':'NOT_CONFIGURED',planFingerprint:trade.planFingerprint,plan:trade.plan,contract:trade.contract,execution:tradeEvidence(trade),predictionStatus:'PRE_ENTRY_PREDICTION_UNAVAILABLE',prediction:null,outcome:null,review:null,journals:[],matrix:'MIXED_OR_UNSCORABLE'};
    if(!trade.plan?.predictionEvidence)return {...base,legacy:true};
    try{
      const c={type:'REGISTER_TRADE',tradeId:trade.tradeId,contract:trade.contract,plan:trade.plan,activityReference:report.events?.find(e=>e.command.type==='REGISTER_TRADE'&&e.command.tradeId===trade.tradeId)?.command.activityReference??null};
      const intent=verifyPredictionIntent(root,ledgerId,c,at),snapshot=predictionSnapshot(trade,intent),predictionId=createPredictionId(snapshot),prediction=repo.getById(predictionId),outcome=repo.getOutcome(predictionId),review=repo.getReview(predictionId);
      const related=records.filter(r=>r.payload.predictionId===predictionId),entries=related.filter(r=>r.kind==='journal').map(r=>({reference:references(r),entry:journal?.getById(createAlphaJournalEntryId(r.payload.snapshot))??null}));
      const timingValid=!trade.openedAt||!prediction?.lockedAt||ns(trade.openedAt)>ns(prediction.lockedAt);
      return {...base,timingValid,intent,predictionId,prediction:prediction??null,predictionStatus:prediction?.lockedAt?prediction.status:'PREDICTION_EVIDENCE_PENDING',outcome:outcome??null,review:review??null,journals:entries,records:related,
        matrix:timingValid?predictionTradeMatrix(review?.accuracy,base.execution.profitability):'MIXED_OR_UNSCORABLE',reviewProfitabilityIsHistorical:!!review&&review.profitability!==base.execution.profitability};
    }catch{return {...base,predictionStatus:'PREDICTION_EVIDENCE_PENDING',error:'Evidence reference unavailable or conflicted; frozen plan retained.'};}
  });
  const latest=new Map();for(const e of report.planRecords??[])if(e.command.type==='SAVE_PLAN_DRAFT'&&!report.trades.some(t=>t.tradeId===e.command.tradeId))latest.set(e.command.tradeId,{tradeId:e.command.tradeId,version:fp(e.command.draft),savedAt:e.savedAt,planStatus:'DRAFT',predictionStatus:'NOT_CREATED',reason:'Prediction evidence not locked because the trade plan is not frozen.'});
  return {rows,drafts:[...latest.values()],executionAllowed:false,marketCalls:0,modelCalls:0};
}
