// Read-only forensic inspection. This module never recovers, unlocks, resumes,
// retries, probes/kills a process, or creates a directory. A caller may supply a
// read-only process-presence observation; even ABSENT is not takeover permission.
import fs from 'node:fs';
import {resolve} from 'node:path';
import {readSourceBytes,sourceHash,sourceClock,WEEKLY_SOURCE_BASE as BASE} from './options-weekly-source-storage.mjs';
import {readWeeklyRefreshes} from './options-weekly-refresh.mjs';
import {ALL_WEEKLY_REFRESH_IDS,readWeeklyEventRefreshes} from './options-weekly-event-sources.mjs';
import {readWeeklyIssuerRefreshes} from './options-weekly-issuer-sources.mjs';
import {COMPANY_REFRESH_IDS} from './options-weekly-company-refresh-policy.mjs';
import {readPdfMetadata,PDF_METADATA_ID,PDF_BASELINE} from './options-weekly-pdf-metadata.mjs';

const check=(value,code)=>{if(!value)throw Error(code);};
const idOK=value=>typeof value==='string'&&/^[0-9a-f-]{36}$/.test(value);
const hashOK=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const clock=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
// Source envelopes retain their original ISO offset; only compare instants.
const sourceTime=value=>{check(sourceClock(value),'SOURCE_CLOCK_INVALID');return Date.parse(value);};
const families={public:{directory:'runner',prefix:'WEEKLY_RUNNER',ids:ALL_WEEKLY_REFRESH_IDS,max:100},company:{directory:'company-runner',prefix:'WEEKLY_COMPANY_RUNNER',ids:COMPANY_REFRESH_IDS,max:20}};

function list(root,path,max){
 let current=fs.realpathSync(root);
 for(const part of path.split('/')){current=resolve(current,part);const s=fs.lstatSync(current);check(s.isDirectory()&&!s.isSymbolicLink(),'UNSAFE_DIRECTORY');}
 const names=fs.readdirSync(current).sort();check(names.length<=max,'DIRECTORY_LIMIT');return names;
}
function absent(error){return error?.code==='ENOENT';}

