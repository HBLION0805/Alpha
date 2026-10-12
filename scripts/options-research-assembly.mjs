import {readFileSync,writeFileSync,mkdirSync,realpathSync,lstatSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {assessThreeFacet} from '../src/engines/options-three-facet/OptionsThreeFacet.ts';
import {prepareTechSpreadInput} from './lib/options-tech-spread-preparation.mjs';
import {spreadPlanHash} from './lib/options-tech-spread-plan-binding.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const check=(ok,code)=>{if(!ok)throw Error('RESEARCH_ASSEMBLY_'+code);};
const time=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v)&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.split(',').sort().join();
const closed={sourceCalls:0,accountCalls:0,planCreated:false,journalWritten:false,executionAllowed:false,paperAdmissionAllowed:false,fills:0};

export function validityDiagnostic(from,through,at){
 if(from===undefined||through===undefined)return 'MISSING';
 if(from===null||through===null)return 'UNKNOWN';
 const f=time(from),t=time(through);if(f===null||t===null||f>t)return 'INVALID';
 if(f===t)return 'UNKNOWN_ZERO_DURATION_PLACEHOLDER';
 return t<time(at)?'EXPIRED':f>time(at)?'NOT_YET_VALID':'DECLARED_WINDOW_CURRENT';
}

// This is fact inventory and an explicit diagnostic binding, never a risk PASS.
export function simulatedFundsDiagnostic(preparation,accountId,at){
 const records=preparation?.records??[],matches=records.filter(r=>r.kind==='ACCOUNT_FUNDS');
 if(!matches.length)return {state:'MISSING',binding:'NOT_BOUND',facts:null};
 if(matches.length!==1)return {state:'INVALID_DUPLICATE',binding:'NOT_BOUND',facts:null};
 const r=matches[0];let p;
 try {check(r.origin==='SIMULATED_ACCOUNT_ASSUMPTION'&&typeof r.rawJson==='string'&&r.rawJson.length<=65536&&spreadPlanHash(r.rawJson)===r.sha256,'FUNDS_INTEGRITY');p=JSON.parse(r.rawJson);
  check(p.basis==='ISOLATED_SIMULATED_CAPITAL_V1'&&p.currency==='USD'&&/^paper-sim-[a-z0-9-]{1,50}$/.test(p.accountId),'FUNDS_CONTEXT');
  check([r.observedAt,r.receivedAt,r.reviewedAt].every(t=>time(t)!==null)&&time(r.observedAt)<=time(r.receivedAt)&&time(r.receivedAt)<=time(r.reviewedAt)&&time(r.reviewedAt)<=time(at),'FUNDS_CLOCK');
 }catch{return {state:'INVALID',binding:'NOT_BOUND',facts:null};}
 const keys=['initialCapitalCents','settledCashCents','reservedCashCents','unsettledCashCents','additionalDepositsCents','borrowingCents'];
 if(keys.some(k=>p[k]===null||p[k]===undefined))return {state:'UNKNOWN_AMOUNT',binding:'NOT_BOUND',facts:null,recordSha256:r.sha256};
 if(keys.some(k=>!Number.isSafeInteger(p[k])||p[k]<0)||p.reservedCashCents>p.settledCashCents)return {state:'INVALID_AMOUNT',binding:'NOT_BOUND',facts:null,recordSha256:r.sha256};
 const validity=validityDiagnostic(r.observedAt,r.validThrough,at);
 const binding=accountId===null||accountId===undefined?'UNBOUND':accountId!==p.accountId?'ACCOUNT_MISMATCH':validity!=='DECLARED_WINDOW_CURRENT'?'VALIDITY_NOT_CURRENT':r.verdict!=='PASS'?'REVIEW_NOT_PASSED':'BOUND_FOR_DIAGNOSTIC_REVIEW';
 return {state:'KNOWN_SIMULATED_FACTS',binding,accountId:p.accountId,recordSha256:r.sha256,validity,
  facts:structuredClone(p),originalEnvelope:structuredClone(r),currentBalance:'NOT_RECONCILED_BY_THIS_ASSEMBLER',sufficiency:'NOT_EVALUATED',riskVerdict:'NOT_GRANTED'};
}

