import {readGuidanceResearchFrames} from './options-guidance-io.mjs';
import {etfStudySources} from './options-etf-setup-io.mjs';
import {verifyMacroComparison} from './options-macro-context-io.mjs';
import {assessTradeThesis,validateThesisOwnerEvidence} from '../../src/engines/options-manual-ledger/OptionsTradeThesis.ts';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {snapshotNs} from '../../src/engines/options-robinhood-data/RobinhoodSnapshotPaper.ts';

const fail=c=>{throw Error('MANUAL_THESIS_'+c);};
export function savedThesisMarket(root,symbol,at){
  const result={price:null,bars:null,gaps:[]};
  try{
    const latest=readGuidanceResearchFrames(root,{includeEquityReceipt:true}).filter(f=>snapshotNs(f.recordedAt)<=snapshotNs(at)).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)).at(-1);
    const e=latest?.equities.find(e=>e.symbol===symbol);
    if(latest)result.price={symbol,price:e?.price??null,sourceAt:e?.sourceAt??null,receivedAt:latest.equityReceivedAt,recordedAt:latest.recordedAt,path:latest.path,fingerprint:paperFingerprint(latest),origin:latest.origin};
  }catch{result.gaps.push('ETF_PRICE_RECOVERY_UNAVAILABLE');}
  try{
    const desk=etfStudySources(root,at),latest=desk.sources.filter(r=>r.report.assets.some(a=>a.symbol===symbol)).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)).at(-1);
    if(latest){const a=latest.report.assets.find(a=>a.symbol===symbol);result.bars={value:a.normalized,qualified:a.sourceQualified===true,conflicted:desk.audits.some(r=>r.report.windowStart===a.windowStart&&r.report.assets.some(x=>x.symbol===symbol&&x.different>0)),recordedAt:latest.recordedAt,path:latest.path,fingerprint:latest.reportFingerprint,origin:'HOST_MARKET_TOOL_RESPONSES'};}
  }catch{result.gaps.push('ETF_BAR_RECOVERY_UNAVAILABLE');}
  if(!result.bars?.qualified)result.gaps.push('NO_QUALIFIED_COMPLETED_ETF_BAR_SOURCE');
  return result;
}
export function thesisReviews(report,tradeId){return (report.planRecords??[]).filter(e=>e.command.type==='SAVE_POSITION_REVIEW'&&e.command.tradeId===tradeId);}
function compactEvidence(all){
  // Copy only current evidence and relevant conflicts. Original append-only reviews retain every observation.
  const output=[];
  for(const id of new Set(all.map(e=>e.conditionId))){
    const group=all.filter(e=>e.conditionId===id).sort((a,b)=>snapshotNs(a.savedAt)<snapshotNs(b.savedAt)?1:-1),latest=group[0];
    if(!latest)continue;output.push(latest);
    const conflict=group.find(e=>e.releaseVersion===latest.releaseVersion&&e.eventKey===latest.eventKey&&e.metric===latest.metric&&e.period===latest.period&&e.unit===latest.unit&&e.value!==latest.value);
    const tie=group.find(e=>e.savedAt===latest.savedAt&&paperFingerprint(e)!==paperFingerprint(latest));
    for(const e of [conflict,tie])if(e&&!output.includes(e))output.push(e);
  }
  return output;
}
export function extendPositionThesis(root,report,watch,at,candidate=null){
  return {...watch,rows:watch.rows.map(row=>{
    const trade=report.trades.find(t=>t.tradeId===row.tradeId),history=thesisReviews(report,row.tradeId);
    if(!trade.plan?.invalidation)return {...row,thesis:{thesisStatus:'UNKNOWN',action:row.attentionReasons.length?'EXIT_CONDITION_TRIGGERED':'MANUAL_VERIFICATION_REQUIRED',issues:['NOT_CONFIGURED'],checks:[],triggered:row.attentionReasons,assessedAt:at},reviewHistory:[]};
    const context={plan:trade.plan,contract:trade.contract,registeredAt:trade.registeredAt,openedAt:trade.openedAt};
    const observations=history.flatMap(e=>e.command.review.evidence).filter((e,i,all)=>all.findIndex(x=>paperFingerprint(x)===paperFingerprint(e))===i);
    if(candidate?.tradeId===trade.tradeId&&candidate.evidence)observations.push(ownerEvidence(root,context,candidate.evidence,at));
    const evidence=compactEvidence(observations);
    const priorTriggers=[...new Set(history.flatMap(e=>e.command.review.result.triggered))];
    const market=savedThesisMarket(root,trade.contract.symbol,at),base={...row,origin:report.origin};
    const result=assessTradeThesis(context,base,at,evidence,market,priorTriggers);
    return {...row,thesis:result,reviewInput:{context,watch:base,assessedAt:at,evidence,market,priorTriggers,result},reviewHistory:history.map(e=>({requestId:e.command.requestId,recordedAt:e.recordedAt,savedAt:e.savedAt,...e.command.review}))};
  })};
}
function ownerEvidence(root,context,input,at){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join()!=='comparisonRef,conditionId,eventKey,explanation,judgment,metric,period,receivedAt,releaseVersion,source,sourceAt,unit,value')fail('EVIDENCE_FIELDS');
  const c=context.plan.invalidation.conditions.find(c=>c.id===input.conditionId);
  if(!c||c.kind==='PRICE')fail('OWNER_CONDITION');
  const e={...input,confirmation:'OWNER_CONFIRMED',savedAt:at};
  if(e.comparisonRef){
    const r=verifyMacroComparison(root,e.comparisonRef);
    if(snapshotNs(r.assessedAt)>snapshotNs(at)||r.request.metric!==e.metric||r.request.period!==e.period||r.request.sourceUrl!==e.source||r.request.actualValue!==e.value||e.sourceAt!==r.request.releaseAt||e.receivedAt!==r.assessedAt)fail('MACRO_COMPARISON_MISMATCH');
  }
  validateThesisOwnerEvidence(e,at);return e;
}
