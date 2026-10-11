import fs from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {PUBLIC_SOURCE_URLS,FOCUSED_SOURCE_URLS,parseDriverFeed,parseFocusedFeed} from './options-driver-io.mjs';
import {assessReleaseCalendar,RELEASE_CALENDAR_URL} from '../../src/engines/options-release-calendar/BlsReleaseCalendarEngine.ts';
import {assessFomcCalendar,FOMC_CALENDAR_URL} from '../../src/engines/options-fomc-calendar/FomcCalendarEngine.ts';
import {sourceHash,sourceClock,readSourceBytes,WEEKLY_SOURCE_BASE} from './options-weekly-source-storage.mjs';
const check=(v,c)=>{if(!v)throw Error(c);};
const BASE=WEEKLY_SOURCE_BASE+'/refreshes',MAX_BYTES=524288;
export const WEEKLY_REFRESH_URLS=Object.freeze({bls_calendar:RELEASE_CALENDAR_URL,fomc_calendar:FOMC_CALENDAR_URL,...PUBLIC_SOURCE_URLS,fed_speeches:FOCUSED_SOURCE_URLS.fed_speeches,eia_energy:FOCUSED_SOURCE_URLS.eia_energy});
const calendarKind=id=>id==='bls_calendar'?'bls':id==='fomc_calendar'?'fomc':null;
export function parseWeeklyResponse(record){
 const bytes=Buffer.from(record.rawBase64,'base64');check(bytes.length<=MAX_BYTES&&bytes.toString('base64')===record.rawBase64&&sourceHash(bytes)===record.rawSha256,'RAW_INTEGRITY');
 if(record.transportError)return {status:'ACQUISITION_FAILED',errorCode:record.transportError,items:[],calendarInput:null,partial:true};
 if(record.httpStatus!==200)return {status:'ACQUISITION_FAILED',errorCode:'HTTP_'+record.httpStatus,items:[],calendarInput:null,partial:true};
 try{
  const type=record.responseHeaders['content-type']??'';check(calendarKind(record.sourceId)?(record.sourceId==='bls_calendar'?/^text\/calendar/i:/^text\/html/i).test(type):/^(?:application\/(?:rss\+xml|atom\+xml|xml)|text\/(?:xml|plain))/i.test(type),'CONTENT_TYPE');
  const text=new TextDecoder('utf8',{fatal:true}).decode(bytes),kind=calendarKind(record.sourceId);
  if(kind){const input={requestedAt:record.requestedAt,receivedAt:record.receivedAt,url:record.url,sourceText:text,errorCode:null};(kind==='bls'?assessReleaseCalendar:assessFomcCalendar)(input);return {status:'OBTAINED_PENDING_REVIEW',errorCode:null,calendarInput:input,items:[],partial:false};}
  const parsed=Object.hasOwn(PUBLIC_SOURCE_URLS,record.sourceId)?parseDriverFeed(text,record.sourceId,record.receivedAt):parseFocusedFeed(text,record.sourceId,record.receivedAt);
  return {status:'OBTAINED_PENDING_REVIEW',errorCode:null,calendarInput:null,...parsed,partial:parsed.truncated||parsed.rejectedItems>0};
 }catch{return {status:'ACQUISITION_FAILED',errorCode:'SOURCE_SCHEMA_OR_CONTENT_TYPE',items:[],calendarInput:null,partial:true};}
}
function safeDirectory(root,create=false){
 let path=fs.realpathSync(root);for(const part of BASE.split('/')){path=resolve(path,part);if(!fs.existsSync(path)){if(!create)return null;fs.mkdirSync(path);}const s=fs.lstatSync(path);check(s.isDirectory()&&!s.isSymbolicLink(),'REFRESH_UNSAFE_DIRECTORY');}return path;
}
export function readWeeklyRefreshes(root,at){
 const records=[],issues=[];let bytesRead=0;try{
  const dir=safeDirectory(root);if(!dir)return {records,issues};const files=fs.readdirSync(dir);check(files.length<=510,'REFRESH_CATALOG_LIMIT');
  for(const name of files.sort()){
   if(/^[a-z_]+\.lock$/.test(name)){issues.push({source:name.slice(0,-5),state:'INCOMPLETE_ATTEMPT'});continue;}
   check(/^[a-z_]+-[0-9a-f-]{36}\.json$/.test(name),'REFRESH_FILE');const path=BASE+'/'+name,bytes=readSourceBytes(root,path,2*1024*1024),{fingerprint,...r}=JSON.parse(bytes);
   bytesRead+=bytes.length;check(bytesRead<=64*1024*1024,'REFRESH_READ_BOUND');
   check(r.version==='WEEKLY_PUBLIC_SOURCE_RECEIPT_V1'&&Object.hasOwn(WEEKLY_REFRESH_URLS,r.sourceId)&&r.url===WEEKLY_REFRESH_URLS[r.sourceId]&&sourceHash(JSON.stringify(r))===fingerprint,'REFRESH_INTEGRITY');
   check(sourceClock(r.requestedAt)&&sourceClock(r.receivedAt)&&Date.parse(r.requestedAt)<=Date.parse(r.receivedAt)&&Date.parse(r.receivedAt)<=Date.parse(at),'REFRESH_CLOCK');
   const parsed=parseWeeklyResponse(r);check(sourceHash(JSON.stringify(parsed))===sourceHash(JSON.stringify(r.parsed)),'REFRESH_REPLAY');
   records.push({...r,parsed,path,recordFingerprint:fingerprint});
  }
 }catch(e){issues.push({source:'weekly-refresh',state:['ERR_ACCESS_DENIED','EACCES','EPERM'].includes(e.code)?'READ_ONLY_RESTRICTED':'INVALID_EVIDENCE'});}
 return {records:records.sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)),issues};
}
export async function refreshWeeklySources({root,sourceIds=['bls_calendar','fomc_calendar'],fetchImplementation=globalThis.fetch,now=()=>new Date().toISOString(),deadlineMs=12000,signal}={}){
 check(Array.isArray(sourceIds)&&sourceIds.length>0&&sourceIds.length<=10&&new Set(sourceIds).size===sourceIds.length&&sourceIds.every(id=>Object.hasOwn(WEEKLY_REFRESH_URLS,id)),'REFRESH_SCOPE');check(Number.isInteger(deadlineMs)&&deadlineMs>0&&deadlineMs<=12000,'REFRESH_DEADLINE');
 const dir=safeDirectory(root,true),results=[];
 for(const sourceId of sourceIds){
  check(!signal?.aborted,'REFRESH_CANCELLED_BEFORE_REQUEST');
  const started=now();check(sourceClock(started),'REFRESH_CLOCK');const saved=readWeeklyRefreshes(root,started);check(!saved.issues.length,'REFRESH_STORE_REQUIRES_REVIEW');check(saved.records.length<500,'REFRESH_STORE_LIMIT');
  const latest=saved.records.findLast(r=>r.sourceId===sourceId);if(latest&&Date.parse(started)-Date.parse(latest.requestedAt)<3600000){results.push({sourceId,status:'COOLDOWN',nextEligibleAt:new Date(Date.parse(latest.requestedAt)+3600000).toISOString()});continue;}
  const lock=resolve(dir,sourceId+'.lock'),fd=fs.openSync(lock,'wx');let persisted=false;
  try{
   // Another process may have completed between the initial read and our claim.
   // Recheck under the exclusive claim before making any request.
   const locked=readWeeklyRefreshes(root,started);
   check(!locked.issues.some(i=>i.source!==sourceId||i.state!=='INCOMPLETE_ATTEMPT'),'REFRESH_STORE_REQUIRES_REVIEW');
   const concurrent=locked.records.findLast(r=>r.sourceId===sourceId);
   if(concurrent&&Date.parse(started)-Date.parse(concurrent.requestedAt)<3600000){persisted=true;results.push({sourceId,status:'COOLDOWN',nextEligibleAt:new Date(Date.parse(concurrent.requestedAt)+3600000).toISOString()});continue;}
   fs.writeFileSync(fd,JSON.stringify({sourceId,requestedAt:started}));fs.fsyncSync(fd);
   const controller=new AbortController();let timer,reader,cancel,transportError=null,httpStatus=null,responseHeaders={},chunks=[],total=0;
   const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('DEADLINE_EXCEEDED'));},deadlineMs);});
   const cancelled=new Promise((_,reject)=>{cancel=()=>{controller.abort();reject(Error('CANCELLED'));};});
   // Attach a handler before a pre-aborted signal can reject the cancellation.
   cancelled.catch(()=>{});signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
   const bounded=p=>Promise.race([p,deadline,cancelled]);
   try{
    const response=await bounded(fetchImplementation(WEEKLY_REFRESH_URLS[sourceId],{redirect:'manual',credentials:'omit',signal:controller.signal,headers:{'User-Agent':'Alpha-Options-Research/0.2 (public source review)',Accept:calendarKind(sourceId)?sourceId==='bls_calendar'?'text/calendar':'text/html':'application/rss+xml, application/atom+xml, application/xml, text/xml'}}));
    httpStatus=response.status;responseHeaders=Object.fromEntries(['content-type','date','last-modified','etag','content-length','location'].map(k=>[k,response.headers.get(k)]).filter(([,v])=>v!==null));
    check(!response.redirected,'REDIRECT_REJECTED');check(response.body,'BODY_MISSING');reader=response.body.getReader();
    while(true){const part=await bounded(reader.read());if(part.done)break;const remaining=MAX_BYTES-total;chunks.push(part.value.subarray(0,remaining));total+=part.value.byteLength;if(total>MAX_BYTES)throw Error('BODY_TOO_LARGE');}
   }catch(e){transportError=['CANCELLED','DEADLINE_EXCEEDED','REDIRECT_REJECTED','BODY_MISSING','BODY_TOO_LARGE'].includes(e.message)?e.message:'NETWORK_FAILED';}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);controller.abort();if(reader)void reader.cancel().catch(()=>{});}
   const receivedAt=now();check(sourceClock(receivedAt)&&Date.parse(receivedAt)>=Date.parse(started),'REFRESH_CLOCK');const bytes=Buffer.concat(chunks);
   const base={version:'WEEKLY_PUBLIC_SOURCE_RECEIPT_V1',sourceId,url:WEEKLY_REFRESH_URLS[sourceId],requestedAt:started,receivedAt,httpStatus,responseHeaders,transportError,bodyComplete:transportError===null,rawBase64:bytes.toString('base64'),rawSha256:sourceHash(bytes),executionAllowed:false};
   const body={...base,parsed:parseWeeklyResponse(base)},fingerprint=sourceHash(JSON.stringify(body)),path=BASE+'/'+sourceId+'-'+randomUUID()+'.json',target=fs.openSync(resolve(root,path),'wx',0o600);
   try{fs.writeFileSync(target,JSON.stringify({...body,fingerprint},null,2)+'\n');fs.fsyncSync(target);}finally{fs.closeSync(target);}persisted=true;results.push({sourceId,path,recordFingerprint:fingerprint,requestedAt:started,receivedAt,httpStatus,status:body.parsed.status,errorCode:body.parsed.errorCode,rawSha256:body.rawSha256});
  }finally{fs.closeSync(fd);if(persisted)fs.unlinkSync(lock);}
 }
 return {version:'WEEKLY_REFRESH_RESULT_V1',results,executionAllowed:false,scheduleCreated:false};
}
