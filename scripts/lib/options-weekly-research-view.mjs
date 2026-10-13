import fs from 'node:fs';
import {resolve} from 'node:path';
import {readSourceBytes,sourceHash,sourceClock} from './options-weekly-source-storage.mjs';
import {captureWeeklyResearch} from './options-weekly-research-inputs.mjs';
import {TECH36_POOL,readTechEventReviews} from './options-tech-candidate.mjs';
import {WEEKLY_ISSUER_SOURCES} from './options-weekly-issuer-sources.mjs';
import {researchSummary} from './options-tech-research-view.mjs';

export const WEEKLY_RESEARCH_BINDING='data/runtime/options-weekly-sources/research-binding.json';
const check=(v,c)=>{if(!v)throw Error(c);};
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const same=(a,b)=>canonical(a)===canonical(b);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const run=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{0,95}$/.test(v);
const clock=v=>sourceClock(v)?v:null;
function directory(root,path){
 check(typeof path==='string'&&path.length<500&&/^[a-zA-Z0-9_./-]+$/.test(path)&&!path.startsWith('/')&&path.split('/').every(x=>x&&x!=='.'&&x!=='..'),'UNSAFE_BINDING');
 let p=fs.realpathSync(root);for(const part of path.split('/')){p=resolve(p,part);const s=fs.lstatSync(p);check(s.isDirectory()&&!s.isSymbolicLink(),'UNSAFE_BINDING');}return p;
}
function readBudget(){
 let bytes=0,files=0;const seen=new Set();
 return function inspect(path,depth=0){
  check(depth<=16,'READ_BOUND');if(seen.has(path))return;seen.add(path);
  const entries=fs.readdirSync(path,{withFileTypes:true});check(entries.length<=800,'READ_BOUND');
  for(const e of entries){const p=resolve(path,e.name),s=fs.lstatSync(p);check(!s.isSymbolicLink(),'UNSAFE_BINDING');
   if(s.isDirectory())inspect(p,depth+1);else{check(s.isFile()&&s.nlink===1&&s.size<=4*1024*1024,'READ_BOUND');bytes+=s.size;files++;check(bytes<=192*1024*1024&&files<=2400,'READ_BOUND');}}
 };
}
function publicUrl(url,at){
 try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)return null;
  return Object.values(WEEKLY_ISSUER_SOURCES).some(s=>s.url(at)===url)||/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/\d+\/\d+\/[a-zA-Z0-9_./-]+$/.test(url)?url:null;
 }catch{return null;}
}
function reviewDetails(root,view){
 const result=new Map();
 for(let i=0;i<view.revisionCount;i++){
  const r=JSON.parse(readSourceBytes(root,`data/runtime/options-workbench-development/${view.runId}/event-reviews/${String(i+1).padStart(6,'0')}/record.json`,4*1024*1024));
  const {fingerprint,...body}=r;check(fingerprint===view.rankingChanges[i].revisionSha256&&sourceHash(JSON.stringify(body))===fingerprint,'REVIEW_CHANGED');
  const q=JSON.parse(r.requestUtf8);check(sourceHash(r.requestUtf8)===r.requestSha256,'REVIEW_CHANGED');
  const citations=q.review.citations.map(c=>{const d=view.inputs.documents.find(d=>d.eventId===q.eventId&&d.sha256===c.sha256),b=d?.blocks.find(b=>b.index===c.blockIndex);check(b,'CITATION_MISSING');
   const e=q.evidence.find(e=>e.sha256===c.sha256);
   return {sha256:c.sha256,blockIndex:c.blockIndex,excerpt:researchSummary(b.text),url:publicUrl(d.url,r.recordedAt),requestedAt:clock(e?.startedAt),receivedAt:clock(d.receivedAt),publishedAt:clock(d.publishedAt)};});
  result.set(q.eventId,{dimensions:Object.fromEntries(['impact','valuation','catalyst','evidence'].map(k=>[k,Number.isInteger(q.review.dimensions[k])?q.review.dimensions[k]:null])),citations,headSha256:fingerprint});
 }return result;
}
function row(e,view,details,batch,health){
 const w=e.weeklyEvidence,s=e.savedReview,reviewed=e.reviewStatus==='ATTRIBUTED_SAVED_REVIEW',d=details.get(e.eventId),rank=view.ranking.find(r=>r.eventId===e.eventId);
 check(!reviewed||d,'REVIEW_DETAILS_MISSING');
 return {eventId:e.eventId,canonicalEventId:w.canonicalEventId,versionHash:w.versionHash,previousVersionIds:w.previousVersionIds,symbol:e.symbol,
  title:researchSummary(w.kind==='OFFICIAL_FILING_METADATA'?`${e.symbol} ${w.metadata.form} ${w.identity.accession}`:w.metadata.title),kind:w.kind,
  identity:{cik:w.identity.cik??null,accession:w.identity.accession??null,sourceId:w.identity.sourceId??null},batchIds:[batch],baseReceiptSha256:view.baseReceiptSha256,headSha256:view.headSha256,
  eventDate:w.metadata.startAt??null,eventTimePrecision:w.metadata.timePrecision??'UNKNOWN',crossSourceAssociation:w.crossSourceAssociation,
  bodyStatus:w.kind==='OFFICIAL_FILING_METADATA'?'SUBMISSIONS_METADATA_NOT_FILING_BODY':'SAVED_IR_BODY_NOT_FULL_COMPANY_COVERAGE',
  sources:w.references.map(r=>({sourceId:r.sourceId,recordFingerprint:r.recordFingerprint,rawSha256:r.rawSha256,url:publicUrl(r.url,r.receivedAt),requestedAt:clock(r.requestedAt),receivedAt:clock(r.receivedAt),publishedAt:clock(r.publishedAt),filingAcceptedAt:clock(r.filingAcceptedAt)})),
  reviewStatus:e.reviewStatus,reviewedAt:clock(s?.reviewedAt),coverageStatus:e.coverageStatus,
  review:reviewed?{fact:researchSummary(s.fact),interpretation:researchSummary(s.interpretation),nextEvidence:researchSummary(s.nextEvidence),eventWindow:researchSummary(s.eventWindow),originalVerified:s.originalVerified,companyEventVerified:s.companyEventVerified,materialityReviewed:s.materialityReviewed,materialConflict:s.materialConflict,...d}:null,
  ranking:rank?{category:rank.category,coreScore:rank.coreScore}: {category:'MISSING_DATA',coreScore:null},
  sourceFailureIds:health.filter(h=>h.symbol===e.symbol&&h.status==='ACQUISITION_FAILED').map(h=>h.sourceId),
  fundamentalDirection:'UNKNOWN',newsDirection:'UNKNOWN',researchStatus:reviewed?'CITED_REVIEW_NOT_DIRECTIONAL_PLAN':'PENDING_ORIGINAL_REVIEW',quoteStatus:'NOT_RUN',paperStatus:'NOT_RUN',
  blockers:[...(!reviewed?['ORIGINAL_REVIEW_REQUIRED']:[]),...(w.kind==='OFFICIAL_FILING_METADATA'?['FILING_BODY_MISSING']:[]),'DIRECTIONAL_RESEARCH_NOT_ESTABLISHED','LATER_QUOTES_NOT_EVALUATED','PAPER_ADMISSION_NOT_EVALUATED']};
}

