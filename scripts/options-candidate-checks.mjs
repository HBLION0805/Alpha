import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createWorkbenchData, workbenchError } from './lib/options-workbench-data.mjs';
import { readCandidateChecks, saveCandidateChecks } from './lib/options-candidate-checks-io.mjs';

export async function runCandidateChecksCommand(args,{workspaceRoot=process.cwd(),now=()=>new Date().toISOString()}={}){
  const root=realpathSync(workspaceRoot),[mode,path]=args;
  if(mode==='--verify'&&args.length===2){const r=readCandidateChecks(root,path,now());return {status:'VERIFIED',path,recordedAt:r.recordedAt,assessedAt:r.report.assessedAt,counts:r.report.counts,reportFingerprint:r.reportFingerprint,executionAllowed:false};}
  if(!['--report','--save'].includes(mode)||args.length!==1)throw Error('CANDIDATE_CHECKS_ARGUMENTS');
  const state=await createWorkbenchData({workspaceRoot:root,now}).state();
  if(state.candidateChecks.state!=='AVAILABLE')throw Error(state.candidateChecks.error);
  return mode==='--save'?saveCandidateChecks(root,state.guidance.data):state.candidateChecks.data;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{console.log(JSON.stringify(await runCandidateChecksCommand(process.argv.slice(2)),null,2));}
  catch(e){console.error(JSON.stringify({error:workbenchError(e),executionAllowed:false}));process.exitCode=2;}
}
