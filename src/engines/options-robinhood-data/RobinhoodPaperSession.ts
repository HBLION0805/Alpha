import { guidanceLocal } from '../options-daily-guidance/OptionsGuidanceClock';

export interface PaperChainSession {
  chainId:string|null;
  lateCloseState:'enabled'|'disabled'|'unknown';
  receivedAt:string|null;
}
export const PAPER_SESSION_CALENDAR = Object.freeze({
  id:'NYSE_OPTIONS_SESSION_2026_REVIEWED_20260910',
  reviewedDate:'2026-09-10',
  source:'https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/default.aspx',
  brokerSource:'https://robinhood.com/us/en/support/articles/options-trading-hours/',
});
const HOLIDAYS = new Set(['2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25']);
const EARLY = new Set(['2026-11-27','2026-12-24']);

/** Observed chain flag + reviewed calendar; no halt, order or account inference. */
export function paperSession(at:string,chain:PaperChainSession|undefined) {
  const local=guidanceLocal(at),knownYear=local.date.startsWith('2026-');
  const holiday=HOLIDAYS.has(local.date)||['Sat','Sun'].includes(local.weekday!);
  const late=chain?.lateCloseState==='enabled'&&chain.chainId!==null&&chain.receivedAt!==null;
  const closeMinute=(EARLY.has(local.date)?780:960)+(late?15:0);
  const closeLocal=`${String(Math.floor(closeMinute/60)).padStart(2,'0')}:${String(closeMinute%60).padStart(2,'0')}`;
  return {calendarId:PAPER_SESSION_CALENDAR.id,date:local.date,knownYear,holiday,
    closeMinute,closeLocal,earlyClose:EARLY.has(local.date),lateCloseApplied:late,
    chainState:chain?.lateCloseState??'unknown',chainEvidence:chain??null,
    isOpen:knownYear&&!holiday&&local.minute>=570&&local.minute<closeMinute,
    limitation:'Scheduled session model; halts and contract-specific restrictions are not verified.'};
}
