import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareWeeklyContinuation} from './lib/options-weekly-continuation.mjs';
import {runWeeklyRunner} from './lib/options-weekly-runner.mjs';
import {runCompanyRunner} from './lib/options-weekly-company-runner.mjs';
export async function weeklyContinuationCli(args,{root=process.cwd(),now=()=>new Date().toISOString()}={}){
 const mode=args[0],p={};if(!['--preview','--start'].includes(mode))throw Error('RUNNER_CONTINUATION_ARGUMENTS');
 for(let n=1;n<args.length;n+=2){const k=args[n],v=args[n+1];if(!['--family','--from','--workspace'].includes(k)||Object.hasOwn(p,k)||!v||v.startsWith('--'))throw Error('RUNNER_CONTINUATION_ARGUMENTS');p[k]=v;}
 if(!['public','company'].includes(p['--family'])||!p['--from'])throw Error('RUNNER_CONTINUATION_ARGUMENTS');root=resolve(p['--workspace']??root);
 if(mode==='--preview')return prepareWeeklyContinuation({root,family:p['--family'],fromRunId:p['--from'],at:now()});
 const controller=new AbortController(),stop=()=>controller.abort();for(const s of ['SIGINT','SIGTERM'])process.once(s,stop);
 try{return await(p['--family']==='public'?runWeeklyRunner:runCompanyRunner)({root,continuationFrom:p['--from'],now,signal:controller.signal});}
 finally{for(const s of ['SIGINT','SIGTERM'])process.removeListener(s,stop);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)try{console.log(JSON.stringify(await weeklyContinuationCli(process.argv.slice(2)),null,2));}catch(e){console.error(JSON.stringify({status:'RUNNER_CONTINUATION_BLOCKED',code:/^RUNNER_[A-Z_]+$/.test(e.message)?e.message:e.code==='EEXIST'?'RUNNER_EXCLUSIVE_CLAIM_EXISTS':'RUNNER_CONTINUATION_LOCAL_FAILURE',executionAllowed:false}));process.exitCode=1;}