/** Copies supplied facts into the existing ThreeFacet evaluator. No historical
 * registration is recreated; this is a current diagnostic of saved evidence. */
export function assembleResearchEvidence({research,sourceIndex,sourceBindings,sourceOriginals=[],bars,accountPreparation,accountId},at){
 check(time(at)!==null&&research?.version==='THREE_FACET_INPUT_V1'&&time(research.asOf)!==null&&time(research.asOf)<=time(at),'RESEARCH_CLOCK');
 check(Array.isArray(sourceIndex?.sources)&&sourceIndex.sources.length<=24&&Array.isArray(sourceBindings)&&sourceBindings.length<=50,'SOURCE_INPUT');
 check(new Set(sourceIndex.sources.map(s=>s.id)).size===sourceIndex.sources.length,'DUPLICATE_SOURCE');
 check(new Set(sourceBindings.map(s=>s.evidenceId)).size===sourceBindings.length,'DUPLICATE_BINDING');
 const input=structuredClone(research),sourceDiagnostics=[],validity={};
 for(const key of ['fundamental','news']){
  const f=input[key];validity[key]=validityDiagnostic(f?.validFrom,f?.validThrough,at);if(!f)continue;
  check(Array.isArray(f.evidence)&&f.evidence.length<=50,'EVIDENCE');
  if(['UNKNOWN_ZERO_DURATION_PLACEHOLDER','MISSING'].includes(validity[key])){f.validFrom=null;f.validThrough=null;}
  for(const e of f.evidence){
   const binding=sourceBindings.find(b=>b.evidenceId===e.id),source=binding?sourceIndex.sources.find(s=>s.id===binding.sourceId):null;
   const original=structuredClone(e);
   // The known faulty source index explicitly says this was a local review.
   // A supported receipt requires explicit original local tool-return attribution.
   const receiptOriginal=sourceOriginals.find(o=>o.sha256===source?.sha256)?.data;
   const receiptKnown=source?.receiptClockBasis==='ORIGINAL_LOCAL_TOOL_RETURN'&&time(source.receivedAt)!==null&&receiptOriginal?.receivedAt===source.receivedAt;
   e.receivedAt=receiptKnown?source.receivedAt:null;
   if(e.receivedAt!==null)check(time(e.receivedAt)<=time(e.reviewedAt)&&time(e.reviewedAt)<=time(at),'SOURCE_CLOCK_ORDER');
   else check(time(e.reviewedAt)!==null&&time(e.reviewedAt)<=time(at),'REVIEW_CLOCK');
   sourceDiagnostics.push({id:e.id,sourceId:source?.id??null,state:!binding?'UNBOUND':!source?'MISSING':receiptKnown?'ORIGINAL_RECEIPT_AVAILABLE':'RECEIPT_UNKNOWN',
    original,originalIndex:source?structuredClone(source):null,receivedAt:e.receivedAt,reviewedAt:e.reviewedAt,
    receiptMeaning:receiptKnown?'LOCAL_TOOL_RETURN_NOT_PROVIDER_HTTP_CLOCK':'UNKNOWN_NOT_REPLACED_BY_REVIEW_OR_COPY_TIME'});
  }
 }
 const capital=simulatedFundsDiagnostic(accountPreparation,accountId,at);
 if(capital.binding==='BOUND_FOR_DIAGNOSTIC_REVIEW'){
  const r=capital.originalEnvelope;input.risk??={};input.risk.capital??={state:'UNKNOWN',evidence:[]};
  input.risk.capital.sourceFacts=[{origin:r.origin,accountId:capital.accountId,recordSha256:r.sha256,observedAt:r.observedAt,receivedAt:r.receivedAt,reviewedAt:r.reviewedAt,validThrough:r.validThrough,payload:capital.facts}];
 }
 // This processing window exists only to inspect saved bars with current time.
 // It is not a renewed validity claim or a prospective research registration.
 input.asOf=at;input.holdingFrom=at;input.holdingThrough=new Date(time(at)+30*60000).toISOString();input.researchPlan=null;
 if(bars)input.automaticBars={capture:structuredClone(bars)};
 const assessment=assessThreeFacet(input);
 return {version:'RESEARCH_EVIDENCE_ASSEMBLY_V1',processedAt:at,context:'CURRENT_DIAGNOSTIC_OF_SAVED_ORIGINALS_NOT_PROSPECTIVE_DECISION',
  originalResearch:structuredClone(research),input,assessment,sourceDiagnostics,validity,
  originalHoldingWindow:{from:research.holdingFrom,through:research.holdingThrough,state:validityDiagnostic(research.holdingFrom,research.holdingThrough,at)},
  evaluationWindowMeaning:'UNQUALIFIED_30_MINUTE_CONTEXT_ONLY_NO_NEW_FORECAST_OR_REGISTRATION',capital,
  accountPreparation:accountPreparation?prepareTechSpreadInput({...accountPreparation,at}):null,...closed};
}

