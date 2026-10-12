import fs from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {startEngineeringContinuation,appendEngineeringContinuation,recoverEngineeringContinuation} from './lib/options-engineering-continuation.mjs';
function read(path){const p=resolve(path),s=fs.lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>2e6)throw Error('CONTINUATION_INPUT_FILE');return JSON.parse(fs.readFileSync(p,'utf8'));}
export function engineeringContinuationCli(args,{root=process.cwd()}={}){
 if(args.length===1&&args[0]==='--help')return {scope:'Same closed SPY simulation account, one ENGINEERING_ONLY option segment; no source calls or broker orders. Unknown contract evidence blocks start.',usage:'--start PLAN | --append EVENT --account ID | --recover --account ID --at UTC'};
 if(args.length===2&&args[0]==='--start')return startEngineeringContinuation({root,input:read(args[1])}).report;
 if(args.length===4&&args[0]==='--append'&&args[2]==='--account')return appendEngineeringContinuation({root,accountId:args[3],event:read(args[1])});
 if(args.length===5&&args[0]==='--recover'&&args[1]==='--account'&&args[3]==='--at')return recoverEngineeringContinuation({root,accountId:args[2],asOf:args[4]}).report;
 throw Error('CONTINUATION_ARGUMENTS');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(engineeringContinuationCli(process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
