import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { optionsEvidenceExportStorage as io } from '../options-evidence-export.mjs';
import { runOptionsChainReviewCommand } from '../options-chain-review.mjs';
import { runOptionsActivityStudyCommand } from '../options-activity-study.mjs';
import { readManualLedger, runOptionsManualLedgerCommand } from '../options-manual-ledger.mjs';
import { runOptionsOutcomeAuditCommand } from '../options-outcome-audit.mjs';
import { runOptionsCalendarBriefCommand } from '../options-calendar-brief.mjs';
import { withDriverJournal } from './options-driver-io.mjs';
import { withTreasuryJournal } from './options-treasury-io.mjs';
import { withBtcContextJournal } from './options-btc-context-io.mjs';
import { buildOptionsDriverReport } from '../../src/engines/options-drivers/OptionsDriverMonitorEngine.ts';
import { reportTreasuryHistory } from '../../src/engines/options-treasury/TreasuryRealYieldEngine.ts';
import { reportBtcContext } from '../../src/engines/options-btc-context/BtcSpotContextEngine.ts';
import { reconcileManualLedger, validateManualLedgerCommand } from '../../src/engines/options-manual-ledger/OptionsManualLedger.ts';
import { exportId } from '../../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts';
import { readinessClock } from '../../src/engines/options-readiness/OptionsReadinessEngine.ts';
import { paperFingerprint } from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import { parseChainSurveyJson } from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import { guidanceView, saveGuidanceSettings } from './options-guidance-io.mjs';
import { focusedNewsView } from './options-focused-news-io.mjs';
import { readEventResearch, registerEventResearch, saveEventResearchReport } from './options-event-research-io.mjs';
import { readBarQualityDesk } from './options-bar-quality-io.mjs';
import { candidateChecksView, saveCandidateChecks } from './options-candidate-checks-io.mjs';
import { evaluateOptionsPlanningFeasibility } from '../../src/engines/options-retail-feasibility/OptionsTradeBudget.ts';
import { assessOptionsCostDesk } from '../../src/engines/options-retail-feasibility/OptionsCostDesk.ts';
import { assessOptionsCapitalPolicy } from '../../src/engines/options-retail-feasibility/OptionsCapitalPolicy.ts';

