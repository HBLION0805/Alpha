import {manualUsd, manualUsdUnits} from '../options-manual-ledger/OptionsManualLedger';
import {snapshotNs} from '../options-robinhood-data/RobinhoodSnapshotPaper';
import {paperSession} from '../options-robinhood-data/RobinhoodPaperSession';
import {guidanceLocal} from '../options-daily-guidance/OptionsGuidanceClock';
import {evaluateOptionsPlanningFeasibility} from './OptionsTradeBudget';

export const probabilitySources = ['OWNER_ASSUMPTION','ANALYST_UNCALIBRATED','HISTORICAL_ESTIMATE','CALIBRATED_MODEL','UNKNOWN'] as const;
export const payoffSources = ['OWNER_SUPPLIED_PAYOFF','EXISTING_DETERMINISTIC_CALCULATOR','HISTORICAL_OBSERVED_PAYOFF','UNKNOWN'] as const;
export interface ResearchScenario {
  scenarioId:string; label:string; eventOutcome:string; marketInterpretation:string;
  probability:string; probabilitySource:string; probabilityAsOf:string; probabilityEvidenceRef:string;
  payoff:string; payoffUnit:'USD_POSITION_GROSS_PROCEEDS'; payoffSource:string; payoffAt:string;
  payoffBasis:'PLANNED_EXIT'|'EXPIRATION'|'UNKNOWN'; payoffEvidenceRef:string;
  costs:{premiumUsd:string; feesUsd:string; slippageUsd:string; evidenceRef:string};
  notes:string; limitations:string;
}
const fail=(s:string):never=>{throw Error('MACRO_SCENARIO_'+s);};
export function validateScenarioRows(rows:ResearchScenario[]) {
  if(!Array.isArray(rows)||rows.length>12||new Set(rows.map(r=>r.scenarioId)).size!==rows.length)fail('ROWS');
  for(const row of rows){
    if(!row||Object.keys(row).sort().join()!=='costs,eventOutcome,label,limitations,marketInterpretation,notes,payoff,payoffAt,payoffBasis,payoffEvidenceRef,payoffSource,payoffUnit,probability,probabilityAsOf,probabilityEvidenceRef,probabilitySource,scenarioId')fail('FIELDS');
    const {costs,...rest}=row;
    if(Object.values(rest).some(v=>typeof v!=='string'||v.length>1500))fail('TEXT');
    if(!/^[a-z0-9][a-z0-9-]{0,59}$/.test(row.scenarioId)||!probabilitySources.includes(row.probabilitySource as any)||!payoffSources.includes(row.payoffSource as any)||row.payoffUnit!=='USD_POSITION_GROSS_PROCEEDS'||!['PLANNED_EXIT','EXPIRATION','UNKNOWN'].includes(row.payoffBasis))fail('ENUM');
    if(!costs||Object.keys(costs).sort().join()!=='evidenceRef,feesUsd,premiumUsd,slippageUsd'||Object.values(costs).some(v=>typeof v!=='string'||v.length>1500))fail('COSTS');
  }
}
const money=(s:string)=>{try{return s.trim()?manualUsdUnits(s):null;}catch{return null;}};
const clock=(s:string|null|undefined)=>{try{return snapshotNs(s!);}catch{return null;}};
const percent=(s:string)=>/^(?:0|[1-9]\d?|100)(?:\.\d{1,4})?$/.test(s)&&Number(s)<=100?BigInt(s.split('.')[0]!)*10000n+BigInt((s.split('.')[1]??'').padEnd(4,'0')):null;
// Six decimal USD inputs × four decimal percent. Preserve exact contributions (12 decimals).
function precise(n:bigint){const a=n<0n?-n:n;return (n<0n?'-':'')+(a/1000000000000n)+'.'+(a%1000000000000n).toString().padStart(12,'0');}
export function assessScenarioEV(rows:ResearchScenario[],at:string,exitAt:string|null,expiry:string|null,quantity:number|null) {
  validateScenarioRows(rows);const now=clock(at);if(now===null)fail('CLOCK');
  const reasons:string[]=[];if(!rows.length)reasons.push('PROBABILITY_REQUIRED','PAYOFF_UNKNOWN');
  if(!Number.isSafeInteger(quantity)||quantity!<=0)reasons.push('EXPLICIT_QUANTITY_REQUIRED');
  const end=clock(exitAt);if(end===null)reasons.push('PLANNED_EXIT_REQUIRED');
  let sum=0n,total=0n;
  const values=rows.map(r=>{
    const issues:string[]=[],p=percent(r.probability),payoff=money(r.payoff),parts=[r.costs.premiumUsd,r.costs.feesUsd,r.costs.slippageUsd].map(money);
    if(!r.probability)issues.push('PROBABILITY_REQUIRED');else if(p===null)issues.push('PROBABILITY_INVALID');
    if(p!==null)sum+=p;
    if(r.probabilitySource==='UNKNOWN')issues.push('PROBABILITY_SOURCE_UNKNOWN');
    if(r.probabilitySource==='CALIBRATED_MODEL')issues.push('CALIBRATED_MODEL_NOT_APPROVED');
    const observed=clock(r.probabilityAsOf);
    if(observed===null||observed>now!||!r.probabilityEvidenceRef.trim())issues.push('PROBABILITY_PROVENANCE_REQUIRED');
    if(payoff===null||r.payoffSource==='UNKNOWN')issues.push('PAYOFF_UNKNOWN');
    // There is no approved option-exit pricing calculator in this integration.
    if(r.payoffSource==='EXISTING_DETERMINISTIC_CALCULATOR')issues.push('PAYOFF_CALCULATOR_NOT_AVAILABLE');
    if(!r.payoffEvidenceRef.trim())issues.push('PAYOFF_EVIDENCE_REQUIRED');
    if(clock(r.payoffAt)===null||clock(r.payoffAt)!==end||r.payoffBasis==='UNKNOWN')issues.push('PAYOFF_HORIZON_MISMATCH');
    if(r.payoffBasis==='EXPIRATION'&&(!expiry||clock(r.payoffAt)===null||guidanceLocal(r.payoffAt).date!==expiry))issues.push('EXPIRY_PAYOFF_IS_NOT_EARLY_EXIT');
    if(parts.some(p=>p===null)||!r.costs.evidenceRef.trim())issues.push('COST_UNKNOWN');
    const knownPayoffAndCosts=!issues.some(c=>c.startsWith('PAYOFF_')||c==='EXPIRY_PAYOFF_IS_NOT_EARLY_EXIT'||c==='COST_UNKNOWN');
    const net=knownPayoffAndCosts&&payoff!==null&&parts.every(p=>p!==null)?payoff-parts[0]!-parts[1]!-parts[2]!:null;
    const contribution=issues.length||p===null||net===null?null:p*net;
    if(contribution!==null)total+=contribution;
    reasons.push(...issues.map(c=>r.scenarioId+':'+c));
    return {...r,netPayoff:net===null?null:manualUsd(net),contributionUsd:contribution===null?null:precise(contribution),issues};
  });
  if(sum!==1000000n)reasons.push('PROBABILITY_SUM_INVALID');
  // Premium is one position's entry cost, not a scenario-dependent payoff assumption.
  if(new Set(rows.map(r=>r.costs.premiumUsd?money(r.costs.premiumUsd)?.toString():null)).size>1)reasons.push('PREMIUM_COST_INCONSISTENT');
  return {kind:'ASSUMPTION_EV',status:reasons.length?'NOT_CALCULABLE':'CALCULATED',assumptionEvUsd:reasons.length?null:precise(total),validatedEv:'UNKNOWN',probabilityUnit:'PERCENT',probabilitySumPercent:Number(sum)/10000,quantity,rows:values,reasons,executionAllowed:false,positionSizingChanged:false,
    limitation:'All rows are required scenarios. Gross payoff means whole-position proceeds at the declared exit time, before subtracting entry premium and costs. Attributed assumptions are not calibrated probabilities. Positive assumption EV does not create trade permission.'};
}
export type FitStatus='WITHIN_PLAN'|'OUTSIDE_PLAN'|'UNKNOWN'|'BLOCKED_BY_EXISTING_RULE';
/** Descriptive projection of existing candidates and an explicitly selected plan/quantity. */
export function assessContractFit({at,context,quote,sensitivity,settings,originalBlockers=[] as string[],quantity}:any){
  const dimensions:{dimension:string;value:unknown;sourceTime:string|null;status:FitStatus;reason:string}[]=[];
  const add=(dimension:string,value:unknown,status:FitStatus,reason:string,time:string|null=null)=>dimensions.push({dimension,value,sourceTime:time,status,reason});
  const plan=context.plan,t=plan.invalidation??{},q=quote,stamp=q?.updatedAt??null;
  const direction=context.contract?.optionType??context.fields?.optionType, symbol=context.contract?.symbol??context.fields?.symbol;
  add('Direction fit',direction||'UNKNOWN',!q||!direction?'UNKNOWN':symbol===q.symbol&&direction.toLowerCase()===q.type?'WITHIN_PLAN':'OUTSIDE_PLAN','Direction comes only from the saved single-leg plan; Greeks do not predict direction.',context.registeredAt);
  const horizon=[t.realizationEndAt,plan.timeExitAt],event=t.conditions?.find((c:any)=>c.id===t.eventEntry?.conditionId)??t.conditions?.find((c:any)=>c.releaseAt);
  const expirySession=q?.expiry?paperSession(q.expiry+'T16:00:00.000Z',undefined):null;
  const covers=(v:string)=>{if(!q||clock(v)===null||!expirySession?.knownYear||expirySession.holiday)return null;const l=guidanceLocal(v);return l.date<q.expiry||l.date===q.expiry&&l.minute<expirySession.closeMinute;};
  const coverage=horizon.map(covers),entry=plan.entryDeadlineAt;
  const calendarKnown=expirySession?.knownYear===true&&!expirySession.holiday;
  add('Event / thesis horizon',{releaseAt:event?.releaseAt||null,entryDeadlineAt:entry||null,realizationEndAt:t.realizationEndAt||null,maxExitAt:plan.timeExitAt||null,expiry:q?.expiry??null},coverage.includes(false)?'OUTSIDE_PLAN':coverage.every(x=>x===true)&&clock(entry)!==null?'WITHIN_PLAN':'UNKNOWN','Expiry must cover both realization and latest exit, including the reviewed close. Missing times or an unreviewed calendar remain unknown. Longer DTE is not automatically better.',context.registeredAt);
  const dte=q&&calendarKnown?Math.round((Date.parse(q.expiry+'T00:00:00Z')-Date.parse(guidanceLocal(at).date+'T00:00:00Z'))/86400000):null;
  add('DTE',dte,coverage.includes(false)?'OUTSIDE_PLAN':'UNKNOWN','Calendar days only; no plan-specific DTE threshold is defined here. Original candidate rules are retained separately.',stamp);
  for(const name of ['delta','gamma','theta','vega'])add(name[0]!.toUpperCase()+name.slice(1),sensitivity?.metrics?.[name]?.value??(name==='delta'?q?.delta??null:null),'UNKNOWN','Exposure description only; no plan threshold. Independent Greek clock is unknown.',sensitivity?.sourceAt??stamp);
  add('IV context',{currentPercent:sensitivity?.impliedVolatilityPercent??null,rank:null,percentile:null,history:null},'UNKNOWN','No historical IV context or approved plan IV threshold; a level alone is not cheap or expensive.',sensitivity?.sourceAt??stamp);
  const bid=q?.bidCents,ask=q?.askCents,valid=q&&q.multiplier===100&&Number.isSafeInteger(bid)&&Number.isSafeInteger(ask)&&bid>0&&ask>=bid;
  add('Bid / ask spread',valid?{bidCents:bid,askCents:ask,spreadCents:ask-bid,midpointCents:(ask+bid)/2,spreadOverMidpointPercent:200*(ask-bid)/(ask+bid)}:null,'UNKNOWN','No additional spread threshold is introduced. Zero, crossed or invalid quotes cannot produce a midpoint. Existing candidate blockers remain below.',stamp);
  add('Liquidity',{bidSize:q?.bidSize??null,askSize:q?.askSize??null,volume:null,openInterest:null},'UNKNOWN','Size is quoted, not guaranteed execution. Volume and open interest are not part of this verified guidance capture projection.',stamp);
  // Source freshness is inherited from the original guidance assessment (including ETF alignment).
  const clocksOkay=clock(stamp)!==null&&clock(q?.receivedAt)!==null&&clock(stamp)!<=clock(q?.receivedAt)!&&clock(q?.receivedAt)!<=clock(at)!;
  const stale=originalBlockers.some((s:string)=>/NOT_FRESH|CLOCK_MISMATCH/.test(s));
  const fresh=!!q&&clocksOkay&&!stale;
  add('Quote freshness',{reference:stale?'STALE_REFERENCE':fresh?'SAVED_QUOTE_WITHIN_EXISTING_WINDOW':'UNKNOWN',sourceAt:stamp,receivedAt:q?.receivedAt??null,assessedAt:at},fresh?'WITHIN_PLAN':'BLOCKED_BY_EXISTING_RULE','Uses existing guidance freshness and matching-source rules. Receipt order is checked; a recent file save cannot refresh a quote.',stamp);
  const explicit=Number.isSafeInteger(quantity)&&quantity>0;
  const premium=explicit&&valid?BigInt(ask)*BigInt(quantity)*100n:null;
  // Guidance stores per-contract costs; the existing risk engine accepts whole-position totals.
  const totalFees=explicit&&settings?.roundTripFeesCents!=null?settings.roundTripFeesCents*quantity:null;
  const totalSlippage=explicit&&settings?.slippageReserveCents!=null?settings.slippageReserveCents*quantity:null;
  let risk:any=null;const blockers=[...originalBlockers];
  if(explicit&&valid&&settings)risk=evaluateOptionsPlanningFeasibility({...settings,roundTripFeesCents:totalFees,slippageReserveCents:totalSlippage,symbol:q.symbol,strategy:q.type==='call'?'LONG_CALL':'LONG_PUT',quantity,contractMultiplier:100,bidPerShareCents:bid,askPerShareCents:ask,minimumPriceTickCents:q.tickCents??-1,mode:'NORMAL'});
  if(risk)blockers.push(...risk.blockers.map((b:any)=>b.code));else blockers.push('RISK_INPUTS_UNKNOWN');
  if(!explicit)blockers.push('EXPLICIT_QUANTITY_REQUIRED');
  if(!Number.isSafeInteger(plan.maxContracts)||quantity>plan.maxContracts)blockers.push('PLAN_QUANTITY_UNDEFINED_OR_EXCEEDED');
  const maxDebit=money(plan.maxEntryDebitUsd??'');
  const required=risk?.economics?.capitalRequiredCents;
  if(premium!==null&&(maxDebit===null||(required!=null?BigInt(required):premium)*10000n>maxDebit))blockers.push(maxDebit===null?'PLAN_PREMIUM_LIMIT_UNKNOWN':'PLAN_PREMIUM_LIMIT_EXCEEDED');
  const stress=risk?.economics?.stressLossCents??null;
  add('Premium / maximum loss',{quantity:explicit?quantity:null,premiumUsd:premium===null?null:manualUsd(premium*10000n),knownStressLossCents:stress,planPremiumUsd:plan.maxEntryDebitUsd||null,planDeclaredLossUsd:plan.plannedRiskUsd||null,valuation:fresh?'SAVED_QUOTE_SCENARIO':'REFERENCE_ONLY'},blockers.some((b:string)=>/EXCEEDED|RISK_INPUTS|PLAN_PREMIUM_LIMIT|QUANTITY/.test(b))?'BLOCKED_BY_EXISTING_RULE':premium===null?'UNKNOWN':'WITHIN_PLAN','Original risk engine uses this exact quantity. No resizing; a stop does not cap gap loss.',stamp);
  add('Known fees',{perContractFeesCents:settings?.roundTripFeesCents??null,perContractSlippageCents:settings?.slippageReserveCents??null,totalFeesCents:totalFees,totalSlippageCents:totalSlippage},totalFees===null||totalSlippage===null?'UNKNOWN':'WITHIN_PLAN','Existing per-contract declarations multiplied by this explicit quantity once, not broker bills. Unknown is never zero. Current policy stop calculation is a comparison, not a replacement for the frozen plan stop.',at);
  let nextTradableAt:string|null=null;
  if(clock(event?.releaseAt)!==null){const start=new Date(event.releaseAt);start.setUTCSeconds(0,0);for(let i=0;i<8*24*60;i++){const v=new Date(start.getTime()+i*60000).toISOString();if(paperSession(v,undefined).isOpen){nextTradableAt=v;break;}}}
  add('Event gap risk',{phase:t.eventEntry?.phase||'UNCONFIGURED',holdThroughEvent:t.holdThroughEvent||'UNKNOWN',gapRiskAccepted:t.eventEntry?.gapRiskAccepted??false,closedMarketRiskAccepted:t.eventEntry?.closedMarketRiskAccepted??false,releaseAt:event?.releaseAt||null,nextScheduledTradableAt:nextTradableAt},'UNKNOWN','PRE_EVENT retains event/gap risk. No stop execution is possible while the option market is closed. Scheduled reopening does not guarantee a tradable quote or fill.',t.eventEntry?.calendarVerifiedAt||null);
  add('Exit observability',{path:'SUPPORTED_BY_EXISTING_QUOTE_PATH',coverage:'MANUAL_REVIEW_REQUIRED',fallback:t.manualFallback||null,nextCheckAt:t.nextCheckAt||null},'UNKNOWN','Owner-triggered quotes require an eligible real position, verified contract identity, explicit request and regular session. 15:50 collection is not continuous monitoring; future exit evidence is not guaranteed.',context.registeredAt);
  if(dimensions.some(d=>d.status==='OUTSIDE_PLAN'))blockers.push('CONTRACT_OUTSIDE_PLAN');
  if(dimensions.find(d=>d.dimension==='Event / thesis horizon')?.status==='UNKNOWN')blockers.push('PLAN_HORIZON_UNKNOWN');
  if(context.kind==='FROZEN'&&q&&(!context.contract||q.symbol!==context.contract.symbol||q.type.toUpperCase()!==context.contract.optionType||q.expiry!==context.contract.expiry||Number(q.strike)!==Number(context.contract.strikeUsd)||q.multiplier!==context.contract.multiplier))blockers.push('FROZEN_CONTRACT_SELECTION_MISMATCH');
  if(!q)blockers.push('QUOTE_EVIDENCE_MISSING');if(!fresh)blockers.push('CURRENT_QUOTE_UNAVAILABLE');
  if(context.kind!=='FROZEN')blockers.push('PLAN_NOT_FROZEN');
  return {status:blockers.length?'NOT_READY_FOR_CURRENT_COMPARISON':'RESEARCH_COMPARISON_ONLY',assessedAt:at,planId:context.tradeId,planVersion:context.version,contractId:q?.id??null,quantity,dimensions,blockers:[...new Set(blockers)],risk,executionAllowed:false,positionSizingChanged:false,limitation:'Scenario EV and Contract Fit do NOT create trade permission. Original event, risk, source and confirmation gates remain independent.'};
}
