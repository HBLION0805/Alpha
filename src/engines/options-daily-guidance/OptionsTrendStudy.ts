import type { GuidanceSettings, GuidanceSymbol } from '../../contracts/OptionsDailyGuidance';
import type { EtfResearchBar } from '../../contracts/OptionsEtfSetup';
import { etfMicroUsd } from './OptionsEtfSetup';
import { validateGuidanceSettings, guidanceLocal } from './OptionsDailyGuidance';
import { assessRobinhoodEtfBars } from '../options-robinhood-data/RobinhoodEtfBars';
import { compareRobinhoodEtfBars } from '../options-robinhood-data/RobinhoodEtfBarAudit';
import { paperSession } from '../options-robinhood-data/RobinhoodPaperSession';
import { paperFingerprint } from '../options-paper/OptionsPaperTradingEngine';
import { assessSnapshotQuote, snapshotEntryEconomics, replaySnapshotPaper, snapshotNs,
  type SnapshotFrame, type SnapshotPlan } from '../options-robinhood-data/RobinhoodSnapshotPaper';

export const TREND_RULES_V1 = Object.freeze({
  id: 'ETF_TWO_CLOSE_BREAKOUT_V1', baselineBars: 12, fastBars: 3, rangeBars: 6,
  confirmationBars: 2, bufferBps: 10, chaseBps: 50, volumeRatioBps: 12000,
  entryStartMinute: 640, entryEndMinute: 870, exitBeforeCloseMinutes: 20,
  maximumLatencySeconds: 60, entryWindowSeconds: 300, quantity: 1,
  minDte: 14, maxDte: 45, targetDte: 21, minDeltaBps: 3500, maxDeltaBps: 7000,
  targetDeltaBps: 5000, maximumSpreadCents: 10, maximumSpreadBps: 1000,
  feeBasis: 'ROBINHOOD_REVIEWED_20260910', exitAllowance: 'ONE_TICK',
});
export interface TrendStudy {
  version: 'OPTIONS_TREND_STUDY_V1'; id: string; registeredAt: string;
  dates: string[]; settings: GuidanceSettings; rules: typeof TREND_RULES_V1;
}
export interface TrendEvidence {
  at: string; source: unknown | null; audit: unknown | null;
  frame: SnapshotFrame | null;
}
export interface TrendDayInput { study: TrendStudy; date: string; at: string; events: TrendEvidence[]; }
const fail = (c: string): never => { throw Error('TREND_STUDY_' + c); };
function clock(at: string) {
  if (typeof at !== 'string' || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at) fail('CLOCK');
  return Date.parse(at);
}
const exact = (v: object, keys: string) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join() !== keys.split(',').sort().join()) fail('FIELDS');
};
export function trendNyClock(date: string, minute: number) {
  if (!/^2026-\d\d-\d\d$/.test(date) || new Date(date + 'T12:00:00Z').toISOString().slice(0,10) !== date) fail('CALENDAR');
  const anchor = date + 'T12:00:00.000Z';
  return new Date(clock(anchor) + (minute - guidanceLocal(anchor).minute) * 60000).toISOString();
}
export function futureTrendDates(at: string, count = 20) {
  clock(at); const dates: string[] = [];
  for (let i = 0; i < 60 && dates.length < count; i++) {
    const date = new Date(Date.parse(guidanceLocal(at).date + 'T12:00:00Z') + i * 86400000).toISOString().slice(0,10);
    const open = trendNyClock(date,570), session = paperSession(open,undefined);
    if (session.isOpen && open > at) dates.push(date);
  }
  if (dates.length !== count) fail('CALENDAR');
  return dates;
}
export function validateTrendStudy(s: TrendStudy) {
  exact(s,'version,id,registeredAt,dates,settings,rules'); clock(s.registeredAt);
  if (s.version !== 'OPTIONS_TREND_STUDY_V1' || !/^[a-z0-9][a-z0-9-]{2,59}$/.test(s.id)) fail('REGISTRATION');
  if (paperFingerprint(s.rules) !== paperFingerprint(TREND_RULES_V1)) fail('RULE_VERSION');
  if (paperFingerprint(s.dates) !== paperFingerprint(futureTrendDates(s.registeredAt))) fail('PROSPECTIVE_DATES');
  validateGuidanceSettings(s.settings);
  if (s.settings.tradeBudget?.version !== 'OWNER_ALLOCATION_ONLY_V2') fail('ALLOCATION');
  return s;
}
const price = (n: bigint) => `${n/1000000n}.${(n%1000000n).toString().padStart(6,'0')}`;
const sum = (a: bigint[]) => a.reduce((x,y)=>x+y,0n);
const numericBar = (b: EtfResearchBar) => [b.start,b.end,b.open,b.high,b.low,b.close,b.volume].join('|');

