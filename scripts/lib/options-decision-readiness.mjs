const VERSION='OPTIONS_DECISION_READINESS_V1';
const AUTHORITY='READ_ONLY_MODELED_COST_AND_EVIDENCE_PREFLIGHT';

const unique=values=>[...new Set(values)];
const safeInt=value=>Number.isSafeInteger(value)&&value>=0;

function modeledCandidate(reference,budget){
  const q=reference.contract??{},cost=reference.costExample;
  const premium=safeInt(cost?.premiumCents)?cost.premiumCents:
    safeInt(q.askCents)&&safeInt(q.multiplier)?q.askCents*q.multiplier:null;
  const fees=safeInt(cost?.feeReserveCents)?cost.feeReserveCents:null;
  const allIn=premium===null||fees===null?null:premium+fees;
  const withinBudget=allIn===null?null:allIn>=budget.minCents&&allIn<=budget.maxCents;
  const modeledBlockers=cost?unique([
    ...(reference.blockers??[]).filter(code=>code!=='COSTS_UNKNOWN'),
    ...(cost.blockers??[]).filter(code=>code!=='COSTS_UNKNOWN')
  ]):unique(reference.blockers??[]);
  if(cost===null)modeledBlockers.push('MODELED_COST_SCENARIO_UNAVAILABLE');
  if(withinBudget===false)modeledBlockers.push('MODELED_ALL_IN_CAPITAL_OUTSIDE_OWNER_RANGE');
  const evidenceClear=modeledBlockers.length===0;
  return {
    contract:{id:q.id,symbol:q.symbol,expiry:q.expiry,type:q.type,strike:q.strike,multiplier:q.multiplier,
      bidCents:q.bidCents,askCents:q.askCents,tickCents:q.tickCents,bidSize:q.bidSize,askSize:q.askSize,delta:q.delta,
      updatedAt:q.updatedAt,receivedAt:q.receivedAt},
    issuedDisposition:reference.disposition,
    originalBlockers:reference.blockers??[],
    modeledCostBasis:cost?.basis??null,
    modeledFeeProfile:cost?.profile??null,
    modeledEconomics:{premiumCents:premium,feeReserveCents:fees,allInCapitalCents:allIn,
      exitAllowanceCents:cost?.exitAllowanceCents??null,plannedRiskCents:cost?.plannedRiskCents??null,
      netTargetCents:cost?.netTargetCents??null,targetPerShareCents:cost?.targetPerShareCents??null},
    withinOwnerCapitalRange:withinBudget,modeledBlockers:unique(modeledBlockers),
    state:evidenceClear?'MODELED_COST_AND_EVIDENCE_CLEAR_NOT_AUTHORIZED':
      withinBudget===false?'MODELED_CAPITAL_CONFLICT':'MODELED_COST_FEASIBLE_EVIDENCE_BLOCKED',
    brokerFeesConfirmed:false,selectedTrade:false,executionAllowed:false
  };
}
export function decisionReadinessProjection(state){
  const cards=state?.decisionCards?.data??state?.decisionCards;
  const guidance=state?.guidance?.data?.current??state?.guidance?.current;
  const budget=guidance?.settings?.tradeBudget;
  if(!cards?.cards||!budget||budget.version!=='OWNER_ALLOCATION_ONLY_V2'||
    !safeInt(budget.minCents)||!safeInt(budget.maxCents)||budget.minCents>budget.maxCents)
    throw Error('DECISION_READINESS_INPUT');
  const assets=cards.cards.map(card=>{
    const candidates=(card.references??[]).map(ref=>modeledCandidate(ref,budget));
    return {symbol:card.symbol,issuedAction:card.action,reviewCurrent:cards.reviewCurrent,
      trend:card.trend?.direction??null,bias:card.bias??null,originalBlockers:card.blockers??[],
      candidates,counts:{
        sampled:candidates.length,
        withinCapitalRange:candidates.filter(c=>c.withinOwnerCapitalRange===true).length,
        modeledEvidenceClear:candidates.filter(c=>c.modeledBlockers.length===0).length
      }};
  });
  const all=assets.flatMap(a=>a.candidates);
  return {version:VERSION,authority:AUTHORITY,assessedAt:cards.assessedAt??guidance.assessedAt,
    marketCapturedAt:cards.marketCapturedAt??guidance.marketCapturedAt,analysisAt:cards.analysisAt??null,
    reviewCurrent:cards.reviewCurrent??false,
    ownerCapitalRange:{minCents:budget.minCents,maxCents:budget.maxCents},
    assets,summary:{candidateCount:all.length,withinCapitalRange:all.filter(c=>c.withinOwnerCapitalRange===true).length,
      modeledEvidenceClear:all.filter(c=>c.modeledBlockers.length===0).length},
    unresolvedAuthority:[
      'Reviewed fee schedule is a modeled assumption; brokerage applicability and realized charges remain unconfirmed.',
      'A modeled feasible candidate is not a selected trade. Entry trigger, exact time exit and Owner approval must be frozen separately.',
      'This projection never changes canonical guidance, Decision Evidence, capital settings, orders or execution.'
    ],
    canonicalDecisionEligible:false,ownerAuthorityRequired:true,executionAllowed:false,
    marketCalls:0,accountCalls:0,positionCalls:0,orderCalls:0};
}