export function inspectWeeklyRecovery({root,family,runId=null,at,probe=()=> 'UNKNOWN'}={}){
 const result={version:'WEEKLY_RECOVERY_INSPECTION_V1',family,assessedAt:at,state:'UNKNOWN',runId:null,
  ownerState:'UNKNOWN',processPresence:'UNKNOWN',processIdentityVerified:false,manifestState:'UNKNOWN',journalState:'UNKNOWN',
  originalConfiguration:null,firstTerminal:null,lastTerminal:null,sourceClaims:[],unresolvedAttempts:[],issues:[],evidence:[],
  budget:{basis:'VERIFIED_JOURNAL_NOT_A_RESUME_ALLOWANCE',maxAttempts:null,confirmedRequestCount:null,unresolvedAttemptCount:null,conservativeConsumedCount:null,remainingUpperBound:null,remainingConservative:null,accountingComplete:false,resetAllowed:false},
  clock:{state:'UNKNOWN',originalUntil:null,extensionAllowed:false,missedSlotCatchupAllowed:false},
  existingRecoverSemantics:'TERMINATE_AND_RELEASE_RUNNER_OWNER_ONLY_NOT_RESUME',
  resumeAllowed:false,takeoverAllowed:false,unlockAllowed:false,retryAllowed:false,executionAllowed:false,sourceCalls:0,fileSystemWrites:0};
 const watched=new Map(),listings=new Map();
 const issue=code=>{if(!result.issues.includes(code))result.issues.push(code);};
 const read=(path,max=65536)=>{const bytes=readSourceBytes(root,path,max),sha256=sourceHash(bytes);watched.set(path,{max,sha256});return bytes;};
 const json=path=>JSON.parse(read(path));
 const optional=path=>{try{return json(path);}catch(e){if(absent(e)){watched.set(path,{missing:true});return null;}throw e;}};
 const names=(path,max)=>{try{const value=list(root,path,max);listings.set(path,{max,value});return value;}catch(e){if(absent(e)){listings.set(path,{max,value:null});return [];}throw e;}};
 let manifest=null,events=[],owner=null,spec,base;
 try{
  check(Object.hasOwn(families,family)&&clock(at)&&(runId===null||idOK(runId)),'INSPECTION_ARGUMENTS');
  spec=families[family];base=BASE+'/'+spec.directory;
  try{owner=optional(base+'/active.json');check(owner===null||(owner.version===spec.prefix+'_OWNER_V1'&&idOK(owner.runId)&&idOK(owner.token)&&Number.isSafeInteger(owner.pid)&&owner.pid>0),'OWNER_INVALID');result.ownerState=owner?'PRESENT_UNVERIFIED':'ABSENT';}
  catch{result.ownerState='INVALID_OR_PARTIAL';issue('OWNER_INVALID_OR_PARTIAL');}
  const id=runId??(result.ownerState==='PRESENT_UNVERIFIED'?owner.runId:null);result.runId=id;
  if(!id){result.state=result.ownerState==='ABSENT'?'NO_SELECTED_RUN':'UNKNOWN';return result;}
  if(owner&&result.ownerState==='PRESENT_UNVERIFIED'){
   if(owner.runId!==id)issue('DIFFERENT_RUN_OWNS_WORKSPACE');
   else{try{const value=probe(owner.pid);result.processPresence=['ABSENT','PRESENT','UNKNOWN'].includes(value)?value:'UNKNOWN';}catch{result.processPresence='UNKNOWN';}}
  }
  const runBase=base+'/runs/'+id;
  try{
   const m=json(runBase+'/manifest.json'),{fingerprint,...body}=m;
   check(m.version===spec.prefix+'_MANIFEST_V1'&&m.runId===id&&hashOK(fingerprint)&&sourceHash(JSON.stringify(body))===fingerprint,'MANIFEST_INTEGRITY');
   check(clock(m.startedAt)&&clock(m.firstAt)&&clock(m.until)&&m.startedAt<=m.firstAt&&m.firstAt<m.until&&Date.parse(m.until)-Date.parse(m.startedAt)<=86400000&&m.startedAt<=at,'MANIFEST_CLOCK');
   check(Array.isArray(m.sourceIds)&&m.sourceIds.length>0&&m.sourceIds.length<=10&&new Set(m.sourceIds).size===m.sourceIds.length&&m.sourceIds.every(source=>spec.ids.includes(source))&&Number.isInteger(m.intervalMinutes)&&m.intervalMinutes>=60&&m.intervalMinutes<=1440&&Number.isInteger(m.maxAttempts)&&m.maxAttempts>=1&&m.maxAttempts<=spec.max&&Number.isSafeInteger(m.pid)&&m.pid>0,'MANIFEST_SCOPE');
   if(owner?.runId===id)check(m.pid===owner.pid,'OWNER_MANIFEST_PID_MISMATCH');
   manifest=m;result.manifestState='VERIFIED';result.originalConfiguration={manifestFingerprint:fingerprint,sourceIds:[...m.sourceIds],startedAt:m.startedAt,firstAt:m.firstAt,until:m.until,intervalMinutes:m.intervalMinutes,maxAttempts:m.maxAttempts,configHash:m.configEvidence?.sha256??null};
   result.budget.maxAttempts=m.maxAttempts;result.clock={...result.clock,originalUntil:m.until,state:at>=m.until?'DEADLINE_REACHED':at<m.firstAt?'BEFORE_FIRST_AT':'WITHIN_ORIGINAL_WINDOW'};
  }catch(e){result.manifestState=absent(e)?'MISSING':'INVALID_OR_PARTIAL';issue(result.manifestState==='MISSING'?'INITIALIZATION_INCOMPLETE':'MANIFEST_INVALID_OR_PARTIAL');return result;}

  try{
   const files=names(runBase,305);check(files.every(name=>name==='manifest.json'||name==='stop.json'||/^\d{6}\.json$/.test(name)),'JOURNAL_UNEXPECTED_FILE');
   const journal=files.filter(name=>/^\d{6}\.json$/.test(name));check(journal.length<=300,'JOURNAL_LIMIT');
   let previous=manifest.fingerprint,previousAt=manifest.startedAt;
   for(const [i,name]of journal.entries()){
    const event=json(runBase+'/'+name),{fingerprint,...body}=event;
    check(name===String(i+1).padStart(6,'0')+'.json'&&event.version===spec.prefix+'_EVENT_V1'&&event.runId===id&&event.sequence===i+1&&event.previousFingerprint===previous&&hashOK(fingerprint)&&sourceHash(JSON.stringify(body))===fingerprint&&clock(event.at)&&event.at>=previousAt&&event.at<=at&&event.details&&typeof event.details==='object'&&!Array.isArray(event.details),'JOURNAL_INTEGRITY');
    previous=fingerprint;previousAt=event.at;events.push(event);
   }
   result.journalState=events.length?'VERIFIED':'EMPTY';if(!events.length)issue('INITIALIZATION_INCOMPLETE');
   const stop=optional(runBase+'/stop.json');if(stop){check(stop.version===spec.prefix+'_STOP_V1'&&stop.runId===id&&stop.manifestFingerprint===manifest.fingerprint&&clock(stop.requestedAt)&&stop.requestedAt<=at,'STOP_INVALID');issue('STOP_REQUEST_RECORDED');}
  }catch{result.journalState='INVALID_OR_PARTIAL';events=[];issue('JOURNAL_INVALID_OR_PARTIAL');}

  // Existing readers validate original hashes and parser replay. Preflight their
  // directory and files here as well so malformed links cannot escape the root.
  let sources=[];const sourceIssues=[];
  const stores=family==='public'?[['refreshes',readWeeklyRefreshes,510,2*1024*1024],['event-refreshes',readWeeklyEventRefreshes,510,2*1024*1024]]:[['issuer-refreshes',readWeeklyIssuerRefreshes,510,2*1024*1024]];
  if(family==='company'&&manifest.sourceIds.includes(PDF_METADATA_ID))stores.push(['pdf-metadata',readPdfMetadata,101,16384]);
  for(const [directory,reader,max,maxBytes]of stores){
   const path=BASE+'/'+directory;try{
    const files=names(path,max);let size=0;
    for(const name of files){
     const bytes=read(path+'/'+name,name.endsWith('.lock')?65536:maxBytes);size+=bytes.length;check(size<=64*1024*1024,'SOURCE_READ_BOUND');
     if(name.endsWith('.lock')){
      const claim={path:path+'/'+name,sha256:sourceHash(bytes),state:bytes.length?'INVALID_OR_PARTIAL':'EMPTY',sourceId:directory==='pdf-metadata'?PDF_METADATA_ID:name.slice(0,-5),requestedAt:null,ownership:'UNKNOWN',unlockAllowed:false};
      if(bytes.length)try{const parsed=JSON.parse(bytes);check(sourceTime(parsed.requestedAt)<=Date.parse(at)&&(directory==='pdf-metadata'||parsed.sourceId===claim.sourceId),'CLAIM_INVALID');claim.state='RECORDED_REQUEST_OWNERSHIP_UNKNOWN';claim.requestedAt=parsed.requestedAt;}catch{}
      result.sourceClaims.push(claim);
     }
    }
    if(directory==='pdf-metadata')try{read(PDF_BASELINE.path,3*1024*1024);}catch(e){if(!absent(e))throw e;}
    const saved=reader(root,at);sources.push(...saved.records);sourceIssues.push(...saved.issues);
   }catch{sourceIssues.push({state:'INVALID_EVIDENCE'});}
  }
  if(result.sourceClaims.length)issue('SOURCE_CLAIMS_REQUIRE_REVIEW');
  if(sourceIssues.some(value=>value.state!=='INCOMPLETE_ATTEMPT'))issue('SOURCE_STORE_INVALID_OR_PARTIAL');

  if(result.journalState==='VERIFIED')try{
   check(events[0].type==='STARTED','START_MISSING');
   let pending=null,confirmed=0,terminalSeen=false;const used=new Set(),uncertain=[];
   for(const event of events){
    const d=event.details;
    if(event.type==='STARTED'){check(event.sequence===1,'START_ORDER');continue;}
    if(event.type==='FINISHED'){
     check(typeof d.reason==='string'&&(!Object.hasOwn(d,'attempts')||d.attempts===confirmed),'TERMINAL_REASON_OR_BUDGET');const terminal={at:event.at,reason:d.reason,sequence:event.sequence};result.firstTerminal??=terminal;result.lastTerminal=terminal;terminalSeen=true;continue;
    }
    check(!terminalSeen,'EVENT_AFTER_TERMINAL');
    if(event.type==='ATTEMPT_STARTED'){
     check(!pending&&manifest.sourceIds.includes(d.sourceId)&&event.at>=manifest.firstAt&&event.at<manifest.until,'ATTEMPT_ORDER');pending=event;continue;
    }
    if(event.type==='ATTEMPT_FINISHED'){
     check(pending&&Array.isArray(d.result)&&d.result.length===1,'FINISH_WITHOUT_START');const row=d.result[0];check(row.sourceId===pending.details.sourceId,'RESULT_SOURCE');
     if(row.status!=='COOLDOWN'){
      const source=sources.find(r=>r.path===row.path&&r.recordFingerprint===row.recordFingerprint);
      check(source&&!used.has(row.path)&&source.sourceId===row.sourceId&&sourceTime(source.requestedAt)===sourceTime(row.requestedAt)&&sourceTime(source.receivedAt)===sourceTime(row.receivedAt)&&source.parsed.status===row.status&&source.httpStatus===row.httpStatus&&sourceTime(source.requestedAt)>=Date.parse(pending.at)&&sourceTime(source.requestedAt)<Date.parse(manifest.until)&&sourceTime(source.receivedAt)<=Date.parse(event.at),'FINISHED_RECEIPT_NOT_VERIFIED');
      used.add(row.path);confirmed++;
     }
     check(d.attempts===confirmed,'ATTEMPT_TOTAL_MISMATCH');pending=null;continue;
    }
    if(event.type==='ATTEMPT_CANCELLED_BEFORE_REQUEST'){check(pending&&d.sourceId===pending.details.sourceId,'CANCEL_WITHOUT_START');pending=null;continue;}
    check(['WAITING','SOURCES_DISABLED'].includes(event.type)&&!pending,'UNKNOWN_OR_UNORDERED_EVENT');
   }
   if(pending){
    const possible=sources.filter(r=>r.path&&!used.has(r.path)&&r.sourceId===pending.details.sourceId&&sourceTime(r.requestedAt)>=Date.parse(pending.at)&&sourceTime(r.requestedAt)<Date.parse(manifest.until)&&sourceTime(r.receivedAt)<=Date.parse(at));
    uncertain.push({sequence:pending.sequence,sourceId:pending.details.sourceId,startedAt:pending.at,state:possible.length?'SAVED_RECEIPT_CANDIDATES_WITHOUT_FINISH':'REQUEST_OUTCOME_UNKNOWN',candidateReceipts:possible.map(r=>({path:r.path,recordFingerprint:r.recordFingerprint,requestedAt:r.requestedAt,receivedAt:r.receivedAt})),attribution:'UNPROVEN_NO_RUN_OR_ATTEMPT_ID',conservativeBudgetOccupancy:1});
    issue('UNFINISHED_ATTEMPT_DO_NOT_RETRY');
   }
   check(confirmed+uncertain.length<=manifest.maxAttempts&&!sourceIssues.some(value=>value.state!=='INCOMPLETE_ATTEMPT'),'BUDGET_OR_SOURCE_EVIDENCE_UNRESOLVED');result.unresolvedAttempts=uncertain;
   result.budget={...result.budget,confirmedRequestCount:confirmed,unresolvedAttemptCount:uncertain.length,conservativeConsumedCount:confirmed+uncertain.length,remainingUpperBound:manifest.maxAttempts-confirmed,remainingConservative:manifest.maxAttempts-confirmed-uncertain.length,accountingComplete:uncertain.length===0&&!result.sourceClaims.length&&!sourceIssues.length};
   if(result.firstTerminal&&owner?.runId===id)issue('TERMINAL_RECORDED_OWNER_REMAINS');
   if(result.firstTerminal?.sequence!==result.lastTerminal?.sequence)issue('MULTIPLE_TERMINALS_PRESERVE_FIRST');
  }catch{result.budget={...result.budget,confirmedRequestCount:null,unresolvedAttemptCount:null,conservativeConsumedCount:null,remainingUpperBound:null,remainingConservative:null,accountingComplete:false};issue('ATTEMPT_ACCOUNTING_UNRESOLVED');}
  result.state=result.journalState!=='VERIFIED'||result.issues.includes('ATTEMPT_ACCOUNTING_UNRESOLVED')||result.issues.includes('SOURCE_STORE_INVALID_OR_PARTIAL')?'UNKNOWN':result.firstTerminal?'TERMINAL_RECORDED':result.processPresence==='PRESENT'?'OWNER_PROCESS_PRESENT_UNVERIFIED':result.processPresence==='ABSENT'?'INTERRUPTION_REQUIRES_REVIEW':'PROCESS_STATE_UNKNOWN';
 }catch{issue('INSPECTION_UNRESOLVED');result.state='UNKNOWN';}
 finally{
  // A changing owner, journal, claim or original cannot produce a stable verdict.
  let changed=false;
  for(const [path,snapshot]of watched)try{if(snapshot.missing){try{readSourceBytes(root,path,65536);changed=true;}catch(e){if(!absent(e))changed=true;}}else if(sourceHash(readSourceBytes(root,path,snapshot.max))!==snapshot.sha256)changed=true;}catch{changed=true;}
  for(const [path,snapshot]of listings)try{const current=list(root,path,snapshot.max);if(JSON.stringify(current)!==JSON.stringify(snapshot.value))changed=true;}catch(e){if(!absent(e)||snapshot.value!==null)changed=true;}
  if(changed){issue('EVIDENCE_CHANGED_DURING_INSPECTION');result.state='UNKNOWN';result.budget={...result.budget,confirmedRequestCount:null,unresolvedAttemptCount:null,conservativeConsumedCount:null,remainingUpperBound:null,remainingConservative:null,accountingComplete:false};}
  result.evidence=[...watched].filter(([,value])=>!value.missing).map(([path,value])=>({path,sha256:value.sha256}));
 }
 return result;
}
