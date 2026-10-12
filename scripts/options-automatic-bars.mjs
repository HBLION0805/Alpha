import {readFileSync,writeFileSync,mkdirSync,realpathSync,lstatSync,existsSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {acquireAutomaticBars,barHash,validateBarRequest,extractBarCapture} from './lib/options-automatic-bars-host.mjs';
import {assessAutomaticEquityBars} from '../src/engines/options-robinhood-data/AutomaticEquityBars.ts';
import {assessThreeFacet} from '../src/engines/options-three-facet/OptionsThreeFacet.ts';
import {paperSession} from '../src/engines/options-robinhood-data/RobinhoodPaperSession.ts';

const read=p=>{const s=lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>8*1024*1024)throw Error('AUTO_BARS_FILE');return JSON.parse(readFileSync(p,'utf8'));};
function privateBase(root){const base=resolve(root,'data/runtime/options-workbench-development');if(realpathSync(base)!==base)throw Error('AUTO_BARS_PRIVATE_SCOPE');return base;}
function privatePath(root,path){const base=privateBase(root),p=realpathSync(path);if(!p.startsWith(base+sep))throw Error('AUTO_BARS_PRIVATE_SCOPE');return p;}
const optionalOriginals=['intent.json','events.json','host.jsonl','host-stderr.txt','host-prompt.txt','run.json','source-reference.json'];
export function currentBarRequest(symbols,at){
 const session=paperSession(new Date(at).toISOString(),undefined);
 if(!session.knownYear||session.holiday)throw Error('AUTO_BARS_NO_REVIEWED_SESSION');
 const midnight=Date.parse(session.date+'T00:00:00Z');let open=null,end=null;
 for(let n=0;n<24*60;n+=5){const t=midnight+n*60000;if(paperSession(new Date(t).toISOString(),undefined).isOpen){open??=t;end=t+300000;}}
 const cutoff=Math.min(end??0,Math.floor(Date.parse(at)/300000)*300000);
 if(open===null||cutoff<=open)throw Error('AUTO_BARS_NO_COMPLETED_SESSION_BARS');
 return validateBarRequest({symbols,start_time:new Date(open).toISOString(),end_time:new Date(cutoff).toISOString(),interval:'5minute',bounds:'regular',adjustment_type:'none'});
}
export function buildAutomaticBarResearch(capture,at){
 const report=assessAutomaticEquityBars(capture,at);
 const research=report.assets.map(a=>{
  const input={version:'THREE_FACET_INPUT_V1',symbol:a.symbol,instrumentType:['SPY','QQQ'].includes(a.symbol)?'ETF':'EQUITY',asOf:at,holdingFrom:at,holdingThrough:new Date(Date.parse(at)+30*60000).toISOString(),automaticBars:{capture},technical:null};
  const assessment=assessThreeFacet(input);
  const dailyMeaning=report.version==='AUTOMATIC_DAILY_BAR_RESEARCH_V1'?{dateMeaning:'Source UTC date labels mapped locally to reviewed sessions; modeled session completion is not provider finality.',holdingWindowMeaning:'The 30-minute evaluator window is an unqualified context placeholder, not a daily-data forecast or a registered holding plan.'}:{};
  return {symbol:a.symbol,input,assessment,interpretation:{status:a.metrics?'OBSERVED_WINDOW_ONLY':'INSUFFICIENT_BAR_EVIDENCE',observedDirection:a.metrics?.observedDirection??'UNKNOWN',holdingWindowPriceThesis:'UNKNOWN',referenceRange:a.metrics?{low:a.metrics.low,high:a.metrics.high}:null,volumeRatio:a.metrics?.lastVolumeRatio??null,meaning:'Historical completed-window structure and provider share volume only. Range is an observation, not a registered trigger. Fundamental/news review, prospective conditions and original risk gates remain required.',...dailyMeaning}};
 });
 return {report,research};
}
export function persistAutomaticBarResearch(dir,capture,at){
 const derived=buildAutomaticBarResearch(capture,at);
 for(const [name,value] of Object.entries(derived))writeFileSync(join(dir,name+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 const files=['capture.json','report.json','research.json',...optionalOriginals.filter(name=>existsSync(join(dir,name)))];
 const manifest={version:'AUTOMATIC_BAR_MANIFEST_V1',assessedAt:at,files:files.map(name=>({name,sha256:barHash(readFileSync(join(dir,name)))})),executionAllowed:false};
 writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return {status:'AUTOMATIC_RESEARCH_SAVED',dir,assets:derived.report.assets.map(a=>({symbol:a.symbol,status:a.status,bars:a.completedBars,unknownInterpolation:a.unknownInterpolation,issues:a.issues})),researchConsumption:derived.research.map(r=>({symbol:r.symbol,observation:r.assessment.automaticTechnicalObservation?.status??null,gate:r.assessment.recommendationGate})),executionAllowed:false};
}
export function recoverAutomaticBarResearch(root,path,now=new Date().toISOString()){
 const dir=privatePath(root,path),m=read(join(dir,'manifest.json'));
 const names=m.files?.map(x=>x.name);
 if(m.version!=='AUTOMATIC_BAR_MANIFEST_V1'||!Array.isArray(names)||new Set(names).size!==names.length||JSON.stringify(names.slice(0,3))!==JSON.stringify(['capture.json','report.json','research.json'])||names.slice(3).some(n=>!optionalOriginals.includes(n)))throw Error('AUTO_BARS_MANIFEST');
 for(const f of m.files)if(barHash(readFileSync(join(dir,f.name)))!==f.sha256)throw Error('AUTO_BARS_HASH');
 const capture=read(join(dir,'capture.json')),derived=buildAutomaticBarResearch(capture,m.assessedAt);
 if(names.includes('events.json')){
  const events=read(join(dir,'events.json')),rebuilt=extractBarCapture(events,capture.request);
  if(JSON.stringify(rebuilt)!==JSON.stringify(capture))throw Error('AUTO_BARS_HOST_BINDING');
  const original=readFileSync(join(dir,'host.jsonl'),'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
  if(JSON.stringify(original)!==JSON.stringify(events.map(e=>e.event)))throw Error('AUTO_BARS_HOST_BYTES');
 }
 for(const key of ['report','research'])if(JSON.stringify(read(join(dir,key+'.json')))!==JSON.stringify(derived[key]))throw Error('AUTO_BARS_REPLAY');
 return {status:'COPIED_CAPTURE_REPLAY_PASS',originalAssessmentAt:m.assessedAt,checkedAt:now,sourceAgeSeconds:(Date.parse(now)-Date.parse(capture.receivedAt))/1000,newSourceCalls:0,assets:derived.report.assets.map(a=>({symbol:a.symbol,status:a.status,metrics:a.metrics})),executionAllowed:false};
}
export async function automaticBarsCli(args,{root=process.cwd(),clock=()=>new Date().toISOString()}={}){
 if(args.length===1&&args[0]==='--help')return {usage:'--capture --run-id ID --host-config FILE [--symbols SPY,QQQ,AAPL,TSM] | --analyze CAPTURE --run-id ID | --recover DIRECTORY',scope:'One-shot automatic current regular-session bars to private research. Existing OAuth only. No timer, retry, trade or journal.'};
 if(args.length===2&&args[0]==='--recover')return recoverAutomaticBarResearch(root,resolve(root,args[1]),clock());
 if(args.length===4&&args[0]==='--analyze'&&args[2]==='--run-id'){
  if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(args[3]))throw Error('AUTO_BARS_RUN_ID');
  const source=privatePath(root,resolve(root,args[1])),capture=read(source),dir=join(privateBase(root),args[3]);
  buildAutomaticBarResearch(capture,clock()); // validate before creating derived directory
  mkdirSync(dir);writeFileSync(join(dir,'capture.json'),readFileSync(source),{flag:'wx'});
  writeFileSync(join(dir,'source-reference.json'),JSON.stringify({source,sha256:barHash(readFileSync(source)),copiedAt:clock()},null,2)+'\n',{flag:'wx'});
  return persistAutomaticBarResearch(dir,capture,clock());
 }
 if(args[0]!=='--capture'||![5,7].includes(args.length)||args[1]!=='--run-id'||args[3]!=='--host-config'||args.length===7&&args[5]!=='--symbols')throw Error('AUTO_BARS_ARGUMENTS');
 const request=currentBarRequest(args[6]?args[6].split(','):['SPY','QQQ','AAPL','TSM'],clock());
 const acquired=await acquireAutomaticBars({root,request,runId:args[2],hostConfig:resolve(root,args[4]),clock});
 if(!acquired.capture)return acquired.result;
 try{return {...acquired.result,research:persistAutomaticBarResearch(acquired.dir,acquired.capture,clock())};}
 catch(e){const failure={status:'SOURCE_SAVED_RESEARCH_BLOCKED',error:e.message,executionAllowed:false};writeFileSync(join(acquired.dir,'research-failure.json'),JSON.stringify(failure,null,2)+'\n',{flag:'wx'});return {...acquired.result,research:failure};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)automaticBarsCli(process.argv.slice(2)).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
