import {createHash} from 'node:crypto';
import {existsSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {createWorkbenchData} from './options-workbench-data.mjs';
import {guidanceSettings} from './options-guidance-io.mjs';
import {snapshotSources,mapSnapshotSource,registerSnapshotPaper} from './options-snapshot-paper-io.mjs';
import {enrollPaperObservation} from './options-paper-observation-io.mjs';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';

export const ENGINEERING_POLICY_VERSION='REAL_DATA_ENGINEERING_PAPER_V1';
const BASE='data/runtime/options-real-data-experiments/bridges';
const CAPTURE_MAX_AGE_MS=120000,DECISION_DELAY_MS=30000,ENTRY_WINDOW_MS=120000,EXIT_WINDOW_MS=420000;
const fail=c=>{throw Error('REAL_DATA_PAPER_BRIDGE_'+c);};
const clock=v=>{if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))fail('CLOCK');return Date.parse(v);};
const add=(v,ms)=>new Date(clock(v)+ms).toISOString();
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const positiveInt=v=>Number.isSafeInteger(v)&&v>0;
const safeId=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(v);
function mechanicalReference(candidate,ref,at){
  const q=ref?.contract,trend=candidate?.trendObservation?.direction;
  if(!q||!['GLD','IBIT'].includes(q.symbol)||q.symbol!==candidate.symbol||q.multiplier!==100)return null;
  const desired=trend==='UP'?'call':trend==='DOWN'?'put':null;if(q.type!==desired)return null;
  if(!positiveInt(q.bidCents)||!positiveInt(q.askCents)||q.bidCents>q.askCents||!positiveInt(q.bidSize)||!positiveInt(q.askSize)||!positiveInt(q.tickCents))return null;
  const updated=clock(q.updatedAt),received=clock(q.receivedAt),now=clock(at);
  if(updated>received||received>now||now-updated>CAPTURE_MAX_AGE_MS)return null;
  const maxSpread=Math.max(q.tickCents,Math.min(10,Math.floor(q.askCents/10/q.tickCents)*q.tickCents||q.tickCents));
  if(q.askCents-q.bidCents>maxSpread)return null;
  return {candidate,ref,maxSpread};
}
export function selectEngineeringReference(decisionEvidence,at){
  const now=clock(at),d=decisionEvidence;
  if(!d||d.executionAllowed!==false||!Array.isArray(d.candidates)||typeof d.identity!=='string')return {status:'BLOCKED_DATA_INTEGRITY',blockers:['DECISION_EVIDENCE_UNAVAILABLE']};
  const capturedAt=d.provenance?.capture?.capturedAt,issuedAt=d.issuedAt;
  if(!capturedAt||!issuedAt)return {status:'BLOCKED_DATA_INTEGRITY',blockers:['DECISION_CLOCKS_MISSING']};
  const captured=clock(capturedAt),issued=clock(issuedAt);
  if(captured>now||issued>now)return {status:'BLOCKED_DATA_INTEGRITY',blockers:['FUTURE_DECISION_EVIDENCE']};
  if(now-captured>CAPTURE_MAX_AGE_MS||now-issued>CAPTURE_MAX_AGE_MS)return {status:'BLOCKED_DATA_INTEGRITY',blockers:['DECISION_EVIDENCE_STALE']};
  const rows=d.candidates.flatMap(c=>(c.referenceContracts??[]).map(r=>mechanicalReference(c,r,at)).filter(Boolean));
  rows.sort((a,b)=>a.ref.contract.askCents-b.ref.contract.askCents||a.candidate.symbol.localeCompare(b.candidate.symbol)||a.ref.contract.id.localeCompare(b.ref.contract.id));
  if(!rows.length)return {status:'NO_TRADE_VALID',blockers:['NO_MECHANICALLY_ELIGIBLE_TREND_ALIGNED_REFERENCE']};
  const selected=rows[0];
  return {status:'REFERENCE_SELECTED',selected:{symbol:selected.candidate.symbol,trend:selected.candidate.trendObservation.direction,contract:structuredClone(selected.ref.contract),maxSpreadCents:selected.maxSpread,sourceDecisionIdentity:d.identity,selectionPath:d.provenance.capture.path,capturedAt,issuedAt},blockers:[]};
}
export function buildEngineeringPaperPreview({decisionEvidence,frames,settings,at}){
  const selection=selectEngineeringReference(decisionEvidence,at);
  if(selection.status!=='REFERENCE_SELECTED')return {...selection,version:'REAL_DATA_PAPER_BRIDGE_PREVIEW_V1',track:'ENGINEERING_EXPERIMENT',strategyValidationEligible:false,executionAllowed:false};
  const selected=selection.selected,frame=frames.find(f=>f.path===selected.selectionPath);
  if(!frame||frame.origin!=='HOST_MARKET_TOOL_RESPONSES')return {version:'REAL_DATA_PAPER_BRIDGE_PREVIEW_V1',status:'BLOCKED_DATA_INTEGRITY',track:'ENGINEERING_EXPERIMENT',strategyValidationEligible:false,blockers:['REAL_HOST_SELECTION_FRAME_MISSING'],executionAllowed:false};
  const q=frame.quotes.find(x=>x.id===selected.contract.id);
  if(!q||q.symbol!==selected.contract.symbol||q.expiry!==selected.contract.expiry||q.type!==selected.contract.type||q.multiplier!==100)return {version:'REAL_DATA_PAPER_BRIDGE_PREVIEW_V1',status:'BLOCKED_DATA_INTEGRITY',track:'ENGINEERING_EXPERIMENT',strategyValidationEligible:false,blockers:['EXACT_CONTRACT_LINKAGE_FAILED'],executionAllowed:false};
  if(q.bidCents!==selected.contract.bidCents||q.askCents!==selected.contract.askCents||q.updatedAt!==selected.contract.updatedAt||q.receivedAt!==selected.contract.receivedAt)return {version:'REAL_DATA_PAPER_BRIDGE_PREVIEW_V1',status:'BLOCKED_DATA_INTEGRITY',track:'ENGINEERING_EXPERIMENT',strategyValidationEligible:false,blockers:['DECISION_QUOTE_SOURCE_MISMATCH'],executionAllowed:false};
  const decisionAt=add(at,DECISION_DELAY_MS),entryDeadlineAt=add(decisionAt,ENTRY_WINDOW_MS),timeExitAt=add(decisionAt,EXIT_WINDOW_MS);
  const decisionSession=paperSession(decisionAt,q.chainSession),exitSession=paperSession(timeExitAt,q.chainSession);
  if(!decisionSession.isOpen||!exitSession.isOpen)return {version:'REAL_DATA_PAPER_BRIDGE_PREVIEW_V1',status:'NO_TRADE_VALID',track:'ENGINEERING_EXPERIMENT',strategyValidationEligible:false,blockers:['INSUFFICIENT_REGULAR_SESSION_TIME'],executionAllowed:false};
  const tick=positiveInt(q.tickCents)?q.tickCents:positiveInt(q.belowTickCents)?q.belowTickCents:1;
  const key=hash([ENGINEERING_POLICY_VERSION,selected.sourceDecisionIdentity,q.id,selected.capturedAt]);
  const planId='eng-paper-'+key.slice(0,16);
  const request={modelVersion:'V3',feeBasis:'ROBINHOOD_REVIEWED_20260910',id:planId,contractId:q.id,selectionPath:frame.path,decisionAt,entryDeadlineAt,timeExitAt,quantity:1,entryLimitCents:q.askCents,entryFeeCents:null,exitFeeCents:null,exitSlippageCents:tick,maxSpreadCents:selected.maxSpreadCents,settingsFingerprint:paperFingerprint(settings)};
  return {version:'REAL_DATA_PAPER_BRIDGE_PREVIEW_V1',status:'READY_TO_ARM',track:'ENGINEERING_EXPERIMENT',strategyValidationEligible:false,policyVersion:ENGINEERING_POLICY_VERSION,preparedAt:at,planId,key,sourceDecision:{identity:selected.sourceDecisionIdentity,capturedAt:selected.capturedAt,issuedAt:selected.issuedAt},selectedContract:{id:q.id,symbol:q.symbol,expiry:q.expiry,type:q.type,strike:q.strike,multiplier:q.multiplier,bidCents:q.bidCents,askCents:q.askCents,bidSize:q.bidSize,askSize:q.askSize,updatedAt:q.updatedAt,receivedAt:q.receivedAt,chainId:q.chainSession?.chainId??null},fillPolicy:{entry:'LATER_ASK_AT_OR_BELOW_FROZEN_LIMIT',exit:'LATER_BID_MINUS_ONE_CURRENT_TICK',partialFill:'REQUIRE_DISPLAYED_SIZE_FOR_FULL_QUANTITY',quantity:1},request,blockers:[],executionAllowed:false};
}
function envelope(payload){return {version:'REAL_DATA_PAPER_BRIDGE_RECORD_V1',payload,fingerprint:paperFingerprint(payload)};}
function readRecord(root,path){const v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(io.readBytes(root,path,1024*1024)));if(v.version!=='REAL_DATA_PAPER_BRIDGE_RECORD_V1'||v.fingerprint!==paperFingerprint(v.payload))fail('RECORD_INTEGRITY');return v.payload;}
function paths(key){if(!/^[a-f0-9]{64}$/.test(key))fail('KEY');return {start:BASE+'/'+key+'/start.json',terminal:BASE+'/'+key+'/terminal.json'};}
function writeRecord(root,path,payload){io.directory(root,path.slice(0,path.lastIndexOf('/')));io.writeExclusive(root,path,Buffer.from(JSON.stringify(envelope(payload),null,2)+'\n'));}

