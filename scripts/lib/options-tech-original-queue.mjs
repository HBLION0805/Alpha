import {validateHttpCaptureObservation} from './options-http-capture-observation.mjs';
import fs from 'node:fs';
import {resolve,dirname} from 'node:path';
import {sourceHash,sourceClock,readSourceBytes} from './options-weekly-source-storage.mjs';
import {acquireBoundedIssuerResponse} from './options-weekly-issuer-sources.mjs';
import {readTechEventReviews} from './options-tech-candidate.mjs';
import {extractTechOriginal} from './options-tech-research-inputs.mjs';

const BASE='data/runtime/options-workbench-development';
const check=(v,c)=>{if(!v)throw Error('TECH_ORIGINAL_'+c);};
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join()===keys.split(',').sort().join();
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const id=s=>typeof s==='string'&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(s);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function dir(root,path,create=false){let p=fs.realpathSync(root);for(const part of path.split('/')){check(/^[a-zA-Z0-9_.-]+$/.test(part)&&part!=='.'&&part!=='..','PATH');p=resolve(p,part);if(create&&!fs.existsSync(p))fs.mkdirSync(p);const s=fs.lstatSync(p);check(s.isDirectory()&&!s.isSymbolicLink(),'PATH');}return p;}
function put(root,p,v){const target=resolve(root,p);if(p.includes('/'))dir(root,p.split('/').slice(0,-1).join('/'),true);const fd=fs.openSync(target,'wx',0o600);try{fs.writeFileSync(fd,Buffer.isBuffer(v)?v:JSON.stringify(v,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function save(root,p,body){const v={...body,fingerprint:sourceHash(JSON.stringify(body))};put(root,p,v);return v;}
function load(root,p,max=4*1024*1024){const v=JSON.parse(readSourceBytes(root,p,max)),{fingerprint,...body}=v;check(hash(fingerprint)&&sourceHash(JSON.stringify(body))===fingerprint,'HASH');return v;}
function tree(root,path){const files=new Map();let total=0;const walk=(p,depth=0)=>{check(depth<=12,'COPY_BOUND');const d=dir(root,p);const names=fs.readdirSync(d);check(names.length<=800,'COPY_BOUND');for(const n of names){const rel=p+'/'+n,s=fs.lstatSync(resolve(root,rel));check(!s.isSymbolicLink(),'PATH');if(s.isDirectory())walk(rel,depth+1);else{const b=readSourceBytes(root,rel,4*1024*1024);total+=b.length;check(total<=128*1024*1024&&files.size<800,'COPY_BOUND');files.set(rel,b);}}};walk(path);return files;}
function target(e){
 const w=e.weeklyEvidence,m=w?.metadata,i=w?.identity;
 check(w?.kind==='OFFICIAL_FILING_METADATA'&&i?.kind==='SEC_FILING'&&w.eventId===e.eventId&&i.symbol===e.symbol&&m.symbol===e.symbol&&m.cik===i.cik&&m.accession===i.accession,'CANDIDATE_IDENTITY');
 check(/^\d{10}$/.test(i.cik)&&/^\d{10}-\d{2}-\d{6}$/.test(i.accession)&&/^[A-Za-z0-9_.\/-]+$/.test(m.primaryDocument)&&!m.primaryDocument.startsWith('/')&&!m.primaryDocument.split('/').includes('..'),'CANDIDATE_URL');
 const expected=`https://www.sec.gov/Archives/edgar/data/${Number(i.cik)}/${i.accession.replaceAll('-','')}/${m.primaryDocument}`;check(m.documentUrl===expected,'CANDIDATE_URL');
 return {eventId:e.eventId,symbol:e.symbol,canonicalEventId:w.canonicalEventId,metadataVersionHash:w.versionHash,cik:i.cik,accession:i.accession,form:m.form,url:m.documentUrl,filingAcceptedAt:e.filingAcceptedAt,originalDiscoveredAt:e.discoveredAt,publicationAt:null};
}
export function prepareTechOriginalQueue({root,sourceRoot,requestPath,runId,now=()=>new Date().toISOString()}){
 check(id(runId)&&runId.length<=60,'RUN_ID');const q=JSON.parse(readSourceBytes(dirname(resolve(requestPath)),resolve(requestPath).split(/[\\/]/).at(-1),32*1024));
 check(exact(q,'version,parent,eventIds')&&q.version==='TECH_ORIGINAL_QUEUE_REQUEST_V1'&&exact(q.parent,'runId,baseReceiptSha256,headSha256')&&id(q.parent.runId)&&hash(q.parent.baseReceiptSha256)&&hash(q.parent.headSha256),'REQUEST');
 check(Array.isArray(q.eventIds)&&q.eventIds.length>0&&q.eventIds.length<=3&&new Set(q.eventIds).size===q.eventIds.length,'SCOPE');
 const preparedAt=now(),view=readTechEventReviews({root:sourceRoot,runId:q.parent.runId,now:()=>preparedAt});check(view.baseReceiptSha256===q.parent.baseReceiptSha256&&view.headSha256===q.parent.headSha256,'STALE_PARENT');
 const targets=q.eventIds.map(eventId=>{const e=view.inputs.eventInputs.find(e=>e.eventId===eventId);check(e,'EVENT');return target(e);});
 const files=tree(sourceRoot,BASE+'/'+q.parent.runId),base=dir(root,BASE,true);fs.mkdirSync(resolve(base,runId));const out=dir(root,BASE+'/'+runId);fs.mkdirSync(resolve(out,'workspace'));
 const manifest=[];for(const [p,b]of files){put(out,'workspace/'+p,b);manifest.push({path:'workspace/'+p,sha256:sourceHash(b)});}
 const copied=readTechEventReviews({root:resolve(out,'workspace'),runId:q.parent.runId,now:()=>preparedAt});check(copied.headSha256===view.headSha256,'COPIED_PARENT');
 return save(out,'queue.json',{version:'TECH_ORIGINAL_QUEUE_V1',runId,preparedAt,parent:{...q.parent,scanId:view.scanId},targets,manifest,implementation:Object.fromEntries(['options-tech-original-queue.mjs','options-http-capture-observation.mjs','options-weekly-issuer-sources.mjs','options-tech-candidate.mjs','options-tech-research-inputs.mjs'].map(p=>[p,sourceHash(fs.readFileSync(new URL(p,import.meta.url)))])),limits:{maxCandidates:3,maxBytes:524288,deadlineMs:12000,attemptsPerCandidate:1},sourceCalls:0,reviewCreated:false,executionAllowed:false});
}
function queue(root,runId,at){check(id(runId)&&sourceClock(at),'CONFIGURATION');const out=dir(root,BASE+'/'+runId),q=load(out,'queue.json');
 check(q.version==='TECH_ORIGINAL_QUEUE_V1'&&q.runId===runId&&sourceClock(q.preparedAt)&&Date.parse(q.preparedAt)<=Date.parse(at)&&q.targets.length>0&&q.targets.length<=3&&new Set(q.targets.map(t=>t.eventId)).size===q.targets.length,'QUEUE');
 check(q.manifest.length<=800,'COPY_BOUND');let total=0;for(const m of q.manifest){check(/^workspace\/data\/runtime\/options-workbench-development\/[a-z0-9-]+\//.test(m.path),'PATH');const b=readSourceBytes(out,m.path,4*1024*1024);total+=b.length;check(total<=128*1024*1024&&sourceHash(b)===m.sha256,'COPIED_HASH');}
 const view=readTechEventReviews({root:resolve(out,'workspace'),runId:q.parent.runId,now:()=>at});check(view.baseReceiptSha256===q.parent.baseReceiptSha256&&view.headSha256===q.parent.headSha256,'STALE_PARENT');
 check(q.targets.every(t=>{const e=view.inputs.eventInputs.find(e=>e.eventId===t.eventId);return e&&same(target(e),t);}),'TARGET_REPLAY');return {out,q,view};
}
export function classifyTechOriginalResponse(r){
 validateHttpCaptureObservation(r);
 const bytes=Buffer.from(r.rawBase64,'base64');check(bytes.length<=524288&&bytes.toString('base64')===r.rawBase64&&sourceHash(bytes)===r.rawSha256,'RAW_HASH');
 if(r.transportError||r.httpStatus!==200||!r.bodyComplete)return {status:'ACQUISITION_FAILED',reason:r.transportError??'HTTP_'+r.httpStatus,bodyScope:'NOT_OBTAINED',blocks:[]};
 if(!/^text\/html(?:;|$)/i.test(r.responseHeaders['content-type']??''))return {status:'UNSUPPORTED_CONTENT_TYPE',reason:'HTML_BODY_REQUIRED_FOR_EXISTING_REVIEW',bodyScope:'UNKNOWN',blocks:[]};
 let body;try{body=extractTechOriginal(bytes);}catch{return {status:'UNSUPPORTED_BODY',reason:'ENCODING',bodyScope:'UNKNOWN',blocks:[]};}
 const text=body.blocks.map(b=>b.text).join(' ');
 if(/undeclared automated tool|request rate threshold|access denied|robots\.txt|sign in to (?:view|continue)|log in to (?:view|continue)/i.test(text))return {status:'ACCESS_RESTRICTED',reason:'ACCESS_POLICY_RESPONSE',bodyScope:'NOT_OBTAINED',blocks:[]};
 const index=/filing detail|document format files|exhibit index/i.test(text),cover=/report of foreign private issuer/i.test(text)&&/exhibit/i.test(text);
 return {status:body.status==='BODY_TEXT_EXTRACTED'?'BODY_OBTAINED_PENDING_REVIEW':'UNSUPPORTED_BODY',reason:null,bodyScope:index||cover?'SEC_COVER_OR_INDEX_NOT_COMPLETE_FILING':'SEC_PRIMARY_DOCUMENT_SCOPE_UNREVIEWED',blocks:body.blocks};
}
export async function acquireTechOriginalQueue({root,runId,now=()=>new Date().toISOString(),fetchImplementation=globalThis.fetch,deadlineMs=12000,evidenceContext='REAL_PUBLIC_SOURCE'}={}){
 check(Number.isInteger(deadlineMs)&&deadlineMs>0&&deadlineMs<=12000,'DEADLINE');check(['REAL_PUBLIC_SOURCE','TEST_FIXTURE'].includes(evidenceContext)&&(fetchImplementation===globalThis.fetch||evidenceContext==='TEST_FIXTURE'),'CONTEXT');
 const {out,q}=queue(root,runId,now());if(fs.existsSync(resolve(out,'result.json')))return readTechOriginalQueue({root,runId,now});
 put(out,'attempt.json',{version:'TECH_ORIGINAL_ATTEMPT_V1',queueSha256:q.fingerprint,startedAt:now(),evidenceContext});const acquisitions=[];let stop=false;
 for(const [index,t]of q.targets.entries()){
  if(stop){acquisitions.push({eventId:t.eventId,status:'NOT_ATTEMPTED_AFTER_FAILURE',sourceCalls:0});continue;}
  const requestedAt=now();check(Date.parse(requestedAt)>=Date.parse(q.preparedAt),'CLOCK');
  const response=await acquireBoundedIssuerResponse({url:t.url,requestedAt,now,fetchImplementation,deadlineMs,accept:'text/html'}),classification=classifyTechOriginalResponse(response),prefix='acquisitions/'+String(index+1).padStart(3,'0');
  const receipt=save(out,prefix+'/receipt.json',{version:'TECH_ORIGINAL_ACQUISITION_V1',queueSha256:q.fingerprint,target:t,evidenceContext,...response,classification,executionAllowed:false});
  put(out,prefix+'/original.html',Buffer.from(response.rawBase64,'base64'));acquisitions.push({eventId:t.eventId,path:prefix+'/receipt.json',fingerprint:receipt.fingerprint,status:classification.status,sourceCalls:1});
  if(classification.status==='BODY_OBTAINED_PENDING_REVIEW')put(out,prefix+'/review-request-draft.json',{version:'TECH36_EVENT_REVIEW_REQUEST_V1',requestId:'original-'+runId+'-'+index,parent:{scanId:q.parent.scanId,baseReceiptSha256:q.parent.baseReceiptSha256,revisionSha256:q.parent.headSha256},symbol:t.symbol,eventId:t.eventId,mode:evidenceContext==='TEST_FIXTURE'?'SYNTHETIC_FIXTURE':'SAVED_SOURCE_REVIEW',evidence:[{rawPath:'original.html',sha256:response.rawSha256,url:t.url,startedAt:response.requestedAt,receivedAt:response.receivedAt,publishedAt:null,provenance:evidenceContext==='TEST_FIXTURE'?'SYNTHETIC_FIXTURE':'NEW_PUBLIC_ORIGINAL'}],review:{originalVerified:false,companyEventVerified:false,materialityReviewed:false,materialConflict:false,dimensions:{impact:0,catalyst:0,evidence:0,valuation:null},fact:'Acquired primary-document bytes; company-event meaning and document scope remain unreviewed.',analysis:'Transport success is not full-filing coverage, verified company facts, a new event or a directional signal.',nextEvidence:'Explicitly review cited body blocks and scope before appending an attributed review. Do not infer missing exhibits or complete filing coverage.',eventWindow:null,citations:[]},links:[]});
  else stop=true;
 }
 save(out,'result.json',{version:'TECH_ORIGINAL_QUEUE_RESULT_V1',queueSha256:q.fingerprint,completedAt:now(),evidenceContext,acquisitions,sourceCalls:acquisitions.reduce((n,a)=>n+a.sourceCalls,0),automaticReview:false,automaticSelection:false,executionAllowed:false});return readTechOriginalQueue({root,runId,now});
}
export function readTechOriginalQueue({root,runId,now=()=>new Date().toISOString()}={}){
 const at=now(),{out,q,view}=queue(root,runId,at);let result=null;if(fs.existsSync(resolve(out,'result.json')))result=load(out,'result.json');
 if(result)check(result.version==='TECH_ORIGINAL_QUEUE_RESULT_V1'&&result.queueSha256===q.fingerprint&&sourceClock(result.completedAt)&&Date.parse(result.completedAt)<=Date.parse(at)&&result.acquisitions.length===q.targets.length,'RESULT');
 const records=q.targets.map((t,index)=>{const a=result?.acquisitions[index];if(!a)return {...t,acquisitionStatus:fs.existsSync(resolve(out,'attempt.json'))?'INCOMPLETE_ATTEMPT_NO_RETRY':'NOT_ATTEMPTED',researchStatus:'NOT_REVIEWED'};
  check(a.eventId===t.eventId,'RESULT_TARGET');if(a.sourceCalls===0){check(a.status==='NOT_ATTEMPTED_AFTER_FAILURE','RESULT');return {...t,acquisitionStatus:a.status,researchStatus:'NOT_REVIEWED'};}
  check(a.path===`acquisitions/${String(index+1).padStart(3,'0')}/receipt.json`,'RESULT_PATH');const r=load(out,a.path);check(r.version==='TECH_ORIGINAL_ACQUISITION_V1'&&r.queueSha256===q.fingerprint&&r.fingerprint===a.fingerprint&&same(r.target,t)&&r.url===t.url&&same(r.classification,classifyTechOriginalResponse(r))&&a.status===r.classification.status&&r.evidenceContext===result.evidenceContext,'ACQUISITION_REPLAY');
  check(sourceClock(r.requestedAt)&&sourceClock(r.receivedAt)&&Date.parse(r.requestedAt)>=Date.parse(q.preparedAt)&&Date.parse(r.receivedAt)>=Date.parse(r.requestedAt)&&Date.parse(r.receivedAt)<=Date.parse(result.completedAt),'CLOCK');check(sourceHash(readSourceBytes(out,a.path.replace('receipt.json','original.html'),524288))===r.rawSha256,'RAW_HASH');
  const e=view.inputs.eventInputs.find(e=>e.eventId===t.eventId);return {...t,acquisitionStatus:a.status,reason:r.classification.reason,bodyScope:r.classification.bodyScope,requestedAt:r.requestedAt,receivedAt:r.receivedAt,rawSha256:r.rawSha256,httpStatus:r.httpStatus,...(r.transportObservation?{transportObservation:validateHttpCaptureObservation(r)}:{}),transportLength:r.transportObservation?{declaredBytes:r.responseHeaders['content-length']??null,storedDecodedBytes:r.transportObservation.storedBytes,contentEncoding:r.transportObservation.contentEncoding,status:r.transportObservation.lengthComparison}:{declaredBytes:r.responseHeaders['content-length']??null,storedDecodedBytes:Buffer.from(r.rawBase64,'base64').length,contentEncoding:r.responseHeaders['content-encoding']??null,status:r.responseHeaders['content-length']===undefined?'DECLARED_LENGTH_UNKNOWN':r.responseHeaders['content-encoding']?'ENCODED_TRANSFER_NOT_COMPARABLE_TO_DECODED_BYTES':Number(r.responseHeaders['content-length'])===Buffer.from(r.rawBase64,'base64').length?'LENGTH_MATCH':'LENGTH_DIFFERENCE_ENCODING_OR_COMPLETENESS_UNRESOLVED'},blockCount:r.classification.blocks.length,receiptSha256:r.fingerprint,evidenceContext:r.evidenceContext,researchStatus:e.reviewStatus,coverageStatus:e.coverageStatus,ranking:view.ranking.find(r=>r.eventId===t.eventId)?.category??'MISSING_DATA',quoteStatus:'NOT_RUN',paperStatus:'NOT_RUN',draftOnly:true};
 });return {version:'TECH_ORIGINAL_QUEUE_VIEW_V1',runId,checkedAt:at,queueSha256:q.fingerprint,parent:q.parent,records,sourceCalls:result?.sourceCalls??(fs.existsSync(resolve(out,'attempt.json'))?null:0),reviewCreated:false,executionAllowed:false};
}
