import {assessOptionsCostDesk} from '../../src/engines/options-retail-feasibility/OptionsCostDesk.ts';

// Research definitions only. No qualified ETF bar reader or setup detector is connected here.
function buyerEntryBoundary(asset) {
  const expiryCounts={EXPIRED:0,ZERO_DTE:0,SHORT_DATED_OUTSIDE_SCOPE:0,RESEARCH_14_TO_45:0,LONG_DATED_OUTSIDE_SCOPE:0,UNKNOWN:0};
  for(const c of asset.candidates) {
    const d=c.dte;
    const bucket=!Number.isSafeInteger(d)?'UNKNOWN':d<0?'EXPIRED':d===0?'ZERO_DTE':d<14?'SHORT_DATED_OUTSIDE_SCOPE':d<=45?'RESEARCH_14_TO_45':'LONG_DATED_OUTSIDE_SCOPE';
    expiryCounts[bucket]++;
  }
  const setups=[
    {id:'TREND_BREAKOUT',label:'Trend breakout',
      confirmation:'Declare a prior range; require a completed ETF bar beyond it with a predeclared buffer and volume confirmation.',
      invalidation:'Price returns inside the range, or the entry exceeds the predeclared chase limit.'},
    {id:'TREND_PULLBACK',label:'Trend pullback continuation',
      confirmation:'Establish the ETF trend, declare a retracement zone, then require that zone to hold and a completed-bar resumption trigger.',
      invalidation:'The retracement breaks the declared trend structure. Touching support or resistance alone is not confirmation.'},
    {id:'KEY_LEVEL_RESOLUTION',label:'Key-level pattern resolution',
      confirmation:'Declare the key level and consolidation boundaries before the move; require a completed ETF close beyond the boundary and its confirmation.',
      invalidation:'A failed break returns inside the pattern or crosses the declared invalidation level.'}
  ].map(s=>({...s,status:'NOT_ASSESSABLE',winProbability:null,expectedReturn:null}));
  return {version:'OPTIONS_BUYER_ENTRY_BOUNDARIES_V1',status:'NOT_ASSESSABLE',
    scope:'Untested research checklist. Current guidance screens 14–45 DTE; 0DTE requires a separate method. Non-0DTE alone is not sufficient.',
    sampledContractCount:asset.candidates.length,expiryCounts,
    expiryCoverage:'Latest bounded sample only; not every listed contract.',
    requiredUnderlying:asset.symbol,observedTrend:asset.trend?.direction??'INSUFFICIENT_HISTORY',
    proxyBoundary:asset.symbol==='GLD'?
      'Gold spot / GC futures are context. Confirm entries on GLD bars; do not copy futures levels, volume, roll or session assumptions into GLD.':
      'Bitcoin spot / futures are context. Confirm entries on IBIT bars; do not copy 24/7 prices, futures basis or volume into ETF triggers.',
    missingEvidence:[
      'Qualified, completed ETF OHLCV with source/session clocks, gap checks and a comparable volume baseline is not connected. ETF price snapshots, daily closes and option candles cannot confirm these setups.',
      'Bar interval, lookback, levels, buffers, volume threshold, chase limit, invalidation price and exact time exit have not been frozen for a setup.',
      'A move / holding-time / IV scenario and historical IV context are unavailable; a favorable ETF direction alone does not establish an option profit.'
    ],setups,
    optionChecks:'Retain fresh bid/ask and size, spread, budget and declared net costs. Review delta, time decay, IV and event exposure; freeze the stop, target and time exit before entry. Stops are not guaranteed fills.',
    eventBoundary:'Scheduled and unexpected events may create research opportunities. Wait for observable price confirmation; an IV decline after the event can offset a favorable underlying move.',
    validation:'Freeze rules prospectively, retain false breakouts and losses, and compare independent outcomes after spread and costs. These overlapping setups are not independent votes; a pipeline paper trade does not validate them.',
    canConfirmSetup:false,winProbability:null,expectedReturn:null,changesGuidance:false};
}

