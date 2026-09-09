import {existsSync,lstatSync,readdirSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {parseChainSurveyJson} from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import {treasuryClock} from '../../src/engines/options-treasury/TreasuryRealYieldEngine.ts';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {MACRO_IDS,MACRO_ERRORS,MACRO_MAX_BYTES,macroUrl,parseMacroSource,macroDecimal} from '../../src/engines/options-drivers/OptionsMacroContext.ts';

const BASE='data/runtime/options-macro-context',COMPARE='data/runtime/options-macro-comparisons';
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=code=>{throw Error('MACRO_'+code);};
const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==[...keys].sort().join())fail('FIELDS');};
const json=bytes=>parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes));

export async function retrieveMacro(id,{clock=()=>new Date().toISOString(),fetchImplementation=globalThis.fetch,deadlineMs=12000}={}) {
  if(!MACRO_IDS.includes(id)||!Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>12000)fail('REQUEST');
  const requestedAt=clock(),url=macroUrl(id,requestedAt),controller=new AbortController();let timer,reader;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('DEADLINE'));},deadlineMs);});
  const bound=p=>Promise.race([p,deadline]);
  let sourceText=null,errorCode=null;
  try {
    const r=await bound(fetchImplementation(url,{redirect:'manual',credentials:'omit',signal:controller.signal,headers:{Accept:id==='nominal'?'application/xml, text/xml':'text/html','User-Agent':'Alpha-Options-Research/0.3 (public macro context)'}}));
    if(r.status!==200||r.redirected)throw Error('HTTP_STATUS');
    const type=r.headers.get('content-type')??'';
    if(!(id==='nominal'?/^(?:application|text)\/xml(?:;|$)/i:/^text\/html(?:;|$)/i).test(type))throw Error('CONTENT_TYPE');
    const length=r.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MACRO_MAX_BYTES))throw Error('BODY_LIMIT');
    if(!r.body)throw Error('BODY_MISSING');reader=r.body.getReader();const parts=[];let total=0;
    while(true){const {done,value}=await bound(reader.read());if(done)break;total+=value.byteLength;if(total>MACRO_MAX_BYTES)throw Error('BODY_LIMIT');parts.push(value);}
    if(!total)throw Error('BODY_MISSING');
    try{sourceText=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts));}catch{throw Error('UTF8');}
  }catch(e){errorCode=MACRO_ERRORS.includes(e?.message)?e.message:['EACCES','EPERM'].includes(e?.code??e?.cause?.code)?'NETWORK_ACCESS_DENIED':'NETWORK_FAILED';sourceText=null;}
  finally{clearTimeout(timer);controller.abort();if(reader)void reader.cancel().catch(()=>{});}
  const receivedAt=clock();treasuryClock(receivedAt);if(receivedAt<requestedAt)fail('CLOCK');
  return {id,url,requestedAt,receivedAt,sourceText,errorCode};
}
function assessInput(input) {
  exact(input,['id','url','requestedAt','receivedAt','sourceText','errorCode']);
  if(!MACRO_IDS.includes(input.id)||input.url!==macroUrl(input.id,input.requestedAt))fail('SOURCE');treasuryClock(input.receivedAt);if(input.receivedAt<input.requestedAt)fail('CLOCK');
  if(input.errorCode!==null&&(!MACRO_ERRORS.includes(input.errorCode)||input.sourceText!==null))fail('ERROR_SHAPE');
  if(input.errorCode===null&&typeof input.sourceText!=='string')fail('SOURCE_TEXT');
  if(input.sourceText!==null&&Buffer.byteLength(input.sourceText)>MACRO_MAX_BYTES)fail('BODY_LIMIT');
  let data=null,errorCode=input.errorCode;
  if(!errorCode){try{data=parseMacroSource(input.id,input.sourceText,input.receivedAt);}catch{errorCode='SOURCE_SCHEMA';}}
  return {id:input.id,url:input.url,requestedAt:input.requestedAt,receivedAt:input.receivedAt,
    sourceSha256:input.sourceText===null?null:hash(input.sourceText),status:errorCode?'FAILED':'OK',errorCode,data};
}
function buildBatch(inputs,recordedAt) {
  treasuryClock(recordedAt);if(!Array.isArray(inputs)||inputs.length!==3||inputs.some((r,i)=>r.id!==MACRO_IDS[i]))fail('BATCH');
  const sources=inputs.map(assessInput);if(sources.some(s=>s.receivedAt>recordedAt))fail('CLOCK');
  return {version:'OPTIONS_MACRO_BATCH_V1',recordedAt,inputs,sources,executionAllowed:false};
}
export function saveMacroBatch(root,inputs,recordedAt=new Date().toISOString()) {
  if(recordedAt>new Date().toISOString())fail('FUTURE_RECORD');const batch=buildBatch(inputs,recordedAt),dir=BASE+'/'+recordedAt.slice(0,10);
  io.directory(root,dir);const path=dir+'/'+recordedAt.replace(/[:.]/g,'-')+'-'+randomUUID()+'.json';
  io.writeExclusive(root,path,Buffer.from(JSON.stringify({batch,fingerprint:paperFingerprint(batch)})+'\n'));verifyMacroBatch(root,path);
  return {path,status:batch.sources.some(s=>s.status==='FAILED')?'PARTIAL':'SAVED',sources:batch.sources.map(({data,...s})=>s),executionAllowed:false};
}
export function verifyMacroBatch(root,path) {
  if(typeof path!=='string'||!/^data\/runtime\/options-macro-context\/\d{4}-\d\d-\d\d\/[a-z0-9TZ-]+\.json$/.test(path))fail('PATH');
  const r=json(io.readBytes(root,path,4*1024*1024));exact(r,['batch','fingerprint']);
  const b=buildBatch(r.batch.inputs,r.batch.recordedAt);
  if(paperFingerprint(b)!==r.fingerprint||paperFingerprint(r.batch)!==r.fingerprint||path.split('/')[3]!==b.recordedAt.slice(0,10))fail('INTEGRITY');return r;
}
export async function refreshMacroContext({workspaceRoot=process.cwd(),now=()=>new Date().toISOString(),retrieve=retrieveMacro}={}) {
  const root=realpathSync(workspaceRoot);const inputs=await Promise.all(MACRO_IDS.map(id=>retrieve(id,{clock:now})));
  return saveMacroBatch(root,inputs,now());
}
function children(root,path) {
  let current=root;for(const part of path.split('/')){current=resolve(current,part);if(!existsSync(current))return [];const stat=lstatSync(current);if(!stat.isDirectory()||stat.isSymbolicLink())fail('DIRECTORY');}
  const entries=readdirSync(current,{withFileTypes:true});if(entries.length>4000)fail('CATALOG_LIMIT');return entries;
}
function batchPaths(root,at) {
  const days=children(root,BASE);if(days.some(d=>!d.isDirectory()||d.isSymbolicLink()||!/^\d{4}-\d\d-\d\d$/.test(d.name)))fail('CATALOG');
  return days.filter(d=>d.name<=at.slice(0,10)).sort((a,b)=>b.name.localeCompare(a.name)).slice(0,45).flatMap(d=>{
    const dir=BASE+'/'+d.name,files=children(root,dir);if(files.length>100||files.some(f=>!f.isFile()||f.isSymbolicLink()||!f.name.endsWith('.json')))fail('CATALOG');return files.map(f=>dir+'/'+f.name);
  }).sort();
}
export function macroContextView(root,at,treasury=null) {
  treasuryClock(at);const records=batchPaths(root,at).map(path=>({path,...verifyMacroBatch(root,path).batch})).filter(b=>b.recordedAt<=at),latest=new Map(),known=new Map();
  for(const b of records)for(const s of b.sources){const v={...s,path:b.path,recordedAt:b.recordedAt};latest.set(s.id,v);if(s.status==='OK')known.set(s.id,v);}
  const sources=MACRO_IDS.map(id=>{const l=latest.get(id),k=known.get(id);return {id,status:l?.status??'NOT_REFRESHED',latest:l??null,lastKnown:k??null,refreshOverdue:!l||Date.parse(at)-Date.parse(l.receivedAt)>30*3600000};});
  const n=latest.get('nominal'),nr=n?.status==='OK'?n.data.rows.at(-1):null,tr=treasury?.latestRetrieval,real=treasury?.currentRow;
  const comparable=nr&&tr?.status==='OK'&&tr.receivedAt<=at&&real?.sourceDate===nr.sourceDate&&Number.isSafeInteger(real.ratesBps[10])&&Number.isSafeInteger(nr.ratesBps[10]);
  const forecasts=records.flatMap(b=>b.sources.filter(s=>s.id==='nowcast'&&s.status==='OK').map(s=>({path:b.path,recordedAt:b.recordedAt,receivedAt:s.receivedAt,cells:s.data.rows,sourceSha256:s.sourceSha256}))).reverse().slice(0,45);
  return {version:'OPTIONS_MACRO_CONTEXT_V1',assessedAt:at,sources,recordsRead:records.length,historyWindowDays:45,forecasts,
    parCurveComparison:{status:comparable?'SAME_DATE_DESCRIPTIVE_SPREAD':'MISSING_OR_MISMATCHED_DATES',sourceDate:comparable?nr.sourceDate:null,nominalMinusRealBps:comparable?nr.ratesBps[10]-real.ratesBps[10]:null,meaning:'Par-curve spread only; not fitted breakeven, pure inflation expectations or intraday repricing.'},
    comparisons:readMacroComparisons(root,at),consensusCoverage:'NOT_CONNECTED',ppiNowcast:'NOT_PROVIDED',intradayRatesAndDxy:'NOT_CONNECTED',executionAllowed:false};
}

