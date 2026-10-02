import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {currentEngineeringPaperPreview,armEngineeringPaper} from './lib/options-real-data-paper-bridge.mjs';

function parse(argv){
  let workspace=null,mode=null;
  for(let i=0;i<argv.length;i++){
    if(argv[i]==='--workspace'&&argv[i+1]&&!workspace){workspace=argv[++i];continue;}
    if(argv[i]==='--preview'&&!mode){mode='preview';continue;}
    if(argv[i]==='--arm'&&!mode){mode='arm';continue;}
    if(argv[i]==='--help')return {help:true};
    throw Error('REAL_DATA_PAPER_BRIDGE_ARGUMENTS');
  }
  if(!workspace||!mode)throw Error('REAL_DATA_PAPER_BRIDGE_ARGUMENTS');
  return {workspace,mode};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const p=parse(process.argv.slice(2));
    if(p.help)console.log(JSON.stringify({help:'--preview|--arm --workspace <Alpha root>',liveOrderAuthority:false,executionAllowed:false},null,2));
    else console.log(JSON.stringify(p.mode==='preview'?await currentEngineeringPaperPreview(p.workspace):await armEngineeringPaper(p.workspace),null,2));
  }catch(error){
    console.error(JSON.stringify({status:'SYSTEM_FAILURE',code:/^REAL_DATA_PAPER_BRIDGE_[A-Z_]+$/.test(error?.message)?error.message:'REAL_DATA_PAPER_BRIDGE_LOCAL_FAILURE',engineeringAcceptance:'FAILED',liveOrderAuthority:false,executionAllowed:false}));
    process.exitCode=2;
  }
}
