import {readWeeklyRefreshes} from './options-weekly-refresh.mjs';
import {isAbsolute} from 'node:path';
import {assessReleaseCalendar,reportReleaseCalendar,releaseCalendarFingerprint} from '../../src/engines/options-release-calendar/BlsReleaseCalendarEngine.ts';
import {assessFomcCalendar,reportFomcCalendar,fomcCalendarFingerprint} from '../../src/engines/options-fomc-calendar/FomcCalendarEngine.ts';
import {validateStoredDriverObservation,validateDriverSourceHealth} from '../../src/engines/options-drivers/OptionsDriverMonitorEngine.ts';
import {readFocusedSupplement} from './options-focused-news-io.mjs';
import {readTechResearchView} from './options-tech-research-view.mjs';

import {WEEKLY_SOURCE_BASE,sourceHash,sourceClock,readSourceBytes} from './options-weekly-source-storage.mjs';
export {WEEKLY_SOURCE_BASE,sourceHash,sourceClock,readSourceBytes};
const check=(v,c)=>{if(!v)throw Error(c);};
const stale=(at,receipt,hours)=>!sourceClock(receipt)||Date.parse(at)-Date.parse(receipt)>hours*3600000;
const errorState=e=>['ERR_ACCESS_DENIED','EACCES','EPERM'].includes(e.code)?'READ_ONLY_RESTRICTED':e.code==='ENOENT'?'STORE_ABSENT':'INVALID_EVIDENCE';
export function weeklySourceRoots(root){
 const path=WEEKLY_SOURCE_BASE+'/config.json',defaults={calendars:root,news:root,research:root};
 let bytes;try{bytes=readSourceBytes(root,path,8192);}catch(e){if(e.code==='ENOENT')return {roots:defaults,configRef:null};throw e;}
 const c=JSON.parse(bytes);check(c.version==='WEEKLY_SOURCE_ROOTS_V1'&&Object.keys(c).sort().join()==='roots,version','SOURCE_CONFIG');
 check(Object.keys(c.roots).sort().join()==='calendars,news,research','SOURCE_CONFIG');
 for(const value of Object.values(c.roots))check(typeof value==='string'&&isAbsolute(value),'SOURCE_CONFIG');
 return {roots:c.roots,configRef:sourceHash(bytes)};
}
export function readWeeklyCalendar(root,kind,at){
 const bls=kind==='bls',path=`data/runtime/options-${bls?'release':'fomc'}-calendar/retrievals.ndjson`;
 try{
  const bytes=readSourceBytes(root,path),text=new TextDecoder('utf8',{fatal:true}).decode(bytes);
  check(!text||text.endsWith('\n'),'SOURCE_TRUNCATED');const lines=text?text.slice(0,-1).split('\n'):[];check(lines.length<=366,'SOURCE_LIMIT');
  const assess=bls?assessReleaseCalendar:assessFomcCalendar,fp=bls?releaseCalendarFingerprint:fomcCalendarFingerprint;
  const inputs=[];let previous=null;
  for(const line of lines){const {fingerprint,...body}=JSON.parse(line);
   check(Object.keys(body).sort().join()==='assessment,input,previousFingerprint,version'&&body.version==='1.0'&&body.previousFingerprint===previous&&fp(body)===fingerprint,'SOURCE_INTEGRITY');
   check(fp(assess(body.input))===fp(body.assessment),'SOURCE_ASSESSMENT');inputs.push(body.input);previous=fingerprint;
  }
  (bls?reportReleaseCalendar:reportFomcCalendar)(inputs,at);
  return {state:'AVAILABLE',inputs,errorCode:null,path,recordFingerprint:previous,fileSha256:sourceHash(bytes)};
 }catch(e){return {state:'BLOCKED',inputs:null,errorCode:errorState(e),path,recordFingerprint:null,fileSha256:null};}
}
export const calendarHistory=source=>source.errorCode==='STORE_ABSENT'?{state:'MISSING',inputs:null,errorCode:'STORE_MISSING'}:{state:source.state,inputs:source.inputs,errorCode:source.errorCode};
function driverEvidence(root){
 const path='data/runtime/options-driver-monitor/refreshes.ndjson',bytes=readSourceBytes(root,path,16*1024*1024),text=bytes.toString('utf8');check(!text||text.endsWith('\n'),'SOURCE_TRUNCATED');
 const lines=text?text.slice(0,-1).split('\n'):[];check(lines.length<=4000,'SOURCE_LIMIT');let previous=null;const references=[],health=[];
 for(const line of lines){const {fingerprint,...body}=JSON.parse(line);check(Object.keys(body).sort().join()==='health,observations,previousFingerprint,schemaVersion'&&body.schemaVersion==='1.0'&&body.previousFingerprint===previous&&fingerprint==='sha256:'+sourceHash(JSON.stringify(body))&&Array.isArray(body.observations)&&body.observations.length<=600&&Array.isArray(body.health)&&body.health.length<=6,'SOURCE_INTEGRITY');
  for(const item of body.observations)references.push({item:validateStoredDriverObservation(item),path,recordFingerprint:fingerprint});
  health.push(...body.health.map(validateDriverSourceHealth));previous=fingerprint;
 }return {references,health};
}
export function readWeeklyNews(root,at){
 const references=[],health=[],issues=[];
 try{const d=driverEvidence(root);references.push(...d.references);health.push(...d.health.map(h=>({...h,id:h.sourceId})));}catch(e){issues.push({source:'official-feeds',state:errorState(e)});}
 try{const f=readFocusedSupplement(root,at,true);references.push(...f.references);health.push(...f.sources);if(!f.recordsRead)issues.push({source:'focused-feeds',state:'STORE_ABSENT'});}catch(e){issues.push({source:'focused-feeds',state:errorState(e)});}
 const records=references.map(r=>{
  const i=r.item,valid=sourceClock(i.observedAt)&&Date.parse(i.observedAt)<=Date.parse(at)&&(i.publishedAt===null||sourceClock(i.publishedAt)&&Date.parse(i.publishedAt)<=Date.parse(i.observedAt));
  return {id:sourceHash(r.recordFingerprint+'|'+i.sourceId+'|'+i.itemId),sourceId:i.sourceId,title:i.headline,sourceRef:i.link,publishedAt:i.publishedAt,retrievedAt:i.observedAt,eventAt:null,timePrecision:'UNKNOWN',sourceRoot:'news',path:r.path,recordFingerprint:r.recordFingerprint,status:valid?(stale(at,i.observedAt,72)?'STALE':'OBTAINED_PENDING_REVIEW'):'INVALID_EVIDENCE',reason:valid?'HEADLINE_CONTEXT_NOT_SCHEDULED_EVENT':'PUBLICATION_OR_RECEIPT_CLOCK_ANOMALY',origin:i.origin};
 }).filter(r=>r.origin==='PUBLIC_FEED');
 const latest=new Map();for(const h of health){if(!sourceClock(h.observedAt)||Date.parse(h.observedAt)>Date.parse(at))continue;if(!latest.has(h.id)||Date.parse(latest.get(h.id).observedAt)<=Date.parse(h.observedAt))latest.set(h.id,h);}
 return {records:records.sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt)).slice(0,300),health:[...latest.values()],issues,omitted:Math.max(0,records.length-300)};
}
const scopes={macroDataCoverage:'BLS release calendar only; other economic publishers excluded',centralBankCoverage:'FOMC meeting dates only; speeches and other central banks excluded',earningsCoverage:'Existing attributed technology research; no 36-company earnings calendar',companyEventCoverage:'Existing attributed technology/SEC research; no complete company-event calendar',conferenceCoverage:'No integrated conference calendar',treasuryFiscalCoverage:'Official-feed headline context only; no auction/fiscal calendar',policyGeopoliticalCoverage:'Official-feed headline context only; no comprehensive policy/geopolitical service',optionsMarketCoverage:'No integrated options-event calendar',newsRiskCoverage:'Six official feeds plus three existing focused feeds; no comprehensive news service'};
export function projectWeeklySources({at,week,calendars,news,research,configRef=null}){
 check(sourceClock(at),'SOURCE_CLOCK');const coverage=Object.fromEntries(Object.entries(scopes).map(([key,scope])=>[key,{state:'NOT_INTEGRATED',scope,scopeComplete:false,matchedRecords:0,reason:'NO_APPLICABLE_CONNECTOR',sourceIds:[]}])) ,events=[],references=[];
 for(const kind of ['bls','fomc']){
  const c=calendars[kind],key=kind==='bls'?'macroDataCoverage':'centralBankCoverage',latest=c.inputs?.at(-1),good=c.inputs?.findLast(i=>i.sourceText!==null);
  const matches=(week.events??[]).filter(e=>e.sourceId===(kind==='bls'?'BLS_PUBLIC_RELEASE_CALENDAR':'FEDERAL_RESERVE_PUBLIC_MEETING_CALENDAR'));
  const state=c.errorCode??(!latest?'STORE_ABSENT':latest.errorCode?'ACQUISITION_FAILED':stale(at,latest.receivedAt,26)?'STALE':matches.length?'OBTAINED_PENDING_REVIEW':'CHECKED_NO_MATCH');
  coverage[key]={...coverage[key],state,matchedRecords:matches.length,sourceIds:[kind],reason:state==='CHECKED_NO_MATCH'?'CHECKED_NAMED_CALENDAR_NO_MATCH_IN_TARGET_WEEK':'NAMED_CALENDAR_ONLY',latestReceivedAt:latest?.receivedAt??null,lastSuccessfulAt:good?.receivedAt??null,errorCode:latest?.errorCode??c.errorCode,path:c.path,recordFingerprint:c.recordFingerprint,sourceRoot:c.sourceRoot??'calendars'};
  events.push(...matches.map(e=>({...e,coverageState:state,sourceRoot:c.successfulSourceRoot??c.sourceRoot??'calendars',path:c.successfulPath??c.path,recordFingerprint:c.successfulFingerprint??c.recordFingerprint})));
 }
 for(const r of research.records??[]){
  if(r.context==='TEST_FIXTURE')continue;
  references.push({...r,sourceRoot:'research',weeklyEventTime:null,weeklyApplicability:'UNKNOWN',coverageAuthority:'ATTRIBUTED_BACKGROUND_ONLY'});
 }
 for(const key of ['earningsCoverage','companyEventCoverage'])coverage[key]={...coverage[key],state:research.issues?.length?'INVALID_EVIDENCE':references.length?'OBTAINED_PENDING_REVIEW':'STORE_ABSENT',reason:'HISTORICAL_REFERENCES_NOT_CURRENT_WEEK_EVENT_VERIFICATION',matchedRecords:0,historicalReferences:references.length,objectsWithReferences:[...new Set(references.map(r=>r.symbol))].sort(),expectedUniverse:'Existing fixed 36-company research universe; individual records are not 36 complete calendars',sourceIds:['saved-technology-research']};
 for(const [key,ids]of [['newsRiskCoverage',null],['treasuryFiscalCoverage',['ofac']],['policyGeopoliticalCoverage',['ofac','fed','ecb']]]){
  const records=news.records.filter(r=>!ids||ids.includes(r.sourceId)),health=news.health.filter(h=>!ids||ids.includes(h.id));
  const valid=records.filter(r=>r.status==='OBTAINED_PENDING_REVIEW');
  const state=news.issues.some(i=>i.state==='INVALID_EVIDENCE')?'INVALID_EVIDENCE':health.some(h=>h.status==='FAILED')?'ACQUISITION_FAILED':records.some(r=>r.status==='INVALID_EVIDENCE')?'INVALID_EVIDENCE':valid.length||health.some(h=>['OK','EMPTY'].includes(h.status)&&!stale(at,h.observedAt,72))?'OBTAINED_PENDING_REVIEW':records.length||health.length?'STALE':news.issues.some(i=>i.state==='READ_ONLY_RESTRICTED')?'READ_ONLY_RESTRICTED':'STORE_ABSENT';
  coverage[key]={...coverage[key],state,matchedRecords:valid.length,retainedRecords:records.length,sourceIds:health.map(h=>h.id),reason:'HEADLINES_ONLY_EVENT_TIMING_AND_COMPLETE_SCOPE_UNKNOWN'};
 }
 return {version:'WEEKLY_SOURCE_COVERAGE_V1',assessedAt:at,weekStartDate:week.weekStartDate,weekEndDate:week.weekEndDate,configRef,coverage,events,news,research:{references,issues:research.issues??[]},sourceCalls:0,fileSystemWrites:0,executionAllowed:false,authority:'CURRENT_UNSAVED_SOURCE_PROJECTION_NOT_OWNER_PLAN_REVIEW'};
}
export function weeklyCurrentInputs(root,at){
 const {roots,configRef}=weeklySourceRoots(root),refresh=readWeeklyRefreshes(root,at),calendars={};
 for(const kind of ['bls','fomc']){
  const original=readWeeklyCalendar(roots.calendars,kind,at),records=refresh.issues.some(i=>i.state==='INVALID_EVIDENCE')?[]:refresh.records.filter(r=>r.sourceId===kind+'_calendar'),latest=records.at(-1);
  calendars[kind]=refresh.issues.some(i=>i.state==='INVALID_EVIDENCE')?{...original,state:'BLOCKED',inputs:null,errorCode:'INVALID_EVIDENCE'}:original;
  if(latest&&(!original.inputs?.length||Date.parse(latest.receivedAt)>=Date.parse(original.inputs.at(-1).receivedAt))){
   const inputs=[...(original.inputs??[]),...records.map(r=>r.parsed.calendarInput??{requestedAt:r.requestedAt,receivedAt:r.receivedAt,url:r.url,sourceText:null,errorCode:'NETWORK_FAILED'})].sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt));
   // Repeated historical journal envelopes are not rewritten; this is an independent projection.
   const good=records.findLast(r=>r.parsed.calendarInput);
   calendars[kind]={successfulPath:good?.path??original.path,successfulFingerprint:good?.recordFingerprint??original.recordFingerprint,successfulSourceRoot:good?'weekly-refresh':'calendars',state:'AVAILABLE',inputs:inputs.slice(-366),errorCode:null,path:latest.path,recordFingerprint:latest.recordFingerprint,sourceRoot:'weekly-refresh',legacyState:original.errorCode};
  }
 }
 const news=readWeeklyNews(roots.news,at),health=new Map(news.health.map(h=>[h.id,h]));
 for(const r of refresh.records.filter(r=>!r.sourceId.endsWith('_calendar'))){
  const existing=health.get(r.sourceId);if(!existing||Date.parse(existing.observedAt)<=Date.parse(r.receivedAt))health.set(r.sourceId,{id:r.sourceId,status:r.parsed.status==='ACQUISITION_FAILED'?'FAILED':r.parsed.items.length?'OK':'EMPTY',observedAt:r.receivedAt,partial:r.parsed.partial,diagnostic:r.parsed.errorCode,path:r.path,recordFingerprint:r.recordFingerprint,httpStatus:r.httpStatus});
  for(const i of r.parsed.items){const valid=i.publishedAt===null||Date.parse(i.publishedAt)<=Date.parse(r.receivedAt);news.records.push({id:sourceHash(r.recordFingerprint+'|'+i.itemId),sourceId:i.sourceId,title:i.headline,sourceRef:i.link,publishedAt:i.publishedAt,retrievedAt:r.receivedAt,eventAt:null,timePrecision:'UNKNOWN',sourceRoot:'weekly-refresh',path:r.path,recordFingerprint:r.recordFingerprint,rawSha256:r.rawSha256,status:valid?(stale(at,r.receivedAt,72)?'STALE':'OBTAINED_PENDING_REVIEW'):'INVALID_EVIDENCE',reason:valid?'HEADLINE_CONTEXT_NOT_SCHEDULED_EVENT':'PUBLICATION_OR_RECEIPT_CLOCK_ANOMALY',origin:'PUBLIC_FEED'});}
 }
 news.health=[...health.values()].map(h=>({...h,coverageState:h.status==='FAILED'?'ACQUISITION_FAILED':stale(at,h.observedAt,72)?'STALE':'OBTAINED_PENDING_REVIEW'}));news.issues.push(...refresh.issues);
 // Exact display dedup keeps every receipt link; changed headlines/publications stay separate.
 const groups=new Map();for(const r of news.records){const key=sourceHash(JSON.stringify([r.sourceId,r.sourceRef,r.title,r.publishedAt,r.status]));const prior=groups.get(key);const receipt={path:r.path,recordFingerprint:r.recordFingerprint,retrievedAt:r.retrievedAt};if(prior)prior.retransmittedReceipts.push(receipt);else groups.set(key,{...r,relatedLink:r.sourceRef,retransmittedReceipts:[receipt]});}
 const all=[...groups.values()].sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt));news.records=all.slice(0,300);news.omitted+=Math.max(0,all.length-300);
 return {roots,configRef,calendars,news,refresh};
}
export function weeklySourcesView(root,at,week){
 try{const {roots,configRef,calendars,news,refresh}=weeklyCurrentInputs(root,at),research=readTechResearchView({root:roots.research,at,includeEvidenceLocations:true});const result=projectWeeklySources({at,week,calendars,news,research,configRef});result.refreshReceipts=refresh.records.map(({sourceId,path,recordFingerprint,requestedAt,receivedAt,httpStatus,rawSha256,parsed})=>({sourceId,path,recordFingerprint,requestedAt,receivedAt,httpStatus,rawSha256,status:parsed.status,errorCode:parsed.errorCode}));return result;}
 catch(e){return {version:'WEEKLY_SOURCE_COVERAGE_V1',assessedAt:at,errorCode:errorState(e),executionAllowed:false,sourceCalls:0,fileSystemWrites:0};}
}