// A compact projection of existing decisions. It never qualifies a quote or trade.
export function dailyDecisionCards(state) {
  const view=state.guidance?.data,r=view?.current;
  if(!r)throw Error('DECISION_GUIDANCE_UNAVAILABLE');
  const note=view.interpretation,at=Date.parse(r.assessedAt),reviewAt=Date.parse(note?.assessedAt);
  const reviewCurrent=Number.isFinite(reviewAt)&&reviewAt<=at&&at-reviewAt<=86400000&&(!r.marketCapturedAt||reviewAt>=Date.parse(r.marketCapturedAt));
  const sources=state.focusedNews?.data?.sources??[];
  return {version:'OPTIONS_DAILY_DECISION_CARDS_V1',assessedAt:r.assessedAt,
    marketCapturedAt:r.marketCapturedAt,analysisAt:note?.assessedAt??null,reviewCurrent,
    session:r.marketSession??null,sourceHealth:sources.map(s=>({id:s.id,status:s.status,observedAt:s.observedAt,refreshOverdue:s.refreshOverdue,partial:s.partial??null})),
    events:r.events.slice(0,5),cards:r.assets.map(asset=>{
      const analysis=note?.assets.find(a=>a.symbol===asset.symbol),budget=r.settings.tradeBudget;
      const references=asset.candidates.filter(c=>{
        const q=c.contract,premium=q.askCents===null?null:q.askCents*100;
        return premium!==null&&q.bidCents>0&&q.bidCents<=q.askCents&&q.multiplier===100&&c.dte>=14&&c.dte<=45&&
          budget&&premium>=budget.minCents&&premium<=budget.maxCents&&
          (!reviewCurrent||analysis?.bias!=='BULLISH'||q.type==='call')&&(!reviewCurrent||analysis?.bias!=='BEARISH'||q.type==='put');
      }).slice(0,2).map(c=>{
        let costExample=null;
        try {
          const desk=assessOptionsCostDesk({scenario:c.scenario,feeBasis:'REVIEWED_SCHEDULE_ASSUMPTION'}),row=desk.rows.find(r=>r.ticks===1);
          const e=row.result.economics;
          costExample={basis:desk.feeBasis,profile:desk.profile,exitAllowanceCents:row.exitAllowanceCents,
            feeReserveCents:row.roundTripFeeReserveCents,premiumCents:e.premiumCents,
            targetPerShareCents:e.indicativeExitLimitPerShareCents,plannedRiskCents:e.plannedStopCents,
            netTargetCents:e.roundedNetProfitTargetCents,blockers:row.result.blockers.map(b=>b.code),
            brokerFeesConfirmed:false,changesDecision:false};
        } catch { /* Missing scenario evidence leaves the example unavailable. */ }
        return {contract:c.contract,disposition:c.disposition,blockers:c.blockers,plan:c.plan,costExample,
          rationale:view.rationale?.assets.find(a=>a.symbol===asset.symbol)?.contracts.find(q=>q.id===c.contract.id)??null};
      });
      return {symbol:asset.symbol,action:asset.disposition,price:asset.equity,
        bias:reviewCurrent?(analysis?.bias??'INSUFFICIENT_EVIDENCE'):'INSUFFICIENT_EVIDENCE',
        summary:reviewCurrent?analysis?.summary??'No attributed interpretation.':'Refresh the attributed analysis after the latest market capture before using a directional view.',
        supporting:reviewCurrent?analysis?.supporting.slice(0,3)??[]:[],opposing:reviewCurrent?analysis?.opposing.slice(0,3)??[]:[],
        sources:reviewCurrent?analysis?.sources??[]:[],blockers:asset.blockers,trend:asset.trend,
        eventPlan:reviewCurrent?analysis?.eventPlan??'Event interpretation unavailable.':'Current event interpretation unavailable.',
        entryCondition:'Wait for an open regular session, current ETF and option quotes, attributed analysis agreeing with the observed trend, acceptable spread/size, and declared costs. All original blockers must clear. The buyer setup checklist below is not yet assessable and does not confirm an entry.',
        buyerEntryBoundary:buyerEntryBoundary(asset),
        invalidation:reviewCurrent?analysis?.invalidation??'Reassess when the evidence changes.':'Do not act on the previous analysis; obtain a current review.',
        timeExit:'Before any manual entry, declare an exact exit time in Trade journal. The general watchlist does not open a position or register a time exit.',
        references,noContractReason:references.length?null:'No sampled 14–45 DTE contract fits the premium budget and quote-side checks. This bounded sample does not cover every listed strike.'};
    }),paper:state.snapshotPaper?.data?.observations?.rows.map(p=>({planId:p.planId,state:p.state,stage:p.currentPaperStage,purpose:p.purpose,review:p.lastAutomaticReport?.processReview??null}))??[],
    executionAllowed:false,winProbability:null,rankingIsProfitForecast:false};
}
