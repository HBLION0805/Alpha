import type {ExpectationIdentity, ExpectationRequest, ExpectationRow, ExpectationSnapshot} from '../../contracts/OptionsMarketExpectation';
import {snapshotNs} from '../options-robinhood-data/RobinhoodSnapshotPaper';

const fail=(code:string):never=>{throw Error('MACRO_EXPECTATION_'+code);};
const exact=(v:any,fields:string)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==fields.split(',').sort().join())fail('FIELDS');};
const text=(v:unknown,max=1500)=>{if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail('TEXT');};
const id=(v:string)=>{if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(v))fail('ID');};
const clock=(v:string)=>{try{return snapshotNs(v);}catch{return fail('CLOCK');}};
const keys=['eventKey','metric','period','unit','adjustment','releaseVersion','valueMeaning'] as const;
const identityFields=keys.join(',');
const known=(v:string)=>v.trim()!==''&&v!=='UNKNOWN';
const decimal=(v:string)=>{
  if(typeof v!=='string'||! /^-?(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(v))fail('VALUE');
  const negative=v.startsWith('-'),[whole,part='']=(negative?v.slice(1):v).split('.');
  return (negative?-1n:1n)*(BigInt(whole!)*1000000n+BigInt(part.padEnd(6,'0')));
};
const formatted=(v:bigint)=>{const sign=v<0n?'-':'';if(v<0n)v=-v;return sign+(v/1000000n).toString()+(v%1000000n?'.'+(v%1000000n).toString().padStart(6,'0').replace(/0+$/,''):'');};
function identity(v:ExpectationIdentity){for(const k of keys){text(v[k],180);if(!v[k].trim())fail('IDENTITY');}}
export function expectationIdentityIssues(a:ExpectationIdentity,b:ExpectationIdentity):string[]{
  return keys.filter(k=>!known(a[k])||!known(b[k])||a[k]!==b[k]).map(k=>'EXPECTATION_'+({eventKey:'EVENT',metric:'METRIC',period:'PERIOD',unit:'UNIT',adjustment:'ADJUSTMENT',releaseVersion:'VINTAGE',valueMeaning:'VALUE_SEMANTICS'}[k])+(!known(a[k])||!known(b[k])?'_UNKNOWN':'_MISMATCH'));
}
export function validateExpectationRequest(r:ExpectationRequest,at:string){
  exact(r,'id,stage,supersedes,planKey,planVersion,comparisonPath,comparisonFingerprint,eventKey,releaseAt,rows,note,ownerConfirmed');
  id(r.id);for(const k of ['supersedes','planKey','planVersion','comparisonPath','comparisonFingerprint','eventKey','note'] as const)text(r[k]);
  if(!['RESEARCH','FINAL_PRE_ENTRY'].includes(r.stage)||typeof r.ownerConfirmed!=='boolean')fail('STAGE');
  clock(r.releaseAt);clock(at);
  if(!Array.isArray(r.rows)||!r.rows.length||r.rows.length>6||new Set(r.rows.map(x=>x.id)).size!==r.rows.length)fail('ROWS');
  for(const row of r.rows){
    exact(row,'id,subject,forecasts,selectedConsensusId,alpha');id(row.id);text(row.selectedConsensusId,80);
    exact(row.subject,identityFields);identity(row.subject);if(row.subject.eventKey!==r.eventKey)fail('EVENT');
    if(!Array.isArray(row.forecasts)||!row.forecasts.length||row.forecasts.length>6||new Set(row.forecasts.map(x=>x.id)).size!==row.forecasts.length)fail('FORECASTS');
    for(const f of row.forecasts){
      exact(f,identityFields+',id,type,value,source,url,reference,locator,publishedAt,receivedAt,coverage,methodology,consensusBasis');identity(f);id(f.id);
      if(!['CONSENSUS','SINGLE_FORECAST','MODEL_ESTIMATE','MARKET_IMPLIED','OWNER_EXPECTATION','UNKNOWN'].includes(f.type))fail('TYPE');
      if(f.value!==null)decimal(f.value);if(f.type==='UNKNOWN'&&f.value!==null)fail('UNKNOWN_VALUE');
      for(const k of ['source','url','reference','locator','coverage','methodology'] as const){text(f[k]);if(!f[k].trim()&&k!=='url')fail('SOURCE');}
      if(f.url){let u;try{u=new URL(f.url);}catch{fail('URL');}if(u!.protocol!=='https:'||u!.username||u!.password)fail('URL');}
      if(!['SOURCE_SURVEY','NOT_CONSENSUS'].includes(f.consensusBasis)||(f.type==='CONSENSUS')!==(f.consensusBasis==='SOURCE_SURVEY'))fail('CONSENSUS_CLASSIFICATION');
      if(clock(f.receivedAt)>clock(at)||(f.publishedAt!==null&&clock(f.publishedAt)>clock(f.receivedAt)))fail('SOURCE_CLOCK');
    }
    exact(row.alpha,identityFields+',value,qualitative,attribution,basis');identity(row.alpha);text(row.alpha.basis);
    if(row.alpha.value!==null)decimal(row.alpha.value);
    if(!['WEAKER_THAN_CONSENSUS','IN_LINE','STRONGER_THAN_CONSENSUS','UNKNOWN'].includes(row.alpha.qualitative)||!['HOST_AI','OWNER'].includes(row.alpha.attribution))fail('ALPHA');
    if(row.selectedConsensusId&&!row.forecasts.some(f=>f.id===row.selectedConsensusId&&f.type==='CONSENSUS'))fail('SELECTED_CONSENSUS');
  }
  return r;
}
export function expectationDifference(row:ExpectationRow){
  const market=row.forecasts.find(f=>f.id===row.selectedConsensusId&&f.type==='CONSENSUS')??null;
  const issues:string[]=[];
  if(!market||market.value===null)issues.push('CONSENSUS_EXPECTATION_UNKNOWN');
  if(market)issues.push(...expectationIdentityIssues(row.subject,market));
  issues.push(...expectationIdentityIssues(row.subject,row.alpha));
  const numericDifference=issues.length===0&&row.alpha.value!==null&&market?.value!==null&&market?formatted(decimal(row.alpha.value)-decimal(market.value)):null;
  return {id:row.id,subject:row.subject,market,forecasts:row.forecasts,alpha:row.alpha,
    numericDifference,qualitative:issues.length?'UNKNOWN':row.alpha.qualitative,
    issues:[...new Set(issues)],meaning:'Alpha minus selected survey consensus; no price direction, actual or trade outcome.'};
}
export function assessExpectationSnapshot(s:ExpectationSnapshot,context:{at:string;eventKey:string;releaseAt:string;thesisFingerprint:string;planFrozenAt:string|null;openedAt:string|null}){
  const r=s.request;validateExpectationRequest(r,s.frozenAt);
  const rows=r.rows.map(expectationDifference),issues=rows.flatMap(x=>x.issues);
  if(r.rows.some(x=>x.alpha.value===null&&x.alpha.qualitative==='UNKNOWN'))issues.push('ALPHA_EXPECTATION_UNKNOWN');
  if(r.stage!=='FINAL_PRE_ENTRY')issues.push('FINAL_EXPECTATION_SNAPSHOT_MISSING');
  if(!s.ownerConfirmedAt||!r.ownerConfirmed)issues.push('OWNER_EXPECTATION_NOT_CONFIRMED');
  if(r.eventKey!==context.eventKey||r.releaseAt!==context.releaseAt)issues.push('EXPECTATION_EVENT_TIME_MISMATCH');
  if(s.thesisFingerprint!==context.thesisFingerprint)issues.push('EXPECTATION_THESIS_CHANGED');
  if(clock(s.frozenAt)>clock(context.at)||clock(s.receivedAt)>clock(s.frozenAt)||clock(s.frozenAt)>=clock(context.releaseAt)||
     context.planFrozenAt&&clock(s.frozenAt)>=clock(context.planFrozenAt)||context.openedAt&&clock(s.frozenAt)>=clock(context.openedAt))issues.push('EXPECTATION_NOT_FROZEN_BEFORE_ENTRY');
  return {id:r.id,stage:r.stage,frozenAt:s.frozenAt,receivedAt:s.receivedAt,ownerConfirmedAt:s.ownerConfirmedAt,
    originalThesisFingerprint:s.thesisFingerprint,rows,blockers:[...new Set(issues)],
    status:issues.length?'NOT_READY':'FINAL_REFERENCE_READY',
    coverage:'Saved attributed evidence, not machine authentication. No new freshness interval is inferred; recheck the selected source and schedule before final confirmation.',
    executionAllowed:false};
}
