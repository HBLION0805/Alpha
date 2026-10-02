import {existsSync,lstatSync,mkdirSync,realpathSync,renameSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {PointInTimeReplayEngine} from '../../src/engines/event-intelligence-replay/PointInTimeReplayEngine.ts';
import {listEventObservations} from './options-event-intelligence-observation.mjs';
import {listPreEventStates} from './options-event-intelligence-pre-event.mjs';
import {readReleaseFactEvidence,readIssuedAssessments,readIssuedAssessmentInputs} from './options-event-intelligence-assessment.mjs';

const EVENT_ID='employment-situation-20261002';
const EVENT_TIME='2026-10-02T12:30:00.000Z';
const BASE='data/runtime/options-event-intelligence/cases';
const fail=code=>{throw Error('EVENT_INTELLIGENCE_EMPLOYMENT_CASE_'+code);};
const clock=value=>{const n=Date.parse(value);if(!Number.isFinite(n))fail('CLOCK');return n;};

function preStateEvidence(record){
  const s=record.snapshot,assets=s.assets.map(x=>x.symbol+' '+String(x.price??'UNKNOWN')+' @ '+String(x.priceSourceAt??'UNKNOWN')+
    '; bias '+String(x.attributedBias??'UNKNOWN')).join(' | ');
  return {
    evidenceId:'employment-pre-state-'+s.recordedAt.replace(/[:.]/g,'-').toLowerCase(),
    eventId:EVENT_ID,kind:'PRE_EVENT_STATE',sourceId:'alpha-pre-event-state',sourceUrl:null,
    occurredAt:s.recordedAt,sourcePublishedAt:null,vendorReceivedAt:null,receivedAt:s.recordedAt,parsedAt:s.recordedAt,
    availability:s.missingEvidence.length||s.assets.some(a=>a.attributedBias==='INSUFFICIENT_EVIDENCE'||a.blockers.some(b=>/MISSING|NOT_FRESH|OLD/.test(b)))?'UNKNOWN':'CURRENT',
    summary:'Prospective pre-event state. '+assets+'; missing: '+(s.missingEvidence.join(', ')||'none'),
    supersedesEvidenceId:null,expectationSnapshot:null,marketObservation:null
  };
}
function pendingRelease(asOf){
  return {
    evidenceId:'employment-release-observation-pending',eventId:EVENT_ID,kind:'SOURCE_STATUS',sourceId:'bls',
    sourceUrl:'https://www.bls.gov/news.release/empsit.nr0.htm',occurredAt:null,sourcePublishedAt:null,vendorReceivedAt:null,
    receivedAt:asOf,parsedAt:asOf,availability:'MISSING',
    summary:'No prospective BLS Employment Situation source observation has been captured as of this materialization. This is a gap marker, not evidence that the release did not occur.',
    supersedesEvidenceId:null,expectationSnapshot:null,marketObservation:null
  };
}
function casePath(root){
  const rootReal=realpathSync(root),dir=resolve(rootReal,BASE);
  if(!existsSync(dir))mkdirSync(dir,{recursive:true});
  if(!lstatSync(dir).isDirectory()||lstatSync(dir).isSymbolicLink())fail('DIRECTORY');
  return {rootReal,dir,file:resolve(dir,EVENT_ID+'.json')};
}
export function materializeEmploymentCase(root,asOf){
  clock(asOf);
  const pre=listPreEventStates(root,new Date(Math.min(clock(asOf),clock(EVENT_TIME)-1)).toISOString());
  const observations=listEventObservations(root,EVENT_ID,asOf).map(x=>structuredClone(x.evidence));
  const evidence=[...pre.map(preStateEvidence),...observations,...readReleaseFactEvidence(root,asOf)];
  for(const frozen of readIssuedAssessmentInputs(root,asOf)){
    const existing=evidence.find(e=>e.evidenceId===frozen.evidenceId);
    if(existing&&JSON.stringify(existing)!==JSON.stringify(frozen))fail('FROZEN_INPUT_CONFLICT');
    if(!existing)evidence.push(frozen);
  }
  const expectation=[...evidence].filter(x=>x.kind==='EXPECTATION_SNAPSHOT'&&clock(x.receivedAt)<clock(EVENT_TIME)).sort((a,b)=>clock(a.receivedAt)-clock(b.receivedAt)).at(-1)??null;
  const release=evidence.filter(x=>x.kind==='SOURCE_OBSERVATION'&&x.sourceId==='bls'&&clock(x.receivedAt)>=clock(EVENT_TIME)).sort((a,b)=>clock(a.receivedAt)-clock(b.receivedAt))[0]??null;
  if(!release)evidence.push(pendingRelease(asOf));
  const market=evidence.filter(x=>x.kind==='MARKET_OBSERVATION').sort((a,b)=>clock(a.receivedAt)-clock(b.receivedAt)).at(-1)??null;
  const preEvidence=evidence.filter(x=>x.kind==='PRE_EVENT_STATE').at(-1)??null;
  const required=[preEvidence?.evidenceId,expectation?.evidenceId,(release??evidence.find(x=>x.evidenceId==='employment-release-observation-pending'))?.evidenceId,market?.evidenceId].filter(Boolean);
  const value={
    eventId:EVENT_ID,caseType:'SCHEDULED',title:'Employment Situation — September 2026',
    eventTime:EVENT_TIME,createdAt:asOf,evidence,
    historicalDecisions:readIssuedAssessments(root,asOf),recomputedDecisions:[],invalidationRules:[],requiredEvidenceIds:[...new Set(required)]
  };
  new PointInTimeReplayEngine().replay(value,asOf);
  return value;
}
export function saveEmploymentCase(root,asOf){
  const value=materializeEmploymentCase(root,asOf),{rootReal,dir,file}=casePath(root);
  const temp=resolve(dir,'.'+EVENT_ID+'.'+process.pid+'.tmp');
  writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{encoding:'utf8',flag:'w'});
  renameSync(temp,file);
  return {path:file.slice(rootReal.length+1).replaceAll('\\','/'),eventId:EVENT_ID,evidenceCount:value.evidence.length,
    requiredEvidenceCount:value.requiredEvidenceIds.length,executionAllowed:false};
}
