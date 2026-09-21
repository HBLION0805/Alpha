import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {readSourceRecord,saveSourceRecord,sourceRecordFiles,sourcePlanOptions} from './options-source-comparison.mjs';
import {verifyExpectation} from './options-market-expectation-io.mjs';
import {readManualLedger} from '../options-manual-ledger.mjs';
import {paperFingerprint as fp} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {assessScenarioEV,assessContractFit,validateScenarioRows} from '../../src/engines/options-retail-feasibility/OptionsScenarioResearch.ts';
import {assessCandidateChecks} from '../../src/engines/options-daily-guidance/OptionsCandidateChecks.ts';
import {eventEntryContexts} from './options-candidate-checks-io.mjs';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
const BASE='data/runtime/options-macro-comparisons/';
const fail=c=>{throw Error('MACRO_SCENARIO_'+c);};
const pathFor=id=>BASE+'source-scenario-'+id+'.json';
const plain=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==keys.split(',').sort().join())fail('FIELDS');};
export function scenarioPlanContexts(report){
  return sourcePlanOptions(report).map(p=>{
    if(p.kind==='FROZEN')return p;
    const fields=report.planRecords.find(e=>'draft:'+e.command.requestId===p.key).command.draft.fields;
    const plan={...p.plan,declaredAt:fields.declaredAt??'',maxContracts:fields.maxContracts?Number(fields.maxContracts):null};
    for(const k of ['maxEntryDebitUsd','plannedRiskUsd','targetNetProfitUsd'])plan[k]=fields[k]??'';
    for(const k of ['stopPremiumUsd','entryDeadlineAt','timeExitAt'])plan[k]=fields[k]||null;
    const contract=['GLD','IBIT'].includes(fields.symbol)&&['CALL','PUT'].includes(fields.optionType)&&/^\d{4}-\d\d-\d\d$/.test(fields.expiry??'')&&/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(fields.strikeUsd??'')?{symbol:fields.symbol,expiry:fields.expiry,optionType:fields.optionType,strikeUsd:fields.strikeUsd,multiplier:100}:null;
    return {...p,plan,contract,fields};
  });
}
function basis(p){const plan=structuredClone(p.plan);delete plan.invalidation?.scenarioSet;delete plan.predictionEvidence;return fp({plan,contract:p.contract});}
function validateRequest(r){
  plain(r,'id,scenarioSetVersion,supersedes,planKey,planVersion,expectationSnapshotId,contractId,quantity,rows,note');
  for(const k of ['id','supersedes','planKey','planVersion','expectationSnapshotId','contractId','note'])if(typeof r[k]!=='string'||r[k].length>1500)fail('TEXT');
  if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(r.id)||!Number.isSafeInteger(r.scenarioSetVersion)||r.scenarioSetVersion<1||r.quantity!==null&&(!Number.isSafeInteger(r.quantity)||r.quantity<1||r.quantity>10000))fail('INPUT');
  validateScenarioRows(r.rows);
}
function expectation(root,r,p,ledgerId,at){
  if(!r.expectationSnapshotId){if(p.plan.invalidation?.expectationSnapshot)fail('EXPECTATION_REFERENCE_REQUIRED');return null;}
  if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(r.expectationSnapshotId))fail('EXPECTATION_ID');
  const e=verifyExpectation(root,BASE+'source-expectation-'+r.expectationSnapshotId+'.json');
  const c=p.plan.invalidation?.conditions.find(c=>c.eventKey===e.payload.request.eventKey&&c.releaseAt===e.payload.request.releaseAt);
  if(e.payload.ledgerId!==ledgerId||!c||e.payload.thesisFingerprint!==fp(p.plan.thesis)||snapshotNs(e.savedAt)>snapshotNs(at))fail('EXPECTATION_MISMATCH');
  const ref=p.plan.invalidation?.expectationSnapshot;
  if(ref&&(ref.path!==e.path||ref.fingerprint!==e.fingerprint||ref.frozenAt!==e.savedAt))fail('EXPECTATION_MISMATCH');
  return {id:e.id,path:e.path,fingerprint:e.fingerprint,savedAt:e.savedAt};
}
function current(root,ledgerId,r,at){
  validateRequest(r);
  const report=readManualLedger(root,ledgerId,()=>at).report,p=scenarioPlanContexts(report).find(p=>p.key===r.planKey&&p.version===r.planVersion);
  if(!p||snapshotNs(p.registeredAt)>snapshotNs(at))fail('PLAN_VERSION_UNAVAILABLE');
  const e=expectation(root,r,p,ledgerId,at);
  if(r.supersedes){const old=verifyScenario(root,r.supersedes,ledgerId,at);if(old.payload.planId!==p.tradeId||old.id===r.id||r.scenarioSetVersion!==old.payload.request.scenarioSetVersion+1)fail('REVISION');}
  else if(r.scenarioSetVersion!==1)fail('REVISION');
  return {p,e};
}
export function verifyScenario(root,path,ledgerId,at,ledgerReport=null){
  const r=readSourceRecord(root,path),s=r.payload;
  plain(s,'version,ledgerId,request,planId,planBasis,expectation,selectedQuote,sourcePaths,assessment');
  if(r.kind!=='scenario'||s.version!=='OPTIONS_SCENARIO_RESEARCH_V1'||s.ledgerId!==ledgerId||s.request.id!==r.id||snapshotNs(r.savedAt)>snapshotNs(at))fail('INTEGRITY');
  validateRequest(s.request);
  const p=scenarioPlanContexts(ledgerReport??readManualLedger(root,ledgerId,()=>at).report).find(p=>p.key===s.request.planKey&&p.version===s.request.planVersion);
  if(!p||p.tradeId!==s.planId||basis(p)!==s.planBasis||fp(expectation(root,s.request,p,ledgerId,r.savedAt))!==fp(s.expectation))fail('REFERENCE');
  const assessment=assessScenarioEV(s.request.rows,r.savedAt,p.plan.timeExitAt,p.contract?.expiry??null,s.request.quantity);
  if(fp(assessment)!==fp(s.assessment)||s.selectedQuote?.id!==(s.request.contractId||undefined))fail('RECOMPUTE');
  if(s.selectedQuote&&(!s.selectedQuote.updatedAt||!s.selectedQuote.receivedAt||snapshotNs(s.selectedQuote.updatedAt)>snapshotNs(r.savedAt)||snapshotNs(s.selectedQuote.receivedAt)>snapshotNs(r.savedAt)))fail('FUTURE_QUOTE');
  if(s.request.supersedes){const old=readSourceRecord(root,s.request.supersedes);if(old.kind!=='scenario'||old.payload.ledgerId!==ledgerId||old.payload.planId!==s.planId||old.payload.request.scenarioSetVersion+1!==s.request.scenarioSetVersion||snapshotNs(old.savedAt)>snapshotNs(r.savedAt))fail('REVISION');}
  return r;
}
export function scenarioRecords(root,ledgerId,at){const records=[],errors=[];
  for(const f of sourceRecordFiles(root).filter(f=>f.startsWith('source-scenario-'))){try{const raw=readSourceRecord(root,BASE+f);if(raw.payload.ledgerId===ledgerId&&snapshotNs(raw.savedAt)<=snapshotNs(at))records.push(verifyScenario(root,BASE+f,ledgerId,at));}catch{errors.push({path:BASE+f,status:'UNAVAILABLE_REFERENCE_OR_RECORD'});}}
  return {records,errors};
}
export function previewScenario(root,ledgerId,r,state,at){
  const {p,e}=current(root,ledgerId,r,at),q=r.contractId?(state.guidance?.data?.input?.quotes??[]).find(q=>q.id===r.contractId):null;
  if(r.contractId&&!q)fail('SAVED_QUOTE_UNAVAILABLE');
  if(q&&(!q.updatedAt||!q.receivedAt||snapshotNs(q.updatedAt)>snapshotNs(at)||snapshotNs(q.receivedAt)>snapshotNs(at)))fail('FUTURE_QUOTE');
  const assessment=assessScenarioEV(r.rows,at,p.plan.timeExitAt,p.contract?.expiry??null,r.quantity);
  const payload={version:'OPTIONS_SCENARIO_RESEARCH_V1',ledgerId,request:r,planId:p.tradeId,planBasis:basis(p),expectation:e,selectedQuote:q??null,sourcePaths:state.guidance?.data?.sourcePaths??[],assessment};
  // Clock changes do not authorize changed assumptions, selection, costs or source capture.
  return {payload,assessment,previewFingerprint:fp({r,basis:payload.planBasis,e,q,sourcePaths:payload.sourcePaths}),executionAllowed:false};
}
export function saveScenario(root,ledgerId,r,previewFingerprint,state,at){
  if(existsSync(resolve(root,pathFor(r.id)))){const old=verifyScenario(root,pathFor(r.id),ledgerId,at);if(fp(old.payload.request)!==fp(r))fail('RETRY_CHANGED');return {...old,alreadyRecorded:true};}
  const preview=previewScenario(root,ledgerId,r,state,at);if(preview.previewFingerprint!==previewFingerprint)fail('PREVIEW_CHANGED');
  saveSourceRecord(root,'scenario',r.id,preview.payload,at);return verifyScenario(root,pathFor(r.id),ledgerId,at);
}
export function verifyNewPlanScenario(root,ledgerId,command,at,ledgerReport=null){
  if(command.type!=='REGISTER_TRADE'||!command.plan?.invalidation?.scenarioSet)return;
  const ref=command.plan.invalidation.scenarioSet,r=verifyScenario(root,ref.path,ledgerId,at,ledgerReport),s=r.payload;
  if(ref.fingerprint!==r.fingerprint||ref.savedAt!==r.savedAt||s.planId!==command.tradeId||!s.request.planKey.startsWith('draft:')||s.planBasis!==basis({plan:command.plan,contract:command.contract}))fail('FROZEN_PLAN_MISMATCH');
  const q=s.selectedQuote,c=command.contract;
  if(!q||q.symbol!==c.symbol||q.type.toUpperCase()!==c.optionType||q.expiry!==c.expiry||Number(q.strike)!==Number(c.strikeUsd)||q.multiplier!==c.multiplier||s.request.quantity===null||s.request.quantity>command.plan.maxContracts)fail('FROZEN_SELECTION_MISMATCH');
}
export function contractFitView(state,planKey,planVersion,contractId,quantity){
  const context=scenarioPlanContexts(state.manual?.data).find(p=>p.key===planKey&&p.version===planVersion);if(!context)fail('PLAN_VERSION_UNAVAILABLE');
  if(quantity!==null&&(!Number.isSafeInteger(quantity)||quantity<1||quantity>10000))fail('QUANTITY');
  const input=state.guidance?.data?.input,q=(input?.quotes??[]).find(q=>q.id===contractId);
  if(contractId&&!q)fail('SAVED_QUOTE_UNAVAILABLE');
  let blockers=['GUIDANCE_UNAVAILABLE'];
  if(input){
    const event=eventEntryContexts(state).find(p=>p.key===planKey&&p.version===planVersion);
    const report=assessCandidateChecks({version:'OPTIONS_CANDIDATE_CHECKS_INPUT_V1',sourcePaths:state.guidance.data.sourcePaths,guidance:{...input,at:state.loadedAt,...(event?{eventPlan:{...event,contract:context.contract}}:{})}});
    const row=report.rows.find(row=>row.contract.id===contractId);blockers=row?.originalBlockers??['QUOTE_EVIDENCE_MISSING'];
  }
  return assessContractFit({at:state.loadedAt,context,quote:q??null,sensitivity:state.guidanceSensitivities?.data?.rows.find(x=>x.id===contractId),settings:input?.settings,originalBlockers:blockers,quantity});
}
export function scenarioResearchView(root,ledgerId,state,at){
  const saved=scenarioRecords(root,ledgerId,at),plans=scenarioPlanContexts(state.manual?.data);
  return {...saved,plans:plans.map(p=>({...p,defaultAssessment:assessScenarioEV([],at,p.plan.timeExitAt,p.contract?.expiry??null,null)})),marketCalls:0,modelCalls:0,executionAllowed:false};
}
