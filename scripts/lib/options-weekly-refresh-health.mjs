import fs from 'node:fs';
import {resolve} from 'node:path';
import {readSourceBytes,sourceHash,sourceClock,WEEKLY_SOURCE_BASE} from './options-weekly-source-storage.mjs';
import {ALL_WEEKLY_REFRESH_IDS} from './options-weekly-event-sources.mjs';
import {COMPANY_REFRESH_IDS,companySourceDue,readCompanyRefreshConfig} from './options-weekly-company-refresh-policy.mjs';
import {WEEKLY_ISSUER_SOURCES} from './options-weekly-issuer-sources.mjs';
import {PDF_METADATA_ID,readPdfMetadata} from './options-weekly-pdf-metadata.mjs';
const check=(v,c)=>{if(!v)throw Error(c);},idOK=v=>typeof v==='string'&&/^[0-9a-f-]{36}$/.test(v),clock=v=>sourceClock(v)&&new Date(v).toISOString()===v;
const paths={public:'runner',company:'company-runner'};
function list(root,path,max){let p=fs.realpathSync(root);for(const part of path.split('/')){p=resolve(p,part);const s=fs.lstatSync(p);check(s.isDirectory()&&!s.isSymbolicLink(),'UNSAFE_DIRECTORY');}const names=fs.readdirSync(p);check(names.length<=max,'DIRECTORY_LIMIT');return names;}
const read=(root,path)=>JSON.parse(readSourceBytes(root,path,65536));
function optional(root,path){try{return read(root,path);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
function presence(pid){try{process.kill(pid,0);return 'PRESENT_IDENTITY_UNVERIFIED';}catch(e){return e.code==='ESRCH'?'ABSENT':'UNKNOWN';}}
const emptyRun=(family,state='NOT_STARTED',reason=null)=>({family,state,reason,recordedState:state,sourceIds:[],attemptedSourceIds:[],requestedCount:0,runId:null,lastRequestAt:null,nextCheckAt:null,until:null,intervalMinutes:null,maxAttempts:null,startedAt:null,terminalAt:null,stopRequested:false,processEvidence:'NONE',lastEventAt:null});
// This reader has no writer/stop/recovery/launch imports. Only signal 0 is used
// for a bounded existence probe; a PID never authenticates a process identity.
export function readRefreshRunHealth(root,family,at,{probe=presence}={}){
 const base=WEEKLY_SOURCE_BASE+'/'+paths[family],prefix=family==='company'?'WEEKLY_COMPANY_RUNNER':'WEEKLY_RUNNER',allowed=family==='company'?COMPANY_REFRESH_IDS:ALL_WEEKLY_REFRESH_IDS;
 try{
  check(paths[family]&&clock(at),'HEALTH_SCOPE');const owner=optional(root,base+'/active.json');
  if(owner)check(owner.version===prefix+'_OWNER_V1'&&idOK(owner.runId)&&idOK(owner.token)&&Number.isSafeInteger(owner.pid)&&owner.pid>0,'OWNER_INVALID');
  let names;try{names=list(root,base+'/runs',100);}catch(e){if(e.code==='ENOENT'&&!owner)return emptyRun(family);throw e;}
  const manifests=[];
  for(const id of names){check(idOK(id),'RUN_NAME');const m=read(root,base+'/runs/'+id+'/manifest.json'),{fingerprint,...body}=m;
   check(m.version===prefix+'_MANIFEST_V1'&&m.runId===id&&sourceHash(JSON.stringify(body))===fingerprint&&clock(m.startedAt)&&clock(m.firstAt)&&clock(m.until)&&m.startedAt<=m.firstAt&&m.firstAt<m.until&&Date.parse(m.until)-Date.parse(m.startedAt)<=86400000,'MANIFEST_INVALID');
   check(Array.isArray(m.sourceIds)&&m.sourceIds.length>0&&m.sourceIds.length<=10&&new Set(m.sourceIds).size===m.sourceIds.length&&m.sourceIds.every(id=>allowed.includes(id))&&Number.isInteger(m.intervalMinutes)&&m.intervalMinutes>=60&&m.intervalMinutes<=1440&&Number.isInteger(m.maxAttempts)&&m.maxAttempts>=1&&m.maxAttempts<=(family==='company'?20:100),'MANIFEST_SCOPE');
   if(m.startedAt<=at)manifests.push(m);
  }
  const m=owner?manifests.find(m=>m.runId===owner.runId):manifests.sort((a,b)=>a.startedAt.localeCompare(b.startedAt)||a.runId.localeCompare(b.runId)).at(-1);
  if(!m){check(!owner,'OWNER_NOT_VISIBLE_AS_OF');return emptyRun(family);}
  if(owner)check(owner.pid===m.pid,'OWNER_PID_MISMATCH');
  const runBase=base+'/runs/'+m.runId,files=list(root,runBase,305),names2=files.filter(n=>/^\d{6}\.json$/.test(n)).sort(),events=[];let previous=m.fingerprint,previousAt=m.startedAt;
  for(const [i,name]of names2.entries()){const r=read(root,runBase+'/'+name),{fingerprint,...body}=r;
   check(name===String(i+1).padStart(6,'0')+'.json'&&r.version===prefix+'_EVENT_V1'&&r.runId===m.runId&&r.sequence===i+1&&r.previousFingerprint===previous&&sourceHash(JSON.stringify(body))===fingerprint&&clock(r.at)&&r.at>=previousAt,'JOURNAL_INVALID');previous=fingerprint;previousAt=r.at;if(r.at<=at)events.push(r);
  }
  const ownerAfter=optional(root,base+'/active.json');check(JSON.stringify(ownerAfter)===JSON.stringify(owner),'OWNER_CHANGED_DURING_READ');
  const stop=optional(root,runBase+'/stop.json');if(stop)check(stop.version===prefix+'_STOP_V1'&&stop.runId===m.runId&&stop.manifestFingerprint===m.fingerprint&&clock(stop.requestedAt),'STOP_INVALID');
  const last=events.at(-1),terminal=last?.type==='FINISHED',stopRequested=Boolean(stop&&stop.requestedAt<=at),processEvidence=owner?probe(owner.pid):'NONE';
  const resultRows=events.filter(e=>e.type==='ATTEMPT_FINISHED').flatMap(e=>(e.details?.result??[]).filter(r=>r.status!=='COOLDOWN').map(r=>{check(clock(r.requestedAt)&&clock(r.receivedAt)&&r.requestedAt<=r.receivedAt&&r.receivedAt<=e.at,'RESULT_CLOCK');return r;}));
  check(resultRows.every(r=>m.sourceIds.includes(r.sourceId))&&resultRows.length<=m.maxAttempts,'RESULT_SCOPE');
  const lastRequestAt=resultRows.map(r=>r.requestedAt).filter(v=>clock(v)&&v<=at).sort().at(-1)??null;
  const recordedState=terminal?'ENDED':last?.type==='ATTEMPT_STARTED'?'RUNNING':last?'WAITING':'UNKNOWN';
  const state=terminal?'ENDED':!owner?'UNRESOLVED':processEvidence==='ABSENT'?'INTERRUPTED':processEvidence==='UNKNOWN'?'UNKNOWN':at>=m.until?'EXPIRED_UNCONFIRMED':stopRequested?'STOP_REQUESTED':recordedState;
  const reasons=['BUDGET_EXHAUSTED','EXPIRED','STOPPED_BY_SIGNAL','STOPPED_BY_REQUEST','CLOCK_REGRESSION','CONTROL_STATE_UNRESOLVED','FAILED_REQUIRES_REVIEW','INTERRUPTED_RECOVERED_NO_SOURCE_CLAIMS_REMOVED','NO_ELIGIBLE_SOURCES_REQUIRES_REVIEW','HTTP_DENIAL_REQUIRES_REVIEW'];
  return {...emptyRun(family),state,recordedState,reason:terminal?(reasons.includes(last.details?.reason)?last.details.reason:'UNKNOWN'):state==='UNKNOWN'?'PROCESS_OR_JOURNAL_UNCONFIRMED':null,runId:m.runId,sourceIds:m.sourceIds,attemptedSourceIds:[...new Set(resultRows.map(r=>r.sourceId))],requestedCount:resultRows.length,lastRequestAt,until:m.until,firstAt:m.firstAt,intervalMinutes:m.intervalMinutes,maxAttempts:m.maxAttempts,startedAt:m.startedAt,terminalAt:terminal?last.at:null,stopRequested,processEvidence,lastEventAt:last?.at??null,configurationHash:/^[a-f0-9]{64}$/.test(m.configEvidence?.sha256)?m.configEvidence.sha256:null,pdfMetadataEnabled:m.configEvidence?.configuration?.pdfMetadata?.enabled===true};
 }catch{return emptyRun(family,'UNKNOWN','SAVED_RUN_STATE_UNREADABLE_OR_INVALID');}
}
function sourceRow(records,id,run,at,company=false){
 const rows=records.filter(r=>r.sourceId===id&&r.receivedAt<=at).sort((a,b)=>a.requestedAt.localeCompare(b.requestedAt)),last=rows.at(-1),good=rows.findLast(r=>r.parsed.status==='OBTAINED_PENDING_REVIEW');let eligibility;
 if(company)eligibility=companySourceDue(rows,id,(run.intervalMinutes??360)*60000,run.firstAt??'1970-01-01T00:00:00.000Z',{pdfMetadataEnabled:run.pdfMetadataEnabled});
 else{let failures=0;for(let i=rows.length-1;i>=0&&rows[i].parsed.status==='ACQUISITION_FAILED';i--)failures++;const delay=Math.min(86400000,(run.intervalMinutes??360)*60000*2**Math.min(5,Math.max(0,failures-1)));eligibility={nextEligibleAt:new Date(Math.max(Date.parse(run.firstAt??at),last?Date.parse(last.requestedAt)+delay:0)).toISOString(),blockedReason:null};}
 const active=['WAITING','RUNNING'].includes(run.state)&&run.requestedCount<run.maxAttempts,next=eligibility.nextEligibleAt,scheduled=active&&!eligibility.blockedReason&&next&&next<run.until?new Date(Math.max(Date.parse(at),Date.parse(next))).toISOString():null;
 return {sourceId:id,symbol:WEEKLY_ISSUER_SOURCES[id]?.symbol??null,family:company?(id===PDF_METADATA_ID?'PDF_METADATA':id.endsWith('_sec')?'SEC_SUBMISSIONS':'IR'):'PUBLIC',selectedInRun:run.sourceIds.includes(id),lastRequestedAt:last?.requestedAt??null,lastReceivedAt:last?.receivedAt??null,lastSuccessAt:good?.receivedAt??null,lastStatus:last?.parsed.status??'NO_SAVED_RECEIPT',httpStatus:last?.httpStatus??null,errorCode:last?.parsed.errorCode??null,disabledReason:eligibility.blockedReason??null,nextEligibleAt:next,nextScheduledCheckAt:scheduled};
}
function readConfig(root,path){try{const c=readCompanyRefreshConfig(root,path);return {state:'AVAILABLE',config:c};}catch(e){return {state:e.code==='ENOENT'?'ABSENT':'INVALID',config:null};}}
export function readWeeklyRefreshHealth(root,at,{refresh={records:[],issues:[]},eventRefresh={records:[],issues:[]},issuerRefresh={records:[],issues:[]},supplements={records:[],issues:[]}}={},options={}){
 const publicRun=readRefreshRunHealth(root,'public',at,options),companyRun=readRefreshRunHealth(root,'company',at,options),catalog=readConfig(root,'docs/config/weekly-company-refresh.json'),formal=readConfig(root,'docs/config/weekly-company-refresh-formal-20261011.json'),pdf=readPdfMetadata(root,at);
 const publicRecords=[...refresh.records,...eventRefresh.records],companyRecords=[...issuerRefresh.records,...pdf.records],publicIssues=[...refresh.issues,...eventRefresh.issues],companyIssues=[...issuerRefresh.issues,...pdf.issues];
 const operational=(run,records,issues,company)=>{const rows=run.sourceIds.map(id=>sourceRow(records,id,run,at,company));if(issues.length)rows.forEach(r=>{r.nextScheduledCheckAt=null;r.disabledReason='SOURCE_STORE_REQUIRES_REVIEW';});return {...run,rows,sourceCount:run.sourceIds.length,attemptedSourceCount:run.attemptedSourceIds.length,issues:issues.map(i=>({state:i.state})),nextCheckAt:rows.map(r=>r.nextScheduledCheckAt).filter(Boolean).sort()[0]??null,identityVerified:false};};
 const companyConfig=catalog.config,configuredIds=companyConfig?.enabledSourceIds??[],planned=formal.config,window=planned?.preparedWindow;
 const preparedValid=window&&clock(window.firstAt)&&clock(window.until)&&window.firstAt<window.until;
 const prepared=planned&&preparedValid?{state:at<window.firstAt?'PREPARED_NOT_STARTED':at<window.until?'MISSED_START_NOT_STARTED':'WINDOW_ENDED_NOT_STARTED',sourceIds:planned.enabledSourceIds,selectedCount:planned.enabledSourceIds.length,notSelectedCount:configuredIds.filter(id=>!planned.enabledSourceIds.includes(id)).length,intervalMinutes:planned.intervalMinutes,maxAttempts:planned.maxAttempts,firstAt:window.firstAt,until:window.until}: {state:formal.state==='AVAILABLE'?'INVALID':formal.state,sourceIds:[],selectedCount:0};
 if(companyRun.sourceIds.length&&companyRun.configurationHash===planned?.configSha256&&companyRun.intervalMinutes===prepared.intervalMinutes&&companyRun.maxAttempts===prepared.maxAttempts&&companyRun.firstAt===prepared.firstAt&&companyRun.until===prepared.until&&sourceHash(JSON.stringify([...companyRun.sourceIds].sort()))===sourceHash(JSON.stringify([...prepared.sourceIds].sort())))prepared.state='MATCHING_RUN_RECORDED';
 const configRun={...emptyRun('company'),intervalMinutes:companyConfig?.intervalMinutes??360,pdfMetadataEnabled:companyConfig?.pdfMetadata?.enabled===true};
 const configuredRows=configuredIds.map(id=>({...sourceRow(companyRecords,id,configRun,at,true),selectedInActiveRun:['WAITING','RUNNING'].includes(companyRun.state)&&companyRun.sourceIds.includes(id),selectedInPreparedBatch:prepared.sourceIds.includes(id)}));
 const disabled=Object.keys(WEEKLY_ISSUER_SOURCES).filter(id=>!configuredIds.includes(id)).map(id=>{const r=issuerRefresh.records.findLast(r=>r.sourceId===id);return {sourceId:id,symbol:WEEKLY_ISSUER_SOURCES[id].symbol??null,lastRequestedAt:r?.requestedAt??null,lastReceivedAt:r?.receivedAt??null,state:r?.parsed.status??'NO_SAVED_RECEIPT',reason:r?.httpStatus===403?'HTTP_403_NO_AUTOMATIC_RETRY':r?.transportError==='BODY_TOO_LARGE'?'LOCAL_BODY_LIMIT':r?.parsed.status==='OBTAINED_PENDING_REVIEW'?'ONE_TIME_ONLY_NOT_CONFIGURED':r?.parsed.errorCode??'NOT_IN_VERIFIED_REFRESH_SCOPE'};});
 const oneTime=supplements.records.filter(r=>{const time=r.retrievedAt??r.receivedAt??r.sourceReceivedAt;return !time||(clock(time)&&time<=at);}).map(r=>({sourceId:r.id??r.sourceId,symbol:r.symbol??null,state:r.state??r.status??'UNKNOWN',httpStatus:r.httpStatus??null,reason:r.httpStatus===403?'HTTP_403_NO_AUTOMATIC_RETRY':r.sourceId==='hpe_events'&&r.errorCode==='BODY_TOO_LARGE'?'LOCAL_2_MIB_BODY_LIMIT':r.sourceId==='pltr_events'&&r.state==='UNPARSED_SAVED_HTML'?'COMPLETE_CLIENT_RENDERED_SHELL':r.state==='HISTORICAL_BACKGROUND'?'HISTORICAL_CONTEXT_ONLY':r.errorCode??'ONE_TIME_INTERPRETATION_NOT_AUTOMATIC',receivedAt:r.retrievedAt??r.receivedAt??r.sourceReceivedAt??null,mode:'ONE_TIME_SAVED_EVIDENCE'}));
 return {version:'WEEKLY_REFRESH_HEALTH_V1',assessedAt:at,publicRun:operational(publicRun,publicRecords,publicIssues,false),companyRun:operational(companyRun,companyRecords,companyIssues,true),companyConfiguredCount:configuredIds.length,companyConfigState:catalog.state,configuredRows,prepared,disabled,oneTime,pdf:{enabled:companyConfig?.pdfMetadata?.enabled===true,minimumIntervalDays:7,...sourceRow(pdf.records,PDF_METADATA_ID,configRun,at,true)},sourceCalls:0,fileSystemWrites:0,executionAllowed:false};
}