function base(root){const b=resolve(root,'data/runtime/options-workbench-development');check(realpathSync(b)===b,'PRIVATE_SCOPE');return b;}
function readPrivate(root,path){
 const p=resolve(root,path),b=base(root);check(p.startsWith(b+sep)&&realpathSync(p)===p,'PRIVATE_SCOPE');
 const s=lstatSync(p);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=8*1024*1024,'FILE');
 const bytes=readFileSync(p);return {bytes,data:JSON.parse(new TextDecoder('utf8',{fatal:true}).decode(bytes))};
}
function readRef(root,r){check(exact(r,'path,sha256')&&/^[a-f0-9]{64}$/.test(r.sha256),'REFERENCE');const o=readPrivate(root,r.path);check(hash(o.bytes)===r.sha256,'HASH');return o;}
function validateSpec(s){
 check(exact(s,'version,research,sourceIndex,sourceBindings,sourceOriginals,bars,accountPreparation,accountId')&&s.version==='RESEARCH_ASSEMBLY_REQUEST_V1','SPEC');
 check(s.accountId===null||/^paper-sim-[a-z0-9-]{1,50}$/.test(s.accountId),'ACCOUNT_ID');
 check(Array.isArray(s.sourceOriginals)&&s.sourceOriginals.length<=24,'SOURCE_ORIGINALS');
 for(const b of s.sourceBindings??[])check(exact(b,'evidenceId,sourceId')&&typeof b.evidenceId==='string'&&typeof b.sourceId==='string','BINDING');
}
function loadInputs(root,s){
 validateSpec(s);const loaded={};for(const k of ['research','sourceIndex','bars','accountPreparation'])loaded[k]=s[k]===null?null:readRef(root,s[k]);
 check(loaded.research&&loaded.sourceIndex,'REQUIRED_INPUT');
 const originals=s.sourceOriginals.map(r=>readRef(root,r));
 for(const b of s.sourceBindings){const row=loaded.sourceIndex.data.sources?.find(v=>v.id===b.sourceId);if(row)check(originals.some(o=>hash(o.bytes)===row.sha256),'SOURCE_ORIGINAL_HASH');}
 return {loaded,originals,args:{research:loaded.research.data,sourceIndex:loaded.sourceIndex.data,sourceBindings:s.sourceBindings,sourceOriginals:originals.map(o=>({sha256:hash(o.bytes),data:o.data})),bars:loaded.bars?.data??null,accountPreparation:loaded.accountPreparation?.data??null,accountId:s.accountId}};
}
export function saveResearchAssembly(root,s,runId,at){
 check(/^[a-z0-9][a-z0-9-]{0,79}$/.test(runId),'RUN_ID');
 const {loaded,originals,args}=loadInputs(root,s),report=assembleResearchEvidence(args,at),dir=join(base(root),runId);
 mkdirSync(dir);const files=[];
 const put=(name,bytes)=>{writeFileSync(join(dir,name),bytes,{flag:'wx'});files.push({name,sha256:hash(bytes)});};
 for(const [k,v]of Object.entries(loaded))if(v)put(k+'.json',v.bytes);
 originals.forEach((v,i)=>put('source-'+i+'.json',v.bytes));
 const local={...s,research:{path:'research.json',sha256:s.research.sha256},sourceIndex:{path:'sourceIndex.json',sha256:s.sourceIndex.sha256},
  bars:s.bars?{path:'bars.json',sha256:s.bars.sha256}:null,accountPreparation:s.accountPreparation?{path:'accountPreparation.json',sha256:s.accountPreparation.sha256}:null,
  sourceOriginals:s.sourceOriginals.map((v,i)=>({path:'source-'+i+'.json',sha256:v.sha256}))};
 put('request.json',Buffer.from(JSON.stringify(local,null,2)+'\n'));
 put('report.json',Buffer.from(JSON.stringify(report,null,2)+'\n'));
 const manifest={version:'RESEARCH_ASSEMBLY_MANIFEST_V1',runId,processedAt:at,files,...closed};
 writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return {runId,dir,processedAt:at,sourceReceipts:report.sourceDiagnostics.map(r=>r.state),validity:report.validity,capital:{state:report.capital.state,binding:report.capital.binding},
  automaticBars:report.assessment.automaticTechnicalObservation?.status??'NOT_SUPPLIED',recommendationGate:report.assessment.recommendationGate,...closed};
}
export function recoverResearchAssembly(root,directory,at){
 const dir=resolve(root,directory),m=readPrivate(root,join(dir,'manifest.json')).data;
 check(m.version==='RESEARCH_ASSEMBLY_MANIFEST_V1'&&time(m.processedAt)!==null&&time(at)>=time(m.processedAt),'MANIFEST');
 check(Array.isArray(m.files)&&m.files.length<=32&&new Set(m.files.map(f=>f.name)).size===m.files.length,'MANIFEST');
 for(const f of m.files){check(/^(research|sourceIndex|bars|accountPreparation|request|report|source-\d+)\.json$/.test(f.name),'MANIFEST_FILE');readRef(root,{path:join(dir,f.name),sha256:f.sha256});}
 const s=readPrivate(root,join(dir,'request.json')).data;validateSpec(s);
 const allowed=new Set(['research.json','sourceIndex.json','bars.json','accountPreparation.json',...s.sourceOriginals.map((v,i)=>'source-'+i+'.json')]);
 const expected=['request.json','report.json'];
 for(const r of [s.research,s.sourceIndex,s.bars,s.accountPreparation,...s.sourceOriginals].filter(Boolean)){
  check(allowed.has(r.path)&&m.files.some(f=>f.name===r.path&&f.sha256===r.sha256),'MANIFEST_BINDING');expected.push(r.path);r.path=join(dir,r.path);
 }
 check(expected.length===m.files.length&&new Set(expected).size===expected.length&&expected.every(n=>m.files.some(f=>f.name===n)),'MANIFEST_COMPLETENESS');
 const {args}=loadInputs(root,s),report=readPrivate(root,join(dir,'report.json')).data;
 check(JSON.stringify(report)===JSON.stringify(assembleResearchEvidence(args,m.processedAt)),'REPLAY');
 return {status:'COPIED_RESEARCH_ASSEMBLY_REPLAY_PASS',originalProcessedAt:m.processedAt,checkedAt:at,files:m.files.length,...closed};
}
export function researchAssemblyCli(args,{root=process.cwd(),clock=()=>new Date().toISOString()}={}){
 if(args.length===2&&args[0]==='--recover')return recoverResearchAssembly(root,args[1],clock());
 check(args.length===4&&args[0]==='--assemble'&&args[2]==='--run-id','ARGUMENTS');
 const s=readPrivate(root,args[1]).data;return saveResearchAssembly(root,s,args[3],clock());
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(researchAssemblyCli(process.argv.slice(2)),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
