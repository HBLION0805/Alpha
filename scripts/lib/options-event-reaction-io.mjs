import {withReleaseCalendarJournal} from './options-release-calendar-io.mjs';
import {withFomcCalendarJournal} from './options-fomc-calendar-io.mjs';
import {reportReleaseCalendar} from '../../src/engines/options-release-calendar/BlsReleaseCalendarEngine.ts';
import {reportFomcCalendar} from '../../src/engines/options-fomc-calendar/FomcCalendarEngine.ts';
import {exchangeLocalDate} from '../../src/engines/market-calendar/MarketCalendarValidation.ts';
import {assessEventReactions} from '../../src/engines/options-daily-guidance/OptionsEventReaction.ts';
import {readGuidanceResearchFrames,readGuidanceReactionNotes} from './options-guidance-io.mjs';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';

// Current verified calendars retain past events that the upcoming-only brief intentionally omits.
export async function eventReactionView(root,at) {
  const sources={},events=[];
  for(const [id,folder,reader,reporter] of [
    ['BLS','options-release-calendar',withReleaseCalendarJournal,reportReleaseCalendar],
    ['FOMC','options-fomc-calendar',withFomcCalendarJournal,reportFomcCalendar]]) {
    try {
      const path=`data/runtime/${folder}/retrievals.ndjson`,before=io.readBytes(root,path,32*1024*1024);
      const report=await reader(root,s=>reporter(s.inputs,at),at);
      if(!io.readBytes(root,path,32*1024*1024).equals(before))throw Error('SOURCE_CHANGED');
      const latest=report.latestRetrieval;
      sources[id]={state:'AVAILABLE',receivedAt:latest?.receivedAt??null,status:latest?.status??'MISSING',refreshOverdue:report.refreshOverdue,error:latest?.errorCode??null};
      if(!latest||latest.status==='FAILED')continue;
      if(id==='BLS') for(const e of latest.events) {
        if(!['CPI','PPI','EMPLOYMENT_SITUATION','JOLTS','EMPLOYMENT_COST_INDEX'].includes(e.family))continue;
        const date=exchangeLocalDate(e.scheduledAt,'America/New_York');
        events.push({key:'BLS:'+e.uid,title:e.title,source:id,startDate:date,endDate:date,scheduledAt:e.scheduledAt,status:e.status,calendarReceivedAt:latest.receivedAt});
      } else for(const e of latest.calendar?.meetings??[])events.push({key:'FOMC:'+e.dateKey,title:'FOMC meeting dates',source:id,
        startDate:e.startDate,endDate:e.endDate,scheduledAt:null,status:e.confirmationStatus,calendarReceivedAt:latest.receivedAt});
    } catch(error) {
      sources[id]={state:error?.code==='ENOENT'?'MISSING':'BLOCKED',receivedAt:null,status:'RECOVERY_UNAVAILABLE',refreshOverdue:null,
        error:error?.code==='ENOENT'?'STORE_MISSING':error?.code==='EEXIST'?'STORE_BUSY':error?.message==='SOURCE_CHANGED'?'SOURCE_CHANGED':'RECOVERY_FAILED'};
    }
  }
  const today=exchangeLocalDate(at,'America/New_York'),shift=n=>new Date(Date.parse(today)+n*86400000).toISOString().slice(0,10);
  const from=shift(-7),through=shift(7),selected=events.filter(e=>e.endDate>=from&&e.startDate<=through)
    .sort((a,b)=>a.startDate.localeCompare(b.startDate)||(a.scheduledAt??'').localeCompare(b.scheduledAt??'')||a.key.localeCompare(b.key));
  if(selected.length>100)throw Error('EVENT_REACTION_EVENT_LIMIT');
  const frames=readGuidanceResearchFrames(root,{includeEquityReceipt:true}),notes=readGuidanceReactionNotes(root);
  return {...assessEventReactions({at,events:selected,frames,notes,origin:'HOST_MARKET_TOOL_RESPONSES'}),sources,fromDate:from,throughDate:through,
    coverage:'Major BLS entries and FOMC dates in the current saved schedules only. Unscheduled news, auctions and non-BLS releases are incomplete. At most 1,000 captures and 240 recent analyst notes; no continuous-price coverage.',
    calendarComplete:false,notesRead:notes.length,framesRead:frames.length};
}
