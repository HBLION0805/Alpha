import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {optionsEvidenceExportStorage as io} from '../options-evidence-export.mjs';
import {paperFingerprint} from '../../src/engines/options-paper/OptionsPaperTradingEngine.ts';
import {verifyGuidanceRecord} from './options-guidance-io.mjs';
import {projectEventFacts} from './options-event-facts.mjs';

const VERSION='OPTIONS_PREDICTION_EVIDENCE_PROJECTION_V1';
const BASE='data/runtime/options-prediction-evidence';
const fail=code=>{throw Error('PREDICTION_EVIDENCE_'+code);};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const parse=bytes=>JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));
const record=(root,path,kind)=>{
  if(typeof path!=='string'||!new RegExp(`^data/runtime/options-daily-guidance/${kind}/\\d{4}-\\d{2}-\\d{2}/[A-Za-z0-9-]+\\.json$`).test(path))fail('UNSAFE_REFERENCE');
  const verified=verifyGuidanceRecord(root,path);
  if(verified.status!=='VERIFIED')fail('REFERENCE_INVALID');
  const value=parse(io.readBytes(root,path,8*1024*1024));
  if(value.kind!==kind||value.inputFingerprint!==verified.inputFingerprint)fail('REFERENCE_CHANGED');
  return value;
};
function inputs(root,state){
  const guidance=state.guidance?.data;
  if(state.guidance?.state!=='AVAILABLE'||!guidance?.history?.length)fail('NO_PUBLISHED_GUIDANCE');
  const reportPath=guidance.history[0].path,report=record(root,reportPath,'reports');
  if(guidance.history[0].inputFingerprint!==report.inputFingerprint)fail('REPORT_MISMATCH');
  const capturePath=guidance.sourcePaths?.[0],analysisPath=guidance.interpretation?.path;
  if(!capturePath||!analysisPath)fail('MISSING_CURRENT_EVIDENCE');
  const capture=record(root,capturePath,'captures'),analysis=record(root,analysisPath,'analysis');
  if(report.input.captureAt!==capture.report.capturedAt||report.input.captureOrigin!==capture.report.origin||
    report.input.at<capture.recordedAt||report.input.at<analysis.recordedAt||
    paperFingerprint(report.input.equities)!==paperFingerprint(capture.report.equities)||
    capture.report.quotes.some(q=>paperFingerprint(report.input.quotes.find(x=>x.id===q.id))!==paperFingerprint(q))||
    report.input.analyst?.path!==analysisPath||paperFingerprint(report.input.analyst?.assets)!==paperFingerprint(analysis.input.assets)||
    report.input.analyst?.assessedAt!==analysis.input.assessedAt||analysis.input.assessedAt<capture.report.capturedAt||
    guidance.input.captureAt!==capture.report.capturedAt||guidance.interpretation.path!==analysisPath)fail('STALE_OR_MISMATCHED_EVIDENCE');
  if(analysis.input.assets.length!==2||new Set(analysis.input.assets.map(a=>a.symbol)).size!==2||
    !['GLD','IBIT'].every(s=>analysis.input.assets.some(a=>a.symbol===s)))fail('ANALYSIS_SCOPE');
  return {reportPath,report,capturePath,capture,analysisPath,analysis};
}
export function predictionEvidenceCandidate(asset){
  const directionCandidate=asset.bias==='BULLISH'?'UP':asset.bias==='BEARISH'?'DOWN':null;
  return {symbol:asset.symbol,hostBias:asset.bias,biasAuthority:'ATTRIBUTED_HOST_ANALYSIS_NOT_A_CALIBRATED_SIGNAL',directionCandidate,
    summary:asset.summary,supporting:asset.supporting,opposing:asset.opposing,invalidation:asset.invalidation,eventPlan:asset.eventPlan,sources:asset.sources,
    confidence:null,forecastHorizon:null,canonicalPredictionEligible:false,
    blockingReasons:['NO_FORECAST_HORIZON','NO_FROZEN_PLAN','OWNER_AUTHORITY_REQUIRED',...(directionCandidate?[]:['NO_DIRECTION_CANDIDATE'])],executionAllowed:false};
}
function projection(root,state){
  const {reportPath,report,capturePath,capture,analysisPath,analysis}=inputs(root,state);
  if(state.sourceComparisons?.state!=='AVAILABLE'||state.marketExpectations?.state!=='AVAILABLE'||
    state.sourceComparisons.data?.errors?.length||state.marketExpectations.data?.errors?.length)fail('EVENT_FACTS_SOURCE_UNAVAILABLE');
  const eventFacts=projectEventFacts({events:state.sourceComparisons.data.events,expectations:state.marketExpectations.data.records,
    comparisons:state.sourceComparisons.data.records,at:report.input.at});
  if(eventFacts.version!=='OPTIONS_EVENT_FACTS_PROJECTION_V1')fail('EVENT_FACTS_VERSION');
  const payload={version:VERSION,kind:'PREDICTION_EVIDENCE_CANDIDATE',authority:'READ_ONLY_PROJECTION_NOT_CANONICAL_PREDICTION_LOG',
    provenance:{report:{path:reportPath,inputFingerprint:report.inputFingerprint,reportFingerprint:report.reportFingerprint,issuedAt:report.recordedAt},
      capture:{path:capturePath,inputFingerprint:capture.inputFingerprint,reportFingerprint:capture.reportFingerprint,capturedAt:capture.report.capturedAt},
      analysis:{path:analysisPath,inputFingerprint:analysis.inputFingerprint,assessedAt:analysis.input.assessedAt}},
    eventFacts,candidates:['GLD','IBIT'].map(symbol=>predictionEvidenceCandidate(analysis.input.assets.find(a=>a.symbol===symbol))),
    canonicalPredictionEligible:false,executionAllowed:false,sourceReads:0,marketCalls:0,externalModelCalls:0,accountCalls:0,positionCalls:0,orderCalls:0};
  const identity=hash(payload),path=artifactPath(reportPath,report);
  return {...payload,identity,path};
}
const artifactPath=(reportPath,report)=>`${BASE}/${hash([reportPath,report.inputFingerprint,report.reportFingerprint])}.json`;
function verifyStored(root,path,expected){
  const bytes=io.readBytes(root,path,1024*1024),value=parse(bytes);
  if(!bytes.equals(Buffer.from(JSON.stringify(value,null,2)+'\n'))||value.version!==VERSION||value.path!==path||value.identity!==hash(Object.fromEntries(Object.entries(value).filter(([k])=>!['identity','path'].includes(k))))||
    expected&&JSON.stringify(value)!==JSON.stringify(expected))fail('ARTIFACT_INTEGRITY');
  return value;
}
export function materializePredictionEvidence(root,state){
  const binding=inputs(root,state),path=artifactPath(binding.reportPath,binding.report);
  io.directory(root,BASE);
  if(existsSync(resolve(root,path)))return {...verifyBinding(verifyStored(root,path),binding),status:'ALREADY_MATERIALIZED'};
  const value=projection(root,state);
  io.writeExclusive(root,value.path,Buffer.from(JSON.stringify(value,null,2)+'\n'));
  return {...verifyStored(root,value.path,value),status:'MATERIALIZED'};
}
export function predictionEvidenceView(root,state){
  const binding=inputs(root,state),path=artifactPath(binding.reportPath,binding.report);
  if(!existsSync(resolve(root,path)))return {version:VERSION,status:'NOT_MATERIALIZED',reportPath:binding.reportPath,executionAllowed:false};
  return {...verifyBinding(verifyStored(root,path),binding),status:'MATERIALIZED'};
}
function verifyBinding(value,binding){
  if(value.provenance?.report?.path!==binding.reportPath||value.provenance.report.inputFingerprint!==binding.report.inputFingerprint||
    value.provenance.report.reportFingerprint!==binding.report.reportFingerprint||value.provenance.capture?.path!==binding.capturePath||
    value.provenance.capture.inputFingerprint!==binding.capture.inputFingerprint||value.provenance.analysis?.path!==binding.analysisPath||
    value.provenance.analysis.inputFingerprint!==binding.analysis.inputFingerprint)fail('BINDING_CHANGED');
  return value;
}
