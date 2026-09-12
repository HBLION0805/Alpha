import type { GuidanceInput } from '../../contracts/OptionsDailyGuidance';
import { guidanceLocal } from './OptionsGuidanceClock';
import { paperSession } from '../options-robinhood-data/RobinhoodPaperSession';
import { paperFingerprint } from '../options-paper/OptionsPaperTradingEngine';

export interface DeliveryCapture {
  path:string; startedAt:string; capturedAt:string; recordedAt:string;
  origin:string; complete:boolean; requested:number; returned:number;
}
export interface DeliveryClaim {slot:string; startedAt:string; path:string}
export interface DeliveryPublication {path:string; issuedAt:string; assessedAt:string; marketFingerprint:string}
const MINUTES=[590,770,950], ACTIVATED='2026-09-08';
const fail=()=>{throw Error('GUIDANCE_DELIVERY_INPUT');};
function instant(date:string,minute:number){
  const noon=date+'T12:00:00.000Z',local=guidanceLocal(noon);
  return new Date(Date.parse(noon)+(minute-local.minute)*60000).toISOString();
}
const shift=(date:string,days:number)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
export function guidanceMarketFingerprint(i:GuidanceInput){
  return paperFingerprint({captureAt:i.captureAt,captureOrigin:i.captureOrigin,captureComplete:i.captureComplete,quotes:i.quotes,equities:i.equities});
}
/** Saved delivery diagnostics only; the daily engine remains the trading gate. */
export function assessGuidanceDelivery(input:GuidanceInput,captures:DeliveryCapture[],claims:DeliveryClaim[],publication:DeliveryPublication|null){
  const local=guidanceLocal(input.at),now=Date.parse(input.at);
  if(captures.length>1000||claims.length>1000)fail();
  for(const c of captures){for(const t of [c.startedAt,c.capturedAt,c.recordedAt])guidanceLocal(t);if(c.startedAt>c.capturedAt||c.capturedAt>c.recordedAt||!Number.isInteger(c.requested)||c.requested<0||c.requested>36||!Number.isInteger(c.returned)||c.returned<0||c.returned>c.requested)fail();}
  for(const c of claims){guidanceLocal(c.startedAt);if(!/^\d{4}-\d\d-\d\d-\d{4}$/.test(c.slot)||Number(c.slot.slice(-4,-2))>23||Number(c.slot.slice(-2))>59)fail();guidanceLocal(c.slot.slice(0,10)+'T12:00:00.000Z');}
  if(publication){guidanceLocal(publication.issuedAt);guidanceLocal(publication.assessedAt);if(publication.assessedAt>publication.issuedAt||publication.issuedAt>input.at)fail();}
  const eligible=captures.filter(c=>c.origin==='HOST_MARKET_TOOL_RESPONSES'&&c.recordedAt<=input.at);
  const slots=[];
  for(let back=6;back>=0;back--){
    const date=shift(local.date,-back);if(date<ACTIVATED)continue;
    const session=paperSession(instant(date,600),undefined);
    for(const minute of MINUTES){
      const startAt=instant(date,minute),endAt=instant(date,minute+10),slot=date+'-'+String(Math.floor(minute/60)).padStart(2,'0')+String(minute%60).padStart(2,'0');
      if(session.knownYear&&(session.holiday||minute>=session.closeMinute))continue;
      const found=eligible.filter(c=>c.startedAt>=startAt&&c.startedAt<endAt).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)||a.path.localeCompare(b.path)),capture=found.at(-1)??null;
      const claim=claims.find(c=>c.slot===slot&&c.startedAt<=input.at)??null;
      const status=!session.knownYear?'CALENDAR_UNKNOWN':capture?(capture.complete?'CAPTURE_RECORDED':'PARTIAL_CAPTURE_RECORDED'):input.at<startAt?'NOT_DUE':input.at<endAt?'WINDOW_OPEN':claim?'CLAIM_WITHOUT_CAPTURE':'NO_CAPTURE_SAVED';
      slots.push({slot,date,startAt,endAt,status,claim,capture,captureCount:found.length});
    }
  }
  let nextExpectedSlot:{startAt:string;endAt:string}|null=null;
  for(let forward=0;forward<8&&!nextExpectedSlot;forward++){
    const date=shift(local.date,forward),s=paperSession(instant(date,600),undefined);if(date<ACTIVATED||!s.knownYear||s.holiday)continue;
    for(const m of MINUTES){const startAt=instant(date,m);if(m<s.closeMinute&&startAt>input.at){nextExpectedSlot={startAt,endAt:instant(date,m+10)};break;}}
  }
  const assets=input.equities.map(e=>({symbol:e.symbol,sourceAt:e.sourceAt}));
  const clocks=(t:string|null)=>t===null||!Number.isFinite(Date.parse(t))?'UNKNOWN':now-Date.parse(t)<0?'FUTURE':now-Date.parse(t)>120000?'STALE':'FRESH';
  const quoteClocks=(['GLD','IBIT'] as const).map(symbol=>{const qs=input.quotes.filter(q=>q.symbol===symbol);return {symbol,requested:qs.length,withSourceClock:qs.filter(q=>q.updatedAt!==null).length,fresh:qs.filter(q=>clocks(q.updatedAt)==='FRESH').length,stale:qs.filter(q=>clocks(q.updatedAt)==='STALE').length,unknown:qs.filter(q=>clocks(q.updatedAt)==='UNKNOWN').length,future:qs.filter(q=>clocks(q.updatedAt)==='FUTURE').length,underlyingAt:assets.find(e=>e.symbol===symbol)?.sourceAt??null,underlyingFreshness:clocks(assets.find(e=>e.symbol===symbol)?.sourceAt??null)};});
  const analysis=input.analyst,age=analysis?now-Date.parse(analysis.assessedAt):Infinity;
  const reviewStatus=!analysis||!['GLD','IBIT'].every(s=>analysis.assets.some(a=>a.symbol===s&&a.sources.length))?'MISSING':age<0?'FUTURE':input.captureAt&&analysis.assessedAt<input.captureAt?'PRECEDES_CAPTURE':age>86400000?'STALE':'CURRENT';
  return {version:'OPTIONS_GUIDANCE_DELIVERY_V1',assessedAt:input.at,
    scope:'Three fixed guidance windows only; event-dependent extra reads and full-chain close captures are separate. Captures are associated by time, not proof of scheduled execution.',
    slotMinutesNewYork:MINUTES,lookbackCalendarDays:7,slots,counts:{expectedCompleted:slots.filter(s=>s.endAt<=input.at&&s.status!=='CALENDAR_UNKNOWN').length,recorded:slots.filter(s=>s.endAt<=input.at&&s.status!=='CALENDAR_UNKNOWN'&&s.capture).length,missing:slots.filter(s=>['NO_CAPTURE_SAVED','CLAIM_WITHOUT_CAPTURE'].includes(s.status)).length,partial:slots.filter(s=>s.endAt<=input.at&&s.status==='PARTIAL_CAPTURE_RECORDED').length,calendarUnknown:slots.filter(s=>s.status==='CALENDAR_UNKNOWN').length},nextExpectedSlot,
    latestCapture:captures.find(c=>c.capturedAt===input.captureAt&&c.origin===input.captureOrigin&&c.recordedAt<=input.at)??null,
    quoteClocks,analysis:{assessedAt:analysis?.assessedAt??null,status:reviewStatus,limitation:'Clock ordering and attribution do not establish substantive analysis quality.'},
    publication:publication?{...publication,usesCurrentMarketInputs:publication.marketFingerprint===guidanceMarketFingerprint(input)}:null,
    missingCause:'Not inferred from absent files. Inspect actual Host execution errors; a claim or public refresh is not a market-data receipt.',
    freshnessLimitSeconds:120,sourceReads:0,executionAllowed:false};
}
