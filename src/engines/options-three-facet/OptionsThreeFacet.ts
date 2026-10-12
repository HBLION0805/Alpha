import type { Candle, CandleSeries, Evidence, Facet, FibPlan, FrozenFibPlan, ObservedRetracementInput, ThreeFacetInput } from '../../contracts/OptionsThreeFacet';
import { paperFingerprint } from '../options-paper/OptionsPaperTradingEngine';
import { assessAutomaticEquityBars } from '../options-robinhood-data/AutomaticEquityBars';

export const FIB_RATIOS = [0, .382, .618, .786, 1, 1.272, 1.618] as const;
export const SOURCE_CAPABILITIES = Object.freeze({
  tradingView: { visualAccess: 'BROWSER_AVAILABLE', automaticCandles: 'NOT_CONNECTED', subscriptionAuthority: false },
  robinhood: { publicQuoteConnectivity: 'VERIFIED_2026_10_08_LOCAL_CLI', historicalQualification: 'UNKNOWN', automaticImport: false },
  inputMode: 'EXPLICIT_SAVED_EVIDENCE_ONLY', sourceReads: 0
});
const check = (ok: unknown, code: string): void => { if (!ok) throw Error('THREE_FACET_' + code); };
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 2000;
const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 1e9;
const clock = (v: unknown): number => {
  check(typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v) && Number.isFinite(Date.parse(v)), 'CLOCK');
  return Date.parse(v as string);
};
function evidenceOK(rows: Evidence[] | undefined, kind: Evidence['kind'], at: number): boolean {
  return Array.isArray(rows) && rows.length > 0 && rows.length <= 50 && new Set(rows.map(e => e.id)).size === rows.length &&
    rows.every(e => e && text(e.id) && e.kind === kind && text(e.source) && e.publishedAt !== null && e.receivedAt !== null &&
      clock(e.publishedAt) <= clock(e.receivedAt) && clock(e.receivedAt) <= clock(e.reviewedAt) && clock(e.reviewedAt) <= at);
}
function series(s: CandleSeries, at: number): void {
  check(s && text(s.symbol) && text(s.exchange) && text(s.sourceRef) && text(s.timezone), 'SOURCE_METADATA_MISSING');
  check(['TRADINGVIEW','ROBINHOOD','OWNER_EXPORT'].includes(s.provider), 'SOURCE_UNKNOWN');
  check(['SAVED_EXPORT','MCP_SAVED_RECEIPT'].includes(s.transport), 'CANDLE_SOURCE_NOT_AVAILABLE');
  check(s.provider !== 'TRADINGVIEW' || s.transport === 'SAVED_EXPORT', 'TRADINGVIEW_AUTOMATIC_NOT_CONNECTED');
  check(s.quality === 'REVIEWED' && ['REGULAR','EXTENDED'].includes(s.session) &&
    ['UNADJUSTED','SPLIT','TOTAL_RETURN'].includes(s.adjustment), 'SOURCE_QUALIFICATION_UNKNOWN');
  try { new Intl.DateTimeFormat('en-US', {timeZone: s.timezone}).format(0); } catch { throw Error('THREE_FACET_TIMEZONE'); }
  check(Number.isSafeInteger(s.intervalSeconds) && s.intervalSeconds > 0 && s.intervalSeconds <= 604800, 'INTERVAL');
  check(Array.isArray(s.bars) && s.bars.length > 0 && s.bars.length <= 512, 'BARS_MISSING_OR_BOUND');
  let previous = -Infinity;
  const ids = new Set<string>();
  for (const b of s.bars) {
    check(b && text(b.id) && !ids.has(b.id), 'BAR_ID'); ids.add(b.id);
    const open = clock(b.openAt), close = clock(b.closeAt), received = clock(b.receivedAt);
    check(open >= previous && close - open === s.intervalSeconds * 1000, 'BAR_INTERVAL_OR_OVERLAP');
    check(b.closed === true && b.interpolated === false, 'BAR_CLOSED_OR_INTERPOLATION_UNKNOWN');
    check(close <= received && received <= at, 'BAR_NOT_KNOWN_AT_CUTOFF');
    check([b.open,b.high,b.low,b.close].every(positive) && b.low <= Math.min(b.open,b.close) &&
      b.high >= Math.max(b.open,b.close) && b.high >= b.low, 'BAR_PRICES');
    check(b.volume === null || (typeof b.volume === 'number' && Number.isFinite(b.volume) && b.volume >= 0), 'BAR_VOLUME');
    previous = close;
  }
}
function anchor(s: CandleSeries, a: FibPlan['retracement'][number]): Candle {
  check(a && ['high','low','close'].includes(a.field), 'ANCHOR_FIELD');
  const bar = s.bars.find(b => b.id === a.barId); check(bar, 'ANCHOR_BAR_MISSING'); return bar!;
}
function validatePlan(p: FibPlan, s: CandleSeries): void {
  check(p && text(p.id) && text(p.selectionReason) && ['UP','DOWN'].includes(p.direction) && ['LINEAR','LOG'].includes(p.scale), 'PLAN');
  series(s, clock(p.selectedAt));
  check(Array.isArray(p.retracement) && p.retracement.length === 2 && Array.isArray(p.channel) && p.channel.length === 3, 'ANCHOR_COUNT');
  const transform = (v: number) => p.scale === 'LOG' ? Math.log(v) : v;
  for (const anchors of [p.retracement,p.channel]) {
    check(new Set(anchors.map(a => a.barId)).size === anchors.length, 'ANCHOR_DUPLICATE');
    anchors.forEach(a => anchor(s,a));
    const [a,b] = anchors, aa = anchor(s,a!), bb = anchor(s,b!);
    check(clock(aa.closeAt) < clock(bb.closeAt), 'ANCHOR_ORDER');
    const delta = transform(bb[b!.field])-transform(aa[a!.field]);
    check(p.direction === 'UP' ? delta > 0 : delta < 0, 'ANCHOR_DIRECTION');
  }
  const [a,b,c] = p.channel, aa = anchor(s,a), bb = anchor(s,b), cc = anchor(s,c);
  check(clock(cc.closeAt) >= clock(bb.closeAt), 'CHANNEL_THIRD_ANCHOR_ORDER');
  const baseC = transform(aa[a.field])+(transform(bb[b.field])-transform(aa[a.field])) *
    (clock(cc.closeAt)-clock(aa.closeAt))/(clock(bb.closeAt)-clock(aa.closeAt));
  const width = transform(cc[c.field])-baseC;
  check(p.direction === 'UP' ? width > 0 : width < 0, 'CHANNEL_WIDTH_DIRECTION');
  check(positive(p.breakoutLevel) && Number.isSafeInteger(p.volumeBaselineBars) && p.volumeBaselineBars >= 2 && p.volumeBaselineBars <= 100 &&
    Number.isFinite(p.minimumVolumeRatio) && p.minimumVolumeRatio >= 1 && p.minimumVolumeRatio <= 100 &&
    Number.isSafeInteger(p.maximumTriggerAgeSeconds) && p.maximumTriggerAgeSeconds > 0 && p.maximumTriggerAgeSeconds <= 604800, 'TRIGGER_POLICY');
  check(Array.isArray(p.zones) && p.zones.length <= 10 &&
    ['SUPPORT','RESISTANCE','ENTRY','CANCEL','EXIT'].every(role => p.zones.some(z => z.role === role)), 'ZONES_MISSING');
  for (const z of p.zones) check(['SUPPORT','RESISTANCE','ENTRY','CANCEL','EXIT'].includes(z.role) &&
    ['RETRACEMENT','CHANNEL'].includes(z.method) && FIB_RATIOS.some(r => r === z.fromRatio) &&
    FIB_RATIOS.some(r => r === z.toRatio) && z.fromRatio <= z.toRatio, 'ZONE_RATIO');
}
export function freezeFibPlan(plan: FibPlan, anchorSeries: CandleSeries): FrozenFibPlan {
  validatePlan(plan, anchorSeries);
  const {id: _label,...selection}=plan;
  const id='fib-v1-'+paperFingerprint({selection,anchorSeries}).slice(-24);
  const body = {version:'FROZEN_FIB_PLAN_V1' as const,plan:{...structuredClone(plan),id},anchorSeries:structuredClone(anchorSeries)};
  return {...body,fingerprint:paperFingerprint(body)};
}
function verifyFrozen(f: FrozenFibPlan): void {
  check(f && f.version === 'FROZEN_FIB_PLAN_V1', 'FROZEN_PLAN_REQUIRED');
  check(f.fingerprint === paperFingerprint({version:f.version,plan:f.plan,anchorSeries:f.anchorSeries}), 'FROZEN_PLAN_CHANGED');
  validatePlan(f.plan,f.anchorSeries);
  check(f.plan.id===freezeFibPlan(f.plan,f.anchorSeries).plan.id,'PLAN_IDENTITY_CHANGED');
}
export function calculateRetracementPrices(start: number,end: number,scale: 'LINEAR'|'LOG',ratios:readonly number[]=FIB_RATIOS) {
  check(positive(start)&&positive(end)&&start!==end&&['LINEAR','LOG'].includes(scale),'RETRACEMENT_INPUT');
  check(Array.isArray(ratios)&&ratios.length>0&&ratios.length<=20&&ratios.every(r=>Number.isFinite(r)&&r>=0&&r<=2),'RETRACEMENT_RATIOS');
  const transform=(v:number)=>scale==='LOG'?Math.log(v):v,inverse=(v:number)=>scale==='LOG'?Math.exp(v):v;
  const rows=ratios.map(ratio=>({ratio,price:inverse(transform(end)-ratio*(transform(end)-transform(start)))}));
  check(rows.every(r=>positive(r.price)),'PROJECTION_NONPOSITIVE_OR_OVERFLOW');return rows;
}
export function reviewObservedRetracement(i:ObservedRetracementInput) {
  const base={authority:'OBSERVED_RETROSPECTIVE_STRUCTURE_ONLY',quoteReviewEligible:false,executionAllowed:false,
    prospectiveEligible:false,engineFrozenPlanCreated:false,channel:null};
  try {
    check(i&&text(i.symbol)&&text(i.source?.reference)&&text(i.source.feed)&&text(i.source.surface)&&text(i.source.timezone),'OBSERVED_SOURCE');
    const at=clock(i.asOf),received=clock(i.receivedAt);
    check(i.evidenceCapturedAt!==null||i.evidenceCapturePrecision==='UNKNOWN','OBSERVED_CAPTURE_PRECISION');
    const captured=i.evidenceCapturedAt===null?received:i.evidenceCapturePrecision==='MINUTE'&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}Z$/.test(i.evidenceCapturedAt)?
      Date.parse(i.evidenceCapturedAt):clock(i.evidenceCapturedAt);
    check(captured<=received&&received<=at,'OBSERVED_RECEIPT_CLOCK');
    if(i.anchorSelectedAt)check(clock(i.anchorSelectedAt)<=received,'OBSERVED_SELECTION_CLOCK');
    if(i.sourceFrozenAt)check(clock(i.sourceFrozenAt)<=received&&(!i.anchorSelectedAt||clock(i.sourceFrozenAt)>=clock(i.anchorSelectedAt)),'OBSERVED_FREEZE_CLOCK');
    check(i.source.priceScale==='LINEAR'||i.source.priceScale==='LOG','OBSERVED_SCALE_UNKNOWN');
    check(Array.isArray(i.anchors)&&i.anchors.length===2,'OBSERVED_ANCHOR_PAIR');
    const day=(v:unknown):number=>{check(typeof v==='string'&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)&&Number.isFinite(Date.parse(v)),'OBSERVED_DATE');return Date.parse(v as string);};
    const anchorTime=(a:ObservedRetracementInput['anchors'][number])=>a.barStartAt===null?day(a.barDate):clock(a.barStartAt);
    const localAnchors=i.anchors.map(a=>{
      check(a&&['LOW','HIGH'].includes(a.role)&&positive(a.price)&&anchorTime(a)<=captured,'OBSERVED_ANCHOR');
      check(a.barStartAt!==null||i.source.timeframe==='1D','DATE_ONLY_ANCHOR_TIMEFRAME');
      const b=a.ohlc;
      check(b&&[b.open,b.high,b.low,b.close].every(positive)&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close)&&
        a.price===(a.role==='LOW'?b.low:b.high),'OBSERVED_OHLC');
      const valuesKnown=Array.isArray(a.neighborValues)&&a.neighborValues.length===4&&a.neighborValues.every(positive);
      const valueComparison=valuesKnown&&a.neighborValues.every(v=>a.role==='LOW'?a.price<v:a.price>v);
      return {role:a.role,price:a.price,barStartAt:a.barStartAt,barDate:a.barDate??null,timePrecision:a.barStartAt===null?'DATE_ONLY':'TIMESTAMP',
        valueComparison:valuesKnown?(valueComparison?'PASS':'FAIL'):'UNKNOWN',
        completedNeighbors:a.neighborBarsCompleted,
        neighborClockQualification:Array.isArray(a.neighborBarTimes)&&a.neighborBarTimes.length===4?'SUPPLIED_NOT_INDEPENDENTLY_AUTHENTICATED':'UNKNOWN'};
    });
    const [a,b]=i.anchors;
    check(a!.role!==b!.role&&anchorTime(a!)<anchorTime(b!)&&
      (a!.role==='LOW'?a!.price<b!.price:a!.price>b!.price),'OBSERVED_ANCHOR_ORDER');
    const levels=calculateRetracementPrices(a!.price,b!.price,i.source.priceScale as 'LINEAR'|'LOG',[0,.236,.382,.5,.618,.786,1,1.272,1.618]);
    const localStructure=localAnchors.every(a=>a.valueComparison==='PASS'&&a.completedNeighbors===true)?
      'ATTRIBUTED_LOCAL_EXTREMA_COMPARISON_PASSED':'LOCAL_EXTREMA_NOT_ESTABLISHED';
    const remaining=['RETROSPECTIVE_SELECTION_NOT_PROSPECTIVE','CONTINUOUS_MULTI_TIMEFRAME_OHLCV_MISSING',
      'THIRD_CHANNEL_ANCHOR_MISSING','QUALIFIED_PRICE_VOLUME_TRIGGER_MISSING'];
    if(i.evidenceCapturedAt===null)remaining.push('COMPOSITE_CAPTURE_CLOCK_UNKNOWN');
    if(i.source.splitAdjustment==='UNKNOWN')remaining.push('SPLIT_ADJUSTMENT_UNKNOWN');
    if(i.source.splitAdjustment==='PLATFORM_DESCRIBED_NOT_INDEPENDENTLY_VERIFIED')remaining.push('CORPORATE_ACTIONS_NOT_INDEPENDENTLY_VERIFIED');
    if(i.source.regularSession===null)remaining.push('SESSION_UNKNOWN');
    if(i.source.dividendAdjusted===null)remaining.push('DIVIDEND_ADJUSTMENT_UNKNOWN');
    if(i.source.volumeScope==='UNKNOWN')remaining.push('VOLUME_SCOPE_UNKNOWN');
    if(localAnchors.some(a=>a.neighborClockQualification==='UNKNOWN'))remaining.push('NEIGHBOR_BAR_CLOCKS_UNKNOWN');
    if(localStructure==='LOCAL_EXTREMA_NOT_ESTABLISHED')remaining.push('LOCAL_EXTREMA_NOT_ESTABLISHED');
    let latestBar=null;
    if(i.latestBar) {
      check(i.source.timeframe!=='1D','DAILY_ANCHORS_REQUIRE_DAILY_OBSERVATION');
      check(positive(i.latestBar.close)&&clock(i.latestBar.start)<clock(i.latestBar.end)&&clock(i.latestBar.end)<=captured,'OBSERVED_LATEST_BAR');
      latestBar={...structuredClone(i.latestBar),durationSeconds:(clock(i.latestBar.end)-clock(i.latestBar.start))/1000,
        volumeUse:'ROUNDED_DISPLAY_ONLY_NO_RATIO_TEST',
        relativeToLevels:levels.map(l=>({ratio:l.ratio,relation:i.latestBar!.close>l.price?'ABOVE':i.latestBar!.close<l.price?'BELOW':'AT'}))};
    }
    let latestDay=null;
    if(i.latestDay) {
      check(!i.latestBar&&i.source.timeframe==='1D'&&i.latestDay.completed===true&&positive(i.latestDay.close)&&
        day(i.latestDay.date)<day((i.evidenceCapturedAt??i.receivedAt).slice(0,10)),'OBSERVED_COMPLETED_DAY');
      latestDay={...structuredClone(i.latestDay),timePrecision:'DATE_ONLY',volumeUse:'ROUNDED_SAME_SOURCE_DAILY_ONLY_NO_RATIO_TEST'};
    }
    const upswing=a!.role==='LOW',last=i.latestBar?.close??i.latestDay?.close,level382=levels.find(l=>l.ratio===.382)!.price;
    const within=last!==undefined&&last>Math.min(a!.price,b!.price)&&last<Math.max(a!.price,b!.price);
    const interpretation={measurementLegDirection:upswing?'UP':'DOWN',observedAnchorLeg:upswing?'UPSWING':'DOWNSWING',
      currentObservedStructure:within?(upswing?'PULLBACK_FROM_HIGH':'REBOUND_FROM_LOW'):'UNKNOWN_OR_OUTSIDE_ANCHOR_RANGE',
      measurementDoesNotDetermineCurrentTrend:true,topOrBottomConfirmed:false,
      subsequentObservedMove:within?(upswing?'PULLBACK_FROM_HIGH':'REBOUND_FROM_LOW'):'UNKNOWN_OR_OUTSIDE_ANCHOR_RANGE',
      conditionalDirectionalBias:within&&(upswing?last!<level382:last!>level382)?
        (upswing?'SHORT_TERM_PULLBACK_WEAKNESS_UNCONFIRMED':'SHORT_TERM_REBOUND_STRENGTH_UNCONFIRMED'):within?
        (upswing?'SHALLOW_PULLBACK_WITHIN_UP_LEG_UNCONFIRMED':'SHALLOW_REBOUND_WITHIN_DOWN_LEG_UNCONFIRMED'):'DIRECTION_NOT_ESTABLISHED',
      basis:'Descriptive relation to retrospectively selected anchors and .382; an uncalibrated conditional interpretation, not a trend detector.',
      holdingWindowPriceDirection:'UNKNOWN',supportOrResistanceConfirmed:false,
      reconsideration:upswing?
        [last!==undefined&&last>=level382?'Holding above .382 with an independently confirmed higher low would support reassessment; current ratio position alone does not confirm a new upswing.':'Later closed regular-session bars reclaim .382 and independently establish a higher low before strengthening the interpretation.',
         'A later sustained break of the original low invalidates this bounded upswing reference; .618/.786 are review references, not proven support.']:
        ['Later closed regular-session bars lose .382 and independently establish a lower high before weakening the interpretation.',
         'A later sustained break of the original high invalidates this bounded downswing reference; ratio lines alone do not establish resistance.'],
      executionCondition:'Independent prospective selection, qualified multi-timeframe price/volume, news, horizon thesis, risk and fresh quote checks remain required.',
      winProbability:null};
    return {...base,interpretation,status:'PARTIAL_STRUCTURE_REVIEWED',symbol:i.symbol,asOf:i.asOf,levels,localAnchors,localStructure,latestBar,latestDay,
      source:structuredClone(i.source),clocks:{evidenceCapturedAt:i.evidenceCapturedAt,evidenceCapturePrecision:i.evidenceCapturePrecision,
        anchorSelectedAt:i.anchorSelectedAt,sourceFrozenAt:i.sourceFrozenAt,receivedAt:i.receivedAt,assessedAt:i.asOf},
      remaining,limitation:'Real sampled prices and attributed local neighbors only; no continuous-bar, pre-entry, channel, volume or performance validation.'};
  } catch(e) {return {...base,status:'OBSERVED_STRUCTURE_NOT_ESTABLISHED',levels:[],remaining:[e instanceof Error?e.message:'OBSERVED_INPUT_INVALID']};}
}
export function calculateFib(f: FrozenFibPlan, at: string) {
  verifyFrozen(f); check(clock(at) >= clock(f.plan.selectedAt), 'EVALUATION_BEFORE_SELECTION');
  const p=f.plan,s=f.anchorSeries, transform=(v:number)=>p.scale==='LOG'?Math.log(v):v, inverse=(v:number)=>p.scale==='LOG'?Math.exp(v):v;
  const value=(a:FibPlan['retracement'][number])=>transform(anchor(s,a)[a.field]);
  const [ra,rb]=p.retracement,[a,b,c]=p.channel;
  const slope=(value(b)-value(a))/(clock(anchor(s,b).closeAt)-clock(anchor(s,a).closeAt));
  const base=(t:number)=>value(a)+slope*(t-clock(anchor(s,a).closeAt)),width=value(c)-base(clock(anchor(s,c).closeAt));
  const retracement=calculateRetracementPrices(anchor(s,ra)[ra.field],anchor(s,rb)[rb.field],p.scale);
  const channel=FIB_RATIOS.map(ratio=>({ratio,price:inverse(base(clock(at))+ratio*width)}));
  check([...retracement,...channel].every(row=>positive(row.price)), 'PROJECTION_NONPOSITIVE_OR_OVERFLOW');
  const zones=p.zones.map(z=>{
    const lines=z.method==='CHANNEL'?channel:retracement;
    const prices=[lines.find(r=>r.ratio===z.fromRatio)!.price,lines.find(r=>r.ratio===z.toRatio)!.price];
    return {...z,at,low:Math.min(...prices),high:Math.max(...prices)};
  });
  return {at,scale:p.scale,timeAxis:'ELAPSED_UTC_MILLISECONDS',retracement,channel,zones,calibrated:false,
    limitation:'Declared geometry and zones; no probability, fill or TradingView pixel-equivalence claim.'};
}
function requiredEvidence(f: Facet|null|undefined): Evidence[] {
  if(!f)return [];
  check(Array.isArray(f.evidence)&&f.evidence.length<=50&&f.evidence.every(e=>e&&text(e.id))&&
    new Set(f.evidence.map(e=>e.id)).size===f.evidence.length,'EVIDENCE_IDENTITIES');
  const ids=f.requiredEvidenceIds??f.evidence.map(e=>e.id);
  check(Array.isArray(ids)&&ids.every(text)&&new Set(ids).size===ids.length&&
    ids.every(id=>f.evidence.some(e=>e.id===id)),'REQUIRED_EVIDENCE_REFERENCE');
  return f.evidence.filter(e=>ids.includes(e.id));
}
function evidenceTreatment(f: Facet|null|undefined) {
  const required=requiredEvidence(f),ids=new Set(required.map(e=>e.id));
  return {required:structuredClone(required),background:structuredClone((f?.evidence??[]).filter(e=>!ids.has(e.id))),
    basis:f?.requiredEvidenceIds?'EXPLICIT_DEPENDENCIES':'LEGACY_ALL_REQUIRED'};
}
function researchRegistration(i:ThreeFacetInput,at:number) {
  const p=i.researchPlan;
  if(!p)return {status:'NOT_REGISTERED',retained:false};
  try {
    check(text(p.id)&&text(p.hypothesis)&&text(p.triggerCondition)&&text(p.invalidationCondition)&&text(p.exitCondition),'RESEARCH_PLAN');
    const registered=clock(p.registeredAt);check(registered<=at,'RESEARCH_PLAN_CLOCK');
    const rows=[...(i.fundamental?.evidence??[]),...(i.news?.evidence??[]),...(i.technical?.facet.evidence??[])];
    check(Array.isArray(p.sourceIds)&&p.sourceIds.length>0&&new Set(p.sourceIds).size===p.sourceIds.length&&
      p.sourceIds.every(id=>rows.some(e=>e.id===id&&text(e.source)&&e.receivedAt!==null&&clock(e.receivedAt)<=registered)),'RESEARCH_PLAN_SOURCES');
    return {status:'RETAINED_UNVALIDATED',retained:true,plan:structuredClone(p)};
  } catch {return {status:'INVALID_REGISTRATION',retained:false};}
}
function facetIssues(f: Facet|null|undefined,kind: Evidence['kind'],i:ThreeFacetInput,at:number):string[] {
  if(!f)return [kind+'_EVIDENCE_UNKNOWN'];
  const issues:string[]=[];
  if(f.status!=='SUPPORTED'||!['UP','DOWN'].includes(f.direction))issues.push(kind+'_UNKNOWN_OR_CONFLICT');
  if(!evidenceOK(requiredEvidence(f),kind,at))issues.push(kind+'_EVIDENCE_UNKNOWN');
  if(f.validFrom===null||f.validThrough===null)
    issues.push(kind+'_VALIDITY_UNKNOWN');
  else if(clock(f.validFrom)>clock(i.holdingFrom)||clock(f.validThrough)<clock(i.holdingThrough))issues.push(kind+'_HOLDING_WINDOW_MISMATCH');
  return issues;
}
const sourceKey=(s:CandleSeries)=>[s.symbol,s.exchange,s.provider,s.transport,s.sourceRef,s.timezone,s.session,s.adjustment].join('|');
function technicalReview(i:ThreeFacetInput,at:number) {
  const t=i.technical!,issues=facetIssues(t.facet,'TECHNICAL',i,at);
  series(t.higher,at);series(t.lower,at);verifyFrozen(t.frozen);
  check(t.higher.symbol===i.symbol&&t.lower.symbol===i.symbol&&sourceKey(t.higher)===sourceKey(t.lower)&&
    sourceKey(t.higher)===sourceKey(t.frozen.anchorSeries),'SERIES_IDENTITY_OR_BASIS_MISMATCH');
  check(t.higher.intervalSeconds===t.frozen.anchorSeries.intervalSeconds&&t.higher.intervalSeconds>t.lower.intervalSeconds,'HIGHER_BEFORE_LOWER_TIMEFRAME');
  for(const a of [...t.frozen.plan.retracement,...t.frozen.plan.channel])
    check(paperFingerprint(anchor(t.higher,a))===paperFingerprint(anchor(t.frozen.anchorSeries,a)),'ANCHOR_SOURCE_REVISED');
  const trigger=t.lower.bars.at(-1)!,p=t.frozen.plan;
  if(at-clock(trigger.closeAt)>p.maximumTriggerAgeSeconds*1000)issues.push('TRIGGER_STALE');
  const reviewed=Math.max(...requiredEvidence(t.facet).map(e=>clock(e.reviewedAt)));
  check(clock(p.selectedAt)<=clock(trigger.openAt)&&reviewed<=clock(trigger.openAt),'LOOKAHEAD_SELECTION_OR_HIGHER_REVIEW');
  check(t.higher.bars.every(b=>clock(b.receivedAt)<=reviewed),'HIGHER_DATA_AFTER_DIRECTION_REVIEW');
  if(p.direction!==t.facet.direction)issues.push('TECHNICAL_PLAN_DIRECTION_CONFLICT');
  const baseline=t.lower.bars.slice(-(p.volumeBaselineBars+1),-1);
  const sequence=[...baseline,trigger];
  if(sequence.some((b,index)=>index>0&&clock(b.openAt)!==clock(sequence[index-1]!.closeAt)))issues.push('VOLUME_BASELINE_GAP');
  if(baseline.length!==p.volumeBaselineBars||trigger.volume===null||baseline.some(b=>b.volume===null))issues.push('VOLUME_EVIDENCE_UNKNOWN');
  const avg=baseline.length?baseline.reduce((n,b)=>n+(b.volume??0),0)/baseline.length:0;
  const localDate=(b:Candle)=>new Intl.DateTimeFormat('en-CA',{timeZone:t.lower.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(clock(b.openAt));
  if(baseline.some(b=>localDate(b)!==localDate(trigger)))issues.push('VOLUME_SESSION_NOT_COMPARABLE');
  if(avg<=0||trigger.volume===null||trigger.volume<avg*p.minimumVolumeRatio)issues.push('VOLUME_NOT_CONFIRMED');
  const previous=baseline.at(-1);
  if(!previous||!(p.direction==='UP'?previous.close<=p.breakoutLevel&&trigger.close>p.breakoutLevel:
    previous.close>=p.breakoutLevel&&trigger.close<p.breakoutLevel))issues.push('PRICE_STRUCTURE_NOT_CONFIRMED');
  const fib=calculateFib(t.frozen,trigger.closeAt);
  if(!fib.zones.some(z=>z.role==='ENTRY'&&trigger.close>=z.low&&trigger.close<=z.high))issues.push('OUTSIDE_ENTRY_ZONE');
  if(fib.zones.some(z=>['CANCEL','EXIT'].includes(z.role)&&trigger.close>=z.low&&trigger.close<=z.high))issues.push('CANCEL_OR_EXIT_ZONE_REACHED');
  return {issues,fib,triggerAt:trigger.closeAt,volumeRatio:avg>0&&trigger.volume!==null?trigger.volume/avg:null,
    frozenPlanId:p.id,frozenFingerprint:t.frozen.fingerprint,source:t.lower.provider};
}
export function assessThreeFacet(i:ThreeFacetInput) {
  const base={version:'THREE_FACET_REVIEW_V1',authority:'ATTRIBUTED_RESEARCH_REVIEW_NOT_TRADE_APPROVAL',
    eventDiscoveryAllowed:true,executionAllowed:false,positionSizingAllowed:false,winProbability:null,sourceCapabilities:SOURCE_CAPABILITIES};
  try {
    check(i&&i.version==='THREE_FACET_INPUT_V1'&&text(i.symbol)&&['EQUITY','ETF','OPTION'].includes(i.instrumentType),'INPUT');
    const at=clock(i.asOf);check(clock(i.holdingFrom)>=at&&clock(i.holdingThrough)>clock(i.holdingFrom),'HOLDING_WINDOW');
    const facets=[...facetIssues(i.fundamental,'FUNDAMENTAL',i,at),...facetIssues(i.news,'NEWS',i,at)];
    if(i.fundamental?.directionBasis!=='HOLDING_WINDOW_PRICE_THESIS'||!text(i.fundamental?.directionRationale))
      facets.push('FUNDAMENTAL_HOLDING_PRICE_THESIS_UNKNOWN');
    if(i.instrumentType==='ETF'&&i.fundamental?.basis!=='ETF_COMPONENTS_VALUATION_MACRO')facets.push('ETF_FUNDAMENTAL_BASIS_REQUIRED');
    if(i.instrumentType==='EQUITY'&&i.fundamental?.basis!=='COMPANY')facets.push('COMPANY_FUNDAMENTAL_BASIS_REQUIRED');
    let technical:ReturnType<typeof technicalReview>|null=null;
    if(i.observedTechnical)check(i.observedTechnical.symbol===i.symbol&&clock(i.observedTechnical.asOf)===at,'OBSERVED_CASE_IDENTITY_OR_CLOCK');
    const observedTechnical=i.observedTechnical?reviewObservedRetracement(i.observedTechnical):null;
    const automaticTechnicalObservation=i.automaticBars?assessAutomaticEquityBars(i.automaticBars.capture,i.asOf).assets.find(a=>a.symbol===i.symbol):null;
    if(i.automaticBars)check(automaticTechnicalObservation,'AUTOMATIC_SYMBOL_MISMATCH');
    if(!i.technical)facets.push(observedTechnical?.status==='PARTIAL_STRUCTURE_REVIEWED'?'TECHNICAL_TRIGGER_EVIDENCE_UNKNOWN':'TECHNICAL_EVIDENCE_UNKNOWN');
    else {try {technical=technicalReview(i,at);facets.push(...technical.issues);} catch(e) {
      facets.push(e instanceof Error?e.message:'THREE_FACET_TECHNICAL_INVALID');
    }}
    const directions=[i.fundamental?.direction,i.news?.direction,i.technical?.facet.direction];
    if(new Set(directions).size!==1||!['UP','DOWN'].includes(directions[0]??''))facets.push('THREE_FACET_DIRECTION_NOT_ALIGNED');
    const all=[requiredEvidence(i.fundamental),requiredEvidence(i.news),requiredEvidence(i.technical?.facet)].flat();
    if(new Set(all.map(e=>e.id)).size!==all.length)facets.push('FACET_EVIDENCE_REUSED');
    if(!i.news||!text(i.news.trigger)||!['NONE','MATERIAL'].includes(i.news.assumptionImpact))facets.push('NEWS_TRIGGER_OR_IMPACT_UNKNOWN');
    const research=researchRegistration(i,at);
    if(research.status==='INVALID_REGISTRATION')facets.push('RESEARCH_REGISTRATION_INVALID');
    if(i.news) {
      const state=i.news.triggerState??'OBSERVED';
      if(state==='PENDING') {
        if(!research.retained||!i.news.eventAt||clock(i.news.eventAt)<=at||
          clock(i.news.eventAt)>clock(i.holdingThrough))facets.push('NEWS_HYPOTHESIS_TIMING_UNKNOWN');
        facets.push('NEWS_TRIGGER_PENDING');
      } else if(state!=='OBSERVED')facets.push('NEWS_TRIGGER_STATE_UNKNOWN');
      check(Array.isArray(i.news.materialChanges)&&i.news.materialChanges.length<=50,'NEWS_CHANGES');
      if(i.news.assumptionImpact==='MATERIAL'&&!i.news.materialChanges.length)facets.push('MATERIAL_NEWS_DETAIL_UNKNOWN');
      if(i.news.assumptionImpact==='NONE'&&i.news.materialChanges.length)facets.push('NEWS_IMPACT_CONFLICT');
      for(const change of i.news.materialChanges) {
        const e=requiredEvidence(i.news).find(e=>e.id===change.evidenceId),f=i.fundamental;
        if(!text(change.id)||!['EARNINGS','ORDERS','POLICY'].includes(change.kind)||!e||e.receivedAt===null||!f?.reassessedNewsIds?.includes(change.id)||
          !requiredEvidence(f).some(x=>clock(x.reviewedAt)>=clock(e.receivedAt)))facets.push('FUNDAMENTAL_REASSESSMENT_REQUIRED');
      }
    }
    const risk:string[]=[];
    for(const key of ['capital','maximumLoss','liquidity','gap','correlation','exit'] as const) {
      const c=i.risk?.[key];
      if(!c||c.state!=='PASS'||!evidenceOK(c.evidence,'RISK',at))risk.push('RISK_'+key.toUpperCase()+'_NOT_PASSED');
    }
    if(i.instrumentType==='OPTION') {
      const a=i.optionAlternatives;
      if(!a||!['HEDGE','DEFINED_RISK'].includes(a.alternativeKind)||!text(a.rationale)||a.chosen==='WAIT'||
        !['UNHEDGED','ALTERNATIVE'].includes(a.chosen)||
        ![a.unhedged,a.alternative].every(x=>x&&['PASS','FAIL'].includes(x.state)&&evidenceOK(x.evidence,'STRUCTURE',at))||
        (a.chosen==='UNHEDGED'?a.unhedged:a.alternative).state!=='PASS')risk.push('OPTION_ALTERNATIVE_COMPARISON_REQUIRED');
    }
    const confluence=facets.length===0,allowed=confluence&&risk.length===0;
    const blockers=[...new Set([...facets,...risk])];
    const pendingTriggers=new Set(['NEWS_TRIGGER_PENDING','PRICE_STRUCTURE_NOT_CONFIRMED','VOLUME_NOT_CONFIRMED','OUTSIDE_ENTRY_ZONE']);
    const reassess=[i.fundamental,i.news,i.technical?.facet].some(f=>f?.status==='CONFLICT')||
      new Set(directions.filter(d=>d==='UP'||d==='DOWN')).size>1||blockers.includes('CANCEL_OR_EXIT_ZONE_REACHED');
    const conditionalPlanStatus=allowed?'READY_FOR_QUOTE_REVIEW':!research.retained?'NOT_REGISTERED':
      reassess?'REASSESS_REQUIRED':blockers.some(b=>!pendingTriggers.has(b))?'AWAITING_EVIDENCE':'AWAITING_TRIGGER';
    return {...base,symbol:i.symbol,asOf:i.asOf,holdingWindow:{from:i.holdingFrom,through:i.holdingThrough},
      ...(i.automaticBars?{automaticTechnicalObservation}:{}),
      confluence:confluence?'ALIGNED':'NOT_ESTABLISHED',eligibleForTradeEvaluation:confluence,
      recommendationGate:allowed?'ELIGIBLE_FOR_QUOTE_REVIEW':'WAIT',candidateCount:allowed?1:0,blockers,technical:technical??observedTechnical,observedTechnical,
      researchStatus:research.status,researchCandidateCount:research.retained?1:0,research,
      conditionalPlanStatus,conditionalPlanCount:research.retained?1:0,quoteReviewEligible:allowed,
      evidenceTreatment:{fundamental:evidenceTreatment(i.fundamental),news:evidenceTreatment(i.news),technical:evidenceTreatment(i.technical?.facet)},
      nextStep:allowed?'Obtain fresh qualified quotes and unchanged Owner/risk/plan review; no automatic position.':'Continue research or remain flat. Missing evidence does not block pool event discovery.',
      riskReview:structuredClone(i.risk??null),optionComparison:structuredClone(i.optionAlternatives??null),
      inputFingerprint:paperFingerprint(i)};
  } catch(e) {
    return {...base,symbol:i?.symbol??null,confluence:'NOT_ESTABLISHED',eligibleForTradeEvaluation:false,
      recommendationGate:'WAIT',candidateCount:0,researchStatus:'INPUT_INVALID',researchCandidateCount:0,conditionalPlanStatus:'NOT_REGISTERED',conditionalPlanCount:0,quoteReviewEligible:false,blockers:[e instanceof Error&&e.message.startsWith('THREE_FACET_')?e.message:'THREE_FACET_INPUT_INVALID'],technical:null};
  }
}
