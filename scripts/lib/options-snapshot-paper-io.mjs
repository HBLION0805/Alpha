import {existsSync,lstatSync,readdirSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {readGuidanceResearchFrames,normalizeGuidanceCapture,guidanceSettings} from './options-guidance-io.mjs';
import {snapshotCents,snapshotNs,assessSnapshotQuote,validateSnapshotPlan,replaySnapshotPaper,PAPER_V2_GAPS,PAPER_FEE_PROFILE} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';

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
function prepare(root,request,at){
  const v2=request?.modelVersion==='V2';
  if(!request||Object.keys(request).sort().join()!==[...REQUEST_FIELDS,...(v2?['modelVersion','feeBasis']:[])].sort().join())fail('REQUEST_FIELDS');
  id(request.id);snapshotNs(at);
  const copies=snapshotSources(root),selection=copies.find(c=>c.path===request.selectionPath);
  if(!selection)fail('SELECTION_MISSING');const f=mapSnapshotSource(selection,v2),contract=f.quotes.find(q=>q.id===request.contractId);
  if(!contract||snapshotNs(f.recordedAt)>snapshotNs(at))fail('SELECTION_MISSING');
  const settings=guidanceSettings(root);if(request.settingsFingerprint!==paperFingerprint(settings))fail('SETTINGS_CHANGED');
  const {contractId,settingsFingerprint,modelVersion,...rest}=request;
  const plan=validateSnapshotPlan({...rest,version:v2?'OPTIONS_SNAPSHOT_PAPER_PLAN_V2':'OPTIONS_SNAPSHOT_PAPER_PLAN_V1',createdAt:at,contract,settings});
  const sources=copies.filter(c=>{const f=mapSnapshotSource(c);return snapshotNs(f.recordedAt)<=snapshotNs(at)&&f.quotes.some(q=>q.id===contractId);});
  const report=replaySnapshotPaper(plan,sources.map(c=>mapSnapshotSource(c,v2)),at);
  return {version:'OPTIONS_SNAPSHOT_PAPER_REGISTRATION_V1',request,plan,selection,report};
}
function validateRegistration(r){
  if(r.version!=='OPTIONS_SNAPSHOT_PAPER_REGISTRATION_V1')fail('REGISTRATION');
  const p=validateSnapshotPlan(r.plan),{version,createdAt,contract,settings,...rest}=p;
  if(paperFingerprint({...rest,...(version==='OPTIONS_SNAPSHOT_PAPER_PLAN_V2'?{modelVersion:'V2'}:{}),contractId:contract.id,settingsFingerprint:paperFingerprint(settings)})!==paperFingerprint(r.request)||r.selection.path!==p.selectionPath)fail('REGISTRATION_LINKAGE');
  replaySnapshotPaper(p,[mapSnapshotSource(r.selection,p.version==='OPTIONS_SNAPSHOT_PAPER_PLAN_V2')],p.createdAt);return r;
}
export function previewSnapshotPaper(root,request,at=new Date().toISOString()){return prepare(root,request,at).report;}
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
  const report=replaySnapshotPaper(registration.plan,sources.map(c=>mapSnapshotSource(c,registration.plan.version==='OPTIONS_SNAPSHOT_PAPER_PLAN_V2')),at),dir=BASE+'/reports/'+id(planId);
  if(files(root,dir).length>=100)fail('CATALOG');
  const path=dir+'/'+at.replace(/[:.]/g,'-')+'-'+randomUUID()+'.json';
  write(root,path,{version:'OPTIONS_SNAPSHOT_PAPER_SNAPSHOT_V1',recordedAt:at,registration,sources,report});verifySnapshotPaper(root,path);
  return {path,status:report.status,executionAllowed:false};
}
export function verifySnapshotPaper(root,path){
  if(typeof path!=='string'||!path.startsWith(BASE+'/')||path.includes('..')||path.includes('\\')||!path.endsWith('.json'))fail('RECORD_PATH');
  const r=read(root,path);
  if(r.version==='OPTIONS_SNAPSHOT_PAPER_REGISTRATION_V1'){
    validateRegistration(r);if(path!==BASE+'/plans/'+r.plan.id+'.json')fail('REGISTRATION_PATH');
  }else if(r.version==='OPTIONS_SNAPSHOT_PAPER_SNAPSHOT_V1'){
    validateRegistration(r.registration);
    if(!Array.isArray(r.sources)||r.sources.length>1000||!r.sources.some(s=>paperFingerprint(s)===paperFingerprint(r.registration.selection)))fail('SOURCE_LINKAGE');
    const report=replaySnapshotPaper(r.registration.plan,r.sources.map(c=>mapSnapshotSource(c,r.registration.plan.version==='OPTIONS_SNAPSHOT_PAPER_PLAN_V2')),r.recordedAt);
    if(paperFingerprint(report)!==paperFingerprint(r.report))fail('RECOMPUTE');
  }else fail('VERSION');
  return {status:'VERIFIED',path,fingerprint:paperFingerprint(r),executionAllowed:false};
}
export function snapshotPaperView(root,at=new Date().toISOString()){
  const sources=snapshotSources(root),frames=sources.map(c=>mapSnapshotSource(c,true)).filter(f=>snapshotNs(f.recordedAt)<=snapshotNs(at)).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)),latest=frames.at(-1);
  const cases=files(root,BASE+'/plans').map(path=>{const r=validateRegistration(read(root,path)),reports=files(root,BASE+'/reports/'+r.plan.id).map(path=>{verifySnapshotPaper(root,path);const v=read(root,path);return {path,recordedAt:v.recordedAt,report:v.report};});return {path,plan:r.plan,current:replaySnapshotPaper(r.plan,(r.plan.version==='OPTIONS_SNAPSHOT_PAPER_PLAN_V2'?frames:sources.map(c=>mapSnapshotSource(c))).filter(f=>f.origin===mapSnapshotSource(r.selection).origin&&f.quotes.some(q=>q.id===r.plan.contract.id)),at),snapshots:reports};});
  return {version:'OPTIONS_SNAPSHOT_PAPER_DESK_V2',paperModelImplemented:true,feeProfile:PAPER_FEE_PROFILE,assessedAt:at,settingsFingerprint:paperFingerprint(guidanceSettings(root)),gates:{quotes:'OPEN',adapter:'LOCAL_IMPLEMENTED_UNQUALIFIED',completeRealPriceLifecycle:'OPEN'},sourceGaps:[...PAPER_V2_GAPS],latest:latest?{path:latest.path,sha256:latest.sha256,recordedAt:latest.recordedAt,capturedAt:latest.capturedAt,origin:latest.origin,requestedQuoteCount:latest.requestedQuoteCount,missingQuoteIds:latest.missingQuoteIds,quotes:latest.quotes.map(q=>({contract:q,...assessSnapshotQuote(q,at,true)}))}:null,cases,actualTrades:0,executionAllowed:false};
}
