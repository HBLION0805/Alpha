import type { GuidanceEvent } from '../../contracts/OptionsDailyGuidance';
import { guidanceLocal } from '../options-daily-guidance/OptionsGuidanceClock';
import { guidanceFixedMinutes, GUIDANCE_EVENT_MINUTES, isGuidanceMajorEvent } from '../options-daily-guidance/OptionsGuidanceSchedule';
import { snapshotNs, validateSnapshotPlan, type SnapshotPlan } from './RobinhoodSnapshotPaper';
import { paperSession } from './RobinhoodPaperSession';

export interface PaperCollectionCalendar {
  state:'AVAILABLE'|'STALE'|'UNAVAILABLE';
  sources:{id:string;state:string;receivedAt:string|null;refreshOverdue:boolean|null}[];
  events:GuidanceEvent[];
}
const instant=(date:string,minute:number)=>{
  const noon=date+'T12:00:00.000Z';
  return new Date(Date.parse(noon)+(minute-guidanceLocal(noon).minute)*60000).toISOString();
};
const localTime=(minute:number)=>String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');

/** Nominal capture planning only; no source calls, enrollment or fill inference. */
export function assessPaperCollectionPlan(plan:SnapshotPlan,at:string,calendar:PaperCollectionCalendar) {
  const p=validateSnapshotPlan(plan),now=snapshotNs(at),start=snapshotNs(p.decisionAt),deadline=snapshotNs(p.entryDeadlineAt),exit=snapshotNs(p.timeExitAt);
  if(!calendar||!['AVAILABLE','STALE','UNAVAILABLE'].includes(calendar.state)||!Array.isArray(calendar.events)||calendar.events.length>100)throw Error('SNAPSHOT_PAPER_COLLECTION_CALENDAR');
  const session=paperSession(p.decisionAt,p.contract.chainSession),date=session.date;
  const events=calendar.events.filter(e=>{
    snapshotNs(e.startDate+'T00:00:00Z');snapshotNs(e.endDate+'T00:00:00Z');
    if(e.endDate<e.startDate)throw Error('SNAPSHOT_PAPER_COLLECTION_CALENDAR');
    return isGuidanceMajorEvent(e)&&e.startDate<=date&&date<=e.endDate;
  });
  const eventState=calendar.state!=='AVAILABLE'?'UNCONFIRMED':events.length?'LISTED_EVENT_DAY':'NO_LISTED_MAJOR_EVENT';
  const fixed=guidanceFixedMinutes(date),minutes=[...new Set([...fixed,...GUIDANCE_EVENT_MINUTES])].sort((a,b)=>a-b);
  const wakes=minutes.filter(m=>session.knownYear&&!session.holiday&&m<session.closeMinute&&m>=570).map(minute=>{
    const wakeAt=instant(date,minute),clock=snapshotNs(wakeAt),routine=fixed.includes(minute);
    const basis=routine?'ROUTINE':eventState==='LISTED_EVENT_DAY'?'EVENT_CONDITIONAL':eventState==='UNCONFIRMED'?'EVENT_UNCONFIRMED':'EVENT_NOT_LISTED';
    return {wakeAt,localTime:localTime(minute),basis,entryWake:clock>start&&clock<=deadline,timeExitWake:clock>=exit,
      atDecisionBoundary:clock===start,alreadyPassed:clock<=now};
  });
  const usable=wakes.filter(w=>['ROUTINE','EVENT_CONDITIONAL'].includes(w.basis));
  const entry=usable.filter(w=>w.entryWake),exits=usable.filter(w=>w.timeExitWake);
  // Two independent observations are required; a single wake cannot count twice.
  const pairs=entry.flatMap(a=>exits.filter(b=>b.wakeAt>a.wakeAt).map(b=>({entry:a,exit:b,conditional:a.basis!=='ROUTINE'||b.basis!=='ROUTINE'})));
  const pair=pairs.find(p=>!p.conditional)??pairs[0]??null;
  const gaps=[];
  if(!entry.length)gaps.push('NO_NOMINAL_ENTRY_WAKE');
  if(!exits.length)gaps.push('NO_NOMINAL_TIME_EXIT_WAKE');
  if(!pair)gaps.push('NO_DISTINCT_WAKE_PAIR');
  if(eventState==='UNCONFIRMED')gaps.push('EVENT_CALENDAR_UNCONFIRMED');
  if(wakes.some(w=>w.atDecisionBoundary))gaps.push('DECISION_AT_WAKE_BOUNDARY');
  const status=!session.knownYear?'SESSION_UNREVIEWED':session.holiday?'SESSION_CLOSED':now>=start?'ENROLLMENT_WINDOW_PASSED':pair?(pair.conditional?'CONDITIONAL_PAIR':'ROUTINE_PAIR'):'SCHEDULE_GAP';
  return {version:'OPTIONS_PAPER_COLLECTION_PLAN_V1',assessedAt:at,planId:p.id,planDate:date,status,
    comparisonBasis:'CURRENT_SAVED_CALENDAR_AND_DATED_SCHEDULE',enrollmentWindowOpen:now<start,
    sessionCloseAt:instant(date,session.closeMinute),sessionCloseLocal:session.closeLocal,
    decisionAt:p.decisionAt,entryDeadlineAt:p.entryDeadlineAt,timeExitAt:p.timeExitAt,
    calendar:{...calendar,events},eventState,wakes,pair,gaps,
    limitation:'Nominal Host wakes are planning references, not promised receipts. Event reads require the same-day condition at execution. Contract tracking, current quotes and declared costs remain separate. Sparse observations can miss stops or targets. The 16:20 full-chain study is not a paper-adapter source. A later calendar cannot prove why a past window was missed.',
    sourceReads:0,scheduleChanged:false,executionAllowed:false};
}
