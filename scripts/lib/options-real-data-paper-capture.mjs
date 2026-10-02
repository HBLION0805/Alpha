import {createHash} from 'node:crypto';
import {existsSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {runGuidanceCommand} from '../options-daily-guidance.mjs';

const VERSION='REAL_DATA_PAPER_CAPTURE_ACCEPT_V1';
const BASE='data/runtime/options-real-data-experiments/capture-accepts';
const INPUTS='data/runtime/options-real-data-experiments/market-inputs';
const fail=c=>{throw Error('REAL_DATA_PAPER_CAPTURE_'+c);};
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const clock=v=>{if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))fail('CLOCK');return Date.parse(v);};

function validateHostResult(v){
  if(!v||typeof v!=='object'||!['CAPTURED','NO_CAPTURE'].includes(v.status)||!v.attempt)fail('HOST_RESULT');
  const a=v.attempt;
  if(a.version!=='OPTIONS_PAPER_CAPTURE_ATTEMPT_V1'||a.accountAccessed!==false||a.executionAllowed!==false||!Array.isArray(a.receipts)||!Array.isArray(a.failures)||!Number.isSafeInteger(a.calls)||a.calls<0||a.calls>6||!a.contract)fail('ATTEMPT');
  clock(a.startedAt);clock(a.capturedAt);if(clock(a.startedAt)>clock(a.capturedAt))fail('ATTEMPT_CLOCK');
  const allowed=new Set(['get_option_chains','get_option_instruments','get_equity_quotes','get_option_quotes']);
  if(a.receipts.some(r=>!allowed.has(r?.tool))||a.failures.some(r=>r?.tool!=='PAPER_CAPTURE'&&!allowed.has(r?.tool)))fail('TOOL_SCOPE');
  if(v.status==='CAPTURED'){
    const c=v.capture;if(!c||c.version!=='OPTIONS_GUIDANCE_MARKET_CAPTURE_V1'||c.origin!=='HOST_MARKET_TOOL_RESPONSES'||c.accountAccessed!==false||c.executionAllowed!==false)fail('CAPTURE');
    if(c.capturedAt!==a.capturedAt||c.startedAt!==a.startedAt||c.calls!==a.calls||JSON.stringify(c.receipts)!==JSON.stringify(a.receipts)||JSON.stringify(c.failures)!==JSON.stringify(a.failures)||!Array.isArray(c.selectedIds)||c.selectedIds.length!==1||c.selectedIds[0]!==a.contract.id)fail('CAPTURE_BINDING');
  }else if(v.capture!==null)fail('NO_CAPTURE_SHAPE');
  return v;
}
function envelope(payload){return {version:VERSION,payload,fingerprint:hash(payload)};}
function writeExclusive(root,path,payload){io.directory(root,path.slice(0,path.lastIndexOf('/')));io.writeExclusive(root,path,Buffer.from(JSON.stringify(envelope(payload),null,2)+'\n'));}
function readRecord(root,path){const v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(io.readBytes(root,path,1024*1024)));if(v.version!==VERSION||v.fingerprint!==hash(v.payload))fail('INTEGRITY');return v.payload;}
function classifyPaperObservation(paperObservations){
  const rows=paperObservations?.results??[];
  if(!Array.isArray(rows)||rows.length===0)return {outcomeLabel:'OBSERVING',engineeringAcceptance:'PENDING',paperStatus:null,paperStage:null};
  const row=rows.find(r=>!r.error)??rows[0];
  if(row.error)return {outcomeLabel:'SYSTEM_FAILURE',engineeringAcceptance:'FAILED',paperStatus:null,paperStage:null,errorCode:row.error};
  if(row.status==='CLOSED_MODELED')return {outcomeLabel:'PAPER_FILLED',engineeringAcceptance:'POSITION_AND_EXIT_PATH_COMPLETED',paperStatus:row.status,paperStage:row.paperStage};
  if(row.status==='OPEN_UNRESOLVED')return {outcomeLabel:'PAPER_FILLED',engineeringAcceptance:'POSITION_LIFECYCLE_OPEN',paperStatus:row.status,paperStage:row.paperStage};
  if(row.status==='NO_ENTRY'&&row.paperStage==='ENTRY_WINDOW_ENDED')return {outcomeLabel:'NO_TRADE_VALID',engineeringAcceptance:'NON_TRADE_PATH_PASSED_ONLY',paperStatus:row.status,paperStage:row.paperStage};
  return {outcomeLabel:'OBSERVING',engineeringAcceptance:'PENDING',paperStatus:row.status??null,paperStage:row.paperStage??null};
}
export {validateHostResult,classifyPaperObservation};
export async function acceptRealDataPaperCapture(root,value,{now=()=>new Date().toISOString()}={}){
  root=realpathSync(root);const v=validateHostResult(value),key=hash(v.attempt),dir=BASE+'/'+key,startPath=dir+'/start.json',terminalPath=dir+'/terminal.json';
  if(existsSync(resolve(root,terminalPath)))return {...readRecord(root,terminalPath),alreadyRecorded:true};
  if(existsSync(resolve(root,startPath)))return {version:VERSION,status:'SYSTEM_FAILURE',outcomeLabel:'SYSTEM_FAILURE',engineeringAcceptance:'FAILED',errorCode:'UNCERTAIN_PERSISTENCE_REVIEW_REQUIRED',attemptKey:key,alreadyRecorded:true,executionAllowed:false};
  const receivedAt=now();clock(receivedAt);
  writeExclusive(root,startPath,{recordType:'START',attemptKey:key,status:v.status,attempt:v.attempt,receivedAt,executionAllowed:false});
  if(v.status!=='CAPTURED'){
    const terminal={version:VERSION,recordType:'TERMINAL',status:'BLOCKED_DATA_INTEGRITY',outcomeLabel:'BLOCKED_DATA_INTEGRITY',engineeringAcceptance:'FAILED',attemptKey:key,failureCodes:v.attempt.failures.map(x=>x.code),executionAllowed:false};
    writeExclusive(root,terminalPath,terminal);return {...terminal,alreadyRecorded:false};
  }
  try{
    io.directory(root,INPUTS);const inputPath=INPUTS+'/'+key+'.json';
    if(!existsSync(resolve(root,inputPath)))io.writeExclusive(root,inputPath,Buffer.from(JSON.stringify(v.capture,null,2)+'\n'));
    const recorded=await runGuidanceCommand(['--record',inputPath],{workspaceRoot:root,now});
    const classification=classifyPaperObservation(recorded.paperObservations);
    const terminal={version:VERSION,recordType:'TERMINAL',status:'ACCEPTED',attemptKey:key,inputPath,capturePath:recorded.path,paperObservations:recorded.paperObservations,...classification,executionAllowed:false};
    writeExclusive(root,terminalPath,terminal);return {...terminal,alreadyRecorded:false};
  }catch(error){
    const code=/^(?:GUIDANCE|SNAPSHOT_PAPER|SNAPSHOT_PAPER_OBSERVATION|REAL_DATA_PAPER_CAPTURE)_[A-Z_]+$/.test(error?.message)?error.message:'REAL_DATA_PAPER_CAPTURE_ACCEPT_FAILED';
    const terminal={version:VERSION,recordType:'TERMINAL',status:'SYSTEM_FAILURE',outcomeLabel:'SYSTEM_FAILURE',engineeringAcceptance:'FAILED',attemptKey:key,errorCode:code,executionAllowed:false};
    writeExclusive(root,terminalPath,terminal);return terminal;
  }
}
