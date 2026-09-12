import { createHash } from 'node:crypto';
import type { GuidanceEvent, GuidanceInput, GuidanceQuote, GuidanceSettings } from '../../contracts/OptionsDailyGuidance';
import { assessDailyGuidance, guidanceLocal } from '../options-daily-guidance/OptionsDailyGuidance';
import { readinessClock } from '../options-readiness/OptionsReadinessEngine';
import { paperFingerprint } from '../options-paper/OptionsPaperTradingEngine';
import { parseChainSurveyJson } from './RobinhoodChainSurvey';

export interface EventGuidanceCopy {path:string; sha256:string; utf8:string}
export interface PaperEventDeclaration {reportPath:string; eventKey:string; phase:'PRE_EVENT'|'POST_EVENT'; hypothesis:string; entryCondition:string; invalidation:string}
export interface PaperEventContext {version:'OPTIONS_PAPER_EVENT_CONTEXT_V1'; declaration:PaperEventDeclaration; guidance:EventGuidanceCopy}
interface EventPlanTerms {createdAt:string;decisionAt:string;entryDeadlineAt:string;timeExitAt:string;contract:GuidanceQuote;settings:GuidanceSettings}
const fail=(code:string):never=>{throw Error('PAPER_EVENT_'+code);};
const exact=(v:unknown,keys:string[])=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==keys.sort().join())fail('FIELDS');};
export const paperEventKey=(e:GuidanceEvent)=>JSON.stringify([e.source,e.title,e.startDate,e.endDate,e.scheduledAt]);
export function readEventGuidance(copy:EventGuidanceCopy){
  exact(copy,['path','sha256','utf8']);
  if(typeof copy.path!=='string'||!/^data\/runtime\/options-daily-guidance\/reports\/\d{4}-\d\d-\d\d\/[\w.-]+\.json$/.test(copy.path)||typeof copy.utf8!=='string'||new TextEncoder().encode(copy.utf8).length>8*1024*1024||copy.sha256!==createHash('sha256').update(copy.utf8).digest('hex'))fail('GUIDANCE_COPY');
  const r=parseChainSurveyJson(copy.utf8) as {version:string;kind:string;recordedAt:string;input:GuidanceInput;report:ReturnType<typeof assessDailyGuidance>;inputFingerprint:string;reportFingerprint:string};
  exact(r,['version','kind','recordedAt','input','report','inputFingerprint','reportFingerprint']);
  if(r.version!=='OPTIONS_GUIDANCE_RECORD_V1'||r.kind!=='reports'||paperFingerprint(r.input)!==r.inputFingerprint||paperFingerprint(r.report)!==r.reportFingerprint)fail('GUIDANCE_INTEGRITY');
  readinessClock(r.recordedAt);const report=assessDailyGuidance(r.input);
  if(r.input.at>r.recordedAt||paperFingerprint(report)!==r.reportFingerprint)fail('GUIDANCE_RECOMPUTE');
  return {...r,report};
}
export function eventPlanningChoices(copy:EventGuidanceCopy){
  const r=readEventGuidance(copy);
  return {reportPath:copy.path,issuedAt:r.recordedAt,assessedAt:r.input.at,captureAt:r.input.captureAt,events:r.report.events.filter(e=>e.major&&e.endDate>=guidanceLocal(r.input.at).date).map(e=>({...e,key:paperEventKey(e)}))};
}
/** Coherent frozen research declarations; prose conditions never become fill gates. */
export function assessPaperEventContext(context:PaperEventContext,p:EventPlanTerms){
  exact(context,['version','declaration','guidance']);if(context.version!=='OPTIONS_PAPER_EVENT_CONTEXT_V1')fail('VERSION');
  const d=context.declaration;exact(d,['reportPath','eventKey','phase','hypothesis','entryCondition','invalidation']);
  if(d.reportPath!==context.guidance.path||typeof d.eventKey!=='string'||d.eventKey.length>2000||!['PRE_EVENT','POST_EVENT'].includes(d.phase))fail('DECLARATION');
  for(const k of ['hypothesis','entryCondition','invalidation'] as const)if(typeof d[k]!=='string'||!d[k].trim()||d[k].length>800)fail('TEXT');
  const r=readEventGuidance(context.guidance);
  for(const t of [p.createdAt,p.decisionAt,p.entryDeadlineAt,p.timeExitAt])readinessClock(t);
  if(r.recordedAt>p.createdAt||p.createdAt>=p.decisionAt||p.decisionAt>=p.entryDeadlineAt||p.entryDeadlineAt>=p.timeExitAt)fail('PROSPECTIVE_CLOCK');
  const asset=r.report.assets.find(a=>a.symbol===p.contract.symbol),candidate=asset?.candidates.find(c=>c.contract.id===p.contract.id);
  if(!candidate||Object.entries(candidate.contract).some(([k,v])=>paperFingerprint(v)!==paperFingerprint(p.contract[k as keyof GuidanceQuote]))||paperFingerprint(r.input.settings)!==paperFingerprint(p.settings))fail('CONTRACT_OR_SETTINGS_LINKAGE');
  const events=r.report.events.filter(e=>paperEventKey(e)===d.eventKey);
  if(events.length!==1||!events[0]!.major||!r.input.calendarAvailable)fail('EVENT_EVIDENCE');
  const event=events[0]!,entryDate=guidanceLocal(p.decisionAt).date,exitDate=guidanceLocal(p.timeExitAt).date;
  if(event.scheduledAt&&(guidanceLocal(event.scheduledAt).date<event.startDate||guidanceLocal(event.scheduledAt).date>event.endDate))fail('EVENT_TIME_DATE');
  if(d.phase==='PRE_EVENT'){
    if(event.scheduledAt?p.timeExitAt>=event.scheduledAt:exitDate>=event.startDate)fail('PRE_EVENT_EXIT');
  }else{
    if(event.scheduledAt===null)fail('EVENT_TIME_UNKNOWN');
    if(Date.parse(p.decisionAt)-Date.parse(event.scheduledAt!)<=30*60000)fail('POST_EVENT_STABILIZATION');
  }
  const crossings=r.report.events.filter(e=>e.major&&paperEventKey(e)!==d.eventKey&&(e.scheduledAt?e.scheduledAt>=p.decisionAt&&e.scheduledAt<=p.timeExitAt:e.startDate<=exitDate&&e.endDate>=entryDate));
  if(crossings.length)fail('OTHER_MAJOR_EVENT_IN_HOLD');
  return {version:'OPTIONS_PAPER_EVENT_ASSESSMENT_V1',declaredAt:p.createdAt,phase:d.phase,event,
    contract:{id:p.contract.id,symbol:p.contract.symbol,expiry:p.contract.expiry,strike:p.contract.strike,type:p.contract.type},
    decisionAt:p.decisionAt,entryDeadlineAt:p.entryDeadlineAt,timeExitAt:p.timeExitAt,
    hypothesis:d.hypothesis,entryCondition:d.entryCondition,invalidation:d.invalidation,
    guidance:{path:d.reportPath,sha256:context.guidance.sha256,issuedAt:r.recordedAt,assessedAt:r.input.at,captureAt:r.input.captureAt,origin:r.input.captureOrigin,disposition:candidate!.disposition,blockers:candidate!.blockers,olderThan24HoursAtDeclaration:Date.parse(p.createdAt)-Date.parse(r.input.at)>86400000},
    stopLossBps:p.settings.stopLossBps,rewardMultipleMilliR:p.settings.rewardMultipleMilliR,
    hypothesisValidation:'NOT_TESTED',proseConditionsEnforced:false,scheduledTimeIsActualReleaseProof:false,
    limitation:'Only declared timing and copied evidence linkage are checked. The quote-only paper model does not test these qualitative conditions, event causality or a trading edge. Guidance blockers are frozen at issue, not a current entry authorization.',executionAllowed:false};
}
