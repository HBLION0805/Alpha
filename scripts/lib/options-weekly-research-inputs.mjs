import fs from 'node:fs';
import {resolve} from 'node:path';
import {readWeeklyIssuerRefreshes,WEEKLY_ISSUER_SOURCES,parseWeeklyIssuerResponse} from './options-weekly-issuer-sources.mjs';
import {readSourceBytes,sourceHash,sourceClock} from './options-weekly-source-storage.mjs';
import {classifyAndRank} from './options-tech-review-ranking.mjs';

export const WEEKLY_RESEARCH_DESCRIPTOR='weekly-research-source.json';
export const WEEKLY_RESEARCH_BATCH=80;
const check=(ok,code)=>{if(!ok)throw Error('TECH_CANDIDATE_WEEKLY_'+code);};
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>sourceHash(canonical(v));
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.split(',').sort().join();
const receiptPath=p=>/^data\/runtime\/options-weekly-sources\/issuer-refreshes\/[a-z_]+-[0-9a-f-]{36}\.json$/.test(p);

/** Existing receipts remain the authority; no HTTP, fabricated scan, review or rank. */
export function projectWeeklyResearch(records,pool){
 check(Array.isArray(records)&&records.length<=500,'RECORD_BOUND');
 const versions=new Map(),identities=new Map(),health=[],ignored=[];let inputRows=0;
 for(const r of [...records].sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)||a.recordFingerprint.localeCompare(b.recordFingerprint))){
  const spec=WEEKLY_ISSUER_SOURCES[r.sourceId];check(spec&&sourceClock(r.requestedAt)&&sourceClock(r.receivedAt)&&Date.parse(r.requestedAt)<=Date.parse(r.receivedAt),'SOURCE_IDENTITY');
  // Also check the pure projector's inputs; never trust a caller's parsed rows.
  check(hash(parseWeeklyIssuerResponse(r))===hash(r.parsed),'PARSED_BINDING');
  if(!spec.symbol){ignored.push({path:r.path,sourceId:r.sourceId,reason:'OUTSIDE_COMPANY_SCOPE'});continue;}
  check(pool.includes(spec.symbol),'COMPANY_SCOPE');
  health.push({symbol:spec.symbol,sourceId:r.sourceId,family:spec.family??'IR',path:r.path,recordFingerprint:r.recordFingerprint,rawSha256:r.rawSha256,requestedAt:r.requestedAt,receivedAt:r.receivedAt,status:r.parsed.status,errorCode:r.parsed.errorCode,partial:r.parsed.partial,rejectedItems:r.parsed.rejectedItems??0});
  if(r.parsed.status!=='OBTAINED_PENDING_REVIEW')continue;
  check(r.bodyComplete===true,'INCOMPLETE_SUCCESS_BODY');
  const sec=spec.family==='SEC_SUBMISSIONS';
  for(const row of sec?r.parsed.filings??[]:r.parsed.events??[]){
   inputRows++;
   if(sec)check(row.symbol===spec.symbol&&row.cik===spec.cik&&row.documentBodyObtained===false&&row.documentUrl===`https://www.sec.gov/Archives/edgar/data/${Number(spec.cik)}/${row.accession.replaceAll('-','')}/${row.primaryDocument}`,'FILING_IDENTITY');
   else check(row.sourceId===r.sourceId&&row.affectedSymbols?.length===1&&row.affectedSymbols[0]===spec.symbol,'EVENT_COMPANY');
   // SEC accession+issuer is exact identity (accession prefix can be a filing agent).
   // IR has no cross-source identity proof: preserve the parser's exact event ID.
   const identity=sec?{kind:'SEC_FILING',symbol:spec.symbol,cik:spec.cik,accession:row.accession}:{kind:'IR_EVENT',symbol:spec.symbol,sourceId:r.sourceId,sourceEventId:row.eventId};
   const canonicalEventId='weekly-'+hash(identity),versionHash=hash(row),eventId=canonicalEventId+'-'+versionHash.slice(0,32);
   const ref={path:r.path,recordFingerprint:r.recordFingerprint,rawSha256:r.rawSha256,sourceId:r.sourceId,origin:r.origin.kind,url:r.url,requestedAt:r.requestedAt,receivedAt:r.receivedAt,publishedAt:sec?null:row.publishedAt??null,filingAcceptedAt:sec?row.acceptedAt:null,reviewedAt:null};
   let e=versions.get(eventId);
   if(!e){e={eventId,canonicalEventId,versionHash,identity,metadata:row,symbol:spec.symbol,kind:sec?'OFFICIAL_FILING_METADATA':'UNVERIFIED_ISSUER_EVENT',references:[],previousVersionIds:[],crossSourceAssociation:'NOT_INFERRED_FROM_SYMBOL_TITLE_OR_DATE',reviewStatus:'NOT_REVIEWED'};versions.set(eventId,e);const prior=identities.get(canonicalEventId)??[];e.previousVersionIds=[...prior];prior.push(eventId);identities.set(canonicalEventId,prior);}
   check(!e.references.some(x=>x.path===ref.path),'DUPLICATE_RECEIPT_ROW');e.references.push(ref);
  }
 }
 const events=[...versions.values()].sort((a,b)=>a.symbol.localeCompare(b.symbol)||a.eventId.localeCompare(b.eventId));
 const latest=new Map();for(const h of health)latest.set(h.sourceId,h);
 const failed=[...latest.values()].filter(h=>h.status==='ACQUISITION_FAILED');
 const ir=[...latest.values()].filter(h=>h.family!=='SEC_SUBMISSIONS'),parsedIr=new Set(ir.filter(h=>h.status==='OBTAINED_PENDING_REVIEW').map(h=>h.symbol));
 return {events,health,ignored,counts:{receipts:records.length,companyReceipts:health.length,nonCompanyReceipts:ignored.length,inputRows,deduplicatedRows:inputRows-events.length,pendingEvents:events.length,canonicalEvents:identities.size,changedMetadataVersions:events.length-identities.size,missingFilingBodies:events.filter(e=>e.kind==='OFFICIAL_FILING_METADATA').length,failedReceipts:health.filter(h=>h.status==='ACQUISITION_FAILED').length,failedLatestSources:failed.length,failedLatestIrSources:failed.filter(h=>h.family!=='SEC_SUBMISSIONS').length,parseableIrCompanies:parsedIr.size,failedIrCompaniesWithoutParseableSource:new Set(ir.filter(h=>h.status==='ACQUISITION_FAILED'&&!parsedIr.has(h.symbol)).map(h=>h.symbol)).size},sourceCalls:0,executionAllowed:false,paperAdmissionAllowed:false};
}