/** Shared V1 clock boundaries; the 70-minute early-close reserve is frozen V1 behavior. */
export function trendObservationWindow(study: TrendStudy, date: string) {
  const rules=study.rules, session=paperSession(trendNyClock(date,570),undefined);
  return {openingAt:trendNyClock(date,570), baselineEndAt:trendNyClock(date,630),
    startAt:trendNyClock(date,rules.entryStartMinute),
    endAt:trendNyClock(date,Math.min(rules.entryEndMinute,session.closeMinute-70)),
    timeExitAt:trendNyClock(date,session.closeMinute-rules.exitBeforeCloseMinutes),
    intervalSeconds:300, maximumLatencySeconds:rules.maximumLatencySeconds,
    entryWindowSeconds:rules.entryWindowSeconds};
}

function signalFrom(bars: EtfResearchBar[], date: string, baseline: EtfResearchBar[]) {
  const closes = baseline.map(b=>etfMicroUsd(b.close)), slow=sum(closes), fast=sum(closes.slice(-3));
  const direction=fast*12n>slow*3n&&closes[11]!*3n>fast?'BULLISH':fast*12n<slow*3n&&closes[11]!*3n<fast?'BEARISH':null;
  const range=baseline.slice(-6), high=range.reduce((v,b)=>etfMicroUsd(b.high)>v?etfMicroUsd(b.high):v,0n);
  const low=range.reduce((v,b)=>etfMicroUsd(b.low)<v?etfMicroUsd(b.low):v,etfMicroUsd(range[0]!.low));
  const upper=(high*10010n+9999n)/10000n,lower=low*9990n/10000n;
  const volume=sum(baseline.map(b=>BigInt(b.volume)));
  const summary={direction,fastMean:price(fast/3n),slowMean:price(slow/12n),high:price(high),low:price(low),upperTrigger:price(upper),lowerTrigger:price(lower)};
  if(!direction||!volume)return {summary,signal:null};
  const active=bars.filter(b=>b.start>=trendNyClock(date,630));
  const end=Math.min(870,paperSession(trendNyClock(date,570),undefined).closeMinute-70);
  for(let j=1;j<active.length;j++){
    const a=active[j-1]!,b=active[j]!,minute=guidanceLocal(b.end).minute;
    if(minute<640||minute>end||a.end!==b.start)continue;
    const values=[etfMicroUsd(a.close),etfMicroUsd(b.close)];
    const outside=direction==='BULLISH'?values.every(v=>v>upper):values.every(v=>v<lower);
    const chase=direction==='BULLISH'?values.every(v=>v*10000n<=upper*10050n):values.every(v=>v*10000n>=lower*9950n);
    if(outside&&chase&&BigInt(b.volume)*12n*10000n>=volume*12000n)
      return {summary,signal:{at:b.end,side:direction,close:b.close,rangeLow:price(low),rangeHigh:price(high)}};
  }
  return {summary,signal:null};
}

