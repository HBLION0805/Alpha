import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {createHash} from 'node:crypto';
import {assessThreeFacet} from '../../src/engines/options-three-facet/OptionsThreeFacet.ts';
import {assessSnapshotQuote,snapshotNs,snapshotCents} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {paperSession} from '../../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';
import {engineeringObservationPolicy} from './options-real-data-paper-timing.mjs';

export const TECH_PAPER_SCOPE=Object.freeze(['AAPL','TSM','QQQ','TSLA']);
const KINDS=['CONTRACT','DATA_ENTITLEMENT','PRODUCT_PERMISSION','ACCOUNT_FUNDS','RISK_LIMITS','QUOTE'];
const int=(v,min=0,max=100000000)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=2000;
const sha=v=>createHash('sha256').update(v,'utf8').digest('hex');
const identity=q=>[q.id,q.symbol,q.expiry,q.type,q.strike,q.multiplier].join('|');
const includes=(v,s)=>Array.isArray(v)&&v.length<=10&&v.includes(s);
/** Offline attributed feasibility only. No registration, source call or fill authority. */
export function assessTechPaperFeasibility({research,evidence=null,at}) {
  const researchReview=assessThreeFacet(research);
  const direction=research?.fundamental?.direction??'UNKNOWN';
  // Preserve every existing engine blocker by default, including future additions.
  // Only these explicit pending confirmation requirements may be deferred for a trial research opinion.
  const deferredConfirmation=new Set(['TECHNICAL_EVIDENCE_UNKNOWN','TECHNICAL_TRIGGER_EVIDENCE_UNKNOWN',
    'THREE_FACET_DIRECTION_NOT_ALIGNED','NEWS_TRIGGER_PENDING','PRICE_STRUCTURE_NOT_CONFIRMED',
    'VOLUME_NOT_CONFIRMED','OUTSIDE_ENTRY_ZONE']);
  const trialBlockers=(researchReview.blockers??[]).filter(b=>!deferredConfirmation.has(b));
  if(researchReview.researchStatus!=='RETAINED_UNVALIDATED')trialBlockers.push('RESEARCH_REGISTRATION_REQUIRED');
  if(!['UP','DOWN'].includes(direction)||research?.news?.direction!==direction)trialBlockers.push('DIRECTION_THESIS_NOT_ALIGNED');
  if(!TECH_PAPER_SCOPE.includes(research?.symbol))trialBlockers.push('TECH_SYMBOL_UNSUPPORTED');
  if(!Number.isFinite(Date.parse(at))||Date.parse(research?.asOf)>Date.parse(at)||!(Date.parse(research?.holdingThrough)>=Date.parse(at)))trialBlockers.push('RESEARCH_CURRENT_WINDOW_INVALID');
  const trial={status:trialBlockers.length?'WITHHELD':'PRE_CONFIRMATION_RESEARCH_CANDIDATE',direction,blockers:[...new Set(trialBlockers)],technicalConfirmationRequired:false,executionAllowed:false,positionSizingAllowed:false,meaning:'A prospective directional research opinion only; it creates no position and does not override the original frozen trial condition.'};
  const base={version:'TECH_PAPER_FEASIBILITY_V1',assessedAt:at,
    authority:'ATTRIBUTED_FEASIBILITY_NOT_PERMISSION_OR_FILL',
    research:{symbol:research?.symbol??null,direction:research?.fundamental?.direction??'UNKNOWN',
      hypothesis:research?.researchPlan?.hypothesis??null,conditions:research?.researchPlan??null,
      trial,confirmation:{status:researchReview.quoteReviewEligible?'READY_FOR_QUOTE_REVIEW':'WAIT',blockers:researchReview.blockers},
      status:researchReview.researchStatus,quoteReviewEligible:researchReview.quoteReviewEligible,
      blockers:researchReview.blockers,assessment:researchReview},
    executionAllowed:false,paperAdmissionAllowed:false,positionSizingAllowed:false,
    paper:{status:'NOT_ARMED',blockers:['TECH_SYMBOL_LIFECYCLE_NOT_INTEGRATED'],fills:0,pnl:null}};
  const blockers=[],quoteBlockers=[];
  let quote=null,economics=null,observationPolicy=null,synthetic=false;
  try {
    const now=snapshotNs(at);
    if(!TECH_PAPER_SCOPE.includes(research?.symbol))blockers.push('TECH_SYMBOL_UNSUPPORTED');
    if(researchReview.researchStatus!=='RETAINED_UNVALIDATED')blockers.push('RESEARCH_REGISTRATION_REQUIRED');
    if(snapshotNs(research?.asOf)>now)blockers.push('RESEARCH_FROM_FUTURE');
    if(!evidence)return {...base,status:'BLOCKED',feasibilityPassed:false,blockers:[...blockers,'PAPER_EVIDENCE_MISSING'],
      quote:{status:'MISSING',blockers:['QUALIFIED_OPTION_QUOTE_MISSING']},economics:null};
    const e=evidence;
    if(e.version!=='TECH_PAPER_EVIDENCE_V1'||e.symbol!==research.symbol||!text(e.accountId)||
      e.quantity!==1||!Array.isArray(e.records)||e.records.length!==KINDS.length)throw Error('EVIDENCE_SCHEMA');
    const decision=snapshotNs(e.decisionAt),deadline=snapshotNs(e.entryDeadlineAt),exit=snapshotNs(e.timeExitAt);
    if(snapshotNs(research.researchPlan?.registeredAt)>decision||snapshotNs(research.asOf)>decision||
      decision>=deadline||deadline>=exit||decision>now||now>deadline)blockers.push('DECISION_WINDOW_INVALID');
    if(snapshotNs(e.costsFrozenAt)>decision)blockers.push('COSTS_NOT_FROZEN_BEFORE_DECISION');
    if(!int(e.entryFeeCents)||!int(e.exitFeeCents)||!int(e.exitSlippageCents,0,10000))blockers.push('COSTS_UNKNOWN');
    if(!int(e.entryLimitCents,1,100000)||!int(e.maxSpreadCents,1,10000))blockers.push('LIMIT_OR_SPREAD_INVALID');
    const records=new Map(),payloads=new Map();
    for(const r of e.records){
      if(!r||!KINDS.includes(r.kind)||records.has(r.kind)||!text(r.source)||!text(r.reviewedBy)||
        !['OWNER_DOCUMENT','PROVIDER_DOCUMENT','SYNTHETIC_FIXTURE'].includes(r.origin)||
        typeof r.rawJson!=='string'||r.rawJson.length>65536||!/^[a-f0-9]{64}$/.test(r.sha256)||
        sha(r.rawJson)!==r.sha256)throw Error('EVIDENCE_INTEGRITY');
      const observed=snapshotNs(r.observedAt),received=snapshotNs(r.receivedAt),reviewed=snapshotNs(r.reviewedAt),through=snapshotNs(r.validThrough);
      if(observed>received||received>reviewed||reviewed>now||through<now||through<exit||
        (r.kind!=='QUOTE'&&reviewed>decision))blockers.push(r.kind+'_CLOCK_OR_VALIDITY');
      if(r.verdict!=='PASS')blockers.push(r.kind+'_NOT_REVIEWED');
      if(r.origin==='SYNTHETIC_FIXTURE')synthetic=true;
      const p=parseChainSurveyJson(r.rawJson);
      if(!p||typeof p!=='object'||Array.isArray(p))throw Error('EVIDENCE_PAYLOAD');
      records.set(r.kind,r);payloads.set(r.kind,p);
    }
    const c=payloads.get('CONTRACT'),permission=payloads.get('PRODUCT_PERMISSION'),entitlement=payloads.get('DATA_ENTITLEMENT');
    const funds=payloads.get('ACCOUNT_FUNDS'),risk=payloads.get('RISK_LIMITS');
    const q=payloads.get('QUOTE'),qr=records.get('QUOTE'),cr=records.get('CONTRACT');
    if(!c||!q||!qr||!cr||!permission||!entitlement||!funds||!risk)throw Error('EVIDENCE_KINDS');
    const product=c.type==='call'?'LONG_CALL':c.type==='put'?'LONG_PUT':null;
    if(c.symbol!==e.symbol||!text(c.id)||!product||c.multiplier!==100||
      !int(snapshotCents(c.strike),1)||c.deliverable!=='STANDARD_100_SHARES_USD'||
      c.exerciseStyle!=='AMERICAN'||c.tradability!=='tradable')blockers.push('CONTRACT_OR_PRODUCT_UNSUPPORTED');
    snapshotNs(c.expiry+'T00:00:00Z');
    if(!/^\d{4}-\d\d-\d\d$/.test(c.expiry))blockers.push('CONTRACT_EXPIRY_INVALID');
    if(permission.accountId!==e.accountId||permission.enabled!==true||
      !includes(permission.symbols,e.symbol)||!includes(permission.products,product))blockers.push('PRODUCT_PERMISSION_MISSING');
    if(!text(entitlement.provider)||entitlement.provider!==qr.source||cr.source!==qr.source||
      !includes(entitlement.symbols,e.symbol)||entitlement.realtimeOptions!==true||entitlement.localRetention!==true)
      blockers.push('DATA_ENTITLEMENT_MISSING');
    if(funds.accountId!==e.accountId||funds.currency!=='USD'||!int(funds.settledCashCents)||
      !int(funds.reservedCashCents)||funds.reservedCashCents>funds.settledCashCents)blockers.push('ACCOUNT_FUNDS_UNKNOWN');
    if(risk.accountId!==e.accountId||!int(risk.tradeBudgetMaxCents,1)||!int(risk.maximumLossCents,1))
      blockers.push('RISK_LIMITS_UNKNOWN');
    if(identity(c)!==identity(q))quoteBlockers.push('EXACT_CONTRACT_MISMATCH');
    if(q.updatedAt!==qr.observedAt||q.receivedAt!==qr.receivedAt)quoteBlockers.push('QUOTE_ENVELOPE_CLOCK_MISMATCH');
    if(snapshotNs(q.updatedAt)<=decision||snapshotNs(q.receivedAt)<=decision)quoteBlockers.push('QUOTE_NOT_AFTER_DECISION');
    if(now-snapshotNs(q.updatedAt)>120000000000n)quoteBlockers.push('SELECTION_QUOTE_STALE');
    const assessment=assessSnapshotQuote(q,at,true,true);
    quoteBlockers.push(...assessment.blockers);
    if(assessment.staleNow)quoteBlockers.push('QUOTE_STALE_NOW');
    if(!paperSession(at,q.chainSession).isOpen)quoteBlockers.push('ASSESSMENT_OUTSIDE_SESSION');
    if(!int(q.tickCents,1,100))quoteBlockers.push('TICK_UNKNOWN');
    else {
      const mechanical=Math.max(q.tickCents,Math.min(10,Math.floor(q.askCents/10/q.tickCents)*q.tickCents||q.tickCents));
      if(q.askCents-q.bidCents>Math.min(e.maxSpreadCents,mechanical))quoteBlockers.push('SPREAD_LIMIT_EXCEEDED');
      if(e.exitSlippageCents<q.tickCents)blockers.push('EXIT_SLIPPAGE_BELOW_EXISTING_TICK_RESERVE');
    }
    if(q.askSize<e.quantity||q.bidSize<e.quantity)quoteBlockers.push('DISPLAYED_SIZE_INSUFFICIENT');
    if(q.askCents>e.entryLimitCents)quoteBlockers.push('ENTRY_LIMIT_EXCEEDED');
    if(!['call','put'].includes(q.type)||q.symbol!==e.symbol)quoteBlockers.push('QUOTE_PRODUCT_MISMATCH');
    const prepared=new Date(Number((decision-30000000000n)/1000000n)).toISOString();
    observationPolicy=engineeringObservationPolicy(prepared,q.chainSession);
    if(!observationPolicy.sufficient||e.entryDeadlineAt!==new Date(Number((decision+120000000000n)/1000000n)).toISOString()||
      e.timeExitAt!==new Date(Number((decision+420000000000n)/1000000n)).toISOString()||
      !paperSession(e.timeExitAt,q.chainSession).isOpen)blockers.push('EXISTING_ENGINEERING_WINDOW_OR_EXIT_RESERVE');
    const cost=e.entryFeeCents+e.exitFeeCents+e.exitSlippageCents*100*e.quantity;
    const premium=q.askCents*100*e.quantity,total=premium+cost,available=funds.settledCashCents-funds.reservedCashCents;
    if(![cost,premium,total,available].every(v=>int(v)))blockers.push('ECONOMICS_INVALID');
    else {
      economics={fullPremiumCents:premium,costReserveCents:cost,fullLossReserveCents:total,availableSettledCashCents:available,
        tradeBudgetMaxCents:risk.tradeBudgetMaxCents,maximumLossCents:risk.maximumLossCents};
      if(total>available)blockers.push('SETTLED_CASH_INSUFFICIENT');
      if(total>risk.tradeBudgetMaxCents)blockers.push('TRADE_BUDGET_EXCEEDED');
      if(total>risk.maximumLossCents)blockers.push('MAXIMUM_LOSS_EXCEEDED');
    }
    quote={status:quoteBlockers.length?'BLOCKED':'QUALIFIED_SNAPSHOT_ONLY',blockers:[...new Set(quoteBlockers)],assessment};
  }catch(error){
    blockers.push('TECH_PAPER_'+(/^[A-Z_]+$/.test(error?.message)?error.message:'INPUT_INVALID'));
  }
  if(quoteBlockers.length)blockers.push('QUOTE_NOT_QUALIFIED');
  const mechanicalPassed=blockers.length===0;
  return {...base,status:!mechanicalPassed?'BLOCKED':synthetic?'SYNTHETIC_ONLY':'ATTRIBUTED_FEASIBILITY_PASSED',
    feasibilityPassed:mechanicalPassed&&!synthetic,mechanicalChecksPassed:mechanicalPassed,
    blockers:[...new Set([...blockers,...(synthetic?['SYNTHETIC_EVIDENCE_NOT_MARKET_ACCEPTANCE']:[])])],
    researchAndFeasibilityAligned:mechanicalPassed&&!synthetic&&researchReview.quoteReviewEligible,
    quote:quote??{status:'BLOCKED',blockers:quoteBlockers},economics,observationPolicy,
    evidenceFingerprint:evidence?paperFingerprint(evidence):null,
    limitation:'Copied documents and reviews are attributed claims, not independent authentication. A later isolated lifecycle adapter is still required.'};
}
