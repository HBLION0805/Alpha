import { lstatSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { optionsEvidenceExportStorage as io } from '../options-evidence-export.mjs';
import { parseChainSurveyJson } from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import { paperFingerprint } from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import { readinessClock } from '../../src/engines/options-readiness/OptionsReadinessEngine.ts';
import { assessCandidateChecks } from '../../src/engines/options-daily-guidance/OptionsCandidateChecks.ts';
import {assessEventEntry} from '../../src/engines/options-daily-guidance/OptionsEventEntry.ts';
import {sourcePlanOptions} from './options-source-comparison.mjs';

export function eventEntryContexts(state){
  const calendar=(state.calendar?.data?.groups??[]).flatMap(g=>[...g.dateOnlyEntries,...g.scheduledTimeEntries]).map(e=>({key:e.source+':'+e.sourceKey,title:e.title,source:e.source,scheduledAt:e.scheduledAt??null,receivedAt:state.calendar.data.sources?.[e.source==='BLS'?'bls':'fomc']?.lastKnownReceivedAt??null}));
  const plans=sourcePlanOptions(state.manual?.data),latest=new Map();
  for(const p of plans)if(!latest.has(p.tradeId)||p.kind==='FROZEN'||latest.get(p.tradeId).kind!=='FROZEN'&&p.registeredAt>=latest.get(p.tradeId).registeredAt)latest.set(p.tradeId,p);
  return [...latest.values()].map(p=>{
    if(p.kind==='FROZEN')return {...p,symbol:p.contract.symbol,calendar};
    const record=state.manual.data.planRecords.find(e=>'draft:'+e.command.requestId===p.key),f=record.command.draft.fields;
    return {...p,symbol:f.symbol,calendar,plan:{...p.plan,declaredAt:f.declaredAt,maxContracts:f.maxContracts?Number(f.maxContracts):null,maxEntryDebitUsd:f.maxEntryDebitUsd,plannedRiskUsd:f.plannedRiskUsd,targetNetProfitUsd:f.targetNetProfitUsd,stopPremiumUsd:f.stopPremiumUsd||null,entryDeadlineAt:f.entryDeadlineAt||null,timeExitAt:f.timeExitAt||null}};
  });
}
export function eventEntryPlanViews(state){return eventEntryContexts(state).map(ctx=>({...assessEventEntry(ctx,state.loadedAt,state.guidance?.data?.input?.calendarAvailable===true),tradeId:ctx.tradeId,symbol:ctx.symbol}));}
export function compareSavedEventPlan(state,planKey,planVersion){
  const context=eventEntryContexts(state).find(p=>p.key===planKey&&p.version===planVersion);
  if(!context)fail('PLAN_VERSION_UNAVAILABLE');
  if(!state.guidance?.data?.input)fail('GUIDANCE_UNAVAILABLE');
  const input={version:'OPTIONS_CANDIDATE_CHECKS_INPUT_V1',sourcePaths:state.guidance.data.sourcePaths,guidance:{...state.guidance.data.input,eventPlan:context}};
  return {current:assessCandidateChecks(input),history:[],sourceRefresh:false,executionAllowed:false};
}

const BASE='data/runtime/options-candidate-checks', MAX=4*1024*1024;
const fail=code=>{throw Error('CANDIDATE_CHECKS_'+code);};
function catalog(root){
  let path=root;
  for(const part of BASE.split('/')){path=resolve(path,part);let st;try{st=lstatSync(path);}catch(e){if(e.code==='ENOENT')return [];throw e;}if(!st.isDirectory()||st.isSymbolicLink())fail('UNSAFE_DIRECTORY');}
  const entries=readdirSync(path,{withFileTypes:true});
  if(entries.length>500)fail('CATALOG_LIMIT');
  if(entries.some(e=>!e.isFile()||e.isSymbolicLink()||!/^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z-[a-f0-9-]{36}\.json$/.test(e.name)))fail('CATALOG_ENTRY');
  return entries.map(e=>BASE+'/'+e.name).sort().reverse();
}
export function readCandidateChecks(root,path,at=new Date().toISOString()){
  readinessClock(at);
  if(typeof path!=='string'||!new RegExp('^'+BASE+'/\\d{4}-\\d\\d-\\d\\dT\\d\\d-\\d\\d-\\d\\d-\\d{3}Z-[a-f0-9-]{36}\\.json$').test(path))fail('PATH');
  const r=parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(io.readBytes(root,path,MAX)));
  if(!r||Object.keys(r).sort().join()!=='input,inputFingerprint,recordedAt,report,reportFingerprint,version'||r.version!=='OPTIONS_CANDIDATE_CHECKS_RECORD_V1'||r.inputFingerprint!==paperFingerprint(r.input)||r.reportFingerprint!==paperFingerprint(r.report))fail('INTEGRITY');
  readinessClock(r.recordedAt);
  if(Date.parse(r.recordedAt)>Date.parse(at)||Date.parse(r.input.guidance.at)>Date.parse(r.recordedAt))fail('FUTURE_RECORD');
  if(!path.startsWith(BASE+'/'+r.recordedAt.replace(/[:.]/g,'-')+'-'))fail('RECORD_PATH_CLOCK');
  const report=assessCandidateChecks(r.input);
  if(paperFingerprint(report)!==r.reportFingerprint)fail('RECOMPUTE');
  return {path,...r};
}
function copiedInput(view){
  if(!view?.input||!Array.isArray(view.sourcePaths))fail('GUIDANCE_UNAVAILABLE');
  return structuredClone({version:'OPTIONS_CANDIDATE_CHECKS_INPUT_V1',guidance:view.input,sourcePaths:view.sourcePaths});
}
export function candidateChecksView(root,view,at){
  const input=copiedInput(view),current=assessCandidateChecks(input);
  const history=catalog(root).slice(0,24).map(path=>{const r=readCandidateChecks(root,path,at);return {path,recordedAt:r.recordedAt,assessedAt:r.report.assessedAt,counts:r.report.counts,inputFingerprint:r.inputFingerprint};});
  return {current,history};
}
export function saveCandidateChecks(root,view){
  const input=copiedInput(view),report=assessCandidateChecks(input),recordedAt=new Date().toISOString();
  if(Date.parse(input.guidance.at)>Date.parse(recordedAt))fail('FUTURE_ASSESSMENT');
  if(catalog(root).length>=500)fail('CATALOG_LIMIT');
  const path=BASE+'/'+recordedAt.replace(/[:.]/g,'-')+'-'+randomUUID()+'.json';
  const record={version:'OPTIONS_CANDIDATE_CHECKS_RECORD_V1',recordedAt,input,report,inputFingerprint:paperFingerprint(input),reportFingerprint:paperFingerprint(report)};
  const bytes=Buffer.from(JSON.stringify(record,null,2)+'\n');if(bytes.length>MAX)fail('RECORD_LIMIT');
  io.directory(root,BASE);io.writeExclusive(root,path,bytes);
  const verified=readCandidateChecks(root,path);
  return {status:'SAVED_AND_VERIFIED',path,recordedAt,assessedAt:report.assessedAt,counts:report.counts,reportFingerprint:verified.reportFingerprint,executionAllowed:false};
}
