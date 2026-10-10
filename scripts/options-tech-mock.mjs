import fs from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {startTechMock,appendTechMock,recoverTechMock} from './lib/options-tech-mock-lifecycle.mjs';
export function techMockCli(args,{root=process.cwd()}={}){
 const help='Isolated MOCK only: --start INPUT --run-id mock-ID | --append EVENT --run-id mock-ID | --recover --run-id mock-ID --at UTC. No network, production arm or orders.';
 if(args.length===1&&args[0]==='--help')return {help};
 const opts={};for(let i=0;i<args.length;i++){const k=args[i];if(!['--start','--append','--recover','--run-id','--at'].includes(k)||Object.hasOwn(opts,k))throw Error('TECH_MOCK_ARGUMENTS');opts[k]=k==='--recover'?true:args[++i];}
 if([opts['--start'],opts['--append'],opts['--recover']].filter(Boolean).length!==1||!opts['--run-id']||Boolean(opts['--recover'])!==Boolean(opts['--at']))throw Error('TECH_MOCK_ARGUMENTS');
 const common={root,runId:opts['--run-id']};
 const load=p=>{const b=fs.readFileSync(resolve(p));if(b.length>2e6)throw Error('TECH_MOCK_INPUT_BOUND');return JSON.parse(b.toString('utf8'));};
 if(opts['--start'])return startTechMock({...common,input:load(opts['--start'])});
 if(opts['--append'])return appendTechMock({...common,event:load(opts['--append'])});
 return recoverTechMock({...common,asOf:opts['--at']}).report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(techMockCli(process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