export function captureWeeklyResearch(root,at,pool){
 check(sourceClock(at),'CLOCK');const snapshot=readWeeklyIssuerRefreshes(root,at);check(snapshot.issues.length===0,'SOURCE_STORE_INVALID');check(snapshot.records.length>0,'SOURCE_STORE_EMPTY');
 const files=new Map();
 for(const r of snapshot.records){const bytes=readSourceBytes(root,r.path,2*1024*1024),{fingerprint,...body}=JSON.parse(bytes);check(fingerprint===r.recordFingerprint&&sourceHash(JSON.stringify(body))===fingerprint,'SOURCE_CHANGED');files.set(r.path,bytes);}
 return {files,projection:projectWeeklyResearch(snapshot.records,pool),records:snapshot.records};
}

/** Reused by loadTechResearchSource, including recovery of its copied source tree. */
export function loadWeeklyResearchSource(root,pool){
 const descriptorBytes=readSourceBytes(root,WEEKLY_RESEARCH_DESCRIPTOR,128*1024),d=JSON.parse(descriptorBytes);
 check(exact(d,'version,at,eventIds,receipts')&&d.version==='TECH36_WEEKLY_SOURCE_INPUT_V1'&&sourceClock(d.at),'DESCRIPTOR');
 check(Array.isArray(d.eventIds)&&d.eventIds.length>0&&d.eventIds.length<=WEEKLY_RESEARCH_BATCH&&new Set(d.eventIds).size===d.eventIds.length,'EVENT_BOUND');
 check(Array.isArray(d.receipts)&&d.receipts.length>0&&d.receipts.length<=180&&new Set(d.receipts.map(r=>r.path)).size===d.receipts.length,'RECEIPT_BOUND');
 const files=new Map([[WEEKLY_RESEARCH_DESCRIPTOR,descriptorBytes]]);
 for(const ref of d.receipts){check(exact(ref,'path,sha256')&&receiptPath(ref.path)&&/^[a-f0-9]{64}$/.test(ref.sha256),'REFERENCE');const bytes=readSourceBytes(root,ref.path,2*1024*1024);check(sourceHash(bytes)===ref.sha256,'ORIGINAL_HASH');files.set(ref.path,bytes);}
 const snapshot=readWeeklyIssuerRefreshes(root,d.at);check(!snapshot.issues.length&&snapshot.records.length===d.receipts.length&&snapshot.records.every(r=>files.has(r.path)),'SOURCE_SET');
 for(const r of snapshot.records){const {fingerprint,...body}=JSON.parse(files.get(r.path));check(fingerprint===r.recordFingerprint&&sourceHash(JSON.stringify(body))===fingerprint,'SOURCE_CHANGED');}
 const projection=projectWeeklyResearch(snapshot.records,pool),selected=d.eventIds.map(id=>projection.events.find(e=>e.eventId===id));check(selected.every(Boolean),'EVENT_BINDING');
 const scanId='alpha-tech36-weekly-'+hash({eventIds:d.eventIds,receipts:d.receipts}).slice(0,32),scan='runs/'+scanId+'/';
 const events=[],receipts=[],originals=[],coverage=[];
 for(const e of selected){
  const refs=[...e.references].sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)||a.recordFingerprint.localeCompare(b.recordFingerprint)),first=refs[0];
  events.push({eventId:e.eventId,symbols:[e.symbol],kind:e.kind,title:e.kind==='OFFICIAL_FILING_METADATA'?`${e.symbol} ${e.metadata.form} ${e.metadata.accession}`:e.metadata.title,publishedAt:null,filingAcceptedAt:first.filingAcceptedAt,receivedAt:first.receivedAt,weeklyEvidence:e});
  for(const ref of refs){const r=snapshot.records.find(r=>r.recordFingerprint===ref.recordFingerprint),rawPath='raw/'+r.rawSha256+(e.kind==='OFFICIAL_FILING_METADATA'?'.json':'.html'),bytes=Buffer.from(r.rawBase64,'base64');files.set(scan+rawPath,bytes);
   const original={eventId:e.eventId,symbol:e.symbol,status:'SUCCESS',rawPath,sha256:r.rawSha256,url:r.url,startedAt:r.requestedAt,receivedAt:r.receivedAt,publishedAt:null,provenance:e.kind==='OFFICIAL_FILING_METADATA'?'WEEKLY_SEC_METADATA_NOT_FILING_BODY':'WEEKLY_IR_CALENDAR_NOT_VERIFIED_EVENT',weeklyReceipt:ref};
   receipts.push(original);originals.push(original);
  }
 }
 for(const symbol of pool)for(const sourceId of ['SEC_SUBMISSIONS','GOOGLE_NEWS_RSS','IR']){
  const h=projection.health.filter(r=>r.symbol===symbol&&(sourceId==='SEC_SUBMISSIONS'?r.family==='SEC_SUBMISSIONS':sourceId==='IR'?r.family!=='SEC_SUBMISSIONS':false));const latest=new Map();for(const r of h)latest.set(r.sourceId,r);
  const attempts=[...latest.values()],hasPending=h.some(r=>r.status==='OBTAINED_PENDING_REVIEW'),hasFailure=attempts.some(r=>r.status==='ACQUISITION_FAILED');
  coverage.push({symbol,sourceId,attempted:h.length>0,status:!h.length?'NOT_IN_THIS_BATCH':hasFailure?(hasPending?'PARTIAL_SOURCE':'ACQUISITION_FAILED'):hasPending?'PENDING_REVIEW':'EMPTY_PENDING_REVIEW',latestAttempts:attempts,scopeComplete:false});
 }
 const put=(p,v)=>files.set(scan+p,Buffer.from(JSON.stringify(v)+'\n'));put('events.json',events);put('http-receipts.json',receipts);put('originals.json',originals);put('coverage.json',coverage);
 check(files.size<=195,'FILE_BOUND');
 const clocks=snapshot.records.map(r=>r.receivedAt).sort();
 return {files,lineage:{version:'TECH36_WEEKLY_RESEARCH_LINEAGE_V1',scanId,scanPolicySha256:null,sourceDescriptorSha256:sourceHash(descriptorBytes),originalCutoff:clocks.at(-1),lookbackStart:null,pool,coverage,ranking:classifyAndRank(pool,[],5).map(x=>({symbol:x.symbol,category:x.category,coreScore:x.coreScore,valuation:x.dimensions.valuation,eventId:null})),candidate:null,followupBatch:null,sourceReceiptCount:snapshot.records.length,completePoolOpportunityScreen:false,excludedEventDoesNotExcludeCompany:true,executionAllowed:false,weeklyCounts:projection.counts,mode:'SAVED_WEEKLY_RECEIPT_CONVERSION_NOT_NEW_SCAN'}};
}