function contractRows(study: TrendStudy, symbol: GuidanceSymbol, side: string, signalAt: string, event: TrendEvidence, date: string) {
  const f=event.frame;
  return (f?.quotes??[]).filter(q=>q.symbol===symbol).map(q=>{
    const blockers=[...assessSnapshotQuote(q,event.at,true,true).blockers];
    const age=q.updatedAt?clock(event.at)-Date.parse(q.updatedAt):Infinity;
    const dte=(Date.parse(q.expiry)-Date.parse(date))/86400000, delta=q.delta===null?null:Math.abs(Math.round(q.delta*10000));
    const spread=q.askCents===null||q.bidCents===null?null:q.askCents-q.bidCents;
    if(q.type!==(side==='BULLISH'?'call':'put'))blockers.push('OPPOSITE_SIDE');
    if(dte<14||dte>45||!Number.isInteger(dte))blockers.push('DTE_OUTSIDE_14_45');
    if(delta===null||!Number.isFinite(delta)||delta<3500||delta>7000||q.type==='call'&&q.delta!<0||q.type==='put'&&q.delta!>0)blockers.push('DELTA_OUTSIDE_RULE');
    if(spread===null||spread<0||spread>10||spread*10000>q.askCents!*1000)blockers.push('SPREAD_EXCEEDED');
    if(q.bidCents===null||q.bidCents<=0||q.bidSize===null||q.bidSize<1||q.askSize===null||q.askSize<1)blockers.push('EXECUTABLE_SIDES_MISSING');
    if(age<0||age>60000||q.receivedAt>event.at||!q.updatedAt||snapshotNs(q.updatedAt)<snapshotNs(signalAt))blockers.push('QUOTE_NOT_CURRENT_AFTER_SIGNAL');
    const tick=q.askCents!==null&&q.cutoffCents!==null?(q.askCents>=q.cutoffCents?q.aboveTickCents:q.belowTickCents):null;
    const plan:SnapshotPlan={version:'OPTIONS_SNAPSHOT_PAPER_PLAN_V3',id:`${study.id}-${symbol.toLowerCase()}-${date.replaceAll('-','')}`,createdAt:event.at,
      contract:q,selectionPath:f!.path,decisionAt:event.at,entryDeadlineAt:new Date(clock(event.at)+300000).toISOString(),timeExitAt:trendNyClock(date,paperSession(trendNyClock(date,570),undefined).closeMinute-20),
      quantity:1,entryLimitCents:q.askCents??1,entryFeeCents:null,exitFeeCents:null,exitSlippageCents:tick,maxSpreadCents:Math.min(10,Math.floor((q.askCents??0)/10)),settings:study.settings,feeBasis:'ROBINHOOD_REVIEWED_20260910'};
    if(tick===null||tick<=0)blockers.push('EXIT_TICK_UNKNOWN');
    if(q.askCents!==null&&q.askCents>0&&tick!==null&&tick>0){
      const economics=snapshotEntryEconomics(plan,q);
      blockers.push(...economics.result.blockers.map(b=>b.code));
      if(economics.result.economics?.indicativeExitLimitPerShareCents==null)blockers.push('NET_TARGET_UNKNOWN');
    }else blockers.push('COST_PREVIEW_UNAVAILABLE');
    return {contract:q,blockers:[...new Set(blockers)],dte,deltaDistance:delta===null?null:Math.abs(delta-5000),spreadCents:spread,plan};
  }).sort((a,b)=>Number(a.blockers.length>0)-Number(b.blockers.length>0)||(a.deltaDistance??Infinity)-(b.deltaDistance??Infinity)||Math.abs(a.dte-21)-Math.abs(b.dte-21)||(a.spreadCents??Infinity)-(b.spreadCents??Infinity)||a.contract.id.localeCompare(b.contract.id));
}

