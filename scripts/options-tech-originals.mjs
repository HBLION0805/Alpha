import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareTechOriginalQueue,acquireTechOriginalQueue,readTechOriginalQueue} from './lib/options-tech-original-queue.mjs';
export async function techOriginalsCli(args,{root=process.cwd(),now=()=>new Date().toISOString()}={}){
 if(args.length===1&&args[0]==='--help')return {usage:'--prepare --source-root WORKSPACE --request FILE --run-id NEW_ID | --acquire --run-id ID | --read --run-id ID',scope:'EXPLICIT_MAX_THREE_SAVED_SEC_CANDIDATES_ONE_ATTEMPT_NO_AUTOMATIC_REVIEW'};
 const mode=args[0],p={};if(!['--prepare','--acquire','--read'].includes(mode))throw Error('TECH_ORIGINAL_ARGUMENTS');for(let i=1;i<args.length;i+=2){if(!['--source-root','--request','--run-id'].includes(args[i])||p[args[i]]||!args[i+1]||args[i+1].startsWith('--'))throw Error('TECH_ORIGINAL_ARGUMENTS');p[args[i]]=args[i+1];}
 if(!p['--run-id']||(mode==='--prepare'?Object.keys(p).length!==3:Object.keys(p).length!==1))throw Error('TECH_ORIGINAL_ARGUMENTS');const options={root,runId:p['--run-id'],now};return mode==='--prepare'?prepareTechOriginalQueue({...options,sourceRoot:p['--source-root'],requestPath:p['--request']}):mode==='--acquire'?acquireTechOriginalQueue(options):readTechOriginalQueue(options);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(await techOriginalsCli(process.argv.slice(2)),null,2));}catch(e){console.error(/^TECH_ORIGINAL_[A-Z_]+$/.test(e?.message)?e.message:'TECH_ORIGINAL_FAILED');process.exitCode=1;}}
