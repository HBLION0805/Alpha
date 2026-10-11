import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {refreshWeeklySources} from './lib/options-weekly-refresh.mjs';
import {weeklyPlanView} from './lib/options-weekly-plan-io.mjs';
export async function runWeeklySources(args){
 const mode=args.shift();if(!['--refresh','--view'].includes(mode))throw Error('WEEKLY_SOURCES_ARGUMENTS');let root=process.cwd(),sourceIds=['bls_calendar','fomc_calendar'];
 while(args.length){const key=args.shift(),value=args.shift();if(!value)throw Error('WEEKLY_SOURCES_ARGUMENTS');if(key==='--workspace')root=resolve(value);else if(key==='--sources'&&mode==='--refresh')sourceIds=value.split(',');else throw Error('WEEKLY_SOURCES_ARGUMENTS');}
 return mode==='--refresh'?refreshWeeklySources({root,sourceIds}):(await weeklyPlanView(root)).sourceCoverage;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{console.log(JSON.stringify(await runWeeklySources(process.argv.slice(2)),null,2));}catch{console.error(JSON.stringify({status:'WEEKLY_SOURCES_BLOCKED',executionAllowed:false}));process.exitCode=1;}