/** Replay actual observation decisions, never late historical entry opportunities. */
export function assessTrendDay(input: TrendDayInput) {
  exact(input,'study,date,at,events');const s=validateTrendStudy(input.study);clock(input.at);
  if(!s.dates.includes(input.date)||input.at<s.registeredAt||!Array.isArray(input.events)||input.events.length>200)fail('DAY');
  let previous=s.registeredAt;
  for(const e of input.events){
    exact(e,'at,source,audit,frame');clock(e.at);
    if(e.at<previous||e.at>input.at||guidanceLocal(e.at).date<input.date)fail('EVENT_ORDER');
    previous=e.at;
    if(e.frame){
      if(e.frame.recordedAt>e.at||e.frame.capturedAt>e.frame.recordedAt||e.frame.origin!=='HOST_MARKET_TOOL_RESPONSES'&&e.frame.origin!=='SYNTHETIC_FIXTURE')fail('FRAME_CLOCK');
      if(new Set(e.frame.quotes.map(q=>q.id)).size!==e.frame.quotes.length)fail('DUPLICATE_QUOTE');
    }
  }
  const sourceReports=input.events.map(e=>e.source?assessRobinhoodEtfBars(e.source,e.at):null);
  const audits=input.events.map(e=>e.audit?compareRobinhoodEtfBars(e.audit,e.at):null);
  const frames:SnapshotFrame[]=[];
  for(const e of input.events)if(e.frame){const prior=frames.find(f=>f.path===e.frame!.path);if(prior&&paperFingerprint(prior)!==paperFingerprint(e.frame))fail('FRAME_CONFLICT');if(!prior)frames.push(e.frame);}
  const window=trendObservationWindow(s,input.date),end=window.endAt,exitAt=window.timeExitAt;
  const assets=(['GLD','IBIT'] as const).map(symbol=>{
    let baseline:EtfResearchBar[]|null=null,baselineAt:string|null=null,summary:ReturnType<typeof signalFrom>['summary']|null=null;
    let decision:{at:string;signal:NonNullable<ReturnType<typeof signalFrom>['signal']>;blockers:string[];candidates:ReturnType<typeof contractRows>;plan:SnapshotPlan|null}|null=null;
    const checks:Array<{at:string;status:string;codes:string[];sourceReceivedAt:string|null}>=[], seenBars=new Map<string,string>();
    const conflicts=new Set<string>();let latestSource:string|null=null,latestBar:string|null=null,rangeFailureAt:string|null=null;
    for(const [i,e] of input.events.entries()){
      const report=sourceReports[i],a=report?.assets.find(v=>v.symbol===symbol);
      const codes:string[]=[];
      if(!a||guidanceLocal(a.windowStart).date!==input.date){checks.push({at:e.at,status:'DATA_MISSING',codes:['SESSION_ETF_BARS_MISSING'],sourceReceivedAt:null});continue;}
      latestSource=a.receivedAt;latestBar=a.windowEnd;
      const structural=a.blockers.filter(c=>c!=='INTERPOLATION_UNKNOWN');
      if(a.windowStart!==trendNyClock(input.date,570))structural.push('OPENING_TO_CURRENT_WINDOW_REQUIRED');
      if(structural.length){checks.push({at:e.at,status:'QUALITY_BLOCKED',codes:structural,sourceReceivedAt:a.receivedAt});continue;}
      const bars=a.rows.flatMap(r=>r.bar?[r.bar]:[]);
      for(const b of bars){const saved=seenBars.get(b.start),value=numericBar(b);if(saved&&saved!==value)conflicts.add(b.start);if(!saved)seenBars.set(b.start,value);}
      const audit=audits[i]?.assets.find(v=>v.symbol===symbol);
      if(audit&&paperFingerprint((e.audit as {fiveMinuteCapture:unknown}).fiveMinuteCapture)===paperFingerprint(e.source))for(const r of audit.rows)if(r.status==='DIFFERENT')conflicts.add(r.start);
      if(!baseline){const b=bars.filter(b=>b.start>=trendNyClock(input.date,570)&&b.end<=trendNyClock(input.date,630));if(b.length===12){baseline=structuredClone(b);baselineAt=e.at;}}
      if(!baseline){checks.push({at:e.at,status:'WAITING_FOR_BASELINE',codes:['COMPLETE_OPENING_HOUR_MISSING'],sourceReceivedAt:a.receivedAt});continue;}
      const result=signalFrom(bars,input.date,baseline);summary=result.summary;
      if(a.unknownInterpolation||baseline.some(b=>b.interpolated!==false))codes.push('INTERPOLATION_UNKNOWN');
      if(conflicts.size)codes.push('SOURCE_REVISIONS_OR_AUDIT_CONFLICT');
      if(clock(e.at)-clock(a.receivedAt)>60000||clock(e.at)-clock(a.windowEnd)>60000)codes.push('ETF_OBSERVATION_LATE');
      if(decision){
        const after=bars.filter(b=>b.end>decision!.signal.at);
        const bad=after.find(b=>decision!.signal.side==='BULLISH'?etfMicroUsd(b.close)<=etfMicroUsd(decision!.signal.rangeHigh):etfMicroUsd(b.close)>=etfMicroUsd(decision!.signal.rangeLow));
        rangeFailureAt??=bad?.end??null;
      }else if(result.signal){
        if(clock(e.at)-clock(result.signal.at)>60000||e.at>end)codes.push('FIRST_SIGNAL_WINDOW_MISSED');
        const candidates=contractRows(s,symbol,result.signal.side,result.signal.at,e,input.date);
        const selected=candidates.find(c=>!c.blockers.length);
        if(!selected)codes.push('NO_ELIGIBLE_SAMPLED_CONTRACT');
        decision={at:e.at,signal:result.signal,blockers:[...new Set(codes)],candidates,plan:codes.length?null:selected!.plan};
      }
      checks.push({at:e.at,status:decision?(decision.plan?'PAPER_PLAN_FROZEN':'FIRST_SIGNAL_BLOCKED'):codes.length?'QUALITY_BLOCKED':'NO_TRIGGER',codes,sourceReceivedAt:a.receivedAt});
    }
    const paper=decision?.plan?replaySnapshotPaper(decision.plan,frames,input.at):null;
    const fills=paper?.fills??[],entry=fills.find(f=>f.kind==='ENTRY'),closed=fills.some(f=>f.kind==='EXIT');
    const q=decision?.plan?frames.flatMap(f=>f.quotes).filter(q=>q.id===decision!.plan!.contract.id&&q.receivedAt<=input.at).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt))[0]:null;
    const stale=q?.updatedAt?clock(input.at)-Date.parse(q.updatedAt)>60000:true;
    const unusable=q?assessSnapshotQuote(q,input.at,true,true).blockers.length>0:true;
    const monitor={lastQuoteAt:q?.updatedAt??null,lastReceiptAt:q?.receivedAt??null,
      unusableWhileOpen:!!entry&&!closed&&unusable,
      staleWhileOpen:!!entry&&!closed&&stale,overdueTimeExit:!!entry&&!closed&&input.at>=exitAt,
      pathGap:paper?.quoteGapObserved??false,rangeFailureAt,automaticOrder:false};
    const status=closed?'CLOSED_MODELED':entry?'OPEN_UNRESOLVED':decision?.plan?(input.at<=decision.plan.entryDeadlineAt?'AWAITING_LATER_ENTRY_QUOTE':'NO_ENTRY'):decision?'SIGNAL_BLOCKED':input.at>end?(baseline?'NO_ENTRY':'DATA_MISSING'):input.at<trendNyClock(input.date,570)?'AWAITING_SESSION':'OBSERVING';
    const lessons=[...new Set([...checks.flatMap(c=>c.codes),...(paper?.candidateLessons??[]).map(l=>l.code),...(paper?.review?.candidateLessons??[]).map(l=>l.code),...(monitor.staleWhileOpen?['EXIT_MONITOR_STALE']:[]),...(monitor.unusableWhileOpen?['EXIT_QUOTE_UNUSABLE']:[]),...(monitor.overdueTimeExit?['TIME_EXIT_UNRESOLVED']:[]),...(monitor.pathGap?['UNOBSERVED_QUOTE_PATH']:[]),...(rangeFailureAt?['ETF_RETURNED_INSIDE_RANGE']:[])])].map(code=>({code,approvedKnowledge:false,causalStatus:'NOT_ESTABLISHED'}));
    return {symbol,status,baselineAt,baseline:summary,decision,checks,conflictingBars:[...conflicts].sort(),latestSource,latestBar,paper,monitor,lessons};
  });
  return {version:'OPTIONS_TREND_DAY_V1',studyId:s.id,date:input.date,assessedAt:input.at,assets,
    counts:{signals:assets.filter(a=>a.decision).length,entries:assets.filter(a=>a.paper?.fills.some(f=>f.kind==='ENTRY')).length,closed:assets.filter(a=>a.status==='CLOSED_MODELED').length},
    outcomeMeaning:'Independent one-contract paper scenarios with estimated fees; not a funded portfolio, qualified execution or causal proof.',
    collectionGap:'Current saved-source schedule does not guarantee five-minute ETF observations or minute-by-minute option exits. Missing windows stay missing.',
    sourceQualified:false,strategyValidated:false,winProbability:null,executionAllowed:false};
}

