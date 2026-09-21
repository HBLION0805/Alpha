import {existsSync,realpathSync,statSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {spawn} from "node:child_process";
import {optionsEvidenceExportStorage as io} from "./options-evidence-export.mjs";
import {guidanceLocal} from "../src/engines/options-daily-guidance/OptionsDailyGuidance.ts";
import {createWorkbenchData} from "./lib/options-workbench-data.mjs";
import {publishGuidance} from "./lib/options-guidance-io.mjs";
import {observePaperPlans} from "./lib/options-paper-observation-io.mjs";
import {observeTrendStudiesSafely} from './lib/options-trend-study-io.mjs';
import {optionsCodeRoot,contextWorkspaceArgs} from './lib/options-runtime-roots.mjs';
import {contextCommandResult,contextLocalFailure} from './lib/options-context-diagnostics.mjs';
const BASE="data/runtime/options-context-service";
const COMMANDS={headlines:"scripts/options-drivers.mjs",btc:"scripts/options-btc-context.mjs",treasury:"scripts/options-treasury.mjs",bls:"scripts/options-release-calendar.mjs",fomc:"scripts/options-fomc-calendar.mjs",focused_news:"scripts/options-focused-news.mjs",macro_context:"scripts/options-macro-context.mjs"};
export function contextRefreshSlots(at) {
  const local=guidanceLocal(at),hour=at.slice(0,13).replace(/:/g,"-");
  return [{key:"hourly-"+hour,sources:["headlines","btc"]},...(local.minute>=540?[{key:"daily-"+local.date,sources:["treasury","bls","fomc"]}]:[]),{key:"focused-hourly-"+hour,sources:["focused_news"]},...(local.minute>=1020?[{key:"macro-daily-"+local.date,sources:["macro_context"]}]:[])];
}
export async function runPublicContextOnce({codeRoot=optionsCodeRoot,workspaceRoot=process.cwd(),now=()=>new Date().toISOString(),execute,issue=true}={}) {
  const root=realpathSync(workspaceRoot),programRoot=realpathSync(codeRoot),at=now(),results=[];
  for(const slot of contextRefreshSlots(at)) {
    // Daily reads remain eligible after a late startup, through local midnight.
    // Both daily slots use their New York date across UTC midnight; original
    // daytime claim paths and the hourly UTC keys remain unchanged.
    const claimDate=slot.key.startsWith("macro-daily-")?slot.key.slice("macro-daily-".length):slot.key.startsWith("daily-")?slot.key.slice("daily-".length):at.slice(0,10);
    const parent=BASE+"/"+claimDate,claim=parent+"/"+slot.key+".claim.json";
    io.directory(root,parent);
    if(existsSync(resolve(root,claim))){io.readBytes(root,claim,10000);const receiptPath=parent+'/'+slot.key+'.receipt.json';let previous=null;
      if(existsSync(resolve(root,receiptPath)))previous=JSON.parse(io.readBytes(root,receiptPath,65536));
      results.push({slot:slot.key,status:"ALREADY_ATTEMPTED",expectedSources:slot.sources,receiptPath:previous?receiptPath:null,previous});continue;}
    try{io.writeExclusive(root,claim,Buffer.from(JSON.stringify({at,slot:slot.key,sources:slot.sources,status:"STARTED"})+"\n"));}
    catch(e){if(e?.code==="EEXIST"){results.push({slot:slot.key,status:"ALREADY_ATTEMPTED"});continue;}throw e;}
    const sources=[];
    for(const name of slot.sources) {
      // Fixed script names only. No shell, caller-selected endpoint or command string.
      const args=[resolve(programRoot,"node_modules/tsx/dist/cli.mjs"),resolve(programRoot,COMMANDS[name]),"--refresh","--workspace",root],attemptedAt=now();
      let result;
      try {result=execute?await execute(name,args,{cwd:programRoot}):!args.slice(0,2).every(p=>existsSync(p)&&statSync(p).isFile())?{status:'FAILED',code:'EXECUTABLE_MISSING'}:await new Promise(resolveRun=>{
        const child=spawn(process.execPath,args,{cwd:programRoot,windowsHide:true,shell:false,stdio:["ignore","pipe","pipe"]});let output="",stderr="",tooLarge=false,done=false;
        const timer=setTimeout(()=>{child.kill();finish({status:"FAILED",code:"REFRESH_DEADLINE"});},90000);
        const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolveRun(value);};
        child.stdout.on("data",b=>{if(output.length+b.length>8*1024*1024){tooLarge=true;child.kill();}else output+=b.toString("utf8");});
        child.stderr.on('data',b=>{if(stderr.length<8192)stderr+=b.toString('utf8').slice(0,8192-stderr.length);});
        child.once("error",e=>finish({status:"FAILED",code:e?.code==='ENOENT'?'EXECUTABLE_MISSING':'REFRESH_START_FAILED'}));
        child.once("close",code=>finish(tooLarge?{status:'FAILED',code:'REFRESH_OUTPUT_LIMIT',exitCode:code}:/ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/.test(stderr)?{status:'FAILED',code:'EXECUTABLE_MISSING',exitCode:code}:contextCommandResult(name,output,code,stderr)));
      });}
      catch{result={status:"FAILED",code:"REFRESH_FAILED"};}
      sources.push({source:name,status:result.status==="OK"?"OK":"FAILED",code:result.status==="OK"?null:result.code??"REFRESH_FAILED",attemptedAt,finishedAt:now(),exitCode:result.exitCode??null,details:result.details??[],evidencePath:result.evidencePath??null});
    }
    const receipt={slot:slot.key,startedAt:at,finishedAt:now(),sources,accountAccessed:false,executionAllowed:false};
    io.writeExclusive(root,parent+"/"+slot.key+".receipt.json",Buffer.from(JSON.stringify(receipt,null,2)+"\n"));results.push(receipt);
  }
  let reportPath=null;
  if(issue&&results.some(r=>r.sources)) {const state=await createWorkbenchData({workspaceRoot:root,now}).state();if(state.guidance.state==="AVAILABLE")reportPath=publishGuidance(root,state);}
  const eligible=new Set(contextRefreshSlots(at).flatMap(s=>s.sources));
  return {checkedAt:at,results,notYetEligible:Object.keys(COMMANDS).filter(s=>!eligible.has(s)).map(source=>({source,status:'NOT_YET_ELIGIBLE'})),reportPath,accountAccessed:false,executionAllowed:false};
}
export function runLocalPaperFinalization({workspaceRoot=process.cwd(),now=()=>new Date().toISOString()}={}) {
  const checkedAt=now();
  try {
    const pass=observePaperPlans(workspaceRoot,null,checkedAt);
    return {checkedAt,status:pass.results.some(r=>r.error)?'PARTIAL':'OK',results:pass.results,remainingBeyondPassLimit:pass.remainingBeyondPassLimit,error:null,sourceReads:0,executionAllowed:false};
  } catch {
    return {checkedAt,status:'FAILED',results:[],remainingBeyondPassLimit:null,error:'LOCAL_PAPER_RECOVERY_FAILED',sourceReads:0,executionAllowed:false};
  }
}
export function startPublicContextService(options={}) {
  let active=false,stopped=false,paperFinalization={checkedAt:null,status:'NOT_CHECKED',results:[],error:null,sourceReads:0,executionAllowed:false};
  let trendStatus={checkedAt:null,status:'NOT_CHECKED',error:null,sourceReads:0,executionAllowed:false};
  let refreshStatus={checkedAt:null,status:'NOT_CHECKED',results:[],error:null};
  const tick=async()=>{if(active||stopped)return;active=true;try{
    refreshStatus={checkedAt:options.now?.()??new Date().toISOString(),status:'RUNNING',results:[],error:null};
    // Offline finalization must survive Host inactivity and public-source failure.
    paperFinalization=runLocalPaperFinalization(options);
    // Offline prospective research uses the existing tick, never new source calls.
    const checkedAt=options.now?.()??new Date().toISOString();
    trendStatus=observeTrendStudiesSafely(options.workspaceRoot??process.cwd(),checkedAt);
    const result=await runPublicContextOnce(options);
    refreshStatus={...result,status:result.results.some(r=>r.status==='ALREADY_ATTEMPTED'&&!r.previous||(r.sources??r.previous?.sources??[]).some(s=>s.status==='FAILED'))?'PARTIAL':'OK',error:null};
  }catch(error){refreshStatus={...refreshStatus,status:'FAILED',error:contextLocalFailure(error)};}finally{active=false;}};
  const timer=setInterval(()=>void tick(),60000);void tick();
  return {stop(){stopped=true;clearInterval(timer);},tick,status:()=>structuredClone({enabled:!stopped,...refreshStatus}),trendStatus:()=>structuredClone({enabled:!stopped,...trendStatus}),paperStatus:()=>structuredClone({enabled:!stopped,...paperFinalization})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  let parsed;try{parsed=contextWorkspaceArgs(process.argv.slice(2));}catch{console.error('CONTEXT_SERVICE_ARGUMENTS');process.exitCode=2;}
  const args=parsed?.args??[];
  if(args.length!==1||!["--once","--serve"].includes(args[0])){console.error("CONTEXT_SERVICE_ARGUMENTS");process.exitCode=2;}
  else if(args[0]==="--once"){try{const r=await runPublicContextOnce({workspaceRoot:parsed.workspaceRoot});console.log(JSON.stringify(r,null,2));if(r.results.some(x=>x.sources?.some(s=>s.status==="FAILED")))process.exitCode=3;}catch{console.error("CONTEXT_SERVICE_LOCAL_FAILURE");process.exitCode=2;}}
  else {const service=startPublicContextService({workspaceRoot:parsed.workspaceRoot});console.log("Alpha public context service active: hourly headlines/BTC; daily Treasury/BLS/FOMC. No brokerage connection.");for(const signal of ["SIGTERM","SIGINT"])process.once(signal,()=>{service.stop();process.exit(0);});}
}
