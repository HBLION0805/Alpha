import {existsSync,lstatSync,readdirSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {assessEventResearch,validateEventResearchPlan} from '../../src/engines/options-event-research/OptionsEventResearch.ts';
import {readGuidanceResearchFrames} from './options-guidance-io.mjs';

const BASE='data/runtime/options-event-research',MAX=32*1024*1024;
const fail=code=>{throw Error('EVENT_RESEARCH_'+code);};
const read=(root,path)=>parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(io.readBytes(root,path,MAX)));
const id=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(value)?value:fail('IDENTITY');
function files(root,path){
  let current=root;
  for(const part of path.split('/')){current=resolve(current,part);if(!existsSync(current))return [];const st=lstatSync(current);if(!st.isDirectory()||st.isSymbolicLink())fail('UNSAFE_DIRECTORY');}
  const list=readdirSync(current,{withFileTypes:true});if(list.length>100)fail('CATALOG_LIMIT');
  if(list.some(f=>!f.isFile()||f.isSymbolicLink()||!f.name.endsWith('.json')))fail('CATALOG_ENTRY');
  return list.map(f=>path+'/'+f.name).sort();
}
function envelope(payload){return {...payload,fingerprint:paperFingerprint(payload)};}
function recover(root,path){const r=read(root,path),{fingerprint,...payload}=r;if(paperFingerprint(payload)!==fingerprint)fail('INTEGRITY');return payload;}
function write(root,path,payload){io.directory(root,path.slice(0,path.lastIndexOf('/')));io.writeExclusive(root,path,Buffer.from(JSON.stringify(envelope(payload),null,2)+'\n'));return path;}
export const eventResearchKey=e=>[e.source,e.scheduledAt,e.title].join('|');
function tracked(plans,at){
  const contracts=new Map();
  for(const p of plans.filter(p=>p.createdAt<=at&&Date.parse(p.postExitAt)+20*60000>=Date.parse(at)))for(const q of [p.preContract,p.postCall,p.postPut]){
    const c={id:q.id,symbol:q.symbol,expiry:q.expiry,type:q.type,strike:q.strike,multiplier:q.multiplier};
    if(contracts.has(c.id)&&paperFingerprint(contracts.get(c.id))!==paperFingerprint(c))fail('TRACKING_CONFLICT');contracts.set(c.id,c);
  }
  if(contracts.size>6)fail('TRACKING_LIMIT');return [...contracts.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
export function activeEventResearchContracts(root,at=new Date().toISOString()){
  return tracked(files(root,BASE+'/plans').map(path=>validateRegistration(recover(root,path)).plan),at);
}
function validateRegistration(r) {
  if(r.version!=='OPTIONS_EVENT_RESEARCH_REGISTRATION_V1')fail('REGISTRATION');
  const p=validateEventResearchPlan(r.plan),q=r.request,s=r.selection;
  if(!q||!s||r.registeredAt!==p.createdAt||s.path!==p.selectionCapturePath||s.recordedAt>r.registeredAt||s.capturedAt>s.recordedAt||s.origin!=='HOST_MARKET_TOOL_RESPONSES'||!r.calendarEvidence?.calendarAvailable)fail('REGISTRATION');
  const expected={id:p.id,title:p.title,eventKey:eventResearchKey(p.event),capturePath:p.selectionCapturePath,settings:p.settings,preContractId:p.preContract.id,postCallId:p.postCall.id,postPutId:p.postPut.id,preEntryAt:p.preEntryAt,preExitAt:p.preExitAt,postEntryAt:p.postEntryAt,postExitAt:p.postExitAt,minimumMoveBps:p.minimumMoveBps};
  if(paperFingerprint(q)!==paperFingerprint(expected)||!r.calendarEvidence.events.some(e=>paperFingerprint(e)===paperFingerprint(p.event))||[p.preContract,p.postCall,p.postPut].some(c=>!s.quotes.some(q=>paperFingerprint(q)===paperFingerprint(c))))fail('REGISTRATION_LINKAGE');
  assessEventResearch(p,[s],r.registeredAt);
  return r;
}

export function registerEventResearch(root,request,guidance,at=new Date().toISOString()) {
  root=realpathSync(root);
  const keys=['id','title','eventKey','capturePath','settings','preContractId','postCallId','postPutId','preEntryAt','preExitAt','postEntryAt','postExitAt','minimumMoveBps'];
  if(!request||Object.keys(request).sort().join()!==keys.sort().join())fail('REQUEST_FIELDS');
  const path=BASE+'/plans/'+id(request.id)+'.json';
  if(existsSync(resolve(root,path))){const old=validateRegistration(recover(root,path));if(paperFingerprint(old.request)!==paperFingerprint(request))fail('REQUEST_CONFLICT');return {path,alreadyRecorded:true,executionAllowed:false};}
  if(files(root,BASE+'/plans').length>=100)fail('CATALOG_LIMIT');
  if(!guidance?.input?.calendarAvailable)fail('CALENDAR_UNAVAILABLE');
  if(paperFingerprint(request.settings)!==paperFingerprint(guidance.input.settings))fail('SETTINGS_CHANGED');
  const event=guidance.input.events.find(e=>eventResearchKey(e)===request.eventKey);
  if(!event)fail('EVENT_NOT_IN_CALENDAR');
  const frames=readGuidanceResearchFrames(root),selection=frames.find(f=>f.path===request.capturePath);
  if(!selection||selection.recordedAt>at||selection.capturedAt>at||selection.origin!=='HOST_MARKET_TOOL_RESPONSES')fail('SELECTION_CAPTURE_UNAVAILABLE');
  const contract=key=>{const q=selection.quotes.find(q=>q.id===request[key]);if(!q)fail('CONTRACT_NOT_IN_CAPTURE');return q;};
  const plan=validateEventResearchPlan({version:'OPTIONS_EVENT_RESEARCH_PLAN_V1',id:request.id,title:request.title,createdAt:at,event,selectionCapturePath:selection.path,
    preContract:contract('preContractId'),postCall:contract('postCallId'),postPut:contract('postPutId'),settings:request.settings,
    preEntryAt:request.preEntryAt,preExitAt:request.preExitAt,postEntryAt:request.postEntryAt,postExitAt:request.postExitAt,minimumMoveBps:request.minimumMoveBps});
  const payload={version:'OPTIONS_EVENT_RESEARCH_REGISTRATION_V1',request,plan,selection,calendarEvidence:{events:guidance.input.events,calendarAvailable:guidance.input.calendarAvailable},registeredAt:at};
  tracked([...files(root,BASE+'/plans').map(path=>validateRegistration(recover(root,path)).plan),plan],at);
  validateRegistration(payload);write(root,path,payload);verifyEventResearch(root,path);
  return {path,alreadyRecorded:false,executionAllowed:false};
}
export function readEventResearch(root,at=new Date().toISOString()) {
  const plans=files(root,BASE+'/plans').map(path=>{const r=validateRegistration(recover(root,path));if(r.registeredAt>at||path!==BASE+'/plans/'+r.plan.id+'.json')fail('REGISTRATION');return {path,...r};});
  const frames=plans.length?readGuidanceResearchFrames(root):[];
  return {version:'OPTIONS_EVENT_RESEARCH_DESK_V1',assessedAt:at,studies:plans.map(r=>({path:r.path,...assessEventResearch(r.plan,frames,at)})),executionAllowed:false,actualTrades:0};
}
export function saveEventResearchReport(root,studyId,at=new Date().toISOString()) {
  const registration=validateRegistration(recover(root,BASE+'/plans/'+id(studyId)+'.json'));
  if(files(root,BASE+'/reports/'+studyId).length>=100)fail('CATALOG_LIMIT');
  const frames=readGuidanceResearchFrames(root).filter(f=>f.recordedAt<=at&&f.capturedAt>registration.plan.createdAt);
  const report=assessEventResearch(registration.plan,frames,at),path=BASE+'/reports/'+studyId+'/'+at.replace(/[:.]/g,'-')+'-'+randomUUID()+'.json';
  write(root,path,{version:'OPTIONS_EVENT_RESEARCH_SNAPSHOT_V1',recordedAt:at,registration,frames,report});
  verifyEventResearch(root,path);return {path,executionAllowed:false};
}
export function verifyEventResearch(root,path) {
  if(typeof path!=='string'||!path.startsWith(BASE+'/')||path.includes('..')||path.includes('\\')||!path.endsWith('.json'))fail('RECORD_PATH');
  const r=recover(root,path);
  if(r.version==='OPTIONS_EVENT_RESEARCH_REGISTRATION_V1'){
    validateRegistration(r);if(path!==BASE+'/plans/'+r.plan.id+'.json')fail('REGISTRATION');
  } else if(r.version==='OPTIONS_EVENT_RESEARCH_SNAPSHOT_V1'){
    validateRegistration(r.registration);
    const actual=assessEventResearch(r.registration.plan,r.frames,r.recordedAt);if(paperFingerprint(actual)!==paperFingerprint(r.report))fail('RECOMPUTE');
  } else fail('VERSION');
  return {status:'VERIFIED',path,fingerprint:paperFingerprint(r),executionAllowed:false};
}
