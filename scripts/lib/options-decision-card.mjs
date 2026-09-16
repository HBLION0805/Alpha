import {assessOptionsCostDesk} from '../../src/engines/options-retail-feasibility/OptionsCostDesk.ts';

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
        entryCondition:'Wait for an open regular session, current ETF and option quotes, attributed analysis agreeing with the observed trend, acceptable spread/size, and declared costs. All original blockers must clear.',
        invalidation:reviewCurrent?analysis?.invalidation??'Reassess when the evidence changes.':'Do not act on the previous analysis; obtain a current review.',
        timeExit:'Before any manual entry, declare an exact exit time in Trade journal. The general watchlist does not open a position or register a time exit.',
        references,noContractReason:references.length?null:'No sampled 14–45 DTE contract fits the premium budget and quote-side checks. This bounded sample does not cover every listed strike.'};
    }),paper:state.snapshotPaper?.data?.observations?.rows.map(p=>({planId:p.planId,state:p.state,stage:p.currentPaperStage,purpose:p.purpose,review:p.lastAutomaticReport?.processReview??null}))??[],
    executionAllowed:false,winProbability:null,rankingIsProfitForecast:false};
}