export function previewMacroComparison(root,request,at=new Date().toISOString()) {
  treasuryClock(at);exact(request,['requestId','forecastPath','period','metric','actualValue','seasonalAdjustment','releaseAt','sourceUrl']);
  if(typeof request.requestId!=='string'||!/^[a-z0-9][a-z0-9-]{2,79}$/.test(request.requestId))fail('REQUEST_ID');
  const batch=verifyMacroBatch(root,request.forecastPath).batch;
  treasuryClock(request.releaseAt);if(request.releaseAt>at||batch.recordedAt>=request.releaseAt)fail('BENCHMARK_NOT_PROSPECTIVE_OR_RELEASE_FUTURE');
  if(typeof request.metric!=='string'||!/^(?:CPI|CORE_CPI|PCE|CORE_PCE)_(?:MOM|YOY)$/.test(request.metric)||typeof request.period!=='string'||!/^\d{4}-\d\d$/.test(request.period))fail('METRIC');
  const source=batch.sources.find(s=>s.id==='nowcast');if(source.status!=='OK')fail('BENCHMARK_UNAVAILABLE');
  const cell=source.data.rows.find(r=>r.period===request.period&&r.metric===request.metric);if(!cell||cell.valueBps===null)fail('BENCHMARK_CELL_MISSING');
  if(request.seasonalAdjustment!==cell.seasonalAdjustment)fail('ADJUSTMENT_MISMATCH');
  if(typeof request.actualValue!=='string'||!/^-?\d{1,3}(?:\.\d{1,2})?$/.test(request.actualValue))fail('ACTUAL_VALUE');const actual=macroDecimal(request.actualValue,2);
  let url;try{url=new URL(request.sourceUrl);}catch{fail('ACTUAL_SOURCE');}
  const hosts=request.metric.includes('CPI')?['www.bls.gov','bls.gov']:['www.bea.gov','bea.gov'];
  if(typeof request.sourceUrl!=='string'||request.sourceUrl.length>2000||url.protocol!=='https:'||url.username||url.password||url.port||!hosts.includes(url.hostname)||/[\\\s]/.test(request.sourceUrl))fail('ACTUAL_SOURCE');
  return {version:'OPTIONS_MACRO_COMPARISON_V1',request,assessedAt:at,benchmarkRecordedAt:batch.recordedAt,benchmarkReceivedAt:source.receivedAt,benchmarkSourceSha256:source.sourceSha256,modelValueBps:cell.valueBps,reportedActualValueBps:actual,
    actualMinusModelHundredthsPp:actual-cell.valueBps,comparisonKind:'MODEL_FORECAST_ERROR_NOT_CONSENSUS_SURPRISE',actualEvidence:'OWNER_REPORTED_UNVERIFIED',releaseTimeEvidence:'OWNER_DECLARED',winProbability:null,executionAllowed:false};
}
export function saveMacroComparison(root,request,at=new Date().toISOString()) {
  if(at>new Date().toISOString())fail('FUTURE_RECORD');const path=COMPARE+'/'+request?.requestId+'.json';
  // Validation checks the identity before the path is used for filesystem I/O.
  const result=previewMacroComparison(root,request,at);
  if(existsSync(resolve(root,path))){const old=verifyMacroComparison(root,path);if(paperFingerprint(old.request)!==paperFingerprint(request))fail('REQUEST_CONFLICT');return {path,alreadyRecorded:true,result:old};}
  io.directory(root,COMPARE);
  try{io.writeExclusive(root,path,Buffer.from(JSON.stringify({result,fingerprint:paperFingerprint(result)})+'\n'));}
  catch(e){if(e.code!=='EEXIST')throw e;const old=verifyMacroComparison(root,path);if(paperFingerprint(old.request)!==paperFingerprint(request))fail('REQUEST_CONFLICT');return {path,alreadyRecorded:true,result:old};}
  return {path,alreadyRecorded:false,result:verifyMacroComparison(root,path)};
}
export function verifyMacroComparison(root,path) {
  if(typeof path!=='string'||!/^data\/runtime\/options-macro-comparisons\/[a-z0-9][a-z0-9-]{2,79}\.json$/.test(path))fail('COMPARISON_PATH');
  const r=json(io.readBytes(root,path,16384));exact(r,['result','fingerprint']);const result=previewMacroComparison(root,r.result.request,r.result.assessedAt);
  if(path!==COMPARE+'/'+result.request.requestId+'.json'||paperFingerprint(result)!==r.fingerprint||paperFingerprint(r.result)!==r.fingerprint)fail('COMPARISON_INTEGRITY');return result;
}
function readMacroComparisons(root,at) {
  const files=children(root,COMPARE);if(files.length>500||files.some(f=>!f.isFile()||f.isSymbolicLink()||!f.name.endsWith('.json')))fail('COMPARISON_CATALOG');
  return files.map(f=>verifyMacroComparison(root,COMPARE+'/'+f.name)).filter(r=>r.assessedAt<=at).sort((a,b)=>b.assessedAt.localeCompare(a.assessedAt));
}
