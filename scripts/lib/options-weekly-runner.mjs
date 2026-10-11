import {continuationDueFloor,writeRunnerClockDiagnostic} from './options-weekly-runner-clock.mjs';
import fs from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ALL_WEEKLY_REFRESH_IDS,readWeeklyAcquisitionHistory as readWeeklyRefreshes,refreshWeeklySourcesIncludingEvents as refreshWeeklySources} from './options-weekly-event-sources.mjs';
import {readSourceBytes,sourceHash,WEEKLY_SOURCE_BASE} from './options-weekly-source-storage.mjs';

const BASE=WEEKLY_SOURCE_BASE+'/runner',HOUR=3600000;
const check=(v,c)=>{if(!v)throw Error(c);};
const idOK=id=>typeof id==='string'&&/^[0-9a-f-]{36}$/.test(id);
const clock=v=>{check(typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&new Date(v).toISOString()===v,'RUNNER_CLOCK');return Date.parse(v);};
function directory(root,path){
 let p=fs.realpathSync(root);for(const part of path.split('/')){p=resolve(p,part);if(!fs.existsSync(p))fs.mkdirSync(p);const s=fs.lstatSync(p);check(!s.isSymbolicLink()&&s.isDirectory(),'RUNNER_UNSAFE_DIRECTORY');}return p;
}
function write(root,path,value){const fd=fs.openSync(resolve(root,path),'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
const read=(root,path)=>JSON.parse(readSourceBytes(root,path,65536));
function optional(root,path){try{return read(root,path);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
function active(root){
 const a=optional(root,BASE+'/active.json');if(!a)return null;
 check(a.version==='WEEKLY_RUNNER_OWNER_V1'&&idOK(a.runId)&&idOK(a.token)&&Number.isSafeInteger(a.pid)&&a.pid>0,'RUNNER_OWNER_INVALID');return a;
}
const runPath=id=>{check(idOK(id),'RUNNER_ID');return BASE+'/runs/'+id;};
function manifest(root,id){const m=read(root,runPath(id)+'/manifest.json'),{fingerprint,...body}=m;check(body.version==='WEEKLY_RUNNER_MANIFEST_V1'&&body.runId===id&&sourceHash(JSON.stringify(body))===fingerprint,'RUNNER_MANIFEST_INTEGRITY');return m;}
function presence(pid){try{process.kill(pid,0);return 'PID_PRESENT_IDENTITY_NOT_INDEPENDENTLY_VERIFIED';}catch(e){return e.code==='ESRCH'?'ABSENT':'UNKNOWN';}}
function history(root,id){
 const base=runPath(id),m=manifest(root,id),dir=resolve(root,base),entries=fs.readdirSync(dir,{withFileTypes:true});check(entries.length<=305,'RUNNER_JOURNAL_LIMIT');
 const names=entries.filter(e=>/^\d{6}\.json$/.test(e.name)).map(e=>e.name).sort();let previous=m.fingerprint,previousAt=m.continuation?.claimedAt??m.startedAt;const events=[];
 for(const [index,name]of names.entries()){
  const r=read(root,base+'/'+name),{fingerprint,...body}=r;
  check(name===String(index+1).padStart(6,'0')+'.json'&&body.version==='WEEKLY_RUNNER_EVENT_V1'&&body.runId===id&&body.sequence===index+1&&body.previousFingerprint===previous&&sourceHash(JSON.stringify(body))===fingerprint,'RUNNER_JOURNAL_INTEGRITY');
  check(clock(body.at)>=clock(previousAt),'RUNNER_CLOCK_REGRESSION');previous=fingerprint;previousAt=body.at;events.push(r);
 }
 return {manifest:m,events,previous};
}
function append(root,id,type,details,at){const h=history(root,id);check(h.events.length<300,'RUNNER_JOURNAL_LIMIT');const body={version:'WEEKLY_RUNNER_EVENT_V1',runId:id,sequence:h.events.length+1,previousFingerprint:h.previous,at,type,details};clock(at);check(clock(at)>=clock(h.events.at(-1)?.at??h.manifest.continuation?.claimedAt??h.manifest.startedAt),'RUNNER_CLOCK_REGRESSION');const r={...body,fingerprint:sourceHash(JSON.stringify(body))};write(root,runPath(id)+'/'+String(r.sequence).padStart(6,'0')+'.json',r);return r;}
export function weeklyRunnerStatus(root,runId=null,now=()=>new Date().toISOString()){
 const owner=active(root),id=runId??owner?.runId;if(!id)return {version:'WEEKLY_RUNNER_STATUS_V1',state:'NOT_RUNNING',activeRunId:null,executionAllowed:false};
 const h=history(root,id),last=h.events.at(-1),owns=owner?.runId===id,processPresence=owns?presence(owner.pid):'NOT_OWNER';
 const terminal=last?.type==='FINISHED'?last.details.reason:null;
 return {version:'WEEKLY_RUNNER_STATUS_V1',runId:id,activeRunId:owner?.runId??null,state:terminal??(owns?(processPresence==='ABSENT'?'INTERRUPTED_REQUIRES_RECOVERY':Date.parse(now())>=Date.parse(h.manifest.until)?'EXPIRED_PROCESS_STATE_UNCONFIRMED':'PROCESS_PRESENT_STATUS_UNCONFIRMED'):'INTERRUPTED_OR_UNRESOLVED'),processPresence,pid:owns?owner.pid:null,configuration:h.manifest,lastEvent:last??null,stopRequested:Boolean(optional(root,runPath(id)+'/stop.json')),events:h.events,executionAllowed:false};
}
export function stopWeeklyRunner(root,runId,now=()=>new Date().toISOString()){
 const owner=active(root);check(owner?.runId===runId,'RUNNER_NOT_ACTIVE');const m=manifest(root,runId),path=runPath(runId)+'/stop.json';
 if(!optional(root,path))write(root,path,{version:'WEEKLY_RUNNER_STOP_V1',runId,manifestFingerprint:m.fingerprint,requestedAt:now()});
 return {state:'STOP_REQUESTED',runId,executionAllowed:false};
}
export function recoverWeeklyRunner(root,runId,now=()=>new Date().toISOString()){
 const owner=active(root);check(owner?.runId===runId,'RUNNER_NOT_ACTIVE');check(presence(owner.pid)==='ABSENT','RUNNER_PROCESS_NOT_PROVEN_ABSENT');
 const h=history(root,runId),last=h.events.at(-1),terminals=h.events.filter(e=>e.type==='FINISHED');
 check(terminals.length<=1&&(!terminals.length||terminals[0]===last),'RUNNER_TERMINAL_CHAIN_INVALID');
 if(last?.type==='FINISHED'){
  check(['BUDGET_EXHAUSTED','EXPIRED','STOPPED_BY_SIGNAL','STOPPED_BY_REQUEST','CLOCK_REGRESSION','CONTROL_STATE_UNRESOLVED','FAILED_REQUIRES_REVIEW','INTERRUPTED_RECOVERED_NO_SOURCE_CLAIMS_REMOVED'].includes(last.details?.reason),'RUNNER_TERMINAL_INVALID');
  check(active(root)?.token===owner.token,'RUNNER_OWNER_CHANGED');fs.unlinkSync(resolve(root,BASE+'/active.json'));
  return {state:'TERMINAL_PRESERVED_OWNER_RELEASED',runId,originalTerminal:last,executionAllowed:false};
 }
 append(root,runId,'FINISHED',{reason:'INTERRUPTED_RECOVERED_NO_SOURCE_CLAIMS_REMOVED'},now());
 check(active(root)?.token===owner.token,'RUNNER_OWNER_CHANGED');fs.unlinkSync(resolve(root,BASE+'/active.json'));
 return {state:'INTERRUPTED_RECOVERED_NO_SOURCE_CLAIMS_REMOVED',runId,executionAllowed:false};
}
export function weeklySourceDue(records,sourceId,intervalMs,firstAt){
 const rows=records.filter(r=>r.sourceId===sourceId),latest=rows.at(-1);let failures=0;
 for(let i=rows.length-1;i>=0&&rows[i].parsed.status==='ACQUISITION_FAILED';i--)failures++;
 const delay=Math.min(24*HOUR,intervalMs*2**Math.min(5,Math.max(0,failures-1)));
 return {sourceId,consecutiveFailures:failures,nextEligibleAt:new Date(Math.max(clock(firstAt),latest?clock(latest.requestedAt)+delay:0)).toISOString(),delayMs:delay};
}
export async function runWeeklyRunner({root,sourceIds=['bls_calendar','fomc_calendar'],until,firstAt,intervalMinutes=60,maxAttempts=20,now=()=>new Date().toISOString(),fetchImplementation=globalThis.fetch,signal,wait=ms=>new Promise(r=>setTimeout(r,ms)),evidenceContext='REAL_PUBLIC_SOURCE',continuationFrom=null,monotonicNow=()=>performance.now()}={}){
 root=fs.realpathSync(root);const startedAt=now(),start=clock(startedAt);
 const continuationApi=continuationFrom?await import('./options-weekly-continuation.mjs'):null;
 const continuationPlan=continuationFrom?continuationApi.prepareWeeklyContinuation({root,family:'public',fromRunId:continuationFrom,at:startedAt}):null;
 if(continuationPlan){sourceIds=continuationPlan.sourceIds;until=continuationPlan.until;intervalMinutes=continuationPlan.intervalMinutes;maxAttempts=continuationPlan.remainingAttempts;evidenceContext=continuationPlan.evidenceContext;firstAt=startedAt;}
 const end=clock(until);firstAt??=startedAt;
 check(end>start&&end-start<=24*HOUR&&clock(firstAt)>=start&&clock(firstAt)<end,'RUNNER_WINDOW');
 check(Number.isInteger(intervalMinutes)&&intervalMinutes>=60&&intervalMinutes<=1440,'RUNNER_INTERVAL');check(Number.isInteger(maxAttempts)&&maxAttempts>=1&&maxAttempts<=100,'RUNNER_BUDGET');
 check(['REAL_PUBLIC_SOURCE','TEST_FIXTURE'].includes(evidenceContext)&&Array.isArray(sourceIds)&&sourceIds.length>0&&sourceIds.length<=10&&new Set(sourceIds).size===sourceIds.length&&sourceIds.every(id=>ALL_WEEKLY_REFRESH_IDS.includes(id)),'RUNNER_SCOPE');
 directory(root,BASE);const runId=randomUUID(),token=randomUUID(),owner={version:'WEEKLY_RUNNER_OWNER_V1',runId,token,pid:process.pid};
 write(root,BASE+'/active.json',owner);let initialized=false,terminalWritten=false,controlTimer,stopping=null,requestController,previousNow=start,previousMonotonic=monotonicNow(),clockDiagnostic=null;
 const requestStop=reason=>{stopping??=reason;requestController?.abort();};
 const externalStop=()=>requestStop('STOPPED_BY_SIGNAL');
 const observeClock=()=>{const at=now(),t=clock(at),mono=monotonicNow();if(t<previousNow){
  if(!clockDiagnostic){const diagnostic={previousNow:new Date(previousNow).toISOString(),currentNow:at,deltaMs:t-previousNow,previousMonotonicMs:previousMonotonic,currentMonotonicMs:mono,monotonicDeltaMs:mono-previousMonotonic};try{clockDiagnostic={...diagnostic,saved:writeRunnerClockDiagnostic({root,family:'public',runId,diagnostic})};}catch{clockDiagnostic={...diagnostic,saved:null,writeStatus:'FAILED_REQUIRES_REVIEW'};}}
  requestStop('CLOCK_REGRESSION');
 }else{previousNow=t;previousMonotonic=mono;}return {at,t};};
 try{
  const claimClock=continuationPlan?observeClock():null;check(!stopping,'RUNNER_CLOCK_REGRESSION');
  const continuation=continuationPlan?continuationApi.reserveWeeklyContinuation({root,plan:continuationPlan,runId,token,at:claimClock.at}):null;
  const implementation=Object.fromEntries(['options-weekly-runner-clock.mjs','options-weekly-continuation.mjs','options-weekly-recovery-inspection.mjs','options-weekly-runner.mjs','options-weekly-refresh.mjs','options-weekly-source-storage.mjs','options-weekly-event-sources.mjs'].map(name=>[name,sourceHash(fs.readFileSync(new URL(name,import.meta.url)))]));
  directory(root,runPath(runId));const body={version:'WEEKLY_RUNNER_MANIFEST_V1',runId,startedAt,until,firstAt,sourceIds,intervalMinutes,maxAttempts,evidenceContext,pid:process.pid,implementation,...(continuation?{continuation}:{}),executionAllowed:false};
  write(root,runPath(runId)+'/manifest.json',{...body,fingerprint:sourceHash(JSON.stringify(body))});initialized=true;
  const startClock=observeClock();check(!stopping,'RUNNER_CLOCK_REGRESSION');
  append(root,runId,'STARTED',{state:'WAITING',firstAt},startClock.at);
  const control=()=>{try{
   const {at,t}=observeClock();if(stopping)return;
   if(t>=end)return requestStop('EXPIRED');
   const stop=optional(root,runPath(runId)+'/stop.json');if(stop){check(stop.version==='WEEKLY_RUNNER_STOP_V1'&&stop.runId===runId&&stop.manifestFingerprint===manifest(root,runId).fingerprint,'RUNNER_STOP_INVALID');requestStop('STOPPED_BY_REQUEST');}
  }catch{requestStop('CONTROL_STATE_UNRESOLVED');}};
  signal?.addEventListener('abort',externalStop,{once:true});if(signal?.aborted)externalStop();controlTimer=setInterval(control,1000);
  let attempts=0,nextWait=null;
  while(!stopping){
   control();if(stopping)break;
   if(attempts>=maxAttempts){stopping='BUDGET_EXHAUSTED';break;}
   if(nextWait&&clock(now())<clock(nextWait)){await wait(Math.min(1000,end-clock(now()),clock(nextWait)-clock(now())));continue;}
   const at=now(),saved=readWeeklyRefreshes(root,at);check(!saved.issues.length,'RUNNER_SOURCE_STORE_REQUIRES_REVIEW');
   const due=sourceIds.map(id=>continuationDueFloor(weeklySourceDue(saved.records,id,intervalMinutes*60000,firstAt),continuation)).sort((a,b)=>a.nextEligibleAt.localeCompare(b.nextEligibleAt)||a.sourceId.localeCompare(b.sourceId));
   if(clock(due[0].nextEligibleAt)>clock(at)){
    if(nextWait!==due[0].nextEligibleAt){append(root,runId,'WAITING',{nextEligibleAt:due[0].nextEligibleAt,consecutiveFailures:due[0].consecutiveFailures},at);nextWait=due[0].nextEligibleAt;}
    await wait(Math.min(1000,end-clock(at),clock(due[0].nextEligibleAt)-clock(at)));continue;
   }
   nextWait=null;const selected=due[0];control();if(stopping)break;
   const remaining=end-clock(now());if(remaining<=0){stopping='EXPIRED';break;}
   append(root,runId,'ATTEMPT_STARTED',{sourceId:selected.sourceId,consecutiveFailures:selected.consecutiveFailures},now());requestController=new AbortController();
   const result=await refreshWeeklySources({root,sourceIds:[selected.sourceId],now,fetchImplementation,deadlineMs:Math.max(1,Math.min(12000,remaining)),signal:requestController.signal});requestController=null;
   const attempted=result.results.filter(r=>r.status!=='COOLDOWN').length;attempts+=attempted;
   append(root,runId,'ATTEMPT_FINISHED',{attempts,result:result.results},now());
  }
  append(root,runId,'FINISHED',{reason:stopping??'EXPIRED',attempts,...(clockDiagnostic?{clockDiagnostic}: {})},now());terminalWritten=true;
  return weeklyRunnerStatus(root,runId,now);
 }catch(e){
  if(initialized){try{append(root,runId,'FINISHED',{reason:'FAILED_REQUIRES_REVIEW',errorCode:/^(?:RUNNER|REFRESH)_[A-Z_]+$/.test(e.message)?e.message:'LOCAL_FAILURE'},now());terminalWritten=true;}catch{}}
  // If claiming failed before any durable claim or manifest, release only this
  // invocation's owner. A written/partial claim stays occupied for manual review.
  if(!initialized&&continuationPlan&&!fs.existsSync(resolve(root,continuationPlan.claimPath))&&active(root)?.token===token)fs.unlinkSync(resolve(root,BASE+'/active.json'));
  throw e;
 }finally{
  clearInterval(controlTimer);signal?.removeEventListener('abort',externalStop);
  if(terminalWritten&&active(root)?.token===token)fs.unlinkSync(resolve(root,BASE+'/active.json'));
 }
}
