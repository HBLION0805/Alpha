import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {registerTrendStudy,observeTrendStudies,trendStudyView,verifyTrendRecord} from './lib/options-trend-study-io.mjs';
export function runTrendStudy(args,{workspaceRoot=process.cwd(),now=()=>new Date().toISOString()}={}){
  const [mode,arg]=args,root=resolve(workspaceRoot),at=now();
  if(mode==='--start'&&args.length===2)return registerTrendStudy(root,arg,at);
  if(mode==='--observe'&&args.length===1)return observeTrendStudies(root,at);
  if(mode==='--desk'&&args.length===1)return trendStudyView(root,at);
  if(mode==='--verify'&&args.length===2){const r=verifyTrendRecord(root,arg);return {status:'VERIFIED',path:arg,studyId:r.study?.id??r.id,executionAllowed:false};}
  throw Error('TREND_STUDY_ARGUMENTS');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(runTrendStudy(process.argv.slice(2)),null,2));}catch(e){console.error(JSON.stringify({error:/^TREND_STUDY_[A-Z_]+$/.test(e?.message)?e.message:'TREND_STUDY_LOCAL_FAILURE'}));process.exitCode=2;}}
