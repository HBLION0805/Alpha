import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {refreshWeeklySources} from './lib/options-weekly-refresh.mjs';
import {weeklyPlanView} from './lib/options-weekly-plan-io.mjs';
import {runWeeklyRunner,weeklyRunnerStatus,stopWeeklyRunner,recoverWeeklyRunner} from './lib/options-weekly-runner.mjs';
export async function runWeeklySources(args){
 const mode=args.shift();if(!['--refresh','--view','--run','--status','--stop','--recover'].includes(mode))throw Error('WEEKLY_SOURCES_ARGUMENTS');let root=process.cwd(),sourceIds=['bls_calendar','fomc_calendar'];const options={},seen=new Set();
 while(args.length){const key=args.shift(),value=args.shift();if(!value||seen.has(key))throw Error('WEEKLY_SOURCES_ARGUMENTS');seen.add(key);
  if(key==='--workspace')root=resolve(value);
  else if(key==='--sources'&&['--refresh','--run'].includes(mode))sourceIds=value.split(',');
  else if(mode==='--run'&&['--until','--first-at','--interval-minutes','--max-attempts'].includes(key))options[{'--until':'until','--first-at':'firstAt','--interval-minutes':'intervalMinutes','--max-attempts':'maxAttempts'}[key]]=key==='--until'||key==='--first-at'?value:/^\d+$/.test(value)?Number(value):NaN;
  else if(key==='--run-id'&&['--status','--stop','--recover'].includes(mode))options.runId=value;
  else throw Error('WEEKLY_SOURCES_ARGUMENTS');
 }
 if(mode==='--view')return (await weeklyPlanView(root)).sourceCoverage;
 if(mode==='--refresh')return refreshWeeklySources({root,sourceIds});
 if(mode==='--status')return weeklyRunnerStatus(root,options.runId);
 if(mode==='--stop')return stopWeeklyRunner(root,options.runId);
 if(mode==='--recover')return recoverWeeklyRunner(root,options.runId);
 const controller=new AbortController(),stop=()=>controller.abort();for(const s of ['SIGINT','SIGTERM'])process.once(s,stop);
 try{return await runWeeklyRunner({root,sourceIds,...options,signal:controller.signal});}
 finally{for(const s of ['SIGINT','SIGTERM'])process.removeListener(s,stop);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{console.log(JSON.stringify(await runWeeklySources(process.argv.slice(2)),null,2));}catch(e){console.error(JSON.stringify({status:'WEEKLY_SOURCES_BLOCKED',errorCode:e.code==='EEXIST'?'EXCLUSIVE_OWNER_ALREADY_EXISTS':/^(?:WEEKLY_SOURCES|RUNNER|REFRESH)_[A-Z_]+$/.test(e.message)?e.message:'LOCAL_FAILURE',executionAllowed:false}));process.exitCode=1;}
