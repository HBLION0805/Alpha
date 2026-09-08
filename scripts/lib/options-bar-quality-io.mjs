import { createHash } from 'node:crypto';
import { lstatSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { optionsEvidenceExportStorage as io } from '../options-evidence-export.mjs';
import { parseChainSurveyJson } from '../../src/engines/options-robinhood-data/RobinhoodChainSurvey.ts';
import { assessRobinhoodCapture } from '../../src/engines/options-robinhood-data/RobinhoodCaptureEngine.ts';
import { assessRobinhoodBarQuality } from '../../src/engines/options-robinhood-data/RobinhoodBarQuality.ts';
import { readinessClock } from '../../src/engines/options-readiness/OptionsReadinessEngine.ts';

const BASE='data/runtime/options-robinhood-data/captures', MAX=2*1024*1024;
const fail=code=>{throw Error('BAR_QUALITY_'+code);};
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');

export function readBarQualityCapture(root,path,at=new Date().toISOString()) {
  readinessClock(at);
  if(typeof path!=='string'||!new RegExp('^'+BASE+'/[a-z0-9][a-z0-9_-]{0,79}\\.json$').test(path))fail('CAPTURE_PATH');
  const r=parseChainSurveyJson(new TextDecoder('utf-8',{fatal:true}).decode(io.readBytes(root,path,MAX)));
  const {artifactSha256,...payload}=r;
  if(Object.keys(payload).sort().join()!=='inputText,originalAssessment,recordedAt,schemaVersion,sourceSha256'
    ||r.schemaVersion!=='1.0'||sha(JSON.stringify(payload))!==artifactSha256||typeof r.inputText!=='string'
    ||sha(r.inputText)!==r.sourceSha256)fail('CAPTURE_INTEGRITY');
  readinessClock(r.recordedAt);if(r.recordedAt>at)fail('FUTURE_RECORD');
  const original=assessRobinhoodCapture(r.inputText,r.recordedAt);
  if(JSON.stringify(original)!==JSON.stringify(r.originalAssessment)||path!==BASE+'/'+original.captureId+'.json')fail('CAPTURE_RECOMPUTE');
  return {path,artifactSha256,...assessRobinhoodBarQuality(r.inputText,r.recordedAt)};
}
export function readBarQualityDesk(root,at=new Date().toISOString()) {
  readinessClock(at);
  let current=root;
  for(const part of BASE.split('/')) {
    current=resolve(current,part);
    let st;try{st=lstatSync(current);}catch(e){if(e.code==='ENOENT')return {assessedAt:at,latest:null,captures:[],syntheticCaptures:0,executionAllowed:false};throw e;}
    if(!st.isDirectory()||st.isSymbolicLink())fail('UNSAFE_DIRECTORY');
  }
  const entries=readdirSync(current,{withFileTypes:true});
  if(entries.length>100)fail('CATALOG_LIMIT');
  if(entries.some(e=>!e.isFile()||e.isSymbolicLink()||!e.name.endsWith('.json')))fail('CATALOG_ENTRY');
  const records=entries.map(e=>readBarQualityCapture(root,BASE+'/'+e.name,at));
  const market=records.filter(r=>r.declaredOrigin==='OWNER_AUTHORIZED_MCP_CAPTURE'&&r.series.length)
    .sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)||a.path.localeCompare(b.path));
  return {assessedAt:at,latest:market[0]??null,
    captures:records.map(r=>({path:r.path,captureId:r.captureId,recordedAt:r.recordedAt,declaredOrigin:r.declaredOrigin,seriesCount:r.series.length})),
    syntheticCaptures:records.filter(r=>r.declaredOrigin==='SYNTHETIC').length,executionAllowed:false};
}
