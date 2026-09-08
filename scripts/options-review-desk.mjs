import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { paperFingerprint } from "../src/engines/options-paper/OptionsPaperTradingEngine.ts";
import { readinessClock } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { exportId } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";
import { parseChainSurveyJson } from "../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts";
import { manualUsdUnits } from "../src/engines/options-manual-ledger/OptionsManualLedger.ts";
import { optionsEvidenceExportStorage as io } from "./options-evidence-export.mjs";
import { readManualLedger } from "./options-manual-ledger.mjs";
import { runOptionsChainReviewCommand } from "./options-chain-review.mjs";
import { runOptionsActivityStudyCommand } from "./options-activity-study.mjs";
import { renderOptionsReviewDesk } from "./lib/options-review-desk-render.mjs";
const BASE="data/runtime/options-review-desk",MAX=32*1024*1024,TOTAL=64*1024*1024;
const json=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const hash=b=>createHash('sha256').update(b).digest('hex');
const parse=b=>parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(b));
const fail=c=>{throw Error('REVIEW_DESK_'+c);};
const read=(root,path)=>io.readBytes(root,path,MAX);
function validateSpec(s){
  if(!s||Object.keys(s).sort().join()!==['ledgerId','chainId','activity'].sort().join())fail('SPEC');
  exportId(s.ledgerId);if(s.chainId!==null)exportId(s.chainId);
  if(s.activity!==null){if(Object.keys(s.activity).sort().join()!=='reportId,studyId')fail('SPEC');exportId(s.activity.studyId);exportId(s.activity.reportId);}
}
function sourceState(root,s,at){
  validateSpec(s);readinessClock(at);const now=()=>at,manual=readManualLedger(root,s.ledgerId,now),files=[...manual.files];
  let chain=null,activity=null;
  if(s.chainId!==null){
    runOptionsChainReviewCommand(['--verify',s.chainId],{workspaceRoot:root,now});const base='data/runtime/options-chain-survey/'+s.chainId;
    const m=parse(read(root,base+'/manifest.json'));for(const path of ['manifest.json',...m.files.map(f=>f.path)])files.push({path:base+'/'+path,bytes:read(root,base+'/'+path)});
    chain=parse(read(root,base+'/report.json'));
  }
  if(s.activity!==null){
    runOptionsActivityStudyCommand(['--verify-report',s.activity.studyId,s.activity.reportId],{workspaceRoot:root,now});
    const base='data/runtime/options-activity-studies/'+s.activity.studyId,rep=base+'/reports/'+s.activity.reportId;
    const e=parse(read(root,rep+'/inputs.json'));
    for(const path of [base+'/payload.json',base+'/receipt.json',...['inputs.json','report.json','review.md',...e.snapshots.map(x=>'close-'+x.sessionDate.replaceAll('-','')+'.json')].map(p=>rep+'/'+p)])files.push({path,bytes:read(root,path)});
    activity=parse(read(root,rep+'/report.json'));
  }
  const seen=new Map();for(const f of files){if(seen.has(f.path)&&!seen.get(f.path).equals(f.bytes))fail('SOURCE_CONFLICT');seen.set(f.path,f.bytes);}
  return {manual,chain,activity,files:[...seen].map(([path,bytes])=>({path,bytes})).sort((a,b)=>a.path.localeCompare(b.path))};
}
function buildReport(state,s,at){
  const {manual,chain,activity}=state,quotes=new Map(chain?.chain.rows.map(r=>[r.id,r])??[]);
  const rows=activity?.cases.map(c=>({candidate:c.candidate,control:c.control,cohort:c.cohort,
    primary:c.outcomes.find(o=>o.primary&&o.costScenario==='ILLUSTRATIVE_BASE'),savedQuote:quotes.get(c.candidate.id)??null,
    manualTradeIds:manual.report.trades.filter(t=>t.activityReference?.studyId===s.activity.studyId&&t.activityReference.studyFingerprint===activity.studyFingerprint&&t.activityReference.candidateId===c.candidate.id&&t.contract.symbol===c.candidate.symbol&&t.contract.expiry===c.candidate.expiry&&t.contract.optionType===c.candidate.type.toUpperCase()&&manualUsdUnits(t.contract.strikeUsd)===manualUsdUnits(c.candidate.strike)).map(t=>t.tradeId)}))??null;
  const body={version:'OPTIONS_REVIEW_DESK_V1',createdAt:at,manual:manual.report,
    activity:activity?{studyId:s.activity.studyId,reportId:s.activity.reportId,origin:activity.origin,assessedAt:activity.assessedAt,counts:activity.counts,rows,summaries:activity.summaries,validatedEdge:false}:null,
    paper:chain?.paper??null,
    sources:{manualHeadSha256:manual.headSha256,manualOrigin:manual.input.origin,manualLastSavedAt:manual.lastSavedAt,chainFingerprint:chain?.reportFingerprint??null,chainOrigin:chain?.chain.origin??null,chainCapturedAt:chain?.chain.capturedAt??null,activityFingerprint:activity?.reportFingerprint??null,activityAssessedAt:activity?.assessedAt??null,sourceRefresh:false,accountAccessed:false},
    links:{chain:s.chainId?'dependencies/data/runtime/options-chain-survey/'+s.chainId+'/index.html':null,
      activityReview:s.activity?'dependencies/data/runtime/options-activity-studies/'+s.activity.studyId+'/reports/'+s.activity.reportId+'/review.md':null,
      activityReport:s.activity?'dependencies/data/runtime/options-activity-studies/'+s.activity.studyId+'/reports/'+s.activity.reportId+'/report.json':null},executionAllowed:false};
  return {...body,reportFingerprint:paperFingerprint(body)};
}
function verify(root,id,now){
  exportId(id);const base=BASE+'/'+id,mBytes=read(root,base+'/manifest.json'),m=parse(mBytes);validateSpec(m.spec);readinessClock(m.createdAt);const at=now();readinessClock(at);if(at<m.createdAt)fail('CLOCK');
  if(m.version!=='OPTIONS_REVIEW_DESK_FILES_V1'||m.snapshotId!==id||m.executionAllowed!==false||!Array.isArray(m.files)||m.files.length>2100||!json(m).equals(mBytes))fail('MANIFEST');
  if(Object.keys(m).sort().join()!==['version','snapshotId','createdAt','spec','reportFingerprint','files','executionAllowed'].sort().join())fail('MANIFEST');
  let total=0;for(const f of m.files){if(Object.keys(f).sort().join()!=='bytes,path,sha256'||typeof f.path!=='string'||!/^[a-zA-Z0-9./_-]+$/.test(f.path)||f.path.startsWith('/')||f.path.split('/').some(p=>!p||p==='.'||p==='..'))fail('FILE');const bytes=read(root,base+'/'+f.path);total+=bytes.length;if(bytes.length!==f.bytes||hash(bytes)!==f.sha256||total>TOTAL)fail('FILE_HASH_OR_TOTAL');}
  const state=sourceState(realpathSync(resolve(root,base,'dependencies')),m.spec,m.createdAt),report=buildReport(state,m.spec,m.createdAt);
  const expected=['report.json','index.html','guide.md',...state.files.map(f=>'dependencies/'+f.path)];
  if(m.files.map(f=>f.path).join('|')!==expected.join('|'))fail('EXPECTED_FILES');
  if(report.reportFingerprint!==m.reportFingerprint||!json(report).equals(read(root,base+'/report.json'))||!Buffer.from(renderOptionsReviewDesk(report)).equals(read(root,base+'/index.html')))fail('RECOMPUTATION');
  let visited=0;function listed(dir,rel='',depth=0){if(depth>16)fail('DIRECTORY_BOUND');const out=[];for(const e of readdirSync(dir,{withFileTypes:true})){if(++visited>2200)fail('DIRECTORY_BOUND');if(e.isSymbolicLink())fail('LINK');const p=rel+e.name;if(e.isDirectory())out.push(...listed(resolve(dir,e.name),p+'/',depth+1));else out.push(p);}return out;}
  if(listed(resolve(root,base)).sort().join('|')!==['manifest.json',...expected].sort().join('|'))fail('UNEXPECTED_FILES');
  return {status:'REVIEW_DESK_RECOMPUTED',snapshotId:id,path:base+'/index.html',reportFingerprint:report.reportFingerprint,manualCounts:report.manual.counts,activityCounts:report.activity?.counts??null,executionAllowed:false};
}
export function runOptionsReviewDeskCommand(args,{workspaceRoot=process.cwd(),now=()=>new Date().toISOString()}={}){
  if(args.length===1&&args[0]==='--help')return {usage:['options:review-desk -- --build <ledger-id> <new-snapshot-id> [--chain <saved-board-id>] [--activity <study-id> <saved-report-id>]','options:review-desk -- --verify <snapshot-id>'],sourceRefresh:false,executionAllowed:false};
  const root=realpathSync(workspaceRoot);if(args.length===2&&args[0]==='--verify')return verify(root,args[1],now);
  if(args[0]!=='--build'||args.length<3)fail('ARGUMENTS');const id=args[2];exportId(id);const spec={ledgerId:args[1],chainId:null,activity:null};
  for(let i=3;i<args.length;){if(args[i]==='--chain'&&spec.chainId===null&&args[i+1]){spec.chainId=args[i+1];i+=2;}else if(args[i]==='--activity'&&spec.activity===null&&args[i+1]&&args[i+2]){spec.activity={studyId:args[i+1],reportId:args[i+2]};i+=3;}else fail('ARGUMENTS');}
  validateSpec(spec);const startedAt=now();readinessClock(startedAt);const state=sourceState(root,spec,startedAt),createdAt=now();readinessClock(createdAt);if(createdAt<startedAt)fail('CLOCK');
  const report=buildReport({...state,manual:{...state.manual,report:readManualLedger(root,spec.ledgerId,()=>createdAt).report}},spec,createdAt);
  // Recheck the same source prefix at the final read clock before copying it.
  const latest=sourceState(root,spec,createdAt);if(latest.files.length!==state.files.length||latest.files.some((f,i)=>f.path!==state.files[i].path||!f.bytes.equals(state.files[i].bytes)))fail('SOURCE_CHANGED');
  const files=[{path:'report.json',bytes:json(report)},{path:'index.html',bytes:Buffer.from(renderOptionsReviewDesk(report))},{path:'guide.md',bytes:read(root,'docs/OPTIONS_MANUAL_LEDGER_GUIDE.md')},...state.files.map(f=>({path:'dependencies/'+f.path,bytes:f.bytes}))];
  if(files.length>2100||files.some(f=>f.bytes.length>MAX)||files.reduce((n,f)=>n+f.bytes.length,0)>TOTAL)fail('OUTPUT_BOUND');
  io.directory(root,BASE);const base=BASE+'/'+id;mkdirSync(resolve(root,base));
  for(const f of files){const slash=f.path.lastIndexOf('/');if(slash>=0)io.directory(root,base+'/'+f.path.slice(0,slash));io.writeExclusive(root,base+'/'+f.path,f.bytes);}
  const m={version:'OPTIONS_REVIEW_DESK_FILES_V1',snapshotId:id,createdAt,spec,reportFingerprint:report.reportFingerprint,files:files.map(f=>({path:f.path,bytes:f.bytes.length,sha256:hash(f.bytes)})),executionAllowed:false};
  io.writeExclusive(root,base+'/manifest.json',json(m));return {...verify(root,id,now),status:'REVIEW_DESK_SAVED'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(runOptionsReviewDeskCommand(process.argv.slice(2)),null,2));}catch(e){console.error(/^(REVIEW_DESK_|MANUAL_|CHAIN_|ACTIVITY_|OPTIONS_EXPORT_)[A-Z_]+$/.test(e.message)?e.message:'REVIEW_DESK_OPERATION_FAILED');process.exitCode=1;}}
