import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
import {readEtfSetupJson,verifyEtfSetup,registerEtfSetup,importEtfBars,saveEtfSetupAssessment} from './lib/options-etf-setup-io.mjs';
export async function runEtfSetup(args,{workspaceRoot=process.cwd(),now=()=>new Date().toISOString()}={}){
  const [mode,arg]=args,root=resolve(workspaceRoot),at=now();
  if(args.length===2&&mode==='--verify'){const r=verifyEtfSetup(root,arg);return {status:'VERIFIED',path:arg,fingerprint:r.reportFingerprint,executionAllowed:false};}
  if(args.length===2&&['--register','--import'].includes(mode)){
    const value=readEtfSetupJson(root,arg),r=mode==='--register'?registerEtfSetup(root,value,at):importEtfBars(root,value,at);
    verifyEtfSetup(root,r.path);return {path:r.path,executionAllowed:false};
  }
  if((mode==='--desk'&&args.length===1)||(mode==='--snapshot'&&args.length===2)){
    const state=await createWorkbenchData({workspaceRoot:root,now:()=>at}).state();
    if(mode==='--desk')return state.etfSetup;
    const r=saveEtfSetupAssessment(root,state.guidance.data.input,arg,at);verifyEtfSetup(root,r.path);return {path:r.path,report:r.record.report,executionAllowed:false};
  }
  throw Error('ETF_SETUP_ARGUMENTS');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(await runEtfSetup(process.argv.slice(2)),null,2));}catch(e){console.error(JSON.stringify({error:/^[A-Z_]+$/.test(e?.message)?e.message:'ETF_SETUP_LOCAL_FAILURE',executionAllowed:false}));process.exitCode=2;}}
