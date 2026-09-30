// Read-only preparation, not a second plan authority or an entry detector.
const data=c=>c?.data;
const unique=xs=>[...new Set(xs)];
const clock=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v)&&
  Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString().slice(0,19)===v.slice(0,19)?Date.parse(v):NaN;
// Normalized lexical comparison keeps source nanoseconds; Date.parse alone truncates them.
const clockKey=v=>Number.isFinite(clock(v))?v.slice(0,19)+'.'+(v.split('.')[1]?.slice(0,-1)??'').padEnd(9,'0')+'Z':null;
const clockBeforeOrEqual=(a,b)=>clockKey(a)!==null&&clockKey(b)!==null&&clockKey(a)<=clockKey(b);
const nonnegativeInt=v=>Number.isSafeInteger(v)&&v>=0;
const positiveInt=v=>Number.isSafeInteger(v)&&v>0;
const micro=v=>{const [a,b='']=v.split('.');return BigInt(a)*1000000n+BigInt(b.padEnd(6,'0'));};
const positive=v=>typeof v==='string'&&/^\d+(?:\.\d{1,6})?$/.test(v)&&/[1-9]/.test(v);
const price=v=>typeof v==='string'&&/^\d+(?:\.\d{1,6})?$/.test(v)?v.replace(/^0+(?=\d)/,'').replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,''):null;
function sameContract(fields,q){
  return fields?.symbol===q.symbol&&fields?.optionType===q.type.toUpperCase()&&
    fields?.expiry===q.expiry&&price(fields?.strikeUsd)!==null&&price(fields.strikeUsd)===price(q.strike);
}
function draftChecks(record,at){
  if(!record)return {tradeId:null,savedAt:null,missing:['OWNER_PLAN_DRAFT_MISSING'],complete:false};
  const f=record.command.draft.fields,missing=[];
  for(const key of ['maxEntryDebitUsd','plannedRiskUsd','targetNetProfitUsd','stopPremiumUsd'])
    if(!positive(f[key]))missing.push('PLAN_'+key.toUpperCase()+'_MISSING_OR_INVALID');
  if(!/^[1-9]\d*$/.test(String(f.maxContracts??'')))missing.push('PLAN_QUANTITY_MISSING_OR_INVALID');
  const declared=clock(f.declaredAt),deadline=clock(f.entryDeadlineAt),exit=clock(f.timeExitAt);
  if(!Number.isFinite(declared)||declared>clock(record.savedAt)||declared>at)missing.push('PLAN_DECLARATION_MISSING_OR_FUTURE');
  if(!Number.isFinite(deadline)||deadline<=at||deadline<=declared)missing.push('PLAN_ENTRY_DEADLINE_MISSING_OR_EXPIRED');
  if(!Number.isFinite(exit)||exit<=at||exit<deadline)missing.push('PLAN_TIME_EXIT_MISSING_OR_INVALID');
  if(positive(f.stopPremiumUsd)&&positive(f.maxEntryDebitUsd)&&/^[1-9]\d*$/.test(String(f.maxContracts??''))&&
    micro(f.stopPremiumUsd)*BigInt(f.maxContracts)*100n>=micro(f.maxEntryDebitUsd))
    missing.push('PLAN_STOP_NOT_BELOW_MAX_ENTRY_DEBIT');
  if(typeof f.thesis!=='string'||!f.thesis.trim())missing.push('PLAN_THESIS_MISSING');
  return {tradeId:record.command.tradeId,savedAt:record.savedAt,missing,complete:missing.length===0,
    authority:'CHECKLIST_ONLY_EXISTING_PREVIEW_AND_OWNER_FREEZE_REQUIRED'};
}
export function ownerPlanPreparation(state){
  const cards=data(state.decisionCards),readiness=data(state.decisionReadiness),setup=data(state.etfSetup);
  const now=clock(state.loadedAt);
  if(!cards?.cards||!readiness?.assets||!Number.isFinite(now))throw Error('OWNER_PLAN_INPUT_UNAVAILABLE');
  const assessmentCurrent=cards.assessedAt===state.loadedAt&&readiness.assessedAt===state.loadedAt;
  const frozen=new Set((data(state.manual)?.trades??[]).map(t=>t.tradeId)),drafts=new Map();
  for(const r of data(state.manual)?.planRecords??[]){
    if(r.command?.type==='SAVE_PLAN_DRAFT'&&!frozen.has(r.command.tradeId)&&clock(r.savedAt)<=now)
      drafts.set(r.command.tradeId,r);
  }
  const rows=cards.cards.flatMap(card=>(card.references??[]).map(reference=>{
    const q=reference.contract,asset=readiness.assets.find(a=>a.symbol===card.symbol);
    const modeled=asset?.candidates.find(c=>c.contract.id===q.id&&sameContract({symbol:c.contract.symbol,
      optionType:c.contract.type.toUpperCase(),expiry:c.contract.expiry,strikeUsd:c.contract.strike},q));
    const rule=setup?.assets?.find(a=>a.symbol===card.symbol);
    const expected=q.type==='call'?'BULLISH':q.type==='put'?'BEARISH':null;
    const directionAligned=!!expected&&card.bias===expected&&card.trend?.direction===(expected==='BULLISH'?'UP':'DOWN');
    const sourceClocks=[cards.marketCapturedAt,cards.analysisAt,q.updatedAt,q.receivedAt,card.price?.sourceAt];
    const clocksKnownAndNotFuture=sourceClocks.every(t=>clockBeforeOrEqual(t,state.loadedAt));
    const reviewCurrent=cards.reviewCurrent===true&&clock(cards.analysisAt)>=clock(cards.marketCapturedAt)&&
      clock(cards.analysisAt)<=now&&now-clock(cards.analysisAt)<=86400000;
    const setupRow=rule?.rows?.find(r=>r.contract.id===q.id&&r.contract.symbol===q.symbol&&
      r.contract.type===q.type&&r.contract.expiry===q.expiry&&price(r.contract.strike)===price(q.strike)&&
      r.contract.updatedAt===q.updatedAt&&r.contract.receivedAt===q.receivedAt);
    const ruleClocksCurrent=rule?.assessedAt===state.loadedAt&&Number.isFinite(clock(rule?.triggerAt))&&
      clock(rule.triggerAt)<=now&&clock(rule?.registeredAt)<clock(rule?.plan?.activeFrom)&&
      clock(rule.plan.activeFrom)<clock(rule.triggerAt)&&clock(rule.triggerAt)<=clock(rule.source?.windowEnd)&&
      clock(rule.source?.windowEnd)<=clock(rule.source?.receivedAt)&&clock(rule.source?.receivedAt)<=now&&
      now-clock(rule.source?.windowEnd)<=300000&&clock(rule.plan.timeExit)>now;
    const researchMatchCurrent=!!(assessmentCurrent&&clocksKnownAndNotFuture&&rule?.status==='RULE_MATCH_OBSERVED'&&rule.plan?.symbol===q.symbol&&
      rule.plan?.side===expected&&setupRow&&ruleClocksCurrent&&!(rule.limitations??[]).includes('ETF_BARS_NOT_FRESH'));
    // All currently supported setup inputs remain imported research evidence.
    // Never accept a caller-supplied qualification boolean as a source adapter.
    const sourceQualified=false;
    const settings=data(state.guidance)?.current?.settings;
    // These are the unchanged canonical 120-second quote and 10% spread checks,
    // not new policy defaults. Missing fields never pass by absence of a blocker.
    const fresh=t=>clockBeforeOrEqual(t,state.loadedAt)&&clockBeforeOrEqual(new Date(now-120000).toISOString(),t);
    const etfFresh=assessmentCurrent&&positive(card.price?.price)&&fresh(card.price?.sourceAt);
    const optionFresh=assessmentCurrent&&fresh(q.updatedAt)&&Number.isFinite(clock(q.receivedAt))&&
      clockBeforeOrEqual(q.updatedAt,q.receivedAt)&&clockBeforeOrEqual(q.receivedAt,state.loadedAt);
    const spreadSize=assessmentCurrent&&positiveInt(q.bidCents)&&positiveInt(q.askCents)&&
      q.bidCents<=q.askCents&&(q.askCents-q.bidCents)*10<=q.askCents&&
      positiveInt(q.bidSize)&&positiveInt(q.askSize);
    const costsKnown=assessmentCurrent&&nonnegativeInt(settings?.roundTripFeesCents)&&nonnegativeInt(settings?.slippageReserveCents);
    const matching=[...drafts.values()].filter(r=>sameContract(r.command.draft.fields,q));
    const savedPlan=matching.length===1?draftChecks(matching[0],now):
      {tradeId:null,savedAt:null,missing:[matching.length?'MULTIPLE_MATCHING_OWNER_DRAFTS':'OWNER_PLAN_DRAFT_MISSING'],complete:false};
    const eventAssessment=savedPlan.tradeId?(data(state.eventEntryPlans)??[]).find(p=>
      p.tradeId===savedPlan.tradeId&&p.symbol===q.symbol&&p.assessedAt===state.loadedAt):null;
    const blockers=unique([
      ...(card.blockers??[]),...(reference.blockers??[]),...(modeled?.modeledBlockers??['READINESS_CANDIDATE_MISSING']),
      ...(!assessmentCurrent?['CURRENT_ASSESSMENT_MISMATCH']:[]),
      ...(!clocksKnownAndNotFuture?['EVIDENCE_CLOCK_MISSING_OR_FUTURE']:[]),
      ...(!reviewCurrent?['ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD']:[]),
      ...(!directionAligned?['ANALYSIS_TREND_CONTRACT_DIRECTION_MISMATCH']:[]),
      ...(cards.session?.knownYear===true&&cards.session?.isOpen===true?[]:['REGULAR_SESSION_NOT_OPEN']),
      ...(!etfFresh?['UNDERLYING_PRICE_NOT_FRESH']:[]),...(!optionFresh?['OPTION_QUOTE_NOT_FRESH']:[]),
      ...(!spreadSize?['SPREAD_OR_SIZE_NOT_VERIFIED']:[]),...(!costsKnown?['COSTS_UNKNOWN']:[]),
      ...(!researchMatchCurrent?['CURRENT_RESEARCH_ENTRY_TRIGGER_NOT_ESTABLISHED']:[]),
      ...(rule?.gaps??['ETF_SETUP_EVIDENCE_UNAVAILABLE']),...(rule?.limitations??[]),...(setupRow?.blockers??[]),
      ...(eventAssessment?.blockers??(savedPlan.tradeId?['SAVED_EVENT_APPROACH_ASSESSMENT_UNAVAILABLE']:[])),
      'QUALIFIED_ENTRY_SOURCE_NOT_CONNECTED',...savedPlan.missing,'OWNER_PREVIEW_AND_FREEZE_REQUIRED'
    ]);
    const thesis=['Owner preparation only; not an entry signal.',card.symbol,q.id,
      'Capture '+String(cards.marketCapturedAt??'unknown')+'; analysis '+String(cards.analysisAt??'unknown')+'.',
      researchMatchCurrent?'Research rule match '+rule.plan.id+' at '+rule.triggerAt+'.':'Entry research trigger not established.',
      'Imported research source is not qualified; costs and all original blockers remain.'].join(' ').slice(0,1000);
    return {contract:q,symbol:card.symbol,state:'PENDING_OWNER_PREPARATION',blockers,
      gates:{currentAssessment:assessmentCurrent,sourceClocksKnown:clocksKnownAndNotFuture,
        attributedReviewCurrent:reviewCurrent&&!blockers.includes('ATTRIBUTED_CONTEXT_REVIEW_MISSING_OR_OLD'),directionAligned,withinCapitalRange:modeled?.withinOwnerCapitalRange??null,
        etfQuoteFresh:etfFresh&&!blockers.includes('UNDERLYING_PRICE_NOT_FRESH'),
        optionQuoteFresh:optionFresh&&!blockers.includes('OPTION_QUOTE_NOT_FRESH'),
        spreadAndSizeClear:spreadSize&&!blockers.some(b=>['QUOTE_SIZE_UNKNOWN_OR_ZERO','SPREAD_OR_PRICE_UNSUITABLE'].includes(b)),
        declaredCostsKnown:costsKnown&&!blockers.includes('COSTS_UNKNOWN'),
        researchMatchCurrent,sourceQualified,numericPlanFieldsPresent:savedPlan.complete,ownerFrozen:false},
      research:{status:rule?.status??'NOT_ASSESSABLE',triggerAt:rule?.triggerAt??null,
        ruleId:rule?.plan?.id??null,source:rule?.source??null,limitations:rule?.limitations??[]},
      savedPlan,eventAssessment,modeledEconomics:modeled?.modeledEconomics??null,brokerFeesConfirmed:false,
      lineage:{assessedAt:cards.assessedAt,marketCapturedAt:cards.marketCapturedAt,analysisAt:cards.analysisAt,
        optionUpdatedAt:q.updatedAt,optionReceivedAt:q.receivedAt,etfSourceAt:card.price?.sourceAt??null,
        setupRegisteredAt:rule?.registeredAt??null},
      draftSeed:{symbol:q.symbol,optionType:q.type.toUpperCase(),expiry:q.expiry,strikeUsd:q.strike,includePlan:true,thesis},
      originalDisposition:reference.disposition,executionAllowed:false,autoSave:false,autoFreeze:false};
  }));
  return {version:'OPTIONS_OWNER_PLAN_PREPARATION_V1',assessedAt:state.loadedAt,rows,
    noCandidateSymbols:cards.cards.filter(c=>!(c.references??[]).length).map(c=>({symbol:c.symbol,
      reason:c.noContractReason??'No reference contract in the bounded sample.',blockers:c.blockers??[]})),
    pendingNaturalAcceptance:true,executionAllowed:false,marketCalls:0,orderCalls:0};
}
