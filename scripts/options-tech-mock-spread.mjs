import fs from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {startMockSpread,appendMockSpread,recoverMockSpread} from './lib/options-tech-mock-spread.mjs';
export function mockSpreadCli(args,{root=process.cwd()}={}){
 if(args.length===1&&args[0]==='--help')return {help:'Isolated CDS/PDS lifecycle. --start INPUT --run-id ID | --append EVENT --run-id ID | --recover --run-id ID --at UTC. mock-ID for MOCK; paper-ID for explicit REAL_QUOTE_PAPER. Two-leg fills are a model assumption, never a broker guarantee. No LIVE orders or production arming.'};
 const opts={};for(let i=0;i<args.length;i++){const k=args[i];if(!['--start','--append','--recover','--run-id','--at'].includes(k)||Object.hasOwn(opts,k))throw Error('SPREAD_MOCK_ARGUMENTS');opts[k]=k==='--recover'?true:args[++i];}
 if([opts['--start'],opts['--append'],opts['--recover']].filter(Boolean).length!==1||!opts['--run-id']||Boolean(opts['--recover'])!==Boolean(opts['--at']))throw Error('SPREAD_MOCK_ARGUMENTS');
 const common={root,runId:opts['--run-id']},load=p=>{if(fs.statSync(resolve(p)).size>2e6)throw Error('SPREAD_MOCK_INPUT_BOUND');return JSON.parse(fs.readFileSync(resolve(p),'utf8'));};
 if(opts['--start'])return startMockSpread({...common,input:load(opts['--start'])});
 if(opts['--append'])return appendMockSpread({...common,event:load(opts['--append'])});
 return recoverMockSpread({...common,asOf:opts['--at']}).report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(mockSpreadCli(process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
