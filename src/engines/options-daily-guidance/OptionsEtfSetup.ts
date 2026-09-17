import type { EtfResearchBars, EtfSetupPlan, EtfSetupAssessmentInput } from '../../contracts/OptionsEtfSetup';
import { assessDailyGuidance } from './OptionsDailyGuidance';
import { guidanceLocal } from './OptionsGuidanceClock';
import { paperSession } from '../options-robinhood-data/RobinhoodPaperSession';

const fail = (code: string): never => { throw Error('ETF_SETUP_' + code); };
function exact(v: object, keys: string) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join() !== keys.split(',').sort().join()) fail('FIELDS');
}
function clock(v: string): number {
  if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v) fail('CLOCK');
  return Date.parse(v);
}
export function etfMicroUsd(v: string): bigint {
  if (typeof v !== 'string' || !/^\d{1,8}(?:\.\d{1,6})?$/.test(v)) fail('PRICE');
  const [whole, fraction = ''] = v.split('.');
  const n = BigInt(whole!) * 1000000n + BigInt(fraction.padEnd(6, '0'));
  if (n <= 0n) fail('PRICE');
  return n;
}
const usd = (n: bigint) => `${n / 1000000n}.${(n % 1000000n).toString().padStart(6, '0')}`;
const sum = (v: bigint[]) => v.reduce((a, b) => a + b, 0n);
function integer(n: number, min: number, max: number) { if (!Number.isSafeInteger(n) || n < min || n > max) fail('PARAMETER'); }
function regularGrid(at: string) {
  const session = paperSession(at, undefined), local = guidanceLocal(at);
  if (!session.knownYear || !session.isOpen || local.minute % 5 || clock(at) % 300000) fail('SESSION_GRID');
  return session;
}
export function validateEtfBars(v: EtfResearchBars, at: string): EtfResearchBars {
  exact(v, 'version,symbol,intervalMinutes,currency,session,adjustment,volumeUnit,source,receivedAt,windowStart,windowEnd,bars');
  if (v.version !== 'OPTIONS_ETF_BARS_V1' || !['GLD','IBIT'].includes(v.symbol) || v.intervalMinutes !== 5 || v.currency !== 'USD' || v.session !== 'REGULAR' || v.adjustment !== 'RAW' || v.volumeUnit !== 'SHARES') fail('BAR_SCOPE');
  if (typeof v.source !== 'string' || !v.source.trim() || v.source.length > 500) fail('SOURCE');
  const receipt = clock(v.receivedAt), assessment = clock(at), start = clock(v.windowStart), end = clock(v.windowEnd);
  if (receipt > assessment || end > receipt || start >= end) fail('SOURCE_CLOCK');
  if (!Array.isArray(v.bars) || !v.bars.length || v.bars.length > 1000 || (end - start) / 300000 !== v.bars.length) fail('GAPPED_SERIES');
  const session = regularGrid(v.windowStart);
  for (const [i, b] of v.bars.entries()) {
    exact(b, 'start,end,open,high,low,close,volume,complete,interpolated');
    const bs = clock(b.start), be = clock(b.end), s = regularGrid(b.start);
    if (s.date !== session.date || bs !== start + i * 300000 || be !== bs + 300000 || be > end || guidanceLocal(new Date(be - 1).toISOString()).minute >= session.closeMinute) fail('GAPPED_SERIES');
    if (b.complete !== true || b.interpolated !== false) fail('BAR_FLAGS_UNKNOWN_OR_UNUSABLE');
    const [o,h,l,c] = [b.open,b.high,b.low,b.close].map(etfMicroUsd);
    if (h! < l! || o! < l! || o! > h! || c! < l! || c! > h!) fail('OHLC');
    integer(b.volume, 0, 1000000000);
  }
  return v;
}
export function validateEtfSetupPlan(p: EtfSetupPlan, registeredAt: string) {
  exact(p, 'version,id,symbol,side,setup,activeFrom,timeExit,lower,upper,invalidation,fastBars,slowBars,bufferBps,chaseBps,volumeRatioBps,expiryBufferDays,targetDeltaBps');
  if (p.version !== 'OPTIONS_ETF_SETUP_PLAN_V1' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(p.id) || !['GLD','IBIT'].includes(p.symbol) || !['BULLISH','BEARISH'].includes(p.side) || !['BREAKOUT','PULLBACK','KEY_LEVEL'].includes(p.setup)) fail('PLAN');
  const active = clock(p.activeFrom), exit = clock(p.timeExit), registered = clock(registeredAt);
  if (active <= registered || exit <= active || active - registered > 7 * 86400000) fail('PROSPECTIVE_WINDOW');
  const startSession = regularGrid(p.activeFrom), exitSession = regularGrid(p.timeExit);
  if (startSession.date !== exitSession.date) fail('INTRADAY_EXIT_REQUIRED');
  const lower = etfMicroUsd(p.lower), upper = etfMicroUsd(p.upper), invalid = etfMicroUsd(p.invalidation);
  if (lower >= upper || (p.side === 'BULLISH' ? invalid > lower : invalid < upper)) fail('LEVEL_ORDER');
  integer(p.fastBars,2,20); integer(p.slowBars,p.fastBars+1,60);
  integer(p.bufferBps,0,500); integer(p.chaseBps,1,1000);
  integer(p.volumeRatioBps,1000,50000); integer(p.expiryBufferDays,1,45); integer(p.targetDeltaBps,3500,7000);
  return p;
}

