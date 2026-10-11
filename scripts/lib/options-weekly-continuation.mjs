// Explicit one-generation continuation of a reviewed clock-regression terminal.
// No automatic recovery, clock tolerance, budget reset, source retry or backfill.
import fs from 'node:fs';
import {resolve} from 'node:path';
import {inspectWeeklyRecovery} from './options-weekly-recovery-inspection.mjs';
import {readSourceBytes,sourceHash,WEEKLY_SOURCE_BASE} from './options-weekly-source-storage.mjs';
const check=(v,c)=>{if(!v)throw Error('RUNNER_CONTINUATION_'+c);};
const folders={public:'runner',company:'company-runner'};
const read=(root,path)=>JSON.parse(readSourceBytes(root,path,65536));
const missing=(root,path)=>{try{readSourceBytes(root,path,65536);return false;}catch(e){if(e.code==='ENOENT')return true;throw e;}};
const absent=pid=>{try{process.kill(pid,0);return false;}catch(e){return e.code==='ESRCH';}};
function directory(root,path){let current=fs.realpathSync(root);for(const p of path.split('/')){current=resolve(current,p);if(!fs.existsSync(current))fs.mkdirSync(current);const s=fs.lstatSync(current);check(s.isDirectory()&&!s.isSymbolicLink(),'UNSAFE_DIRECTORY');}return current;}
export function prepareWeeklyContinuation({root,family,fromRunId,at,ownerProof=null}){
 check(Object.hasOwn(folders,family),'FAMILY');
 const base=WEEKLY_SOURCE_BASE+'/'+folders[family];
 if(ownerProof){const owner=read(root,base+'/active.json');check(owner.runId===ownerProof.runId&&owner.token===ownerProof.token&&owner.pid===process.pid,'NEW_OWNER_CHANGED');}
 const inspection=inspectWeeklyRecovery({root,family,runId:fromRunId,at});
 check(inspection.state==='TERMINAL_RECORDED'&&inspection.ownerState===(ownerProof?'PRESENT_UNVERIFIED':'ABSENT')&&inspection.manifestState==='VERIFIED'&&inspection.journalState==='VERIFIED'&&inspection.issues.every(c=>ownerProof&&c==='DIFFERENT_RUN_OWNS_WORKSPACE'),'UNRESOLVED');
 check(inspection.lastTerminal?.reason==='CLOCK_REGRESSION'&&inspection.firstTerminal?.sequence===inspection.lastTerminal.sequence,'TERMINAL');
 check(inspection.budget.accountingComplete&&inspection.budget.unresolvedAttemptCount===0&&inspection.budget.remainingConservative>0,'BUDGET');
 check(inspection.clock.state==='WITHIN_ORIGINAL_WINDOW','WINDOW');
 const runBase=base+'/runs/'+fromRunId;
 const manifest=read(root,runBase+'/manifest.json'),terminal=read(root,runBase+'/'+String(inspection.lastTerminal.sequence).padStart(6,'0')+'.json');
 check(!manifest.continuation&&!manifest.continuationFrom,'ONE_GENERATION_ONLY');
 check(absent(manifest.pid),'OLD_PROCESS_NOT_PROVEN_ABSENT');
 const claimPath=base+'/continuations/'+fromRunId+'.json';check(missing(root,claimPath),'ALREADY_CLAIMED');
 const lastRequestedAt=Object.fromEntries(manifest.sourceIds.map(id=>[id,null])),lastReceipt={};
 for(let n=1;n<terminal.sequence;n++){
  const event=read(root,runBase+'/'+String(n).padStart(6,'0')+'.json');
  if(event.type==='ATTEMPT_FINISHED')for(const row of event.details.result)if(row.status!=='COOLDOWN'){
   check(Object.hasOwn(lastRequestedAt,row.sourceId),'SCOPE');
   if(!lastRequestedAt[row.sourceId]||Date.parse(row.requestedAt)>Date.parse(lastRequestedAt[row.sourceId])){lastRequestedAt[row.sourceId]=row.requestedAt;lastReceipt[row.sourceId]={path:row.path,recordFingerprint:row.recordFingerprint,requestedAt:row.requestedAt,receivedAt:row.receivedAt};}
  }
 }
 const floors=Object.fromEntries(manifest.sourceIds.map(id=>[id,new Date(Math.max(Date.parse(manifest.firstAt),lastRequestedAt[id]?Date.parse(lastRequestedAt[id])+manifest.intervalMinutes*60000:0)).toISOString()]));
 // Preserve exact preflight bytes and verify them again after the new exclusive
 // owner is claimed. The original run and terminal are never modified.
 return {version:'WEEKLY_RUNNER_CONTINUATION_V1',family,fromRunId,originalManifestFingerprint:manifest.fingerprint,originalTerminalFingerprint:terminal.fingerprint,
  originalBudget:manifest.maxAttempts,priorConsumed:inspection.budget.confirmedRequestCount,remainingAttempts:inspection.budget.remainingConservative,
  sourceIds:[...manifest.sourceIds],until:manifest.until,intervalMinutes:manifest.intervalMinutes,evidenceContext:manifest.evidenceContext,
  configEvidence:manifest.configEvidence??null,lastRequestedAt,lastReceipt,nextEligibleAt:floors,oldPid:manifest.pid,claimPath,base,checkedAt:at,
  evidence:inspection.evidence,executionAllowed:false};
}
export function reserveWeeklyContinuation({root,plan,runId,token,at}){
 check(absent(plan.oldPid),'OLD_PROCESS_NOT_PROVEN_ABSENT');
 const owner=read(root,plan.base+'/active.json');check(owner.runId===runId&&owner.token===token,'NEW_OWNER_CHANGED');
 const fresh=prepareWeeklyContinuation({root,family:plan.family,fromRunId:plan.fromRunId,at,ownerProof:{runId,token}});
 for(const k of ['originalManifestFingerprint','originalTerminalFingerprint','originalBudget','priorConsumed','remainingAttempts','sourceIds','until','intervalMinutes','evidenceContext','configEvidence','lastRequestedAt','lastReceipt','nextEligibleAt','claimPath'])check(JSON.stringify(plan[k])===JSON.stringify(fresh[k]),'EVIDENCE_CHANGED');
 for(const item of plan.evidence)check(sourceHash(readSourceBytes(root,item.path,3*1024*1024))===item.sha256,'EVIDENCE_CHANGED');
 check(Date.parse(at)>=Date.parse(plan.checkedAt)&&Date.parse(at)<Date.parse(plan.until),'CLOCK_OR_DEADLINE');
 directory(root,plan.base+'/continuations');
 const body={version:'WEEKLY_RUNNER_CONTINUATION_CLAIM_V1',fromRunId:plan.fromRunId,newRunId:runId,claimedAt:at,
  originalManifestFingerprint:plan.originalManifestFingerprint,originalTerminalFingerprint:plan.originalTerminalFingerprint,
  originalBudget:plan.originalBudget,priorConsumed:plan.priorConsumed,remainingAttempts:plan.remainingAttempts,
  originalUntil:plan.until,sourceIds:plan.sourceIds,intervalMinutes:plan.intervalMinutes,lastRequestedAt:plan.lastRequestedAt,lastReceipt:plan.lastReceipt,nextEligibleAt:plan.nextEligibleAt};
 const claim={...body,fingerprint:sourceHash(JSON.stringify(body))},fd=fs.openSync(resolve(root,plan.claimPath),'wx',0o600);
 try{fs.writeFileSync(fd,JSON.stringify(claim,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 return {...body,claimFingerprint:claim.fingerprint};
}
export {continuationDueFloor,writeRunnerClockDiagnostic} from './options-weekly-runner-clock.mjs';