export async function currentEngineeringPaperPreview(root,{now=()=>new Date().toISOString()}={}){
  root=realpathSync(root);const at=now();clock(at);
  const state=await createWorkbenchData({workspaceRoot:root,now:()=>at}).state();
  if(state.decisionEvidence?.state!=='AVAILABLE'||state.decisionEvidence.data?.status!=='MATERIALIZED')return {version:'REAL_DATA_PAPER_BRIDGE_PREVIEW_V1',status:'BLOCKED_DATA_INTEGRITY',track:'ENGINEERING_EXPERIMENT',strategyValidationEligible:false,blockers:['CURRENT_DECISION_EVIDENCE_UNAVAILABLE'],executionAllowed:false};
  const frames=snapshotSources(root).map(c=>mapSnapshotSource(c,'V3')),settings=guidanceSettings(root);
  return buildEngineeringPaperPreview({decisionEvidence:state.decisionEvidence.data,frames,settings,at});
}
export function armEngineeringPaperFromPreview(root,preview){
  root=realpathSync(root);if(preview?.status!=='READY_TO_ARM')return preview;
  const p=paths(preview.key),startFull=resolve(root,p.start),terminalFull=resolve(root,p.terminal);
  if(existsSync(terminalFull))return {...readRecord(root,p.terminal),alreadyRecorded:true};
  let start;
  if(existsSync(startFull))start=readRecord(root,p.start);
  else{start={...preview,recordType:'START',liveOrderAuthority:false};writeRecord(root,p.start,start);}
  try{
    const registration=registerSnapshotPaper(root,start.request,start.preparedAt);
    const enrollment=enrollPaperObservation(root,start.planId,'PIPELINE_REHEARSAL_NOT_SIGNAL',start.preparedAt);
    const terminal={version:'REAL_DATA_ENGINEERING_ARM_V1',recordType:'TERMINAL',status:'PAPER_ARMED',outcomeLabel:'PAPER_ARMED',engineeringAcceptance:'PENDING_POSITION_LIFECYCLE',strategyValidationEligible:false,policyVersion:ENGINEERING_POLICY_VERSION,preparedAt:start.preparedAt,planId:start.planId,key:start.key,sourceDecision:start.sourceDecision,selectedContract:start.selectedContract,fillPolicy:start.fillPolicy,request:start.request,registrationPath:registration.path,enrollmentPath:enrollment.path,liveOrderAuthority:false,executionAllowed:false};
    writeRecord(root,p.terminal,terminal);return {...terminal,alreadyRecorded:false};
  }catch(error){
    const code=/^(?:SNAPSHOT_PAPER|SNAPSHOT_PAPER_OBSERVATION|REAL_DATA_PAPER_BRIDGE)_[A-Z_]+$/.test(error?.message)?error.message:'REAL_DATA_PAPER_BRIDGE_ARM_FAILED';
    const terminal={version:'REAL_DATA_ENGINEERING_ARM_V1',recordType:'TERMINAL',status:'SYSTEM_FAILURE',outcomeLabel:'SYSTEM_FAILURE',engineeringAcceptance:'FAILED',strategyValidationEligible:false,policyVersion:ENGINEERING_POLICY_VERSION,preparedAt:start.preparedAt,planId:start.planId,key:start.key,errorCode:code,liveOrderAuthority:false,executionAllowed:false};
    writeRecord(root,p.terminal,terminal);return terminal;
  }
}
export async function armEngineeringPaper(root,{now=()=>new Date().toISOString()}={}){
  root=realpathSync(root);const preview=await currentEngineeringPaperPreview(root,{now});
  return armEngineeringPaperFromPreview(root,preview);
}