export function writeWeeklyResearchBatch(dir,snapshot,events,at,{includeEmptyAndFailed=true}={}){
 // Include failed/empty sources so absence of an event never turns failure into coverage.
 // Keep all versions of each selected identity, even across batch boundaries.
 const identities=new Set(events.map(e=>e.canonicalEventId));
 const wanted=new Set(snapshot.projection.events.filter(e=>identities.has(e.canonicalEventId)).flatMap(e=>e.references.map(r=>r.path)));
 if(includeEmptyAndFailed)for(const r of snapshot.records)if(r.parsed.status!=='OBTAINED_PENDING_REVIEW'||(!(r.parsed.filings?.length)&&!r.parsed.events.length))wanted.add(r.path);
 const refs=[...wanted].sort().map(p=>({path:p,sha256:sourceHash(snapshot.files.get(p))}));
 fs.mkdirSync(dir);
 for(const ref of refs){const dest=resolve(dir,ref.path);fs.mkdirSync(resolve(dest,'..'),{recursive:true});fs.writeFileSync(dest,snapshot.files.get(ref.path),{flag:'wx',mode:0o600});}
 fs.writeFileSync(resolve(dir,WEEKLY_RESEARCH_DESCRIPTOR),JSON.stringify({version:'TECH36_WEEKLY_SOURCE_INPUT_V1',at,eventIds:events.map(e=>e.eventId),receipts:refs},null,2)+'\n',{flag:'wx',mode:0o600});
}
