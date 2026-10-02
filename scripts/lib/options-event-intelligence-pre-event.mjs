import {createHash, randomUUID} from 'node:crypto';
import {existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const VERSION='OPTIONS_PRE_EVENT_STATE_V1';
const BASE='data/runtime/options-event-intelligence/pre-event-state';
const fail=code=>{throw Error('EVENT_INTELLIGENCE_PRE_EVENT_'+code);};
const clock=value=>{const n=Date.parse(value);if(!Number.isFinite(n))fail('CLOCK');return n;};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const safeText=value=>typeof value==='string'&&value.length<=3000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);

function assetSnapshot(asset,interpretation){
  const analysis=interpretation?.assets?.find?.(x=>x.symbol===asset.symbol)??null;
  return {
    symbol:asset.symbol, price:asset.equity?.price??null, priceSourceAt:asset.equity?.sourceAt??null,
    trend:asset.trend?.direction??null, disposition:asset.disposition??null,
    blockers:Array.isArray(asset.blockers)?[...asset.blockers]:[],
    attributedBias:analysis?.bias??null, attributedSummary:analysis?.summary??null,
    attributedInvalidation:analysis?.invalidation??null,
    analysisAssessedAt:interpretation?.assessedAt??null, analysisPath:interpretation?.path??null
  };
}
function sourceSnapshot(source){
  return {sourceId:source.id,status:source.status??'UNKNOWN',observedAt:source.observedAt??null,
    partial:Boolean(source.partial),diagnostic:source.diagnostic??null};
}
function validateSnapshot(value){
  if(value.version!==VERSION||value.executionAllowed!==false)fail('VERSION');
  clock(value.recordedAt);
  if(!Array.isArray(value.assets)||value.assets.length>2||new Set(value.assets.map(x=>x.symbol)).size!==value.assets.length)fail('ASSETS');
  for(const asset of value.assets){
    if(!['GLD','IBIT'].includes(asset.symbol))fail('SYMBOL');
    if(asset.priceSourceAt!==null&&clock(asset.priceSourceAt)>clock(value.recordedAt))fail('FUTURE_PRICE');
    if(asset.analysisAssessedAt!==null&&clock(asset.analysisAssessedAt)>clock(value.recordedAt))fail('FUTURE_ANALYSIS');
    if(!Array.isArray(asset.blockers))fail('BLOCKERS');
  }
  if(!Array.isArray(value.sources))fail('SOURCES');
  for(const source of value.sources){
    if(!safeText(source.sourceId)||!safeText(source.status))fail('SOURCE');
    if(source.observedAt!==null&&clock(source.observedAt)>clock(value.recordedAt))fail('FUTURE_SOURCE');
  }
  if(!Array.isArray(value.missingEvidence))fail('MISSING');
  return value;
}
export function preparePreEventState(state,recordedAt){
  clock(recordedAt);
  const guidance=state?.guidance,focused=state?.focusedNews;
  const current=guidance?.state==='AVAILABLE'?guidance.data?.current:null;
  const interpretation=guidance?.state==='AVAILABLE'?guidance.data?.interpretation:null;
  const assets=(current?.assets??[]).filter(x=>['GLD','IBIT'].includes(x.symbol)).map(x=>assetSnapshot(x,interpretation));
  const sources=focused?.state==='AVAILABLE'?(focused.data?.sources??[]).map(sourceSnapshot):[];
  const missing=[];
  if(assets.length!==2)missing.push('GLD_IBIT_CURRENT_STATE_INCOMPLETE');
  if(!interpretation?.assets?.length)missing.push('ATTRIBUTED_INTERPRETATION_MISSING');
  if(focused?.state!=='AVAILABLE')missing.push('FOCUSED_NEWS_STATE_UNAVAILABLE');
  if(!sources.length)missing.push('FOCUSED_NEWS_SOURCE_HEALTH_MISSING');
  for(const asset of assets){
    if(asset.price===null||asset.priceSourceAt===null)missing.push(`${asset.symbol}_PRICE_MISSING`);
    if(asset.attributedBias===null)missing.push(`${asset.symbol}_ATTRIBUTED_BIAS_MISSING`);
  }
  const payload={version:VERSION,recordedAt,sourceStateLoadedAt:state?.loadedAt??null,assets,sources,
    missingEvidence:[...new Set(missing)].sort(),authority:'PROSPECTIVE_STATE_OBSERVATION_NOT_TRADE_DECISION',
    executionAllowed:false};
  return validateSnapshot(payload);
}
export function savePreEventState(root,state,recordedAt,{id=randomUUID()}={}){
  const snapshot=preparePreEventState(state,recordedAt);
  if(!/^[a-f0-9-]{8,80}$/i.test(id))fail('ID');
  const rootReal=realpathSync(root),directory=resolve(rootReal,BASE,recordedAt.slice(0,10));
  mkdirSync(directory,{recursive:true});
  if(lstatSync(directory).isSymbolicLink())fail('DIRECTORY');
  const file=resolve(directory,recordedAt.replace(/[:.]/g,'-')+'-'+id+'.json');
  if(existsSync(file))fail('EXISTS');
  const envelope={snapshot,fingerprint:hash(snapshot)};
  writeFileSync(file,JSON.stringify(envelope,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  const verified=verifyPreEventState(rootReal,file);
  return {path:file.slice(rootReal.length+1).replaceAll('\\','/'),snapshot:verified.snapshot,
    fingerprint:verified.fingerprint,executionAllowed:false};
}

export function verifyPreEventState(root,file){
  const rootReal=realpathSync(root),base=resolve(rootReal,BASE),resolved=resolve(file);
  if(!resolved.startsWith(base+(process.platform==='win32'?'\\':'/')))fail('PATH');
  const stat=lstatSync(resolved);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>512*1024)fail('FILE');
  let value;
  try{value=JSON.parse(readFileSync(resolved,'utf8').replace(/^\uFEFF/,''));}catch{fail('JSON');}
  if(!value||Object.keys(value).sort().join(',')!=='fingerprint,snapshot')fail('ENVELOPE');
  validateSnapshot(value.snapshot);
  if(value.fingerprint!==hash(value.snapshot))fail('INTEGRITY');
  return value;
}

export function listPreEventStates(root,asOf){
  const cutoff=clock(asOf),rootReal=realpathSync(root),base=resolve(rootReal,BASE);
  if(!existsSync(base))return [];
  const baseStat=lstatSync(base);if(!baseStat.isDirectory()||baseStat.isSymbolicLink())fail('DIRECTORY');
  const days=readdirSync(base,{withFileTypes:true}).filter(x=>x.isDirectory()&&!x.isSymbolicLink()).sort((a,b)=>a.name.localeCompare(b.name));
  const records=[];
  for(const day of days){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day.name))continue;
    const directory=resolve(base,day.name),files=readdirSync(directory,{withFileTypes:true});
    if(files.length>2000)fail('LIMIT');
    for(const entry of files){
      if(!entry.isFile()||!entry.name.endsWith('.json'))continue;
      const value=verifyPreEventState(root,resolve(directory,entry.name));
      if(clock(value.snapshot.recordedAt)<=cutoff)records.push(value);
    }
  }
  return records.sort((a,b)=>clock(a.snapshot.recordedAt)-clock(b.snapshot.recordedAt));
}
