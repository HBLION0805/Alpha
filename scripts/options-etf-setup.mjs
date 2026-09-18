import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
import {readEtfSetupJson,verifyEtfSetup,registerEtfSetup,importEtfBars,saveEtfSetupAssessment,recordRobinhoodEtfBars,recordEtfSourceAudit,saveEtfObservation} from './lib/options-etf-setup-io.mjs';
export async function runEtfSetup(args,{workspaceRoot=process.cwd(),now=()=>new Date().toISOString()}={}){
  const [mode,arg]=args,root=resolve(workspaceRoot),at=now();
  if(args.length===3&&mode==='--audit-source'){
    const five=verifyEtfSetup(root,arg);if(five.kind!=='sources')throw Error('ETF_SETUP_SOURCE_RECORD_REQUIRED');
    const r=recordEtfSourceAudit(root,{fiveMinuteCapture:five.input,minuteCapture:readEtfSetupJson(root,args[2])},at);verifyEtfSetup(root,r.path);
    return {path:r.path,fingerprint:r.record.reportFingerprint,assets:r.record.report.assets.map(({rows,...a})=>({...a,differences:rows.filter(r=>r.status==='DIFFERENT')})),executionAllowed:false};
  }
  if(args.length===2&&mode==='--record-source'){
    const r=recordRobinhoodEtfBars(root,readEtfSetupJson(root,arg),at);verifyEtfSetup(root,r.path);
    return {path:r.path,assets:r.record.report.assets.map(a=>({symbol:a.symbol,status:a.status,bars:a.returnedBars,unknownInterpolation:a.unknownInterpolation,blockers:a.blockers,observations:a.observations})),executionAllowed:false};
  }
  if(args.length===2&&mode==='--verify'){const r=verifyEtfSetup(root,arg);return {status:'VERIFIED',path:arg,fingerprint:r.reportFingerprint,executionAllowed:false};}
  if(args.length===2&&['--register','--import'].includes(mode)){
    const value=readEtfSetupJson(root,arg),r=mode==='--register'?registerEtfSetup(root,value,at):importEtfBars(root,value,at);
    verifyEtfSetup(root,r.path);return {path:r.path,executionAllowed:false};
  }
  if((['--desk','--observe','--save-observation'].includes(mode)&&args.length===1)||(mode==='--snapshot'&&args.length===2)){
    const state=await createWorkbenchData({workspaceRoot:root,now:()=>at}).state();
    if(mode==='--desk')return state.etfSetup;
    if(mode==='--observe')return state.etfSetup.data?.observation??state.etfSetup;
    if(mode==='--save-observation'){
      const r=saveEtfObservation(root,state.guidance.data.input,at);verifyEtfSetup(root,r.path);
      return {path:r.path,fingerprint:r.record.reportFingerprint,assets:r.record.report.assets.map(a=>({symbol:a.symbol,status:a.status,momentum:a.momentum,referenceRange:a.referenceRange,scenarios:a.scenarios.map(s=>({side:s.side,total:s.totalSameSide,sampleFit:s.sampleFitCount,references:s.references.map(r=>({id:r.contract.id,expiry:r.contract.expiry,strike:r.contract.strike,askCents:r.contract.askCents,blockers:r.blockers}))}))})),executionAllowed:false};
    }
    const r=saveEtfSetupAssessment(root,state.guidance.data.input,arg,at);verifyEtfSetup(root,r.path);return {path:r.path,report:r.record.report,executionAllowed:false};
  }
  throw Error('ETF_SETUP_ARGUMENTS');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(await runEtfSetup(process.argv.slice(2)),null,2));}catch(e){console.error(JSON.stringify({error:/^[A-Z_]+$/.test(e?.message)?e.message:'ETF_SETUP_LOCAL_FAILURE',executionAllowed:false}));process.exitCode=2;}}
