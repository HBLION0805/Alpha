import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {readTechQuoteInput} from './options-tech-quotes.mjs';
import {readTechSpreadOriginal} from './lib/options-tech-spread-preflight.mjs';
import {previewTechSpreadPlan,startTechSpreadPlan} from './lib/options-tech-spread-plan.mjs';
import {mockSpreadEventFromOriginal} from './lib/options-tech-spread-plan-binding.mjs';
import {appendMockSpread,recoverMockSpread} from './lib/options-tech-mock-spread.mjs';
export function techSpreadPlanCli(args,{root=process.cwd()}={}){
 if(args.length===1&&args[0]==='--help')return {help:'--preview INPUT | --start INPUT --run-id ID | --append-original REF --run-id ID --at UTC | --recover --run-id ID --at UTC. mock-ID for MOCK, paper-ID for isolated REAL_QUOTE_PAPER. Start saves a plan only; append-original explicitly models an observation from a saved hash-checked original. TEST_FIXTURE stays labeled. No LIVE mode, source call, production arming or broker order.'};
 if(args.length===5&&args[0]==='--recover'&&args[1]==='--run-id'&&args[3]==='--at')return recoverMockSpread({root,runId:args[2],asOf:args[4]}).report;
 if(args.length===6&&args[0]==='--append-original'&&args[2]==='--run-id'&&args[4]==='--at'){
  const ref=readTechQuoteInput(resolve(root,args[1])).data,at=args[5],state=recoverMockSpread({root,runId:args[3],asOf:at});
  const original={id:ref.id,...readTechSpreadOriginal(resolve(root,ref.path),ref.sha256)},event=mockSpreadEventFromOriginal({plan:state.manifest.input,original,id:ref.eventId,at,action:ref.action??'OBSERVE'});
  return appendMockSpread({root,runId:args[3],event});
 }
 if(!((args.length===2&&args[0]==='--preview')||(args.length===4&&args[0]==='--start'&&args[2]==='--run-id')))throw Error('SPREAD_PLAN_ARGUMENTS');
 const input=readTechQuoteInput(resolve(root,args[1])).data;
 if(!Array.isArray(input.originals)||input.originals.length!==1)throw Error('SPREAD_PLAN_ORIGINAL_COUNT');
 input.originals=input.originals.map(o=>({id:o.id,...readTechSpreadOriginal(resolve(root,o.path),o.sha256)}));
 return args[0]==='--preview'?previewTechSpreadPlan(input):startTechSpreadPlan({root,runId:args[3],input});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(techSpreadPlanCli(process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
