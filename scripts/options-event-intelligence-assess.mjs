import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {captureEmploymentRelease,saveReleaseFacts,saveIssuedAssessment} from './lib/options-event-intelligence-assessment.mjs';
import {materializeEmploymentCase,saveEmploymentCase} from './lib/options-event-intelligence-employment-case.mjs';
export async function recordEmploymentAssessment({workspaceRoot,rawPath=null,now=()=>new Date().toISOString(),captureRelease=captureEmploymentRelease}={}){
  if(!workspaceRoot)throw Error('EVENT_ASSESSMENT_WORKSPACE_REQUIRED');
  let capture=null,facts=null,sourceError=null;
  try{if(!rawPath){capture=await captureRelease(workspaceRoot,{now});rawPath=capture.path;}if(capture?.status!=='FAILED')facts=saveReleaseFacts(workspaceRoot,rawPath,{now});else sourceError='OFFICIAL_RELEASE_CAPTURE_FAILED';}
  catch(error){sourceError=/^EVENT_ASSESSMENT_[A-Z_]+$/.test(error?.message)?error.message:'OFFICIAL_RELEASE_PARSE_UNAVAILABLE';}
  const input=materializeEmploymentCase(workspaceRoot,now());
  const record=saveIssuedAssessment(workspaceRoot,input.evidence,{now});
  const materialized=saveEmploymentCase(workspaceRoot,now());
  return {version:'EVENT_ASSESSMENT_COMMAND_V1',sourceError,rawPath,factPath:facts?.path??null,decisionPath:record.path,decision:record.payload.decision,materialized,executionAllowed:false};
}
function args(argv){let workspaceRoot=null,rawPath=null,record=false;for(let i=0;i<argv.length;i++){if(argv[i]==='--help')return {help:true};if(argv[i]==='--record'&&!record){record=true;continue;}if(argv[i]==='--workspace'&&!workspaceRoot&&argv[i+1]){workspaceRoot=argv[++i];continue;}if(argv[i]==='--raw'&&!rawPath&&argv[i+1]){rawPath=argv[++i];continue;}throw Error('EVENT_ASSESSMENT_ARGUMENTS');}if(!record||!workspaceRoot)throw Error('EVENT_ASSESSMENT_ARGUMENTS');return {workspaceRoot,rawPath};}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const p=args(process.argv.slice(2));if(p.help)console.log('Read and freeze an actual-time evidence assessment: --record --workspace <root> [--raw <saved raw release reference>]. No hypothetical clock or trade options.');else{const r=await recordEmploymentAssessment(p);console.log(JSON.stringify(r,null,2));if(r.sourceError)process.exitCode=3;}}catch(error){console.error(JSON.stringify({status:'ERROR',code:/^EVENT_ASSESSMENT_[A-Z_]+$/.test(error?.message)?error.message:'EVENT_ASSESSMENT_LOCAL_FAILURE',executionAllowed:false}));process.exitCode=2;}}