/** Read-only current diagnostics. Never serialized into, or substituted for, frozen V1 reports. */
export function trendObservationDiagnostics(input: TrendDayInput, at=input.at) {
  if(clock(at)<clock(input.at))fail('CLOCK_REGRESSION');
  const report=assessTrendDay({...input,at}),window=trendObservationWindow(input.study,input.date);
  const slots:string[]=[];
  for(let t=clock(window.startAt);t<=clock(window.endAt);t+=window.intervalSeconds*1000)slots.push(new Date(t).toISOString());
  const due=slots.filter(t=>t<=at), elapsed=at>window.endAt;
  const sources=input.events.map(e=>e.source?assessRobinhoodEtfBars(e.source,e.at):null);
  const assets=report.assets.map(a=>{
    const timely=new Set<string>();
    for(const [i,e] of input.events.entries()){
      const source=sources[i]?.assets.find(v=>v.symbol===a.symbol),check=a.checks[i];
      // A later full-day download cannot fill earlier receipt windows. Unknowns and
      // accumulated revisions stay disqualifying even when later snapshots look clean.
      if(source&&check&&!check.codes.length&&slots.includes(source.windowEnd)&&
          clock(e.at)>=clock(source.windowEnd)&&clock(e.at)-clock(source.windowEnd)<=window.maximumLatencySeconds*1000)
        timely.add(source.windowEnd);
    }
    const missing=due.filter(t=>!timely.has(t));
    const complete=elapsed&&missing.length===0&&due.length===slots.length;
    const plan=a.decision?.plan,entry=a.paper?.fills.find(f=>f.kind==='ENTRY'),exit=a.paper?.fills.find(f=>f.kind==='EXIT');
    const accepted=(a.paper?.diagnostics??[]).filter(d=>entry&&d.codes.length===0&&d.sourceAt&&
      snapshotNs(d.receivedAt)>snapshotNs(entry.receivedAt)&&snapshotNs(d.sourceAt)>snapshotNs(entry.sourceAt));
    const independent=accepted.at(-1)??null,latestDiagnostic=a.paper?.diagnostics.at(-1);
    const quoteStale=!!entry&&!exit&&snapshotNs(at)-snapshotNs(independent?.sourceAt??entry.sourceAt)>BigInt(window.maximumLatencySeconds)*1000000000n;
    const quoteRejected=!!entry&&!exit&&!!latestDiagnostic&&latestDiagnostic.receivedAt>entry.receivedAt&&latestDiagnostic.codes.length>0;
    const classification=exit?'CLOSED_MODELED':entry?'OPEN_UNRESOLVED':plan?(at<=plan.entryDeadlineAt?'AWAITING_LATER_ENTRY_QUOTE':'ENTRY_NOT_OBSERVED'):a.decision?'SIGNAL_BLOCKED':at<window.startAt?'AWAITING_OBSERVATION_WINDOW':!elapsed?'OBSERVING':complete?'FULLY_OBSERVED_NO_SIGNAL':'INSUFFICIENT_OBSERVATION';
    const dueExit=!!entry&&at>=window.timeExitAt;
    const lateExitSeconds=exit?Math.max(0,(clock(exit.receivedAt)-clock(window.timeExitAt))/1000):null;
    return {symbol:a.symbol,classification,coverage:{required:slots.length,due:due.length,timely:due.length-missing.length,missing,complete,
        lastSourceReceiptAt:a.latestSource,lastBarEndAt:a.latestBar,qualityCodes:[...new Set(a.checks.flatMap(c=>c.codes))]},
      exit:{entryAt:entry?.receivedAt??null,plannedAt:window.timeExitAt,latestSelectedQuoteAt:a.monitor.lastQuoteAt,
        independentQuoteAt:independent?.sourceAt??null,independentReceiptAt:independent?.receivedAt??null,
        latestRejectionCodes:latestDiagnostic?.codes??[],monitoringInterrupted:quoteStale||quoteRejected||a.monitor.unusableWhileOpen,
        timeExitDue:dueExit,overdueUnresolved:dueExit&&!exit,modeledExitAt:exit?.receivedAt??null,modeledExitSourceAt:exit?.sourceAt??null,
        reason:exit?.reason??null,lateExitSeconds,pathUnknown:a.monitor.pathGap,
        netPnlCents:a.paper?.account.netPnlCents??null,actualFeesKnown:false},
      entryDeadlineAt:plan?.entryDeadlineAt??null,
      candidates:(a.decision?.candidates??[]).map((c,index)=>{
        const economics=c.blockers.length?null:snapshotEntryEconomics(c.plan,c.contract);
        return {id:c.contract.id,rank:index+1,screening:c.blockers.length?'REJECTED':'PASSED_FILTERS',selected:plan?.contract.id===c.contract.id,
          quoteAgeSeconds:c.contract.updatedAt?(clock(a.decision!.at)-Date.parse(c.contract.updatedAt))/1000:null,
          premiumAtAskCents:c.contract.askCents===null?null:c.contract.askCents*input.study.rules.quantity*c.contract.multiplier,
          entryFeeEstimateCents:economics?.entryFeeCents??null,exitFeeReserveEstimateCents:economics?.exitFeeReserveCents??null,
          exitAllowancePerShareCents:c.plan.exitSlippageCents,preExpiryScenario:'NOT_ASSESSED',strategyBenefit:'NOT_ESTABLISHED'};
      })};
  });
  return {assessedAt:at,recordedAt:input.at,window,assets,sourceReads:0,executionAllowed:false};
}
