import {existsSync,lstatSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {snapshotPaperRegistrations,snapshotPaperView,snapshotObservationEnd,saveSnapshotObservation,snapshotSources,mapSnapshotSource} from './options-snapshot-paper-io.mjs';
import {activeEventResearchContracts} from './options-event-research-io.mjs';

const BASE='data/runtime/options-snapshot-paper/observations',MAX=65536;
const fail=c=>{throw Error('SNAPSHOT_PAPER_OBSERVATION_'+c);};
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Object.keys(v).sort().join()!==keys.split(',').sort().join())fail('FIELDS');};
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(v)?v:fail('ID');
function read(root,path){const r=parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(io.readBytes(root,path,MAX))),{fingerprint,...payload}=r;if(fingerprint!==paperFingerprint(payload))fail('INTEGRITY');return payload;}
function write(root,path,payload){io.directory(root,path.slice(0,path.lastIndexOf('/')));io.writeExclusive(root,path,Buffer.from(JSON.stringify({...payload,fingerprint:paperFingerprint(payload)},null,2)+'\n'));}
function files(root,folder){let current=root;for(const part of folder.split('/')){current=resolve(current,part);if(!existsSync(current))return [];const s=lstatSync(current);if(!s.isDirectory()||s.isSymbolicLink())fail('DIRECTORY');}const all=readdirSync(current,{withFileTypes:true});if(all.length>100||all.some(f=>!f.isFile()||f.isSymbolicLink()||!f.name.endsWith('.json')))fail('CATALOG');return all.map(f=>folder+'/'+f.name).sort();}
function enrollments(root){
  const plans=snapshotPaperRegistrations(root);
  return files(root,BASE+'/enrolled').map(path=>{
    const e=read(root,path);exact(e,'version,planId,planPath,registrationFingerprint,enrolledAt,monitorUntilAt,purpose');
    const found=plans.find(p=>p.path===e.planPath&&p.registration.plan.id===e.planId),r=found?.registration,p=r?.plan;
    if(e.version!=='OPTIONS_PAPER_ENROLLMENT_V1'||path!==BASE+'/enrolled/'+id(e.planId)+'.json'||!p||p.version!=='OPTIONS_SNAPSHOT_PAPER_PLAN_V2'||paperFingerprint(r)!==e.registrationFingerprint||!['PIPELINE_REHEARSAL_NOT_SIGNAL','OWNER_PAPER_RESEARCH'].includes(e.purpose)||snapshotNs(p.createdAt)>snapshotNs(e.enrolledAt)||snapshotNs(e.enrolledAt)>=snapshotNs(p.decisionAt)||e.monitorUntilAt!==snapshotObservationEnd(p))fail('ENROLLMENT');
    const cancelPath=BASE+'/cancelled/'+e.planId+'.json';let cancellation=null;
    if(existsSync(resolve(root,cancelPath))){cancellation=read(root,cancelPath);exact(cancellation,'version,planId,enrollmentFingerprint,cancelledAt');if(cancellation.version!=='OPTIONS_PAPER_CANCELLATION_V1'||cancellation.planId!==e.planId||cancellation.enrollmentFingerprint!==paperFingerprint(e)||snapshotNs(cancellation.cancelledAt)<snapshotNs(e.enrolledAt))fail('CANCELLATION');}
    return {path,enrollment:e,plan:p,origin:mapSnapshotSource(r.selection).origin,cancellation};
  });
}
export function enrollPaperObservation(root,planId,purpose='OWNER_PAPER_RESEARCH',at=new Date().toISOString()){
  id(planId);snapshotNs(at);if(!['PIPELINE_REHEARSAL_NOT_SIGNAL','OWNER_PAPER_RESEARCH'].includes(purpose))fail('PURPOSE');
  const all=enrollments(root),old=all.find(e=>e.plan.id===planId);
  if(old){if(old.enrollment.purpose!==purpose)fail('CONFLICT');return {path:old.path,alreadyRecorded:true,cancelled:!!old.cancellation,executionAllowed:false};}
  const r=snapshotPaperRegistrations(root).find(p=>p.registration.plan.id===planId);if(!r)fail('PLAN_MISSING');const p=r.registration.plan;
  if(p.version!=='OPTIONS_SNAPSHOT_PAPER_PLAN_V2'||snapshotNs(p.createdAt)>snapshotNs(at)||snapshotNs(at)>=snapshotNs(p.decisionAt))fail('PROSPECTIVE_ONLY');
  const end=snapshotObservationEnd(p);
  if(all.filter(e=>!e.cancellation&&snapshotNs(e.enrollment.enrolledAt)<snapshotNs(end)&&snapshotNs(e.enrollment.monitorUntilAt)>snapshotNs(at)).length>=6||all.length>=100)fail('LIMIT');
  const payload={version:'OPTIONS_PAPER_ENROLLMENT_V1',planId,planPath:r.path,registrationFingerprint:paperFingerprint(r.registration),enrolledAt:at,monitorUntilAt:end,purpose};
  const path=BASE+'/enrolled/'+planId+'.json';write(root,path,payload);enrollments(root);return {path,alreadyRecorded:false,executionAllowed:false};
}
export function cancelPaperObservation(root,planId,at=new Date().toISOString()){
  id(planId);const e=enrollments(root).find(e=>e.plan.id===planId);if(!e||snapshotNs(at)<snapshotNs(e.enrollment.enrolledAt))fail('ENROLLMENT_MISSING');
  const path=BASE+'/cancelled/'+planId+'.json';if(e.cancellation)return {path,alreadyRecorded:true,executionAllowed:false};
  write(root,path,{version:'OPTIONS_PAPER_CANCELLATION_V1',planId,enrollmentFingerprint:paperFingerprint(e.enrollment),cancelledAt:at});return {path,alreadyRecorded:false,executionAllowed:false};
}
const identity=q=>({id:q.id,symbol:q.symbol,expiry:q.expiry,type:q.type,strike:q.strike,multiplier:q.multiplier});
/** Event research keeps its existing priority; paper identities share the six-ID bound. */
export function combinePaperTracking(events,candidates){
  if(events.length>6||new Set(events.map(q=>q.id)).size!==events.length)fail('TRACKING_LIMIT');const tracked=new Map(events.map(q=>[q.id,identity(q)])),rows=[];
  for(const c of candidates){const q=identity(c.contract),old=tracked.get(q.id);let status;
    if(old&&paperFingerprint(old)!==paperFingerprint(q))status='IDENTITY_CONFLICT';
    else if(old)status='SHARED_EXISTING_ID';
    else if(tracked.size>=6)status='CAPACITY_WAIT';
    else {tracked.set(q.id,q);status='INCLUDED';}
    rows.push({planId:c.planId,contractId:q.id,status});
  }
  return {trackedContracts:[...tracked.values()],rows};
}
export function paperObservationView(root,desk=null,at=desk?.assessedAt??new Date().toISOString()){
  snapshotNs(at);desk??=snapshotPaperView(root,at);const all=enrollments(root).filter(e=>snapshotNs(e.enrollment.enrolledAt)<=snapshotNs(at));
  const rows=all.map(e=>{
    const c=desk.cases.find(c=>c.plan.id===e.plan.id),saved=(c?.snapshots??[]).filter(s=>s.observation&&snapshotNs(s.recordedAt)<=snapshotNs(at)),last=saved.at(-1),cancelled=e.cancellation&&snapshotNs(e.cancellation.cancelledAt)<=snapshotNs(at);
    const state=cancelled?'CANCELLED':last?.observation?.kind==='WINDOW_END'?'FINALIZED':last?.report.status==='CLOSED_MODELED'?'CLOSED_MODELED':snapshotNs(at)>=snapshotNs(e.enrollment.monitorUntilAt)?'FINALIZATION_PENDING':snapshotNs(at)<snapshotNs(e.plan.decisionAt)?'AWAITING_WINDOW':'OBSERVING';
    return {planId:e.plan.id,enrolledAt:e.enrollment.enrolledAt,monitorUntilAt:e.enrollment.monitorUntilAt,purpose:e.enrollment.purpose,origin:e.origin,state,contract:identity(e.plan.contract),currentPaperStage:c?.current.paperStage??null,automaticReports:saved.length,lastAutomaticReport:last?{path:last.path,recordedAt:last.recordedAt,status:last.report.status,trigger:last.observation}:null};
  });
  const eligible=rows.filter(e=>['AWAITING_WINDOW','OBSERVING'].includes(e.state)&&e.origin==='HOST_MARKET_TOOL_RESPONSES'&&desk.cases.find(c=>c.plan.id===e.planId)?.current.status!=='CLOSED_MODELED').sort((a,b)=>a.enrolledAt.localeCompare(b.enrolledAt)||a.planId.localeCompare(b.planId));
  const tracking=combinePaperTracking(activeEventResearchContracts(root,at),eligible);
  return {version:'OPTIONS_PAPER_OBSERVATION_DESK_V1',assessedAt:at,rows:rows.map(r=>({...r,tracking:tracking.rows.find(t=>t.planId===r.planId)?.status??(r.origin==='SYNTHETIC_FIXTURE'?'SYNTHETIC_NOT_HOST_TRACKED':'NOT_ACTIVE')})),trackedContracts:tracking.trackedContracts,executionAllowed:false,continuousPolling:false};
}
export function observePaperPlans(root,capturePath=null,at=new Date().toISOString()){
  const desk=snapshotPaperView(root,at),view=paperObservationView(root,desk,at),all=enrollments(root),results=[];
  const capture=capturePath===null?null:snapshotSources(root).find(c=>c.path===capturePath);if(capturePath!==null&&!capture)fail('CAPTURE_MISSING');
  const frame=capture?mapSnapshotSource(capture):null;
  if(frame&&snapshotNs(frame.recordedAt)>snapshotNs(at))fail('FUTURE_CAPTURE');
  const pending=view.rows.filter(r=>!['CANCELLED','FINALIZED','CLOSED_MODELED'].includes(r.state)).sort((a,b)=>a.monitorUntilAt.localeCompare(b.monitorUntilAt)||a.planId.localeCompare(b.planId));
  for(const row of pending.slice(0,6)){
    const e=all.find(e=>e.plan.id===row.planId);
    try {
      if(row.state==='FINALIZATION_PENDING'){results.push({planId:row.planId,...saveSnapshotObservation(root,row.planId,null,at)});continue;}
      if(frame&&frame.origin===e.origin&&snapshotNs(frame.recordedAt)>=snapshotNs(e.enrollment.enrolledAt)&&snapshotNs(frame.capturedAt)>snapshotNs(e.plan.decisionAt)&&snapshotNs(frame.recordedAt)<=snapshotNs(e.enrollment.monitorUntilAt))results.push({planId:row.planId,...saveSnapshotObservation(root,row.planId,capturePath,at)});
    } catch(error){results.push({planId:row.planId,error:/^SNAPSHOT_PAPER_[A-Z_]+$/.test(error?.message)?error.message:'SNAPSHOT_PAPER_OBSERVATION_SAVE_FAILED',executionAllowed:false});}
  }
  return {version:'OPTIONS_PAPER_OBSERVATION_PASS_V1',assessedAt:at,capturePath,results,remainingBeyondPassLimit:Math.max(0,pending.length-6),executionAllowed:false};
}
