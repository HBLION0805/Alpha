import {existsSync,lstatSync,readdirSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {readGuidanceResearchFrames,normalizeGuidanceCapture,guidanceSettings,latestIssuedGuidancePath} from './options-guidance-io.mjs';
import {assessPaperEventContext,eventPlanningChoices,readEventGuidance} from '../../src/engines/options-robinhood-data/OptionsPaperEventPlan.ts';
import {snapshotCents,snapshotNs,assessSnapshotQuote,validateSnapshotPlan,replaySnapshotPaper,PAPER_V2_GAPS,PAPER_FEE_PROFILE} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';
import {guidanceLocal} from '../../src/engines/options-daily-guidance/OptionsDailyGuidance.ts';
import {assessPaperCollectionPlan} from '../../src/engines/options-robinhood-data/OptionsPaperCollectionPlan.ts';
import {runOptionsCalendarBriefCommand} from '../options-calendar-brief.mjs';

const BASE='data/runtime/options-snapshot-paper',MAX=64*1024*1024;
const fail=c=>{throw Error('SNAPSHOT_PAPER_'+c);};
const parse=b=>parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(b));
const sha=b=>createHash('sha256').update(b).digest('hex');
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(v)?v:fail('IDENTITY');
function files(root,path){
  let current=root;
  for(const part of path.split('/')){current=resolve(current,part);if(!existsSync(current))return [];const s=lstatSync(current);if(!s.isDirectory()||s.isSymbolicLink())fail('UNSAFE_DIRECTORY');}
  const all=readdirSync(current,{withFileTypes:true});if(all.length>100||all.some(f=>!f.isFile()||f.isSymbolicLink()||!f.name.endsWith('.json')))fail('CATALOG');
  return all.map(f=>path+'/'+f.name).sort();
}
function read(root,path){const r=parse(io.readBytes(root,path,MAX)),{fingerprint,...payload}=r;if(fingerprint!==paperFingerprint(payload))fail('INTEGRITY');return payload;}
function write(root,path,payload){const bytes=Buffer.from(JSON.stringify({...payload,fingerprint:paperFingerprint(payload)},null,2)+'\n');if(bytes.length>MAX)fail('RECORD_LIMIT');io.directory(root,path.slice(0,path.lastIndexOf('/')));io.writeExclusive(root,path,bytes);return path;}
/** The byte copy is retained so recovery verifies actual source bytes without source stores. */
export function mapSnapshotSource(copy,v2=false){
  if(!copy||Object.keys(copy).sort().join()!=='path,sha256,utf8'||typeof copy.utf8!=='string'||copy.utf8.length>MAX||!/^data\/runtime\/options-daily-guidance\/captures\/\d{4}-\d\d-\d\d\/[\w.-]+\.json$/.test(copy.path)||sha(Buffer.from(copy.utf8))!==copy.sha256)fail('SOURCE_INTEGRITY');
  const r=parse(Buffer.from(copy.utf8));
  if(r.version!=='OPTIONS_GUIDANCE_RECORD_V1'||r.kind!=='captures'||r.inputFingerprint!==paperFingerprint(r.input)||r.reportFingerprint!==paperFingerprint(r.report))fail('SOURCE_RECORD');
  const normalized=normalizeGuidanceCapture(r.input);
  if(paperFingerprint(normalized)!==r.reportFingerprint||snapshotNs(r.recordedAt)<snapshotNs(normalized.capturedAt))fail('SOURCE_RECOMPUTE');
  const instruments=new Map(),rawQuotes=new Map(),chains=new Map();
  for(const receipt of r.input.receipts){
    if(receipt.tool==='get_option_chains')for(const chain of receipt.response.data.chains)chains.set(chain.id,{chain,receivedAt:receipt.receivedAt});
    if(receipt.tool==='get_option_instruments')for(const i of receipt.response.data.instruments)instruments.set(i.id,i);
    if(receipt.tool==='get_option_quotes')for(const row of receipt.response.data.results)if(row.quote)rawQuotes.set(row.quote.instrument_id,row.quote);
  }
  const quotes=normalized.quotes.map(q=>{
    const raw=rawQuotes.get(q.id),instrument=instruments.get(q.id),eq=normalized.equities.find(e=>e.symbol===q.symbol),ticks=instrument?.min_ticks;
    if(!raw||!instrument)fail('SOURCE_LINKAGE');
    const c=chains.get(instrument.chain_id),matched=c?.chain.symbol===q.symbol;
    const chainSession={chainId:instrument.chain_id??null,lateCloseState:matched&&['enabled','disabled'].includes(c.chain.late_close_state)?c.chain.late_close_state:'unknown',receivedAt:matched?c.receivedAt:null};
    return {...q,...(v2===true?{chainSession}:{}),bidCents:snapshotCents(raw.bid_price),askCents:snapshotCents(raw.ask_price),underlyingPriceCents:snapshotCents(eq?.price),underlyingAt:eq?.sourceAt??null,
      aboveTickCents:snapshotCents(ticks?.above_tick),belowTickCents:snapshotCents(ticks?.below_tick),cutoffCents:snapshotCents(ticks?.cutoff_price)};
  });
  return {requestedQuoteCount:r.input.selectedIds.length,missingQuoteIds:r.input.selectedIds.filter(id=>!quotes.some(q=>q.id===id)),path:copy.path,sha256:copy.sha256,recordedAt:r.recordedAt,capturedAt:normalized.capturedAt,origin:normalized.origin,quotes};
}
export function snapshotSources(root){
  let total=0;return readGuidanceResearchFrames(root).map(f=>{const bytes=io.readBytes(root,f.path,MAX),copy={path:f.path,sha256:sha(bytes),utf8:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};total+=bytes.length;if(total>MAX)fail('SOURCE_TOTAL_LIMIT');mapSnapshotSource(copy);return copy;});
}
const REQUEST_FIELDS=['id','contractId','selectionPath','decisionAt','entryDeadlineAt','timeExitAt','quantity','entryLimitCents','entryFeeCents','exitFeeCents','exitSlippageCents','maxSpreadCents','settingsFingerprint'];
function copyEventGuidance(root,path){
  if(typeof path!=='string'||!/^data\/runtime\/options-daily-guidance\/reports\/\d{4}-\d\d-\d\d\/[\w.-]+\.json$/.test(path))fail('EVENT_REPORT_PATH');
  const bytes=io.readBytes(root,path,8*1024*1024);return {path,sha256:sha(bytes),utf8:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};
}
function eventContext(r){
  if(r.version!=='OPTIONS_SNAPSHOT_PAPER_REGISTRATION_V2')return null;
  const result=assessPaperEventContext(r.eventContext,r.plan),source=mapSnapshotSource(r.selection,true),guidance=readEventGuidance(r.eventContext.guidance);
  if(guidance.input.captureAt!==source.capturedAt||guidance.input.captureOrigin!==source.origin)fail('EVENT_CAPTURE_LINKAGE');
  return result;
}
const contextualReport=(r,report)=>r.version==='OPTIONS_SNAPSHOT_PAPER_REGISTRATION_V2'?{...report,eventPlan:eventContext(r),candidateLessons:[...report.candidateLessons,{code:'EVENT_HYPOTHESIS_NOT_TESTED',text:'This quote-only result does not validate the frozen event hypothesis. Review entry confirmation and invalidation against independent observations before treating it as strategy evidence.',approvedKnowledge:false,causalStatus:'NOT_ESTABLISHED'}]}:report;
function prepare(root,request,at){
  const v2=request?.modelVersion==='V2';
  const hasEvent=!!request&&Object.hasOwn(request,'eventPlan');
  if(!request||hasEvent&&!v2||Object.keys(request).sort().join()!==[...REQUEST_FIELDS,...(v2?['modelVersion','feeBasis']:[]),...(hasEvent?['eventPlan']:[])].sort().join())fail('REQUEST_FIELDS');
  id(request.id);snapshotNs(at);
  const copies=snapshotSources(root),selection=copies.find(c=>c.path===request.selectionPath);
  if(!selection)fail('SELECTION_MISSING');const f=mapSnapshotSource(selection,v2),contract=f.quotes.find(q=>q.id===request.contractId);
  if(!contract||snapshotNs(f.recordedAt)>snapshotNs(at))fail('SELECTION_MISSING');
  const settings=guidanceSettings(root);if(request.settingsFingerprint!==paperFingerprint(settings))fail('SETTINGS_CHANGED');
  const {contractId,settingsFingerprint,modelVersion,eventPlan,...rest}=request;
  const plan=validateSnapshotPlan({...rest,version:v2?'OPTIONS_SNAPSHOT_PAPER_PLAN_V2':'OPTIONS_SNAPSHOT_PAPER_PLAN_V1',createdAt:at,contract,settings});
  const sources=copies.filter(c=>{const f=mapSnapshotSource(c);return snapshotNs(f.recordedAt)<=snapshotNs(at)&&f.quotes.some(q=>q.id===contractId);});
  const report=replaySnapshotPaper(plan,sources.map(c=>mapSnapshotSource(c,v2)),at);
  const result={version:hasEvent?'OPTIONS_SNAPSHOT_PAPER_REGISTRATION_V2':'OPTIONS_SNAPSHOT_PAPER_REGISTRATION_V1',request,plan,selection,...(hasEvent?{eventContext:{version:'OPTIONS_PAPER_EVENT_CONTEXT_V1',declaration:eventPlan,guidance:copyEventGuidance(root,eventPlan.reportPath)}}:{})};
  return {...result,report:contextualReport(result,report)};
}
function validateRegistration(r){
  if(!['OPTIONS_SNAPSHOT_PAPER_REGISTRATION_V1','OPTIONS_SNAPSHOT_PAPER_REGISTRATION_V2'].includes(r.version))fail('REGISTRATION');
  const hasEvent=r.version==='OPTIONS_SNAPSHOT_PAPER_REGISTRATION_V2';
  if(hasEvent&&r.plan.version!=='OPTIONS_SNAPSHOT_PAPER_PLAN_V2'||!hasEvent&&(Object.hasOwn(r,'eventContext')||Object.hasOwn(r.request,'eventPlan')))fail('REGISTRATION');
  const p=validateSnapshotPlan(r.plan),{version,createdAt,contract,settings,...rest}=p;
  if(paperFingerprint({...rest,...(version==='OPTIONS_SNAPSHOT_PAPER_PLAN_V2'?{modelVersion:'V2'}:{}),...(hasEvent?{eventPlan:r.eventContext?.declaration}:{}),contractId:contract.id,settingsFingerprint:paperFingerprint(settings)})!==paperFingerprint(r.request)||r.selection.path!==p.selectionPath)fail('REGISTRATION_LINKAGE');
  eventContext(r);
  replaySnapshotPaper(p,[mapSnapshotSource(r.selection,p.version==='OPTIONS_SNAPSHOT_PAPER_PLAN_V2')],p.createdAt);return r;
}
export function snapshotPaperRegistrations(root){return files(root,BASE+'/plans').map(path=>({path,registration:validateRegistration(read(root,path))}));}
export function snapshotObservationEnd(plan){
  const p=validateSnapshotPlan(plan),local=guidanceLocal(p.timeExitAt),session=paperSession(p.timeExitAt,p.contract.chainSession);
  return new Date(Math.floor(Date.parse(p.timeExitAt)/60000)*60000+(session.closeMinute-local.minute+5)*60000).toISOString();
}
export function previewSnapshotPaper(root,request,at=new Date().toISOString()){return prepare(root,request,at).report;}
export function paperCollectionCalendar(brief){
  const sources=['bls','fomc'].map(id=>{const s=brief?.sources?.[id];return {id,state:s?.state??'MISSING',receivedAt:s?.lastKnownReceivedAt??null,refreshOverdue:s?.refreshOverdue??null};});
  return {state:sources.some(s=>s.state!=='AVAILABLE')?'UNAVAILABLE':sources.some(s=>s.refreshOverdue!==false)?'STALE':'AVAILABLE',sources,
    events:(brief?.groups??[]).flatMap(g=>[...g.dateOnlyEntries,...g.scheduledTimeEntries]).slice(0,100).map(e=>({title:e.title,source:e.source,startDate:e.startDate,endDate:e.endDate,scheduledAt:e.scheduledAt??null}))};
}
export function paperCollectionDesk(desk,brief){
  const calendar=paperCollectionCalendar(brief);
  return {...desk,collectionCalendar:calendar,cases:desk.cases.map(c=>({...c,collectionPlan:assessPaperCollectionPlan(c.plan,desk.assessedAt,calendar)}))};
}
export async function previewSnapshotPaperCollection(root,request,at=new Date().toISOString()){
  const report=previewSnapshotPaper(root,request,at);
  const brief=await runOptionsCalendarBriefCommand(['--report','--json'],{workspaceRoot:root,now:()=>at});
  return {...report,collectionPlan:assessPaperCollectionPlan(report.plan,at,paperCollectionCalendar(brief))};
}
export function registerSnapshotPaper(root,request,at=new Date().toISOString()){
  root=realpathSync(root);const path=BASE+'/plans/'+id(request?.id)+'.json';
  if(existsSync(resolve(root,path))){const r=validateRegistration(read(root,path));if(paperFingerprint(r.request)!==paperFingerprint(request))fail('REQUEST_CONFLICT');return {path,alreadyRecorded:true,executionAllowed:false};}
  if(files(root,BASE+'/plans').length>=100)fail('CATALOG');
  const r=prepare(root,request,at);delete r.report;validateRegistration(r);write(root,path,r);verifySnapshotPaper(root,path);
  return {path,alreadyRecorded:false,executionAllowed:false};
}
export function saveSnapshotPaperReport(root,planId,at=new Date().toISOString()){
  const registration=validateRegistration(read(root,BASE+'/plans/'+id(planId)+'.json'));
  const sources=snapshotSources(root).filter(c=>{const f=mapSnapshotSource(c);return snapshotNs(f.recordedAt)<=snapshotNs(at)&&f.quotes.some(q=>q.id===registration.plan.contract.id);});
  if(!sources.some(c=>c.sha256===registration.selection.sha256&&c.path===registration.selection.path))fail('SELECTION_CHANGED');
  const report=contextualReport(registration,replaySnapshotPaper(registration.plan,sources.map(c=>mapSnapshotSource(c,registration.plan.version==='OPTIONS_SNAPSHOT_PAPER_PLAN_V2')),at)),dir=BASE+'/reports/'+id(planId);
  if(files(root,dir).length>=100)fail('CATALOG');
  const path=dir+'/'+at.replace(/[:.]/g,'-')+'-'+randomUUID()+'.json';
  write(root,path,{version:'OPTIONS_SNAPSHOT_PAPER_SNAPSHOT_V1',recordedAt:at,registration,sources,report});verifySnapshotPaper(root,path);
  return {path,status:report.status,executionAllowed:false};
}
/** Stable automatic report identity. Source knowledge stops at the triggering capture/window. */
export function saveSnapshotObservation(root,planId,trigger,at=new Date().toISOString()){
  const registration=validateRegistration(read(root,BASE+'/plans/'+id(planId)+'.json'));
  if(registration.plan.version!=='OPTIONS_SNAPSHOT_PAPER_PLAN_V2')fail('OBSERVATION_PLAN_VERSION');
  const copies=snapshotSources(root),capture=trigger===null?null:copies.find(c=>c.path===trigger);
  if(trigger!==null&&!capture)fail('OBSERVATION_CAPTURE_MISSING');
  const cutoffAt=capture?mapSnapshotSource(capture).recordedAt:snapshotObservationEnd(registration.plan);
  if(snapshotNs(cutoffAt)>snapshotNs(at)||snapshotNs(cutoffAt)<snapshotNs(registration.plan.createdAt))fail('OBSERVATION_CUTOFF');
  const observation=capture?{kind:'CAPTURE',path:capture.path,sha256:capture.sha256,cutoffAt}:{kind:'WINDOW_END',cutoffAt};
  const dir=BASE+'/reports/'+id(planId),path=dir+'/auto-'+(capture?capture.sha256:'final')+'.json';
  if(existsSync(resolve(root,path))){verifySnapshotPaper(root,path);const r=read(root,path);if(paperFingerprint(r.observation)!==paperFingerprint(observation))fail('OBSERVATION_CONFLICT');return {path,status:r.report.status,paperStage:r.report.paperStage,alreadyRecorded:true,executionAllowed:false};}
  const origin=mapSnapshotSource(registration.selection).origin;
  if(capture&&mapSnapshotSource(capture).origin!==origin)fail('OBSERVATION_ORIGIN');
  const sources=copies.filter(c=>{const f=mapSnapshotSource(c);return f.origin===origin&&snapshotNs(f.recordedAt)<=snapshotNs(cutoffAt)&&(f.quotes.some(q=>q.id===registration.plan.contract.id)||c.path===capture?.path);});
  if(!sources.some(c=>c.sha256===registration.selection.sha256&&c.path===registration.selection.path))fail('SELECTION_CHANGED');
  const report=contextualReport(registration,replaySnapshotPaper(registration.plan,sources.map(c=>mapSnapshotSource(c,true)),at));
  if(files(root,dir).length>=100)fail('CATALOG');
  write(root,path,{version:'OPTIONS_SNAPSHOT_PAPER_OBSERVATION_V1',recordedAt:at,registration,observation,sources,report});verifySnapshotPaper(root,path);
  return {path,status:report.status,paperStage:report.paperStage,alreadyRecorded:false,executionAllowed:false};
}
export function verifySnapshotPaper(root,path){
  if(typeof path!=='string'||!path.startsWith(BASE+'/')||path.includes('..')||path.includes('\\')||!path.endsWith('.json'))fail('RECORD_PATH');
  const r=read(root,path);
  if(['OPTIONS_SNAPSHOT_PAPER_REGISTRATION_V1','OPTIONS_SNAPSHOT_PAPER_REGISTRATION_V2'].includes(r.version)){
    validateRegistration(r);if(path!==BASE+'/plans/'+r.plan.id+'.json')fail('REGISTRATION_PATH');
  }else if(['OPTIONS_SNAPSHOT_PAPER_SNAPSHOT_V1','OPTIONS_SNAPSHOT_PAPER_OBSERVATION_V1'].includes(r.version)){
    validateRegistration(r.registration);
    if(!Array.isArray(r.sources)||r.sources.length>1000||!r.sources.some(s=>paperFingerprint(s)===paperFingerprint(r.registration.selection)))fail('SOURCE_LINKAGE');
    if(r.version==='OPTIONS_SNAPSHOT_PAPER_OBSERVATION_V1'){
      const o=r.observation,p=r.registration.plan;if(p.version!=='OPTIONS_SNAPSHOT_PAPER_PLAN_V2'||!o||!['CAPTURE','WINDOW_END'].includes(o.kind))fail('OBSERVATION_TRIGGER');
      if(snapshotNs(o.cutoffAt)>snapshotNs(r.recordedAt)||snapshotNs(o.cutoffAt)<snapshotNs(p.createdAt))fail('OBSERVATION_CUTOFF');
      if(o.kind==='CAPTURE'){
        const source=r.sources.find(c=>c.path===o.path&&c.sha256===o.sha256);
        if(Object.keys(o).sort().join()!=='cutoffAt,kind,path,sha256'||!source||mapSnapshotSource(source).recordedAt!==o.cutoffAt||path!==BASE+'/reports/'+p.id+'/auto-'+o.sha256+'.json')fail('OBSERVATION_TRIGGER');
      }else if(Object.keys(o).sort().join()!=='cutoffAt,kind'||o.cutoffAt!==snapshotObservationEnd(p)||path!==BASE+'/reports/'+p.id+'/auto-final.json')fail('OBSERVATION_TRIGGER');
      if(r.sources.some(c=>snapshotNs(mapSnapshotSource(c).recordedAt)>snapshotNs(o.cutoffAt)))fail('OBSERVATION_FUTURE_SOURCE');
    }
    const report=contextualReport(r.registration,replaySnapshotPaper(r.registration.plan,r.sources.map(c=>mapSnapshotSource(c,r.registration.plan.version==='OPTIONS_SNAPSHOT_PAPER_PLAN_V2')),r.recordedAt));
    if(paperFingerprint(report)!==paperFingerprint(r.report))fail('RECOMPUTE');
  }else fail('VERSION');
  return {status:'VERIFIED',path,fingerprint:paperFingerprint(r),executionAllowed:false};
}
export function snapshotPaperView(root,at=new Date().toISOString()){
  let eventPlanning;
  try{const path=latestIssuedGuidancePath(root);eventPlanning=path?{state:'AVAILABLE',data:eventPlanningChoices(copyEventGuidance(root,path))}:{state:'MISSING',data:null};}
  catch{eventPlanning={state:'BLOCKED',data:null};}
  const sources=snapshotSources(root),frames=sources.map(c=>mapSnapshotSource(c,true)).filter(f=>snapshotNs(f.recordedAt)<=snapshotNs(at)).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)),latest=frames.at(-1);
  const cases=files(root,BASE+'/plans').map(path=>{const r=validateRegistration(read(root,path)),reports=files(root,BASE+'/reports/'+r.plan.id).map(path=>{verifySnapshotPaper(root,path);const v=read(root,path);return {path,recordedAt:v.recordedAt,report:v.report,...(v.observation?{observation:v.observation}:{})};}).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)||a.path.localeCompare(b.path));return {path,plan:r.plan,current:contextualReport(r,replaySnapshotPaper(r.plan,(r.plan.version==='OPTIONS_SNAPSHOT_PAPER_PLAN_V2'?frames:sources.map(c=>mapSnapshotSource(c))).filter(f=>f.origin===mapSnapshotSource(r.selection).origin&&f.quotes.some(q=>q.id===r.plan.contract.id)),at)),snapshots:reports};});
  return {version:'OPTIONS_SNAPSHOT_PAPER_DESK_V2',eventPlanning,paperModelImplemented:true,feeProfile:PAPER_FEE_PROFILE,assessedAt:at,settingsFingerprint:paperFingerprint(guidanceSettings(root)),gates:{quotes:'OPEN',adapter:'LOCAL_IMPLEMENTED_UNQUALIFIED',completeRealPriceLifecycle:'OPEN'},sourceGaps:[...PAPER_V2_GAPS],latest:latest?{path:latest.path,sha256:latest.sha256,recordedAt:latest.recordedAt,capturedAt:latest.capturedAt,origin:latest.origin,requestedQuoteCount:latest.requestedQuoteCount,missingQuoteIds:latest.missingQuoteIds,quotes:latest.quotes.map(q=>({contract:q,...assessSnapshotQuote(q,at,true)}))}:null,cases,actualTrades:0,executionAllowed:false};
}
