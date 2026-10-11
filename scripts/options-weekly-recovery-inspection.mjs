import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectWeeklyRecovery} from './lib/options-weekly-recovery-inspection.mjs';
export function weeklyRecoveryInspectionCli(args,{root=process.cwd(),now=()=>new Date().toISOString()}={}){
 if(args.length===1&&args[0]==='--help')return {usage:'--inspect --family public|company [--run-id UUID] [--workspace DIRECTORY]',authority:'READ_ONLY_NO_RECOVERY_UNLOCK_RETRY_OR_RESUME'};
 if(args[0]!=='--inspect')throw Error('RECOVERY_INSPECTION_ARGUMENTS');const p={};
 for(let n=1;n<args.length;n+=2){const key=args[n],value=args[n+1];if(!['--family','--run-id','--workspace'].includes(key)||Object.hasOwn(p,key)||!value||value.startsWith('--'))throw Error('RECOVERY_INSPECTION_ARGUMENTS');p[key]=value;}
 if(!['public','company'].includes(p['--family']))throw Error('RECOVERY_INSPECTION_ARGUMENTS');
 return inspectWeeklyRecovery({root:resolve(p['--workspace']??root),family:p['--family'],runId:p['--run-id']??null,at:now()});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(weeklyRecoveryInspectionCli(process.argv.slice(2)),null,2));}catch{console.error('RECOVERY_INSPECTION_ARGUMENTS');process.exitCode=1;}}
