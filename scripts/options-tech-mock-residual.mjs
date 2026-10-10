import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readMockResidualPreview,readMockResidualEvidence} from './lib/options-tech-mock-residual-readonly.mjs';
export function mockResidualCli(args,{root=process.cwd()}={}){
 if(args.length===1&&args[0]==='--help')return {help:'Read-only MOCK residual preview: --preview --run-id mock-ID --at UTC [--evidence FILE]. No directories, staging cleanup, logs, ledger writes, funds release or state unlock.'};
 const opts={};for(let i=0;i<args.length;i++){const k=args[i];if(!['--preview','--run-id','--at','--evidence'].includes(k)||Object.hasOwn(opts,k))throw Error('MOCK_RESIDUAL_ARGUMENTS');opts[k]=k==='--preview'?true:args[++i];}
 if(!opts['--preview']||!opts['--run-id']||!opts['--at'])throw Error('MOCK_RESIDUAL_ARGUMENTS');
 return readMockResidualPreview({root,runId:opts['--run-id'],asOf:opts['--at'],evidence:opts['--evidence']?readMockResidualEvidence(opts['--evidence']):null});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(mockResidualCli(process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
