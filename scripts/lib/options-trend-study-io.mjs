import {existsSync,lstatSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {TREND_RULES_V1,futureTrendDates,validateTrendStudy,assessTrendDay,trendNyClock} from '../../src/engines/options-daily-guidance/OptionsTrendStudy.ts';
import {guidanceLocal} from '../../src/engines/options-daily-guidance/OptionsGuidanceClock.ts';
import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';
import {assessRobinhoodEtfBars} from '../../src/engines/options-robinhood-data/RobinhoodEtfBars.ts';
import {compareRobinhoodEtfBars} from '../../src/engines/options-robinhood-data/RobinhoodEtfBarAudit.ts';
import {etfStudySources} from './options-etf-setup-io.mjs';
import {mapSnapshotSource,snapshotSources} from './options-snapshot-paper-io.mjs';
import {guidanceSettings} from './options-guidance-io.mjs';

const BASE='data/runtime/options-trend-study',MAX=16*1024*1024;
const fail=c=>{throw Error('TREND_STUDY_'+c);};
const id=v=>{if(typeof v!=='string'||!/^[a-z0-9][a-z0-9-]{2,59}$/.test(v))fail('ID');return v;};
const clock=v=>{if(typeof v!=='string'||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)fail('CLOCK');return v;};
function entries(root,path){let current=root;for(const part of path.split('/')){current=resolve(current,part);if(!existsSync(current))return [];const s=lstatSync(current);if(!s.isDirectory()||s.isSymbolicLink())fail('DIRECTORY');}const all=readdirSync(current,{withFileTypes:true});if(all.length>500)fail('CATALOG_LIMIT');return all;}
function read(root,path){const r=parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(io.readBytes(root,path,MAX))),{fingerprint,...payload}=r;if(paperFingerprint(payload)!==fingerprint)fail('INTEGRITY');return payload;}
function write(root,path,payload){const bytes=Buffer.from(JSON.stringify({...payload,fingerprint:paperFingerprint(payload)},null,2)+'\n');if(bytes.length>MAX)fail('SIZE');io.directory(root,path.slice(0,path.lastIndexOf('/')));io.writeExclusive(root,path,bytes);return path;}
function studyIds(root){return entries(root,BASE).map(e=>{if(!e.isDirectory()||e.isSymbolicLink())fail('CATALOG');return id(e.name);});}
function readStudy(root,name){return validateTrendStudy(read(root,BASE+'/'+id(name)+'/registration.json'));}
export function registerTrendStudy(root,name,at=new Date().toISOString()){
  clock(at);id(name);
  // One active cohort avoids silently changing assumptions or counting duplicates.
  for(const n of studyIds(root)){const p=readStudy(root,n);if(p.dates.at(-1)>=guidanceLocal(at).date)fail('COHORT_ALREADY_ACTIVE');}
  const study={version:'OPTIONS_TREND_STUDY_V1',id:name,registeredAt:at,dates:futureTrendDates(at),settings:guidanceSettings(root),rules:TREND_RULES_V1};
  validateTrendStudy(study);const path=write(root,BASE+'/'+name+'/registration.json',study);return {path,study,executionAllowed:false};
}
function sourceInput(r,kind,at){
  if(!r)return null;
  if(r.kind!==kind||r.version!=='OPTIONS_ETF_SETUP_RECORD_V1'||r.recordedAt>at||r.inputFingerprint!==paperFingerprint(r.input)||r.reportFingerprint!==paperFingerprint(r.report))fail('SOURCE_COPY');
  const recomputed=kind==='sources'?assessRobinhoodEtfBars(r.input,r.recordedAt):compareRobinhoodEtfBars(r.input,r.recordedAt);
  if(paperFingerprint(recomputed)!==r.reportFingerprint)fail('SOURCE_COPY_RECOMPUTE');
  return r.input;
}
function engineInput(payload){
  const {study,date,at,observations}=payload;
  if(!Array.isArray(observations)||observations.length>200)fail('OBSERVATIONS');
  return {study,date,at,events:observations.map(o=>{
    if(!o||Object.keys(o).sort().join()!=='at,audit,market,source')fail('OBSERVATION_FIELDS');
    return {at:o.at,source:sourceInput(o.source,'sources',o.at),audit:sourceInput(o.audit,'audits',o.at),frame:o.market?mapSnapshotSource(o.market,'V3'):null};
  })};
}
export function verifyTrendRecord(root,path){
  if(!new RegExp('^'+BASE+'/[a-z0-9-]+/(registration|days/2026-\\d\\d-\\d\\d/\\d{6})\\.json$').test(path))fail('PATH');
  const p=read(root,path);
  if(path.endsWith('/registration.json')){validateTrendStudy(p);if(path.split('/')[3]!==p.id)fail('PATH_ID');return p;}
  if(Object.keys(p).sort().join()!=='at,date,observations,report,study,version'||p.version!=='OPTIONS_TREND_DAY_RECORD_V1'||p.study.id!==path.split('/')[3]||p.date!==path.split('/')[5])fail('RECORD');
  const expected=assessTrendDay(engineInput(p));if(paperFingerprint(expected)!==paperFingerprint(p.report))fail('RECOMPUTE');
  return p;
}
function latestDay(root,name,date){
  const base=BASE+'/'+name+'/days/'+date,all=entries(root,base).map(e=>{if(!e.isFile()||e.isSymbolicLink()||!/^\d{6}\.json$/.test(e.name))fail('DAY_CATALOG');return e.name;}).sort();
  if(all.some((name,i)=>name!==String(i+1).padStart(6,'0')+'.json'))fail('DAY_SEQUENCE');
  const path=all.length?base+'/'+all.at(-1):null;
  return {next:base+'/'+String(all.length+1).padStart(6,'0')+'.json',path,payload:path?verifyTrendRecord(root,path):null};
}
function sourceAtDate(sources,date,at){return sources.find(r=>r.recordedAt<=at&&guidanceLocal(new Date(r.input.request.start_time).toISOString()).date===date)??null;}
function phase(date,at){const minute=guidanceLocal(at).date>date?2000:guidanceLocal(at).minute,close=paperSession(trendNyClock(date,570),undefined).closeMinute;return minute<570?'PRE':minute<640?'BASELINE':minute<=Math.min(870,close-70)?'ENTRY':minute<close-20?'HOLD':minute<close?'EXIT':'CLOSED';}
export function observeTrendStudies(root,at=new Date().toISOString()){
  clock(at);const names=studyIds(root);if(!names.length)return {checkedAt:at,results:[],sourceReads:0,executionAllowed:false};
  let sourceStore=null,marketStore=null;const results=[];
  for(const name of names){
    const study=readStudy(root,name);if(study.registeredAt>at)continue;
    for(const date of study.dates.filter(d=>d<=guidanceLocal(at).date)){
      try{
        const head=latestDay(root,name,date),prior=head.payload;
        // A closed day remains frozen unless an unresolved modeled position needs evidence.
        if(prior&&phase(date,prior.at)==='CLOSED'&&!prior.report.assets.some(a=>a.status==='OPEN_UNRESOLVED'))continue;
        sourceStore??=etfStudySources(root,at);
        marketStore??=snapshotSources(root);
        const source=sourceAtDate(sourceStore.sources,date,at);
        const audit=source?sourceStore.audits.find(a=>paperFingerprint(a.input.fiveMinuteCapture)===source.inputFingerprint)??null:null;
        const market=marketStore.map(copy=>({copy,frame:mapSnapshotSource(copy,'V3')})).filter(v=>v.frame.recordedAt<=at&&guidanceLocal(v.frame.capturedAt).date===date).sort((a,b)=>b.frame.recordedAt.localeCompare(a.frame.recordedAt))[0]?.copy??null;
        const observation={at,source,audit,market};
        const last=prior?.observations.at(-1);
        const same=last&&paperFingerprint([source,audit,market])===paperFingerprint([last.source,last.audit,last.market]);
        const open=prior?.report.assets.some(a=>a.status==='OPEN_UNRESOLVED');
        const staleAlready=prior?.report.assets.filter(a=>a.status==='OPEN_UNRESOLVED').every(a=>a.monitor.staleWhileOpen);
        if(same&&phase(date,at)===phase(date,prior.at)&&(!open||staleAlready||Date.parse(at)-Date.parse(prior.at)<60000))continue;
        if(prior&&at<=prior.at)fail('CLOCK_REGRESSION');
        const observations=[...(prior?.observations??[]),observation];
        const payload={version:'OPTIONS_TREND_DAY_RECORD_V1',study,date,at,observations};
        const report=assessTrendDay(engineInput(payload));
        const path=write(root,head.next,{...payload,report});verifyTrendRecord(root,path);
        results.push({studyId:name,date,path,status:report.assets.map(a=>({symbol:a.symbol,status:a.status})),error:null});
      }catch(e){results.push({studyId:name,date,error:/^(TREND_STUDY_|ETF_|SNAPSHOT_PAPER_)[A-Z_]+$/.test(e?.message)?e.message:'TREND_STUDY_LOCAL_FAILURE'});}
    }
  }
  return {checkedAt:at,results,sourceReads:0,executionAllowed:false};
}
export function trendStudyView(root,at=new Date().toISOString()){
  clock(at);return {version:'OPTIONS_TREND_STUDY_DESK_V1',assessedAt:at,studies:studyIds(root).map(name=>{
    const study=readStudy(root,name),days=study.dates.map(date=>{const h=latestDay(root,name,date);return {date,path:h.path,report:h.payload?.report??null,status:h.payload?'RECORDED':date>guidanceLocal(at).date?'AWAITING_SESSION':'NOT_YET_RECORDED'};});
    const counts={sessions:days.filter(d=>d.report).length,signals:0,entries:0,closed:0};for(const d of days)if(d.report)for(const k of ['signals','entries','closed'])counts[k]+=d.report.counts[k];
    return {study,days,counts};
  }),collectionGap:'Routine 15:50 quotes and conditional event-hour samples do not cover this 10:40–14:30 entry window or continuous exits. Local checks use saved evidence only; no extra market collection is enabled.',sourceQualified:false,strategyValidated:false,executionAllowed:false};
}
// Research-store failures must not suppress the existing source/publication path.
export function observeTrendStudiesSafely(root,at=new Date().toISOString()){
  try{const pass=observeTrendStudies(root,at);return {...pass,status:pass.results.some(r=>r.error)?'PARTIAL':'OK',error:null};}
  catch(e){return {checkedAt:at,results:[],status:'FAILED',error:/^TREND_STUDY_[A-Z_]+$/.test(e?.message)?e.message:'TREND_STUDY_LOCAL_FAILURE',sourceReads:0,executionAllowed:false};}
}
