import {existsSync,realpathSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {spawn} from "node:child_process";
import {optionsEvidenceExportStorage as io} from "./options-evidence-export.mjs";
import {guidanceLocal} from "../src/engines/options-daily-guidance/OptionsDailyGuidance.ts";
import {createWorkbenchData} from "./lib/options-workbench-data.mjs";
import {publishGuidance} from "./lib/options-guidance-io.mjs";
const BASE="data/runtime/options-context-service";
const COMMANDS={headlines:"scripts/options-drivers.mjs",btc:"scripts/options-btc-context.mjs",treasury:"scripts/options-treasury.mjs",bls:"scripts/options-release-calendar.mjs",fomc:"scripts/options-fomc-calendar.mjs"};
export function contextRefreshSlots(at) {
  const local=guidanceLocal(at),hour=at.slice(0,13).replace(/:/g,"-");
  return [{key:"hourly-"+hour,sources:["headlines","btc"]},...(local.minute>=540&&local.minute<1080?[{key:"daily-"+local.date,sources:["treasury","bls","fomc"]}]:[])];
}
export async function runPublicContextOnce({workspaceRoot=process.cwd(),now=()=>new Date().toISOString(),execute,issue=true}={}) {
  const root=realpathSync(workspaceRoot),at=now(),results=[];
  for(const slot of contextRefreshSlots(at)) {
    const parent=BASE+"/"+at.slice(0,10),claim=parent+"/"+slot.key+".claim.json";
    io.directory(root,parent);
    if(existsSync(resolve(root,claim))){io.readBytes(root,claim,10000);results.push({slot:slot.key,status:"ALREADY_ATTEMPTED"});continue;}
    try{io.writeExclusive(root,claim,Buffer.from(JSON.stringify({at,slot:slot.key,sources:slot.sources,status:"STARTED"})+"\n"));}
    catch(e){if(e?.code==="EEXIST"){results.push({slot:slot.key,status:"ALREADY_ATTEMPTED"});continue;}throw e;}
    const sources=[];
    for(const name of slot.sources) {
      // Fixed script names only. No shell, caller-selected endpoint or command string.
      const args=["node_modules/tsx/dist/cli.mjs",COMMANDS[name],"--refresh"];
      let result;
      try {result=execute?await execute(name,args):await new Promise(resolveRun=>{
        const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,shell:false,stdio:["ignore","pipe","pipe"]});let output="",tooLarge=false,done=false;
        const timer=setTimeout(()=>{child.kill();finish({status:"FAILED",code:"REFRESH_DEADLINE"});},90000);
        const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolveRun(value);};
        child.stdout.on("data",b=>{if(output.length+b.length>8*1024*1024){tooLarge=true;child.kill();}else output+=b.toString("utf8");});
        child.stderr.resume();child.once("error",()=>finish({status:"FAILED",code:"REFRESH_START_FAILED"}));
        child.once("close",code=>finish({status:code===0&&!tooLarge?"OK":"FAILED",code:tooLarge?"REFRESH_OUTPUT_LIMIT":code===0?null:"REFRESH_FAILED",exitCode:code}));
      });}
      catch{result={status:"FAILED",code:"REFRESH_FAILED"};}
      sources.push({source:name,status:result.status==="OK"?"OK":"FAILED",code:result.status==="OK"?null:result.code??"REFRESH_FAILED",finishedAt:now()});
    }
    const receipt={slot:slot.key,startedAt:at,finishedAt:now(),sources,accountAccessed:false,executionAllowed:false};
    io.writeExclusive(root,parent+"/"+slot.key+".receipt.json",Buffer.from(JSON.stringify(receipt,null,2)+"\n"));results.push(receipt);
  }
  let reportPath=null;
  if(issue&&results.some(r=>r.sources)) {const state=await createWorkbenchData({workspaceRoot:root,now}).state();if(state.guidance.state==="AVAILABLE")reportPath=publishGuidance(root,state);}
  return {checkedAt:at,results,reportPath,accountAccessed:false,executionAllowed:false};
}
export function startPublicContextService(options={}) {
  let active=false,stopped=false;
  const tick=async()=>{if(active||stopped)return;active=true;try{await runPublicContextOnce(options);}catch{ /* Journals retain source failures. Next hour is a new bounded attempt. */ }finally{active=false;}};
  const timer=setInterval(()=>void tick(),60000);void tick();
  return {stop(){stopped=true;clearInterval(timer);},tick};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  if(args.length!==1||!["--once","--serve"].includes(args[0])){console.error("CONTEXT_SERVICE_ARGUMENTS");process.exitCode=2;}
  else if(args[0]==="--once"){try{const r=await runPublicContextOnce();console.log(JSON.stringify(r,null,2));if(r.results.some(x=>x.sources?.some(s=>s.status==="FAILED")))process.exitCode=3;}catch{console.error("CONTEXT_SERVICE_LOCAL_FAILURE");process.exitCode=2;}}
  else {const service=startPublicContextService();console.log("Alpha public context service active: hourly headlines/BTC; daily Treasury/BLS/FOMC. No brokerage connection.");for(const signal of ["SIGTERM","SIGINT"])process.once(signal,()=>{service.stop();process.exit(0);});}
}
