import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseChainSurveyJson} from '../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {registerEventResearch,readEventResearch,saveEventResearchReport,verifyEventResearch} from './lib/options-event-research-io.mjs';
import {createWorkbenchData,workbenchError} from './lib/options-workbench-data.mjs';
import {optionsEvidenceExportStorage as io} from './options-evidence-export.mjs';

export async function runEventResearch(args,{workspaceRoot=process.cwd(),now=()=>new Date().toISOString()}={}) {
  const [mode,arg]=args,at=now();
  if(mode==='--report'&&args.length===1)return readEventResearch(workspaceRoot,at);
  if(mode==='--verify'&&args.length===2)return verifyEventResearch(workspaceRoot,arg);
  if(mode==='--save'&&args.length===2)return saveEventResearchReport(workspaceRoot,arg,at);
  if(mode==='--register'&&args.length===2){const request=parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(io.readBytes(workspaceRoot,arg,65536))),state=await createWorkbenchData({workspaceRoot,now}).state();return registerEventResearch(workspaceRoot,request,state.guidance.data,at);}
  throw Error('EVENT_RESEARCH_ARGUMENTS');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(await runEventResearch(process.argv.slice(2)),null,2));}catch(e){console.error(JSON.stringify({error:workbenchError(e),executionAllowed:false}));process.exitCode=2;}}
