import { legacyRiskCapsRemoved } from "../options-retail-feasibility/OptionsTradeBudget";
import type { EventResearchPlan, EventResearchFrame } from '../../contracts/OptionsEventResearch';
import type { GuidanceQuote, GuidanceEquity } from '../../contracts/OptionsDailyGuidance';
import { guidanceLocal, validateGuidanceSettings } from '../options-daily-guidance/OptionsDailyGuidance';
import { evaluateOptionsPlanningFeasibility as evaluateOptionsRetailFeasibility } from '../options-retail-feasibility/OptionsTradeBudget';
import { readinessClock } from '../options-readiness/OptionsReadinessEngine';
import { paperFingerprint } from '../options-paper/OptionsPaperTradingEngine';

const WINDOW = 20 * 60000, DAY = 86400000;
const fail = (code: string): never => { throw Error('EVENT_RESEARCH_' + code); };
const clock = (s: string) => { readinessClock(s); return Date.parse(s); };
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const date = (s: unknown): s is string => typeof s==='string' && /^\d{4}-\d\d-\d\d$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(Date.parse(s)).toISOString().slice(0,10)===s;
const ns = (s: string | null): bigint | null => {
  if (typeof s !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(s)) return null;
  const n = Date.parse(s.slice(0,19) + 'Z');
  return Number.isFinite(n) && new Date(n).toISOString().slice(0,19)===s.slice(0,19) ? BigInt(n) * 1000000n + BigInt((s.split('.')[1]?.replace('Z','') ?? '').padEnd(9,'0') || '0') : null;
};
const price = (s: string | null): bigint | null => {
  if (typeof s !== 'string' || !/^\d{1,8}(?:\.\d{1,6})?$/.test(s)) return null;
  const [a,b=''] = s.split('.'), n = BigInt(a!) * 1000000n + BigInt(b.padEnd(6,'0'));
  return n > 0n ? n : null;
};
const regular = (s: string) => { const l=guidanceLocal(s); return !['Sat','Sun'].includes(l.weekday??'') && l.minute>=570 && l.minute<960; };
const sameContract = (a: GuidanceQuote,b: GuidanceQuote) => ['id','symbol','expiry','type','strike','multiplier'].every(k=>a[k as keyof GuidanceQuote]===b[k as keyof GuidanceQuote]);

export function validateEventResearchPlan(p: EventResearchPlan): EventResearchPlan {
  const keys=['version','id','title','createdAt','event','selectionCapturePath','preContract','postCall','postPut','settings','preEntryAt','preExitAt','postEntryAt','postExitAt','minimumMoveBps'];
  if (!p || Object.keys(p).sort().join()!==keys.sort().join() || p.version!=='OPTIONS_EVENT_RESEARCH_PLAN_V1') fail('PLAN_FIELDS');
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(p.id) || typeof p.title!=='string' || !p.title.trim() || p.title.length>160) fail('IDENTITY');
  if (!/^data\/runtime\/options-daily-guidance\/captures\/\d{4}-\d\d-\d\d\/[\w.-]+\.json$/.test(p.selectionCapturePath)) fail('SELECTION_PATH');
  if (!p.event || typeof p.event.title!=='string' || !p.event.title.trim() || p.event.title.length>500 || !date(p.event.startDate) || !date(p.event.endDate) || p.event.endDate<p.event.startDate || typeof p.event.scheduledAt!=='string') fail('TIMED_FUTURE_EVENT_REQUIRED');
  const created=clock(p.createdAt),release=clock(p.event.scheduledAt!);
  if (!Number.isFinite(release) || release<=created || release-created>14*DAY || !['BLS','FOMC'].includes(p.event.source)) fail('TIMED_FUTURE_EVENT_REQUIRED');
  if (guidanceLocal(p.event.scheduledAt!).date<p.event.startDate || guidanceLocal(p.event.scheduledAt!).date>p.event.endDate) fail('EVENT_DATE');
  const times=[p.preEntryAt,p.preExitAt,p.postEntryAt,p.postExitAt].map(clock);
  if (times[0]!<=created || times[1]!<times[0]!+WINDOW || times[1]!+WINDOW>=release || times[2]!<release+30*60000 || times[3]!<times[2]!+WINDOW || times[3]!>release+3*DAY) fail('WINDOW_ORDER');
  for (const s of [p.preEntryAt,p.preExitAt,p.postEntryAt,p.postExitAt]) if (!regular(s) || guidanceLocal(s).minute>940) fail('REGULAR_SESSION_WINDOW_REQUIRED');
  if (!positive(p.minimumMoveBps) || p.minimumMoveBps>1000) fail('MOVE_THRESHOLD');
  validateGuidanceSettings(p.settings);
  for (const q of [p.preContract,p.postCall,p.postPut]) {
    if (!q || !['GLD','IBIT'].includes(q.symbol) || !['call','put'].includes(q.type) || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(q.id) || q.multiplier!==100 || price(q.strike)===null || !date(q.expiry)) fail('CONTRACT');
    if (q.expiry<=guidanceLocal(q===p.preContract?p.preExitAt:p.postExitAt).date) fail('EXPIRY_BEFORE_EXIT');
  }
  if (p.postCall.type!=='call' || p.postPut.type!=='put' || p.postCall.symbol!==p.postPut.symbol || p.postCall.expiry!==p.postPut.expiry || p.postCall.id===p.postPut.id) fail('POST_PAIR');
  return structuredClone(p);
}

