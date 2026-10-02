import {pathToFileURL} from 'node:url';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
import {savePreEventState} from './lib/options-event-intelligence-pre-event.mjs';

const fail=message=>{throw Error('EVENT_INTELLIGENCE_PRE_EVENT_CLI_'+message);};
export function parsePreEventArgs(argv){
  let workspace=null,record=false;
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--workspace'){if(workspace||!argv[i+1])fail('WORKSPACE');workspace=argv[++i];continue;}
    if(arg==='--record'){if(record)fail('RECORD');record=true;continue;}
    if(arg==='--help')return {help:true,workspace:null,record:false};
    fail('ARGUMENT');
  }
  if(!record||!workspace)fail('REQUIRED');
  return {help:false,workspace,record};
}
export async function runPreEventRecorder(argv,{now=()=>new Date().toISOString()}={}){
  const parsed=parsePreEventArgs(argv);
  if(parsed.help)return {help:'--record --workspace <Alpha data root>',executionAllowed:false};
  const recordedAt=now();
  const data=createWorkbenchData({workspaceRoot:parsed.workspace,now:()=>recordedAt});
  const state=await data.state();
  if(state.executionAllowed!==false)fail('EXECUTION_AUTHORITY');
  const saved=savePreEventState(parsed.workspace,state,recordedAt);
  return {
    version:'OPTIONS_PRE_EVENT_STATE_COMMAND_V1',
    recordedAt,path:saved.path,fingerprint:saved.fingerprint,
    assetCount:saved.snapshot.assets.length,
    sourceCount:saved.snapshot.sources.length,
    missingEvidence:saved.snapshot.missingEvidence,
    executionAllowed:false
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  runPreEventRecorder(process.argv.slice(2)).then(value=>{
    process.stdout.write(JSON.stringify(value,null,2)+'\n');
  }).catch(error=>{
    process.stderr.write(JSON.stringify({status:'ERROR',code:error?.message??'UNKNOWN'})+'\n');
    process.exitCode=2;
  });
}
