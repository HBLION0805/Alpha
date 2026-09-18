import type { GuidanceInput } from '../../contracts/OptionsDailyGuidance';
import { assessDailyGuidance } from './OptionsDailyGuidance';
import { etfMicroUsd } from './OptionsEtfSetup';
import { assessRobinhoodEtfBars } from '../options-robinhood-data/RobinhoodEtfBars';
import { compareRobinhoodEtfBars } from '../options-robinhood-data/RobinhoodEtfBarAudit';
import { paperFingerprint } from '../options-paper/OptionsPaperTradingEngine';

export interface EtfObservationInput {
  at: string;
  sourceCapture: unknown | null;
  auditInput: {fiveMinuteCapture: unknown; minuteCapture: unknown} | null;
  guidance: GuidanceInput;
}
const usd = (v: bigint) => `${v / 1000000n}.${(v % 1000000n).toString().padStart(6,'0')}`;
const sum = (v: bigint[]) => v.reduce((n,x)=>n+x,0n);

/** Descriptive research from received prices. Never relaxes the strict setup validator. */
export function assessEtfObservation(input: EtfObservationInput) {
  if (!input || Object.keys(input).sort().join() !== 'at,auditInput,guidance,sourceCapture' ||
      typeof input.at !== 'string' || !Number.isFinite(Date.parse(input.at)) || new Date(input.at).toISOString() !== input.at ||
      input.guidance.at !== input.at) throw Error('ETF_OBSERVATION_INPUT');
  const canonical = assessDailyGuidance(input.guidance);
  const source = input.sourceCapture === null ? null : assessRobinhoodEtfBars(input.sourceCapture,input.at);
  const auditMatches = input.auditInput !== null && input.sourceCapture !== null &&
    paperFingerprint(input.auditInput.fiveMinuteCapture) === paperFingerprint(input.sourceCapture);
  const audit = input.auditInput === null ? null : compareRobinhoodEtfBars(input.auditInput,input.at);
  const assets = canonical.assets.map(original=>{
    const s = source?.assets.find(a=>a.symbol===original.symbol);
    const a = auditMatches ? audit?.assets.find(a=>a.symbol===original.symbol) : null;
    const usable = !!s?.observations;
    const bars = usable ? s!.rows.flatMap(r=>r.bar?[r.bar]:[]) : [];
    const compared = !!a && a.notComparable === 0 && a.comparable === bars.length;
    const auditStatus = !audit ? 'NOT_CHECKED' : !auditMatches ? 'DIFFERENT_SOURCE_CAPTURE' : !compared ? 'NOT_COMPARABLE' : a!.different ? 'DIFFERENCES_RETAINED' : 'NUMERICALLY_MATCHED_UNQUALIFIED';
    const conflicts = compared ? a!.rows.filter(r=>r.status==='DIFFERENT') : [];
    const closeConflict = conflicts.some(r=>r.differences.some(d=>d.field==='close'));
    const trailing = bars.slice(-12), full = trailing.length===12;
    const prices = trailing.map(b=>etfMicroUsd(b.close));
    const fast = sum(prices.slice(-3)), slow = sum(prices), last = prices.at(-1);
    const momentum = !full || closeConflict ? 'NOT_ASSESSABLE' :
      fast*12n>slow*3n && last!*3n>fast ? 'RISING' :
      fast*12n<slow*3n && last!*3n<fast ? 'FALLING' : 'MIXED';
    const recent = bars.slice(-6);
    const rangeConflict = recent.length>0 && conflicts.some(r=>r.start>=recent[0]!.start && r.differences.some(d=>d.field==='high'||d.field==='low'));
    const range = recent.length===6 && !rangeConflict ? {
      start:recent[0]!.start,end:recent.at(-1)!.end,
      high:usd(recent.reduce((v,b)=>etfMicroUsd(b.high)>v?etfMicroUsd(b.high):v,etfMicroUsd(recent[0]!.high))),
      low:usd(recent.reduce((v,b)=>etfMicroUsd(b.low)<v?etfMicroUsd(b.low):v,etfMicroUsd(recent[0]!.low)))
    } : null;
    const limits = ['DESCRIPTIVE_ONLY','STRATEGY_NOT_VALIDATED','FUTURE_CONFIRMATION_REQUIRED'];
    if (!usable) limits.push('STRUCTURAL_SOURCE_UNAVAILABLE');
    if (s?.unknownInterpolation) limits.push('INTERPOLATION_UNKNOWN');
    if (conflicts.length) limits.push('CROSS_INTERVAL_DIFFERENCES_RETAINED');
    if (!compared) limits.push('CROSS_INTERVAL_COMPARISON_UNAVAILABLE');
    if (closeConflict) limits.push('CLOSE_CONFLICT_WITHHOLDS_MOMENTUM');
    if (rangeConflict) limits.push('RANGE_CONFLICT_WITHHOLDS_LEVELS');
    if (s && Date.parse(input.at)-Date.parse(s.windowEnd)>300000) limits.push('HISTORICAL_BAR_WINDOW');
    const scenarios = (['BULLISH','BEARISH'] as const).map(side=>{
      const type = side==='BULLISH'?'call':'put';
      const rows = original.candidates.filter(c=>c.contract.type===type).map(c=>{
        const q = c.contract;
        // These are original mechanical checks, not a new definition of tradability.
        const fitBlockers = c.blockers.filter(b=>['CONTRACT_OUTSIDE_POLICY','DELTA_OUTSIDE_RESEARCH_RANGE','SPREAD_OR_PRICE_UNSUITABLE','QUOTE_SIZE_UNKNOWN_OR_ZERO'].includes(b));
        fitBlockers.push(...c.feasibility.blockers.map(b=>b.code));
        const premiumCents = q.askCents!==null && Number.isSafeInteger(q.askCents) && q.askCents>0 && q.multiplier===100 ? q.askCents*100 : null;
        const deltaDistance = q.delta===null || !Number.isFinite(q.delta) ? null : Math.abs(Math.round(Math.abs(q.delta)*10000)-5000);
        const spread = q.askCents===null || q.bidCents===null ? null : q.askCents-q.bidCents;
        const precedes = !!s && (!q.updatedAt || Date.parse(q.updatedAt)<Date.parse(s.windowEnd));
        const blockers = [...new Set([...c.blockers,...limits,...(precedes?['OPTION_QUOTES_PRECEDE_BAR_WINDOW_END']:[])])];
        return {contract:q,dte:c.dte,premiumCents,deltaDistanceBps:deltaDistance,spreadCents:spread,
          sampleFitBlockers:[...new Set(fitBlockers)],originalBlockers:c.blockers,blockers,plan:c.plan,
          quoteAgeSeconds:c.quoteAgeSeconds,precedesBarWindow:precedes,
          reason:`${side} discussion compares long ${type}s. ${c.dte} calendar DTE; existing 14–45 DTE policy applies. Strike $${q.strike}, delta ${q.delta??'unknown'}; absolute 0.50 is a comparison assumption, not win probability. One contract only; all original checks remain.`};
      }).sort((a,b)=>Number(a.sampleFitBlockers.length>0)-Number(b.sampleFitBlockers.length>0)||
        (a.deltaDistanceBps??Infinity)-(b.deltaDistanceBps??Infinity)||a.dte-b.dte||
        (a.spreadCents??Infinity)-(b.spreadCents??Infinity)||a.contract.id.localeCompare(b.contract.id));
      return {side,status:'UNCONFIRMED_DISCUSSION',condition:range?
        `Only reconsider after two future completed five-minute closes ${side==='BULLISH'?'above $'+range.high:'below $'+range.low}, using fresh regular-session data. A return into this reference range invalidates the idea. This condition has not been tested or triggered.`:
        'A usable trailing reference range is unavailable. Establish levels from fresh, reviewed observations before discussing entry.',
        relationToObservedMomentum:momentum==='NOT_ASSESSABLE'?'UNKNOWN':momentum==='MIXED'?'NO_CLEAR_MOMENTUM':(momentum==='RISING')===(side==='BULLISH')?'ALIGNED_WITH_LATE_WINDOW':'REQUIRES_REVERSAL',
        totalSameSide:rows.length,sampleFitCount:rows.filter(r=>!r.sampleFitBlockers.length).length,
        references:rows.slice(0,3),entryConfirmed:false,entryLimit:null,
        exitNote:'ETF invalidation is not an option stop. The saved premium stop/target below are historical assumptions; costs, current bid/ask and a time exit must be reviewed before any trade.'};
    });
    return {symbol:original.symbol,status:usable?'OBSERVATIONS_AVAILABLE_UNQUALIFIED':'NOT_ASSESSABLE',
      source:s?{requestedAt:s.requestedAt,receivedAt:s.receivedAt,windowStart:s.windowStart,windowEnd:s.windowEnd,unknownInterpolation:s.unknownInterpolation,blockers:s.blockers}:null,
      observations:s?.observations??null,auditStatus,conflictingIntervals:conflicts.map(r=>({start:r.start,fields:r.differences.map(d=>d.field)})),
      candles:bars.map(b=>({...b,conflictFields:conflicts.find(r=>r.start===b.start)?.differences.map(d=>d.field)??[]})),
      momentum:{direction:momentum,fastMean:full&&!closeConflict?usd(fast/3n):null,slowMean:full&&!closeConflict?usd(slow/12n):null,
        meaning:'Trailing 3 versus 12 completed five-minute closes (15/60 minutes). Descriptive, untested, and distinct from open-to-last change or change from the prior close.'},
      referenceRange:range,scenarios,limits,canonicalAction:original.disposition,
      webpageUrl:`https://robinhood.com/us/en/stocks/${original.symbol}/`,sourceQualified:false};
  });
  return {version:'OPTIONS_ETF_OBSERVATION_V1',assessedAt:input.at,marketCapturedAt:input.guidance.captureAt,assets,
    comparisonAssumptions:{fastBars:3,slowBars:12,referenceBars:6,targetAbsoluteDelta:0.5,confirmationBars:2,validated:false},
    executionAllowed:false,changesCanonicalGuidance:false,winProbability:null,expectedReturn:null};
}