const MAX=32*1024*1024, INPUTS='data/runtime/options-workbench-inputs';
const parse=bytes=>parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));
const read=(root,path,max=MAX)=>io.readBytes(root,path,max);
const readJson=(root,path)=>parse(read(root,path));
const fail=code=>{throw Error('WORKBENCH_'+code);};
export function workbenchError(e) {
  if(e?.code==='ENOENT')return 'STORE_MISSING';
  if(e?.code==='EEXIST')return 'STORE_BUSY_OR_EXISTS';
  return /^(WORKBENCH_|MANUAL_|CHAIN_|ACTIVITY_|GUIDANCE_|CANDIDATE_CHECKS_|FOCUSED_NEWS_|EVENT_RESEARCH_|BAR_QUALITY_|OPTIONS_EXPORT_|OPTIONS_READINESS_)[A-Z_]+$/.test(e?.message)?e.message:'LOCAL_RECOVERY_FAILED';
}
function directories(root,path){
  let current=root;
  for(const part of path.split('/')){current=resolve(current,part);if(!existsSync(current))return [];const s=lstatSync(current);if(!s.isDirectory()||s.isSymbolicLink())fail('UNSAFE_DIRECTORY');}
  const entries=readdirSync(current,{withFileTypes:true});if(entries.length>120)fail('CATALOG_LIMIT');
  return entries.filter(e=>e.isDirectory()&&!e.isSymbolicLink()).map(e=>e.name).filter(id=>{try{exportId(id);return true;}catch{return false;}});
}
function chainCatalog(root){
  return directories(root,'data/runtime/options-chain-survey').map(id=>{
    try{const m=readJson(root,`data/runtime/options-chain-survey/${id}/manifest.json`);if(m.version!=='OPTIONS_CHAIN_REVIEW_FILES_V1')return null;readinessClock(m.createdAt);return {id,createdAt:m.createdAt,state:'SAVED'};}
    catch(e){return {id,createdAt:null,state:'UNREADABLE',error:workbenchError(e)};}
  }).filter(Boolean).sort((a,b)=>(b.createdAt??'').localeCompare(a.createdAt??'')||a.id.localeCompare(b.id));
}
async function component(operation,at){try{return {state:'AVAILABLE',checkedAt:at,data:await operation(),error:null};}catch(e){return {state:e?.code==='ENOENT'?'MISSING':'BLOCKED',checkedAt:at,data:null,error:workbenchError(e)};}}
async function journal(root,path,operation){const bytes=read(root,path);const result=await operation();if(!read(root,path).equals(bytes))fail('SOURCE_CHANGED');return result;}
export function createWorkbenchData({workspaceRoot=process.cwd(),ledgerId='owner-manual-gld-ibit',studyId='fomc-activity-20260908',now=()=>new Date().toISOString()}={}){
  const root=realpathSync(workspaceRoot);exportId(ledgerId);exportId(studyId);
  const options=()=>({workspaceRoot:root,now});
  const ledger=()=>readManualLedger(root,ledgerId,now);
  function progress(){
    const p=readJson(root,'docs/status/development-progress.json'),statuses=['LOCAL_VALIDATED','PARTIAL','NOT_VALIDATED'];
    if(p.version!=='OPTIONS_DEVELOPMENT_PROGRESS_BASELINE_V1'||p.denominator!==10||!Array.isArray(p.workstreams)||p.workstreams.length!==10||new Set(p.workstreams.map(w=>w.id)).size!==10)fail('PROGRESS_SHAPE');
    if(p.workstreams.some(w=>!statuses.includes(w.status)||typeof w.name!=='string'||typeof w.detail!=='string')||statuses.some(k=>p.currentCounts?.[k]!==p.workstreams.filter(w=>w.status===k).length))fail('PROGRESS_COUNTS');
    if(p.firstPaperFlow?.totalGates!==6||!Array.isArray(p.firstPaperFlow.gates)||p.firstPaperFlow.gates.length!==6||p.firstPaperFlow.gates.some(g=>typeof g.name!=='string'||typeof g.status!=='string'))fail('PROGRESS_GATES');
    return p;
  }
  function loadChain(id){
    exportId(id);runOptionsChainReviewCommand(['--verify',id],options());
    const value=readJson(root,`data/runtime/options-chain-survey/${id}/report.json`);
    return {id,...value};
  }
  function activity(){
    runOptionsActivityStudyCommand(['--verify',studyId],options());
    const parent=`data/runtime/options-activity-studies/${studyId}`;
    const reports=directories(root,parent+'/reports').map(id=>({id,report:readJson(root,parent+'/reports/'+id+'/report.json')}));
    reports.sort((a,b)=>b.report.assessedAt.localeCompare(a.report.assessedAt)||a.id.localeCompare(b.id));
    if(!reports.length)fail('ACTIVITY_REPORT_MISSING');const latest=reports[0];
    runOptionsActivityStudyCommand(['--verify-report',studyId,latest.id],options());
    return {studyId,reportId:latest.id,...latest.report};
  }
  async function state(boardId=null){
    const at=now();readinessClock(at);if(boardId!==null)exportId(boardId);
    const catalogs=await component(()=>chainCatalog(root),at);
    // An unreadable catalog entry cannot silently masquerade as a complete latest view.
    const entries=catalogs.data??[],selected=boardId??entries.find(e=>e.state==='SAVED')?.id??null;
    const chain=await component(()=>{if(boardId===null&&entries.some(e=>e.state==='UNREADABLE'))fail('CATALOG_REQUIRES_SELECTION');if(!selected)fail('CHAIN_MISSING');return loadChain(selected);},at);
    const manual=await component(()=>{const r=ledger();return {headSha256:r.headSha256,...r.report,events:r.input.events};},at);
    const study=await component(activity,at);
    const headlines=await component(()=>journal(root,'data/runtime/options-driver-monitor/refreshes.ndjson',()=>withDriverJournal(root,s=>{
      const report=buildOptionsDriverReport(s.observations,s.health,at),latest=new Map();
      for(const item of s.observations)if(item.observedAt<=at)latest.set(`${item.origin}:${item.sourceId}:${item.itemId}`,item);
      return {...report,headlines:[...latest.values()].sort((a,b)=>b.observedAt.localeCompare(a.observedAt))};
    })),at);
    const treasury=await component(()=>journal(root,'data/runtime/options-treasury-rates/retrievals.ndjson',()=>withTreasuryJournal(root,s=>reportTreasuryHistory(s.inputs,at),at)),at);
    const btc=await component(()=>journal(root,'data/runtime/options-btc-context/retrievals.ndjson',()=>withBtcContextJournal(root,s=>reportBtcContext(s.inputs,at),at)),at);
    const calendar=await component(()=>runOptionsCalendarBriefCommand(['--report','--json'],{workspaceRoot:root,now:()=>at}),at);
    const outcomes=await component(()=>runOptionsOutcomeAuditCommand(['--report'],options()),at);
    const progressState=await component(progress,at);
    const result={version:'OPTIONS_WORKBENCH_STATE_V1',loadedAt:at,ledgerId,selectedBoardId:selected,catalog:catalogs,
      chain,manual,activity:study,headlines,treasury,btc,calendar,outcomes,progress:progressState,
      access:'LOCAL_SAVED_DATA',sourceRefresh:false,accountAccessed:false,executionAllowed:false};
    result.guidance=await component(()=>guidanceView(root,result),at);
    result.capitalPolicy=await component(()=>assessOptionsCapitalPolicy(result.guidance.data?.current.settings),at);
    result.candidateChecks=await component(()=>candidateChecksView(root,result.guidance.data,at),at);
    result.focusedNews=await component(()=>focusedNewsView(root,headlines.data,at),at);
    result.eventResearch=await component(()=>readEventResearch(root,at),at);
    result.barQuality=await component(()=>readBarQualityDesk(root,at),at);
    return result;
  }
  function preview(command){
    const r=ledger(),at=now(),c=validateManualLedgerCommand(command,at);
    const previous=r.input.events.find(e=>e.command.requestId===c.requestId);
    if(previous){if(paperFingerprint(previous.command)!==paperFingerprint(c))fail('REQUEST_CONFLICT');return {alreadyRecorded:true,headSha256:r.headSha256,command:c,report:r.report};}
    const report=reconcileManualLedger({...r.input,events:[...r.input.events,{sequence:r.input.events.length+1,recordedAt:at,savedAt:at,command:c}]},at);
    return {alreadyRecorded:false,headSha256:r.headSha256,command:c,report};
  }
  function save(body){
    if(!body||Object.keys(body).sort().join()!=='command,expectedHeadSha256'||typeof body.expectedHeadSha256!=='string')fail('SAVE_INPUT');
    const p=preview(body.command);if(!p.alreadyRecorded&&p.headSha256!==body.expectedHeadSha256)fail('LEDGER_CHANGED_REVIEW_AGAIN');
    if(p.alreadyRecorded)return {status:'MANUAL_REQUEST_ALREADY_RECORDED',headSha256:p.headSha256,executionAllowed:false};
    io.directory(root,INPUTS);const path=INPUTS+'/'+randomUUID()+'.json';
    io.writeExclusive(root,path,Buffer.from(JSON.stringify(p.command,null,2)+'\n'));
    return runOptionsManualLedgerCommand(['--append',ledgerId,path],options());
  }
  async function eventResearch(body){
    if(!body||!['REGISTER','SAVE_REPORT'].includes(body.action))fail('EVENT_RESEARCH_ACTION');
    if(body.action==='SAVE_REPORT'){if(Object.keys(body).sort().join()!=='action,id')fail('EVENT_RESEARCH_FIELDS');return saveEventResearchReport(root,body.id,now());}
    if(Object.keys(body).sort().join()!=='action,request')fail('EVENT_RESEARCH_FIELDS');
    const current=await state();return registerEventResearch(root,body.request,current.guidance.data,now());
  }
  async function candidateChecks(body){
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)fail('CANDIDATE_CHECKS_FIELDS');
    const current=await state();
    if(current.candidateChecks.state!=='AVAILABLE')throw Error(current.candidateChecks.error);
    return saveCandidateChecks(root,current.guidance.data);
  }
  return {scope:{ledgerId,workspaceFingerprint:createHash('sha256').update(root).digest('hex')},state,preview,save,eventResearch,candidateChecks,costDesk:assessOptionsCostDesk,capitalPolicy:assessOptionsCapitalPolicy,evaluate:evaluateOptionsPlanningFeasibility,saveGuidanceSettings:value=>({path:saveGuidanceSettings(root,value),executionAllowed:false}),initialize:()=>runOptionsManualLedgerCommand(['--create',ledgerId],options())};
}
