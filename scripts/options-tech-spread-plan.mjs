import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {readTechQuoteInput} from './options-tech-quotes.mjs';
import {readTechSpreadOriginal} from './lib/options-tech-spread-preflight.mjs';
import {previewTechSpreadPlan,startTechSpreadPlan} from './lib/options-tech-spread-plan.mjs';
export function techSpreadPlanCli(args,{root=process.cwd()}={}){
 if(args.length===1&&args[0]==='--help')return {help:'--preview INPUT | --start INPUT --run-id mock-ID. Reads explicit originals and evidence; start saves a MOCK plan only. No automatic entry, market source, production arming or order.'};
 if(!((args.length===2&&args[0]==='--preview')||(args.length===4&&args[0]==='--start'&&args[2]==='--run-id')))throw Error('SPREAD_PLAN_ARGUMENTS');
 const input=readTechQuoteInput(resolve(root,args[1])).data;
 if(!Array.isArray(input.originals)||input.originals.length!==1)throw Error('SPREAD_PLAN_ORIGINAL_COUNT');
 input.originals=input.originals.map(o=>({id:o.id,...readTechSpreadOriginal(resolve(root,o.path),o.sha256)}));
 return args[0]==='--preview'?previewTechSpreadPlan(input):startTechSpreadPlan({root,runId:args[3],input});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(techSpreadPlanCli(process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