/** Local declared-data research; never issues canonical guidance or brokerage orders. */
export function assessEtfSetup(input: EtfSetupAssessmentInput) {
  exact(input,'at,bars,plan,guidance'); clock(input.at);
  if (input.guidance.at !== input.at) fail('GUIDANCE_CLOCK');
  const canonical = assessDailyGuidance(input.guidance);
  if (input.plan) { exact(input.plan,'registeredAt,value'); validateEtfSetupPlan(input.plan.value,input.plan.registeredAt); if(clock(input.plan.registeredAt)>clock(input.at))fail('FUTURE_PLAN'); }
  if (input.bars) validateEtfBars(input.bars,input.at);
  const p = input.plan?.value, symbol = p?.symbol ?? input.bars?.symbol ?? null;
  if (p && input.bars && p.symbol !== input.bars.symbol) fail('SYMBOL_MISMATCH');
  const bars = input.bars?.bars ?? [];
  const baseline = p ? bars.filter(b=>b.end <= p.activeFrom).slice(-p.slowBars) : bars.slice(-5);
  const fastN = p?.fastBars ?? 3, slowN = p?.slowBars ?? 5;
  const full = baseline.length === slowN;
  const close = baseline.map(b=>etfMicroUsd(b.close)), slow = sum(close), fast = sum(close.slice(-fastN));
  const up = full && fast * BigInt(slowN) > slow * BigInt(fastN) && close.at(-1)! * BigInt(fastN) > fast;
  const down = full && fast * BigInt(slowN) < slow * BigInt(fastN) && close.at(-1)! * BigInt(fastN) < fast;
  const trend = !full ? 'INSUFFICIENT_HISTORY' : up ? 'UP' : down ? 'DOWN' : 'RANGE';
  const baselineVolume = baseline.reduce((n,b)=>n+BigInt(b.volume),0n);
  const totalVolume = bars.reduce((n,b)=>n+BigInt(b.volume),0n);
  const typicalWeighted = bars.reduce((n,b)=>n+(etfMicroUsd(b.high)+etfMicroUsd(b.low)+etfMicroUsd(b.close))*BigInt(b.volume),0n);
  const gaps: string[] = [];
  if (!input.bars) gaps.push('ETF_OHLCV_MISSING');
  if (!p) gaps.push('PROSPECTIVE_RULES_MISSING');
  if (!full) gaps.push('BASELINE_TOO_SHORT');
  if (p && full && p.setup!=='PULLBACK' && (close.at(-1)!<etfMicroUsd(p.lower)||close.at(-1)!>etfMicroUsd(p.upper))) gaps.push('PRIOR_CLOSE_OUTSIDE_DECLARED_RANGE');
  if (input.bars && baselineVolume === 0n) gaps.push('VOLUME_BASELINE_UNAVAILABLE');
  if (p && input.bars && (input.bars.windowStart > p.activeFrom || input.bars.windowEnd < p.activeFrom)) gaps.push('ACTIVATION_OUTSIDE_DATA_WINDOW');
  let status = 'NOT_ASSESSABLE', triggerAt: string | null = null, invalidatedAt: string | null = null, zoneTouched = false;
  let trigger: bigint | null = null;
  if (p && !gaps.length) {
    const bullish = p.side === 'BULLISH', level = etfMicroUsd(bullish?p.upper:p.lower);
    // Ceil bullish thresholds; floor bearish thresholds, without rounding source prices.
    trigger = bullish ? (level*BigInt(10000+p.bufferBps)+9999n)/10000n : level*BigInt(10000-p.bufferBps)/10000n;
    const invalid = etfMicroUsd(p.invalidation), lower=etfMicroUsd(p.lower), upper=etfMicroUsd(p.upper);
    status = clock(input.at)<clock(p.activeFrom) ? 'WAITING_FOR_ACTIVATION' : 'WAITING_FOR_CONFIRMATION';
    const prior=baseline.at(-1)!;
    if (p.setup !== 'KEY_LEVEL' && (bullish?trend!=='UP':trend!=='DOWN')) status='TREND_NOT_ALIGNED';
    let previousClose=etfMicroUsd(prior.close);
    for (const b of bars.filter(b=>b.start>=p.activeFrom && b.end<=p.timeExit)) {
      const high=etfMicroUsd(b.high),low=etfMicroUsd(b.low),c=etfMicroUsd(b.close);
      if (bullish?low<=invalid:high>=invalid) {status='INVALIDATED';invalidatedAt=b.end;break;}
      const wasTouched=zoneTouched;
      zoneTouched ||= low<=upper && high>=lower;
      const crossed = bullish ? previousClose<=trigger && c>trigger : previousClose>=trigger && c<trigger;
      const volumePass = BigInt(b.volume)*BigInt(baseline.length)*10000n >= baselineVolume*BigInt(p.volumeRatioBps);
      const inChase = bullish ? c*10000n<=trigger*BigInt(10000+p.chaseBps) : c*10000n>=trigger*BigInt(10000-p.chaseBps);
      if (!triggerAt && status!=='TREND_NOT_ALIGNED' && crossed && volumePass && (p.setup!=='PULLBACK'||wasTouched)) {
        if(inChase){triggerAt=b.end;status='RULE_MATCH_OBSERVED';}else status='CHASE_LIMIT_EXCEEDED';
      }
      if(triggerAt && (bullish?c<=level:c>=level)){status='FAILED_BREAK';invalidatedAt=b.end;break;}
      previousClose=c;
    }
    if(status==='RULE_MATCH_OBSERVED' && (bullish?previousClose*10000n>trigger*BigInt(10000+p.chaseBps):previousClose*10000n<trigger*BigInt(10000-p.chaseBps)))status='CHASE_LIMIT_EXCEEDED';
    if (!invalidatedAt && clock(input.at)>=clock(p.timeExit)) status='TIME_WINDOW_ENDED';
  }
  const activeBarFresh = bars.length>0 && clock(input.at)-clock(bars.at(-1)!.end)<=300000;
  const shared = ['IMPORTED_SOURCE_NOT_AUTHENTICATED','STRATEGY_NOT_VALIDATED','IV_PATH_SCENARIO_UNASSESSED'];
  if(status!=='RULE_MATCH_OBSERVED') shared.push('SETUP_NOT_CURRENTLY_CONFIRMED');
  if(!activeBarFresh) shared.push('ETF_BARS_NOT_FRESH');
  if(p&&bars.length&&clock(input.at)>=clock(p.timeExit))shared.push('SETUP_WINDOW_CLOSED');
  const rows = p ? canonical.assets.find(a=>a.symbol===p.symbol)!.candidates.map(c=>{
    const q=c.contract, reasons:string[]=[], desiredDate=new Date(Date.parse(p.timeExit.slice(0,10))+p.expiryBufferDays*86400000).toISOString().slice(0,10);
    if(q.type !== (p.side==='BULLISH'?'call':'put')) reasons.push('OPPOSES_DECLARED_SIDE');
    if(q.expiry<desiredDate) reasons.push('EXPIRY_BEFORE_HORIZON_AND_BUFFER');
    const deltaDistance=q.delta===null?null:Math.abs(Math.round(Math.abs(q.delta)*10000)-p.targetDeltaBps);
    const expiryDistanceDays=Math.abs((Date.parse(q.expiry)-Date.parse(desiredDate))/86400000);
    const spreadCents=q.askCents===null||q.bidCents===null?null:q.askCents-q.bidCents;
    const mechanicalBlockers=[...new Set([...c.blockers,...reasons])];
    return {contract:q,mechanicalBlockers,blockers:[...new Set([...mechanicalBlockers,...shared])],deltaDistanceBps:deltaDistance,expiryDistanceDays,spreadCents,
      rationale:{side:`${p.side} scenario uses long ${q.type}; opposite-side contracts are excluded from references.`,expiry:`Planned exit ${p.timeExit}; minimum ${p.expiryBufferDays} calendar-day expiry buffer gives ${desiredDate}. Existing 14–45 DTE checks remain.`,strike:`$${q.strike}; observed delta ${q.delta??'unknown'}, declared absolute-delta target ${p.targetDeltaBps/10000}. Delta is sensitivity, not win probability.`,cost:'One contract; original budget, bid/ask, cost and cash checks retained. No sizing to meet a minimum.'},plan:c.plan};
  }).sort((a,b)=>Number(a.mechanicalBlockers.length>0)-Number(b.mechanicalBlockers.length>0)||(a.deltaDistanceBps??Infinity)-(b.deltaDistanceBps??Infinity)||a.expiryDistanceDays-b.expiryDistanceDays||(a.spreadCents??Infinity)-(b.spreadCents??Infinity)||a.contract.id.localeCompare(b.contract.id)) : [];
  return {version:'OPTIONS_ETF_SETUP_RESEARCH_V1',assessedAt:input.at,symbol,status,plan:p??null,registeredAt:input.plan?.registeredAt??null,
    source:input.bars?{reference:input.bars.source,receivedAt:input.bars.receivedAt,windowStart:input.bars.windowStart,windowEnd:input.bars.windowEnd,barCount:bars.length,qualification:'IMPORTED_UNVERIFIED'}:null,
    trend:{direction:trend,fastBars:fastN,slowBars:slowN,fastMean:full?usd(fast/BigInt(fastN)):null,slowMean:full?usd(slow/BigInt(slowN)):null,baselineEnd:baseline.at(-1)?.end??null,
      approximateBarVwap:totalVolume>0n?usd(typicalWeighted/(3n*totalVolume)):null,meaning:'Descriptive completed-bar means; approximate typical-price bar VWAP, not trade VWAP. Within-session mean volume, not time-of-day relative volume.'},
    triggerPrice:trigger===null?null:usd(trigger),triggerAt,invalidatedAt,zoneTouched,gaps,rows,
    referenceIds:status==='RULE_MATCH_OBSERVED'&&activeBarFresh?rows.filter(r=>!r.mechanicalBlockers.length).slice(0,3).map(r=>r.contract.id):[],
    canonicalActions:canonical.assets.map(a=>({symbol:a.symbol,action:a.disposition})),
    limitations:shared,executionAllowed:false,changesCanonicalGuidance:false,winProbability:null,expectedReturn:null};
}
