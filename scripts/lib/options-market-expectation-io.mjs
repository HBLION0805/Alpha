import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {readSourceRecord,saveSourceRecord,sourceRecordFiles,sourcePlanOptions} from './options-source-comparison.mjs';
import {readManualLedger} from '../options-manual-ledger.mjs';
import {paperFingerprint as fp} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {validateExpectationRequest,assessExpectationSnapshot} from '../../src/engines/options-drivers/OptionsMarketExpectation.ts';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';

const BASE='data/runtime/options-macro-comparisons/';
const fail=code=>{throw Error('MACRO_EXPECTATION_'+code);};
const pathFor=id=>BASE+'source-expectation-'+id+'.json';
const eventCondition=plan=>plan.invalidation?.conditions.find(c=>c.id===plan.invalidation.eventEntry?.conditionId)??plan.invalidation?.conditions.find(c=>c.kind!=='PRICE'&&c.eventKey&&c.releaseAt);
export function verifyExpectation(root,path){
  const r=readSourceRecord(root,path),s=r.payload;
  if(r.kind!=='expectation'||s.version!=='OPTIONS_MARKET_EXPECTATION_V1'||s.frozenAt!==r.savedAt||s.receivedAt!==r.savedAt||s.request.id!==r.id)fail('INTEGRITY');
  if(Object.keys(s).sort().join()!=='attribution,frozenAt,ledgerId,ownerConfirmedAt,receivedAt,request,thesisFingerprint,version')fail('FIELDS');
  validateExpectationRequest(s.request,r.savedAt);
  if(s.ownerConfirmedAt!==(s.request.ownerConfirmed?r.savedAt:null)||s.attribution!==(s.request.ownerConfirmed?'OWNER_CONFIRMED':'HOST_OR_OWNER_RESEARCH'))fail('CONFIRMATION');
  const comparison=readSourceRecord(root,s.request.comparisonPath);
  if(comparison.kind!=='saved'||comparison.fingerprint!==s.request.comparisonFingerprint||comparison.payload.eventKey!==s.request.eventKey||comparison.payload.ledgerId!==s.ledgerId||snapshotNs(comparison.savedAt)>snapshotNs(r.savedAt))fail('COMPARISON_REFERENCE');
  const packageRecord=readSourceRecord(root,comparison.payload.packagePath),draft=readSourceRecord(root,comparison.payload.request.draftPath);
  if(packageRecord.fingerprint!==comparison.payload.packageFingerprint||draft.fingerprint!==comparison.payload.draftFingerprint)fail('COMPARISON_REFERENCE');
  if(s.request.supersedes){const prior=readSourceRecord(root,s.request.supersedes);if(prior.kind!=='expectation'||prior.payload.ledgerId!==s.ledgerId||prior.payload.request.eventKey!==s.request.eventKey||snapshotNs(prior.savedAt)>snapshotNs(r.savedAt))fail('REVISION');}
  return r;
}
function input(root,ledgerId,request,at){
  validateExpectationRequest(request,at);
  const report=readManualLedger(root,ledgerId,()=>at).report;
  const plan=sourcePlanOptions(report).find(p=>p.key===request.planKey&&p.version===request.planVersion);
  if(!plan)fail('PLAN_VERSION_UNAVAILABLE');
  const condition=eventCondition(plan.plan);
  if(!condition||condition.eventKey!==request.eventKey||condition.releaseAt!==request.releaseAt)fail('PLAN_EVENT_MISMATCH');
  const comparison=readSourceRecord(root,request.comparisonPath);
  if(comparison.kind!=='saved'||comparison.fingerprint!==request.comparisonFingerprint||comparison.payload.eventKey!==request.eventKey||comparison.payload.ledgerId!==ledgerId||snapshotNs(comparison.savedAt)>snapshotNs(at))fail('COMPARISON_REFERENCE');
  if(request.supersedes){
    const old=verifyExpectation(root,request.supersedes);
    if(old.payload.ledgerId!==ledgerId||old.payload.request.eventKey!==request.eventKey||snapshotNs(old.savedAt)>snapshotNs(at)||old.path===pathFor(request.id))fail('REVISION');
  }
  if(request.stage==='FINAL_PRE_ENTRY'&&(plan.kind!=='DRAFT'||report.trades.some(t=>t.tradeId===plan.tradeId)||!request.ownerConfirmed||snapshotNs(at)>=snapshotNs(request.releaseAt)))fail('FINAL_CONFIRMATION_OR_TIMING');
  const snapshot={version:'OPTIONS_MARKET_EXPECTATION_V1',ledgerId,request,frozenAt:at,receivedAt:at,
    thesisFingerprint:fp(plan.plan.thesis),ownerConfirmedAt:request.ownerConfirmed?at:null,
    attribution:request.ownerConfirmed?'OWNER_CONFIRMED':'HOST_OR_OWNER_RESEARCH'};
  return {plan,snapshot,comparison};
}
export function previewExpectation(root,ledgerId,request,at){
  const {plan,snapshot,comparison}=input(root,ledgerId,request,at);
  const assessment=assessExpectationSnapshot(snapshot,{at,eventKey:request.eventKey,releaseAt:request.releaseAt,thesisFingerprint:fp(plan.plan.thesis),planFrozenAt:null,openedAt:plan.openedAt});
  return {request,assessment,previewFingerprint:fp({request,planVersion:plan.version,comparisonFingerprint:comparison.fingerprint}),executionAllowed:false};
}
export function saveExpectation(root,ledgerId,request,previewFingerprint,at){
  validateExpectationRequest(request,at);
  if(existsSync(resolve(root,pathFor(request.id)))){
    const old=verifyExpectation(root,pathFor(request.id));
    if(old.payload.ledgerId!==ledgerId||fp(old.payload.request)!==fp(request))fail('RETRY_CHANGED');
    return {...old,alreadyRecorded:true};
  }
  const preview=previewExpectation(root,ledgerId,request,at);
  if(preview.previewFingerprint!==previewFingerprint)fail('PREVIEW_CHANGED');
  const {snapshot}=input(root,ledgerId,request,at);
  saveSourceRecord(root,'expectation',request.id,snapshot,at);
  return verifyExpectation(root,pathFor(request.id));
}
export function expectationRecords(root,ledgerId,at){
  const records=[],errors=[];
  for(const name of sourceRecordFiles(root).filter(f=>f.startsWith('source-expectation-'))){
    try{const r=verifyExpectation(root,BASE+name);if(r.payload.ledgerId===ledgerId&&snapshotNs(r.savedAt)<=snapshotNs(at))records.push(r);}
    catch{errors.push({path:BASE+name,status:'UNAVAILABLE_REFERENCE_OR_RECORD'});}
  }
  return {records,errors,marketCalls:0,automaticModelCalls:0,executionAllowed:false};
}
/** Called only for the referenced plan, never canonical guidance or an exit decision. */
export function expectationForPlan(plan,records,at,registeredAt=null,openedAt=null){
  const ref=plan.invalidation?.expectationSnapshot,c=eventCondition(plan);
  const base={status:'NOT_READY',rows:[],blockers:['FINAL_EXPECTATION_SNAPSHOT_MISSING','CONSENSUS_EXPECTATION_UNKNOWN','OWNER_EXPECTATION_NOT_CONFIRMED'],executionAllowed:false};
  if(!ref)return base;
  const r=records.find(r=>r.path===ref.path&&r.fingerprint===ref.fingerprint&&r.savedAt===ref.frozenAt);
  if(!r||!c)return {...base,blockers:['EXPECTATION_REFERENCE_UNAVAILABLE']};
  const result=assessExpectationSnapshot(r.payload,{at,eventKey:c.eventKey,releaseAt:c.releaseAt,thesisFingerprint:fp(plan.thesis),planFrozenAt:registeredAt,openedAt});
  for(const condition of plan.invalidation.conditions.filter(x=>x.kind==='EVENT_NUMERIC'&&x.eventKey===c.eventKey)){
    const rows=r.payload.request.rows.filter(row=>row.subject.metric===condition.metric);
    if(rows.length!==1)result.blockers.push('EXPECTATION_METRIC_MISMATCH');
    else for(const [field,code] of [['period','PERIOD'],['unit','UNIT'],['releaseVersion','VINTAGE']])if(rows[0].subject[field]!==condition[field])result.blockers.push('EXPECTATION_'+code+'_MISMATCH');
  }
  result.blockers=[...new Set(result.blockers)];result.status=result.blockers.length?'NOT_READY':'FINAL_REFERENCE_READY';
  return {...result,path:r.path,fingerprint:r.fingerprint};
}
/** New registrations are gated at the existing writer boundary; old event replay is unchanged. */
export function verifyNewPlanExpectation(root,ledgerId,command,at){
  if(command.type!=='REGISTER_TRADE'||command.plan?.invalidation?.eventEntry?.phase!=='PRE_EVENT')return;
  const r=expectationForPlan(command.plan,expectationRecords(root,ledgerId,at).records,at,at,null);
  if(r.blockers.length)fail(r.blockers[0]);
}