/** Explicit pinned binding only. No discovery, refresh, fallback to absolute receipt paths or writes. */
export function readWeeklyResearchView({root,at=new Date().toISOString()}={}){
 const out={version:'WEEKLY_RESEARCH_VIEW_V1',checkedAt:clock(at),state:'MISSING',counts:null,rows:[],batches:[],sourceHealth:[],issues:[],sourceCalls:0,fileSystemWrites:0,executionAllowed:false,paperAdmissionAllowed:false};
 let bytes;try{bytes=readSourceBytes(root,WEEKLY_RESEARCH_BINDING,32*1024);}catch(e){if(e.code!=='ENOENT'){out.state='BLOCKED';out.issues.push({code:'BINDING_UNREADABLE'});}return out;}
 try{
  const b=JSON.parse(bytes);check(b.version==='WEEKLY_RESEARCH_VIEW_BINDING_V1'&&hash(b.intake?.sha256)&&Array.isArray(b.reviews)&&b.reviews.length<=8,'INVALID_BINDING');check(clock(at),'INVALID_CLOCK');
  check(typeof b.intake.path==='string'&&b.intake.path.endsWith('/receipt.json'),'INVALID_BINDING');const intakeRoot=directory(root,b.intake.path.slice(0,-13));
  const receiptBytes=readSourceBytes(intakeRoot,'receipt.json',4*1024*1024);check(sourceHash(receiptBytes)===b.intake.sha256,'INTAKE_HASH');const r=JSON.parse(receiptBytes);
  check(r.version==='TECH36_WEEKLY_RESEARCH_INTAKE_V1'&&clock(r.processedAt)&&Date.parse(r.processedAt)<=Date.parse(at)&&Array.isArray(r.batches)&&r.batches.length>0&&r.batches.length<=8,'INVALID_INTAKE');
  const budget=readBudget(),originals=directory(intakeRoot,'originals');budget(originals);
  const snapshot=captureWeeklyResearch(originals,r.processedAt,TECH36_POOL),p=snapshot.projection;
  check(same(p.counts,r.counts)&&same(p.events,r.lineage)&&same(p.health,r.sourceHealth),'INTAKE_REPLAY');
  check(r.sourceOriginals.length===snapshot.files.size&&new Set(r.sourceOriginals.map(x=>x.path)).size===snapshot.files.size&&r.sourceOriginals.every(x=>x.path.startsWith('originals/')&&sourceHash(snapshot.files.get(x.path.slice(10))??'')===x.sha256),'ORIGINAL_SET');
  const latest=new Map();for(const h of p.health)latest.set(h.sourceId,h);const health=[...latest.values()];
  out.sourceHealth=health.map(h=>({symbol:h.symbol,sourceId:h.sourceId,status:h.status,errorCode:researchSummary(h.errorCode),requestedAt:clock(h.requestedAt),receivedAt:clock(h.receivedAt),rawSha256:h.rawSha256}));
  out.counts={...p.counts,loadedEvents:0,reviewedEvents:0,selectedEvents:0};out.intakeSha256=b.intake.sha256;out.processedAt=r.processedAt;
  const workspace=directory(intakeRoot,'workspace'),catalog=new Map(p.events.map(e=>[e.eventId,e])),unique=new Map(),batchIds=new Set();
  budget(workspace);
  for(const batch of r.batches){
   check(run(batch.runId)&&!batchIds.has(batch.runId),'BATCH_IDENTITY');batchIds.add(batch.runId);
   try{
    let v=readTechEventReviews({root:workspace,runId:batch.runId,now:()=>at}),details=new Map();
    check(v.baseReceiptSha256===batch.receiptSha256&&v.headSha256===batch.headSha256&&v.revisionCount===0&&v.scanId===batch.scanId&&v.inputs.eventInputs.length===batch.eventCount,'BATCH_BINDING');
    for(const e of v.inputs.eventInputs)check(same(catalog.get(e.eventId),e.weeklyEvidence),'CATALOG_BINDING');
    const refs=b.reviews.filter(x=>x.runId===batch.runId);let reviewUnavailable=false;
    if(refs.length)try{
     check(refs.every(x=>same(x,refs[0])),'CONFLICTING_REVIEW_BINDINGS');const ref=refs[0];check(hash(ref.headSha256)&&ref.baseReceiptSha256===v.baseReceiptSha256,'REVIEW_BINDING');
     const reviewRoot=directory(root,ref.workspace);budget(reviewRoot);const next=readTechEventReviews({root:reviewRoot,runId:batch.runId,now:()=>at});
     check(next.headSha256===ref.headSha256&&next.baseReceiptSha256===v.baseReceiptSha256&&next.scanId===v.scanId&&next.inputs.eventInputs.length===v.inputs.eventInputs.length&&next.inputs.eventInputs.every(e=>same(e.weeklyEvidence,v.inputs.eventInputs.find(old=>old.eventId===e.eventId)?.weeklyEvidence)),'REVIEW_BINDING');
     details=reviewDetails(reviewRoot,next);v=next;
    }catch{reviewUnavailable=true;out.issues.push({code:'REVIEW_UNAVAILABLE',batchId:batch.runId});}
    const rows=v.inputs.eventInputs.map(e=>row(e,v,details,batch.runId,health));
    for(const value of rows){if(reviewUnavailable){value.reviewStatus='BOUND_REVIEW_UNAVAILABLE';value.blockers.unshift('BOUND_REVIEW_UNAVAILABLE');}const old=unique.get(value.eventId);if(old){check(old.versionHash===value.versionHash&&old.headSha256===value.headSha256,'DUPLICATE_EVENT_CONFLICT');old.batchIds.push(batch.runId);}else unique.set(value.eventId,value);}
    out.batches.push({runId:batch.runId,state:reviewUnavailable?'PARTIAL':'AVAILABLE',eventCount:rows.length,headSha256:v.headSha256,revisionCount:v.revisionCount,sourceCutoff:clock(batch.sourceCutoff)});
   }catch{out.issues.push({code:'BATCH_UNAVAILABLE',batchId:batch.runId});out.batches.push({runId:batch.runId,state:'BLOCKED',eventCount:0});}
  }
  check(b.reviews.every(x=>batchIds.has(x.runId)),'UNBOUND_REVIEW');out.rows=[...unique.values()].sort((a,b)=>a.symbol.localeCompare(b.symbol)||a.eventId.localeCompare(b.eventId));
  if(out.rows.length!==p.events.length)out.issues.push({code:'INCOMPLETE_CATALOG'});
  out.counts.loadedEvents=out.rows.length;out.counts.reviewedEvents=out.rows.filter(r=>r.reviewStatus==='ATTRIBUTED_SAVED_REVIEW').length;out.counts.selectedEvents=out.rows.filter(r=>r.ranking.category==='SELECTED').length;
  out.state=out.issues.length?'PARTIAL':'AVAILABLE';return out;
 }catch{return {...out,state:'BLOCKED',counts:null,rows:[],batches:[],sourceHealth:[],issues:[{code:'INVALID_PINNED_WEEKLY_EVIDENCE'}]};}
}