interface Pick { frame: EventResearchFrame | null; quote: GuidanceQuote | null; equity: GuidanceEquity | null; status: string; rejected: number; }
function equityUsable(e: GuidanceEquity | undefined,f: EventResearchFrame,start: string,end: number) {
  const source=ns(e?.sourceAt??null),receipt=ns(f.capturedAt),begin=ns(start),finish=BigInt(end)*1000000n;
  return e && price(e.price)!==null && source!==null && receipt!==null && begin!==null && source>=begin && source<=finish && source<=receipt && receipt-source<=120000000000n;
}
function quoteUsable(q: GuidanceQuote | undefined,c: GuidanceQuote,e: GuidanceEquity,f: EventResearchFrame,start:string,end:number) {
  if (!q || !sameContract(q,c) || !positive(q.bidCents) || !positive(q.askCents) || q.askCents>9999999999 || q.bidCents>q.askCents || !positive(q.bidSize) || !positive(q.askSize) || !positive(q.tickCents)) return false;
  const t=ns(q.updatedAt),r=ns(q.receivedAt),a=ns(f.capturedAt),u=ns(e.sourceAt),b=ns(start);
  return t!==null&&r!==null&&a!==null&&u!==null&&b!==null&&t>=b&&t<=BigInt(end)*1000000n&&t<=r&&r<=a&&a-t<=120000000000n&&(t>u?t-u:u-t)<=120000000000n;
}
function pick(frames:EventResearchFrame[],start:string,symbol:string,at:string,contracts:GuidanceQuote[]=[]):Pick {
  const begin=clock(start),end=begin+WINDOW,now=clock(at);
  let rejected=0;
  const candidates=frames.filter(f=>clock(f.capturedAt)>=begin&&clock(f.capturedAt)<=end&&clock(f.recordedAt)<=end&&clock(f.recordedAt)<=now&&clock(f.capturedAt)<=now)
    .sort((a,b)=>clock(a.capturedAt)-clock(b.capturedAt)||a.path.localeCompare(b.path));
  for (const f of candidates) {
    const peers=candidates.filter(x=>x.capturedAt===f.capturedAt);
    if (new Set(peers.map(x=>paperFingerprint({quotes:x.quotes,equities:x.equities}))).size>1) return {frame:null,quote:null,equity:null,status:'CONFLICTING_SNAPSHOT',rejected};
    const e=f.equities.find(e=>e.symbol===symbol);
    if (f.origin!=='HOST_MARKET_TOOL_RESPONSES' || !regular(f.capturedAt) || !equityUsable(e,f,start,end)) {rejected++;continue;}
    const qs=contracts.map(c=>f.quotes.find(q=>q.id===c.id));
    if (contracts.some((c,i)=>!quoteUsable(qs[i],c,e!,f,start,end))) {rejected++;continue;}
    return {frame:f,equity:e!,quote:qs[0]??null,status:'OBSERVED',rejected};
  }
  return {frame:null,quote:null,equity:null,status:now>end?'MISSED':'WAITING',rejected};
}
function economics(p:EventResearchPlan,q:GuidanceQuote,at:string) {
  const blockers:string[]=[];
  const dte=(Date.parse(q.expiry)-Date.parse(guidanceLocal(at).date))/DAY;
  if(dte<14||dte>45)blockers.push('CONTRACT_OUTSIDE_RESEARCH_POLICY');
  if(q.askCents===null||q.bidCents===null||(q.askCents-q.bidCents)*10>q.askCents)blockers.push('SPREAD_UNSUITABLE');
  if(q.delta===null||!Number.isFinite(q.delta)||Math.abs(q.delta)<0.35||Math.abs(q.delta)>0.70||(q.type==='call'?q.delta<=0:q.delta>=0))blockers.push('DELTA_UNSUITABLE');
  const r=evaluateOptionsRetailFeasibility({...p.settings,symbol:q.symbol,strategy:q.type==='call'?'LONG_CALL':'LONG_PUT',quantity:1,contractMultiplier:100,bidPerShareCents:q.bidCents??-1,askPerShareCents:q.askCents??-1,minimumPriceTickCents:q.tickCents??-1,mode:'NORMAL'});
  return {blockers:[...blockers,...r.blockers.map(b=>b.code)],economics:r.economics};
}
function phase(p:EventResearchPlan,name:'PRE'|'POST',entry:Pick,exit:Pick,c:GuidanceQuote|null,extra:string[]=[]) {
  const result=entry.quote&&entry.frame?economics(p,entry.quote,entry.frame.capturedAt):null;
  const gross=entry.quote?.askCents!==null&&entry.quote?.askCents!==undefined&&exit.quote?.bidCents!==null&&exit.quote?.bidCents!==undefined ? (exit.quote.bidCents-entry.quote.askCents)*100 : null;
  const costs=p.settings.roundTripFeesCents===null||p.settings.slippageReserveCents===null?null:p.settings.roundTripFeesCents+p.settings.slippageReserveCents;
  return {name,contract:c,entry,exit,blockers:[...extra,...(result?.blockers??[])],economics:result?.economics??null,grossReferencePnlCents:gross,netReferencePnlCents:gross===null||costs===null?null:gross-costs,
    status:extra.includes('NO_REACTION_SIGNAL')?'NO_SIGNAL':!entry.frame?entry.status:!exit.frame?'OPEN_REFERENCE':costs===null?'COSTS_UNKNOWN':'REFERENCE_COMPLETE',
    stopPath:'UNOBSERVED_BETWEEN_SNAPSHOTS',actualFill:false};
}
export function assessEventResearch(plan:EventResearchPlan,frames:EventResearchFrame[],at:string) {
  const p=validateEventResearchPlan(plan),now=clock(at);
  if(now<clock(p.createdAt)||!Array.isArray(frames)||frames.length>1000)fail('ASSESSMENT');
  const ids=new Set<string>();
  for(const f of frames){if(ids.has(f.path)||clock(f.capturedAt)>clock(f.recordedAt)||!Array.isArray(f.quotes)||!Array.isArray(f.equities)||f.quotes.length>36||f.equities.length>2||new Set(f.quotes.map(q=>q.id)).size!==f.quotes.length||new Set(f.equities.map(e=>e.symbol)).size!==f.equities.length)fail('FRAME');ids.add(f.path);}
  const timely=frames.filter(f=>clock(f.recordedAt)<=now&&clock(f.capturedAt)>clock(p.createdAt));
  const preEntry=pick(timely,p.preEntryAt,p.preContract.symbol,at,[p.preContract]);
  const preExit=pick(timely,p.preExitAt,p.preContract.symbol,at,[p.preContract]);
  const pre=phase(p,'PRE',preEntry,preExit,p.preContract);
  // The POST baseline has its own underlying even when PRE uses a different ETF.
  const baseline=pick(timely,p.preExitAt,p.postCall.symbol,at);
  const reaction=pick(timely,p.postEntryAt,p.postCall.symbol,at,[p.postCall,p.postPut]);
  const start=price(baseline.equity?.price??null),end=price(reaction.equity?.price??null);
  const move=start!==null&&end!==null?Number((end-start)*1000000n/start)/100:null;
  const side=start!==null&&end!==null ? (end*10000n>=start*BigInt(10000+p.minimumMoveBps)?'call':end*10000n<=start*BigInt(10000-p.minimumMoveBps)?'put':null):null;
  const chosen=side==='call'?p.postCall:side==='put'?p.postPut:null;
  const entry:Pick={...reaction,quote:chosen?reaction.frame?.quotes.find(q=>q.id===chosen.id)??null:null};
  const exit=chosen?pick(timely,p.postExitAt,chosen.symbol,at,[chosen]):{frame:null,quote:null,equity:null,status:'NOT_SELECTED',rejected:0};
  const extra=baseline.frame&&reaction.frame&&!chosen?['NO_REACTION_SIGNAL']:!baseline.frame?['REACTION_BASELINE_'+baseline.status]:[];
  const post=phase(p,'POST',entry,exit,chosen,extra);
  const selectionDiagnostics=[p.preContract,p.postCall,p.postPut].map(q=>({contract:q,assessedAt:p.createdAt,...(positive(q.bidCents)&&positive(q.askCents)&&positive(q.tickCents)?economics(p,q,p.createdAt):{blockers:['SELECTION_QUOTE_UNUSABLE'],economics:null})}));
  const removed=legacyRiskCapsRemoved(p.settings.tradeBudget),budget=removed?null:Math.floor(p.settings.currentEquityCents*50/10000),stressBudget=removed?null:Math.floor(p.settings.currentEquityCents*250/10000);
  const cashBudget=removed?Math.min(p.settings.currentEquityCents,p.settings.settledCashCents):p.settings.settledCashCents;
  const comparisons=(['PRE_ONLY','POST_ONLY','COMBINED'] as const).map(mode=>{
    let losses=0,spent=0,total=0,complete=true;
    const steps=(mode==='PRE_ONLY'?[pre]:mode==='POST_ONLY'?[post]:[pre,post]).map(ph=>{
      const blockers=[...ph.blockers];
      if(!complete)blockers.push('PRIOR_PHASE_UNRESOLVED');
      const e=ph.economics;
      if(budget!==null&&e?.plannedStopCents!==null&&e?.plannedStopCents!==undefined&&losses+e.plannedStopCents>budget)blockers.push('EVENT_LOSS_BUDGET_EXCEEDED');
      if(stressBudget!==null&&e?.stressLossCents!==null&&e?.stressLossCents!==undefined&&losses+e.stressLossCents>stressBudget)blockers.push('EVENT_STRESS_BUDGET_EXCEEDED');
      if(e?.capitalRequiredCents!==null&&e?.capitalRequiredCents!==undefined&&spent+e.capitalRequiredCents>cashBudget)blockers.push('UNSETTLED_PROCEEDS_NOT_REUSED');
      const noSignal=ph.status==='NO_SIGNAL';
      const waiting=!noSignal&&(!ph.entry.quote||ph.status==='OPEN_REFERENCE'||ph.status==='COSTS_UNKNOWN');
      const accepted=!noSignal&&!waiting&&blockers.length===0&&ph.netReferencePnlCents!==null;
      if(waiting)complete=false;
      if(accepted){total+=ph.netReferencePnlCents!;losses+=Math.max(0,-ph.netReferencePnlCents!);spent+=e!.capitalRequiredCents!;}
      return {phase:ph.name,status:accepted?'ACCEPTED_REFERENCE':noSignal?'NO_SIGNAL':waiting?'INCOMPLETE':'BLOCKED',blockers,referencePnlCents:accepted?ph.netReferencePnlCents:null,remainingEventLossCents:budget===null?null:Math.max(0,budget-losses),conservativeRemainingCashCents:Math.max(0,cashBudget-spent)};
    });
    const acceptedReferences=steps.filter(s=>s.status==='ACCEPTED_REFERENCE').length;
    return {mode,status:!complete?'INCOMPLETE':acceptedReferences?'REFERENCE_ASSESSED':steps.every(s=>s.status==='NO_SIGNAL')?'NO_SIGNAL':'NO_ACCEPTED_REFERENCES',acceptedReferences,netReferencePnlCents:complete&&acceptedReferences?total:null,lossConsumedCents:losses,remainingEventLossCents:budget===null?null:Math.max(0,budget-losses),steps};
  });
  const lessons=[{code:'SPARSE_QUOTES_NOT_STOP_EXECUTION',text:'Reference endpoints cannot establish a stop/target crossing, executable fill, candle trend or market cause.'}];
  if([pre,post].some(x=>x.entry.status==='MISSED'||x.exit.status==='MISSED'))lessons.push({code:'OBSERVATION_WINDOW_MISSED',text:'A frozen observation window has no usable timely evidence; retain the gap rather than choosing a later favorable quote.'});
  if(comparisons.some(c=>c.steps.some(s=>s.blockers.some(b=>b.startsWith('EVENT_')))))lessons.push({code:'SHARED_EVENT_BUDGET_CONSUMED',text:'An earlier reference loss consumes the same event budget. Changing phase or ETF does not reset it.'});
  if([pre,post].some(x=>x.grossReferencePnlCents!==null&&x.netReferencePnlCents===null))lessons.push({code:'COSTS_REQUIRED_FOR_NET_COMPARISON',text:'Observed price movement is available, but unknown costs prevent a net-return comparison.'});
  return {version:removed?'OPTIONS_EVENT_RESEARCH_REPORT_V2':'OPTIONS_EVENT_RESEARCH_REPORT_V1',assessedAt:at,plan:p,selectionDiagnostics,phases:[pre,post],reaction:{baseline,observation:reaction,moveBps:move,selectedSide:side,rule:'First usable POST snapshot versus the same ETF at PRE exit; not a candle-confirmed trend.'},eventRisk:{...(removed?{legacyLossCapsEnforced:false,declaredCashBudgetCents:cashBudget}:{}),plannedLossBudgetCents:budget,fullLossStressBudgetCents:stressBudget,saleProceedsRecycled:false,accountEnforcement:false},comparisons,
    candidateLessons:lessons.map(l=>({...l,status:'CANDIDATE',marketCause:'UNKNOWN'})),actualTrades:0,winProbability:null,executionAllowed:false,calibrated:false};
}
