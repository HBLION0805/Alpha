import { briefGuidanceSensitivities } from '../src/engines/options-daily-guidance/OptionsGuidanceSensitivities.ts';
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createWorkbenchData, workbenchError } from "./lib/options-workbench-data.mjs";
import { recordGuidanceMarket, publishGuidance, recordAnalystNote, claimGuidanceSlot, verifyGuidanceRecord, explainIssuedGuidance } from "./lib/options-guidance-io.mjs";
import { collectGuidanceMarket, routeDailyGuidance } from "./lib/options-guidance-host.mjs";
import { activeEventResearchContracts } from "./lib/options-event-research-io.mjs";
import { paperObservationView, observePaperPlans } from "./lib/options-paper-observation-io.mjs";
export async function runGuidanceCommand(args,{workspaceRoot=process.cwd(),now=()=>new Date().toISOString()}={}) {
  const root=realpathSync(workspaceRoot),[mode,arg]=args;
  if(args.length>2)throw Error("GUIDANCE_ARGUMENTS");
  if(mode==="--route"&&args.length===1)return routeDailyGuidance(now());
  if(mode==="--route-ongoing"&&args.length===1)return routeDailyGuidance(now(),{ongoing:true});
  if(mode==="--host-source"&&args.length===1){
    const at=now();let tracked=activeEventResearchContracts(root,at),paperTracking;
    try{const v=paperObservationView(root,undefined,at);tracked=v.trackedContracts;paperTracking=v.rows.map(({planId,state,tracking})=>({planId,state,tracking}));}
    catch(error){paperTracking={error:workbenchError(error)};}
    return {source:tracked.length?`async function(params){return (${collectGuidanceMarket.toString()})({...params,trackedContracts:${JSON.stringify(tracked)}});}`:collectGuidanceMarket.toString(),trackedContracts:tracked.length,paperTracking};
  }
  if(mode==="--begin-slot"&&args.length===2)return claimGuidanceSlot(root,arg);
  if(mode==="--record"&&args.length===2){
    const path=recordGuidanceMarket(root,arg);let paperObservations;
    try{paperObservations=observePaperPlans(root,path,now());}catch(error){paperObservations={error:workbenchError(error)};}
    return {path,paperObservations,executionAllowed:false};
  }
  if(mode==="--observe-paper"&&args.length===1)return observePaperPlans(root,null,now());
  if(mode==="--analysis"&&args.length===2)return {path:recordAnalystNote(root,arg),executionAllowed:false};
  if(mode==="--verify"&&args.length===2)return verifyGuidanceRecord(root,arg);
  if(mode==="--explain-report"&&args.length===2)return explainIssuedGuidance(root,arg);
  if(["--report","--publish","--host-brief","--delivery-health","--event-reactions","--sensitivities"].includes(mode)&&args.length===1) {
    const state=await createWorkbenchData({workspaceRoot:root,now}).state();
    if(mode==="--delivery-health")return state.guidanceDelivery;
    if(mode==="--event-reactions")return state.eventReactions;
    if(mode==="--sensitivities")return state.guidanceSensitivities;
    if(state.guidance.state!=="AVAILABLE")throw Error(state.guidance.error);
    if(mode==="--report")return state.guidance.data;
    if(mode==="--host-brief") {const v=state.guidance.data,r=v.current;return {optionSensitivities:state.guidanceSensitivities.state==="AVAILABLE"?{...state.guidanceSensitivities,data:briefGuidanceSensitivities(state.guidanceSensitivities.data,r.assets.flatMap(a=>a.candidates.slice(0,3).map(c=>c.contract.id)))}:state.guidanceSensitivities,eventReactions:state.eventReactions,deliveryHealth:state.guidanceDelivery.state==="AVAILABLE"?{...state.guidanceDelivery.data,slots:state.guidanceDelivery.data.slots.map(({slot,startAt,endAt,status})=>({slot,startAt,endAt,status}))}:state.guidanceDelivery,...(r.marketSession?{marketSession:r.marketSession,sessionPolicy:r.sessionPolicy,analysisSequencing:r.analysisSequencing}:{}),rationale:{...v.rationale,assets:v.rationale.assets.map(a=>({...a,contracts:a.contracts.slice(0,3)}))},assessedAt:r.assessedAt,marketCapturedAt:r.marketCapturedAt,...(r.settings.tradeBudget?.version==="OWNER_ALLOCATION_ONLY_V2"?{capitalPolicy:{version:r.settings.tradeBudget.version,settings:r.settings,policy:r.policy,legacyLossCapsEnforced:false}}:{}),assets:r.assets.map(a=>({symbol:a.symbol,equity:a.equity,trend:a.trend,disposition:a.disposition,blockers:a.blockers,sampled:a.candidates.length,priced:a.candidates.filter(c=>c.contract.askCents!==null).length,candidates:a.candidates.slice(0,3).map(c=>({contract:c.contract,disposition:c.disposition,blockers:c.blockers,plan:c.plan,economics:c.feasibility.economics}))})),events:r.events,sourceHealth:r.sourceHealth,headlines:r.headlines,context:r.context,focusedNews:state.focusedNews.state==='AVAILABLE'?{...state.focusedNews.data,items:state.focusedNews.data.items.slice(0,40).map(({mechanisms,...item})=>item)}:{state:state.focusedNews.state,error:state.focusedNews.error},macroContext:state.macroContext.state==='AVAILABLE'?{...state.macroContext.data,forecasts:state.macroContext.data.forecasts.slice(0,2)}:{state:state.macroContext.state,error:state.macroContext.error},goldFramework:state.goldFramework.state==='AVAILABLE'?state.goldFramework.data:{state:state.goldFramework.state,error:state.goldFramework.error},previousAnalysis:v.interpretation,lastIssued:v.history[0]??null};}
    return {path:publishGuidance(root,state),dispositions:state.guidance.data.current.assets.map(a=>({symbol:a.symbol,disposition:a.disposition,trend:a.trend.direction})),executionAllowed:false};
  }
  throw Error("GUIDANCE_ARGUMENTS");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {console.log(JSON.stringify(await runGuidanceCommand(process.argv.slice(2)),null,2));}
  catch(e){console.error(JSON.stringify({error:workbenchError(e),executionAllowed:false}));process.exitCode=2;}
}
