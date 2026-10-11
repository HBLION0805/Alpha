import {readWeeklyIssuerRefreshes} from './options-weekly-issuer-sources.mjs';
import {extendWeeklyIssuerCoverage} from './options-weekly-issuer-coverage.mjs';
import {readWeeklyRefreshes} from './options-weekly-refresh.mjs';
import {readWeeklyEventRefreshes,extendWeeklyEventCoverage} from './options-weekly-event-sources.mjs';
import {isAbsolute} from 'node:path';
import {assessReleaseCalendar,reportReleaseCalendar,releaseCalendarFingerprint} from '../../src/engines/options-release-calendar/BlsReleaseCalendarEngine.ts';
import {assessFomcCalendar,reportFomcCalendar,fomcCalendarFingerprint} from '../../src/engines/options-fomc-calendar/FomcCalendarEngine.ts';
import {validateStoredDriverObservation,validateDriverSourceHealth} from '../../src/engines/options-drivers/OptionsDriverMonitorEngine.ts';
import {readFocusedSupplement} from './options-focused-news-io.mjs';
import {TECH36_POOL} from './options-tech-candidate.mjs';
import {readTechResearchView} from './options-tech-research-view.mjs';

import {WEEKLY_SOURCE_BASE,sourceHash,sourceClock,readSourceBytes} from './options-weekly-source-storage.mjs';
export {WEEKLY_SOURCE_BASE,sourceHash,sourceClock,readSourceBytes};
const check=(v,c)=>{if(!v)throw Error(c);};
const freezeSnapshot=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freezeSnapshot);Object.freeze(value);}return value;};
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
  const inputs=[],inputEvidence=[];let previous=null;
  for(const line of lines){const {fingerprint,...body}=JSON.parse(line);
   check(Object.keys(body).sort().join()==='assessment,input,previousFingerprint,version'&&body.version==='1.0'&&body.previousFingerprint===previous&&fp(body)===fingerprint,'SOURCE_INTEGRITY');
   check(fp(assess(body.input))===fp(body.assessment),'SOURCE_ASSESSMENT');inputs.push(body.input);inputEvidence.push({input:body.input,path,recordFingerprint:fingerprint,sourceRoot:'calendars'});previous=fingerprint;
  }
  (bls?reportReleaseCalendar:reportFomcCalendar)(inputs,at);
  const good=inputEvidence.findLast(e=>e.input.sourceText!==null);
  return {state:'AVAILABLE',inputs,inputEvidence,successfulPath:good?.path??null,successfulFingerprint:good?.recordFingerprint??null,successfulSourceRoot:good?.sourceRoot??null,errorCode:null,path,recordFingerprint:previous,fileSha256:sourceHash(bytes)};
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
// The existing 72-hour headline-context window is retained for each registered
// source. Receipt freshness never resets the age of published content.
export const WEEKLY_HEADLINE_WINDOWS=Object.freeze(Object.fromEntries(['fed','bls','bea','ecb','ofac','sec','fed_speeches','eia_energy','coindesk'].map(id=>[id,72])));
export function weeklyHeadlineFreshness(sourceId,publishedAt,retrievedAt,at){
 const hours=WEEKLY_HEADLINE_WINDOWS[sourceId];
 const valid=hours!==undefined&&sourceClock(retrievedAt)&&Date.parse(retrievedAt)<=Date.parse(at)&&(publishedAt===null||sourceClock(publishedAt)&&Date.parse(publishedAt)<=Date.parse(retrievedAt));
 const receiptFreshness=valid?(stale(at,retrievedAt,hours)?'STALE':'FRESH'):'INVALID';
 const contentFreshness=!valid?'INVALID':publishedAt===null?'UNKNOWN':stale(at,publishedAt,hours)?'HISTORICAL':'CURRENT';
 return {receiptFreshness,contentFreshness,contentWindowHours:hours??null,contentUse:'CURRENT_HEADLINE_CONTEXT_ONLY',status:!valid?'INVALID_EVIDENCE':contentFreshness==='HISTORICAL'?'HISTORICAL_BACKGROUND':contentFreshness==='UNKNOWN'?'CONTENT_TIME_UNKNOWN':receiptFreshness==='STALE'?'STALE':'OBTAINED_PENDING_REVIEW',reason:!valid?'PUBLICATION_OR_RECEIPT_CLOCK_ANOMALY':contentFreshness==='HISTORICAL'?'PUBLISHED_CONTENT_OUTSIDE_72H_CONTEXT_WINDOW':contentFreshness==='UNKNOWN'?'PUBLICATION_CLOCK_UNKNOWN_NOT_CURRENT_COVERAGE':'HEADLINE_CONTEXT_NOT_SCHEDULED_EVENT'};
}
export function readWeeklyNews(root,at){
 const references=[],health=[],issues=[];
 try{const d=driverEvidence(root);references.push(...d.references);health.push(...d.health.map(h=>({...h,id:h.sourceId})));}catch(e){issues.push({source:'official-feeds',state:errorState(e)});}
 try{const f=readFocusedSupplement(root,at,true);references.push(...f.references);health.push(...f.sources);if(!f.recordsRead)issues.push({source:'focused-feeds',state:'STORE_ABSENT'});}catch(e){issues.push({source:'focused-feeds',state:errorState(e)});}
 const records=references.map(r=>{
  const i=r.item;
  return {id:sourceHash(r.recordFingerprint+'|'+i.sourceId+'|'+i.itemId),sourceId:i.sourceId,title:i.headline,sourceRef:i.link,publishedAt:i.publishedAt,retrievedAt:i.observedAt,eventAt:null,timePrecision:'UNKNOWN',sourceRoot:'news',path:r.path,recordFingerprint:r.recordFingerprint,...weeklyHeadlineFreshness(i.sourceId,i.publishedAt,i.observedAt,at),origin:i.origin};
 }).filter(r=>r.origin==='PUBLIC_FEED');
 const latest=new Map();for(const h of health){if(!sourceClock(h.observedAt)||Date.parse(h.observedAt)>Date.parse(at))continue;if(!latest.has(h.id)||Date.parse(latest.get(h.id).observedAt)<=Date.parse(h.observedAt))latest.set(h.id,h);}
 return {records:records.sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt)).slice(0,300),health:[...latest.values()],issues,omitted:Math.max(0,records.length-300)};
}
const scopes={macroDataCoverage:'BLS release calendar only; other economic publishers excluded',centralBankCoverage:'FOMC meeting dates only; speeches and other central banks excluded',earningsCoverage:'Existing attributed technology research; no 36-company earnings calendar',companyEventCoverage:'Existing attributed technology/SEC research; no complete company-event calendar',conferenceCoverage:'No integrated conference calendar',treasuryFiscalCoverage:'No integrated auction/fiscal calendar; OFAC sanctions are policy context only',policyGeopoliticalCoverage:'Official-feed headline context only; no comprehensive policy/geopolitical service',optionsMarketCoverage:'No integrated options-event calendar',newsRiskCoverage:'Six official feeds plus three existing focused feeds; no comprehensive news service'};
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
  references.push({...r,sourceRoot:'research',weeklyEventTime:null,weeklyApplicability:'UNKNOWN',coverageAuthority:TECH36_POOL.includes(r.symbol)?'ATTRIBUTED_COMPANY_BACKGROUND_ONLY':'MARKET_BACKGROUND_OUTSIDE_TECH36'});
 }
 const companyReferences=references.filter(r=>TECH36_POOL.includes(r.symbol)),backgroundReferences=references.filter(r=>!TECH36_POOL.includes(r.symbol));
 for(const key of ['earningsCoverage','companyEventCoverage'])coverage[key]={...coverage[key],state:research.issues?.length?'INVALID_EVIDENCE':companyReferences.length?'OBTAINED_PENDING_REVIEW':'STORE_ABSENT',reason:'HISTORICAL_REFERENCES_NOT_CURRENT_WEEK_EVENT_VERIFICATION',matchedRecords:0,historicalReferences:companyReferences.length,objectsWithReferences:[...new Set(companyReferences.map(r=>r.symbol))].sort(),universeSize:TECH36_POOL.length,universe:TECH36_POOL,missingObjects:TECH36_POOL.filter(symbol=>!companyReferences.some(r=>r.symbol===symbol)),expectedUniverse:'Existing fixed 36-company research universe; individual records are not 36 complete calendars',sourceIds:['saved-technology-research']};
 for(const [key,ids]of [['newsRiskCoverage',null],['policyGeopoliticalCoverage',['ofac','fed','ecb']]]){
  const records=news.records.filter(r=>!ids||ids.includes(r.sourceId)),health=news.health.filter(h=>!ids||ids.includes(h.id));
  const valid=records.filter(r=>r.status==='OBTAINED_PENDING_REVIEW');
  const state=news.issues.some(i=>i.state==='INVALID_EVIDENCE')?'INVALID_EVIDENCE':health.some(h=>h.status==='FAILED')?'ACQUISITION_FAILED':records.some(r=>r.status==='INVALID_EVIDENCE')?'INVALID_EVIDENCE':valid.length?'OBTAINED_PENDING_REVIEW':records.some(r=>r.status==='HISTORICAL_BACKGROUND')?'HISTORICAL_BACKGROUND':records.some(r=>r.status==='CONTENT_TIME_UNKNOWN')?'CONTENT_TIME_UNKNOWN':records.length||health.length?'STALE':news.issues.some(i=>i.state==='READ_ONLY_RESTRICTED')?'READ_ONLY_RESTRICTED':'STORE_ABSENT';
  coverage[key]={...coverage[key],state,matchedRecords:valid.length,retainedRecords:records.length,sourceIds:health.map(h=>h.id),reason:'HEADLINES_ONLY_EVENT_TIMING_AND_COMPLETE_SCOPE_UNKNOWN'};
 }
 return {version:'WEEKLY_SOURCE_COVERAGE_V1',assessedAt:at,weekStartDate:week.weekStartDate,weekEndDate:week.weekEndDate,configRef,coverage,events,news,research:{references,companyReferences,backgroundReferences,issues:research.issues??[]},sourceCalls:0,fileSystemWrites:0,executionAllowed:false,authority:'CURRENT_UNSAVED_SOURCE_PROJECTION_NOT_OWNER_PLAN_REVIEW'};
}
export function weeklyCurrentInputs(root,at){
 const {roots,configRef}=weeklySourceRoots(root),refresh=readWeeklyRefreshes(root,at),calendars={};
 for(const kind of ['bls','fomc']){
  const original=readWeeklyCalendar(roots.calendars,kind,at);
  if(refresh.issues.some(i=>i.state==='INVALID_EVIDENCE')){calendars[kind]={...original,state:'BLOCKED',inputs:null,errorCode:'INVALID_EVIDENCE'};continue;}
  const records=refresh.records.filter(r=>r.sourceId===kind+'_calendar');
  if(!records.length){calendars[kind]=original;continue;}
  const evidence=[...(original.inputEvidence??[]),...records.map(r=>({input:r.parsed.calendarInput??{requestedAt:r.requestedAt,receivedAt:r.receivedAt,url:r.url,sourceText:null,errorCode:'NETWORK_FAILED'},path:r.path,recordFingerprint:r.recordFingerprint,sourceRoot:'weekly-refresh'}))].sort((a,b)=>a.input.receivedAt.localeCompare(b.input.receivedAt)).slice(-366);
  const latest=evidence.at(-1),good=evidence.findLast(e=>e.input.sourceText!==null);
  calendars[kind]={state:'AVAILABLE',inputs:evidence.map(e=>e.input),errorCode:null,path:latest.path,recordFingerprint:latest.recordFingerprint,sourceRoot:latest.sourceRoot,successfulPath:good?.path??null,successfulFingerprint:good?.recordFingerprint??null,successfulSourceRoot:good?.sourceRoot??null,legacyState:original.errorCode};
 }
 const news=readWeeklyNews(roots.news,at),health=new Map(news.health.map(h=>[h.id,h]));
 for(const r of refresh.records.filter(r=>!r.sourceId.endsWith('_calendar'))){
  const existing=health.get(r.sourceId);if(!existing||Date.parse(existing.observedAt)<=Date.parse(r.receivedAt))health.set(r.sourceId,{id:r.sourceId,status:r.parsed.status==='ACQUISITION_FAILED'?'FAILED':r.parsed.items.length?'OK':'EMPTY',observedAt:r.receivedAt,partial:r.parsed.partial,rejectedItems:r.parsed.rejectedItems??0,itemsParsed:r.parsed.items.length,sourceItemCount:r.parsed.sourceItemCount??null,diagnostic:r.parsed.errorCode,path:r.path,recordFingerprint:r.recordFingerprint,httpStatus:r.httpStatus});
  for(const i of r.parsed.items){news.records.push({id:sourceHash(r.recordFingerprint+'|'+i.itemId),sourceId:i.sourceId,title:i.headline,sourceRef:i.link,publishedAt:i.publishedAt,retrievedAt:r.receivedAt,eventAt:null,timePrecision:'UNKNOWN',sourceRoot:'weekly-refresh',path:r.path,recordFingerprint:r.recordFingerprint,rawSha256:r.rawSha256,...weeklyHeadlineFreshness(i.sourceId,i.publishedAt,r.receivedAt,at),origin:'PUBLIC_FEED'});}
 }
 news.health=[...health.values()].map(h=>({...h,coverageState:h.status==='FAILED'?'ACQUISITION_FAILED':stale(at,h.observedAt,72)?'STALE':'OBTAINED_PENDING_REVIEW'}));news.issues.push(...refresh.issues);
 // Exact display dedup keeps every receipt link; changed headlines/publications stay separate.
 const groups=new Map();for(const r of news.records){const key=sourceHash(JSON.stringify([r.sourceId,r.sourceRef,r.title,r.publishedAt,r.status]));const prior=groups.get(key);const receipt={path:r.path,recordFingerprint:r.recordFingerprint,retrievedAt:r.retrievedAt};if(prior)prior.retransmittedReceipts.push(receipt);else groups.set(key,{...r,relatedLink:r.sourceRef,retransmittedReceipts:[receipt]});}
 const all=[...groups.values()].sort((a,b)=>b.retrievedAt.localeCompare(a.retrievedAt));news.records=all.slice(0,300);news.omitted+=Math.max(0,all.length-300);
 // Facts and receipt identities must survive a writer updating the source store
 // between preview composition and coverage projection in the same request.
 return freezeSnapshot({roots,configRef,calendars,news,refresh,eventRefresh:readWeeklyEventRefreshes(root,at),issuerRefresh:readWeeklyIssuerRefreshes(root,at)});
}
export function weeklySourcesView(root,at,week,inputs){
 try{const {roots,configRef,calendars,news,refresh,eventRefresh,issuerRefresh}=inputs??weeklyCurrentInputs(root,at),research=readTechResearchView({root:roots.research,at,includeEvidenceLocations:true});const result=projectWeeklySources({at,week,calendars,news,research,configRef});result.refreshReceipts=refresh.records.map(({sourceId,path,recordFingerprint,requestedAt,receivedAt,httpStatus,rawSha256,parsed})=>({sourceId,path,recordFingerprint,requestedAt,receivedAt,httpStatus,rawSha256,status:parsed.status,errorCode:parsed.errorCode,partial:parsed.partial,rejectedItems:parsed.rejectedItems??0,itemsParsed:parsed.items.length,sourceItemCount:parsed.sourceItemCount??null}));extendWeeklyEventCoverage(result,eventRefresh,at,week);result.refreshReceipts.push(...result.eventSourceReceipts);extendWeeklyIssuerCoverage(result,issuerRefresh??{records:[],issues:[]},at,week);return result;}
 catch(e){return {version:'WEEKLY_SOURCE_COVERAGE_V1',assessedAt:at,errorCode:errorState(e),executionAllowed:false,sourceCalls:0,fileSystemWrites:0};}
}
