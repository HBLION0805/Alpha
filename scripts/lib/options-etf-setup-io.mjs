import {existsSync,lstatSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {assessEtfSetup,validateEtfBars,validateEtfSetupPlan} from '../../src/engines/options-daily-guidance/OptionsEtfSetup.ts';
import {assessRobinhoodEtfBars} from '../../src/engines/options-robinhood-data/RobinhoodEtfBars.ts';
import {compareRobinhoodEtfBars} from '../../src/engines/options-robinhood-data/RobinhoodEtfBarAudit.ts';
import {assessEtfObservation} from '../../src/engines/options-daily-guidance/OptionsEtfObservation.ts';

const BASE='data/runtime/options-etf-setup',MAX=1024*1024;
const fail=code=>{throw Error('ETF_SETUP_'+code);};
function exact(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==keys.split(',').sort().join())fail('FIELDS');}
function time(at){if(typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)fail('CLOCK');return at;}
export function readEtfSetupJson(root,path){return parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(io.readBytes(root,path,MAX)));}
function catalog(root,kind){
  let current=root;
  for(const part of (BASE+'/'+kind).split('/')){current=resolve(current,part);if(!existsSync(current))return [];const s=lstatSync(current);if(!s.isDirectory()||s.isSymbolicLink())fail('UNSAFE_DIRECTORY');}
  const files=readdirSync(current,{withFileTypes:true});if(files.length>1000)fail('CATALOG_LIMIT');
  if(files.some(f=>!f.isFile()||f.isSymbolicLink()||!f.name.endsWith('.json')))fail('CATALOG_ENTRY');
  return files.map(f=>BASE+'/'+kind+'/'+f.name).sort().reverse();
}
function append(root,kind,input,at,report=null){
  const record={version:'OPTIONS_ETF_SETUP_RECORD_V1',kind,recordedAt:time(at),input,report,inputFingerprint:paperFingerprint(input),reportFingerprint:paperFingerprint(report)};
  const path=BASE+'/'+kind+'/'+at.replace(/[:.]/g,'-')+'-'+randomUUID()+'.json';
  const bytes=Buffer.from(JSON.stringify(record,null,2)+'\n');if(bytes.length>MAX)fail('RECORD_SIZE');
  io.directory(root,BASE+'/'+kind);io.writeExclusive(root,path,bytes);return {path,record};
}
export function verifyEtfSetup(root,path){
  if(!new RegExp('^'+BASE+'/(plans|bars|reports|sources|audits|observations)/[a-zA-Z0-9.-]+\\.json$').test(path))fail('RECORD_PATH');
  const r=readEtfSetupJson(root,path);exact(r,'version,kind,recordedAt,input,report,inputFingerprint,reportFingerprint');time(r.recordedAt);
  if(r.version!=='OPTIONS_ETF_SETUP_RECORD_V1'||r.kind!==path.split('/')[3]||r.inputFingerprint!==paperFingerprint(r.input)||r.reportFingerprint!==paperFingerprint(r.report))fail('INTEGRITY');
  if(r.kind==='plans'){if(r.report!==null)fail('PLAN_REPORT');validateEtfSetupPlan(r.input,r.recordedAt);}
  if(r.kind==='bars'){if(r.report!==null)fail('BAR_REPORT');validateEtfBars(r.input,r.recordedAt);}
  if(r.kind==='sources'&&paperFingerprint(assessRobinhoodEtfBars(r.input,r.recordedAt))!==r.reportFingerprint)fail('SOURCE_RECOMPUTE');
  if(r.kind==='audits'&&paperFingerprint(compareRobinhoodEtfBars(r.input,r.recordedAt))!==r.reportFingerprint)fail('AUDIT_RECOMPUTE');
  if(r.kind==='observations'&&(r.input.at!==r.recordedAt||paperFingerprint(assessEtfObservation(r.input))!==r.reportFingerprint))fail('OBSERVATION_RECOMPUTE');
  if(r.kind==='reports'){
    if(r.input.at!==r.recordedAt||paperFingerprint(assessEtfSetup(r.input))!==r.reportFingerprint)fail('RECOMPUTE');
  }
  return {path,...r};
}
function records(root,kind,at){return catalog(root,kind).map(path=>verifyEtfSetup(root,path)).filter(r=>r.recordedAt<=at);}
export function registerEtfSetup(root,plan,at=new Date().toISOString()){
  validateEtfSetupPlan(plan,time(at));
  if(records(root,'plans',at).some(r=>r.input.id===plan.id))fail('PLAN_ID_EXISTS');
  // Fixed ID claim prevents concurrent duplicate registration, even if either write is interrupted.
  io.directory(root,BASE+'/ids');io.writeExclusive(root,BASE+'/ids/'+plan.id+'.json',Buffer.from(JSON.stringify({registeredAt:at})+'\n'));
  return append(root,'plans',plan,at);
}
export function importEtfBars(root,bars,at=new Date().toISOString()){
  validateEtfBars(bars,time(at));return append(root,'bars',bars,at);
}
export function recordRobinhoodEtfBars(root,capture,at=new Date().toISOString()){
  const report=assessRobinhoodEtfBars(capture,time(at));return append(root,'sources',capture,at,report);
}
export function recordEtfSourceAudit(root,input,at=new Date().toISOString()){
  const report=compareRobinhoodEtfBars(input,time(at));return append(root,'audits',input,at,report);
}
function buildInput(root,guidance,symbol,at,planId=null){
  const plans=records(root,'plans',at), allBars=records(root,'bars',at);
  const plan=plans.find(r=>planId?r.input.id===planId:r.input.symbol===symbol);
  if(planId&&!plan)fail('PLAN_NOT_FOUND');
  const chosen=plan?.input.symbol??symbol;
  const bars=allBars.find(r=>r.input.symbol===chosen&&(!plan||r.input.windowStart.slice(0,10)===plan.input.activeFrom.slice(0,10)));
  return {at,bars:bars?.input??null,plan:plan?{registeredAt:plan.recordedAt,value:plan.input}:null,guidance:{...guidance,at}};
}
function observationInput(guidance,at,sources,audits){
  const source=sources[0],audit=source?audits.find(a=>paperFingerprint(a.input.fiveMinuteCapture)===source.inputFingerprint):null;
  return {at,sourceCapture:source?.input??null,auditInput:audit?.input??null,guidance:{...guidance,at}};
}
export function saveEtfObservation(root,guidance,at=new Date().toISOString()){
  time(at);const input=observationInput(guidance,at,records(root,'sources',at),records(root,'audits',at));
  return append(root,'observations',input,at,assessEtfObservation(input));
}
export function etfSetupView(root,guidance,at){
  if(!guidance)fail('GUIDANCE_UNAVAILABLE');time(at);
  const plans=records(root,'plans',at),bars=records(root,'bars',at),reports=records(root,'reports',at),sources=records(root,'sources',at),audits=records(root,'audits',at);
  const sourceAssets=['GLD','IBIT'].flatMap(symbol=>{const r=sources.find(s=>s.report.assets.some(a=>a.symbol===symbol));return r?[{...r.report.assets.find(a=>a.symbol===symbol),path:r.path,recordedAt:r.recordedAt}]:[];});
  return {version:'OPTIONS_ETF_SETUP_DESK_V1',assessedAt:at,
    sourceCapability:sourceAssets.length?'Robinhood ETF history is saved below with source clocks and quality checks. Received bars do not automatically become qualified setup inputs or change Today’s decision.':'The Robinhood historical-response adapter is available. No source response has been recorded here; file imports remain unverified research evidence.',
    sourceAssets,
    observation:assessEtfObservation(observationInput(guidance,at,sources,audits)),
    observationSnapshots:records(root,'observations',at).slice(0,10).map(r=>({path:r.path,assessedAt:r.recordedAt})),
    sourceAudit:audits[0]?{...audits[0].report,path:audits[0].path}:null,
    assets:['GLD','IBIT'].map(symbol=>({...assessEtfSetup(buildInput(root,guidance,symbol,at)),symbol})),
    plans:plans.slice(0,20).map(r=>({path:r.path,registeredAt:r.recordedAt,...r.input})),
    barImports:bars.slice(0,10).map(r=>({path:r.path,symbol:r.input.symbol,receivedAt:r.input.receivedAt,windowStart:r.input.windowStart,windowEnd:r.input.windowEnd,count:r.input.bars.length,qualification:'IMPORTED_UNVERIFIED'})),
    snapshots:reports.slice(0,10).map(r=>({path:r.path,assessedAt:r.recordedAt,planId:r.input.plan?.value.id??null,status:r.report.status})),executionAllowed:false};
}
export function saveEtfSetupAssessment(root,guidance,planId,at=new Date().toISOString()){
  if(typeof planId!=='string')fail('PLAN_ID');
  const input=buildInput(root,guidance,null,time(at),planId),report=assessEtfSetup(input);
  return append(root,'reports',input,at,report);
}
