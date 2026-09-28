import {existsSync,lstatSync,readdirSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {weekForAt,weekForStart,buildWeeklyPlanPreview,weeklyFingerprint} from '../../src/engines/options-weekly-plan/OptionsWeeklyPlan.ts';
import {withReleaseCalendarJournal} from './options-release-calendar-io.mjs';
import {withFomcCalendarJournal} from './options-fomc-calendar-io.mjs';
import {readFocusedSupplement} from './options-focused-news-io.mjs';
import {classifyFocusedHeadline} from '../../src/engines/options-drivers/OptionsFocusedNews.ts';
import {readEventResearch} from './options-event-research-io.mjs';
import {readManualLedger,MANUAL_LEDGER_BASE} from '../options-manual-ledger.mjs';
import {ownerCapitalShoppingList} from '../../src/catalogs/OwnerCapitalShoppingList.ts';

const BASE='data/runtime/options-weekly-plan',MAX_FILE=256*1024,MAX_REVISIONS=100;
const fail=code=>{throw Error('WEEKLY_PLAN_'+code);};
const exact=(value,keys)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join()!==[...keys].sort().join())fail('FIELDS');};
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const parse=bytes=>parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
function files(root,weekStartDate){
  let cursor=root;for(const part of [...BASE.split('/'),weekStartDate]){cursor=resolve(cursor,part);if(!existsSync(cursor))return [];const item=lstatSync(cursor);if(!item.isDirectory()||item.isSymbolicLink())fail('UNSAFE_DIRECTORY');}
  const directory=resolve(root,BASE,weekStartDate);
  const entries=readdirSync(directory,{withFileTypes:true});
  if(entries.length>MAX_REVISIONS||entries.some(e=>!e.isFile()||e.isSymbolicLink()||!/^\d{4}\.json$/.test(e.name)))fail('UNSAFE_CATALOG');
  return entries.map(e=>e.name).sort().map(name=>BASE+'/'+weekStartDate+'/'+name);
}
function recover(root,weekStartDate){
  const paths=files(root,weekStartDate),revisions=[];let previousFingerprint=null;
  for(const [index,path] of paths.entries()){
    const record=parse(io.readBytes(root,path,MAX_FILE));
    exact(record,['version','weekStartDate','weekEndDate','revision','savedAt','state','previousFingerprint','plan','requestPlan','fingerprint']);
    const {fingerprint,...body}=record;
    if(record.version!=='OPTIONS_WEEKLY_PLAN_REVISION_V1'||record.weekStartDate!==weekStartDate||record.weekEndDate!==weekForStart(weekStartDate).weekEndDate||record.revision!==index+1||path!==BASE+'/'+weekStartDate+'/'+String(index+1).padStart(4,'0')+'.json'||record.previousFingerprint!==previousFingerprint||!sha(fingerprint)||weeklyFingerprint(body)!==fingerprint)fail('REVISION_INTEGRITY');
    if(index===0?record.state!=='REVIEWED':record.state!=='AMENDMENT')fail('REVISION_STATE');
    if(!record.plan||record.plan.weekStartDate!==weekStartDate||record.plan.state!=='DRAFT'||!sha(record.plan.fingerprint))fail('PLAN_INTEGRITY');
    const {fingerprint:planFingerprint,assessedAt:planAssessedAt,...stablePlan}=record.plan;
    if(typeof planAssessedAt!=='string'||weeklyFingerprint(stablePlan)!==planFingerprint)fail('PLAN_INTEGRITY');
    validateRequestPlan(record.requestPlan);
    previousFingerprint=fingerprint;revisions.push(Object.freeze({...record,path}));
  }
  return Object.freeze(revisions);
}
function validateRequestPlan(plan){
  exact(plan,['manualEvents','newsWatch','notes','noTradeConditions','eventResearchRefs']);
  if(!Array.isArray(plan.manualEvents)||!Array.isArray(plan.newsWatch)||!Array.isArray(plan.noTradeConditions)||!Array.isArray(plan.eventResearchRefs)||typeof plan.notes!=='string')fail('REQUEST_PLAN');
  return plan;
}
function validateRequest(request,at){
  exact(request,['action','weekStartDate','expectedFingerprint','plan','previewFingerprint']);
  if(!['PREVIEW','REVIEW','AMEND'].includes(request.action))fail('ACTION');
  weekForStart(request.weekStartDate);
  if(request.weekStartDate!==weekForAt(at).weekStartDate)fail('TARGET_WEEK');
  if(request.expectedFingerprint!==null&&!sha(request.expectedFingerprint))fail('EXPECTED_FINGERPRINT');
  if(request.previewFingerprint!==null&&!sha(request.previewFingerprint))fail('PREVIEW_FINGERPRINT');
  validateRequestPlan(request.plan);
  return request;
}
async function calendar(root,path,reader,at){
  if(!existsSync(resolve(root,path)))return {state:'MISSING',inputs:null,errorCode:'STORE_MISSING'};
  try{return {state:'AVAILABLE',inputs:await reader(root,s=>s.inputs,at),errorCode:null};}
  catch{return {state:'BLOCKED',inputs:null,errorCode:'RECOVERY_FAILED'};}
}
function news(root,at){
  const supplement=readFocusedSupplement(root,at,true);
  return {evidenceAvailable:supplement.recordsRead>0,context:supplement.references.filter(r=>classifyFocusedHeadline(r.item.headline).scope!=='OUT_OF_SCOPE')
      .sort((a,b)=>b.item.observedAt.localeCompare(a.item.observedAt)||a.item.sourceId.localeCompare(b.item.sourceId)||a.item.itemId.localeCompare(b.item.itemId))
      .slice(0,30).map(r=>({title:r.item.headline,sourceId:r.item.sourceId,sourceRef:r.item.link,publishedAt:r.item.publishedAt,retrievedAt:r.item.observedAt}))};
}
function localDate(at){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;}
function researchRefs(root,ledgerId,at,weekStartDate,weekEndDate,requested){
  const candidates=new Map(),auto=new Set();
  if(existsSync(resolve(root,'data/runtime/options-event-research/plans'))){
    let studies;try{studies=readEventResearch(root,at).studies;}catch{fail('EVENT_RESEARCH_UNAVAILABLE');}
    for(const study of studies){
      const p=study.plan,scheduled=p?.event?.scheduledAt;
      if(!p?.id||typeof scheduled!=='string')continue;
      if(candidates.has(p.id))fail('REFERENCE_AMBIGUOUS');
      candidates.set(p.id,{id:p.id,kind:'EVENT_RESEARCH',sourcePath:study.path,savedAt:p.createdAt,sourceFingerprint:weeklyFingerprint(p)});
      const day=localDate(scheduled);if(day>=weekStartDate&&day<=weekEndDate)auto.add(p.id);
    }
  }
  if(existsSync(resolve(root,MANUAL_LEDGER_BASE,ledgerId,'manifest.json'))){
    let ledger;try{ledger=readManualLedger(root,ledgerId,()=>at);}catch{fail('MANUAL_LEDGER_UNAVAILABLE');}
    for(const event of ledger.input.events){
      const command=event.command;
      if(command.type!=='SAVE_PLAN_DRAFT'||event.savedAt>at)continue;
      const id=command.tradeId,realization=command.draft?.thesis?.realizationStartAt;
      if(candidates.get(id)?.kind==='EVENT_RESEARCH')fail('REFERENCE_AMBIGUOUS');
      candidates.set(id,{id,kind:'MANUAL_PLAN_DRAFT',sourcePath:ledger.base+'/'+String(event.sequence).padStart(6,'0')+'.json',savedAt:event.savedAt,sourceFingerprint:ledger.payloads[event.sequence-1].commandFingerprint});
      auto.delete(id);
      if(typeof realization==='string'&&/^20\d\d-/.test(realization)){
        const day=localDate(realization);if(day>=weekStartDate&&day<=weekEndDate)auto.add(id);
      }
    }
  }
  if(requested.some(id=>!candidates.has(id)))fail('EVENT_RESEARCH_REFERENCE_MISSING');
  const ids=[...new Set([...auto,...requested])].sort();
  return {ids,evidence:ids.map(id=>candidates.get(id))};
}
async function compose(root,request,at,ledgerId){
  const week=weekForStart(request.weekStartDate);
  const bls=await calendar(root,'data/runtime/options-release-calendar/retrievals.ndjson',withReleaseCalendarJournal,at);
  const fomc=await calendar(root,'data/runtime/options-fomc-calendar/retrievals.ndjson',withFomcCalendarJournal,at);
  const ownerUniverse=ownerCapitalShoppingList();
  const refs=researchRefs(root,ledgerId,at,week.weekStartDate,week.weekEndDate,request.plan.eventResearchRefs);
  const focused=news(root,at);
  return buildWeeklyPlanPreview({assessedAt:at,weekStartDate:week.weekStartDate,bls,fomc,
    manualEvents:request.plan.manualEvents,newsWatch:request.plan.newsWatch,newsContext:focused.context,newsEvidenceAvailable:focused.evidenceAvailable,notes:request.plan.notes,
    noTradeConditions:request.plan.noTradeConditions,eventResearchRefs:refs.ids,referenceEvidence:refs.evidence,
    monitoredAssets:ownerUniverse.entries.filter(e=>e.ownerStatus!=='EXCLUDED').map(e=>({symbol:e.symbol,themes:e.themes,ownerStatus:e.ownerStatus,identityStatus:e.identityStatus}))});
}
function defaultPlan(){return {manualEvents:[],newsWatch:[],notes:'',noTradeConditions:[],eventResearchRefs:[]};}
export async function previewWeeklyPlan(root,request,at=new Date().toISOString(),ledgerId='owner-manual-gld-ibit'){
  root=realpathSync(root);validateRequest(request,at);
  if(request.action!=='PREVIEW')fail('PREVIEW_ACTION');
  const revisions=recover(root,request.weekStartDate),latest=revisions.at(-1)??null;
  if(request.expectedFingerprint!==(latest?.fingerprint??null))fail('STALE_REVISION');
  return compose(root,request,at,ledgerId);
}
export async function weeklyPlanView(root,at=new Date().toISOString(),ledgerId='owner-manual-gld-ibit'){
  root=realpathSync(root);const week=weekForAt(at),revisions=recover(root,week.weekStartDate),latest=revisions.at(-1)??null;
  const request={action:'PREVIEW',weekStartDate:week.weekStartDate,expectedFingerprint:latest?.fingerprint??null,plan:latest?.requestPlan??defaultPlan(),previewFingerprint:null};
  const preview=await compose(root,request,at,ledgerId);
  const incomplete=Object.values(latest?.plan.coverage??preview.coverage).some(v=>v!=='REVIEWED');
  return {version:'OPTIONS_WEEKLY_PLAN_DESK_V1',...week,assessedAt:at,preview,latest,revisions,
    status:latest?incomplete?'INCOMPLETE_COVERAGE':'REVIEWED':'NOT_ESTABLISHED',executionAllowed:false};
}
export async function saveWeeklyPlan(root,request,at=new Date().toISOString(),ledgerId='owner-manual-gld-ibit'){
  root=realpathSync(root);validateRequest(request,at);
  if(!['REVIEW','AMEND'].includes(request.action)||!sha(request.previewFingerprint))fail('SAVE_ACTION');
  const revisions=recover(root,request.weekStartDate),latest=revisions.at(-1)??null;
  if(request.expectedFingerprint!==(latest?.fingerprint??null))fail('STALE_REVISION');
  if(request.action==='REVIEW'?latest!==null:latest===null)fail('LIFECYCLE');
  if(revisions.length>=MAX_REVISIONS)fail('REVISION_LIMIT');
  const preview=await compose(root,request,at,ledgerId);
  if(request.previewFingerprint!==preview.fingerprint)fail('PREVIEW_CHANGED');
  const revision=revisions.length+1,week=weekForStart(request.weekStartDate),state=request.action==='REVIEW'?'REVIEWED':'AMENDMENT';
  const body={version:'OPTIONS_WEEKLY_PLAN_REVISION_V1',...week,revision,savedAt:at,state,previousFingerprint:latest?.fingerprint??null,plan:preview,requestPlan:structuredClone(request.plan)};
  const fingerprint=weeklyFingerprint(body),path=BASE+'/'+week.weekStartDate+'/'+String(revision).padStart(4,'0')+'.json';
  io.directory(root,BASE+'/'+week.weekStartDate);
  io.writeExclusive(root,path,Buffer.from(JSON.stringify({...body,fingerprint},null,2)+'\n'));
  const saved=recover(root,week.weekStartDate).at(-1);
  if(saved?.fingerprint!==fingerprint)fail('SAVE_VERIFICATION');
  return {path,fingerprint,revision,state,alreadyRecorded:false,executionAllowed:false};
}
