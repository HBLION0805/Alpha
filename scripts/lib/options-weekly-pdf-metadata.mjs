import fs from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readSourceBytes,sourceHash,sourceClock,WEEKLY_SOURCE_BASE} from './options-weekly-source-storage.mjs';
import {CBOE_PDF_URL} from './options-weekly-source-supplement.mjs';
export const PDF_METADATA_ID='cboe_pdf_metadata',PDF_INTERVAL_MS=7*86400000;
export const PDF_BASELINE=Object.freeze({path:WEEKLY_SOURCE_BASE+'/supplements/8b89ea74-b46e-4284-9cbf-15fd3ad40c26/receipt.json',sha256:'f18e2936dcc499a8cc80001b8e9e8bf1842ab22fd9edfeb04ee46ffc4e7e5d5b'});
const BASE=WEEKLY_SOURCE_BASE+'/pdf-metadata',check=(v,c)=>{if(!v)throw Error(c);};
function directory(root){let p=fs.realpathSync(root);for(const part of BASE.split('/')){p=resolve(p,part);if(!fs.existsSync(p))fs.mkdirSync(p);check(fs.lstatSync(p).isDirectory()&&!fs.lstatSync(p).isSymbolicLink(),'PDF_METADATA_DIRECTORY');}return p;}
export function readPdfMetadata(root,at,baseline=PDF_BASELINE){
 const records=[],issues=[];let original=null;
 try{
  const bytes=readSourceBytes(root,baseline.path,3*1024*1024);check(sourceHash(bytes)===baseline.sha256,'PDF_METADATA_BASELINE');original=JSON.parse(bytes);
  const raw=Buffer.from(original.rawBase64,'base64');check(original.version==='CBOE_PDF_ACQUISITION_V1'&&original.url===CBOE_PDF_URL&&original.bodyComplete&&original.error===null&&sourceHash(raw)===original.rawSha256&&sourceClock(original.receivedAt)&&Date.parse(original.receivedAt)<=Date.parse(at),'PDF_METADATA_BASELINE');
  records.push({sourceId:PDF_METADATA_ID,requestedAt:original.requestedAt,receivedAt:original.receivedAt,parsed:{status:'OBTAINED_PENDING_REVIEW'},baseline:true});
 }catch(e){if(e.code!=='ENOENT')issues.push({source:PDF_METADATA_ID,state:'INVALID_BASELINE'});}
 try{const names=fs.readdirSync(resolve(root,BASE));check(names.length<=101,'PDF_METADATA_LIMIT');for(const name of names.sort()){
  if(name==='active.lock'){issues.push({source:PDF_METADATA_ID,state:'INCOMPLETE_ATTEMPT'});continue;}
  check(/^[0-9a-f-]{36}\.json$/.test(name),'PDF_METADATA_FILE');const path=BASE+'/'+name,{fingerprint,...r}=JSON.parse(readSourceBytes(root,path,16384));
  check(r.version==='CBOE_PDF_METADATA_V1'&&r.url===CBOE_PDF_URL&&r.baselineSha256===baseline.sha256&&sourceHash(JSON.stringify(r))===fingerprint&&sourceClock(r.requestedAt)&&sourceClock(r.receivedAt)&&r.requestedAt<=r.receivedAt&&r.receivedAt<=at,'PDF_METADATA_INTEGRITY');
  records.push({...r,path,recordFingerprint:fingerprint,sourceId:PDF_METADATA_ID,parsed:{status:r.error?'ACQUISITION_FAILED':'OBTAINED_PENDING_REVIEW'}});
 }}catch(e){if(e.code!=='ENOENT')issues.push({source:PDF_METADATA_ID,state:'INVALID_EVIDENCE'});}
 return {records:records.sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)),issues,original};
}
// HEAD only. A changed validator requires a separately reviewed bounded download.
export async function checkPdfMetadata({root,now=()=>new Date().toISOString(),fetchImplementation=globalThis.fetch,deadlineMs=12000,signal,baseline=PDF_BASELINE}={}){
 check(Number.isInteger(deadlineMs)&&deadlineMs>0&&deadlineMs<=12000,'PDF_METADATA_DEADLINE');
 const requestedAt=now(),saved=readPdfMetadata(root,requestedAt,baseline);check(!saved.issues.length&&saved.original&&saved.records.length<=100,'PDF_METADATA_STORE_REQUIRES_REVIEW');
 const latest=saved.records.at(-1),nextEligibleAt=new Date(Date.parse(latest.requestedAt)+PDF_INTERVAL_MS).toISOString();
 if(requestedAt<nextEligibleAt)return {sourceId:PDF_METADATA_ID,status:'COOLDOWN',nextEligibleAt};
 check(!signal?.aborted,'PDF_METADATA_CANCELLED');const dir=directory(root),lock=resolve(dir,'active.lock'),fd=fs.openSync(lock,'wx');let persisted=false;
 try{
  const fresh=readPdfMetadata(root,requestedAt,baseline);check(!fresh.issues.some(i=>i.state!=='INCOMPLETE_ATTEMPT')&&fresh.records.at(-1).requestedAt===latest.requestedAt,'PDF_METADATA_CONCURRENT_CHANGE');
  fs.writeFileSync(fd,JSON.stringify({requestedAt}));fs.fsyncSync(fd);
  const controller=new AbortController(),cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});let timer,error=null,httpStatus=null,headers={};
  const abort=new Promise((_,reject)=>{controller.signal.addEventListener('abort',()=>reject(Error('PDF_METADATA_CANCELLED_OR_DEADLINE')),{once:true});});abort.catch(()=>{});
  timer=setTimeout(cancel,deadlineMs);if(signal?.aborted)cancel();
  try{const response=await Promise.race([fetchImplementation(CBOE_PDF_URL,{method:'HEAD',redirect:'manual',credentials:'omit',signal:controller.signal,headers:{'User-Agent':'Alpha-Options-Research/0.2 (bounded public PDF review)',Accept:'application/pdf',...(saved.original.headers.etag?{'If-None-Match':saved.original.headers.etag}:{})}}),abort]);
   httpStatus=response.status;headers=Object.fromEntries(['etag','last-modified','content-length','content-type','location'].map(k=>[k,response.headers.get(k)]).filter(([,v])=>v!==null));
   if(response.body)void response.body.cancel().catch(()=>{});check(!response.redirected&&[200,304].includes(httpStatus),'PDF_METADATA_HTTP_OR_REDIRECT');
  }catch(e){error=/^PDF_METADATA_/.test(e.message)?e.message:'PDF_METADATA_NETWORK_FAILED';}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);controller.abort();}
  const old=saved.original.headers,state=error?'ACQUISITION_FAILED':httpStatus===304?'NOT_MODIFIED_BY_SERVER':headers.etag&&old.etag?(headers.etag===old.etag?'ETAG_UNCHANGED_NOT_BYTE_VERIFIED':'CHANGED_REQUIRES_REVIEW'):'VALIDATOR_UNKNOWN_REQUIRES_REVIEW';
  const receivedAt=now();check(sourceClock(receivedAt)&&receivedAt>=requestedAt,'PDF_METADATA_CLOCK');
  const body={version:'CBOE_PDF_METADATA_V1',url:CBOE_PDF_URL,requestedAt,receivedAt,httpStatus,headers,error,state,baselineSha256:baseline.sha256,downloadedBodyBytes:0,dateMappingUpdated:false,executionAllowed:false},fingerprint=sourceHash(JSON.stringify(body)),path=BASE+'/'+randomUUID()+'.json';
  fs.writeFileSync(resolve(root,path),JSON.stringify({...body,fingerprint},null,2)+'\n',{flag:'wx',mode:0o600});persisted=true;
  return {sourceId:PDF_METADATA_ID,path,recordFingerprint:fingerprint,status:error?'ACQUISITION_FAILED':'OBTAINED_PENDING_REVIEW',state,httpStatus,requestedAt,receivedAt};
 }finally{fs.closeSync(fd);if(persisted)fs.unlinkSync(lock);}
}
