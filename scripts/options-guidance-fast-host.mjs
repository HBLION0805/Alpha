import {createHash,randomUUID} from 'node:crypto';
import {closeSync,existsSync,fsyncSync,lstatSync,mkdirSync,openSync,readFileSync,realpathSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {analystNote,normalizeGuidanceCapture,verifyGuidanceRecord} from './lib/options-guidance-io.mjs';
import {runGuidanceCommand} from './options-daily-guidance.mjs';
import {createWorkbenchData} from './lib/options-workbench-data.mjs';
import {materializePredictionEvidence} from './lib/options-prediction-evidence.mjs';
import {materializeDecisionEvidence} from './lib/options-decision-evidence.mjs';
import {assessGuidanceDelivery} from '../src/engines/options-daily-guidance/OptionsGuidanceDelivery.ts';

const VERSION='OPTIONS_FAST_HOST_V1';
const INPUT_DIR='data/runtime/options-daily-guidance-inputs';
const LATEST=INPUT_DIR+'/fast-host-latest.json';
const LOCK=INPUT_DIR+'/fast-host.lock';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=code=>{throw Error('FAST_HOST_'+code);};
const clock=()=>new Date().toISOString();
const trim=(value,n=300)=>typeof value==='string'?value.slice(0,n):value;
const ms=(from,to)=>Number.isFinite(Date.parse(from))?Date.parse(to)-Date.parse(from):null;

export function readCompactLine(stream,maxBytes){
  return new Promise((resolve,reject)=>{
    const chunks=[];let size=0,settled=false;
    const cleanup=()=>{stream.off('data',onData);stream.off('end',onEnd);stream.off('error',onError);};
    const finish=(error,value)=>{if(settled)return;settled=true;cleanup();if(typeof stream.pause==='function')stream.pause();if(typeof stream.unref==='function')stream.unref();error?reject(error):resolve(value);};
    const onError=error=>finish(error);
    const onEnd=()=>{try{fail('FRAME');}catch(error){finish(error);}};
    const onData=chunk=>{
      try{
        const part=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
        size+=part.length;if(size>maxBytes+1)fail('SIZE');chunks.push(part);
        const bytes=Buffer.concat(chunks),newline=bytes.indexOf(10);
        if(newline<0)return;
        if(newline!==bytes.length-1||bytes.subarray(0,newline).includes(10)||bytes.subarray(0,newline).includes(13))fail('FRAME');
        const body=bytes.subarray(0,newline);if(!body.length)fail('FRAME');if(body.length>maxBytes)fail('SIZE');
        finish(null,body);
      }catch(error){finish(error);}
    };
    stream.on('data',onData);stream.on('end',onEnd);stream.on('error',onError);if(typeof stream.resume==='function')stream.resume();
  });
}
function parse(bytes){return JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));}
function atomic(root,rel,bytes){
  const path=resolve(root,rel),temp=path+'.'+randomUUID()+'.tmp';
  if(existsSync(path))fail('COLLISION');
  const fd=openSync(temp,'wx');
  try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}
  try{
    const stored=readFileSync(temp);
    if(stored.length!==bytes.length||sha(stored)!==sha(bytes))fail('HASH');
    if(existsSync(path))fail('COLLISION');
    renameSync(temp,path);
  }finally{if(existsSync(temp))unlinkSync(temp);}
  return rel;
}
function replaceAtomic(root,rel,bytes){
  const path=resolve(root,rel),temp=path+'.'+randomUUID()+'.tmp';
  const fd=openSync(temp,'wx');
  try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}
  try{if(sha(readFileSync(temp))!==sha(bytes))fail('HASH');renameSync(temp,path);}finally{if(existsSync(temp))unlinkSync(temp);}
}
async function locked(root,fn){
  const dir=resolve(root,INPUT_DIR);mkdirSync(dir,{recursive:true});
  if(lstatSync(dir).isSymbolicLink()||!lstatSync(dir).isDirectory()||realpathSync(dir)!==dir)fail('UNSAFE_DIRECTORY');
  const fd=openSync(resolve(root,LOCK),'wx');
  try{return await fn();}finally{closeSync(fd);unlinkSync(resolve(root,LOCK));}
}
function readLatest(root){
  if(!existsSync(resolve(root,LATEST)))fail('NO_INGEST');
  const v=parse(readFileSync(resolve(root,LATEST)));
  if(v.version!==VERSION||!['INGESTED','FINISH_STARTED','FINISHED'].includes(v.status)||typeof v.identity!=='string')fail('RECEIPT');
  return v;
}
function checkLatest(root,receipt){
  const raw=readFileSync(resolve(root,receipt.rawInputPath));
  if(sha(raw)!==receipt.rawSha256)fail('RAW_MISMATCH');
  const verified=verifyGuidanceRecord(root,receipt.capturePath);
  if(verified.inputFingerprint!==receipt.captureFingerprint)fail('CAPTURE_MISMATCH');
  return verified;
}
export function compactContext(brief){
  const headlines=(brief.headlines??[]).slice(0,8).map(h=>({title:trim(h.title,180),url:trim(h.url,400),publishedAt:h.publishedAt,receivedAt:h.receivedAt}));
  const events=(brief.events??[]).slice(0,8).map(e=>({title:trim(e.title,180),source:trim(e.source,100),scheduledAt:e.scheduledAt,startDate:e.startDate,endDate:e.endDate}));
  const sources=(brief.sourceHealth??[]).slice(0,8).map(s=>({id:s.id,status:s.status,receivedAt:s.receivedAt}));
  const eventFacts=(brief.eventFacts?.events??[]).slice(0,12).map(e=>({eventKey:trim(e.eventKey,180),title:trim(e.title,180),source:trim(e.source,100),scheduledAt:e.scheduledAt,issues:e.issues,
    metrics:(e.metrics??[]).slice(0,6).map(m=>({metric:trim(m.metric,100),period:trim(m.period,100),unit:trim(m.unit,100),releaseVersion:trim(m.releaseVersion,100),
      consensus:m.consensus?{value:m.consensus.value,source:trim(m.consensus.source,120),reference:trim(m.consensus.reference,160),receivedAt:m.consensus.receivedAt,selectedConsensusId:m.consensus.selectedConsensusId,snapshotPath:trim(m.consensus.snapshotPath,200)}:null,
      actual:m.actual?{value:m.actual.value,source:trim(m.actual.source,300),sourceAt:m.actual.sourceAt,receivedAt:m.actual.receivedAt,comparisonPath:trim(m.actual.comparisonPath,200),claimId:m.actual.claimId}:null,
      numericDifference:m.numericDifference,qualitativeSurprise:m.qualitativeSurprise,issues:m.issues}))}));
  while(eventFacts.length&&Buffer.byteLength(JSON.stringify(eventFacts))>12000)eventFacts.pop();
  return {headlines,events,eventFacts,sources,treasury:brief.context?.treasury??null,btc:brief.context?.btc??null,
    focusedNews:(brief.focusedNews?.items??[]).slice(0,4).map(x=>({title:trim(x.title??x.headline,180),url:trim(x.url??x.link,400),publishedAt:x.publishedAt})),
    previousAnalysis:brief.previousAnalysis?{assessedAt:brief.previousAnalysis.assessedAt,assets:brief.previousAnalysis.assets?.map(a=>({symbol:a.symbol,bias:a.bias,summary:trim(a.summary,300)}))}:null};
}
function summarize(brief){return brief.assets.map(a=>({symbol:a.symbol,equity:{price:a.equity?.price??null,sourceAt:a.equity?.sourceAt??null},trend:{direction:a.trend?.direction,closes:a.trend?.closes?.slice(-5)},disposition:a.disposition,blockers:a.blockers,candidates:{count:a.sampled,priced:a.priced,selected:a.candidates?.slice(0,3).map(c=>({id:c.contract?.id,expiry:c.contract?.expiry,type:c.contract?.type,strike:c.contract?.strike,disposition:c.disposition,blockers:c.blockers}))??[]}}));}
function coverage(raw,normal){
  const quoteRequests=raw.receipts.filter(r=>r.tool==='get_option_quotes');
  const instruments=raw.receipts.filter(r=>r.tool==='get_option_instruments');
  return {calls:raw.calls,receipts:raw.receipts.length,selected:raw.selectedIds.length,returned:normal.quotes.length,failures:raw.failures.length,
    pagination:{instrumentPages:instruments.length,quoteBatches:quoteRequests.length},bySymbol:['GLD','IBIT'].map(symbol=>({symbol,selected:normal.quotes.filter(q=>q.symbol===symbol).length}))};
}
export async function ingestFastHost(root,bytes){
  if(bytes.length>8*1024*1024)fail('SIZE');
  const raw=parse(bytes),normal=normalizeGuidanceCapture(raw);
  if(normal.origin!=='HOST_MARKET_TOOL_RESPONSES'||raw.accountAccessed!==false||raw.executionAllowed!==false)fail('AUTHORITY');
  if(!normal.complete||raw.failures.length||raw.calls!==raw.receipts.length||raw.calls>24||raw.selectedIds.length!==36||normal.quotes.length!==36||normal.equities.length!==2||!['GLD','IBIT'].every(s=>normal.equities.some(e=>e.symbol===s)&&normal.quotes.filter(q=>q.symbol===s).length===18))fail('COVERAGE');
  const pages=raw.receipts.filter(r=>r.tool==='get_option_instruments');
  for(const chain of raw.receipts.filter(r=>r.tool==='get_option_chains').flatMap(r=>r.response.data.chains)){
    const last=pages.filter(r=>r.request.chain_id===chain.id).at(-1);
    if(!last||last.response.data.next!=null)fail('PAGINATION');
  }
  if(normal.capturedAt>clock())fail('FUTURE_CAPTURE');
  return locked(root,async()=>{
    const receivedAt=clock(),safeAt=normal.capturedAt.replace(/[:.]/g,'-');
    const rawInputPath=INPUT_DIR+'/fast-host-capture-'+safeAt+'-'+sha(bytes).slice(0,16)+'.json';
    atomic(root,rawInputPath,bytes);
    const record=await runGuidanceCommand(['--record',rawInputPath],{workspaceRoot:root});
    const recordAt=clock(),verified=await runGuidanceCommand(['--verify',record.path],{workspaceRoot:root});
    if(verified.status!=='VERIFIED')fail('VERIFY');
    const paper=await runGuidanceCommand(['--observe-paper'],{workspaceRoot:root});
    const brief=await runGuidanceCommand(['--host-brief'],{workspaceRoot:root});
    const briefAt=clock();
    const health=brief.deliveryHealth;
    if(brief.marketCapturedAt!==normal.capturedAt||health?.latestCapture?.path!==record.path)fail('CAPTURE_MISMATCH');
    const identity=sha(Buffer.from(JSON.stringify([rawInputPath,sha(bytes),record.path,verified.inputFingerprint])));
    const receipt={version:VERSION,status:'INGESTED',identity,rawInputPath,rawSha256:sha(bytes),capturePath:record.path,captureFingerprint:verified.inputFingerprint,capturedAt:normal.capturedAt,startedAt:normal.startedAt,receivedAt,recordAt,briefAt};
    replaceAtomic(root,LATEST,Buffer.from(JSON.stringify(receipt)+'\n'));
    const result={version:VERSION,status:'INGESTED',identity,rawInputPath,capturePath:record.path,clocks:{startedAt:normal.startedAt,capturedAt:normal.capturedAt,receivedAt,recordAt,briefAt},
      coverage:coverage(raw,normal),assets:summarize(brief),freshnessAtBrief:health?.quoteClocks??null,context:compactContext(brief),paperObservation:{results:paper?.results?.length??0,recordError:record.paperObservations?.error??null},executionAllowed:false};
    if(Buffer.byteLength(JSON.stringify(result))>32768)fail('OUTPUT_SIZE');
    return result;
  });
}
export async function finishFastHost(root,identity,bytes){
  if(!/^[a-f0-9]{64}$/.test(identity??''))fail('IDENTITY');
  if(bytes.length>128*1024)fail('SIZE');
  const note=analystNote(parse(bytes));
  return locked(root,async()=>{
    const receipt=readLatest(root);
    if(receipt.status!=='INGESTED'||receipt.identity!==identity)fail('IDENTITY_MISMATCH');
    checkLatest(root,receipt);
    const before=await runGuidanceCommand(['--report'],{workspaceRoot:root});
    if(before.sourcePaths?.[0]!==receipt.capturePath||before.input.captureAt!==receipt.capturedAt)fail('NEWER_CAPTURE');
    if(note?.assessedAt<receipt.capturedAt)fail('ANALYSIS_PRECEDES_CAPTURE');
    // The existing --analysis path performs the authoritative exact-field note validation.
    const analysisInputPath=INPUT_DIR+'/fast-host-analysis-'+identity.slice(0,24)+'.json';
    atomic(root,analysisInputPath,bytes);
    const pending={...receipt,status:'FINISH_STARTED'};
    replaceAtomic(root,LATEST,Buffer.from(JSON.stringify(pending)+'\n'));
    const analysis=await runGuidanceCommand(['--analysis',analysisInputPath],{workspaceRoot:root});
    const analysisCheck=await runGuidanceCommand(['--verify',analysis.path],{workspaceRoot:root});
    if(analysisCheck.status!=='VERIFIED')fail('ANALYSIS_VERIFY');
    const latest=await runGuidanceCommand(['--report'],{workspaceRoot:root});
    if(latest.sourcePaths?.[0]!==receipt.capturePath)fail('NEWER_CAPTURE');
    const published=await runGuidanceCommand(['--publish'],{workspaceRoot:root,expectedCapture:{path:receipt.capturePath,fingerprint:receipt.captureFingerprint}});
    const publishAt=clock();
    const report=await runGuidanceCommand(['--report'],{workspaceRoot:root});
    if(report.history?.[0]?.path!==published.path||report.sourcePaths?.[0]!==receipt.capturePath||report.interpretation?.path!==analysis.path)fail('PUBLISH_BINDING');
    const evidenceState=await createWorkbenchData({workspaceRoot:root}).state();
    const predictionEvidence=materializePredictionEvidence(root,evidenceState);
    if(predictionEvidence.provenance.report.path!==published.path||predictionEvidence.provenance.capture.path!==receipt.capturePath||
      predictionEvidence.provenance.analysis.path!==analysis.path)fail('PREDICTION_EVIDENCE_BINDING');
    const quoteFreshnessAtPublish=assessGuidanceDelivery(report.input,[],[],null).quoteClocks;
    const cards=await runGuidanceCommand(['--decision-cards'],{workspaceRoot:root});
    const health=await runGuidanceCommand(['--delivery-health'],{workspaceRoot:root});
    const healthAt=clock(),data=health.data;
    const identityMatch=data?.latestCapture?.path===receipt.capturePath;
    const publicationCurrent=data?.publication?.usesCurrentMarketInputs===true;
    const freshCoverage=data?.quoteClocks?.length===2&&data.quoteClocks.every(q=>q.requested===18&&q.fresh===18&&q.stale===0&&q.unknown===0&&q.future===0&&q.underlyingFreshness==='FRESH');
    const freshAtPublish=quoteFreshnessAtPublish.length===2&&quoteFreshnessAtPublish.every(q=>q.requested===18&&q.fresh===18&&q.stale===0&&q.unknown===0&&q.future===0&&q.underlyingFreshness==='FRESH');
    const operationalPass=identityMatch&&publicationCurrent&&freshAtPublish&&freshCoverage&&cards.state==='AVAILABLE'&&health.state==='AVAILABLE'&&ms(receipt.capturedAt,publishAt)<120000&&ms(receipt.capturedAt,healthAt)<120000;
    const failedOperationalChecks=[...(!identityMatch?['CAPTURE_IDENTITY']:[]),...(!publicationCurrent?['PUBLICATION_MARKET_INPUTS']:[]),
      ...(!freshAtPublish?['PUBLISH_QUOTE_FRESHNESS']:[]),...(!freshCoverage?['HEALTH_QUOTE_FRESHNESS']:[]),
      ...(cards.state!=='AVAILABLE'?['DECISION_CARDS']:[]),...(health.state!=='AVAILABLE'?['DELIVERY_HEALTH']:[]),
      ...(ms(receipt.capturedAt,publishAt)>=120000?['PUBLISH_LATENCY']:[]),...(ms(receipt.capturedAt,healthAt)>=120000?['HEALTH_LATENCY']:[])];
    const decisionEvidence=operationalPass?materializeDecisionEvidence(root,predictionEvidence):null;
    if(decisionEvidence&&(decisionEvidence.provenance.predictionEvidence.identity!==predictionEvidence.identity||
      decisionEvidence.provenance.report.path!==published.path||decisionEvidence.provenance.capture.path!==receipt.capturePath||
      decisionEvidence.provenance.analysis.path!==analysis.path))fail('DECISION_EVIDENCE_BINDING');
    const result={version:VERSION,status:operationalPass?'PASS':'FAIL',identity,analysisPath:analysis.path,reportPath:published.path,dispositions:published.dispositions,
      predictionEvidence:{status:predictionEvidence.status,identity:predictionEvidence.identity,path:predictionEvidence.path,candidateCount:predictionEvidence.candidates.length,executionAllowed:false},
      decisionEvidence:decisionEvidence?{status:decisionEvidence.status,identity:decisionEvidence.identity,path:decisionEvidence.path,candidateCount:decisionEvidence.candidates.length,executionAllowed:false}:{status:'SKIPPED',reason:'OPERATIONAL_CHECK_FAILED',failedChecks:failedOperationalChecks,executionAllowed:false},
      quoteFreshnessAtPublish,quoteFreshnessAtHealth:data?.quoteClocks??null,latencyMs:{captureToRecord:ms(receipt.capturedAt,receipt.recordAt),captureToPublish:ms(receipt.capturedAt,publishAt),captureToHealth:ms(receipt.capturedAt,healthAt)},
      identityMatch,publicationCurrent,freshAtPublish,freshCoverage,cardsState:cards.state,healthState:health.state,executionAllowed:false};
    if(Buffer.byteLength(JSON.stringify(result))>16384)fail('OUTPUT_SIZE');
    replaceAtomic(root,LATEST,Buffer.from(JSON.stringify({...pending,status:'FINISHED',analysisPath:analysis.path,reportPath:published.path})+'\n'));
    return result;
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const args=process.argv.slice(2),mode=args.shift(),workspaceIndex=args.indexOf('--workspace');
    if(!['--ingest','--finish'].includes(mode)||workspaceIndex<0||!args[workspaceIndex+1])fail('ARGUMENTS');
    const root=realpathSync(args[workspaceIndex+1]);args.splice(workspaceIndex,2);
    const identityIndex=args.indexOf('--identity'),identity=identityIndex>=0?args[identityIndex+1]:null;
    if(identityIndex>=0)args.splice(identityIndex,2);
    if(args.length||mode==='--finish'&&!identity||mode==='--ingest'&&identity)fail('ARGUMENTS');
    const bytes=await readCompactLine(process.stdin,mode==='--ingest'?8*1024*1024:128*1024);
    const result=mode==='--ingest'?await ingestFastHost(root,bytes):await finishFastHost(root,identity,bytes);
    console.log(JSON.stringify(result));
  }catch(error){console.error(JSON.stringify({version:VERSION,status:'FAIL',error:String(error?.message??error).slice(0,300),executionAllowed:false}));process.exitCode=2;}
}
